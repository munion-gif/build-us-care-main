"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { IntakeDetail } from "@/lib/admin-intake-data";
import { openQuoteDocumentPreviewWindow, type QuoteDocumentInput } from "@/lib/quote-document";
import { adminFetch, useToast, won, timeAgo } from "../../_lib/ui";

type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  price: number;
  laborPrice: number;
  image: string | null;
  popular: boolean;
};
type CatalogCategory = { code: string; label: string; products: CatalogProduct[] };

type QuoteRow = { service_type_code: string; product_id: string; qty: number };

const PHOTO_LABELS = ["전체", "문제 부위", "연결부", "추가 1", "추가 2", "추가 3"];

// 문의 품목 텍스트 → 카탈로그 카테고리 추정
function guessServiceCode(itemText: string): string {
  const t = itemText ?? "";
  if (t.includes("양변기") || t.includes("변기")) return "toilet_replace";
  if (t.includes("세면")) return "basin_replace";
  if (t.includes("비데")) return "bidet_install";
  if (t.includes("환풍")) return "ventilator_replace";
  if (t.includes("샷시") || t.includes("창")) return "sash_handle";
  if (t.includes("도어") || t.includes("문")) return "door_handle";
  if (t.includes("실리콘")) return "silicone_repair";
  if (t.includes("액세서리") || t.includes("수건") || t.includes("휴지")) return "bath_accessory";
  if (t.includes("수전")) return "faucet_replace";
  return "";
}

export default function InquiryDetailClient({ detail, kakaoUrl }: { detail: IntakeDetail; kakaoUrl: string }) {
  const router = useRouter();
  const toast = useToast();
  const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
  const [rows, setRows] = useState<QuoteRow[]>([
    { service_type_code: guessServiceCode(detail.item), product_id: "", qty: 1 }
  ]);
  const [addr, setAddr] = useState(detail.address === "주소 미입력" ? "" : detail.address);
  const [visitDate, setVisitDate] = useState("");
  const [visitSlot, setVisitSlot] = useState<"morning" | "afternoon" | "">("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedQuote, setSavedQuote] = useState<{ id: string; doc: QuoteDocumentInput; totalFinal: number } | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const res = await adminFetch<{ categories: CatalogCategory[] }>("/api/admin/catalog");
      if (res.ok && res.data) setCatalog(res.data.categories ?? []);
    })();
  }, []);

  const productsOf = (code: string) => catalog.find((c) => c.code === code)?.products ?? [];
  const productOf = (row: QuoteRow) => productsOf(row.service_type_code).find((p) => p.id === row.product_id) ?? null;

  const estimate = useMemo(() => {
    let material = 0;
    let labor = 0;
    for (const r of rows) {
      const p = productOf(r);
      if (!p) continue;
      material += p.price * r.qty;
      labor += p.laborPrice * r.qty;
    }
    return { material, labor };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, catalog]);

  const validRows = rows.filter((r) => r.service_type_code && r.product_id);

  async function saveQuote(): Promise<{ id: string; doc: QuoteDocumentInput; totalFinal: number } | null> {
    if (validRows.length === 0) {
      toast("제품을 하나 이상 선택해주세요", "err");
      return null;
    }
    if (!detail.name || !detail.phone) {
      toast("고객 이름/연락처가 없어 견적서를 만들 수 없어요", "err");
      return null;
    }
    if (!addr.trim()) {
      toast("시공 주소를 입력해주세요", "err");
      return null;
    }
    setBusy(true);
    const body: Record<string, unknown> = {
      manual_quote_id: savedQuote?.id ?? null,
      service_type_code: validRows[0].service_type_code,
      customer_name: detail.name,
      customer_phone: detail.phone,
      address_text: addr.trim(),
      items: validRows
    };
    if (visitDate && visitSlot) body.schedule = { reserved_date: visitDate, time_slot: visitSlot };
    const res = await adminFetch<{ manualQuote: { id: string; total_final: number }; quoteDocumentInput: QuoteDocumentInput }>(
      "/api/admin/manual-quotes",
      { method: "POST", body: JSON.stringify(body) }
    );
    setBusy(false);
    if (!res.ok || !res.data) {
      toast(res.message ?? "견적 저장에 실패했어요", "err");
      return null;
    }
    const saved = {
      id: res.data.manualQuote.id,
      doc: res.data.quoteDocumentInput,
      totalFinal: Number(res.data.manualQuote.total_final ?? 0)
    };
    setSavedQuote(saved);
    return saved;
  }

  async function previewQuote() {
    const saved = await saveQuote();
    if (!saved) return;
    openQuoteDocumentPreviewWindow(saved.doc);
  }

  async function sendQuote() {
    const saved = await saveQuote();
    if (!saved) return;
    setBusy(true);
    const res = await adminFetch(`/api/admin/manual-quotes/${saved.id}/quote-alimtalk`, { method: "POST", body: "{}" });
    setBusy(false);
    if (!res.ok) {
      toast(res.message ?? "알림톡 발송에 실패했어요", "err");
      return;
    }
    toast(`${detail.name}님에게 견적서(${won(saved.totalFinal)}) 알림톡을 보냈어요 — 결제하면 예약 주문으로 전환됩니다`);
    router.refresh();
  }

  async function sendPhotoRequest() {
    if (!memo.trim()) {
      toast("고객에게 보낼 메시지를 입력해주세요", "err");
      return;
    }
    setBusy(true);
    const res = await adminFetch(`/api/admin/diagnoses/${detail.id}/photo-request-alimtalk`, {
      method: "POST",
      body: JSON.stringify({ memo: memo.trim() })
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.message ?? "알림톡 발송에 실패했어요", "err");
      return;
    }
    setMemo("");
    toast("상담 메시지를 알림톡으로 보냈어요");
  }

  async function setResult(result: string, label: string) {
    setBusy(true);
    const res = await adminFetch(`/api/admin/diagnoses/${detail.id}`, {
      method: "PATCH",
      body: JSON.stringify({ result })
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.message ?? "상태 변경에 실패했어요", "err");
      return;
    }
    toast(`문의 상태를 "${label}"로 바꿨어요`);
    router.refresh();
  }

  const pillClass =
    detail.status.tone === "new" ? "p-new" : detail.status.tone === "done" ? "p-done" : detail.status.tone === "sent" ? "p-pay" : "p-assign";

  return (
    <>
      <Link className="back" href="/admin/inquiries">
        ← 사진확인 문의로
      </Link>
      <div className="inq-head">
        <span className="nm">{detail.name ?? "고객"}</span>
        <span className="phn">
          {detail.phone ?? "연락처 없음"} · {detail.address}
        </span>
        <span className={`pill ${pillClass}`}>{detail.status.text}</span>
        <span className="age">{timeAgo(detail.createdAt)}</span>
      </div>

      <div className="inq-grid">
        <div>
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="p-head">
              <span className="p-t">문의 내용</span>
              {detail.orderNumber ? (
                <span className="p-link" role="presentation">
                  {detail.orderNumber}
                </span>
              ) : null}
            </div>
            <p style={{ margin: "8px 0 12px", fontSize: 13.5 }}>
              {detail.item}
              {detail.memo ? ` — ${detail.memo}` : ""}
            </p>
            <div className="photos">
              {detail.photos.length === 0 ? (
                <span className="next-hint">등록된 사진이 없어요</span>
              ) : (
                detail.photos.map((src, i) => (
                  <button key={i} className="ph" onClick={() => setLightbox(i)} aria-label={`사진 ${i + 1} 크게 보기`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`고객 사진 ${i + 1}`} />
                    <span className="ph-label">{PHOTO_LABELS[i] ?? `사진 ${i + 1}`}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <div className="p-head">
              <span className="p-t">고객 상담</span>
              <a className="p-link" href={kakaoUrl} target="_blank" rel="noreferrer">
                카카오 채널에서 열기 ↗
              </a>
            </div>
            <p className="p-s">메시지를 입력하고 보내면 고객에게 알림톡으로 전달돼요 (사진 추가 요청 포함).</p>
            <div className="chat-in">
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 배관 연결부가 보이게 사진 한 장만 더 부탁드려요"
                aria-label="상담 메시지"
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendPhotoRequest();
                }}
              />
              <button className="cta" disabled={busy} onClick={sendPhotoRequest}>
                보내기
              </button>
            </div>
            <div className="minor-actions" style={{ marginTop: 14 }}>
              <button className="btn" disabled={busy} onClick={() => setResult("교체추천", "교체 추천")}>
                교체 추천
              </button>
              <button className="btn" disabled={busy} onClick={() => setResult("보류", "추가 확인 필요")}>
                추가 확인
              </button>
              <button className="btn" disabled={busy} onClick={() => setResult("현장확인필요", "현장 확인 필요")}>
                현장 확인
              </button>
              <button className="btn danger" disabled={busy} onClick={() => setResult("교체불필요", "교체 불필요 · 종료")}>
                교체 불필요 · 종료
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="p-head">
            <span className="p-t">견적서 작성</span>
            <span className="p-link" role="presentation">
              홈페이지 견적보기와 같은 양식
            </span>
          </div>
          <p className="p-s">홈페이지 판매 제품에서 고르면 제품가·시공비·배송비가 자동 계산돼요 (서버 계산, 사이트와 동일 기준).</p>

          <div className="qb-meta">
            <div className="qb-f">
              <label>시공 주소</label>
              <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="시공 주소 입력" />
            </div>
            <div className="qb-f">
              <label>예약 일시 (선택)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} style={{ flex: 1 }} />
                <select value={visitSlot} onChange={(e) => setVisitSlot(e.target.value as any)} style={{ width: 84 }}>
                  <option value="">미정</option>
                  <option value="morning">오전</option>
                  <option value="afternoon">오후</option>
                </select>
              </div>
            </div>
          </div>

          {rows.map((row, i) => {
            const product = productOf(row);
            const products = productsOf(row.service_type_code);
            return (
              <div className="qb-row" key={i}>
                {rows.length > 1 && (
                  <button
                    className="rm"
                    title="행 삭제"
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  >
                    삭제 ×
                  </button>
                )}
                <div className="qb-line a">
                  <div className="qb-thumb">
                    {product?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image} alt="" />
                    ) : (
                      "사진"
                    )}
                  </div>
                  <div className="qb-f">
                    <label>품목 (홈페이지 카테고리)</label>
                    <select
                      value={row.service_type_code}
                      onChange={(e) =>
                        setRows((rs) => rs.map((r, j) => (j === i ? { ...r, service_type_code: e.target.value, product_id: "" } : r)))
                      }
                    >
                      <option value="">품목 선택</option>
                      {catalog.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="qb-f">
                    <label>제품 (홈페이지 판매 제품)</label>
                    <select
                      value={row.product_id}
                      onChange={(e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, product_id: e.target.value } : r)))}
                    >
                      <option value="">
                        {row.service_type_code ? `제품 선택 (${products.length}종)` : "품목을 먼저 고르세요"}
                      </option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {won(p.price)}
                          {p.popular ? " ★" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="qb-line b" style={{ gridTemplateColumns: "1fr .6fr 1fr 1fr" }}>
                  <div className="qb-f">
                    <label>품번</label>
                    <input value={product?.sku ?? ""} readOnly placeholder="—" />
                  </div>
                  <div className="qb-f">
                    <label>수량</label>
                    <input
                      type="number"
                      min={1}
                      value={row.qty}
                      onChange={(e) =>
                        setRows((rs) => rs.map((r, j) => (j === i ? { ...r, qty: Math.max(1, Number(e.target.value || 1)) } : r)))
                      }
                    />
                  </div>
                  <div className="qb-f">
                    <label>제품가 (단가·VAT 포함)</label>
                    <input value={product ? won(product.price) : ""} readOnly placeholder="제품 선택 시 자동" />
                  </div>
                  <div className="qb-f">
                    <label>시공비 (단가·VAT 포함)</label>
                    <input value={product ? won(product.laborPrice) : ""} readOnly placeholder="제품 선택 시 자동" />
                  </div>
                </div>
              </div>
            );
          })}
          <button className="qb-add" onClick={() => setRows((rs) => [...rs, { service_type_code: "", product_id: "", qty: 1 }])}>
            + 제품 행 추가
          </button>

          <div className="qb-sum">
            <div className="srow">
              <span>제품 합계</span>
              <b>{won(estimate.material)}</b>
            </div>
            <div className="srow">
              <span>시공비 합계</span>
              <b>{won(estimate.labor)}</b>
            </div>
            <div className="srow">
              <span>배송비·폐기비</span>
              <b>{savedQuote ? won(savedQuote.totalFinal - estimate.material - estimate.labor) : "저장 시 서버 계산"}</b>
            </div>
            <div className="srow final">
              <span>최종합계</span>
              <b>{savedQuote ? won(savedQuote.totalFinal) : `${won(estimate.material + estimate.labor)}+`}</b>
            </div>
          </div>

          <div className="qb-actions">
            <button className="btn" disabled={busy} onClick={previewQuote}>
              견적서 미리보기
            </button>
            <button className="cta" disabled={busy} onClick={sendQuote}>
              알림톡으로 견적서 보내기
            </button>
            {savedQuote ? (
              <button
                className="btn"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm("이 견적을 바로 주문으로 전환할까요? (보통은 고객 결제 시 자동 전환됩니다)")) return;
                  setBusy(true);
                  const res = await adminFetch(`/api/admin/manual-quotes/${savedQuote.id}/convert-order`, {
                    method: "POST",
                    body: "{}"
                  });
                  setBusy(false);
                  if (!res.ok) {
                    toast(res.message ?? "주문 전환에 실패했어요", "err");
                    return;
                  }
                  toast("주문으로 전환했어요 — 예약 주문에서 이어서 관리하세요");
                  router.push("/admin/orders");
                }}
              >
                주문으로 전환
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {lightbox !== null && detail.photos[lightbox] ? (
        <div className="lb-scrim on" role="dialog" aria-label="사진 크게 보기" onClick={() => setLightbox(null)}>
          <button className="lb-btn lb-x" aria-label="닫기" onClick={() => setLightbox(null)}>
            ×
          </button>
          <div className="lb-box" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={detail.photos[lightbox]} alt={`고객 사진 ${lightbox + 1}`} />
          </div>
          <div className="lb-nav" onClick={(e) => e.stopPropagation()}>
            <button
              className="lb-btn"
              aria-label="이전 사진"
              onClick={() => setLightbox((lightbox + detail.photos.length - 1) % detail.photos.length)}
            >
              ←
            </button>
            <span className="lb-cap">
              <span>
                {detail.name ?? "고객"} · {PHOTO_LABELS[lightbox] ?? `사진 ${lightbox + 1}`}
              </span>
              <span className="n">
                {lightbox + 1} / {detail.photos.length}
              </span>
            </span>
            <button className="lb-btn" aria-label="다음 사진" onClick={() => setLightbox((lightbox + 1) % detail.photos.length)}>
              →
            </button>
          </div>
          <span className="lb-hint">←/→ 이동 · 바깥 클릭으로 닫기</span>
        </div>
      ) : null}
    </>
  );
}
