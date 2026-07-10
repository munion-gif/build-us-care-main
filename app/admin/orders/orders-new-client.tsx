"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch, useToast, won, fmtDate } from "../_lib/ui";
import {
  AdminOrderRow,
  Stage,
  STAGE_META,
  orderJob,
  orderStage,
  stageLabel,
  orderItemsSummary,
  serviceLabel,
  shortRegion
} from "../_lib/orders-shared";

type Technician = { id: string; name: string; is_active?: boolean };

const TABS: Array<{ key: string; label: string }> = [
  { key: "todo", label: "처리 필요" },
  { key: "quote", label: "견적·결제 대기" },
  { key: "pay", label: "입금 대기" },
  { key: "assign", label: "배정 필요" },
  { key: "booked", label: "예약 확정" },
  { key: "done", label: "완료" },
  { key: "cancel", label: "취소·A/S" },
  { key: "all", label: "전체" },
  { key: "trash", label: "휴지통" }
];

function isTodo(order: AdminOrderRow): boolean {
  const stage = orderStage(order);
  if (stage === "pay" || stage === "assign") return true;
  if ((order.status ?? "") === "cancel_requested") return true;
  if (["inquiry", "draft", "submitted"].includes(order.status ?? "")) return true;
  return false;
}

function inTab(order: AdminOrderRow, tab: string): boolean {
  if (tab === "all") return true;
  if (tab === "todo") return isTodo(order);
  return orderStage(order) === (tab as Stage);
}

// 관리자가 직접 고르는 3단계 상태 (접수확인 → 기사배정완료 → 시공완료)
const SIMPLE_STATUS = [
  { key: "received", label: "접수확인", backend: "paid", cls: "s-new" },
  { key: "assigned", label: "기사배정완료", backend: "scheduled", cls: "s-booked" },
  { key: "done", label: "시공완료", backend: "done", cls: "s-done" }
] as const;

function simpleStatusKey(order: AdminOrderRow): "received" | "assigned" | "done" | "cancel" {
  const stage = orderStage(order);
  if (stage === "cancel") return "cancel";
  if (stage === "done") return "done";
  if (stage === "booked") return "assigned";
  return "received";
}

function nextActionHint(order: AdminOrderRow): string {
  const s = order.status ?? "";
  if (s === "cancel_requested") return "취소 승인/거절";
  const stage = orderStage(order);
  if (stage === "pay") return "입금 확인";
  if (stage === "assign") return "기사 배정";
  if (stage === "quote") return s === "quoted" ? "고객 결제 대기" : "견적 확인";
  if (stage === "booked") {
    const job = orderJob(order);
    if (job?.status === "assigned") return "예약 확정 알림톡";
    return "완료 처리";
  }
  return "할 일 없음";
}

export default function OrdersClient() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(params.get("tab") ?? "todo");
  const [query, setQuery] = useState("");
  const [selId, setSelId] = useState<string | null>(params.get("open"));
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDate, setAssignDate] = useState("");

  const [trashOrders, setTrashOrders] = useState<AdminOrderRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [o, t, tr] = await Promise.all([
      adminFetch<{ orders: AdminOrderRow[] }>("/api/admin/orders?limit=300"),
      adminFetch<{ technicians: Technician[] }>("/api/admin/technicians"),
      adminFetch<{ orders: AdminOrderRow[] }>("/api/admin/orders?trash=1&limit=100")
    ]);
    if (o.ok && o.data) setOrders((o.data.orders ?? []).filter((x) => !x.deleted_at && !x.is_test));
    if (t.ok && t.data) setTechnicians((t.data.technicians ?? []).filter((x) => x.is_active !== false));
    if (tr.ok && tr.data) setTrashOrders(tr.data.orders ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of TABS) map.set(t.key, 0);
    for (const o of orders) {
      for (const t of TABS) {
        if (t.key !== "trash" && inTab(o, t.key)) map.set(t.key, (map.get(t.key) ?? 0) + 1);
      }
    }
    map.set("trash", trashOrders.length);
    return map;
  }, [orders, trashOrders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (!inTab(o, tab)) return false;
      if (!q) return true;
      return [o.order_number, o.customers?.name, o.customers?.phone, o.homes?.address_full]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [orders, tab, query]);

  const sel = useMemo(() => orders.find((o) => o.id === selId) ?? null, [orders, selId]);

  function closeDrawer() {
    setSelId(null);
    setAssignOpen(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function act(fn: () => Promise<{ ok: boolean; message?: string }>, okMsg: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      toast(res.message ?? "처리에 실패했어요", "err");
      return false;
    }
    toast(okMsg);
    await load();
    return true;
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkTrash() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!window.confirm(`선택한 주문 ${ids.length}건을 휴지통으로 이동할까요?\n방문 일정이 있으면 홈페이지·관리자 달력에서 함께 빠져요.`)) return;
    setBusy(true);
    let done = 0;
    for (const id of ids) {
      const res = await adminFetch(`/api/admin/orders/${id}/trash`, {
        method: "POST",
        body: JSON.stringify({ reason: "관리자 일괄 삭제" })
      });
      if (res.ok) done += 1;
    }
    setBusy(false);
    setSelectedIds(new Set());
    toast(done === ids.length ? `${done}건을 휴지통으로 옮겼어요` : `${done}건 이동, ${ids.length - done}건 실패`, done === ids.length ? "info" : "err");
    await load();
  }

  async function changeSimpleStatus(o: AdminOrderRow, key: string) {
    const target = SIMPLE_STATUS.find((s) => s.key === key);
    if (!target) return;
    await act(
      () =>
        adminFetch(`/api/admin/orders/${o.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: target.backend, force: true })
        }),
      `상태를 "${target.label}"로 변경했어요`
    );
  }

  async function confirmPayment(o: AdminOrderRow) {
    await act(
      () => adminFetch(`/api/admin/orders/${o.id}/confirm-payment`, { method: "POST", body: "{}" }),
      "입금 확인 완료 — 고객에게 결제 완료 안내가 나갑니다"
    );
  }

  async function assignTechnician(o: AdminOrderRow, name: string) {
    const job = orderJob(o);
    if (!job?.id) {
      toast("이 주문에 연결된 작업이 없어요", "err");
      return;
    }
    const body: Record<string, string> = { assigned_technician_name: name };
    if (assignDate) body.scheduled_date = assignDate;
    const done = await act(
      () => adminFetch(`/api/admin/jobs/${job.id}/assign`, { method: "PATCH", body: JSON.stringify(body) }),
      `${name} 기사에게 배정했어요${assignDate ? ` · 방문일 ${assignDate}` : ""}`
    );
    if (done) setAssignOpen(false);
  }

  async function confirmReservation(o: AdminOrderRow) {
    await act(
      () => adminFetch(`/api/admin/orders/${o.id}/confirm-reservation`, { method: "POST", body: "{}" }),
      "예약을 확정하고 고객에게 알림톡을 보냈어요"
    );
  }

  async function completeJob(o: AdminOrderRow) {
    const job = orderJob(o);
    if (!job?.id) {
      toast("이 주문에 연결된 작업이 없어요", "err");
      return;
    }
    await act(
      () => adminFetch(`/api/admin/jobs/${job.id}/complete`, { method: "PATCH", body: "{}" }),
      "시공 완료로 처리했어요"
    );
  }

  async function decideCancellation(o: AdminOrderRow, approve: boolean) {
    const c = (o.cancellations ?? [])[0];
    if (!c?.id) {
      toast("취소 요청 정보를 찾지 못했어요", "err");
      return;
    }
    await act(
      () =>
        adminFetch(`/api/admin/cancellations/${c.id}/${approve ? "approve" : "reject"}`, {
          method: "POST",
          body: "{}"
        }),
      approve ? "취소를 승인했어요 — 환불 안내가 나갑니다" : "취소 요청을 거절했어요"
    );
  }

  async function sendQuoteAlimtalk(o: AdminOrderRow) {
    await act(
      () => adminFetch(`/api/admin/orders/${o.id}/quote-alimtalk`, { method: "POST", body: "{}" }),
      "견적 알림톡을 다시 보냈어요"
    );
  }

  function renderNextBox(o: AdminOrderRow) {
    const s = o.status ?? "";
    const stage = orderStage(o);
    const job = orderJob(o);

    if (s === "cancel_requested") {
      return (
        <div className="next-box">
          <div className="lbl">다음 할 일</div>
          <div className="what">고객이 취소를 요청했어요. 환불 승인 또는 거절을 선택하세요.</div>
          <button className="cta" disabled={busy} onClick={() => decideCancellation(o, true)}>
            취소 승인 · 환불
          </button>
          <button className="cta-sub" disabled={busy} onClick={() => decideCancellation(o, false)}>
            거절
          </button>
        </div>
      );
    }
    if (stage === "pay") {
      return (
        <div className="next-box">
          <div className="lbl">다음 할 일</div>
          <div className="what">고객이 계좌이체를 선택했어요. 입금이 확인되면 눌러주세요.</div>
          <button className="cta" disabled={busy} onClick={() => confirmPayment(o)}>
            입금 확인 처리
          </button>
        </div>
      );
    }
    if (stage === "assign") {
      return (
        <div className="next-box">
          <div className="lbl">다음 할 일</div>
          {assignOpen ? (
            <>
              <div className="what">누구에게 배정할까요?</div>
              <div className="qb-f" style={{ marginBottom: 9, maxWidth: 220 }}>
                <label>방문일 (선택)</label>
                <input type="date" value={assignDate} onChange={(e) => setAssignDate(e.target.value)} />
              </div>
              <div className="assign-pick">
                {(technicians.length > 0 ? technicians.map((t) => t.name) : []).map((name) => (
                  <button key={name} className="btn" disabled={busy} onClick={() => assignTechnician(o, name)}>
                    {name}
                  </button>
                ))}
                {technicians.length === 0 && <span className="next-hint">활성 기사가 없어요 — 설정에서 등록해주세요</span>}
              </div>
            </>
          ) : (
            <>
              <div className="what">결제가 끝났어요. 기사를 배정하고 방문일을 확정해 주세요.</div>
              <button className="cta" disabled={busy} onClick={() => setAssignOpen(true)}>
                기사 배정하기
              </button>
            </>
          )}
        </div>
      );
    }
    if (stage === "booked") {
      if (job?.status === "assigned") {
        return (
          <div className="next-box">
            <div className="lbl">다음 할 일</div>
            <div className="what">기사 배정이 끝났어요. 방문 일정을 확정하고 예약 확정 알림톡을 보내주세요.</div>
            <button className="cta" disabled={busy} onClick={() => confirmReservation(o)}>
              예약 확정 알림톡 보내기
            </button>
          </div>
        );
      }
      return (
        <div className="next-box">
          <div className="lbl">다음 할 일</div>
          <div className="what">방문 예약이 확정된 주문이에요. 시공이 끝나면 완료 처리해 주세요.</div>
          <button className="cta" disabled={busy} onClick={() => completeJob(o)}>
            시공 완료 처리
          </button>
        </div>
      );
    }
    if (s === "quoted") {
      return (
        <div className="next-box">
          <div className="lbl">다음 할 일</div>
          <div className="what">견적이 발송됐어요. 고객 결제를 기다리는 중입니다.</div>
          <button className="cta" disabled={busy} onClick={() => sendQuoteAlimtalk(o)}>
            견적 알림톡 재발송
          </button>
        </div>
      );
    }
    if (stage === "done") {
      return (
        <div className="next-box">
          <div className="lbl">상태</div>
          <div className="what">완료된 주문이에요. A/S 문의가 오면 여기서 확인해요.</div>
        </div>
      );
    }
    return (
      <div className="next-box">
        <div className="lbl">상태</div>
        <div className="what">{stageLabel(o)} 상태의 주문입니다.</div>
      </div>
    );
  }

  function timeline(o: AdminOrderRow) {
    const events: Array<[string, string]> = [];
    if (o.created_at) events.push(["주문 접수", fmtDate(o.created_at)]);
    const quote = (o.quotes ?? [])[0];
    if (quote?.created_at) events.push([`견적 v${quote.version ?? 1} 발행`, fmtDate(quote.created_at)]);
    for (const p of o.payments ?? []) {
      if (p.paid_at) events.push(["결제 완료", fmtDate(p.paid_at)]);
    }
    const job = orderJob(o);
    if (job?.technicians?.name) events.push([`${job.technicians.name} 기사 배정`, ""]);
    if (job?.scheduled_at) events.push(["방문 예약", fmtDate(job.scheduled_at)]);
    for (const c of o.cancellations ?? []) {
      if (c.created_at) events.push(["취소 요청", fmtDate(c.created_at)]);
    }
    if (["completed", "done", "installation_completed"].includes(o.status ?? "")) events.push(["시공 완료", ""]);
    return events;
  }

  const stage = sel ? orderStage(sel) : null;

  return (
    <>
      <h1>예약 주문</h1>
      <p className="h-sub">
        고객이 제품을 골라 예약한 주문입니다. 사진확인 문의는 <b>사진확인 문의</b> 메뉴에서 따로 관리해요.
      </p>

      <div className="tabs" role="tablist" aria-label="주문 상태 필터">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "on" : ""}
            onClick={() => {
              setTab(t.key);
              setSelectedIds(new Set());
            }}
          >
            {t.label} <span className="n">{counts.get(t.key) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="board">
        <div className="toolbar">
          <div className="search">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13.5 13.5 17 17" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름 · 연락처 · 주문번호 검색"
              aria-label="주문 검색"
            />
          </div>
          <span className="sp" />
          {selectedIds.size > 0 && tab !== "trash" && (
            <button className="btn danger" disabled={busy} onClick={bulkTrash}>
              선택 {selectedIds.size}건 삭제
            </button>
          )}
          <a className="btn" href="/api/admin/orders/export" target="_blank" rel="noreferrer">
            엑셀 내보내기
          </a>
        </div>
        <div className="tbl-wrap">
          {tab === "trash" ? (
            <table>
              <thead>
                <tr>
                  <th>상태</th>
                  <th>고객</th>
                  <th>품목</th>
                  <th className="r">금액</th>
                  <th>삭제일</th>
                  <th>처리</th>
                </tr>
              </thead>
              <tbody>
                {trashOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      휴지통이 비어 있어요
                    </td>
                  </tr>
                ) : (
                  trashOrders.map((o) => (
                    <tr key={o.id} style={{ cursor: "default" }}>
                      <td>
                        <span className="pill p-done">삭제됨</span>
                      </td>
                      <td>
                        <div className="cust">{o.customers?.name ?? "고객"}</div>
                        <div className="ord-no">{o.order_number ?? o.id.slice(0, 8)}</div>
                      </td>
                      <td className="item-l">{orderItemsSummary(o)}</td>
                      <td className="amt">{won(o.total_amount)}</td>
                      <td className="item-l">{o.deleted_at ? fmtDate(o.deleted_at) : "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn"
                            disabled={busy}
                            onClick={() =>
                              act(
                                () => adminFetch(`/api/admin/orders/${o.id}/trash`, { method: "PATCH" }),
                                "주문을 복원했어요 — 방문일이 있으면 달력 자리도 다시 차지해요"
                              )
                            }
                          >
                            복원
                          </button>
                          <button
                            className="btn danger"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm("완전히 삭제할까요? 되돌릴 수 없어요.")) return;
                              act(
                                () => adminFetch(`/api/admin/orders/${o.id}/trash`, { method: "DELETE" }),
                                "완전히 삭제했어요"
                              );
                            }}
                          >
                            완전 삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 34 }}>
                  <input
                    type="checkbox"
                    aria-label="전체 선택"
                    checked={visible.length > 0 && visible.every((o) => selectedIds.has(o.id))}
                    onChange={(e) => {
                      setSelectedIds(e.target.checked ? new Set(visible.map((o) => o.id)) : new Set());
                    }}
                  />
                </th>
                <th>상태</th>
                <th>고객</th>
                <th>품목</th>
                <th>유입</th>
                <th>지역</th>
                <th className="r">금액</th>
                <th>방문일</th>
                <th>다음 할 일</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="empty-cell">
                    불러오는 중…
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-cell">
                    해당하는 주문이 없어요
                  </td>
                </tr>
              ) : (
                visible.map((o) => {
                  const st = orderStage(o);
                  const job = orderJob(o);
                  const hint = nextActionHint(o);
                  return (
                    <tr key={o.id} className={o.id === selId ? "sel" : ""} onClick={() => setSelId(o.id)}>
                      <td onClick={(e) => e.stopPropagation()} style={{ cursor: "default" }}>
                        <input
                          type="checkbox"
                          aria-label="주문 선택"
                          checked={selectedIds.has(o.id)}
                          onChange={() => toggleSelect(o.id)}
                        />
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ cursor: "default" }}>
                        {simpleStatusKey(o) === "cancel" ? (
                          <span className={`pill ${STAGE_META[st].pill}`}>{stageLabel(o)}</span>
                        ) : (
                          <select
                            className={`pill-select ${SIMPLE_STATUS.find((s) => s.key === simpleStatusKey(o))?.cls ?? "s-new"}`}
                            value={simpleStatusKey(o)}
                            disabled={busy}
                            aria-label="주문 상태 변경"
                            onChange={(e) => changeSimpleStatus(o, e.target.value)}
                          >
                            {SIMPLE_STATUS.map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        <div className="cust">{o.customers?.name ?? "고객"}</div>
                        <div className="ord-no">{o.order_number ?? o.id.slice(0, 8)}</div>
                      </td>
                      <td className="item-l">{orderItemsSummary(o)}</td>
                      <td>
                        <span className="pill p-done" style={{ fontSize: 11 }}>
                          {o.channel === "web" ? "직접 예약" : "사진 문의"}
                        </span>
                      </td>
                      <td className="item-l">{shortRegion(o.homes?.address_full)}</td>
                      <td className="amt">{won(o.total_amount)}</td>
                      <td className="item-l">{job?.scheduled_at ? fmtDate(job.scheduled_at).split(" ")[0] : "미정"}</td>
                      <td>
                        {hint !== "할 일 없음" ? (
                          <span className="next-hint">
                            <b>{hint}</b>
                          </span>
                        ) : (
                          <span className="next-hint">할 일 없음</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>

      <div className={`scrim ${sel ? "on" : ""}`} onClick={closeDrawer} />
      <aside className={`drawer ${sel ? "on" : ""}`} aria-label="주문 상세">
        {sel && (
          <>
            <div className="d-head">
              <div>
                <div className="no">
                  {sel.order_number ?? sel.id} · {fmtDate(sel.created_at)} 접수
                </div>
                <div className="nm">
                  {sel.customers?.name ?? "고객"} · {orderItemsSummary(sel)}
                </div>
              </div>
              <button className="x" aria-label="닫기" onClick={closeDrawer}>
                ×
              </button>
            </div>
            <div className="d-body">
              {renderNextBox(sel)}

              <div className="sect">
                <div className="s-t">고객 정보</div>
                <div className="kv">
                  <span className="k">연락처</span>
                  <span className="v">
                    <a href={`tel:${sel.customers?.phone ?? ""}`}>{sel.customers?.phone ?? "—"}</a>
                  </span>
                  <span className="k">주소</span>
                  <span className="v">{sel.homes?.address_full ?? "—"}</span>
                  <span className="k">유입</span>
                  <span className="v">{sel.channel === "web" ? "홈페이지 직접 예약" : "사진확인 문의에서 전환"}</span>
                  <span className="k">방문일</span>
                  <span className="v">{orderJob(sel)?.scheduled_at ? fmtDate(orderJob(sel)!.scheduled_at!) : "미정"}</span>
                  {orderJob(sel)?.technicians?.name ? (
                    <>
                      <span className="k">담당 기사</span>
                      <span className="v">{orderJob(sel)!.technicians!.name}</span>
                    </>
                  ) : null}
                  <span className="k">결제</span>
                  <span className="v">
                    {stage === "pay" ? "계좌이체 · 입금 대기" : (sel.payments ?? []).length > 0 ? "결제 완료" : "결제 전"}
                  </span>
                </div>
              </div>

              <div className="sect">
                <div className="s-t">주문 내역</div>
                <div className="lineitems">
                  {(sel.skus ?? []).map((it, i) => {
                    const p = it?.metadata?.selected_replacement_product;
                    const nm = [p?.brand, p?.model ?? p?.name].filter(Boolean).join(" ") || serviceLabel(it.service_type_code ?? it.sku);
                    return (
                      <div className="li" key={i}>
                        <span>
                          {nm} {Number(it.qty ?? 1) > 1 ? `×${it.qty}` : ""}
                        </span>
                        <span className="muted">{serviceLabel(it.metadata?.service_type_code ?? it.service_type_code)}</span>
                      </div>
                    );
                  })}
                  <div className="li total">
                    <span>최종 금액</span>
                    <span className="p">{won(sel.total_amount)}</span>
                  </div>
                </div>
              </div>

              <div className="sect">
                <div className="s-t">진행 기록</div>
                <ul className="tl">
                  {timeline(sel).map(([ev, when], i, arr) => (
                    <li key={`${ev}-${i}`} className={i === arr.length - 1 ? "now" : ""}>
                      <span className="ev">{ev}</span>
                      {when ? <span className="when">{when}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="sect">
                <div className="s-t">기타</div>
                <div className="minor-actions">
                  {(sel.quotes ?? []).length > 0 && (
                    <button className="btn" disabled={busy} onClick={() => sendQuoteAlimtalk(sel)}>
                      견적 알림톡 재발송
                    </button>
                  )}
                  <button
                    className="btn danger"
                    disabled={busy}
                    onClick={async () => {
                      if (!window.confirm("이 주문을 휴지통으로 이동할까요?")) return;
                      await act(
                        () =>
                          adminFetch(`/api/admin/orders/${sel.id}/trash`, {
                            method: "POST",
                            body: JSON.stringify({ reason: "관리자 삭제" })
                          }),
                        "주문을 휴지통으로 옮겼어요"
                      );
                      closeDrawer();
                    }}
                  >
                    주문 삭제
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
