import { cookies } from "next/headers";
import Link from "next/link";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import {
  BUILDUSCARE_LOCAL_ADMIN_DIAGNOSIS_COOKIE,
  BUILDUSCARE_LOCAL_ADMIN_DIAGNOSES_COOKIE,
  BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE,
  BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE,
  localAdminOrderHistoryToAdminDetail,
  localAdminOrderToAdminListItem,
  readLocalAdminDiagnosisCookie,
  readLocalAdminDiagnosisHistoryCookie,
  readLocalAdminOrderHistoryCookie,
  readLocalAdminOrderCookie
} from "@/lib/builduscare-local-admin";
import {
  formatKRDateTime,
  formatKRW,
  formatOrderStatus,
  formatServiceName
} from "@/lib/format";
import { OrderScheduleConfirmButton } from "../order-assignment-client";
import { OrderCustomerLinkCopy } from "../order-customer-link-client";
import { OrderEditPanel } from "../order-edit-panel-client";
import { OrderBankTransferConfirmButton } from "../order-payment-actions-client";
import { OrderStatusTransitionPanel } from "../order-status-transition-panel-client";
import { OrderTestActions } from "../order-test-actions-client";
import { OrderTrashActions } from "../order-trash-actions-client";
import { getOrderStatusUx } from "@/lib/order-status-ux";
import { ORDER_PHOTO_VIEW_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://builduscare.co.kr";
}

async function getOrder(id: string) {
  if (!hasSupabaseEnv()) {
    const cookieStore = await cookies();
    const localOrder = readLocalAdminOrderCookie(cookieStore.get(BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE)?.value);
    if (localOrder?.id === id) {
      return localAdminOrderToAdminListItem(localOrder);
    }
    const history = readLocalAdminOrderHistoryCookie(cookieStore.get(BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE)?.value);
    const matched = history.find((item) => item.id === id);
    return matched ? localAdminOrderHistoryToAdminDetail(matched) : null;
  }
  const { data } = await getSupabaseAdmin()
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      channel,
      source,
      reason,
      service_type_code,
      skus,
      inquiry_photos,
      special_requests,
      total_amount,
      online_payment_amount,
      onsite_payment_amount,
      visit_fee,
      created_at,
      is_test,
      test_note,
      deleted_at,
      deleted_reason,
      customer_id,
      home_id,
      customers(
        id,
        name,
        phone,
        acquisition_source,
        address_full,
        address_dong,
        address_apt
      ),
      homes(
        id,
        address_full,
        address_dong,
        address_apt
      ),
      quotes(
        id,
        version,
        items,
        total_material,
        total_labor,
        visit_fee,
        discount,
        total_final,
        accepted_at,
        created_at
      ),
      jobs(
        id,
        scheduled_at,
        status,
        created_at
      ),
      media(
        id,
        type,
        file_path
      ),
      payments(
        id,
        status,
        provider,
        method,
        amount,
        product_amount,
        online_payment_amount,
        onsite_payment_amount,
        total_amount,
        paid_at,
        approved_at,
        created_at,
        provider_status
      ),
      warranty_cases(
        id,
        status,
        responsibility,
        resolved_at
      )
    `)
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function getOrderDiagnoses(orderId: string) {
  if (!hasSupabaseEnv()) {
    const cookieStore = await cookies();
    const localDiagnosis = readLocalAdminDiagnosisCookie(cookieStore.get(BUILDUSCARE_LOCAL_ADMIN_DIAGNOSIS_COOKIE)?.value);
    if (localDiagnosis?.orderId === orderId) {
      return [{
        id: localDiagnosis.id,
        image_urls: Array.from({ length: Math.max(0, Number(localDiagnosis.photoCount || 0)) }, (_, index) => `local-photo-${index + 1}`),
        photos: Array.from({ length: Math.max(0, Number(localDiagnosis.photoCount || 0)) }, (_, index) => `local-photo-${index + 1}`),
        created_at: localDiagnosis.createdAt
      }];
    }
    const history = readLocalAdminDiagnosisHistoryCookie(cookieStore.get(BUILDUSCARE_LOCAL_ADMIN_DIAGNOSES_COOKIE)?.value);
    return history
      .filter((item) => item.orderId === orderId)
      .map((item) => ({
        id: item.id,
        image_urls: Array.from({ length: Math.max(0, Number(item.photoCount || 0)) }, (_, index) => `local-photo-${index + 1}`),
        photos: Array.from({ length: Math.max(0, Number(item.photoCount || 0)) }, (_, index) => `local-photo-${index + 1}`),
        created_at: item.createdAt
      }));
  }
  const { data } = await getSupabaseAdmin()
    .from("diagnoses")
    .select("id,image_urls,photos,created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

function asArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function customerRecord(order: any) {
  return asArray(order?.customers)[0] ?? null;
}

function homeRecord(order: any) {
  return asArray(order?.homes)[0] ?? null;
}

function firstServiceCode(order: any) {
  const sku = Array.isArray(order?.skus) ? order.skus[0] : null;
  return sku?.service_type_code ?? sku?.metadata?.service_type_code ?? sku?.sku ?? order?.service_type_code;
}

function photoCount(order: any) {
  const orderPhotos = Array.isArray(order?.inquiry_photos) ? order.inquiry_photos : [];
  const mediaPhotos = asArray(order?.media).filter((item: any) => item.type === "inquiry").map((item: any) => item.file_path);
  return uniqueStrings([...orderPhotos, ...mediaPhotos].filter((item): item is string => typeof item === "string")).length;
}

function latestQuote(order: any) {
  return asArray(order.quotes)
    .sort((a: any, b: any) => String(b.accepted_at ?? b.created_at ?? "").localeCompare(String(a.accepted_at ?? a.created_at ?? "")))[0] ?? null;
}

function quoteItems(order: any) {
  const items = latestQuote(order)?.items;
  return Array.isArray(items) ? items : [];
}

function productSnapshot(line: any) {
  const metadata = line?.metadata ?? {};
  return metadata.selected_replacement_product_snapshot ?? metadata.selected_replacement_product ?? null;
}

function productLabel(line: any) {
  const product = productSnapshot(line);
  const brandModel = [product?.brand, product?.model].filter(Boolean).join(" ");
  return brandModel || product?.name || product?.categoryName || line?.item_name || formatServiceName(line?.sku);
}

function productSubLabel(line: any) {
  const product = productSnapshot(line);
  return [product?.categoryName ?? product?.category, product?.color, product?.size, product?.sku].filter(Boolean).join(" · ");
}

function selectedProductSummary(order: any) {
  const items = quoteItems(order);
  if (items.length > 0) {
    const first = items[0];
    const suffix = items.length > 1 ? ` 외 ${items.length - 1}개` : ` × ${Number(first.qty ?? 1)}개`;
    return `${productLabel(first)}${suffix}`;
  }
  return formatServiceName(firstServiceCode(order));
}

function paymentStatusLabel(status?: string | null) {
  if (status === "done") return "결제완료";
  if (status === "failed") return "결제실패";
  if (status === "pending") return "입금 확인 대기";
  if (status === "ready") return "결제 준비";
  return status ?? "-";
}

function slotLabel(slot?: string | null) {
  if (slot === "morning") return "오전";
  if (slot === "afternoon") return "오후";
  if (slot === "all_day") return "종일";
  return "시간 미정";
}

function slotFromScheduledAt(value?: string | null) {
  if (!value) return null;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date(value)));
  return hour < 13 ? "morning" : "afternoon";
}

function kstDateOnly(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric"
  }).format(new Date(value));
}

function visitDateLabel(job: any) {
  return job?.scheduled_at ? kstDateOnly(job.scheduled_at) : "방문 일정 없음";
}

function visitSlotLabel(job: any) {
  return job?.scheduled_at ? slotLabel(slotFromScheduledAt(job.scheduled_at)) : "일정 확인 필요";
}

function latestPayment(order: any) {
  return asArray(order.payments).sort((a: any, b: any) => String(b.created_at ?? b.paid_at ?? "").localeCompare(String(a.created_at ?? a.paid_at ?? "")))[0];
}

function paymentBreakdown(order: any) {
  const payment = latestPayment(order);
  const productAmount = Number(payment?.online_payment_amount ?? payment?.product_amount ?? payment?.amount ?? order?.online_payment_amount ?? 0);
  const onsiteAmount = Number(payment?.onsite_payment_amount ?? payment?.service_fee_amount ?? order?.onsite_payment_amount ?? 0);
  const total = Number(payment?.total_amount ?? order?.total_amount ?? productAmount + onsiteAmount);
  return { productAmount, onsiteAmount, total };
}

function cashReceiptTextFromOrder(order: any) {
  const text = String(order?.special_requests ?? "");
  const line = text.split(/\r?\n/).find((entry) => entry.includes("현금영수증:"));
  return line?.replace(/^.*?현금영수증:\s*/, "").trim() || "신청 안 함";
}

function humanizeAdminText(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const labels: Record<string, string> = {
    builduscare_static: "Build us Care 웹 접수",
    builduscare_web: "Build us Care 웹 접수",
    hold: "추가 사진 요청",
    no_replacement_needed: "교체 불필요",
    not_needed: "교체 불필요",
    photo_diagnosis: "사진확인 접수",
    photo_check_request: "사진확인 접수",
    photo_inquiry: "사진확인 접수",
    product_order_request: "제품 주문 접수",
    replace_recommended: "교체 추천",
    replacement_recommended: "교체 추천",
    site_check_required: "현장 확인 필요"
  };
  return labels[raw] ?? raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function requestText(order: any) {
  const text = String(order?.special_requests ?? "")
    .split(/\r?\n/)
    .filter((entry) => entry.trim() && !entry.includes("현금영수증:"))
    .join(" / ")
    .trim();
  return text || humanizeAdminText(order?.reason) || "요청사항 없음";
}

function isBankTransfer(payment: any) {
  return payment?.provider === "bank_transfer" || payment?.method === "transfer";
}

function paymentOperationLabel(order: any, payment: any) {
  const status = String(order?.status ?? "");
  if (payment?.status === "done" || status === "paid" || status === "product_paid") {
    return isBankTransfer(payment) ? "입금 완료" : "결제 완료";
  }
  if (isBankTransfer(payment) && ["pending", "ready"].includes(String(payment?.status ?? "")) && ["payment_pending", "pending_product_payment"].includes(status)) {
    return "입금 확인 필요";
  }
  if (status === "quoted") return "견적 확인 대기";
  return paymentStatusLabel(payment?.status ?? null);
}

function paymentOperationHelp(order: any, payment: any) {
  const onsiteAmount = Number(payment?.onsite_payment_amount ?? order?.onsite_payment_amount ?? 0);
  if (payment?.status === "done" || order?.status === "paid" || order?.status === "product_paid") {
    return onsiteAmount > 0 ? `현장결제 ${formatKRW(onsiteAmount)} 예정` : "방문 일정 확인으로 진행합니다.";
  }
  if (isBankTransfer(payment) && ["pending", "ready"].includes(String(payment?.status ?? ""))) {
    return "입금 내역 확인 후 입금 확인을 누르면 다음 단계로 이동합니다.";
  }
  return "견적 또는 결제 진행 여부를 확인합니다.";
}

function canConfirmBankTransfer(order: any, payment: any) {
  const status = String(order?.status ?? "");
  return (
    payment?.provider === "bank_transfer" &&
    ["pending", "ready"].includes(String(payment?.status ?? "")) &&
    ["payment_pending", "pending_product_payment"].includes(status)
  );
}

function activeVisitJob(order: any) {
  return asArray(order.jobs)
    .filter((item: any) => item.status !== "cancelled")
    .sort((a: any, b: any) => String(b.scheduled_at ?? b.created_at ?? "").localeCompare(String(a.scheduled_at ?? a.created_at ?? "")))[0] ?? null;
}

function isPhotoIntake(order: any) {
  const serviceCode = firstServiceCode(order);
  const reason = String(order?.reason ?? "");
  const skus = Array.isArray(order?.skus) ? order.skus : [];
  return (
    order?.source === "photo_diagnosis" ||
    order?.source === "builduscare_photo_check" ||
    reason === "photo_diagnosis" ||
    reason === "photo_check_request" ||
    serviceCode === "photo_inquiry" ||
    asArray(order?.inquiry_photos).length > 0 ||
    skus.some((sku: any) => {
      const metadata = sku?.metadata ?? {};
      const skuServiceCode = sku?.service_type_code ?? metadata.service_type_code ?? sku?.sku;
      return skuServiceCode === "photo_inquiry" || metadata.inquiry_only === true || metadata.request_type === "photo_check";
    })
  );
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isRenderablePhotoSrc(value?: string | null) {
  const src = String(value ?? "").trim();
  return isUrl(src) || src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:");
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

async function signPhotoInputs(inputs: string[]) {
  if (!hasSupabaseEnv()) return uniqueStrings(inputs).map((input) => ({ src: input, label: input }));
  const supabase = getSupabaseAdmin();
  return Promise.all(
    uniqueStrings(inputs).map(async (input) => {
      if (isUrl(input)) return { src: input, label: input };
      const { data } = await supabase.storage.from(ORDER_PHOTOS_BUCKET).createSignedUrl(input, ORDER_PHOTO_VIEW_EXPIRES_IN);
      return { src: data?.signedUrl ?? null, label: input };
    })
  );
}

function currentAction(order: any) {
  const jobs = asArray(order.jobs);
  const quotes = asArray(order.quotes);
  const payments = asArray(order.payments);
  const money = paymentBreakdown(order);
  const photos = photoCount(order);
  const hasScheduledJob = jobs.some((job: any) => Boolean(job.scheduled_at));
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
  if (status === "quoted") {
    return {
      title: hasAcceptedQuote ? "입금 안내 전 상태 확인" : "견적 수락 여부 확인",
      summary: "고객이 견적을 확인하는 단계입니다. 최종 견적 확인 후 계좌이체 안내로 이어지는지 확인하세요.",
      badge: "견적"
    };
  }
  if (status === "payment_pending" || status === "pending_product_payment") {
    return {
      title: "사진 확인 및 제품값 입금 확인",
      summary: `접수 사진 ${photos}장과 선택 제품을 확인하고, 제품값 ${formatKRW(money.productAmount)} 입금 내역을 확인합니다.`,
      badge: "입금"
    };
  }
  if (status === "paid" || status === "product_paid" || hasDonePayment) {
    return {
      title: hasScheduledJob ? "방문 확정 필요" : "방문 일정 확인 필요",
      summary: hasScheduledJob ? `현장 시공비 ${formatKRW(money.onsiteAmount)} 예정 금액과 방문 시간을 확인한 뒤 방문 확정을 눌러주세요.` : `제품값 입금 완료 주문입니다. 현장 시공비 ${formatKRW(money.onsiteAmount)} 예정 금액과 방문 일정을 확인해야 합니다.`,
      badge: "방문"
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
  const localMode = !hasSupabaseEnv();
  const [order, diagnoses] = await Promise.all([getOrder(id), getOrderDiagnoses(id)]);
  if (!order) return <div className="adm-empty"><div className="adm-empty-title">주문을 찾을 수 없어요.</div></div>;
  const media = asArray(order.media);
  const skus = Array.isArray(order.skus) ? order.skus : [];
  const action = currentAction(order);
  const isDeleted = Boolean(order.deleted_at);
  const isTest = Boolean(order.is_test);
  const customer = customerRecord(order);
  const home = homeRecord(order);
  const orderForEdit = { ...order, customers: customer, homes: home };
  const activeJob = activeVisitJob(order);
  const payment = latestPayment(order);
  const showBankTransferConfirm = canConfirmBankTransfer(order, payment);
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
  const money = paymentBreakdown(order);
  const selectedItems = quoteItems(order);
  const acceptedQuote = latestQuote(order);
  const quoteMaterialAmount = Number(acceptedQuote?.total_material ?? money.productAmount ?? 0);
  const quoteLaborAmount = Number(acceptedQuote ? Number(acceptedQuote.total_labor ?? 0) + Number(acceptedQuote.visit_fee ?? 0) : money.onsiteAmount);
  const quoteDiscountAmount = Number(acceptedQuote?.discount ?? 0);
  const quoteFinalAmount = Number(acceptedQuote?.total_final ?? money.total ?? 0);
  const lookupParams = new URLSearchParams({ orderNumber: order.order_number });
  if (customer?.name) lookupParams.set("name", customer.name);
  const customerLookupUrl = `${siteUrl()}/order-lookup?${lookupParams.toString()}`;

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">{order.order_number}</h1>
        <p className="adm-page-sub">
          <span className="adm-badge adm-badge-sky">{formatOrderStatus(order.status)}</span>{" "}
          {isTest ? <span className="adm-badge adm-badge-sky">테스트</span> : null}
          {isDeleted ? <span className="adm-badge adm-badge-red">휴지통</span> : null}
        </p>
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
            <strong>{customer?.name ?? "-"}</strong>
            <small>{customer?.phone ?? "-"}</small>
          </article>
          <article className="adm-card adm-brief-card">
            <span>방문 일정</span>
            <strong>{visitDateLabel(activeJob)}</strong>
            <small>{visitSlotLabel(activeJob)}</small>
          </article>
          <article className="adm-card adm-brief-card">
            <span>결제</span>
            <strong>{paymentOperationLabel(order, payment)}</strong>
            <small>제품값 {formatKRW(money.productAmount)} · {paymentOperationHelp(order, payment)}</small>
            <small>현금영수증 {cashReceiptTextFromOrder(order)}</small>
          </article>
        </section>

        <section className="adm-card adm-buildus-summary">
          <div className="adm-section-head">
            <div>
              <h2 className="adm-card-title">Build us Care 접수 요약</h2>
              <p className="adm-muted">고객 접수 내용과 현재 적용된 견적 금액을 한 번에 확인합니다.</p>
            </div>
            <div className="adm-inline-actions">
              <Link className="adm-btn adm-btn-secondary adm-btn-sm" href="/admin/quotes/list">
                견적서 목록
              </Link>
              <Link className="adm-btn adm-btn-primary adm-btn-sm" href={`/admin/quotes?orderId=${encodeURIComponent(order.id)}`}>
                견적서에서 수정
              </Link>
            </div>
          </div>
          <div className="adm-buildus-metrics">
            <span>
              <b>선택 제품</b>
              <strong>{selectedProductSummary(order)}</strong>
              <small>{selectedItems.length ? `${selectedItems.length}개 품목` : "제품 선택 없음"}</small>
            </span>
            <span>
              <b>접수 사진</b>
              <strong>{customerPhotos.length}장</strong>
              <small>{customerPhotos.length > 0 ? "사진 확인 가능" : "등록된 사진 없음"}</small>
            </span>
            <span>
              <b>제품값</b>
              <strong>{formatKRW(quoteMaterialAmount)}</strong>
              <small>계좌이체 기준</small>
            </span>
            <span>
              <b>시공비</b>
              <strong>{formatKRW(quoteLaborAmount)}</strong>
              <small>방문 시 현장 결제 예정</small>
            </span>
            {quoteDiscountAmount > 0 ? (
              <span>
                <b>할인</b>
                <strong>{formatKRW(quoteDiscountAmount)}</strong>
                <small>견적서 반영</small>
              </span>
            ) : null}
            <span>
              <b>최종 견적</b>
              <strong>{formatKRW(quoteFinalAmount)}</strong>
              <small>{acceptedQuote ? "견적서 기준" : "주문 금액 기준"}</small>
            </span>
            <span>
              <b>현금영수증</b>
              <strong>{cashReceiptTextFromOrder(order)}</strong>
              <small>고객 주문 전 입력 정보</small>
            </span>
          </div>
        </section>

        {localMode ? (
          <section className="adm-card adm-admin-warning" role="status">
            <strong>로컬 확인 모드입니다.</strong>
            <p>Supabase 연결 전에는 주문 상세를 읽기 전용으로 확인합니다. 상태 변경, 입금 확인, 주문 수정, 테스트 전환, 삭제는 비활성입니다.</p>
          </section>
        ) : null}

        {!isDeleted && (
          <section className="adm-detail-ops-grid">
            <div className="adm-stack">
              <OrderStatusTransitionPanel orderId={order.id} currentStatus={order.status as OrderStatus} localMode={localMode} />
              <article className="adm-card adm-quick-panel">
                <div>
                  <h2 className="adm-card-title">빠른 처리</h2>
                  <p className="adm-muted">입금 확인과 방문 확정처럼 운영자가 바로 처리할 항목만 모았습니다.</p>
                </div>
                <div className="adm-quick-actions">
                  {showBankTransferConfirm ? (
                    <OrderBankTransferConfirmButton
                      orderId={order.id}
                      orderNumber={order.order_number}
                      amount={Number(payment?.amount ?? order.total_amount ?? 0)}
                      localMode={localMode}
                    />
                  ) : null}
                  {String(order.status) !== "scheduled" && (
                    <OrderScheduleConfirmButton
                      orderId={order.id}
                      disabled={!activeJob || !activeJob?.scheduled_at}
                      reason="방문 확정 전 방문 날짜와 시간대를 먼저 저장해주세요."
                      localMode={localMode}
                    />
                  )}
                </div>
              </article>
            </div>
            <OrderEditPanel order={orderForEdit} localMode={localMode} />
          </section>
        )}

        <details className="adm-card adm-details-card">
          <summary>고객/방문</summary>
          <div className="adm-admin-info-grid">
            <span><b>고객 성함</b><strong>{customer?.name ?? "-"}</strong></span>
            <span><b>연락처</b><strong>{customer?.phone ?? "-"}</strong></span>
            <span><b>주소</b><strong>{[home?.address_full ?? customer?.address_full, home?.address_apt ?? customer?.address_apt].filter(Boolean).join(" ") || "-"}</strong></span>
            <span><b>방문 일정</b><strong>{activeJob?.scheduled_at ? `${visitDateLabel(activeJob)} ${visitSlotLabel(activeJob)}` : "미정"}</strong></span>
          </div>
        </details>

        <details className="adm-card adm-details-card">
          <summary>제품/입금</summary>
          {selectedItems.length ? (
            <div className="adm-product-lines">
              {selectedItems.map((item: any, index: number) => (
                <article className="adm-product-line" key={`${item.sku ?? item.item_name ?? index}`}>
                  <strong>{productLabel(item)}</strong>
                  <small>{productSubLabel(item) || formatServiceName(item.sku ?? firstServiceCode(order))}</small>
                  <em>{Number(item.qty ?? 1)}개 · 제품값 {formatKRW(Number(item.line_material ?? 0))} · 시공비 {formatKRW(Number(item.line_labor ?? 0) + Number(item.option_total ?? 0))}</em>
                </article>
              ))}
            </div>
          ) : skus.length ? skus.map((item: any, index: number) => (
            <p key={`${item.sku ?? item.service_type ?? index}`}>{formatServiceName(item.service_type_code ?? item.sku ?? item.service_type ?? order.service_type_code)} × {item.qty ?? 1}</p>
          )) : <p>{formatServiceName(firstServiceCode(order))} × 1</p>}
          <div className="adm-money-split">
            <span>제품값 계좌이체 <strong>{formatKRW(money.productAmount)}</strong></span>
            <span>현장 시공비 <strong>{formatKRW(money.onsiteAmount)}</strong></span>
            <span>총 예상 금액 <strong>{formatKRW(money.total)}</strong></span>
          </div>
          <div className="adm-admin-info-grid" style={{ marginTop: 12 }}>
            <span><b>현재 결제 상태</b><strong>{paymentOperationLabel(order, payment)}</strong></span>
            {cashReceiptTextFromOrder(order) !== "신청 안 함" ? <span><b>현금영수증</b><strong>{cashReceiptTextFromOrder(order)}</strong></span> : null}
          </div>
        </details>

        <details className="adm-card adm-details-card">
          <summary>사진</summary>
          <div className="adm-photo-grid">
            {customerPhotos.length ? customerPhotos.map((photo) => (
              isRenderablePhotoSrc(photo.src) ? (
                <a className="adm-photo-item" href={photo.src ?? "#"} target="_blank" rel="noreferrer" key={photo.label}>
                  <img src={photo.src ?? ""} alt="고객 접수 사진" />
                </a>
              ) : (
                <div className="adm-photo-item adm-photo-placeholder" key={photo.label}>
                  {photo.label}
                </div>
              )
            )) : <p className="adm-photo-empty">등록 사진 없음</p>}
          </div>
        </details>

        <details className="adm-card adm-details-card">
          <summary>관리</summary>
          <div className="adm-stack">
            <section className="adm-card adm-quick-panel">
              <div>
                <h2 className="adm-card-title">고객 조회 링크</h2>
                <p className="adm-muted">고객에게 전달한 주문조회 링크를 다시 복사합니다.</p>
              </div>
              <OrderCustomerLinkCopy
                orderNumber={order.order_number}
                lookupUrl={customerLookupUrl}
                customerName={customer?.name}
              />
            </section>
            {isTest ? (
              <section className="adm-card adm-test-panel is-test">
                <div>
                  <h2 className="adm-card-title">테스트 주문</h2>
                  <p className="adm-muted">운영 통계에서 제외되는 테스트 데이터입니다.</p>
                  {order.test_note ? <p className="adm-trash-meta">테스트 메모: {order.test_note}</p> : null}
                </div>
                <OrderTestActions isTest={isTest} orderId={order.id} orderNumber={order.order_number} localMode={localMode} />
              </section>
            ) : null}
            <section className={isDeleted ? "adm-card adm-trash-panel is-deleted" : "adm-card adm-trash-panel"}>
              <div>
                <h2 className="adm-card-title">{isDeleted ? "휴지통 주문" : "주문 삭제 관리"}</h2>
                <p className="adm-muted">
                  {isDeleted
                    ? `이 주문은 ${formatKRDateTime(order.deleted_at)}에 휴지통으로 이동했습니다.`
                    : "중복 또는 잘못 접수된 주문일 때만 휴지통으로 이동하세요."}
                </p>
                {order.deleted_reason ? <p className="adm-trash-meta">삭제 메모: {order.deleted_reason}</p> : null}
              </div>
              <OrderTrashActions mode={isDeleted ? "trash" : "active"} orderId={order.id} orderNumber={order.order_number} localMode={localMode} />
            </section>
          </div>
        </details>
      </div>
    </>
  );
}
