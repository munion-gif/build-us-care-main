import { cookies } from "next/headers";
import Link from "next/link";
import { formatChannel, formatKRDate, formatKRW, formatOrderStatus, formatServiceName } from "@/lib/format";
import {
  BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE,
  BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE,
  localAdminOrderHistoryToAdminListItem,
  localAdminOrderToAdminListItem,
  readLocalAdminOrderHistoryCookie,
  readLocalAdminOrderCookie
} from "@/lib/builduscare-local-admin";
import { measure } from "@/lib/perf";
import { getServiceFilterCodes } from "@/lib/service-catalog";
import { getAllServiceItems } from "@/lib/service-items";
import { isLifecycleSchemaError } from "@/lib/schema-compat";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { OPERATIONAL_ORDER_STATUSES } from "@/lib/types";
import { CancellationActions } from "./cancellation-actions-client";
import { OrderAssignmentButton } from "./order-assignment-client";
import { OrderBankTransferConfirmButton } from "./order-payment-actions-client";
import { OrderTrashActions } from "./order-trash-actions-client";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

const statuses = ["", ...OPERATIONAL_ORDER_STATUSES];
const channels = ["", "kakao", "web", "phone", "store", "instagram"];
const workflowFilters = [
  { key: "all", label: "전체", href: "/admin/orders" },
  { key: "intake", label: "신규", href: "/admin/orders?flow=intake" },
  { key: "payment", label: "입금 확인", href: "/admin/orders?flow=payment" },
  { key: "paid", label: "결제완료", href: "/admin/orders?flow=paid" },
  { key: "visit", label: "방문 예정", href: "/admin/orders?flow=visit" },
  { key: "complete", label: "완료", href: "/admin/orders?flow=complete" },
  { key: "issue", label: "취소/A/S", href: "/admin/orders?flow=issue" },
  { key: "test", label: "테스트", href: "/admin/orders?test=1" },
  { key: "trash", label: "휴지통", href: "/admin/orders?trash=1" }
] as const;

const lifecycleColumns = "deleted_at, deleted_by, deleted_reason, is_test, test_marked_at, test_note";
const orderListRelations = `
      customers(name,phone,address_full,address_apt,acquisition_source),
      homes(address_full,address_apt,postal_code),
      payments(id,status,amount,paid_at,approved_at,requested_at,method,provider,provider_status,online_payment_amount,onsite_payment_amount,onsite_payment_status),
      quotes(id,version,items,total_material,total_labor,total_final,accepted_at,created_at),
      media(id,type,file_path,created_at),
      jobs(id,technician_id,assigned_technician_name,scheduled_at,status,technicians(id,name)),
      cancellations(id,status,refund_amount,refund_rate,reason,requested_at)
    `;

function badgeClass(status?: string | null) {
  if (status === "paid" || status === "product_paid" || status === "quoted" || status === "payment_pending" || status === "pending_product_payment") return "adm-badge-blue";
  if (status === "scheduled") return "adm-badge-sky";
  if (status === "in_progress" || status === "cancel_requested") return "adm-badge-orange";
  if (status === "done" || status === "completed") return "adm-badge-green";
  if (status === "issue" || status === "warranty") return "adm-badge-red";
  return "adm-badge-gray";
}

function buildOrdersQuery(params: Record<string, string | undefined>, options: { includeLifecycle: boolean }) {
  const trashMode = params.trash === "1" || params.flow === "trash";
  const testMode = !trashMode && (params.test === "1" || params.flow === "test");
  const page = Math.max(Number(params.page ?? 1), 1);
  const limit = 20;
  const from = (page - 1) * limit;
  const lifecycleSelect = options.includeLifecycle ? `, ${lifecycleColumns}` : "";
  let query = (getSupabaseAdmin() as any)
    .from("orders")
    .select(
      `
      id, order_number, status, total_amount, created_at, channel, service_type_code, skus, special_requests, reason${lifecycleSelect},
      subtotal_amount, online_payment_amount, onsite_payment_amount, onsite_payment_status, inquiry_photos,
      ${orderListRelations}
    `,
      { count: "exact" }
    )
    .order(trashMode && options.includeLifecycle ? "deleted_at" : "created_at", { ascending: false });

  query = query.range(from, from + limit - 1);

  query = query
    .or("service_type_code.is.null,service_type_code.neq.photo_inquiry")
    .or("reason.is.null,reason.not.in.(photo_check_request,photo_diagnosis)");

  if (options.includeLifecycle) {
    if (trashMode) {
      query = query.not("deleted_at", "is", null);
    } else if (testMode) {
      query = query.is("deleted_at", null).eq("is_test", true);
    } else {
      query = query.is("deleted_at", null).or("is_test.is.null,is_test.eq.false");
    }
  }

  if (params.flow && !params.status && !trashMode && !testMode) {
    if (params.flow === "intake") query = query.in("status", ["inquiry", "submitted"]);
    if (params.flow === "quote") query = query.eq("status", "quoted");
    if (params.flow === "payment") query = query.in("status", ["payment_pending", "pending_product_payment"]);
    if (params.flow === "paid") query = query.in("status", ["paid", "product_paid"]);
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

  return { from, limit, page, query, testMode, trashMode };
}

function applyClientOrderFilters(orders: any[], params: Record<string, string | undefined>) {
  const visibleOrders = orders.filter((order) => !isPhotoCheckOrder(order));
  if (params.flow === "intake") return visibleOrders;
  return visibleOrders;
}

async function getOrders(params: Record<string, string | undefined>) {
  const trashMode = params.trash === "1" || params.flow === "trash";
  const testMode = !trashMode && (params.test === "1" || params.flow === "test");
  if (!hasSupabaseEnv()) {
    const cookieStore = await cookies();
    const history = readLocalAdminOrderHistoryCookie(cookieStore.get(BUILDUSCARE_LOCAL_ADMIN_ORDERS_COOKIE)?.value);
    const localOrder = readLocalAdminOrderCookie(cookieStore.get(BUILDUSCARE_LOCAL_ADMIN_ORDER_COOKIE)?.value);
    const seededOrders = history.length > 0
      ? history.map(localAdminOrderHistoryToAdminListItem)
      : localOrder
        ? [localAdminOrderToAdminListItem(localOrder)]
        : [];
    const orders = applyClientOrderFilters(seededOrders, params);
    return {
      orders,
      count: orders.length,
      error: null,
      page: 1,
      limit: 20,
      schemaWarning: null,
      localMode: true,
      trashMode,
      testMode
    };
  }
  const primary = buildOrdersQuery(params, { includeLifecycle: true });
  const primaryResult = await primary.query;
  if (!primaryResult.error) {
    const orders = applyClientOrderFilters(primaryResult.data ?? [], params);
    return { orders, count: primaryResult.count ?? 0, error: null, page: primary.page, limit: primary.limit, schemaWarning: null, localMode: false, trashMode, testMode };
  }

  if (!isLifecycleSchemaError(primaryResult.error)) {
    return { orders: [], count: 0, error: primaryResult.error.message, page: primary.page, limit: primary.limit, schemaWarning: null, localMode: false, trashMode, testMode };
  }

  const schemaWarning = "DB에 테스트/휴지통 컬럼이 REST API 기준으로 아직 반영되지 않았습니다. 일반 주문 목록은 호환 모드로 표시하고, 테스트/휴지통 분리는 제한합니다.";
  if (trashMode || testMode) {
    return { orders: [], count: 0, error: null, page: primary.page, limit: primary.limit, schemaWarning, localMode: false, trashMode, testMode };
  }

  const fallback = buildOrdersQuery(params, { includeLifecycle: false });
  const fallbackResult = await fallback.query;
  const orders = applyClientOrderFilters(fallbackResult.data ?? [], params);
  return {
    orders,
    count: fallbackResult.count ?? 0,
    error: fallbackResult.error?.message ?? null,
    page: fallback.page,
    limit: fallback.limit,
    schemaWarning,
    localMode: false,
    trashMode,
    testMode
  };
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
  return sku?.service_type_code ?? sku?.metadata?.service_type_code ?? sku?.sku ?? order?.service_type_code;
}

function isPhotoCheckOrder(order: any) {
  const skus = Array.isArray(order?.skus) ? order.skus : [];
  if (order?.service_type_code === "photo_inquiry" || firstServiceCode(order) === "photo_inquiry") return true;
  return skus.some((sku: any) => {
    const metadata = sku?.metadata ?? {};
    const serviceCode = sku?.service_type_code ?? metadata.service_type_code ?? sku?.sku;
    return (
      serviceCode === "photo_inquiry" ||
      metadata.inquiry_only === true ||
      metadata.request_type === "photo_check" ||
      String(sku?.item_name ?? "").includes("사진 확인")
    );
  });
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function photoCount(order: any) {
  const orderPhotos = Array.isArray(order?.inquiry_photos) ? order.inquiry_photos : [];
  const mediaPhotos = Array.isArray(order?.media)
    ? order.media.filter((item: any) => item.type === "inquiry").map((item: any) => item.file_path)
    : [];
  return uniqueStrings([...orderPhotos, ...mediaPhotos].filter((item): item is string => typeof item === "string")).length;
}

function latestQuote(order: any) {
  const quotes = Array.isArray(order?.quotes) ? order.quotes : [];
  return [...quotes].sort((a: any, b: any) => {
    const left = String(b.accepted_at ?? b.created_at ?? "");
    const right = String(a.accepted_at ?? a.created_at ?? "");
    return left.localeCompare(right);
  })[0] ?? null;
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
  const skus = Array.isArray(order?.skus) ? order.skus : [];
  const firstSku = skus[0];
  const rawName = String(firstSku?.item_name ?? "").trim();
  if (rawName) {
    return skus.length > 1 ? `${rawName} 외 ${skus.length - 1}개` : rawName;
  }
  return formatServiceName(firstServiceCode(order));
}

function customerLine(order: any) {
  return [order?.customers?.name || "성함 없음", order?.customers?.phone || "연락처 없음"].join(" · ");
}

function cashReceiptTextFromOrder(order: any) {
  const text = String(order?.special_requests ?? "");
  const line = text.split(/\r?\n/).find((entry) => entry.includes("현금영수증:"));
  return line?.replace(/^.*?현금영수증:\s*/, "").trim() || "신청 안 함";
}

function paymentBreakdown(order: any) {
  const payment = latestPayment(order);
  const productAmount = Number(payment?.online_payment_amount ?? payment?.product_amount ?? payment?.amount ?? order?.online_payment_amount ?? 0);
  const onsiteAmount = Number(payment?.onsite_payment_amount ?? payment?.service_fee_amount ?? order?.onsite_payment_amount ?? 0);
  const total = Number(payment?.total_amount ?? order?.total_amount ?? productAmount + onsiteAmount);
  return { productAmount, onsiteAmount, total };
}

function activeWorkflowKey(status?: string, flow?: string) {
  if (flow) return flow;
  if (!status) return "all";
  if (status === "inquiry") return "intake";
  if (status === "quoted") return "quote";
  if (status === "payment_pending" || status === "pending_product_payment") return "payment";
  if (status === "paid" || status === "product_paid") return "paid";
  if (status === "scheduled" || status === "in_progress") return "visit";
  if (status === "completed" || status === "done") return "complete";
  if (status === "cancel_requested" || status === "canceled" || status === "warranty" || status === "issue") return "issue";
  return "all";
}

function todayKST() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric"
  }).format(new Date());
}

function deletedMeta(order: any) {
  if (!order.deleted_at) return null;
  const reason = order.deleted_reason ? ` · ${order.deleted_reason}` : "";
  return `휴지통 이동: ${formatKRDate(order.deleted_at)}${reason}`;
}

function activeVisitJob(order: any) {
  const jobs = Array.isArray(order.jobs) ? order.jobs : [];
  return jobs
    .filter((item: any) => item.status !== "cancelled")
    .sort((a: any, b: any) => String(b.scheduled_at ?? b.created_at ?? "").localeCompare(String(a.scheduled_at ?? a.created_at ?? "")))[0];
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

function visitScheduleLabel(order: any) {
  const job = activeVisitJob(order);
  if (!job?.scheduled_at) return "방문 일정 없음";
  return `${kstDateOnly(job.scheduled_at)} ${slotLabel(slotFromScheduledAt(job.scheduled_at))}`;
}

function paymentState(order: any) {
  const payments = Array.isArray(order.payments) ? order.payments : [];
  const payment = latestPayment(order);
  const donePayment = payments.some((item: any) => item.status === "done");
  const breakdown = paymentBreakdown(order);
  const amount = breakdown.productAmount || Number(payment?.amount ?? order.online_payment_amount ?? order.total_amount ?? 0);
  const onsiteAmount = breakdown.onsiteAmount;

  if (donePayment || order.status === "paid" || order.status === "product_paid") {
    return {
      amount,
      className: "adm-badge-blue",
      detail: onsiteAmount > 0 ? `현장결제 ${formatKRW(onsiteAmount)} 예정` : "다음 단계 진행 가능",
      label: isBankTransfer(payment) ? "입금완료" : "결제완료",
      needsConfirmation: false
    };
  }

  if (bankTransferNeedsConfirmation(order)) {
    return {
      amount,
      className: "adm-badge-orange",
      detail: "계좌이체 입금 내역 확인 후 처리",
      label: "입금 확인 필요",
      needsConfirmation: true
    };
  }

  if (order.status === "payment_pending" || order.status === "pending_product_payment") {
    return {
      amount,
      className: "adm-badge-orange",
      detail: "계좌이체 결제 이력 확인 필요",
      label: "입금 정보 확인",
      needsConfirmation: false
    };
  }

  if (order.status === "quoted") {
    return {
      amount: Number(order.total_amount ?? 0),
      className: "adm-badge-sky",
      detail: "고객 견적 확인 전",
      label: "견적 확인 대기",
      needsConfirmation: false
    };
  }

  return {
    amount: Number(order.total_amount ?? 0),
    className: "adm-badge-gray",
    detail: "견적 또는 결제 정보 없음",
    label: "미결제",
    needsConfirmation: false
  };
}

function latestPayment(order: any) {
  const payments = Array.isArray(order.payments) ? order.payments : [];
  return [...payments].sort((a: any, b: any) => String(b.created_at ?? b.requested_at ?? b.paid_at ?? "").localeCompare(String(a.created_at ?? a.requested_at ?? a.paid_at ?? "")))[0] ?? null;
}

function isBankTransfer(payment: any) {
  return payment?.provider === "bank_transfer" || payment?.method === "transfer";
}

function isPendingPayment(payment: any) {
  return ["pending", "ready"].includes(String(payment?.status ?? ""));
}

function bankTransferNeedsConfirmation(order: any) {
  const payment = latestPayment(order);
  const status = String(order.status ?? "");
  return isBankTransfer(payment) && isPendingPayment(payment) && ["payment_pending", "pending_product_payment"].includes(status) ? payment : null;
}

function assignedTechnician(order: any) {
  const jobs = Array.isArray(order.jobs) ? order.jobs : [];
  const job = jobs.find((item: any) => item.technicians?.name || item.assigned_technician_name || item.technician_id);
  return job?.technicians?.name ?? job?.assigned_technician_name ?? "미배정";
}

function addressPreview(order: any) {
  const road = order.homes?.address_full ?? order.customers?.address_full;
  const detail = order.homes?.address_apt ?? order.customers?.address_apt;
  return [road, detail].filter(Boolean).join(" ") || "주소 미입력";
}

function queueNextAction(order: any) {
  const status = String(order.status ?? "");
  const payment = paymentState(order);
  const hasAssigned = assignedTechnician(order) !== "미배정";
  const photos = photoCount(order);

  if (payment.needsConfirmation) {
    return {
      badge: "입금",
      className: "adm-badge-orange",
      label: "계좌이체 입금 확인",
      help: `${formatKRW(payment.amount)} 입금 내역 확인 후 기사 배정으로 진행`
    };
  }
  if (["paid", "product_paid"].includes(status)) {
    return hasAssigned
      ? {
          badge: "확정",
          className: "adm-badge-sky",
          label: "방문 확정 필요",
          help: `${visitScheduleLabel(order)} · 고객에게 방문 확정 상태로 안내`
        }
      : {
          badge: "배정",
          className: "adm-badge-blue",
          label: "기사 배정 필요",
          help: "담당 기사와 방문 시간대를 먼저 지정"
        };
  }
  if (["scheduled", "in_progress"].includes(status)) {
    return {
      badge: "방문",
      className: "adm-badge-sky",
      label: status === "scheduled" ? "방문 준비" : "현장 진행 중",
      help: `${visitScheduleLabel(order)} · 담당 ${assignedTechnician(order)}`
    };
  }
  if (["completed", "done"].includes(status)) {
    return {
      badge: "완료",
      className: "adm-badge-green",
      label: status === "completed" ? "최종 검수" : "완료",
      help: "완료 리포트와 A/S 가능 상태 확인"
    };
  }
  if (["cancel_requested", "issue", "warranty"].includes(status)) {
    return {
      badge: "예외",
      className: "adm-badge-red",
      label: "운영 확인 필요",
      help: "취소, 이슈, A/S 접수 내용을 우선 확인"
    };
  }
  if (status === "quoted") {
    return {
      badge: "견적",
      className: "adm-badge-sky",
      label: "견적 확인 대기",
      help: "고객 수락 여부와 입금 안내 흐름 확인"
    };
  }
  return {
    badge: "접수",
    className: "adm-badge-gray",
    label: photos > 0 ? "사진 확인 필요" : "접수 내용 확인",
    help: photos > 0 ? `고객 사진 ${photos}장 확인 후 견적 안내` : "고객 요청 내용과 연락처 확인"
  };
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [{ orders, count, error, schemaWarning, localMode, page, limit, trashMode, testMode }, services, technicians] = await Promise.all([
    measure("admin.orders.fetchOrders", () => getOrders(params)),
    measure("admin.orders.fetchServices", () => getAllServiceItems()),
    measure("admin.orders.fetchTechnicians", () => getActiveTechnicians())
  ]);
  const totalPages = Math.max(Math.ceil(count / limit), 1);
  const visibleSummary = {
    needsPayment: orders.filter((order: any) => paymentState(order).needsConfirmation).length,
    needsAssign: orders.filter((order: any) => ["paid", "product_paid"].includes(String(order.status)) && assignedTechnician(order) === "미배정").length,
    visits: orders.filter((order: any) => ["scheduled", "in_progress"].includes(String(order.status))).length,
    issues: orders.filter((order: any) => ["cancel_requested", "issue", "warranty"].includes(String(order.status))).length
  };
  const activeKey = trashMode ? "trash" : testMode ? "test" : activeWorkflowKey(params.status, params.flow);
  const priorityCards = [
    {
      count: trashMode || testMode ? 0 : visibleSummary.needsPayment,
      helper: "계좌이체 입금 내역을 확인하고 다음 단계로 넘깁니다.",
      href: "/admin/orders?flow=payment",
      key: "payment",
      label: "입금 확인 필요"
    },
    {
      count: trashMode || testMode ? 0 : visibleSummary.needsAssign,
      helper: "입금 완료 후 기사 배정이 필요한 주문입니다.",
      href: "/admin/orders?flow=paid",
      key: "paid",
      label: "배정 필요"
    },
    {
      count: trashMode || testMode ? 0 : visibleSummary.visits,
      helper: "방문 준비와 진행 상태를 확인합니다.",
      href: "/admin/orders?flow=visit",
      key: "visit",
      label: "방문/진행"
    },
    {
      count: trashMode || testMode ? 0 : visibleSummary.issues,
      helper: "취소 요청, 이슈, A/S 주문을 따로 봅니다.",
      href: "/admin/orders?flow=issue",
      key: "issue",
      label: "예외 처리"
    }
  ] as const;

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">제품 주문</h1>
        <p className="adm-page-sub">
          {trashMode
            ? "휴지통으로 이동한 주문을 복구하거나 완전 삭제합니다."
            : testMode
              ? "관리자 테스트 주문만 따로 확인합니다. 운영 주문, 통계, 고객 조회에는 노출하지 않습니다."
              : "고객이 선택한 제품, 사진, 현금영수증, 입금 상태, 예약 정보를 한 화면에서 확인합니다."}
        </p>
      </header>
      <div className="adm-content">
        <section className="adm-ops-panel" aria-labelledby="order-priority-heading">
          <div className="adm-ops-panel-head">
            <div>
              <span className="adm-ops-eyebrow">현재 조건 기준</span>
              <h2 id="order-priority-heading">먼저 처리할 주문</h2>
              <p>입금 확인, 배정, 방문, 예외 처리를 한 화면에서 바로 확인합니다.</p>
            </div>
            <div className="adm-ops-actions">
              <Link className="adm-btn adm-btn-secondary adm-btn-sm" href={`/admin/orders?date_from=${todayKST()}&flow=intake`}>오늘 접수</Link>
              <Link className="adm-btn adm-btn-secondary adm-btn-sm" href="/admin/orders?trash=1">휴지통</Link>
            </div>
          </div>
          <div className="adm-ops-priority-grid">
            {priorityCards.map((card) => (
              <Link className={`adm-ops-priority-card ${activeKey === card.key ? "active" : ""}`} href={card.href} key={card.key}>
                <span>{card.label}</span>
                <strong>{card.count}</strong>
                <small>{card.helper}</small>
              </Link>
            ))}
          </div>
        </section>
        <section className="adm-list-controls" aria-label="주문 목록 필터">
          <div className="adm-section-head">
            <div>
              <h2 className="adm-section-title">목록 보기</h2>
              <p className="adm-section-note adm-muted">상태, 서비스, 채널, 날짜, 주문번호로 목록을 좁힙니다.</p>
            </div>
            <strong className="adm-result-count">검색 결과 {count}건</strong>
          </div>
          <nav className="adm-workflow-tabs" aria-label="주문 처리 단계">
            {workflowFilters.map((item) => (
              <Link className={activeKey === item.key ? "active" : ""} href={item.href} key={item.key}>
                {item.label}
              </Link>
            ))}
          </nav>
        </section>
        <form className="adm-filter-bar">
          {testMode ? <input type="hidden" name="test" value="1" /> : null}
          {trashMode ? <input type="hidden" name="trash" value="1" /> : null}
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
        {schemaWarning ? (
          <section className="adm-card adm-admin-warning" role="status">
            <strong>스키마 반영 확인이 필요합니다.</strong>
            <p>{schemaWarning}</p>
            <small>Supabase SQL editor에서 `202606010001_order_trash.sql`, `202606010002_test_flags.sql` 적용 여부와 REST 스키마 캐시를 확인해 주세요.</small>
          </section>
        ) : null}
        {localMode ? (
          <section className="adm-card adm-admin-warning" role="status">
            <strong>로컬 확인 모드입니다.</strong>
            <p>Supabase 연결 전에는 최근 로컬 제품 주문 내역을 읽기 전용으로 확인합니다.</p>
          </section>
        ) : null}
        <section className="adm-order-queue-list" aria-label="주문 처리 큐">
          {error ? (
            <div className="adm-card adm-admin-error" role="alert">
              <strong>제품 주문 데이터를 불러오지 못했습니다.</strong>
              <p>DB 스키마나 Supabase REST 캐시가 현재 코드와 맞지 않을 수 있습니다. 마이그레이션과 환경변수를 확인해 주세요.</p>
              <small>{error}</small>
            </div>
          ) : orders.length === 0 ? (
            <div className="adm-card adm-empty-line">조건에 맞는 주문이 없습니다.</div>
          ) : orders.map((order: any) => {
            const payment = paymentState(order);
            const photos = photoCount(order);
            const money = paymentBreakdown(order);
            const cashReceiptText = cashReceiptTextFromOrder(order);
            const pendingCancellation = Array.isArray(order.cancellations) ? order.cancellations.find((item: any) => item.status === "pending") : null;
            const nextAction = queueNextAction(order);
            return (
              <article className="adm-order-queue-card" key={order.id}>
                <div className="adm-order-queue-main">
                  <div className="adm-order-queue-title">
                    <Link className="adm-link" href={`/admin/orders/${order.id}`}>{order.order_number}</Link>
                    <span className={`adm-badge ${badgeClass(order.status)}`}>{formatOrderStatus(order.status)}</span>
                    {order.is_test ? <span className="adm-badge adm-badge-sky">테스트</span> : null}
                  </div>
                  <strong>{selectedProductSummary(order)}</strong>
                  <div className="adm-order-queue-next">
                    <span className={`adm-badge ${nextAction.className}`}>{nextAction.badge}</span>
                    <div>
                      <b>{nextAction.label}</b>
                      <small>{nextAction.help}</small>
                    </div>
                  </div>
                  <p>{customerLine(order)} · {formatKRDate(order.created_at)}</p>
                  <p>{addressPreview(order)}</p>
                  <p>현금영수증 · {cashReceiptText}</p>
                  {trashMode && deletedMeta(order) ? <p className="adm-trash-meta">{deletedMeta(order)}</p> : null}
                </div>
                <div className="adm-order-queue-meta">
                  <span>
                    <b>결제</b>
                    <em className={`adm-badge ${payment.className}`}>{payment.label}</em>
                    <strong className="adm-payment-amount">{formatKRW(payment.amount)}</strong>
                    <small>{payment.detail}</small>
                  </span>
                  <span>
                    <b>사진</b>
                    <strong>{photos > 0 ? `${photos}장` : "없음"}</strong>
                    <small>{photos > 0 ? "고객 첨부" : "첨부 없음"}</small>
                  </span>
                  <span>
                    <b>담당</b>
                    <strong>{assignedTechnician(order)}</strong>
                    <small>{visitScheduleLabel(order)}</small>
                  </span>
                </div>
                <div className="adm-order-queue-actions">
                  {pendingCancellation ? (
                    <>
                      <CancellationActions cancellationId={pendingCancellation.id} refundAmount={Number(pendingCancellation.refund_amount ?? 0)} refundRate={Number(pendingCancellation.refund_rate ?? 0)} localMode={localMode} />
                      <Link className="adm-btn adm-btn-secondary adm-btn-sm" href={`/admin/orders/${order.id}`}>수정</Link>
                    </>
                  ) : (
                    trashMode ? (
                      <>
                        <Link className="adm-btn adm-btn-secondary adm-btn-sm" href={`/admin/orders/${order.id}`}>상세 확인</Link>
                        <OrderTrashActions compact mode="trash" orderId={order.id} orderNumber={order.order_number} localMode={localMode} />
                      </>
                    ) : (
                      <>
                        {payment.needsConfirmation ? (
                          <OrderBankTransferConfirmButton
                            amount={payment.amount}
                            compact
                            orderId={order.id}
                            orderNumber={order.order_number}
                            localMode={localMode}
                          />
                        ) : null}
                        {["paid", "product_paid"].includes(String(order.status)) && (
                          <OrderAssignmentButton compact orderId={order.id} orderNumber={order.order_number} orderStatus={order.status} jobs={Array.isArray(order.jobs) ? order.jobs : []} technicians={technicians} localMode={localMode} />
                        )}
                        <Link className="adm-btn adm-btn-secondary adm-btn-sm" href={`/admin/orders/${order.id}`}>수정</Link>
                        <OrderTrashActions compact orderId={order.id} orderNumber={order.order_number} localMode={localMode} />
                      </>
                    )
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
