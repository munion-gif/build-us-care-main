"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QuoteDocModal } from "./quote-doc-modal";
import { ORDER_TRANSITIONS } from "@/lib/status";
import { formatOrderStatus } from "@/lib/format";
import type { OrderCard, OrdersOverview } from "@/lib/admin-orders-data";

export function OrdersClient({ overview }: { overview: OrdersOverview }) {
  const router = useRouter();
  const { pipe, todo, active, hasDb } = overview;
  const [sel, setSel] = useState<OrderCard | null>(null);
  const [docCard, setDocCard] = useState<OrderCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeMemo, setNoticeMemo] = useState("");
  const [noticeBusy, setNoticeBusy] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  async function changeStatus(target: string) {
    if (!sel) return;
    if (!hasDb) { flash("미리보기 모드 — 실제 변경은 프로덕션에서 됩니다."); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/orders/${sel.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: target }) });
      if (r.ok) { flash(`단계를 "${formatOrderStatus(target)}"(으)로 바꿨어요.`); setSel(null); router.refresh(); }
      else { const b = await r.json().catch(() => ({})); flash(b?.error?.message ?? "단계 변경에 실패했어요."); }
    } catch { flash("처리 중 오류가 생겼어요"); }
    finally { setBusy(false); }
  }

  async function sendNotice() {
    const m = noticeMemo.trim();
    if (!m || !sel) return;
    if (!hasDb) { flash("미리보기 모드 — 실제 발송은 프로덕션에서 됩니다."); return; }
    setNoticeBusy(true);
    try {
      const r = await fetch(`/api/admin/orders/${sel.id}/notice-alimtalk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memo: m }) });
      if (r.ok) { flash("주문 진행 안내를 카카오톡으로 보냈어요."); setNoticeOpen(false); setNoticeMemo(""); }
      else { const b = await r.json().catch(() => ({})); flash(`안내 발송 실패: ${b?.error?.message ?? `HTTP ${r.status}`}`); }
    } catch { flash("처리 중 오류가 생겼어요"); }
    finally { setNoticeBusy(false); }
  }

  function flash(m: string) {
    setToast(m);
    window.setTimeout(() => setToast((cur) => (cur === m ? null : cur)), 2200);
  }

  async function doAction(card: OrderCard) {
    if (card.buttonAction === "detail" || card.buttonAction === "cancel") {
      router.push(`/admin/orders/${card.id}`);
      return;
    }
    if (!hasDb) { flash("미리보기 모드 — 실제 처리는 프로덕션에서 됩니다."); return; }
    setBusy(true);
    const endpoint = card.buttonAction === "confirm-payment" ? "confirm-payment" : "confirm-reservation";
    try {
      const res = await fetch(`/api/admin/orders/${card.id}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (res.ok) {
        flash(card.buttonAction === "confirm-payment" ? "입금을 확인했어요" : "방문을 확정했어요");
        setSel(null);
        router.refresh();
      } else {
        const b = await res.json().catch(() => ({}));
        flash(b?.error?.message ?? "처리에 실패했어요");
      }
    } catch {
      flash("처리 중 오류가 생겼어요");
    } finally {
      setBusy(false);
    }
  }

  function Card({ c }: { c: OrderCard }) {
    return (
      <div className={`oc ${c.buttonAction !== "detail" ? "at" : ""}`} onClick={() => { setSel(c); setNoticeOpen(false); setNoticeMemo(""); setStatusOpen(false); }}>
        <div>
          <span className={`stg ${c.stage}`}><span className="d" />{c.stageText}</span>
          <div className="ono num">{c.orderNumber ?? "-"}</div>
        </div>
        <div className="mid">
          <div className="who">{c.name}</div>
          <div className="prod">{c.productSummary}</div>
          <div className="meta"><span className="amt num">{c.amountText}</span>{c.scheduleText ? <span>{c.scheduleText}</span> : null}<span>{c.address.split(" ").slice(0, 2).join(" ")}</span></div>
        </div>
        <div className="ac">
          <div className="nx">{c.nextAction || "상세 보기"}</div>
          <button className={`btn ${c.buttonTone}`} onClick={(e) => { e.stopPropagation(); doAction(c); }} disabled={busy}>{c.buttonLabel}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ord">
      <style>{ORD_CSS}</style>

      <div className="ph">
        <div><h1>예약·주문</h1><div className="sub">고객이 직접 예약한 주문 · 카드를 누르면 상세가 열려요</div></div>
        <div className="chip">지금 할 일 <b className="num">{todo.length}건</b></div>
      </div>

      {!hasDb ? <div className="ord-note">지금은 <b>미리보기(로컬)</b>라 샘플 데이터예요.</div> : null}

      <div className="pipe">
        <div className="ps"><div className="k"><span className="dot" style={{ background: "var(--accent)" }} />견적</div><div className="v num">{pipe.quote}<small>건</small></div></div>
        <div className="ps"><div className="k"><span className="dot" style={{ background: "var(--amber)" }} />입금 확인</div><div className="v num">{pipe.payment}<small>건</small></div></div>
        <div className="ps"><div className="k"><span className="dot" style={{ background: "var(--accent)" }} />방문 예정</div><div className="v num">{pipe.visit}<small>건</small></div></div>
        <div className="ps"><div className="k"><span className="dot" style={{ background: "var(--green)" }} />완료</div><div className="v num">{pipe.done}<small>건</small></div></div>
        <div className="ps"><div className="k"><span className="dot" style={{ background: "var(--red)" }} />취소·A/S</div><div className="v num">{pipe.issue}<small>건</small></div></div>
      </div>

      <div className="sh"><h2>지금 바로 할 일</h2><span className="c num">{todo.length}</span><span className="hint">카드 클릭 → 상세 · 버튼 → 처리</span></div>
      <div className="list">
        {todo.length ? todo.map((c) => <Card key={c.id} c={c} />) : <div className="empty">지금 처리할 주문이 없어요.</div>}
      </div>

      <div className="sh" style={{ marginTop: 24 }}><h2>진행 중</h2><span className="hint">방문 예정·진행 중</span></div>
      <div className="list">
        {active.length ? active.map((c) => <Card key={c.id} c={c} />) : <div className="empty">진행 중인 주문이 없어요.</div>}
      </div>

      <div style={{ marginTop: 20 }}>
        <Link href="/admin/orders/manage" className="manage-link">전체·상세 관리 (검색·필터·휴지통) →</Link>
      </div>

      {/* 상세 모달 */}
      {sel ? (
        <div className="backdrop" onClick={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
          <div className="modal">
            <button className="x" onClick={() => setSel(null)}>✕</button>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{sel.name}</div>
              <span className={`stg ${sel.stage}`}><span className="d" />{sel.stageText}</span>
            </div>
            <div className="num" style={{ color: "var(--text-faint)", fontSize: 12, fontWeight: 700, marginTop: 4 }}>{sel.orderNumber ?? "-"}</div>
            <div style={{ marginTop: 16 }}>
              <div className="mrow"><span className="k">제품</span><span className="v">{sel.productSummary}</span></div>
              <div className="mrow"><span className="k">금액</span><span className="v num">{sel.amountText}</span></div>
              <div className="mrow"><span className="k">연락처</span><span className="v num">{sel.phone || "-"}</span></div>
              <div className="mrow"><span className="k">주소</span><span className="v">{sel.address}</span></div>
              <div className="mrow" style={{ border: "none" }}><span className="k">결제·방문</span><span className="v">{sel.payText}</span></div>
            </div>
            {sel.photos.length ? (
              <>
                <div style={{ marginTop: 16, fontSize: 12, fontWeight: 800, color: "var(--text-muted)" }}>고객이 보낸 현장 사진 · {sel.photos.length}장</div>
                <div className="mphotos">
                  {sel.photos.map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noreferrer" className="mphoto"><img src={src} alt={`사진 ${i + 1}`} /></a>
                  ))}
                </div>
              </>
            ) : null}
            <div className="mactions">
              <button className={`btn ${sel.buttonTone}`} style={{ flex: 1, minWidth: 130 }} onClick={() => doAction(sel)} disabled={busy}>{sel.buttonLabel}</button>
              <button className="btn b-ghost" onClick={() => setDocCard(sel)}>👁 견적서 보기</button>
              <button className="btn b-ghost" onClick={() => setStatusOpen((v) => !v)}>🔀 단계 변경</button>
              <button className="btn b-ghost" onClick={() => setNoticeOpen((v) => !v)}>📢 주문 진행 안내</button>
              <Link className="btn b-ghost" href={`/admin/orders/${sel.id}`}>전체 관리 →</Link>
            </div>
            {statusOpen ? (
              <div className="statusbox">
                <div className="statusbox-t">현재 <b>{formatOrderStatus(sel.rawStatus)}</b> · 바꿀 단계를 누르세요</div>
                <div className="statusbox-btns">
                  {(((ORDER_TRANSITIONS as any)[sel.rawStatus] ?? []) as string[]).length ? (
                    (((ORDER_TRANSITIONS as any)[sel.rawStatus] ?? []) as string[]).map((t) => (
                      <button key={t} className={`stbtn ${t === "canceled" || t === "cancel_requested" ? "danger" : ""}`} onClick={() => changeStatus(t)} disabled={busy}>
                        {formatOrderStatus(t)}
                      </button>
                    ))
                  ) : (
                    <span className="statusbox-none">여기서 바꿀 수 있는 다음 단계가 없어요. (완료/취소 등) 자세한 변경은 “전체 관리”에서요.</span>
                  )}
                </div>
              </div>
            ) : null}
            {noticeOpen ? (
              <div className="noticebox">
                <div className="noticebox-t">고객에게 <b>주문 진행 상황</b>을 카카오톡으로 안내해요 (알림톡: 주문 진행 안내)</div>
                <textarea value={noticeMemo} onChange={(e) => setNoticeMemo(e.target.value)} placeholder="예: 제품이 입고되어 7/12 오전 방문 예정입니다. 변경 원하시면 회신 주세요." />
                <div className="noticebox-a">
                  <button className="btn b-pri" onClick={sendNotice} disabled={noticeBusy || !noticeMemo.trim()}>{noticeBusy ? "보내는 중…" : "카톡으로 안내 보내기"}</button>
                  <button className="btn b-ghost" onClick={() => setNoticeOpen(false)}>닫기</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {docCard ? <QuoteDocModal doc={docCard.doc} onClose={() => setDocCard(null)} /> : null}

      {toast ? <div className="ord-toast">{toast}</div> : null}
    </div>
  );
}

const ORD_CSS = `
.ord { --bg:#f5f5f7; --surface:#fff; --surface-2:#f2f4f7; --surface-3:#f2f4f7; --text:#101828; --text-muted:#667085; --text-faint:#98a2b3; --border:#e5e7eb; --accent:#245fff; --accent-soft:#eff4ff; --accent-text:#1647d7; --green:#178a4c; --green-soft:#e6f6ec; --amber:#b7791f; --amber-soft:#fdf3e2; --red:#cf3838; --red-soft:#fdeceb; --violet:#6d5bd0; --violet-soft:#efecfb; color:var(--text); padding: 26px clamp(16px, 2.4vw, 34px) 48px; }
.ord .num { font-variant-numeric: tabular-nums; }
.ord .ph { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.ord .ph h1 { font-size: 23px; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
.ord .ph .sub { color: var(--text-muted); font-size: 13.5px; margin-top: 5px; }
.ord .chip { background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 9px 15px; font-size: 13px; font-weight: 700; }
.ord .chip b { color: var(--accent-text); }
.ord-note { background: #eef3ff; border: 1px solid #cddbff; color: #244a9c; border-radius: 12px; padding: 12px 16px; font-size: 13px; margin-bottom: 16px; }
.pipe { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 22px; }
.ps { background: var(--surface); border: 1px solid var(--border); border-radius: 13px; padding: 13px 15px; }
.ps .k { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--text-muted); font-weight: 700; }
.ps .k .dot { width: 8px; height: 8px; border-radius: 999px; }
.ps .v { font-size: 22px; font-weight: 800; margin-top: 7px; }
.ps .v small { font-size: 12px; color: var(--text-faint); font-weight: 700; margin-left: 2px; }
.sh { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
.sh h2 { margin: 0; font-size: 15px; font-weight: 800; }
.sh .c { background: var(--accent); color: #fff; font-size: 11px; font-weight: 800; padding: 1px 8px; border-radius: 999px; }
.sh .hint { margin-left: auto; font-size: 12px; color: var(--text-faint); }
.list { display: flex; flex-direction: column; gap: 10px; }
.empty { background: var(--surface); border: 1px dashed #d0d5dd; border-radius: 13px; padding: 26px; text-align: center; color: var(--text-faint); font-size: 13px; }
.oc { display: grid; grid-template-columns: 150px 1fr auto; gap: 16px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 15px 17px; cursor: pointer; border-left: 3px solid transparent; }
.oc:hover { border-color: #d0d5dd; }
.oc.at { border-left-color: var(--accent); }
.oc .ono { color: var(--text-faint); font-size: 11.5px; font-weight: 700; margin-top: 8px; }
.oc .who { font-size: 15px; font-weight: 800; }
.oc .prod { font-size: 13px; color: var(--text-muted); margin-top: 3px; }
.oc .meta { display: flex; gap: 6px 12px; flex-wrap: wrap; margin-top: 7px; font-size: 12px; color: var(--text-faint); align-items: center; }
.oc .meta .amt { color: var(--text); font-weight: 800; font-size: 13px; }
.oc .ac { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.oc .nx { font-size: 12px; color: var(--text-muted); }
.stg { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
.stg .d { width: 7px; height: 7px; border-radius: 999px; background: currentColor; }
.stg.s-q { background: var(--accent-soft); color: var(--accent-text); }
.stg.s-p { background: var(--amber-soft); color: var(--amber); }
.stg.s-v { background: var(--accent-soft); color: var(--accent-text); }
.stg.s-d { background: var(--green-soft); color: var(--green); }
.stg.s-c { background: var(--red-soft); color: var(--red); }
.btn { border: none; font-weight: 800; font-size: 13px; padding: 10px 15px; border-radius: 10px; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
.btn:disabled { opacity: .6; }
.b-pri { background: var(--accent); color: #fff; }
.b-warn { background: var(--amber); color: #fff; }
.b-dan { background: var(--red-soft); color: var(--red); }
.b-ghost { background: var(--surface-2); color: var(--text-muted); border: 1px solid var(--border); }
.manage-link { color: var(--text-muted); font-size: 13px; font-weight: 700; text-decoration: none; }
.manage-link:hover { color: var(--accent-text); }
.backdrop { position: fixed; inset: 0; background: rgba(16,24,40,.5); z-index: 40; display: flex; align-items: center; justify-content: center; padding: 24px; }
.modal { background: var(--surface); border-radius: 18px; width: min(560px, 96vw); max-height: 92vh; overflow-y: auto; padding: 24px; position: relative; box-shadow: 0 20px 60px -20px rgba(0,0,0,.5); }
.modal .x { position: absolute; top: 16px; right: 16px; width: 30px; height: 30px; border-radius: 999px; border: none; background: var(--surface-2); color: var(--text-muted); cursor: pointer; font-size: 14px; }
.mrow { display: flex; justify-content: space-between; gap: 14px; padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.mrow .k { color: var(--text-muted); font-weight: 700; }
.mrow .v { font-weight: 700; text-align: right; }
.mphotos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
.mphoto { aspect-ratio: 1; border-radius: 11px; overflow: hidden; border: 1px solid var(--border); background: var(--surface-2); }
.mphoto img { width: 100%; height: 100%; object-fit: cover; }
.mactions { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
.noticebox { margin-top: 12px; border: 1px solid var(--border); border-radius: 12px; padding: 13px; background: var(--surface-2); }
.noticebox-t { font-size: 12.5px; color: var(--text-muted); margin-bottom: 8px; }
.noticebox-t b { color: var(--text); }
.noticebox textarea { width: 100%; min-height: 68px; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; font-size: 13.5px; font-family: inherit; resize: vertical; outline: none; box-sizing: border-box; }
.noticebox textarea:focus { border-color: var(--accent); }
.noticebox-a { display: flex; gap: 8px; margin-top: 9px; }
.statusbox { margin-top: 12px; border: 1px solid var(--border); border-radius: 12px; padding: 13px; background: var(--surface-2); }
.statusbox-t { font-size: 12.5px; color: var(--text-muted); margin-bottom: 9px; }
.statusbox-t b { color: var(--text); }
.statusbox-btns { display: flex; flex-wrap: wrap; gap: 8px; }
.stbtn { border: 1px solid var(--border); background: var(--surface); color: var(--accent-text); font-weight: 800; font-size: 13px; padding: 9px 14px; border-radius: 999px; cursor: pointer; }
.stbtn:hover { border-color: var(--accent); background: var(--accent-soft); }
.stbtn.danger { color: var(--red); }
.stbtn.danger:hover { border-color: var(--red); background: var(--red-soft); }
.stbtn:disabled { opacity: .5; cursor: default; }
.statusbox-none { font-size: 12.5px; color: var(--text-faint); }
.ord-toast { position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%); background: #101828; color: #fff; font-size: 13px; font-weight: 700; padding: 12px 20px; border-radius: 999px; z-index: 70; box-shadow: 0 10px 30px -10px rgba(0,0,0,.5); }
@media (max-width: 900px) { .pipe { grid-template-columns: repeat(2, 1fr); } .oc { grid-template-columns: 1fr; gap: 10px; } .oc .ac { align-items: flex-start; } }
`;
