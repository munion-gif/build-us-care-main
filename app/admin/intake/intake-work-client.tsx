"use client";

import { useEffect, useMemo, useState } from "react";
import { formatKRW } from "@/lib/format";
import { productDisposalFee } from "@/lib/builduscare-disposal";
import { productShippingEntriesTotal, productShippingEntryAmounts } from "@/lib/builduscare-shipping";
import { quoteSubtotalAmount, quoteVatIncludedAmount, quoteVatIncludedLaborAmount } from "@/lib/quote-totals";
import { buildQuoteDocumentHtml, saveQuoteAsImage, saveQuoteAsPdf, type QuoteDocumentInput } from "@/lib/quote-document";

/* ===== 타입 ===== */
export type CatalogProduct = {
  id: string;
  label: string;
  sku: string;
  image: string;
  price: number;
  laborPrice: number;
  categoryName?: string;
};
export type CatalogGroup = { id: string; name: string; products: CatalogProduct[] };
export type CatalogService = { serviceCode: string; label: string; groups: CatalogGroup[] };
export type QuoteLine = { serviceCode: string; productId: string; qty: number };
export type VersionRow = { version: number; at: string | null; note?: string; current?: boolean };

type SlotInfo = { available?: boolean; capacity?: number; used?: number };
type SlotDay = { blocked?: boolean; beforeMinDate?: boolean; allFull?: boolean; slots?: { morning?: SlotInfo; afternoon?: SlotInfo } };

type Props = {
  orderId: string | null;
  intakeId: string;
  orderNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  createdAtText: string | null;
  channelText?: string | null;
  photos: string[];
  photoLabels?: string[];
  memo: string | null;
  catalog: CatalogService[];
  initialItems: QuoteLine[];
  initialScheduleDate: string | null;
  initialScheduleTime: "morning" | "afternoon" | "" | null;
  stage: number; // 1 사진접수 · 2 견적 · 3 상담 · 4 일정
  versions?: VersionRow[];
  localMode?: boolean;
};

const WD = ["일", "월", "화", "수", "목", "금", "토"];
function isoOf(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function maskPhone(p?: string | null) {
  if (!p) return "";
  const d = p.replace(/\D/g, "");
  if (d.length < 8) return p;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
function slotText(s?: SlotInfo) {
  if (!s) return "-";
  if (!s.available) return "마감";
  if (typeof s.capacity === "number" && typeof s.used === "number") {
    const left = Math.max(0, s.capacity - s.used);
    return left <= 1 ? "1자리" : "여유";
  }
  return "여유";
}

export function IntakeWork(props: Props) {
  const {
    orderId, intakeId, orderNumber, customerName, customerPhone, address, createdAtText, channelText,
    photos, photoLabels = [], memo, catalog, initialItems, initialScheduleDate, initialScheduleTime,
    stage, versions = [], localMode = false
  } = props;

  const productMap = useMemo(() => {
    const map = new Map<string, CatalogProduct & { serviceCode: string }>();
    for (const svc of catalog) for (const g of svc.groups) for (const p of g.products) {
      map.set(`${svc.serviceCode}:${p.id}`, { ...p, serviceCode: svc.serviceCode });
    }
    return map;
  }, [catalog]);

  const [items, setItems] = useState<QuoteLine[]>(initialItems);
  const [scheduleDate, setScheduleDate] = useState<string | null>(initialScheduleDate);
  const [scheduleTime, setScheduleTime] = useState<"morning" | "afternoon" | "">(initialScheduleTime || "");
  const [cal, setCal] = useState(() => {
    if (initialScheduleDate) return { year: Number(initialScheduleDate.slice(0, 4)), month: Number(initialScheduleDate.slice(5, 7)) };
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
  const [slotDays, setSlotDays] = useState<Record<string, SlotDay>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCat, setPickerCat] = useState<string>(catalog[0]?.serviceCode ?? "");
  const [saving, setSaving] = useState<"send" | "draft" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [docHtml, setDocHtml] = useState<string | null>(null);
  const [docBusy, setDocBusy] = useState<"pdf" | "jpg" | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqMemo, setReqMemo] = useState("");
  const [reqBusy, setReqBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/slots?year=${cal.year}&month=${cal.month}&fresh=1`)
      .then((r) => r.json())
      .then((res) => { if (!cancelled) setSlotDays(res?.data?.days ?? {}); })
      .catch(() => { if (!cancelled) setSlotDays({}); });
    return () => { cancelled = true; };
  }, [cal.year, cal.month]);

  const resolved = useMemo(
    () => items.map((it) => ({ item: it, product: productMap.get(`${it.serviceCode}:${it.productId}`) ?? null })).filter((e) => e.product),
    [items, productMap]
  );
  const totalUnits = resolved.reduce((s, e) => s + e.item.qty, 0);
  const visitFee = resolved.reduce((s, e) => s + productDisposalFee(e.item.serviceCode) * e.item.qty, 0);
  const totals = useMemo(() => {
    const productTotal = resolved.reduce((s, e) => s + quoteVatIncludedAmount(Number(e.product?.price ?? 0)) * e.item.qty, 0);
    const laborTotal = resolved.reduce((s, e) => s + quoteVatIncludedLaborAmount(Number(e.product?.laborPrice ?? 0)) * e.item.qty, 0);
    const shippingTotal = productShippingEntriesTotal(resolved, {
      serviceCode: (e: any) => e.item.serviceCode,
      qty: (e: any) => e.item.qty,
      product: (e: any) => e.product
    });
    const finalTotal = quoteSubtotalAmount(productTotal, laborTotal + shippingTotal, visitFee, 0);
    return { productTotal, laborTotal, shippingTotal, finalTotal };
  }, [resolved, visitFee]);

  function setQty(idx: number, delta: number) {
    setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, qty: Math.max(1, it.qty + delta) } : it)));
  }
  function removeItem(idx: number) {
    setItems((cur) => cur.filter((_, i) => i !== idx));
  }
  function addProduct(serviceCode: string, productId: string) {
    setItems((cur) => {
      const ix = cur.findIndex((it) => it.serviceCode === serviceCode && it.productId === productId);
      if (ix >= 0) return cur.map((it, i) => (i === ix ? { ...it, qty: it.qty + 1 } : it));
      return [...cur, { serviceCode, productId, qty: 1 }];
    });
    setPickerOpen(false);
  }
  function moveMonth(delta: number) {
    setCal((c) => {
      const d = new Date(c.year, c.month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  }
  function clickDay(iso: string, day: SlotDay | undefined, unavailable: boolean) {
    if (unavailable || !day) return;
    setScheduleDate(iso);
    if (scheduleTime && !day.slots?.[scheduleTime]?.available) setScheduleTime("");
  }

  async function save(send: boolean) {
    if (resolved.length === 0) { setMsg("견적에 담을 제품을 최소 1개 추가하세요."); return; }
    if (localMode || !orderId) {
      setMsg(send ? "미리보기 모드 — 실제 발송은 프로덕션에서 됩니다." : "미리보기 모드 — 임시저장은 프로덕션에서 됩니다.");
      return;
    }
    setSaving(send ? "send" : "draft");
    setMsg(null);
    try {
      const validItems = resolved.map((e) => ({ service_type_code: e.item.serviceCode, product_id: e.item.productId, qty: e.item.qty }));
      const res = await fetch(`/api/admin/orders/${orderId}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_type_code: validItems[0]?.service_type_code,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          address_text: address || null,
          visit_fee: visitFee,
          discount: 0,
          schedule: scheduleDate && scheduleTime ? { reserved_date: scheduleDate, time_slot: scheduleTime } : null,
          items: validItems
        })
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setMsg(b?.error?.message ?? "저장에 실패했어요.");
        return;
      }
      if (send) {
        const k = await fetch(`/api/admin/orders/${orderId}/quote-alimtalk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        if (k.ok) {
          setMsg("견적서를 저장하고 카카오톡으로 보냈어요.");
        } else {
          const kb = await k.json().catch(() => ({}));
          const reason = kb?.error?.message ?? kb?.message ?? `발송 오류 (HTTP ${k.status})`;
          setMsg(`견적은 저장됐어요. 카톡 발송 실패: ${reason}`);
        }
      } else {
        setMsg("임시저장했어요.");
      }
    } catch {
      setMsg("처리 중 오류가 생겼어요.");
    } finally {
      setSaving(null);
    }
  }

  function buildDocInput(): QuoteDocumentInput | null {
    if (resolved.length === 0) return null;
    const shippingAmounts = productShippingEntryAmounts(resolved, {
      serviceCode: (e: any) => e.item.serviceCode,
      qty: (e: any) => e.item.qty,
      product: (e: any) => e.product
    });
    const rows = resolved.map((e, i) => {
      const p = e.product!;
      const lineMaterial = quoteVatIncludedAmount(p.price) * e.item.qty;
      const lineLabor = quoteVatIncludedLaborAmount(p.laborPrice) * e.item.qty;
      const lineShipping = shippingAmounts[i] ?? 0;
      return {
        id: `${e.item.productId}-${i}`,
        image: p.image || null,
        productName: p.label,
        sku: p.sku,
        serviceCode: e.item.serviceCode,
        categoryLabel: p.categoryName,
        qty: e.item.qty,
        price: lineMaterial,
        labor: lineLabor,
        shipping: lineShipping,
        finalPrice: lineMaterial + lineLabor + lineShipping
      };
    });
    const visitText = scheduleDate && scheduleTime
      ? `${scheduleDate} ${scheduleTime === "morning" ? "오전" : "오후"}`
      : "방문일 조율 중";
    return {
      orderNumber: orderNumber || "견적서",
      customerName,
      customerPhone,
      serviceName: resolved[0].item.serviceCode,
      rows,
      address: address || "주소 확인 중",
      visitText,
      productTotal: totals.productTotal,
      laborTotal: totals.laborTotal,
      shippingTotal: totals.shippingTotal,
      subtotalTotal: totals.finalTotal,
      finalTotal: totals.finalTotal,
      transferAmount: totals.productTotal + totals.shippingTotal,
      onsiteAmount: Math.max(0, totals.laborTotal + visitFee),
      productCatalogMode: true,
      cashReceiptText: "미정"
    } as QuoteDocumentInput;
  }

  async function sendPhotoRequest() {
    const m = reqMemo.trim();
    if (!m) return;
    if (localMode) { setMsg("미리보기 모드 — 실제 발송은 프로덕션에서 됩니다."); return; }
    setReqBusy(true);
    try {
      const r = await fetch(`/api/admin/diagnoses/${intakeId}/photo-request-alimtalk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: m })
      });
      if (r.ok) { setMsg("추가 사진 요청을 카카오톡으로 보냈어요."); setReqOpen(false); setReqMemo(""); }
      else { const b = await r.json().catch(() => ({})); setMsg(`추가 사진 요청 실패: ${b?.error?.message ?? `HTTP ${r.status}`}`); }
    } catch { setMsg("처리 중 오류가 생겼어요."); }
    finally { setReqBusy(false); }
  }

  function openDoc() {
    const input = buildDocInput();
    if (!input) { setMsg("견적에 담을 제품을 최소 1개 추가하세요."); return; }
    setDocHtml(buildQuoteDocumentHtml(input));
  }
  async function saveDoc(kind: "pdf" | "jpg") {
    const input = buildDocInput();
    if (!input) return;
    setDocBusy(kind);
    try {
      if (kind === "pdf") await saveQuoteAsPdf(input);
      else await saveQuoteAsImage(input);
    } catch {
      setMsg("저장 중 오류가 생겼어요. 다시 시도해주세요.");
    } finally {
      setDocBusy(null);
    }
  }
  // 견적서 팝업: 전체가 한눈에 보이도록 자동 축소 맞춤
  function fitDocFrame(e: React.SyntheticEvent<HTMLIFrameElement>) {
    const iframe = e.currentTarget;
    try {
      const doc = iframe.contentDocument;
      const sheet = doc?.querySelector<HTMLElement>(".sheet");
      if (!doc || !sheet) return;
      doc.documentElement.style.background = "#fffaf1";
      doc.body.style.margin = "0";
      doc.body.style.display = "block";
      const padW = 40;
      const padH = 28;
      const scale = Math.min(
        (iframe.clientWidth - padW) / sheet.scrollWidth,
        (iframe.clientHeight - padH) / sheet.scrollHeight,
        1
      );
      (doc.body.style as any).zoom = String(Math.max(0.3, scale));
    } catch {
      // 크로스 프레임 접근 실패 시 기본 스크롤 유지
    }
  }

  // 달력 렌더
  const firstDay = new Date(cal.year, cal.month - 1, 1).getDay();
  const daysInMonth = new Date(cal.year, cal.month, 0).getDate();

  return (
    <div className="iwrap">
      <style>{IW_CSS}</style>

      {/* 헤더 */}
      <div className="iw-head">
        <div className="who">{customerName ?? "이름 미입력"}</div>
        <div className="info">
          <span>📞 <b>{maskPhone(customerPhone) || "-"}</b></span>
          <span>📍 {address || "주소 미입력"}</span>
          <span>접수 <b>{createdAtText || "-"}</b>{channelText ? ` · ${channelText}` : ""}</span>
        </div>
      </div>

      {/* 진행 파이프라인 */}
      <div className="flow">
        {["사진접수", "견적 작성·발송", "상담·수정", "일정 확정"].map((t, i) => {
          const n = i + 1;
          const cls = n < stage ? "done" : n === stage ? "now" : "";
          return (
            <span key={t} style={{ display: "contents" }}>
              <div className={`fstep ${cls}`}>
                <span className="n">{n < stage ? "✓" : n}</span>{t}
              </div>
              {n < 4 ? <span className="farrow">›</span> : null}
            </span>
          );
        })}
      </div>

      <div className="cols">
        {/* 왼쪽: 고객 사진 */}
        <section className="panel">
          <h3>고객이 보낸 사진 <span className="badge">{photos.length}장</span></h3>
          {photos.length > 0 ? (
            <div className="photos">
              {photos.slice(0, 4).map((src, i) => (
                <a key={i} className="photo" href={src} target="_blank" rel="noreferrer">
                  <img src={src} alt={photoLabels[i] ?? `사진 ${i + 1}`} loading="lazy" />
                  {photoLabels[i] ? <span>{photoLabels[i]}</span> : null}
                </a>
              ))}
            </div>
          ) : (
            <div className="req" style={{ textAlign: "center", color: "var(--text-faint)" }}>첨부된 사진이 없어요.</div>
          )}
          {memo ? (
            <div className="req">
              <div className="lbl">고객 요청 내용</div>
              {memo}
            </div>
          ) : null}
        </section>

        {/* 오른쪽: 견적서 작성 */}
        <section className="panel">
          <h3>견적서 작성 {versions.length ? <span className="badge">v{versions.length}</span> : null}</h3>

          {resolved.length > 0 ? resolved.map((e, i) => (
            <div className="line" key={`${e.item.serviceCode}:${e.item.productId}`}>
              <div className="p">
                <b>{e.product!.label}</b>
                <small>{e.product!.categoryName ?? catalog.find((s) => s.serviceCode === e.item.serviceCode)?.label ?? ""}</small>
              </div>
              <div className="qty">
                <button type="button" onClick={() => setQty(i, -1)}>−</button>
                <span className="num">{e.item.qty}</span>
                <button type="button" onClick={() => setQty(i, 1)}>+</button>
              </div>
              <div className="pr num">{formatKRW(quoteVatIncludedAmount(e.product!.price) * e.item.qty).replace("원", "")}</div>
              <button type="button" className="del" onClick={() => removeItem(i)} aria-label="삭제">×</button>
            </div>
          )) : (
            <div className="line-empty">아직 담은 제품이 없어요. 아래에서 제품을 추가하세요.</div>
          )}

          <button type="button" className="addp" onClick={() => setPickerOpen((v) => !v)}>+ 제품 추가 / 변경</button>
          {pickerOpen ? (
            <div className="picker">
              <div className="pick-cats">
                {catalog.map((svc) => (
                  <button type="button" key={svc.serviceCode} className={`pick-chip ${pickerCat === svc.serviceCode ? "on" : ""}`} onClick={() => setPickerCat(svc.serviceCode)}>
                    {svc.label}
                  </button>
                ))}
              </div>
              <div className="pick-body">
                {(catalog.find((s) => s.serviceCode === pickerCat)?.groups ?? []).map((g) => (
                  <div key={g.id}>
                    {(catalog.find((s) => s.serviceCode === pickerCat)?.groups ?? []).length > 1 ? <div className="pick-group">{g.name}</div> : null}
                    {g.products.map((p) => (
                      <button type="button" key={p.id} className="pick-item" onClick={() => addProduct(pickerCat, p.id)}>
                        <span><b>{p.label}</b>{p.sku ? <small> · {p.sku}</small> : null}</span>
                        <span className="num">{formatKRW(quoteVatIncludedAmount(p.price))}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="sums">
            <div className="row"><span>제품가 합계 {totalUnits}개</span><span className="num">{formatKRW(totals.productTotal)}</span></div>
            <div className="row"><span>시공비</span><span className="num">{formatKRW(totals.laborTotal)}</span></div>
            <div className="row"><span>배송비</span><span className="num">{formatKRW(totals.shippingTotal)}</span></div>
            <div className="row"><span>폐기물 처리비</span><span className="num">{formatKRW(visitFee)}</span></div>
            <div className="row total"><span>예상 합계 (VAT 포함)</span><b className="num">{formatKRW(totals.finalTotal)}</b></div>
          </div>

          {/* 일정 선택 */}
          <div className="sched">
            <h3 style={{ marginTop: 6 }}>
              상담하며 일정 선택
              <span className="cal-nav">
                <button type="button" onClick={() => moveMonth(-1)}>‹</button>
                <b>{cal.year}년 {cal.month}월</b>
                <button type="button" onClick={() => moveMonth(1)}>›</button>
              </span>
            </h3>
            <div className="cal">
              {WD.map((w) => <div key={w} className="dow">{w}</div>)}
              {Array.from({ length: firstDay }, (_, i) => <div key={`b${i}`} className="cell mut" />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1;
                const iso = isoOf(cal.year, cal.month, d);
                const day = slotDays[iso];
                const morning = day?.slots?.morning;
                const afternoon = day?.slots?.afternoon;
                const unavailable = !day || day.blocked || day.beforeMinDate || day.allFull || (!morning?.available && !afternoon?.available);
                const sel = scheduleDate === iso;
                const av = !day ? "" : day.beforeMinDate ? "준비" : day.blocked ? "휴무" : day.allFull ? "마감" : (morning?.available || afternoon?.available) ? (slotText(morning) === "1자리" || slotText(afternoon) === "1자리" ? "1자리" : "여유") : "마감";
                return (
                  <button type="button" key={iso} className={`cell ${sel ? "sel" : ""} ${unavailable ? "full" : ""}`} disabled={unavailable} onClick={() => clickDay(iso, day, unavailable)}>
                    {d}<span className="av">{sel ? "선택됨" : av}</span>
                  </button>
                );
              })}
            </div>
            <div className="slotpick">
              {(["morning", "afternoon"] as const).map((slot) => {
                const day = scheduleDate ? slotDays[scheduleDate] : undefined;
                const ok = day?.slots?.[slot]?.available;
                return (
                  <button type="button" key={slot} className={`slotbtn ${scheduleTime === slot ? "on" : ""}`} disabled={!scheduleDate || !ok} onClick={() => setScheduleTime(slot)}>
                    {slot === "morning" ? "오전" : "오후"}{scheduleTime === slot ? " (선택)" : ""}
                  </button>
                );
              })}
            </div>
            {scheduleDate && scheduleTime ? (
              <div className="synced">🔗 {cal.month}/{Number(scheduleDate.slice(8))} {scheduleTime === "morning" ? "오전" : "오후"}으로 확정하면 → builduscare.co.kr 예약 달력에서 이 자리가 바로 사라져요 (고객 직접 예약 불가)</div>
            ) : (
              <div className="synced muted">🔗 여기서 고른 일정은 공개 예약 달력·[일정] 화면과 실시간 연동돼요.</div>
            )}
          </div>

          <div className="actions">
            <button type="button" className="btn btn-pri" onClick={() => save(true)} disabled={Boolean(saving)}>
              {saving === "send" ? "보내는 중…" : "견적서 보내기 (카카오톡) →"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={openDoc}>👁 견적서 보기</button>
            <button type="button" className="btn btn-ghost" onClick={() => setReqOpen((v) => !v)}>📷 추가 사진 요청</button>
            <button type="button" className="btn btn-ghost" onClick={() => save(false)} disabled={Boolean(saving)}>
              {saving === "draft" ? "저장 중…" : "임시저장"}
            </button>
          </div>
          {reqOpen ? (
            <div className="reqbox">
              <div className="reqbox-t">고객에게 <b>추가 사진</b>을 카카오톡으로 요청해요 (알림톡: 추가 자료 요청)</div>
              <textarea value={reqMemo} onChange={(e) => setReqMemo(e.target.value)} placeholder="예: 배관 연결부와 바닥 상태가 보이는 사진을 추가로 보내주세요." />
              <div className="reqbox-a">
                <button type="button" className="btn btn-pri" onClick={sendPhotoRequest} disabled={reqBusy || !reqMemo.trim()}>{reqBusy ? "보내는 중…" : "카톡으로 요청 보내기"}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setReqOpen(false)}>닫기</button>
              </div>
            </div>
          ) : null}
          {msg ? <div className="iw-msg">{msg}</div> : null}

          {versions.length ? (
            <div className="versions">
              {versions.map((v) => (
                <div key={v.version} className={`vr ${v.current ? "cur" : ""}`}>
                  <span className="vt num">v{v.version}</span> {v.at ?? ""} {v.note ? `· ${v.note}` : ""}{v.current ? " · 지금 편집 중" : ""}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {docHtml ? (
        <div className="doc-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDocHtml(null); }}>
          <div className="doc-modal">
            <div className="doc-bar">
              <b>견적서 미리보기</b>
              <div className="doc-actions">
                <button type="button" className="btn2" onClick={() => saveDoc("pdf")} disabled={Boolean(docBusy)}>{docBusy === "pdf" ? "저장 중…" : "📄 PDF 저장"}</button>
                <button type="button" className="btn2" onClick={() => saveDoc("jpg")} disabled={Boolean(docBusy)}>{docBusy === "jpg" ? "저장 중…" : "🖼 JPG 저장"}</button>
                <button type="button" className="btn2 x" onClick={() => setDocHtml(null)}>닫기</button>
              </div>
            </div>
            <iframe className="doc-frame" srcDoc={docHtml} title="견적서" onLoad={fitDocFrame} />
            <div className="doc-hint">💾 저장 시 <b>폴더를 직접 고를 수 있어요</b> (지원 브라우저). 안 되면 다운로드 폴더에 저장돼요.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const IW_CSS = `
.iwrap { --bg:#f5f5f7; --surface:#fff; --surface-2:#f2f4f7; --surface-3:#f2f4f7; --text:#101828; --text-muted:#667085; --text-faint:#98a2b3; --border:#e5e7eb; --border-strong:#d0d5dd; --accent:#245fff; --accent-soft:#eff4ff; --accent-text:#1647d7; --green:#178a4c; --green-soft:#e6f6ec; --amber:#b7791f; --amber-soft:#fdf3e2; --red:#cf3838; --violet:#6d5bd0; --violet-soft:#efecfb; --shadow:0 1px 2px rgba(16,24,40,.04),0 10px 26px -16px rgba(16,24,40,.2); color:var(--text); }
.iwrap .num { font-variant-numeric: tabular-nums; }
.iw-head .who { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; }
.iw-head .info { color: var(--text-muted); font-size: 13.5px; margin-top: 5px; display: flex; gap: 6px 14px; flex-wrap: wrap; }
.iw-head .info b { color: var(--text); font-weight: 700; }
.flow { display: flex; align-items: center; gap: 6px; margin: 18px 0 22px; flex-wrap: wrap; }
.fstep { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 700; color: var(--text-faint); }
.fstep .n { width: 22px; height: 22px; border-radius: 999px; background: var(--surface-3); display: grid; place-items: center; font-size: 12px; border: 1px solid var(--border); }
.fstep.done { color: var(--green); } .fstep.done .n { background: var(--green); color: #fff; border-color: var(--green); }
.fstep.now { color: var(--accent-text); } .fstep.now .n { background: var(--accent); color: #fff; border-color: var(--accent); }
.farrow { color: var(--text-faint); }
.cols { display: grid; grid-template-columns: minmax(0,0.92fr) minmax(0,1.08fr); gap: 18px; align-items: start; }
.iwrap .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow); padding: 18px; }
.iwrap .panel h3 { margin: 0 0 13px; font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 8px; letter-spacing: -0.01em; }
.iwrap .panel h3 .badge { margin-left: auto; font-size: 11px; font-weight: 700; color: var(--text-faint); background: var(--surface-2); padding: 2px 9px; border-radius: 999px; }
.photos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.photo { aspect-ratio: 1; border-radius: 12px; position: relative; overflow: hidden; display: grid; place-items: center; background: var(--surface-2); border: 1px solid var(--border); }
.photo img { width: 100%; height: 100%; object-fit: cover; }
.photo span { position: absolute; bottom: 7px; left: 8px; font-size: 10.5px; font-weight: 700; color: var(--text-muted); background: var(--surface); padding: 2px 7px; border-radius: 6px; border: 1px solid var(--border); }
.req { margin-top: 14px; background: var(--surface-2); border-radius: 12px; padding: 13px 14px; font-size: 13.5px; line-height: 1.6; color: var(--text); }
.req .lbl { font-size: 11px; font-weight: 800; color: var(--text-faint); letter-spacing: 0.04em; margin-bottom: 5px; }
.line { display: grid; grid-template-columns: 1fr auto auto auto; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); }
.line .p b { font-weight: 800; font-size: 13.5px; }
.line .p small { display: block; color: var(--text-faint); font-size: 11.5px; margin-top: 1px; }
.qty { display: inline-flex; align-items: center; gap: 2px; border: 1px solid var(--border); border-radius: 9px; overflow: hidden; }
.qty button { width: 26px; height: 26px; border: none; background: var(--surface-2); color: var(--text-muted); font-size: 15px; cursor: pointer; }
.qty span { min-width: 26px; text-align: center; font-weight: 800; font-size: 13px; }
.line .pr { font-weight: 800; font-size: 13.5px; text-align: right; min-width: 74px; }
.line .del { border: none; background: transparent; color: var(--text-faint); font-size: 17px; cursor: pointer; padding: 0 2px; }
.line .del:hover { color: var(--red); }
.line-empty { padding: 18px 0; text-align: center; color: var(--text-faint); font-size: 13px; }
.addp { margin-top: 10px; width: 100%; border: 1px dashed var(--border-strong); background: transparent; color: var(--accent-text); font-weight: 800; font-size: 13px; padding: 10px; border-radius: 11px; cursor: pointer; }
.picker { margin-top: 8px; border: 1px solid var(--border); border-radius: 11px; overflow: hidden; }
.pick-cats { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.pick-chip { border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); font-weight: 700; font-size: 12.5px; padding: 6px 12px; border-radius: 999px; cursor: pointer; }
.pick-chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.pick-body { max-height: 300px; overflow: auto; }
.pick-group { position: sticky; top: 0; background: var(--surface-2); font-size: 11px; font-weight: 800; color: var(--text-faint); padding: 6px 12px; border-bottom: 1px solid var(--border); }
.pick-item { display: flex; justify-content: space-between; gap: 10px; width: 100%; border: none; background: var(--surface); padding: 10px 12px; border-bottom: 1px solid var(--border); cursor: pointer; font-size: 13px; text-align: left; color: var(--text); }
.pick-item:hover { background: var(--accent-soft); }
.pick-item small { color: var(--text-faint); }

/* 견적서 미리보기 모달 */
.doc-overlay { position: fixed; inset: 0; background: rgba(16,24,40,.55); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 24px; }
.doc-modal { background: var(--surface); border-radius: 16px; width: 96vw; height: 94vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px -20px rgba(0,0,0,.5); }
.doc-bar { display: flex; align-items: center; gap: 12px; padding: 13px 16px; border-bottom: 1px solid var(--border); }
.doc-bar b { font-size: 14px; font-weight: 800; }
.doc-actions { margin-left: auto; display: flex; gap: 8px; }
.btn2 { border: 1px solid var(--border); background: var(--surface-2); color: var(--text-muted); font-weight: 800; font-size: 12.5px; padding: 8px 13px; border-radius: 9px; cursor: pointer; }
.btn2:hover { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-text); }
.btn2.x { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn2:disabled { opacity: .55; cursor: default; }
.doc-frame { flex: 1; width: 100%; border: none; background: #fffaf1; min-height: 420px; }
.doc-hint { padding: 9px 16px; font-size: 11.5px; color: var(--text-faint); border-top: 1px solid var(--border); }
.doc-hint b { color: var(--text-muted); }
.sums { margin-top: 14px; display: flex; flex-direction: column; gap: 7px; font-size: 13px; }
.sums .row { display: flex; justify-content: space-between; color: var(--text-muted); }
.sums .row .num { color: var(--text); font-weight: 700; }
.sums .row.total { border-top: 1px solid var(--border); margin-top: 6px; padding-top: 11px; font-size: 16px; font-weight: 800; color: var(--text); }
.sums .row.total b { color: var(--accent-text); }
.sched { margin-top: 16px; }
.sched h3 .cal-nav { margin-left: auto; display: inline-flex; align-items: center; gap: 10px; }
.sched h3 .cal-nav button { width: 26px; height: 26px; border: 1px solid var(--border); background: var(--surface); border-radius: 8px; cursor: pointer; color: var(--text-muted); font-size: 15px; }
.sched h3 .cal-nav b { font-size: 13px; font-weight: 800; color: var(--text); min-width: 84px; text-align: center; }
.cal { display: grid; grid-template-columns: repeat(7,1fr); gap: 5px; margin-top: 10px; }
.cal .dow { text-align: center; font-size: 10.5px; color: var(--text-faint); font-weight: 700; padding-bottom: 2px; }
.cell { aspect-ratio: 1; border-radius: 9px; border: 1px solid var(--border); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; cursor: pointer; gap: 1px; background: var(--surface-2); color: var(--text); }
.cell.mut { opacity: .5; cursor: default; background: transparent; border-color: transparent; }
.cell.full { background: var(--surface-3); color: var(--text-faint); cursor: not-allowed; }
.cell .av { font-size: 8.5px; font-weight: 800; color: var(--green); }
.cell.full .av { color: var(--text-faint); }
.cell.sel { background: var(--accent); color: #fff; border-color: var(--accent); }
.cell.sel .av { color: #dfe8ff; }
.slotpick { display: flex; gap: 8px; margin-top: 11px; }
.slotbtn { flex: 1; padding: 10px; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-2); font-weight: 800; font-size: 13px; cursor: pointer; color: var(--text-muted); }
.slotbtn.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-text); }
.slotbtn:disabled { opacity: .45; cursor: default; }
.synced { margin-top: 11px; font-size: 12px; color: var(--green); display: flex; align-items: center; gap: 6px; font-weight: 700; background: var(--green-soft); padding: 9px 12px; border-radius: 10px; line-height: 1.4; }
.synced.muted { color: var(--text-muted); background: var(--surface-2); }
.actions { display: flex; gap: 9px; margin-top: 16px; flex-wrap: wrap; }
.iwrap .btn { border: none; font-weight: 800; font-size: 14px; padding: 13px 18px; border-radius: 12px; cursor: pointer; }
.btn-pri { background: var(--accent); color: #fff; flex: 1; min-width: 150px; }
.btn-pri:disabled { opacity: .6; }
.btn-ghost { background: var(--surface-2); color: var(--text-muted); border: 1px solid var(--border); }
.iw-msg { margin-top: 10px; font-size: 12.5px; color: var(--accent-text); background: var(--accent-soft); padding: 9px 12px; border-radius: 10px; }
.reqbox { margin-top: 12px; border: 1px solid var(--border); border-radius: 12px; padding: 13px; background: var(--surface-2); }
.reqbox-t { font-size: 12.5px; color: var(--text-muted); margin-bottom: 8px; }
.reqbox-t b { color: var(--text); }
.reqbox textarea { width: 100%; min-height: 70px; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; font-size: 13.5px; font-family: inherit; resize: vertical; outline: none; }
.reqbox textarea:focus { border-color: var(--accent); }
.reqbox-a { display: flex; gap: 8px; margin-top: 9px; }
.reqbox-a .btn { padding: 10px 15px; font-size: 13px; }
.versions { margin-top: 14px; font-size: 12.5px; }
.versions .vr { display: flex; align-items: center; gap: 9px; padding: 7px 0; color: var(--text-muted); }
.versions .vr .vt { background: var(--surface-3); color: var(--text-muted); font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 6px; }
.versions .vr.cur .vt { background: var(--accent); color: #fff; }
@media (max-width: 1080px) { .cols { grid-template-columns: 1fr; } }
`;
