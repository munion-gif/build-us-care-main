import type { ReactNode } from "react";
import Link from "next/link";
import { getIntakeList, getIntakeDetail } from "@/lib/admin-intake-data";
import { OrderQuoteEditor } from "../orders/order-quote-editor-client";
import { IntakeConsult, type ConsultMessage } from "./intake-consult-client";
import { isProductSelectionService } from "@/lib/replacement-products";
import {
  buildAdminQuoteCatalogs,
  customerName as quoteCustomerName,
  customerPhone as quoteCustomerPhone,
  firstServiceCode,
  getQuoteOrderById,
  initialQuoteItems,
  latestQuote,
  orderScheduleDate,
  orderScheduleTime
} from "../quotes/quote-page-data";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ id?: string }> };

const TONE_CLASS: Record<string, string> = {
  new: "it-t-new",
  sent: "it-t-sent",
  talk: "it-t-talk",
  done: "it-t-done"
};

const SAMPLE_CHAT: Record<string, ConsultMessage[]> = {
  s2: [
    { who: "cust", text: "세면대만 바꾸면 되나요? 수전도 오래됐는데…" },
    { who: "me", text: "사진 보니 수전도 같이 바꾸시는 게 좋아요. 견적에 추가해서 다시 보내드릴게요 🙂" },
    { who: "cust", text: "네 그럼 그렇게 해주세요!" }
  ],
  s3: [{ who: "cust", text: "수전 높이가 높은 걸로 부탁드려요." }]
};

function maskPhone(phone?: string | null) {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  if (d.length < 8) return phone;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function shortTime(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export default async function AdminIntakePage({ searchParams }: PageProps) {
  const { id } = await searchParams;
  const { items, hasDb } = await getIntakeList();
  const selectedId = id ?? items[0]?.id ?? null;
  const detail = selectedId ? await getIntakeDetail(selectedId) : null;

  // 견적 편집기 임베드 — quotes 페이지와 동일한 방식으로 props 구성 (검증된 가격 로직 재사용)
  let quoteEditor: ReactNode = null;
  if (hasDb && detail?.orderId) {
    const selectedOrder = (await getQuoteOrderById(detail.orderId)) as any;
    if (selectedOrder) {
      const catalogs = buildAdminQuoteCatalogs();
      const svc = isProductSelectionService(firstServiceCode(selectedOrder))
        ? String(firstServiceCode(selectedOrder))
        : "toilet_replace";
      const currentQuote = latestQuote(selectedOrder);
      const home = Array.isArray(selectedOrder.homes) ? selectedOrder.homes[0] : selectedOrder.homes;
      quoteEditor = (
        <OrderQuoteEditor
          orderId={selectedOrder.id}
          orderNumber={selectedOrder.order_number ?? null}
          catalogs={catalogs as any}
          initialItems={initialQuoteItems(selectedOrder, svc) as any}
          initialVisitFee={Number((selectedOrder as any).visit_fee ?? (currentQuote as any)?.visit_fee ?? 0)}
          initialDiscount={Number(currentQuote?.discount ?? 0)}
          initialScheduleDate={orderScheduleDate(selectedOrder)}
          initialScheduleTime={orderScheduleTime(selectedOrder) as any}
          initialServiceCode={svc}
          currentQuoteVersion={currentQuote?.version ?? null}
          customerName={quoteCustomerName(selectedOrder)}
          customerPhone={quoteCustomerPhone(selectedOrder)}
          addressText={home?.address_full ?? null}
          editableCustomerFields
          localMode={false}
        />
      );
    }
  } else if (!hasDb && detail) {
    // 로컬/미리보기: 실제 주문이 없으므로 localMode 편집기(임시 저장)로 디자인 확인
    const catalogs = buildAdminQuoteCatalogs();
    quoteEditor = (
      <OrderQuoteEditor
        orderId={`local-${detail.id}`}
        orderNumber={detail.orderNumber ?? null}
        catalogs={catalogs as any}
        initialItems={[] as any}
        initialVisitFee={0}
        initialDiscount={0}
        initialScheduleDate={null}
        initialScheduleTime={null as any}
        initialServiceCode="toilet_replace"
        currentQuoteVersion={null}
        customerName={detail.name}
        customerPhone={detail.phone}
        addressText={detail.address}
        editableCustomerFields
        localMode
      />
    );
  }

  return (
    <div className="intake-wrap">
      <style>{intakeCss}</style>

      <header className="it-head">
        <div>
          <h1>사진접수</h1>
          <p>사진 보기 → 제품 추가/삭제로 견적 작성 → 카카오 상담 → 일정</p>
        </div>
        <div className="it-chip">새 접수 <b>{items.filter((i) => i.status.tone === "new").length}건</b></div>
      </header>

      {!hasDb ? (
        <div className="it-note it-preview">
          지금은 <b>미리보기(로컬)</b>라 샘플 데이터로 화면을 보여줘요. 실제 접수는 <b>builduscare.co.kr/admin/intake</b> 에서 보여요.
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="it-note">아직 사진접수 내역이 없어요.</div>
      ) : (
        <div className="it-split">
          {/* 왼쪽: 접수 목록 */}
          <aside className="it-queue">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/admin/intake?id=${encodeURIComponent(item.id)}`}
                className={`it-qi ${item.id === selectedId ? "sel" : ""}`}
              >
                <div className="it-qi-top">
                  <span className="it-qi-name">{item.name ?? "이름 미입력"}</span>
                  <span className={`it-tag ${TONE_CLASS[item.status.tone]}`}>{item.status.text}</span>
                </div>
                <div className="it-qi-desc">
                  {item.item} · 사진 {item.photoCount}장
                </div>
                <div className="it-qi-time">{shortTime(item.createdAt)}</div>
              </Link>
            ))}
          </aside>

          {/* 오른쪽: 작업 영역 */}
          <section className="it-work">
            {detail ? (
              <>
                <div className="it-panel">
                  <div className="it-panel-h">
                    <h3>고객 사진</h3>
                    <span className="it-meta">
                      {detail.name ?? "이름 미입력"} · {detail.address} · {maskPhone(detail.phone)}
                    </span>
                  </div>
                  {detail.photos.length > 0 ? (
                    <div className="it-photos">
                      {detail.photos.map((src, i) => (
                        <a key={i} className="it-photo" href={src} target="_blank" rel="noreferrer">
                          <img src={src} alt={`고객 사진 ${i + 1}`} loading="lazy" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="it-empty">첨부된 사진이 없어요.</div>
                  )}
                  {detail.memo ? <div className="it-memo"><span className="it-memo-l">고객 요청</span>{detail.memo}</div> : null}
                </div>

                {quoteEditor ? (
                  <div className="it-panel it-quote">
                    {quoteEditor}
                  </div>
                ) : detail.orderId ? (
                  <div className="it-note">
                    이 접수의 주문을 견적 목록에서 못 찾았어요.{" "}
                    <a href={`/admin/quotes?orderId=${encodeURIComponent(detail.orderId)}`}>기존 견적서 페이지에서 작성 →</a>
                  </div>
                ) : (
                  <div className="it-note">아직 주문이 연결되지 않은 접수예요. 기존 사진접수 화면에서 &lsquo;견적으로 전환&rsquo; 후 작성해주세요.</div>
                )}

                <IntakeConsult
                  intakeId={detail.id}
                  customerName={detail.name}
                  initialMessages={hasDb ? [] : SAMPLE_CHAT[detail.id] ?? []}
                  localMode={!hasDb}
                />
              </>
            ) : (
              <div className="it-placeholder">왼쪽에서 접수를 선택하세요.</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

const intakeCss = `
.intake-wrap { padding: 4px 2px 40px; color: #0f1729; }
.it-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.it-head h1 { font-size: 23px; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
.it-head p { color: #5b6472; font-size: 13.5px; margin: 5px 0 0; }
.it-soon { color: #98a2b3; }
.it-chip { background: #fff; border: 1px solid #e4e8ee; border-radius: 999px; padding: 9px 15px; font-size: 13px; font-weight: 700; }
.it-chip b { color: #1a49cc; }
.it-note { background: #fff7e8; border: 1px solid #ffe7b8; color: #7a5b16; border-radius: 12px; padding: 15px 18px; font-size: 13.5px; line-height: 1.6; }
.it-split { display: grid; grid-template-columns: 280px 1fr; gap: 16px; align-items: start; }
.it-queue { background: #fff; border: 1px solid #e4e8ee; border-radius: 15px; overflow: hidden; }
.it-qi { display: block; padding: 13px 16px; border-bottom: 1px solid #eef1f5; border-left: 3px solid transparent; text-decoration: none; color: inherit; }
.it-qi:hover { background: #f7f9fc; }
.it-qi.sel { background: #eaf0ff; border-left-color: #245fff; }
.it-qi-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.it-qi-name { font-weight: 800; font-size: 14.5px; }
.it-tag { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.it-t-new { background: #efecfb; color: #6d5bd0; }
.it-t-sent { background: #eaf0ff; color: #1a49cc; }
.it-t-talk { background: #fdf3e2; color: #b7791f; }
.it-t-done { background: #e6f6ec; color: #178a4c; }
.it-qi-desc { font-size: 12.5px; color: #5b6472; margin-top: 4px; }
.it-qi-time { font-size: 11px; color: #98a2b3; margin-top: 4px; font-variant-numeric: tabular-nums; }
.it-work { display: grid; gap: 14px; }
.it-panel { background: #fff; border: 1px solid #e4e8ee; border-radius: 15px; padding: 17px; }
.it-panel-h { display: flex; align-items: center; gap: 10px; margin-bottom: 13px; }
.it-panel-h h3 { margin: 0; font-size: 14px; font-weight: 800; }
.it-meta { margin-left: auto; font-size: 11.5px; color: #98a2b3; font-weight: 600; text-align: right; }
.it-photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.it-photo { display: block; aspect-ratio: 1; border-radius: 11px; overflow: hidden; border: 1px solid #e4e8ee; background: #f5f7fa; }
.it-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.it-empty { color: #98a2b3; font-size: 13px; padding: 18px 0; text-align: center; }
.it-memo { margin-top: 13px; background: #f5f7fa; border-radius: 11px; padding: 12px 14px; font-size: 13.5px; line-height: 1.6; }
.it-memo-l { display: block; font-size: 11px; font-weight: 800; color: #98a2b3; letter-spacing: 0.03em; margin-bottom: 4px; }
.it-rows { display: grid; gap: 1px; }
.it-row { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eef1f5; font-size: 13.5px; }
.it-row .k { flex: 0 0 82px; color: #5b6472; font-weight: 700; }
.it-row .v { color: #0f1729; font-weight: 600; }
.it-next { margin-top: 14px; background: #eaf0ff; color: #1a49cc; border-radius: 11px; padding: 12px 14px; font-size: 12.5px; line-height: 1.5; }
.it-placeholder { background: #fff; border: 1px dashed #d3d9e2; border-radius: 15px; padding: 60px 20px; text-align: center; color: #98a2b3; font-size: 14px; }
.it-preview { background: #eef3ff; border-color: #cddbff; color: #244a9c; }

/* 카카오 상담 패널 */
.it-consult .it-chat { display: flex; flex-direction: column; gap: 8px; background: #f5f7fa; border-radius: 12px; padding: 14px; min-height: 120px; max-height: 320px; overflow-y: auto; }
.it-chat-empty { color: #98a2b3; font-size: 13px; text-align: center; margin: auto; padding: 20px 0; }
.it-bubble { max-width: 78%; padding: 9px 13px; border-radius: 13px; font-size: 13.5px; line-height: 1.5; word-break: break-word; }
.it-bubble.cust { align-self: flex-start; background: #fff; border: 1px solid #e4e8ee; border-bottom-left-radius: 4px; }
.it-bubble.me { align-self: flex-end; background: #fee500; color: #3c2f00; border-bottom-right-radius: 4px; }
.it-composer { display: flex; gap: 8px; margin-top: 11px; }
.it-composer input { flex: 1; border: 1px solid #e4e8ee; border-radius: 10px; padding: 11px 13px; font-size: 13.5px; outline: none; }
.it-composer input:focus { border-color: #245fff; }
.it-composer button { background: #fee500; color: #3c2f00; border: none; border-radius: 10px; padding: 0 18px; font-weight: 800; font-size: 13.5px; cursor: pointer; white-space: nowrap; }
.it-composer button:disabled { opacity: 0.5; cursor: default; }
.it-consult-foot { margin-top: 10px; font-size: 12px; color: #98a2b3; line-height: 1.5; }
.it-consult-foot b { color: #5b6472; }
.it-consult-note { color: #b7791f; }
@media (max-width: 800px) {
  .it-split { grid-template-columns: 1fr; }
  .it-photos { grid-template-columns: repeat(3, 1fr); }
}

/* ===== 견적 편집기 재스타일 (사진접수 안에서만 — 목업처럼 간결하게. 가격 로직/DOM은 그대로) ===== */
.it-quote .adm-card.adm-quote-editor { border: none !important; background: transparent !important; padding: 0 !important; box-shadow: none !important; display: grid; gap: 14px; }
/* 장황한 설명 문구 숨김 */
.it-quote .adm-quote-editor > .adm-section-head .adm-muted,
.it-quote .adm-quote-builder-card .adm-muted,
.it-quote .adm-quote-lines-preview .adm-muted,
.it-quote .adm-quote-option-card .adm-muted,
.it-quote .adm-quote-schedule-card .adm-muted { display: none !important; }
/* 상단 헤더: 제목 + 배지만 */
.it-quote .adm-quote-editor > .adm-section-head { margin-bottom: 2px !important; }
.it-quote .adm-card-title { font-size: 15px !important; font-weight: 800 !important; color: #0f1729 !important; }
.it-quote .adm-badge { border-radius: 999px !important; font-weight: 800 !important; font-size: 11px !important; }
.it-quote .adm-badge-blue { background: #eaf0ff !important; color: #1a49cc !important; }

/* 입력/버튼 공통 */
.it-quote .adm-input, .it-quote select, .it-quote textarea { border: 1px solid #e4e8ee !important; border-radius: 10px !important; background: #fff !important; color: #0f1729 !important; }
.it-quote .adm-input:focus, .it-quote select:focus { border-color: #245fff !important; outline: none !important; }
.it-quote .adm-label { color: #5b6472 !important; font-weight: 700 !important; font-size: 12px !important; }
.it-quote .adm-btn { border-radius: 11px !important; font-weight: 800 !important; }
.it-quote .adm-btn-primary { background: #245fff !important; border-color: #245fff !important; color: #fff !important; }
.it-quote .adm-btn-secondary { background: #f5f7fa !important; border: 1px solid #e4e8ee !important; color: #5b6472 !important; }

/* 고객 정보(고객명/연락처/주소): 얇은 카드 */
.it-quote .adm-quote-order-meta span { min-height: 0 !important; border: 1px solid #eef1f5 !important; border-radius: 11px !important; padding: 9px 12px !important; }
.it-quote .adm-quote-order-meta b { font-size: 11px !important; color: #98a2b3 !important; }

/* 요약: 라벨↔금액 정렬된 한 줄씩 (목업 스타일) */
.it-quote .adm-quote-summary-strip { display: block !important; border: 1px solid #e4e8ee !important; border-radius: 13px !important; background: #f7f9fc !important; padding: 6px 15px !important; }
.it-quote .adm-quote-summary-strip span { min-height: 0 !important; display: flex !important; align-items: baseline !important; justify-content: space-between !important; gap: 10px; border: none !important; border-bottom: 1px solid #eaeef3 !important; border-radius: 0 !important; background: transparent !important; padding: 11px 0 !important; }
.it-quote .adm-quote-summary-strip span:last-child { border-bottom: none !important; }
.it-quote .adm-quote-summary-strip b { font-size: 13px !important; color: #5b6472 !important; font-weight: 700 !important; }
.it-quote .adm-quote-summary-strip strong { font-size: 14px !important; font-weight: 800 !important; color: #0f1729 !important; font-variant-numeric: tabular-nums; }
.it-quote .adm-quote-summary-strip small { display: none !important; }

/* 견적 입력 카드 */
.it-quote .adm-quote-builder-card { border: 1px solid #e4e8ee !important; border-radius: 13px !important; background: #fff !important; padding: 15px !important; }
.it-quote .adm-quote-item-meta { display: none !important; } /* 선택 미리보기 카드 숨김(클러터) */
.it-quote .adm-quote-qty-action .adm-btn { background: #245fff !important; border-color: #245fff !important; color: #fff !important; }

/* 견적 항목 표 */
.it-quote .adm-quote-lines-table { border: 1px solid #e4e8ee !important; border-radius: 13px !important; background: #fff !important; overflow: hidden; }
.it-quote .adm-quote-lines-head { background: #f7f9fc !important; }
.it-quote .adm-quote-line-name strong { font-weight: 800 !important; color: #0f1729 !important; }
.it-quote .adm-quote-line-amount { font-weight: 800 !important; color: #0f1729 !important; }

/* 폐기물/일정 카드 */
.it-quote .adm-quote-option-card, .it-quote .adm-quote-schedule-card { border: 1px solid #e4e8ee !important; border-radius: 13px !important; background: #fff !important; padding: 15px !important; }
.it-quote .adm-quote-calendar-day, .it-quote .adm-quote-calendar-blank { border-radius: 10px !important; }
.it-quote .adm-quote-calendar-day.selected { background: #245fff !important; border-color: #245fff !important; }
`;
