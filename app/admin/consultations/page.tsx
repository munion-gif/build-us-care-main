import Link from "next/link";
import type { ReactNode } from "react";
import { formatChannel, formatKRDateTime, formatOrderStatus, formatServiceName } from "@/lib/format";
import { maskAddress, maskName, maskPhone } from "@/lib/pii";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

function asArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function asOne(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function kstDateText(offsetDays = 0) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kstNow.setUTCDate(kstNow.getUTCDate() + offsetDays);
  const year = kstNow.getUTCFullYear();
  const month = String(kstNow.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kstNow.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function slotLabel(slot?: string | null) {
  if (slot === "morning") return "오전";
  if (slot === "afternoon") return "오후";
  if (slot === "all_day") return "종일";
  return "시간 미정";
}

function firstServiceCode(order: any) {
  const sku = Array.isArray(order?.skus) ? order.skus[0] : null;
  return sku?.service_type_code ?? sku?.sku ?? order?.service_type_code;
}

function activeReservation(order: any) {
  return asArray(order?.reservations)
    .filter((reservation) => reservation.status !== "cancelled")
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
}

function hasActiveAssignedJob(order: any) {
  return asArray(order?.jobs).some((job) => {
    if (["completed", "done", "canceled"].includes(String(job.status))) return false;
    return Boolean(job.technician_id || job.assigned_technician_name);
  });
}

function badgeClass(status?: string | null) {
  if (status === "paid" || status === "product_paid" || status === "quoted" || status === "payment_pending" || status === "pending_product_payment") return "adm-badge-blue";
  if (status === "scheduled" || status === "confirmed") return "adm-badge-sky";
  if (status === "in_progress" || status === "pending" || status === "cancel_requested") return "adm-badge-orange";
  if (status === "done" || status === "completed") return "adm-badge-green";
  if (status === "issue" || status === "warranty" || status === "failed") return "adm-badge-red";
  return "adm-badge-gray";
}

function diagnosisLabel(result?: string | null) {
  const labels: Record<string, string> = {
    replace_recommended: "교체추천",
    replacement_recommended: "교체추천",
    no_replacement_needed: "교체불필요",
    not_needed: "교체불필요",
    hold: "보류",
    site_check_required: "현장확인필요"
  };
  return labels[result ?? ""] ?? result ?? "판정 대기";
}

function diagnosisBadgeClass(result?: string | null) {
  const label = diagnosisLabel(result);
  if (label === "교체추천") return "adm-badge-orange";
  if (label === "현장확인필요") return "adm-badge-red";
  if (label === "보류") return "adm-badge-sky";
  if (label === "교체불필요") return "adm-badge-green";
  return "adm-badge-gray";
}

function customerLine(order: any) {
  return `${maskName(order?.customers?.name)} · ${maskPhone(order?.customers?.phone)} · ${formatChannel(order?.channel)}`;
}

function addressLine(order: any) {
  const address = order?.homes?.address_full;
  return address ? maskAddress(address, 3) : "주소 미확인";
}

function reservationText(order: any) {
  const reservation = activeReservation(order);
  return reservation ? `${reservation.reserved_date} ${slotLabel(reservation.time_slot)}` : "예약 미확정";
}

async function getConsultationData() {
  const today = kstDateText(0);
  const tomorrow = kstDateText(1);
  const fallback = {
    today,
    tomorrow,
    paidNeedsReview: [],
    upcomingReservations: [],
    pendingDiagnoses: [],
    counts: {
      paidNeedsReview: 0,
      upcomingReservations: 0,
      pendingDiagnoses: 0,
      unassignedPaid: 0
    }
  };

  if (!hasSupabaseEnv()) return fallback;

  const supabase: SupabaseAdmin = getSupabaseAdmin();

  const [paidOrders, reservations, diagnoses] = await Promise.all([
    supabase
      .from("orders")
      .select(
        `
        id, order_number, status, total_amount, channel, service_type_code, skus, created_at,
        customers(name,phone),
        homes(address_full),
        reservations(id,reserved_date,time_slot,status,created_at),
        jobs(id,status,technician_id,assigned_technician_name,scheduled_at,created_at),
        payments(id,status,amount,paid_at,approved_at)
      `
      )
      .eq("is_test", false)
      .is("deleted_at", null)
      .in("status", ["paid", "product_paid"])
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("reservations")
      .select(
        `
        id, reserved_date, time_slot, status, created_at,
        orders(
          id, order_number, status, total_amount, channel, service_type_code, skus, created_at, is_test,
          customers(name,phone),
          homes(address_full),
          jobs(id,status,technician_id,assigned_technician_name,scheduled_at,created_at)
        )
      `
      )
      .gte("reserved_date", today)
      .in("status", ["pending", "confirmed"])
      .order("reserved_date", { ascending: true })
      .order("time_slot", { ascending: true })
      .limit(40),
    supabase
      .from("diagnoses")
      .select(
        `
        id, order_id, service_type_code, service_code, suggested_service_code, result, created_at,
        customer_name, customer_phone, raw_response,
        orders(id,order_number,status,channel,service_type_code,skus,customers(name,phone),homes(address_full))
      `
      )
      .eq("is_test", false)
      .or("result.is.null,result.in.(hold,site_check_required,replace_recommended,replacement_recommended,보류,현장확인필요,교체추천)")
      .order("created_at", { ascending: false })
      .limit(30)
  ]);

  const paidRows = paidOrders.data ?? [];
  const paidNeedsReview = paidRows
    .filter((order: any) => !hasActiveAssignedJob(order))
    .slice(0, 12);
  const upcomingReservations = (reservations.data ?? []).filter((reservation: any) => asOne(reservation.orders)?.is_test !== true).slice(0, 16);
  const pendingDiagnoses = diagnoses.data ?? [];

  return {
    today,
    tomorrow,
    paidNeedsReview,
    upcomingReservations,
    pendingDiagnoses: pendingDiagnoses.slice(0, 12),
    counts: {
      paidNeedsReview: paidRows.length,
      upcomingReservations: reservations.data?.length ?? 0,
      pendingDiagnoses: pendingDiagnoses.length,
      unassignedPaid: paidNeedsReview.length
    }
  };
}

function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="adm-muted adm-empty-line">{children}</p>;
}

function OrderActionRow({ order, meta, action = "상세 확인" }: { order: any; meta?: ReactNode; action?: string }) {
  return (
    <Link className="adm-action-row" href={`/admin/orders/${order.id}`}>
      <span>
        <strong>{order.order_number ?? "주문번호 없음"} · {formatServiceName(firstServiceCode(order))}</strong>
        <small>{customerLine(order)}</small>
        <small>{addressLine(order)}</small>
      </span>
      <span>
        {meta}
        <b className={`adm-badge ${badgeClass(order.status)}`}>{formatOrderStatus(order.status)}</b>
        <small>{action}</small>
      </span>
    </Link>
  );
}

export default async function AdminConsultationsPage() {
  const data = await getConsultationData();

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">상담/예약 관리</h1>
        <p className="adm-page-sub">카톡 상담 전에 확인해야 할 사진접수, 결제완료 주문, 오늘·내일 예약을 한 화면에서 봅니다.</p>
      </header>
      <div className="adm-content">
        <section className="adm-queue-summary adm-section">
          <article>
            <strong>{data.counts.pendingDiagnoses}</strong>
            <span>상담 대기 사진접수</span>
          </article>
          <article>
            <strong>{data.counts.unassignedPaid}</strong>
            <span>결제완료 확인 필요</span>
          </article>
          <article>
            <strong>{data.counts.upcomingReservations}</strong>
            <span>예정 예약</span>
          </article>
          <article>
            <strong>{data.today}</strong>
            <span>오늘 기준</span>
          </article>
        </section>

        <section className="adm-dashboard-grid adm-section">
          <div className="adm-stack">
            <article className="adm-card">
              <div className="adm-section-head">
                <div>
                  <h2 className="adm-card-title">상담 대기</h2>
                  <p className="adm-muted adm-section-note">사진확인 접수 후 카톡 상담에서 확인할 대상입니다.</p>
                </div>
                <Link className="adm-link" href="/admin/diagnoses">사진확인 전체</Link>
              </div>
              {data.pendingDiagnoses.length === 0 ? (
                <EmptyRow>상담 대기 사진접수가 없습니다.</EmptyRow>
              ) : (
                <div className="adm-action-list">
                  {data.pendingDiagnoses.map((diagnosis: any) => {
                    const order = asOne(diagnosis.orders);
                    const serviceCode = diagnosis.service_type_code ?? diagnosis.service_code ?? diagnosis.suggested_service_code ?? firstServiceCode(order);
                    const customerName = diagnosis.customer_name ?? diagnosis.raw_response?.customer?.name ?? order?.customers?.name;
                    const customerPhone = diagnosis.customer_phone ?? diagnosis.raw_response?.customer?.phone ?? order?.customers?.phone;
                    const orderNumber = order?.order_number ?? diagnosis.raw_response?.receipt_number ?? diagnosis.raw_response?.order_number ?? diagnosis.id.slice(0, 8);
                    return (
                      <Link className="adm-action-row" href={`/admin/diagnoses?id=${diagnosis.id}`} key={diagnosis.id}>
                        <span>
                          <strong>{orderNumber} · {formatServiceName(serviceCode)}</strong>
                          <small>{maskName(customerName)} · {maskPhone(customerPhone)} · {formatKRDateTime(diagnosis.created_at)}</small>
                        </span>
                        <span>
                          <b className={`adm-badge ${diagnosisBadgeClass(diagnosis.result)}`}>{diagnosisLabel(diagnosis.result)}</b>
                          <small>상담 내용 확인</small>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </article>

            <article className="adm-card">
              <div className="adm-section-head">
                <div>
                  <h2 className="adm-card-title">제품값 결제 완료 · 예약/배정 확인</h2>
                  <p className="adm-muted adm-section-note">고객에게 카톡 안내를 보내고 기사 배정 또는 일정 확인이 필요한 주문입니다.</p>
                </div>
                <Link className="adm-link" href="/admin/orders?flow=paid">결제완료 전체</Link>
              </div>
              {data.paidNeedsReview.length === 0 ? (
                <EmptyRow>확인할 결제완료 주문이 없습니다.</EmptyRow>
              ) : (
                <div className="adm-action-list">
                  {data.paidNeedsReview.map((order: any) => (
                    <OrderActionRow
                      key={order.id}
                      order={order}
                      action={hasActiveAssignedJob(order) ? "방문 준비" : "예약/기사 확인"}
                      meta={<small>{reservationText(order)}</small>}
                    />
                  ))}
                </div>
              )}
            </article>
          </div>

          <article className="adm-card">
            <div className="adm-section-head">
              <div>
                <h2 className="adm-card-title">예약 확인</h2>
                <p className="adm-muted adm-section-note">오늘 이후 예약입니다. 시간대와 상태를 확인하고 상세에서 일정 수정/확정합니다.</p>
              </div>
              <Link className="adm-link" href="/admin/slots">슬롯 관리</Link>
            </div>
            {data.upcomingReservations.length === 0 ? (
              <EmptyRow>예정된 예약이 없습니다.</EmptyRow>
            ) : (
              <div className="adm-action-list">
                {data.upcomingReservations.map((reservation: any) => {
                  const order = asOne(reservation.orders);
                  if (!order?.id) {
                    return (
                      <div className="adm-action-row" key={reservation.id}>
                        <span>
                          <strong>{reservation.reserved_date} {slotLabel(reservation.time_slot)}</strong>
                          <small>연결된 주문을 찾지 못했습니다.</small>
                        </span>
                        <span><b className={`adm-badge ${badgeClass(reservation.status)}`}>{reservation.status}</b></span>
                      </div>
                    );
                  }
                  return (
                    <OrderActionRow
                      key={reservation.id}
                      order={order}
                      action={hasActiveAssignedJob(order) ? "상세 확인" : "기사 배정 필요"}
                      meta={<small>{reservation.reserved_date} {slotLabel(reservation.time_slot)}</small>}
                    />
                  );
                })}
              </div>
            )}
          </article>
        </section>

        <section className="adm-card adm-section">
          <div className="adm-section-head">
            <div>
              <h2 className="adm-card-title">운영 동선</h2>
              <p className="adm-muted adm-section-note">상담원이 매일 반복해서 보면 되는 순서입니다.</p>
            </div>
          </div>
          <div className="adm-workflow-strip">
            <Link className="adm-workflow-card" href="/admin/diagnoses">
              <span className="adm-workflow-step">1</span>
              <strong>사진접수 확인</strong>
              <b>{data.counts.pendingDiagnoses}</b>
              <small>카톡 상담 전 사진·연락처 확인</small>
            </Link>
            <Link className="adm-workflow-card" href="/admin/orders?flow=paid">
              <span className="adm-workflow-step">2</span>
              <strong>결제완료 주문</strong>
              <b>{data.counts.unassignedPaid}</b>
              <small>고객 안내, 예약·기사 확인</small>
            </Link>
            <Link className="adm-workflow-card" href="/admin/slots">
              <span className="adm-workflow-step">3</span>
              <strong>예약 슬롯</strong>
              <b>{data.counts.upcomingReservations}</b>
              <small>예약 가능일과 중복 여부 확인</small>
            </Link>
            <Link className="adm-workflow-card" href="/admin/orders?flow=issue">
              <span className="adm-workflow-step">4</span>
              <strong>취소/A/S</strong>
              <b>확인</b>
              <small>예외 건은 주문 관리에서 처리</small>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
