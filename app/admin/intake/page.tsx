import Link from "next/link";
import { getIntakeList, getIntakeDetail } from "@/lib/admin-intake-data";
import { IntakeWork, type QuoteLine, type VersionRow } from "./intake-work-client";
import { isProductSelectionService } from "@/lib/replacement-products";
import {
  buildAdminQuoteCatalogs,
  firstServiceCode,
  getQuoteOrderById,
  initialQuoteItems,
  orderScheduleDate,
  orderScheduleTime
} from "../quotes/quote-page-data";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ id?: string }> };

const TONE_CLASS: Record<string, string> = {
  new: "t-new",
  sent: "t-sent",
  talk: "t-talk",
  done: "t-done"
};

function shortTime(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function computeStage(order: any): number {
  const status = String(order?.status ?? "");
  if (["scheduled", "in_progress", "completed", "done"].includes(status)) return 4;
  if (["quoted", "payment_pending", "pending_product_payment", "paid", "product_paid"].includes(status)) return 3;
  const quotes = Array.isArray(order?.quotes) ? order.quotes : [];
  return quotes.length ? 3 : 2;
}

export default async function AdminIntakePage({ searchParams }: PageProps) {
  const { id } = await searchParams;
  const { items, hasDb } = await getIntakeList();
  const selectedId = id ?? items[0]?.id ?? null;
  const detail = selectedId ? await getIntakeDetail(selectedId) : null;

  // 견적 편집 데이터 구성 (검증된 헬퍼 재사용 — 가격은 저장 시 서버가 계산)
  const catalog = buildAdminQuoteCatalogs() as any;
  let initialItemsData: QuoteLine[] = [];
  let scheduleDate: string | null = null;
  let scheduleTime: "morning" | "afternoon" | "" = "";
  let versions: VersionRow[] = [];
  let stage = 2;

  if (hasDb && detail?.orderId) {
    const order = (await getQuoteOrderById(detail.orderId)) as any;
    if (order) {
      const svc = isProductSelectionService(firstServiceCode(order)) ? String(firstServiceCode(order)) : "toilet_replace";
      initialItemsData = (initialQuoteItems(order, svc) as any[]).map((x) => ({
        serviceCode: x.serviceTypeCode,
        productId: x.productId,
        qty: x.qty
      }));
      scheduleDate = orderScheduleDate(order);
      scheduleTime = (orderScheduleTime(order) as any) || "";
      stage = computeStage(order);
      const qs = (Array.isArray(order.quotes) ? order.quotes : []).slice().sort((a: any, b: any) => Number(a.version ?? 0) - Number(b.version ?? 0));
      versions = qs.map((q: any, i: number) => ({
        version: Number(q.version ?? i + 1),
        at: shortTime(q.created_at),
        current: i === qs.length - 1
      }));
    }
  } else if (!hasDb && detail) {
    // 로컬 미리보기: 카탈로그 앞 제품 2개로 채워 화면 확인
    const flat: QuoteLine[] = [];
    for (const svc of catalog) for (const g of svc.groups) for (const p of g.products) flat.push({ serviceCode: svc.serviceCode, productId: p.id, qty: 1 });
    initialItemsData = flat.slice(0, 2);
    versions = [
      { version: 1, at: "7/9 10:40", note: "발송 · 세면대만" },
      { version: 2, at: "", note: "상담 후 수전 추가", current: true }
    ];
  }

  return (
    <div className="intake-page">
      <style>{pageCss}</style>

      {items.length === 0 ? (
        <div className="ip-empty">아직 사진접수 내역이 없어요.</div>
      ) : (
        <div className="ip-split">
          {/* 접수 목록 */}
          <aside className="ip-queue">
            <div className="ip-queue-h">
              <h2>사진접수 <span className="cnt num">{items.length}</span></h2>
              <p>고객이 보낸 사진을 보고 견적을 보내요</p>
            </div>
            <div className="ip-queue-list">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/admin/intake?id=${encodeURIComponent(item.id)}`}
                  className={`qitem ${item.id === selectedId ? "sel" : ""}`}
                >
                  <div className="top">
                    <span className="nm">{item.name ?? "이름 미입력"}</span>
                    <span className={`qtag ${TONE_CLASS[item.status.tone]}`}>{item.status.text}</span>
                  </div>
                  <div className="desc">{item.item} · 사진 {item.photoCount}장</div>
                  <div className="t num">{shortTime(item.createdAt)}</div>
                </Link>
              ))}
            </div>
          </aside>

          {/* 작업 화면 */}
          <main className="ip-work">
            {!hasDb ? (
              <div className="ip-note">지금은 <b>미리보기(로컬)</b>라 샘플 데이터예요. 실제 접수는 builduscare.co.kr/admin/intake 에서 보여요.</div>
            ) : null}
            {detail ? (
              <IntakeWork
                orderId={hasDb ? detail.orderId : null}
                orderNumber={detail.orderNumber}
                customerName={detail.name}
                customerPhone={detail.phone}
                address={detail.address}
                createdAtText={shortTime(detail.createdAt)}
                channelText="카카오톡"
                photos={detail.photos}
                memo={detail.memo}
                catalog={catalog}
                initialItems={initialItemsData}
                initialScheduleDate={scheduleDate}
                initialScheduleTime={scheduleTime}
                stage={stage}
                versions={versions}
                localMode={!hasDb}
              />
            ) : (
              <div className="ip-placeholder">왼쪽에서 접수를 선택하세요.</div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

const pageCss = `
.intake-page { margin: -8px -4px 0; }
.ip-split { display: grid; grid-template-columns: 300px 1fr; min-height: calc(100vh - 60px); }
.ip-queue { background: #fff; border-right: 1px solid #e4e8ee; display: flex; flex-direction: column; }
.ip-queue-h { padding: 18px 18px 12px; border-bottom: 1px solid #e4e8ee; }
.ip-queue-h h2 { margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -0.02em; display: flex; align-items: center; gap: 8px; }
.ip-queue-h h2 .cnt { background: #cf3838; color: #fff; font-size: 11px; font-weight: 800; padding: 1px 8px; border-radius: 999px; }
.ip-queue-h p { margin: 5px 0 0; font-size: 12px; color: #8b95a6; }
.ip-queue-list { overflow-y: auto; flex: 1; }
.qitem { display: block; padding: 13px 18px; border-bottom: 1px solid #eef1f5; cursor: pointer; border-left: 3px solid transparent; text-decoration: none; color: inherit; }
.qitem:hover { background: #f5f7fa; }
.qitem.sel { background: #eaf0ff; border-left-color: #245fff; }
.qitem .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.qitem .nm { font-weight: 800; font-size: 14.5px; color: #0f1729; }
.qitem .desc { font-size: 12.5px; color: #5b6472; margin-top: 4px; }
.qitem .t { font-size: 11px; color: #8b95a6; margin-top: 4px; font-variant-numeric: tabular-nums; }
.qtag { font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 999px; white-space: nowrap; }
.qtag.t-new { background: #efecfb; color: #6d5bd0; }
.qtag.t-sent { background: #eaf0ff; color: #1a49cc; }
.qtag.t-talk { background: #fdf3e2; color: #b7791f; }
.qtag.t-done { background: #e6f6ec; color: #178a4c; }
.ip-work { padding: 22px clamp(16px,2.4vw,30px) 60px; overflow-y: auto; background: #eef1f6; }
.ip-note { background: #eef3ff; border: 1px solid #cddbff; color: #244a9c; border-radius: 12px; padding: 12px 16px; font-size: 13px; margin-bottom: 16px; }
.ip-empty, .ip-placeholder { background: #fff; border: 1px dashed #d3d9e2; border-radius: 15px; padding: 60px 20px; text-align: center; color: #8b95a6; font-size: 14px; margin: 20px; }
@media (max-width: 860px) {
  .ip-split { grid-template-columns: 1fr; }
  .ip-queue { border-right: none; border-bottom: 1px solid #e4e8ee; max-height: 240px; }
}
`;
