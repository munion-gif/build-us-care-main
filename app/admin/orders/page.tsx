import Link from "next/link";
import { formatChannel, formatKRDate, formatKRW, formatOrderStatus, formatServiceName } from "@/lib/format";
import { measure } from "@/lib/perf";
import { maskAddress, maskName, maskPhone } from "@/lib/pii";
import { getServiceFilterCodes } from "@/lib/service-catalog";
import { getAllServiceItems } from "@/lib/service-items";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { OPERATIONAL_ORDER_STATUSES } from "@/lib/types";
import { CancellationActions } from "./cancellation-actions-client";
import { OrderAssignmentButton } from "./order-assignment-client";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

const statuses = ["", ...OPERATIONAL_ORDER_STATUSES];
const channels = ["", "kakao", "web", "phone", "store", "instagram"];
const workflowFilters = [
  { key: "all", label: "전체", href: "/admin/orders" },
  { key: "intake", label: "신규", href: "/admin/orders?flow=intake" },
  { key: "quote", label: "견적/결제", href: "/admin/orders?flow=quote" },
  { key: "paid", label: "결제완료", href: "/admin/orders?flow=paid" },
  { key: "visit", label: "방문 예정", href: "/admin/orders?flow=visit" },
  { key: "complete", label: "완료", href: "/admin/orders?flow=complete" },
  { key: "issue", label: "취소/A/S", href: "/admin/orders?flow=issue" }
] as const;
const quickFilters = [
  { label: "오늘 접수", href: `/admin/orders?date_from=${new Date().toISOString().slice(0, 10)}&flow=intake` },
  { label: "결제완료 미배정", href: "/admin/orders?flow=paid" },
  { label: "방문 예정", href: "/admin/orders?flow=visit" },
  { label: "취소/A/S", href: "/admin/orders?flow=issue" }
] as const;

function badgeClass(status?: string | null) {
  if (status === "paid" || status === "quoted" || status === "payment_pending") return "adm-badge-blue";
  if (status === "scheduled") return "adm-badge-sky";
  if (status === "in_progress" || status === "cancel_requested") return "adm-badge-orange";
  if (status === "done" || status === "completed") return "adm-badge-green";
  if (status === "issue" || status === "warranty") return "adm-badge-red";
  return "adm-badge-gray";
}

async function getOrders(params: Record<string, string | undefined>) {
  if (!hasSupabaseEnv()) return { orders: [], count: 0, page: 1, limit: 20 };
  const page = Math.max(Number(params.page ?? 1), 1);
  const limit = 20;
  const from = (page - 1) * limit;
  let query = getSupabaseAdmin()
    .from("orders")
    .select(
      `
      id, order_number, status, total_amount, created_at, channel, service_type_code, skus,
      customers(name,phone,acquisition_source),
      homes(address_full),
      reservations(id,reserved_date,time_slot,status,created_at),
      payments(id,status,amount,paid_at,approved_at),
      jobs(id,technician_id,assigned_technician_name,scheduled_at,status,technicians(id,name)),
      cancellations(id,status,refund_amount,refund_rate,reason,requested_at)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  if (params.flow && !params.status) {
    if (params.flow === "intake") query = query.in("status", ["inquiry", "submitted"]);
    if (params.flow === "quote") query = query.in("status", ["quoted", "payment_pending"]);
    if (params.flow === "paid") query = query.eq("status", "paid");
    if (params.flow === "visit") query = query.in("status", ["scheduled", "in_progress"]);
    if (params.flow === "complete") query = query.in("status", ["completed", "done"]);
    if (params.flow === "issue") query = query.in("status", ["cancel_requested", "issue", "warranty"]);
  }
  if (params.status) query = query.eq("status", params.status);
  if (params.service_code) {
    const serviceCodes = getServiceFilterCodes(params.service_code);
    query = serviceCodes.length > 1 ? query.in("service_type_code", serviceCodes) : query.eq("service_type_code", params.service_code);
  }
  if (params.channel) query = query.eq("channel", params.channel);
  if (params.date_from) query = query.gte("created_at", params.date_from);
  if (params.date_to) query = query.lte("created_at", params.date_to);
  if (params.search) query = query.ilike("order_number", `%${params.search}%`);

  const { data, count } = await query;
  return { orders: data ?? [], count: count ?? 0, page, limit };
}

async function getActiveTechnicians() {
  if (!hasSupabaseEnv()) return [];
  const { data } = await getSupabaseAdmin()
    .from("technicians")
    .select("id,name,region,is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return data ?? [];
}

function firstServiceCode(order: any) {
  const sku = Array.isArray(order?.skus) ? order.skus[0] : null;
  return sku?.service_type_code ?? sku?.sku ?? order?.service_type_code;
}

function activeWorkflowKey(status?: string, flow?: string) {
  if (flow) return flow;
  if (!status) return "all";
  if (status === "inquiry") return "intake";
  if (status === "quoted" || status === "payment_pending") return "quote";
  if (status === "paid") return "paid";
  if (status === "scheduled" || status === "in_progress") return "visit";
  if (status === "completed" || status === "done") return "complete";
  if (status === "cancel_requested" || status === "canceled" || status === "warranty" || status === "issue") return "issue";
  return "all";
}

function activeReservation(order: any) {
  const reservations = Array.isArray(order.reservations) ? order.reservations : [];
  return reservations
    .filter((item: any) => item.status !== "cancelled")
    .sort((a: any, b: any) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
}

function slotLabel(slot?: string | null) {
  if (slot === "morning") return "오전";
  if (slot === "afternoon") return "오후";
  if (slot === "all_day") return "종일";
  return "시간 미정";
}

function paymentState(order: any) {
  const payments = Array.isArray(order.payments) ? order.payments : [];
  if (payments.some((payment: any) => payment.status === "done") || order.status === "paid") return { label: "결제완료", className: "adm-badge-blue" };
  if (order.status === "payment_pending" || order.status === "quoted") return { label: "결제대기", className: "adm-badge-orange" };
  return { label: "미결제", className: "adm-badge-gray" };
}

function assignedTechnician(order: any) {
  const jobs = Array.isArray(order.jobs) ? order.jobs : [];
  const job = jobs.find((item: any) => item.technicians?.name || item.assigned_technician_name || item.technician_id);
  return job?.technicians?.name ?? job?.assigned_technician_name ?? "미배정";
}

function addressPreview(order: any) {
  const address = order.homes?.address_full;
  if (!address) return "주소 상세에서 확인";
  return maskAddress(address, 3);
}

function nextActionLabel(order: any) {
  const status = String(order.status ?? "");
  if (status === "paid") return assignedTechnician(order) === "미배정" ? "기사 배정" : "방문 전 확인";
  if (status === "quoted" || status === "payment_pending") return "결제 확인";
  if (status === "scheduled") return "방문 준비";
  if (status === "in_progress") return "완료 처리";
  if (status === "completed") return "검수 완료";
  if (status === "cancel_requested") return "취소 처리";
  if (status === "issue" || status === "warranty") return "이슈 확인";
  return "접수 확인";
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [{ orders, count, page, limit }, services, technicians] = await Promise.all([
    measure("admin.orders.fetchOrders", () => getOrders(params)),
    measure("admin.orders.fetchServices", () => getAllServiceItems()),
    measure("admin.orders.fetchTechnicians", () => getActiveTechnicians())
  ]);
  const totalPages = Math.max(Math.ceil(count / limit), 1);
  const visibleSummary = {
    needsAssign: orders.filter((order: any) => order.status === "paid" && assignedTechnician(order) === "미배정").length,
    visits: orders.filter((order: any) => ["scheduled", "in_progress"].includes(String(order.status))).length,
    issues: orders.filter((order: any) => ["cancel_requested", "issue", "warranty"].includes(String(order.status))).length
  };

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">주문 관리</h1>
        <p className="adm-page-sub">접수, 결제, 배정, 방문 순서로 처리합니다. 주소와 집 정보는 상세에서 확인합니다.</p>
      </header>
      <div className="adm-content">
        <nav className="adm-workflow-tabs" aria-label="주문 처리 단계">
          {workflowFilters.map((item) => (
            <Link className={activeWorkflowKey(params.status, params.flow) === item.key ? "active" : ""} href={item.href} key={item.key}>
              {item.label}
            </Link>
          ))}
        </nav>
        <nav className="adm-quick-filter-row" aria-label="빠른 주문 필터">
          {quickFilters.map((item) => (
            <Link className="adm-quick-filter" href={item.href} key={item.label}>
              {item.label}
            </Link>
          ))}
        </nav>
        <form className="adm-filter-bar">
          <select className="adm-filter-select" name="status" defaultValue={params.status ?? ""}>
            <option value="">전체 상태</option>
            {statuses.filter(Boolean).map((status) => <option key={status} value={status}>{formatOrderStatus(status)}</option>)}
          </select>
          <select className="adm-filter-select" name="service_code" defaultValue={params.service_code ?? ""}>
            <option value="">전체 서비스</option>
            {services.map((service) => <option key={service.service_type_code} value={service.service_type_code}>{service.display_name}</option>)}
          </select>
          <select className="adm-filter-select" name="channel" defaultValue={params.channel ?? ""}>
            <option value="">전체 채널</option>
            {channels.filter(Boolean).map((channel) => <option key={channel} value={channel}>{formatChannel(channel)}</option>)}
          </select>
          <input className="adm-filter-input" name="date_from" type="date" defaultValue={params.date_from ?? ""} />
          <input className="adm-filter-input" name="date_to" type="date" defaultValue={params.date_to ?? ""} />
          <input className="adm-filter-input" name="search" placeholder="주문번호 검색" defaultValue={params.search ?? ""} />
          <button className="adm-btn adm-btn-primary">검색</button>
        </form>
        <section className="adm-queue-summary adm-section">
          <article><strong>{count}</strong><span>검색 결과</span></article>
          <article><strong>{visibleSummary.needsAssign}</strong><span>배정 필요</span></article>
          <article><strong>{visibleSummary.visits}</strong><span>방문/진행</span></article>
          <article><strong>{visibleSummary.issues}</strong><span>예외 처리</span></article>
        </section>
        <section className="adm-order-queue-list" aria-label="주문 처리 큐">
          {orders.length === 0 ? (
            <div className="adm-card adm-empty-line">조건에 맞는 주문이 없습니다.</div>
          ) : orders.map((order: any) => {
            const reservation = activeReservation(order);
            const payment = paymentState(order);
            const pendingCancellation = Array.isArray(order.cancellations) ? order.cancellations.find((item: any) => item.status === "pending") : null;
            return (
              <article className="adm-order-queue-card" key={order.id}>
                <div className="adm-order-queue-main">
                  <div className="adm-order-queue-title">
                    <Link className="adm-link" href={`/admin/orders/${order.id}`}>{order.order_number}</Link>
                    <span className={`adm-badge ${badgeClass(order.status)}`}>{formatOrderStatus(order.status)}</span>
                  </div>
                  <strong>{formatServiceName(firstServiceCode(order))}</strong>
                  <p>{maskName(order.customers?.name)} · {maskPhone(order.customers?.phone)} · {formatChannel(order.channel)} · {formatKRDate(order.created_at)}</p>
                  <p>{addressPreview(order)}</p>
                </div>
                <div className="adm-order-queue-meta">
                  <span><b>예약</b>{reservation ? `${reservation.reserved_date} ${slotLabel(reservation.time_slot)}` : "예약 없음"}</span>
                  <span><b>결제</b><em className={`adm-badge ${payment.className}`}>{payment.label}</em>{formatKRW(Number(order.total_amount ?? 0))}</span>
                  <span><b>담당</b>{assignedTechnician(order)}</span>
                </div>
                <div className="adm-order-queue-actions">
                  {pendingCancellation ? (
                    <CancellationActions cancellationId={pendingCancellation.id} refundAmount={Number(pendingCancellation.refund_amount ?? 0)} refundRate={Number(pendingCancellation.refund_rate ?? 0)} />
                  ) : (
                    <>
                      <Link className="adm-btn adm-btn-primary adm-btn-sm" href={`/admin/orders/${order.id}`}>{nextActionLabel(order)}</Link>
                      {order.status === "paid" && (
                        <OrderAssignmentButton compact orderId={order.id} orderNumber={order.order_number} orderStatus={order.status} reservations={Array.isArray(order.reservations) ? order.reservations : []} jobs={Array.isArray(order.jobs) ? order.jobs : []} technicians={technicians} />
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
        <nav className="adm-filter-bar" style={{ marginTop: 16 }}>
          {page > 1 && <Link className="adm-btn adm-btn-secondary" href={{ pathname: "/admin/orders", query: { ...params, page: String(page - 1) } }}>이전</Link>}
          <span className="adm-help" style={{ marginTop: 0 }}>페이지 {page} / {totalPages} · 총 {count}건</span>
          {page < totalPages && <Link className="adm-btn adm-btn-secondary" href={{ pathname: "/admin/orders", query: { ...params, page: String(page + 1) } }}>다음</Link>}
        </nav>
      </div>
    </>
  );
}
