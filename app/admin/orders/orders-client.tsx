"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QuoteDocModal } from "./quote-doc-modal";
import type { OrderCard, OrdersOverview } from "@/lib/admin-orders-data";

export function OrdersClient({ overview }: { overview: OrdersOverview }) {
  const router = useRouter();
  const { pipe, todo, active, hasDb } = overview;
  const [sel, setSel] = useState<OrderCard | null>(null);
  const [docCard, setDocCard] = useState<OrderCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
      <div className={`oc ${c.buttonAction !== "detail" ? "at" : ""}`} onClick={() => setSel(c)}>
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
              <Link className="btn b-ghost" href={`/admin/orders/${sel.id}`}>전체 관리 →</Link>
            </div>
          </div>
        </div>
      ) : null}

      {docCard ? <QuoteDocModal doc={docCard.doc} onClose={() => setDocCard(null)} /> : null}

      {toast ? <div className="ord-toast">{toast}</div> : null}
    </div>
  );
}

const ORD_CSS = `
.ord { --bg:#eef1f6; --surface:#fff; --surface-2:#f5f7fa; --surface-3:#eef2f7; --text:#0f1729; --text-muted:#5b6472; --text-faint:#8b95a6; --border:#e4e8ee; --accent:#245fff; --accent-soft:#eaf0ff; --accent-text:#1a49cc; --green:#178a4c; --green-soft:#e6f6ec; --amber:#b7791f; --amber-soft:#fdf3e2; --red:#cf3838; --red-soft:#fdeceb; --violet:#6d5bd0; --violet-soft:#efecfb; color:var(--text); }
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
.empty { background: var(--surface); border: 1px dashed #d3d9e2; border-radius: 13px; padding: 26px; text-align: center; color: var(--text-faint); font-size: 13px; }
.oc { display: grid; grid-template-columns: 150px 1fr auto; gap: 16px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 15px 17px; cursor: pointer; border-left: 3px solid transparent; }
.oc:hover { border-color: #d3d9e2; }
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
.ord-toast { position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%); background: #0f1729; color: #fff; font-size: 13px; font-weight: 700; padding: 12px 20px; border-radius: 999px; z-index: 70; box-shadow: 0 10px 30px -10px rgba(0,0,0,.5); }
@media (max-width: 900px) { .pipe { grid-template-columns: repeat(2, 1fr); } .oc { grid-template-columns: 1fr; gap: 10px; } .oc .ac { align-items: flex-start; } }
`;
