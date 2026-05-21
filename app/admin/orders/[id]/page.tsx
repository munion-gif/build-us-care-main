import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import {
  formatBuildingType,
  formatChannel,
  formatHousingType,
  formatKRDateTime,
  formatKRW,
  formatOrderStatus,
  formatServiceName
} from "@/lib/format";
import { OrderAssignmentButton, OrderScheduleConfirmButton } from "../order-assignment-client";
import { OrderEditPanel } from "../order-edit-panel-client";
import { OrderStatusTransitionPanel } from "../order-status-transition-panel-client";
import { getOrderStatusUx } from "@/lib/order-status-ux";
import { ORDER_PHOTO_VIEW_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function getOrder(id: string) {
  if (!hasSupabaseEnv()) return null;
  const { data } = await getSupabaseAdmin()
    .from("orders")
    .select("*, customers(*), homes(*), quotes(*), jobs(*, technicians(*)), reservations(*), media(*), payments(*), feedbacks(*), warranty_cases(*), notifications(*)")
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function getOrderDiagnoses(orderId: string) {
  if (!hasSupabaseEnv()) return [];
  const { data } = await getSupabaseAdmin()
    .from("diagnoses")
    .select("id,image_urls,photos,created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  return data ?? [];
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

function scoreDots(value?: number) {
  const score = Number(value ?? 0);
  return "●".repeat(Math.max(0, score)) + "○".repeat(Math.max(0, 5 - score));
}

function asArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function firstServiceCode(order: any) {
  const sku = Array.isArray(order?.skus) ? order.skus[0] : null;
  return sku?.service_type_code ?? sku?.sku ?? order?.service_type_code;
}

function paymentStatusLabel(status?: string | null) {
  if (status === "done") return "결제완료";
  if (status === "failed") return "결제실패";
  if (status === "pending") return "결제대기";
  return status ?? "-";
}

function activeReservation(order: any) {
  const reservations = asArray(order.reservations);
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

function latestPayment(order: any) {
  return asArray(order.payments).sort((a: any, b: any) => String(b.created_at ?? b.paid_at ?? "").localeCompare(String(a.created_at ?? a.paid_at ?? "")))[0];
}

function notificationRawError(notification: any) {
  return notification?.last_error ?? notification?.payload?.dispatch?.error ?? "";
}

function isNotificationSetupPending(notification: any) {
  const error = String(notificationRawError(notification));
  return (
    notification?.send_status === "prepared" ||
    notification?.channel === "mock" ||
    notification?.channel === "admin" ||
    /not configured|No dispatch channel|provider is not configured|credentials|sender phone/i.test(error)
  );
}

function notificationStatusLabel(notification: any) {
  const status = notification?.send_status;
  if (isNotificationSetupPending(notification)) return "발송준비";
  if (status === "prepared") return "발송준비";
  if (status === "sent") return "발송완료";
  if (status === "failed") return "실패";
  if (status === "queued" || status === "pending") return "대기";
  return status ?? "-";
}

function notificationBadgeClass(notification: any) {
  const status = notification?.send_status;
  if (isNotificationSetupPending(notification)) return "adm-badge-sky";
  if (status === "sent") return "adm-badge-green";
  if (status === "failed") return "adm-badge-red";
  if (status === "prepared") return "adm-badge-sky";
  return "adm-badge-orange";
}

function notificationChannelLabel(channel?: string | null) {
  if (channel === "mock") return "발송 준비";
  if (channel === "admin") return "관리자 알림";
  if (channel === "kakao") return "카카오";
  if (channel === "sms") return "문자";
  if (channel === "email") return "이메일";
  return channel ?? "-";
}

function notificationHelp(notification: any) {
  if (notification?.template_code === "reservation_confirmed" && notification?.send_status === "prepared") {
    return "예약 확정 안내 내용이 준비되었습니다. 카카오/SMS 연동 후 자동 발송 대상으로 전환할 수 있습니다.";
  }
  if (isNotificationSetupPending(notification)) {
    return "외부 발송 채널이 아직 연결되지 않아 실제 발송은 보류된 기록입니다.";
  }
  return notificationRawError(notification);
}

function notificationTitle(notification: any) {
  return `${notification.template_code ?? "알림"} · ${notificationChannelLabel(notification.channel)}`;
}

function notificationMetaSentence(notification: any) {
  const recipient = notification?.recipient ? `수신 ${notification.recipient}` : "수신 대상 미확인";
  const attempts = Number(notification?.attempts ?? 0);
  const sentAt = notification?.sent_at ? `${formatKRDateTime(notification.sent_at)}에 발송되었습니다` : "아직 실제 발송 전입니다";
  return `${recipient} 대상으로 ${attempts}회 처리됐고, ${sentAt}.`;
}

function assignedTechnician(order: any) {
  const job = asArray(order.jobs).find((item: any) => item.technicians?.name || item.assigned_technician_name || item.technician_id);
  return job?.technicians?.name ?? job?.assigned_technician_name ?? "미배정";
}

function activeAssignedJob(order: any) {
  return asArray(order.jobs)
    .filter((item: any) => item.status !== "cancelled" && (item.technicians?.name || item.assigned_technician_name || item.technician_id))
    .sort((a: any, b: any) => String(b.scheduled_at ?? b.created_at ?? "").localeCompare(String(a.scheduled_at ?? a.created_at ?? "")))[0] ?? null;
}

function isPhotoIntake(order: any) {
  return order?.source === "photo_diagnosis" || order?.reason === "photo_diagnosis" || asArray(order?.inquiry_photos).length > 0;
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

async function signPhotoInputs(inputs: string[]) {
  if (!hasSupabaseEnv()) return inputs.map((input) => ({ src: input, label: input }));
  const supabase = getSupabaseAdmin();
  return Promise.all(
    uniqueStrings(inputs).map(async (input) => {
      if (isUrl(input)) return { src: input, label: input };
      const { data } = await supabase.storage.from(ORDER_PHOTOS_BUCKET).createSignedUrl(input, ORDER_PHOTO_VIEW_EXPIRES_IN);
      return { src: data?.signedUrl ?? null, label: input };
    })
  );
}

function materialSummary(skus: any[]) {
  const first = skus[0] ?? {};
  const grade = first.product_grade === "premium" ? "고급 자재" : first.product_grade === "standard" ? "일반 자재" : "자재 미확인";
  const addons = Array.isArray(first.options) ? first.options.length : 0;
  return `${grade}${addons ? ` · 추가옵션 ${addons}개` : ""}`;
}

function currentAction(order: any) {
  const jobs = asArray(order.jobs);
  const quotes = asArray(order.quotes);
  const payments = asArray(order.payments);
  const hasAssignedJob = jobs.some((job: any) => Boolean(job.technician_id || job.assigned_technician_name));
  const hasAcceptedQuote = quotes.some((quote: any) => Boolean(quote.accepted_at));
  const hasDonePayment = payments.some((payment: any) => payment.status === "done");
  const status = String(order.status ?? "inquiry");

  if (status === "inquiry" || status === "submitted") {
    if (isPhotoIntake(order)) {
      return {
        title: "사진을 확인하고 상담으로 넘기기",
        summary: "사진, 고객 연락처, 예상 작업을 먼저 확인한 뒤 카톡 또는 전화로 주소와 견적 가능 여부를 정리합니다.",
        badge: "사진접수"
      };
    }
    return {
      title: "문의 내용을 확인하고 견적으로 넘기기",
      summary: "사진, 사유, 긴급도, 주소를 확인한 뒤 견적 완료 상태로 정리해야 합니다.",
      badge: "접수"
    };
  }
  if (status === "quoted" || status === "payment_pending") {
    return {
      title: hasAcceptedQuote ? "결제 진행 상태 확인" : "견적 수락 여부 확인",
      summary: "고객이 견적을 확인한 단계입니다. 결제 대기 또는 결제 완료 상태로 이어지는지 확인하세요.",
      badge: "견적"
    };
  }
  if (status === "paid" || hasDonePayment) {
    return {
      title: hasAssignedJob ? "예약 확정 필요" : "기사 배정 필요",
      summary: hasAssignedJob ? "기사는 배정되었습니다. 예약 날짜, 시간대, 담당 기사를 최종 확인한 뒤 예약 확정을 눌러 고객에게 방문 확정으로 안내하세요." : "결제 완료 주문입니다. 예약 시간에 맞춰 기사를 배정해야 합니다.",
      badge: "배정"
    };
  }
  if (status === "scheduled" || status === "in_progress") {
    return {
      title: "현장 진행 상태 확인",
      summary: "방문 일정, 현장 사진, 시작/완료 기록을 확인하고 다음 상태로 넘기세요.",
      badge: "방문"
    };
  }
  if (status === "completed") {
    return {
      title: "최종 완료 전 검수",
      summary: "작업 완료 후 사진, 자재, 이슈를 확인하고 최종 완료 처리해야 합니다.",
      badge: "검수"
    };
  }
  if (status === "done") {
    return {
      title: "후기와 A/S 가능 상태 확인",
      summary: "완료된 주문입니다. 후기와 보증/A/S 접수 여부를 확인하세요.",
      badge: "완료"
    };
  }
  if (status === "cancel_requested" || status === "issue" || status === "warranty") {
    return {
      title: "예외 처리 필요",
      summary: "취소, 환불, 이슈 또는 A/S 요청을 먼저 확인해야 합니다.",
      badge: "예외"
    };
  }
  return {
    title: getOrderStatusUx(status).adminLabel,
    summary: getOrderStatusUx(status).adminSummary,
    badge: "상태"
  };
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [order, technicians, diagnoses] = await Promise.all([getOrder(id), getActiveTechnicians(), getOrderDiagnoses(id)]);
  if (!order) return <div className="adm-empty"><div className="adm-empty-title">주문을 찾을 수 없어요.</div></div>;
  const quotes = asArray(order.quotes).sort((a: any, b: any) => Number(b.version ?? 0) - Number(a.version ?? 0));
  const media = asArray(order.media);
  const feedback = asArray(order.feedbacks)[0];
  const skus = Array.isArray(order.skus) ? order.skus : [];
  const action = currentAction(order);
  const reservation = activeReservation(order);
  const activeJob = activeAssignedJob(order);
  const payment = latestPayment(order);
  const photoInputs = [
    ...asArray(order.inquiry_photos),
    ...media.filter((m: any) => m.type === "inquiry").map((m: any) => m.file_path),
    ...diagnoses.flatMap((diagnosis: any) => {
      const imageUrls = Array.isArray(diagnosis.image_urls) ? diagnosis.image_urls : [];
      const photos = Array.isArray(diagnosis.photos) ? diagnosis.photos : [];
      return imageUrls.length ? imageUrls : photos;
    })
  ].filter((item): item is string => typeof item === "string" && item.length > 0);
  const customerPhotos = (await signPhotoInputs(photoInputs)).filter((photo) => photo.src);

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">{order.order_number}</h1>
        <p className="adm-page-sub"><span className="adm-badge adm-badge-sky">{formatOrderStatus(order.status)}</span> <span className="adm-badge adm-badge-green">{formatChannel(order.channel ?? "web")}</span></p>
      </header>
      <div className="adm-content adm-stack">
        <section className="adm-card adm-current-action">
          <span className="adm-badge adm-badge-blue">{action.badge}</span>
          <div>
            <h2>{action.title}</h2>
            <p>{action.summary}</p>
          </div>
        </section>

        <section className="adm-order-brief-grid">
          <article className="adm-card adm-brief-card">
            <span>고객</span>
            <strong>{order.customers?.name ?? "-"}</strong>
            <small>{order.customers?.phone ?? "-"}</small>
          </article>
          <article className="adm-card adm-brief-card">
            <span>예약</span>
            <strong>{reservation ? reservation.reserved_date : "예약 없음"}</strong>
            <small>{reservation ? slotLabel(reservation.time_slot) : "일정 확인 필요"}</small>
          </article>
          <article className="adm-card adm-brief-card">
            <span>결제</span>
            <strong>{paymentStatusLabel(payment?.status ?? (order.status === "paid" ? "done" : null))}</strong>
            <small>{formatKRW(Number(payment?.amount ?? order.total_amount ?? 0))}</small>
          </article>
          <article className="adm-card adm-brief-card">
            <span>담당</span>
            <strong>{assignedTechnician(order)}</strong>
            <small>{formatOrderStatus(asArray(order.jobs)[0]?.status ?? order.status)}</small>
          </article>
        </section>

        <section className="adm-detail-ops-grid">
          <div className="adm-stack">
            <OrderStatusTransitionPanel orderId={order.id} currentStatus={order.status as OrderStatus} />
            <article className="adm-card adm-quick-panel">
              <div>
                <h2 className="adm-card-title">빠른 처리</h2>
                <p className="adm-muted">유저 플로우 기준 다음 운영 작업만 먼저 처리합니다.</p>
              </div>
              <div className="adm-quick-actions">
                <OrderAssignmentButton
                  orderId={order.id}
                  orderNumber={order.order_number}
                  orderStatus={order.status}
                  reservations={asArray(order.reservations)}
                  jobs={asArray(order.jobs)}
                  technicians={technicians}
                />
                {String(order.status) !== "scheduled" && (
                  <OrderScheduleConfirmButton
                    orderId={order.id}
                    disabled={!activeJob || (!reservation && !activeJob?.scheduled_at)}
                    reason={!activeJob ? "예약 확정 전 담당 기사를 먼저 배정해주세요." : "예약 확정 전 예약 날짜와 시간대를 먼저 저장해주세요."}
                  />
                )}
              </div>
            </article>
          </div>
          <OrderEditPanel order={order} technicians={technicians} />
        </section>

        <section className="adm-detail-accordion">
          <details className="adm-card adm-details-card" open>
            <summary>고객/방문 정보</summary>
            <p>이름: {order.customers?.name ?? "-"}</p>
            <p>전화: {order.customers?.phone ?? "-"}</p>
            <p>유입: <span className="adm-badge adm-badge-blue">{order.customers?.acquisition_source ?? "-"}</span></p>
            <p>주소: {order.homes?.address_full ?? "-"}</p>
            <p>예약: {reservation ? `${reservation.reserved_date} ${slotLabel(reservation.time_slot)}` : "-"}</p>
          </details>
          <details className="adm-card adm-details-card">
            <summary>집 정보</summary>
            <p>주거: <span className="adm-badge adm-badge-gray">{formatHousingType(order.customers?.housing_type ?? order.homes?.housing_type)}</span></p>
            <p>건물: {formatBuildingType(order.homes?.building_type)} / {order.homes?.year_built ? `${order.homes.year_built}년 준공` : "-"}</p>
            <p>면적: {order.homes?.size_pyung ? `${order.homes.size_pyung}평` : "-"}</p>
            <p>층수: {order.homes?.floor ?? "-"}</p>
          </details>
        </section>

        <details className="adm-card adm-details-card" open>
          <summary>서비스/옵션</summary>
          {skus.length ? skus.map((item: any, index: number) => (
              <p key={`${item.sku ?? item.service_type ?? index}`}>{formatServiceName(item.service_type_code ?? item.sku ?? item.service_type ?? order.service_type_code)} × {item.qty ?? 1}</p>
          )) : <p>{formatServiceName(firstServiceCode(order))} × 1</p>}
          <p className="adm-muted">{materialSummary(skus)}</p>
          <p>요청사항: {order.special_requests ?? "-"}</p>
        </details>

        <details className="adm-card adm-details-card">
          <summary>견적</summary>
          {quotes.length ? quotes.map((q: any) => (
            <div key={q.id} className="adm-section">
              <strong>{q.version ? `${q.version}차 견적` : "견적"}</strong> · 총액 {formatKRW(Number(q.total_final ?? 0))} · {q.accepted_at ? "수락됨" : "미수락"}
            </div>
          )) : <div className="adm-empty"><div className="adm-empty-title">아직 견적이 없습니다.</div></div>}
        </details>

        <details className="adm-card adm-details-card">
          <summary>결제 정보</summary>
          {asArray(order.payments).length ? asArray(order.payments).map((payment: any) => (
            <div key={payment.id} className="adm-section">
              <p>상태: <span className="adm-badge adm-badge-blue">{paymentStatusLabel(payment.status)}</span></p>
              <p>금액: {formatKRW(Number(payment.amount ?? 0))}</p>
              <p>결제일: {formatKRDateTime(payment.paid_at ?? payment.approved_at)}</p>
              <p>토스 상태: {payment.provider_status ?? "-"}</p>
            </div>
          )) : <div className="adm-empty"><div className="adm-empty-title">아직 결제 정보가 없습니다.</div></div>}
        </details>

        <details className="adm-card adm-details-card" open>
          <summary>알림 발송</summary>
          {asArray(order.notifications).length ? (
            <div className="adm-notification-list">
              {asArray(order.notifications)
                .sort((a: any, b: any) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
                .slice(0, 8)
                .map((notification: any) => (
                  <article key={notification.id} className="adm-notification-card">
                    <div className="adm-notification-head">
                      <span className={`adm-badge ${notificationBadgeClass(notification)}`}>
                        {notificationStatusLabel(notification)}
                      </span>
                      <strong>{notificationTitle(notification)}</strong>
                    </div>
                    <p className="adm-notification-meta">{notificationMetaSentence(notification)}</p>
                    {notificationHelp(notification) && (
                      <p className={`adm-notification-note ${isNotificationSetupPending(notification) ? "" : "is-error"}`}>
                        {notificationHelp(notification)}
                      </p>
                    )}
                  </article>
                ))}
            </div>
          ) : <div className="adm-empty"><div className="adm-empty-title">아직 알림 이력이 없습니다.</div></div>}
        </details>

        <details className="adm-card adm-details-card">
          <summary>작업 기록</summary>
          {asArray(order.jobs).length ? asArray(order.jobs).map((job: any) => (
            <p key={job.id}>{job.technicians?.name ?? job.assigned_technician_name ?? "미배정"} · {formatOrderStatus(job.status)} · 예상 {job.expected_minutes ?? 0}분</p>
          )) : <p className="adm-muted">미배정</p>}
        </details>

        <details className="adm-card adm-details-card">
          <summary>고객 사진</summary>
          <div className="adm-photo-grid">
            {customerPhotos.length ? customerPhotos.map((photo) => (
              <a className="adm-photo-item" href={photo.src ?? "#"} target="_blank" rel="noreferrer" key={photo.label}>
                {photo.src ? <img src={photo.src} alt="고객 접수 사진" /> : photo.label}
              </a>
            )) : <p className="adm-muted">등록된 고객 사진이 없습니다.</p>}
          </div>
        </details>

        <details className="adm-card adm-details-card">
          <summary>고객 후기</summary>
          {feedback ? (
            <div className="adm-stack">
              <p>NPS: {feedback.nps ?? "-"}/10 · ★ {feedback.rating ?? "-"}/5</p>
              <p>시간: {scoreDots(feedback.categories?.speed)} 품질: {scoreDots(feedback.categories?.quality)} 응대: {scoreDots(feedback.categories?.kindness)} 청결: {scoreDots(feedback.categories?.cleanliness)} 가격: {scoreDots(feedback.categories?.price)}</p>
              <p>{feedback.comment ?? "-"}</p>
            </div>
          ) : (
            <div className="adm-empty"><div className="adm-empty-title">아직 고객 후기가 없습니다.</div><div className="adm-empty-sub">시공 완료 후 고객 상태 페이지에서 수집됩니다.</div></div>
          )}
        </details>

        <details className="adm-card adm-details-card">
          <summary>주문 상태 이력</summary>
          <p>현재 상태: {formatOrderStatus(order.status)}</p>
          <p>접수: {formatKRDateTime(order.created_at)}</p>
        </details>
      </div>
    </>
  );
}
