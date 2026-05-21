"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FeedbackModal } from "@/components/orders/FeedbackModal";
import { NextActionCard } from "@/components/orders/NextActionCard";
import { OrderCurrentStatusPanel } from "@/components/orders/OrderCurrentStatusPanel";
import { QuoteSummary } from "@/components/orders/QuoteSummary";
import { ReservationCard } from "@/components/orders/ReservationCard";
import { StatusTimeline } from "@/components/orders/StatusTimeline";
import { customerErrorMessage } from "@/lib/error-messages";
import { EVENT_TYPES } from "@/lib/event-types";
import { SERVICE_NAME_BY_CODE, formatKRDate, formatKRDateTime, formatKRW, formatServiceName } from "@/lib/format";
import { getKakaoChannelChatUrl } from "@/lib/kakao-channel";
import { getOrderStatusUx } from "@/lib/order-status-ux";
import { useTracking } from "@/lib/use-tracking";

type OrderStatusClientProps = {
  orderId: string;
  accessToken: string;
  kakaoUrl: string | null;
  servicePhone: string | null;
};

function dateLabel(value?: string | null) {
  return formatKRDate(value);
}

function serviceName(order: any) {
  const sku = order?.skus?.[0];
  return sku?.item_name ?? formatServiceName(sku?.service_type_code ?? sku?.sku ?? order?.service_type_code);
}

function asArray<T = any>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeOrderStatusForUi(status?: string | null) {
  if (status === "cancelled") return "canceled";
  if (status === "submitted" || status === "draft") return "inquiry";
  if (status === "reservation_confirmed" || status === "preparing") return "scheduled";
  if (status === "reservation_pending") return "payment_pending";
  if (status === "in_service") return "in_progress";
  return status ?? "";
}

function latestQuote(quotes: any[] = []) {
  return asArray(quotes).sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0))[0] ?? null;
}

function primaryJob(jobs: any[] = []) {
  const rows = asArray(jobs);
  const activeRows = rows.filter((job) => job?.status !== "cancelled");
  return (activeRows.length > 0 ? activeRows : rows).sort((a, b) => String(b.scheduled_at ?? b.created_at ?? "").localeCompare(String(a.scheduled_at ?? a.created_at ?? "")))[0] ?? null;
}

function primaryReservation(reservations: any[] = []) {
  const rows = asArray(reservations);
  const activeRows = rows.filter((reservation) => ["pending", "confirmed"].includes(String(reservation?.status)));
  return (activeRows.length > 0 ? activeRows : rows).sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0] ?? null;
}

function currentPageLink() {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

type SlotPeriod = "morning" | "afternoon";

type SlotDay = {
  date: string;
  blocked: boolean;
  beforeMinDate: boolean;
  allFull: boolean;
  slots: Record<SlotPeriod, { usedCount: number; maxCount: number; isFull: boolean; available: boolean }>;
};

function kstDateText(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function slotFromDate(value?: string | null): SlotPeriod | null {
  if (!value) return null;
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false
    }).format(new Date(value))
  );
  return hour < 13 ? "morning" : "afternoon";
}

function dateFromReservationOrJob(reservation: any, job: any) {
  return reservation?.reserved_date ?? (job?.scheduled_at ? kstDateText(job.scheduled_at) : "");
}

function slotFromReservationOrJob(reservation: any, job: any): SlotPeriod {
  return (reservation?.time_slot === "afternoon" || reservation?.time_slot === "morning" ? reservation.time_slot : slotFromDate(job?.scheduled_at)) ?? "morning";
}

function monthParts(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1
  };
}

function monthTitle(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function buildStatusGuidance(params: {
  orderStatus?: string | null;
  jobStatus?: string | null;
  hasReservation: boolean;
}) {
  const orderStatus = normalizeOrderStatusForUi(params.orderStatus);
  const jobStatus = String(params.jobStatus ?? "");

  if (orderStatus === "warranty") {
    return [
      "A/S 요청이 접수되었습니다.",
      "담당자가 내용을 확인 중이며 보통 1영업일 안에 연락을 드릴 예정입니다."
    ];
  }

  if (orderStatus === "issue") {
    return [
      "시공 후 확인이 필요한 내용이 접수되었습니다.",
      "담당자가 내용을 정리한 뒤 해결 방향을 안내드릴 예정입니다."
    ];
  }

  if (orderStatus === "paid" && jobStatus === "assigned") {
    return [
      "담당 기사가 배정되었어요.",
      "방문 날짜와 시간대를 최종 확인한 뒤 확정 안내를 드릴 예정입니다."
    ];
  }

  if ((orderStatus === "paid" || orderStatus === "scheduled") && jobStatus !== "scheduled") {
    return [
      "결제가 완료되었어요. 영업시간 기준 순차적으로 기사 배정을 도와드립니다.",
      "배정이 완료되면 등록하신 연락처로 방문 일정을 안내드릴 예정입니다."
    ];
  }

  if (jobStatus === "scheduled" || (params.hasReservation && orderStatus === "scheduled")) {
    return [
      "방문 예약이 확정되었습니다.",
      "예약하신 날짜에 맞춰 기사님이 방문합니다. 예약 변경이 필요하시면 아래에서 요청하실 수 있어요."
    ];
  }

  if (orderStatus === "quoted") {
    return [
      "견적이 준비되었습니다.",
      "견적을 확인하고 결제를 진행하면 기사 배정이 시작됩니다."
    ];
  }

  if (orderStatus === "payment_pending") {
    return [
      "견적 확인이 완료되었습니다.",
      "결제가 완료되면 기사 배정과 방문 일정 안내가 시작됩니다."
    ];
  }

  if (orderStatus === "inquiry") {
    return [
      "문의가 접수되었습니다.",
      "기본 정보 확인 후 견적 또는 상담으로 이어서 안내드릴 예정입니다."
    ];
  }

  return ["이 주문 링크에서 현재 진행 상태를 계속 확인하실 수 있어요."];
}

function nextHappensForStatus(status?: string | null) {
  const normalized = normalizeOrderStatusForUi(status);
  const copy: Record<string, { title: string; items: string[] }> = {
    inquiry: {
      title: "견적 검토가 시작됩니다",
      items: ["작업 범위와 견적을 준비합니다."]
    },
    quoted: {
      title: "견적 확인 후 결제로 이어집니다",
      items: ["금액과 범위를 확인하고 결제해주세요."]
    },
    payment_pending: {
      title: "결제 완료 후 일정이 확정됩니다",
      items: ["결제가 끝나면 기사 배정이 시작됩니다."]
    },
    paid: {
      title: "기사 배정과 예약 확정을 진행합니다",
      items: ["담당 기사와 방문 시간이 확정되면 이 페이지에 표시됩니다."]
    },
    scheduled: {
      title: "예약된 시간에 방문합니다",
      items: ["변경이 필요하면 가능한 시간대로 요청해주세요."]
    },
    in_progress: {
      title: "현장 작업이 진행 중입니다",
      items: ["작업이 끝나면 완료 확인 단계로 넘어갑니다."]
    },
    completed: {
      title: "최종 확인 및 정산이 진행됩니다",
      items: ["A/S 접수는 최종 완료 후 가능합니다."]
    },
    done: {
      title: "A/S 가능 조건을 확인할 수 있습니다",
      items: ["보증 조건에 해당하면 이 링크에서 접수하세요."]
    },
    issue: {
      title: "확인 필요한 이슈를 정리합니다",
      items: ["담당자가 해결 방향을 안내합니다."]
    },
    warranty: {
      title: "A/S 요청을 확인 중입니다",
      items: ["필요하면 방문 또는 조치 일정을 안내드립니다."]
    },
    canceled: {
      title: "취소 처리가 완료되었습니다",
      items: ["다시 필요하면 새 문의로 접수해주세요."]
    }
  };
  return copy[normalized] ?? copy.inquiry;
}

function calendarDays(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = Array.from({ length: firstDay.getDay() }, () => null);
  const days = Array.from({ length: daysInMonth }, (_, index) => `${year}-${String(month + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`);
  return [...blanks, ...days];
}

export function OrderStatusClient({ orderId, accessToken, kakaoUrl, servicePhone }: OrderStatusClientProps) {
  const [state, setState] = useState<{ loading: boolean; message: string; order?: any; status?: number }>({
    loading: true,
    message: "주문 상태를 불러오고 있어요."
  });
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [warrantyOpen, setWarrantyOpen] = useState(false);
  const [warrantyType, setWarrantyType] = useState<"leak" | "falling" | "noise" | "other">("leak");
  const [warrantyDescription, setWarrantyDescription] = useState("");
  const [warrantyLoading, setWarrantyLoading] = useState(false);
  const [warrantyMessage, setWarrantyMessage] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("일정이 변경됐어요");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState<SlotPeriod>("morning");
  const [rescheduleMonth, setRescheduleMonth] = useState(() => new Date());
  const [slotDays, setSlotDays] = useState<Record<string, SlotDay>>({});
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleMessage, setRescheduleMessage] = useState("");
  const [rescheduleNotice, setRescheduleNotice] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const tossConfirmStarted = useRef(false);
  const { track } = useTracking();
  const kakaoChatUrl = getKakaoChannelChatUrl(kakaoUrl);

  async function loadOrder() {
    if (!accessToken) {
      setState({
        loading: false,
        status: 403,
        message: "링크가 만료됐거나 올바르지 않아요. 주문 시 받은 링크를 다시 확인해주세요."
      });
      return;
    }

    setState((current) => ({ ...current, loading: true, message: "주문 상태를 불러오고 있어요." }));
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const json = await response.json();
      if (!response.ok) {
        const fallback = response.status === 404 ? "주문을 찾을 수 없어요" : "링크가 만료됐거나 올바르지 않아요. 주문 시 받은 링크를 다시 확인해주세요.";
        setState({ loading: false, status: response.status, message: customerErrorMessage(json?.error, fallback) });
        return;
      }
      setState({ loading: false, message: "", order: json.data.order });
    } catch {
      setState({ loading: false, status: 0, message: "네트워크 연결이 불안정해요. 다시 시도해주세요." });
    }
  }

  useEffect(() => {
    async function boot() {
      if (typeof window === "undefined") {
        await loadOrder();
        return;
      }

      const url = new URL(window.location.href);
      const isTossSuccess = url.searchParams.get("toss") === "success";
      const paymentKey = url.searchParams.get("paymentKey");
      const amount = url.searchParams.get("amount");

      if (!isTossSuccess || !paymentKey || !amount || tossConfirmStarted.current) {
        await loadOrder();
        return;
      }

      tossConfirmStarted.current = true;
      setPaymentSuccess(true);
      url.searchParams.delete("toss");
      url.searchParams.delete("paymentKey");
      url.searchParams.delete("amount");
      url.searchParams.delete("orderId");
      url.searchParams.delete("serviceCode");
      window.history.replaceState({}, "", url.toString());

      setState((current) => ({ ...current, loading: true, message: "결제 승인을 확인하고 있어요." }));

      try {
        const response = await fetch("/api/payments/toss/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) })
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(customerErrorMessage(json?.error, "결제 승인 확인에 실패했어요."));
        }
        await loadOrder();
      } catch (error) {
        setState({
          loading: false,
          status: 0,
          message: error instanceof Error ? error.message : "결제 승인 확인에 실패했어요. 잠시 후 다시 확인해주세요."
        });
      }
    }

    void boot();
  }, [accessToken, orderId]);

  const order = state.order;
  const orderStatus = normalizeOrderStatusForUi(order?.status);
  const quote = useMemo(() => latestQuote(order?.quotes ?? []), [order?.quotes]);
  const job = useMemo(() => primaryJob(order?.jobs ?? []), [order?.jobs]);
  const reservation = useMemo(() => primaryReservation(order?.reservations ?? []), [order?.reservations]);
  const payment = useMemo(() => asArray(order?.payments).sort((a: any, b: any) => String(b.paid_at ?? b.approved_at ?? b.created_at ?? "").localeCompare(String(a.paid_at ?? a.approved_at ?? a.created_at ?? "")))[0] ?? null, [order?.payments]);
  const feedbacks = asArray(order?.feedbacks);
  const feedbackExists = feedbacks.length > 0;
  const showFeedbackCta = Boolean(order && orderStatus === "done" && !feedbackExists);
  const canCancel = Boolean(order && ["paid", "scheduled"].includes(orderStatus));
  const canReschedule = Boolean(
    order &&
      ["paid", "scheduled"].includes(orderStatus) &&
      !["in_progress", "done", "inspected"].includes(String(job?.status ?? "")) &&
      !["warranty", "issue", "completed", "done", "canceled"].includes(orderStatus)
  );
  const afterMedia = asArray(order?.media).filter((media: any) => media.type === "after" && media.viewUrl);
  const scheduledAt = job?.scheduled_at ? new Date(job.scheduled_at) : reservation?.reserved_date ? new Date(`${reservation.reserved_date}T${reservation.time_slot === "afternoon" ? "13:00:00" : "09:00:00"}+09:00`) : null;
  const currentReservedDate = dateFromReservationOrJob(reservation, job);
  const currentReservedSlot = slotFromReservationOrJob(reservation, job);
  const technicianName = job?.technicians?.name ?? job?.technician?.name ?? "";
  const statusUx = getOrderStatusUx(orderStatus || order?.status);
  const statusGuidance = buildStatusGuidance({
    orderStatus: order?.status,
    jobStatus: job?.status ?? null,
    hasReservation: Boolean(reservation)
  });
  const paymentAmount = Number(payment?.amount ?? quote?.total_final ?? 0);
  const cancelPreview = useMemo(() => {
    if (!payment || !order) return { label: "취소 요청", refundRate: 0, refundAmount: 0, auto: false };
    const paidAt = new Date(payment.paid_at ?? payment.approved_at ?? payment.created_at ?? new Date());
    const hoursSincePaid = (Date.now() - paidAt.getTime()) / (1000 * 60 * 60);
    const daysUntilVisit = scheduledAt ? (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24) : null;
    if (hoursSincePaid <= 24 && (daysUntilVisit === null || daysUntilVisit >= 3)) {
      return { label: "전액 자동 환불", refundRate: 1, refundAmount: paymentAmount, auto: true };
    }
    if (daysUntilVisit !== null && daysUntilVisit >= 1) {
      return { label: "부분 환불 요청", refundRate: 0.5, refundAmount: Math.round(paymentAmount * 0.5), auto: false };
    }
    return { label: "관리자 확인 필요", refundRate: 0, refundAmount: 0, auto: false };
  }, [order, payment, paymentAmount, scheduledAt]);
  const selectedDay = slotDays[rescheduleDate];
  const selectedSlotInfo = selectedDay?.slots?.[rescheduleSlot];
  const sameAsCurrent = Boolean(currentReservedDate && rescheduleDate === currentReservedDate && rescheduleSlot === currentReservedSlot);
  const selectedSlotAvailable = Boolean(sameAsCurrent || selectedSlotInfo?.available);
  const completionVisitLabel = job?.scheduled_at
    ? dateLabel(job.scheduled_at)
    : reservation?.reserved_date
      ? `${dateLabel(reservation.reserved_date)} ${reservation.time_slot === "morning" ? "오전" : "오후"}`
      : "배정 중";
  const completionAmountLabel = payment?.amount
    ? formatKRW(Number(payment.amount))
    : quote?.total_final
      ? formatKRW(Number(quote.total_final))
      : "확인 중";

  useEffect(() => {
    if (!rescheduleOpen) return;
    const baseDateText = currentReservedDate || kstDateText(new Date(Date.now() + 24 * 60 * 60 * 1000));
    setRescheduleDate((current) => current || baseDateText);
    setRescheduleSlot(currentReservedSlot);
    setRescheduleMonth(new Date(`${baseDateText}T00:00:00`));
    setRescheduleMessage("");
  }, [currentReservedDate, currentReservedSlot, rescheduleOpen]);

  useEffect(() => {
    if (!rescheduleOpen) return;
    const controller = new AbortController();

    async function loadSlots() {
      setSlotLoading(true);
      setSlotError("");
      setSlotDays({});
      try {
        const { year, month } = monthParts(rescheduleMonth);
        const response = await fetch(`/api/slots?year=${year}&month=${month}`, {
          signal: controller.signal
        });
        const json = await response.json();
        if (!response.ok) throw new Error(customerErrorMessage(json?.error, "날짜 정보를 불러오지 못했습니다."));
        setSlotDays(json?.data?.days ?? {});
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSlotError(error instanceof Error ? error.message : "날짜 정보를 불러오지 못했습니다. 다시 시도해주세요.");
        }
      } finally {
        if (!controller.signal.aborted) setSlotLoading(false);
      }
    }

    void loadSlots();
    return () => controller.abort();
  }, [rescheduleMonth, rescheduleOpen]);

  async function shareStatusLink() {
    const url = currentPageLink();
    const title = `${order?.order_number ?? "주문"} 현황`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: "빌드어스케어 주문 현황 링크입니다.", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareMessage("주문 현황 링크를 복사했습니다. 카카오톡에 붙여넣어 공유해주세요.");
    } catch {
      setShareMessage("공유가 어려우면 현재 페이지 주소를 복사해 주세요.");
    }
  }

  async function submitFeedback(payload: {
    rating: number;
    nps: number;
    comment?: string;
    categories: Record<string, number>;
    score_time: number;
    score_quality: number;
    score_response: number;
    score_clean: number;
    score_price: number;
    would_recommend: boolean;
    would_repurchase: boolean;
  }) {
    setFeedbackLoading(true);
    setFeedbackMessage("");
    try {
      const response = await fetch(`/api/orders/${orderId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, accessToken })
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(customerErrorMessage(json?.error, "후기 제출을 다시 확인해주세요."));
      }
      setFeedbackOpen(false);
      setShowRecommendations(true);
      void track(EVENT_TYPES.FEEDBACK_SUBMITTED, { rating: payload.rating, nps: payload.nps }, { orderId });
      await loadOrder();
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "후기 제출을 다시 시도해주세요.");
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function submitWarranty() {
    setWarrantyLoading(true);
    setWarrantyMessage("");
    try {
      const response = await fetch(`/api/orders/${orderId}/warranty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, type: warrantyType, description: warrantyDescription.trim() })
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(customerErrorMessage(json?.error, "A/S 접수를 다시 확인해주세요."));
      }
      setWarrantyMessage("접수되었습니다. 영업일 1일 내 연락드립니다.");
      void track(EVENT_TYPES.WARRANTY_SUBMITTED, { type: warrantyType }, { orderId });
      await loadOrder();
    } catch (error) {
      setWarrantyMessage(error instanceof Error ? error.message : "A/S 접수를 다시 시도해주세요.");
    } finally {
      setWarrantyLoading(false);
    }
  }

  async function submitCancel() {
    setCancelLoading(true);
    setCancelMessage("");
    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, reason: cancelReason })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(customerErrorMessage(json?.error, "취소 요청을 다시 확인해주세요."));
      setCancelMessage(json?.data?.message ?? "취소 요청이 접수됐습니다.");
      await loadOrder();
    } catch (error) {
      setCancelMessage(error instanceof Error ? error.message : "취소 요청을 다시 시도해주세요.");
    } finally {
      setCancelLoading(false);
    }
  }

  async function submitReschedule() {
    if (!rescheduleDate || !selectedSlotAvailable) {
      setRescheduleMessage("예약 가능한 날짜와 시간대를 선택해주세요.");
      return;
    }

    setRescheduleLoading(true);
    setRescheduleMessage("");
    try {
      const response = await fetch(`/api/orders/${orderId}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          reservedDate: rescheduleDate,
          timeSlot: rescheduleSlot
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(customerErrorMessage(json?.error, "예약 변경을 다시 확인해주세요."));

      const jobAction = json?.data?.jobAction;
      const message =
        jobAction === "released"
          ? "예약이 변경되었습니다. 기사 배정이 조정되면 다시 안내드릴게요."
          : "예약이 변경되었습니다.";
      setRescheduleNotice(message);
      setRescheduleOpen(false);
      void track(EVENT_TYPES.RESERVATION_RESCHEDULED, {
        to_date: rescheduleDate,
        to_slot: rescheduleSlot,
        job_action: jobAction
      }, { orderId });
      await loadOrder();
    } catch (error) {
      setRescheduleMessage(error instanceof Error ? error.message : "예약 변경을 다시 시도해주세요.");
    } finally {
      setRescheduleLoading(false);
    }
  }

  if (state.loading) {
    return (
      <main className="order-status-page">
        <style>{orderStatusCss}</style>
        <section className="empty-state">
          <p>{state.message}</p>
        </section>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="order-status-page">
        <style>{orderStatusCss}</style>
        <section className="empty-state">
          <h1>{state.status === 404 ? "주문을 찾을 수 없어요" : "주문을 확인할 수 없어요"}</h1>
          <p>{state.message}</p>
          {state.status === 0 && (
            <button type="button" onClick={loadOrder}>
              다시 시도하기
            </button>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="order-status-page">
      <style>{orderStatusCss}</style>
      <section className="order-header">
        <p>주문번호: {order.order_number}</p>
        <h1>{serviceName(order)}</h1>
        <span>접수일: {dateLabel(order.created_at)}</span>
      </section>

      {paymentSuccess && (
        <section className="payment-success-card">
          <div className="payment-success-main">
            <span>주문 완료</span>
            <h2>주문이 완료됐습니다</h2>
            <p>기사 배정과 방문 안내를 이 페이지에서 확인할 수 있어요.</p>
            <dl>
              <div><dt>주문번호</dt><dd>{order.order_number}</dd></div>
              <div><dt>서비스</dt><dd>{serviceName(order)}</dd></div>
              <div><dt>예약일</dt><dd>{completionVisitLabel}</dd></div>
              <div><dt>결제금액</dt><dd>{completionAmountLabel}</dd></div>
            </dl>
            <ul className="status-guidance-list">
              <li>이 링크를 보관하면 주문 현황과 예약 변경을 다시 확인할 수 있습니다.</li>
              <li>기사 배정이 완료되면 등록하신 연락처로 안내드립니다.</li>
            </ul>
            <div className="payment-success-actions">
              <a href="#order-current-status">주문 현황 확인하기</a>
              <button type="button" onClick={shareStatusLink}>주문 링크 공유하기</button>
            </div>
            {shareMessage && <small>{shareMessage}</small>}
          </div>
          <aside className="order-success-contact" aria-label="카카오 상담 안내">
            <div className="order-success-contact-copy">
              <strong>궁금한 점이 있나요?</strong>
              <p>예약 변경이나 현장 요청은 카톡 상담으로 빠르게 남길 수 있어요.</p>
            </div>
            {kakaoUrl ? (
              <>
                <div className="order-success-qr" aria-label="카카오 상담 QR 코드">
                  <img src="/kakao-channel-qr.png" alt="카카오 상담 채널 QR 코드" />
                  <span>PC에서는 QR로 상담 열기</span>
                </div>
                <a className="order-success-kakao-mobile-link" href={kakaoChatUrl ?? kakaoUrl} target="_blank" rel="noreferrer">카톡 상담하기</a>
              </>
            ) : (
              <button className="order-success-kakao-mobile-link" type="button" disabled>카톡 상담 준비 중</button>
            )}
          </aside>
        </section>
      )}

      <section className="order-trust-strip" aria-label="주문 확인 안내">
        <div>
          <strong>안전한 주문 링크</strong>
          <span>고객 전용 토큰으로만 조회돼요</span>
        </div>
        <div>
          <strong>개인정보 보호</strong>
          <span>전화번호와 주소는 자동으로 가려져요</span>
        </div>
        <div>
          <strong>1년 A/S</strong>
          <span>검수 완료 후 A/S 신고까지 이어져요</span>
        </div>
      </section>

      <div id="order-current-status">
        <OrderCurrentStatusPanel order={order} job={job} reservation={reservation} payment={payment} quote={quote} serviceName={serviceName(order)} />
      </div>
      <section className="order-card next-happens-card">
        <span>다음에 일어나는 일</span>
        <h2>{nextHappensForStatus(orderStatus || order.status).title}</h2>
        <ul>
          {nextHappensForStatus(orderStatus || order.status).items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {orderStatus === "done" && (
          <button type="button" onClick={() => setWarrantyOpen(true)}>
            A/S 신고하기
          </button>
        )}
      </section>
      <NextActionCard
        orderStatus={orderStatus || order.status}
        canCancel={canCancel}
        canReschedule={canReschedule}
        showFeedback={showFeedbackCta}
        kakaoUrl={kakaoUrl}
        onFeedback={() => setFeedbackOpen(true)}
        onWarranty={() => setWarrantyOpen(true)}
        onCancel={() => setCancelOpen(true)}
        onReschedule={() => setRescheduleOpen(true)}
        onShare={() => void shareStatusLink()}
      />
      {shareMessage && <p className="order-inline-message">{shareMessage}</p>}

      <StatusTimeline status={order.status} jobStatus={job?.status ?? null} scheduledAt={job?.scheduled_at ?? reservation?.reserved_date} />
      <section className="order-card">
        <h2>주문 기본 정보</h2>
        <dl className="summary-list">
          <div><dt>주문번호</dt><dd>{order.order_number}</dd></div>
          <div><dt>서비스</dt><dd>{serviceName(order)}</dd></div>
          <div><dt>주소</dt><dd>{order.home?.address_full ?? "주소 확인 중"}</dd></div>
          <div><dt>접수일</dt><dd>{formatKRDateTime(order.created_at)}</dd></div>
        </dl>
      </section>
      <QuoteSummary quote={quote} payment={payment} />
      <ReservationCard job={job} reservation={reservation} address={order.home?.address_full} servicePhone={servicePhone} />
      <TechnicianProfileCard job={job} />
      {order.status === "cancel_requested" && (
        <section className="order-card cancel-pending-card">
          <h2>취소 요청 처리 중</h2>
          <p className="order-help-text">취소 요청이 접수됐습니다. 담당자가 확인 후 1영업일 내 처리해드립니다.</p>
          <p className="order-help-text">문의: {servicePhone ?? "대표번호 준비 중"}</p>
        </section>
      )}

      {orderStatus === "canceled" && (
        <section className="order-card cancel-pending-card">
          <h2>주문이 취소됐습니다</h2>
          <p className="order-help-text">환불은 카드사 기준 3~5영업일 내 처리됩니다.</p>
        </section>
      )}

      {["paid", "scheduled", "in_progress", "completed", "done"].includes(orderStatus) && (
        <section className="order-card">
          <h2>예약 변경/취소 안내</h2>
          <p className="order-help-text">예약 변경은 가능한 날짜와 시간대를 직접 선택할 수 있고, 취소는 환불 정책에 따라 요청할 수 있습니다.</p>
          {rescheduleNotice && <p className="inline-success">{rescheduleNotice}</p>}
          <div className="reservation-action-row">
            {canReschedule && (
              <button className="reschedule-order-button" type="button" onClick={() => setRescheduleOpen(true)} disabled={slotLoading}>
                {slotLoading ? "변경 가능 시간 확인 중..." : "예약 변경"}
              </button>
            )}
            {canCancel && <button className="cancel-order-button" type="button" onClick={() => setCancelOpen(true)}>예약 취소하기</button>}
            {kakaoChatUrl ? <a className="inline-link-button" href={kakaoChatUrl} target="_blank" rel="noreferrer">카카오 상담으로 문의하기</a> : <p className="order-help-text">문의: {servicePhone ?? "대표번호 준비 중"}</p>}
          </div>
        </section>
      )}

      {orderStatus === "done" && afterMedia.length > 0 && (
        <section className="order-card">
          <h2>시공 사진</h2>
          <div className="after-photo-grid">
            {afterMedia.map((media: any) => (
              <img key={media.id} src={media.viewUrl} alt="시공 완료 사진" />
            ))}
          </div>
        </section>
      )}

      {showFeedbackCta && (
        <section className="order-card feedback-cta">
          <h2>시공은 만족스러우셨나요?</h2>
          <p>후기를 남겨주시면 다음 고객에게 큰 도움이 됩니다.</p>
          <button type="button" onClick={() => setFeedbackOpen(true)}>
            별점 남기기
          </button>
        </section>
      )}

      {(showRecommendations || (feedbackExists && orderStatus === "done")) && <RelatedServices serviceCode={serviceCode(order)} />}

      <FeedbackModal open={feedbackOpen} loading={feedbackLoading} message={feedbackMessage} onClose={() => setFeedbackOpen(false)} onSubmit={submitFeedback} />
      {rescheduleOpen && (
        <div className="feedback-backdrop" onMouseDown={() => setRescheduleOpen(false)} role="presentation">
          <form
            className="feedback-modal reschedule-modal"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void submitReschedule();
            }}
          >
            <div className="feedback-header">
              <div>
                <strong>예약 변경</strong>
                <p>예약 변경 시 기존 기사 배정이 조정될 수 있습니다.</p>
              </div>
              <button type="button" onClick={() => setRescheduleOpen(false)}>
                닫기
              </button>
            </div>

            <div className="reschedule-current">
              <span>현재 예약</span>
              <strong>
                {currentReservedDate ? `${dateLabel(currentReservedDate)} ${currentReservedSlot === "afternoon" ? "오후" : "오전"}` : "예약 정보 확인 중"}
              </strong>
              <p>{technicianName ? `담당 기사: ${technicianName}` : "담당 기사 배정 전입니다."}</p>
            </div>

            <div className="reschedule-calendar-head">
              <button
                type="button"
                onClick={() => setRescheduleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              >
                이전
              </button>
              <strong>{monthTitle(rescheduleMonth)}</strong>
              <button
                type="button"
                onClick={() => setRescheduleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              >
                다음
              </button>
            </div>

            {slotError ? (
              <div className="reschedule-error">
                <p>{slotError}</p>
                <button type="button" onClick={() => setRescheduleMonth((current) => new Date(current))}>
                  다시 시도
                </button>
              </div>
            ) : (
              <div className={`reschedule-calendar ${slotLoading ? "loading" : ""}`}>
                {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                  <span key={day} className="weekday">
                    {day}
                  </span>
                ))}
                {calendarDays(rescheduleMonth).map((day, index) => {
                  if (!day) return <span key={`blank-${index}`} className="blank" />;
                  const dayInfo = slotDays[day];
                  const isCurrentDay = day === currentReservedDate;
                  const isDisabled = slotLoading || (!isCurrentDay && (!dayInfo || dayInfo.beforeMinDate || dayInfo.blocked || dayInfo.allFull));
                  return (
                    <button
                      key={day}
                      type="button"
                      className={[
                        "calendar-day",
                        rescheduleDate === day ? "selected" : "",
                        isDisabled ? "disabled" : "",
                        dayInfo?.blocked ? "blocked" : "",
                        dayInfo?.allFull ? "full" : ""
                      ].join(" ")}
                      disabled={isDisabled}
                      onClick={() => {
                        setRescheduleDate(day);
                        const nextSlot = dayInfo?.slots?.morning?.available || (isCurrentDay && currentReservedSlot === "morning") ? "morning" : "afternoon";
                        setRescheduleSlot(nextSlot);
                      }}
                    >
                      <span>{Number(day.slice(-2))}</span>
                      {dayInfo?.allFull && <small>마감</small>}
                      {dayInfo?.blocked && <small>차단</small>}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="reschedule-slot-grid">
              {(["morning", "afternoon"] as const).map((slot) => {
                const slotInfo = slotDays[rescheduleDate]?.slots?.[slot];
                const slotIsCurrent = rescheduleDate === currentReservedDate && slot === currentReservedSlot;
                const disabled = slotLoading || (!slotIsCurrent && !slotInfo?.available);
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`reschedule-slot ${rescheduleSlot === slot ? "selected" : ""} ${disabled ? "disabled" : ""}`}
                    disabled={disabled}
                    onClick={() => setRescheduleSlot(slot)}
                  >
                    <strong>{slot === "morning" ? "오전" : "오후"}</strong>
                    <span>
                      {slotInfo ? `${slotInfo.usedCount}/${slotInfo.maxCount}` : slotLoading ? "확인 중" : "선택 불가"}
                      {!slotIsCurrent && slotInfo?.isFull ? " 마감" : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            {rescheduleMessage && <p className="feedback-message">{rescheduleMessage}</p>}
            <button className="submit-feedback" type="submit" disabled={rescheduleLoading || !selectedSlotAvailable}>
              {rescheduleLoading ? "변경 중..." : "변경하기"}
            </button>
          </form>
        </div>
      )}
      {warrantyOpen && (
        <div className="feedback-backdrop" onMouseDown={() => setWarrantyOpen(false)} role="presentation">
          <form
            className="feedback-modal"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void submitWarranty();
            }}
          >
            <div className="feedback-header">
              <div>
                <strong>A/S 신고하기</strong>
                <p>시공 후 불편한 점을 남겨주시면 확인 후 연락드릴게요.</p>
              </div>
              <button type="button" onClick={() => setWarrantyOpen(false)}>
                닫기
              </button>
            </div>
            <div className="warranty-type-grid">
              {[
                ["leak", "누수"],
                ["falling", "탈락"],
                ["noise", "소음"],
                ["other", "기타"]
              ].map(([value, label]) => (
                <label key={value} className={warrantyType === value ? "selected" : ""}>
                  <input type="radio" name="warrantyType" value={value} checked={warrantyType === value} onChange={() => setWarrantyType(value as typeof warrantyType)} />
                  {label}
                </label>
              ))}
            </div>
            <label>
              설명
              <textarea required value={warrantyDescription} onChange={(event) => setWarrantyDescription(event.target.value)} placeholder="어떤 문제가 있는지 적어주세요." />
            </label>
            {warrantyMessage && <p className="feedback-message">{warrantyMessage}</p>}
            <button className="submit-feedback" type="submit" disabled={warrantyLoading || !warrantyDescription.trim()}>
              A/S 접수하기
            </button>
          </form>
        </div>
      )}
      {cancelOpen && (
        <div className="feedback-backdrop" onMouseDown={() => setCancelOpen(false)} role="presentation">
          <form
            className="feedback-modal"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void submitCancel();
            }}
          >
            <div className="feedback-header">
              <div>
                <strong>예약을 취소하시겠습니까?</strong>
                <p>환불 정책에 따라 자동 또는 관리자 확인으로 처리됩니다.</p>
              </div>
              <button type="button" onClick={() => setCancelOpen(false)}>닫기</button>
            </div>
            <div className="cancel-preview-card">
              <strong>{cancelPreview.label}</strong>
              <p>
                환불 예상 금액: <b>{formatKRW(cancelPreview.refundAmount)}</b>
                {cancelPreview.refundRate > 0 ? ` (${Math.round(cancelPreview.refundRate * 100)}%)` : ""}
              </p>
              <small>
                {cancelPreview.auto ? "카드 환불은 영업일 기준 3~5일 소요됩니다." : "취소 요청 후 1영업일 내 담당자가 처리합니다."}
              </small>
            </div>
            <fieldset className="cancel-reason-list">
              <legend>취소 사유</legend>
              {["일정이 변경됐어요", "다른 업체를 이용하기로 했어요", "제품을 직접 구매했어요", "기타"].map((reason) => (
                <label key={reason} className={cancelReason === reason ? "selected" : ""}>
                  <input type="radio" name="cancelReason" value={reason} checked={cancelReason === reason} onChange={() => setCancelReason(reason)} />
                  {reason}
                </label>
              ))}
            </fieldset>
            {cancelMessage && <p className="feedback-message">{cancelMessage}</p>}
            <button className="submit-feedback cancel-submit" type="submit" disabled={cancelLoading}>
              {cancelLoading ? "취소 처리 중..." : "예약 취소 확인"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

const RELATED_SERVICES: Record<string, string[]> = {
  toilet_replace: ["faucet_replace", "bidet_install"],
  faucet_replace: ["toilet_replace", "drain_clog"],
  kitchen_faucet: ["drain_clog", "toilet_replace"],
  light_replace: ["outlet_replace", "ventilator_replace"],
  outlet_replace: ["light_replace", "door_handle"],
  door_handle: ["toilet_replace", "light_replace"],
  bidet_install: ["toilet_replace", "faucet_replace"],
  ventilator_replace: ["light_replace", "toilet_replace"],
  drain_clog: ["faucet_replace", "partial_wallpaper"],
  partial_wallpaper: ["door_handle", "light_replace"]
};

function serviceCode(order: any) {
  return order?.service_type_code ?? order?.skus?.[0]?.sku ?? order?.skus?.[0]?.service_type_code ?? "toilet_replace";
}

function RelatedServices({ serviceCode }: { serviceCode: string }) {
  const services = RELATED_SERVICES[serviceCode] ?? ["toilet_replace", "faucet_replace"];
  return (
    <section className="order-card related-services">
      <h2>후기 감사합니다!</h2>
      <p>다음에 함께 많이 찾는 시공도 바로 견적을 확인하실 수 있어요.</p>
      <div className="related-service-grid">
        {services.map((code) => (
          <a key={code} href={`/quote/${code}`}>
            <strong>{SERVICE_NAME_BY_CODE[code] ?? code}</strong>
            <small>{code === "partial_wallpaper" ? "상담 후 안내" : "30분-1시간"}</small>
            <span>견적 받기</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function TechnicianProfileCard({ job }: { job?: any | null }) {
  const technician = job?.technicians ?? job?.technician ?? null;
  if (!technician?.name) return null;

  const specialties = Array.isArray(technician.specialties) ? technician.specialties.filter(Boolean) : [];
  const experienceYears = Number(technician.experience_years ?? 0);

  return (
    <section className="order-card technician-profile-card">
      <h2>담당 기사</h2>
      <div className="technician-profile">
        {technician.profile_image_url ? (
          <img src={technician.profile_image_url} alt={`${technician.name} 기사 프로필`} />
        ) : (
          <span className="technician-avatar" aria-hidden="true">{String(technician.name).slice(0, 1)}</span>
        )}
        <div>
          <strong>
            {technician.name} 기사님
            {experienceYears > 0 && <small>경력 {experienceYears}년</small>}
          </strong>
          {specialties.length > 0 && <p>전문: {specialties.join(", ")}</p>}
          {technician.bio && <blockquote>{technician.bio}</blockquote>}
          <p>연락처: {technician.phone ?? "방문 전 안내 예정"}</p>
        </div>
      </div>
    </section>
  );
}

const orderStatusCss = `
  .order-status-page {
    min-height: 100vh;
    background: var(--color-bg);
    color: var(--color-text);
    padding: 18px 18px 80px;
    font-family: var(--font-body);
  }
  .order-header,
  .order-card,
  .empty-state {
    width: min(780px, 100%);
    margin: 0 auto 14px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 18px;
    box-sizing: border-box;
  }
  .order-header p,
  .order-header span,
  .empty-state p,
  .feedback-cta p {
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.5;
  }
  .order-header h1 {
    margin: 8px 0;
    font-size: clamp(28px, 5vw, 44px);
    letter-spacing: 0;
  }
  .order-trust-strip {
    width: min(780px, 100%);
    margin: 0 auto 14px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .order-current-panel {
    width: min(780px, 100%);
    margin: 0 auto 14px;
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(220px, 0.9fr);
    overflow: hidden;
    border: 1px solid rgba(26, 107, 90, 0.2);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
  }
  .order-current-main {
    display: grid;
    align-content: center;
    gap: 8px;
    padding: 24px;
    background: var(--color-primary-highlight);
  }
  .order-current-main span,
  .next-action-card > span {
    color: var(--color-primary);
    font-size: var(--text-xs);
    font-weight: 900;
  }
  .order-current-main h2,
  .next-action-card h2 {
    margin: 0;
    font-size: var(--text-lg);
    line-height: 1.25;
    letter-spacing: 0;
  }
  .order-current-main p,
  .next-action-card p {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.55;
  }
  .order-current-panel dl {
    display: grid;
    align-content: center;
    gap: 0;
    margin: 0;
    padding: 18px;
  }
  .order-current-panel dl div {
    display: grid;
    gap: 5px;
    border-bottom: 1px solid var(--color-border);
    padding: 12px 0;
  }
  .order-current-panel dl div:last-child {
    border-bottom: 0;
  }
  .order-current-panel dt {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 900;
  }
  .order-current-panel dd {
    margin: 0;
    font-weight: 900;
    overflow-wrap: anywhere;
  }
  .next-action-card {
    display: grid;
    gap: 10px;
    border-color: rgba(26, 107, 90, 0.2);
  }
  .next-happens-card button {
    width: fit-content;
    min-height: 42px;
    border: 0;
    border-radius: var(--radius-full);
    padding: 0 16px;
    background: var(--color-primary);
    color: #fff;
    font-weight: 900;
    cursor: pointer;
  }
  .next-happens-card {
    display: grid;
    gap: 8px;
    border-color: rgba(26, 107, 90, 0.14);
  }
  .next-happens-card > span {
    width: fit-content;
    border-radius: var(--radius-full);
    padding: 2px 8px;
    background: var(--color-surface-2);
    color: var(--color-primary);
    font-size: var(--text-xs);
    font-weight: 900;
  }
  .next-happens-card h2 {
    margin: 0;
    font-size: var(--text-lg);
    line-height: 1.25;
  }
  .next-happens-card ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .next-happens-card li {
    position: relative;
    padding-left: 18px;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .next-happens-card li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0.72em;
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--color-primary);
  }
  .next-action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .next-action-buttons button,
  .next-action-buttons a,
  .order-inline-message {
    min-height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--radius-full);
    padding: 0 16px;
    background: var(--color-primary);
    color: #fff;
    text-decoration: none;
    font-weight: 900;
  }
  .next-action-buttons .secondary,
  .next-action-buttons a {
    border: 1px solid var(--color-border);
    background: #fff;
    color: var(--color-text);
  }
  .order-inline-message {
    width: min(780px, 100%);
    margin: 0 auto 14px;
    min-height: 0;
    justify-content: flex-start;
    border-radius: var(--radius-md);
    padding: 12px 14px;
    background: var(--color-primary-highlight);
    color: var(--color-primary);
  }
  .payment-success-card {
    width: min(780px, 100%);
    margin: 0 auto 14px;
    display: grid;
    gap: 14px;
    border: 1px solid rgba(26, 107, 90, 0.18);
    border-radius: var(--radius-lg);
    background: var(--color-primary-highlight);
    padding: 20px;
    box-sizing: border-box;
  }
  .payment-success-main {
    display: grid;
    align-content: start;
    gap: 12px;
  }
  .payment-success-main > span {
    width: fit-content;
    border-radius: var(--radius-full);
    padding: 5px 10px;
    background: #fff;
    color: var(--color-primary);
    font-size: var(--text-xs);
    font-weight: 900;
  }
  .payment-success-card h2 {
    margin: 0;
    font-size: clamp(26px, 4vw, 38px);
    line-height: 1.15;
    letter-spacing: 0;
  }
  .payment-success-card dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }
  .payment-success-card dl div {
    display: grid;
    gap: 5px;
    border: 1px solid rgba(26, 107, 90, 0.12);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.54);
  }
  .payment-success-card dt,
  .payment-success-card dd {
    margin: 0;
  }
  .payment-success-card dt {
    color: var(--color-text-muted);
  }
  .payment-success-card dd {
    font-weight: 900;
    text-align: left;
    overflow-wrap: anywhere;
  }
  .payment-success-card p,
  .payment-success-card small,
  .order-help-text {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.55;
  }
  .payment-success-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .payment-success-actions a,
  .payment-success-actions button,
  .order-success-contact a,
  .order-success-contact button,
  .inline-link-button,
  .reschedule-order-button,
  .cancel-order-button {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--radius-full);
    padding: 0 16px;
    background: var(--color-primary);
    color: #fff;
    text-decoration: none;
    font-weight: 900;
  }
  .payment-success-actions button {
    background: #fff;
    color: var(--color-primary);
    border: 1px solid rgba(26, 107, 90, 0.24);
  }
  .order-success-contact {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 12px;
    border-top: 1px solid rgba(26, 107, 90, 0.14);
    padding-top: 14px;
    text-align: left;
  }
  .order-success-contact-copy {
    display: grid;
    gap: 4px;
  }
  .order-success-contact strong {
    font-size: var(--text-sm);
    font-weight: 900;
  }
  .order-success-contact p {
    font-size: var(--text-sm);
  }
  .order-success-contact a {
    min-width: 142px;
  }
  .order-success-contact button {
    min-width: 150px;
    background: #fff;
    color: var(--color-text-muted);
    border: 1px solid rgba(26, 107, 90, 0.18);
    cursor: not-allowed;
  }
  .order-success-qr {
    display: grid;
    justify-items: center;
    gap: 6px;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 800;
    white-space: nowrap;
  }
  .order-success-qr img {
    width: 88px;
    height: 88px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: #fff;
  }
  .order-success-kakao-mobile-link {
    display: none !important;
  }
  .reservation-action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .cancel-order-button {
    background: #fff;
    color: #991b1b;
    border: 1px solid #fecaca;
  }
  .reschedule-order-button {
    background: var(--color-primary);
    color: #fff;
  }
  .reschedule-order-button:disabled,
  .calendar-day:disabled,
  .reschedule-slot:disabled,
  .submit-feedback:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .inline-success {
    margin: 12px 0 0;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: #dcfce7;
    color: #166534;
    font-weight: 900;
  }
  .cancel-pending-card {
    border-color: #fed7aa;
    background: #fff7ed;
  }
  .cancel-preview-card {
    display: grid;
    gap: 6px;
    border: 1px solid #fed7aa;
    border-radius: var(--radius-md);
    background: #fff7ed;
    padding: 14px;
  }
  .cancel-preview-card p,
  .cancel-preview-card small {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.5;
  }
  .cancel-reason-list {
    display: grid;
    gap: 8px;
    border: 0;
    padding: 0;
    margin: 0;
  }
  .cancel-reason-list legend {
    margin-bottom: 6px;
    color: var(--color-text-muted);
    font-weight: 900;
  }
  .cancel-reason-list label {
    min-height: 46px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #d9ded2;
    border-radius: var(--radius-md);
    padding: 0 12px;
    font-weight: 800;
  }
  .cancel-reason-list label.selected {
    border-color: #991b1b;
    background: #fef2f2;
    color: #991b1b;
  }
  .cancel-submit {
    background: #991b1b;
  }
  .reschedule-modal {
    width: min(620px, 100%);
  }
  .reschedule-current {
    display: grid;
    gap: 5px;
    border: 1px solid rgba(26, 107, 90, 0.16);
    border-radius: var(--radius-md);
    background: var(--color-primary-highlight);
    padding: 14px;
  }
  .reschedule-current span,
  .reschedule-current p {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.5;
  }
  .reschedule-current strong {
    font-size: var(--text-base);
  }
  .reschedule-calendar-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .reschedule-calendar-head button,
  .reschedule-error button {
    min-height: 40px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    padding: 0 12px;
    background: #fff;
    color: var(--color-text);
    font-weight: 900;
  }
  .reschedule-calendar {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
  }
  .reschedule-calendar.loading {
    opacity: 0.62;
  }
  .weekday,
  .blank,
  .calendar-day {
    min-height: 42px;
  }
  .weekday {
    display: grid;
    place-items: center;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 900;
  }
  .calendar-day {
    position: relative;
    display: grid;
    place-items: center;
    gap: 2px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: #fff;
    color: var(--color-text);
    font-weight: 900;
  }
  .calendar-day.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-highlight);
    color: var(--color-primary);
  }
  .calendar-day.disabled {
    background: #f4f3f0;
    color: var(--color-text-faint);
  }
  .calendar-day.full small {
    color: #991b1b;
  }
  .calendar-day.blocked {
    background: repeating-linear-gradient(135deg, #f4f3f0, #f4f3f0 5px, #e8e5e0 5px, #e8e5e0 10px);
  }
  .calendar-day small {
    font-size: 10px;
  }
  .reschedule-slot-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .reschedule-slot {
    min-height: 72px;
    display: grid;
    gap: 5px;
    place-items: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: #fff;
    color: var(--color-text);
  }
  .reschedule-slot.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-highlight);
    color: var(--color-primary);
  }
  .reschedule-slot.disabled {
    background: #f4f3f0;
    color: var(--color-text-faint);
  }
  .reschedule-slot span {
    font-size: var(--text-xs);
    font-weight: 900;
  }
  .reschedule-error {
    display: grid;
    gap: 10px;
    border: 1px solid #fecaca;
    border-radius: var(--radius-md);
    background: #fef2f2;
    padding: 14px;
  }
  .reschedule-error p {
    margin: 0;
    color: #991b1b;
    font-weight: 800;
  }
  .state-guide {
    margin-top: 8px !important;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: rgba(255,255,255,0.72);
    color: var(--color-text) !important;
    font-weight: 800;
  }
  .status-guidance-list {
    display: grid;
    gap: 8px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }
  .status-guidance-list li {
    padding-left: 14px;
    position: relative;
    color: var(--color-text);
    font-size: var(--text-sm);
    font-weight: 800;
    line-height: 1.5;
  }
  .status-guidance-list li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 9px;
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--color-primary);
  }
  .order-trust-strip div {
    min-height: 86px;
    display: grid;
    align-content: center;
    gap: 5px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 14px;
    box-shadow: var(--shadow-sm);
    box-sizing: border-box;
  }
  .order-trust-strip strong {
    font-size: var(--text-sm);
    font-weight: 900;
  }
  .order-trust-strip span {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    line-height: 1.45;
  }
  .order-overview-panel {
    width: min(780px, 100%);
    margin: 0 auto 14px;
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
    gap: 0;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
  .order-overview-panel > div {
    min-height: 180px;
    display: grid;
    align-content: center;
    gap: 8px;
    padding: 24px;
    background: var(--color-surface-2);
  }
  .order-overview-panel span {
    color: var(--color-primary);
    font-size: var(--text-xs);
    font-weight: 900;
  }
  .order-overview-panel strong {
    font-size: var(--text-lg);
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .order-overview-panel p {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.55;
  }
  .order-overview-panel dl {
    display: grid;
    align-content: center;
    gap: 0;
    margin: 0;
    padding: 18px;
  }
  .order-overview-panel dl div {
    display: grid;
    gap: 4px;
    padding: 12px 0;
    border-bottom: 1px solid var(--color-border);
  }
  .order-overview-panel dl div:last-child {
    border-bottom: 0;
  }
  .order-overview-panel dt,
  .order-overview-panel dd {
    margin: 0;
  }
  .order-overview-panel dt {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 800;
  }
  .order-overview-panel dd {
    font-weight: 900;
    overflow-wrap: anywhere;
  }
  .order-card h2 {
    margin: 0 0 14px;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-muted);
  }
  .timeline-current-summary {
    margin: 0 0 18px;
    padding: 14px;
    border-radius: var(--radius-md);
    background: var(--color-primary-highlight);
    border: 1px solid rgba(26, 107, 90, 0.18);
  }
  .timeline-current-summary strong {
    display: block;
    color: var(--color-primary);
    font-size: var(--text-base);
    font-weight: 900;
    line-height: 1.35;
  }
  .timeline-current-summary p {
    margin: 6px 0 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: 1.5;
  }
  .timeline-current-summary small {
    display: inline-flex;
    margin-top: 8px;
    color: var(--color-primary);
    font-size: var(--text-xs);
    font-weight: 900;
  }
  .status-timeline {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 12px;
  }
  .status-timeline li {
    position: relative;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }
  .status-timeline li:not(:last-child)::before {
    content: "";
    position: absolute;
    left: 14px;
    top: 32px;
    bottom: -12px;
    width: 2px;
    background: var(--color-border);
  }
  .status-timeline li.done:not(:last-child)::before {
    background: var(--color-primary);
  }
  .status-timeline li span {
    position: relative;
    z-index: 1;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    border: 2px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-faint);
    font-weight: 900;
    font-size: 11px;
  }
  .status-timeline li p {
    margin: 0;
    color: var(--color-text-faint);
    font-weight: 800;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
  .status-timeline li.done span {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: #fff;
  }
  .status-timeline li.done p,
  .status-timeline li.current p {
    color: var(--color-text);
  }
  .status-timeline li.current span {
    border-color: var(--color-primary);
    background: var(--color-surface);
    color: transparent;
    animation: pulseDot 1.3s infinite;
  }
  .status-timeline li.current span::after {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--color-primary);
  }
  @keyframes pulseDot {
    0%, 100% { box-shadow: 0 0 0 0 rgba(26, 107, 90, 0.35); }
    50% { box-shadow: 0 0 0 8px rgba(26, 107, 90, 0); }
  }
  .inline-warning {
    margin: 14px 0 0;
    padding: 12px;
    border-radius: 8px;
    background: #fff4dd;
    color: #7a4b00;
    font-weight: 800;
  }
  .summary-list {
    display: grid;
    gap: 10px;
    margin: 0;
  }
  .summary-list div {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    border-bottom: 1px solid var(--color-border);
    padding: 10px 0;
  }
  .summary-list dt,
  .summary-list dd {
    margin: 0;
  }
  .summary-list dt {
    color: var(--color-text-muted);
  }
  .summary-list dd {
    text-align: right;
    font-weight: 900;
    overflow-wrap: anywhere;
  }
  .after-photo-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .after-photo-grid img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: var(--radius-md);
  }
  .feedback-cta button,
  .as-card a,
  .as-card button,
  .empty-state button,
  .submit-feedback {
    min-height: 56px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--radius-full);
    padding: 0 18px;
    margin-top: 12px;
    background: var(--color-primary);
    color: #fff;
    text-decoration: none;
    font-weight: 900;
  }
  .as-card button:disabled {
    background: var(--color-surface-2);
    color: var(--color-text-faint);
    cursor: not-allowed;
  }
  .as-card {
    display: grid;
    gap: 10px;
  }
  .as-card a,
  .as-card button {
    margin-top: 0;
  }
  .related-services {
    display: grid;
    gap: 10px;
    background: var(--color-primary-highlight);
  }
  .related-services p {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.5;
  }
  .related-service-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .related-service-grid a {
    min-height: 96px;
    display: grid;
    gap: 6px;
    align-content: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 14px;
    background: #fff;
    color: var(--color-text);
    text-decoration: none;
  }
  .related-service-grid strong,
  .related-service-grid span {
    font-weight: 900;
  }
  .related-service-grid small {
    color: var(--color-text-muted);
  }
  .related-service-grid span {
    color: var(--color-primary);
  }
  .technician-profile-card {
    border-color: rgba(26, 107, 90, 0.18);
  }
  .technician-profile {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }
  .technician-profile img,
  .technician-avatar {
    width: 64px;
    height: 64px;
    border-radius: 999px;
  }
  .technician-profile img {
    object-fit: cover;
    border: 1px solid var(--color-border);
  }
  .technician-avatar {
    display: grid;
    place-items: center;
    background: var(--color-primary-highlight);
    color: var(--color-primary);
    font-size: 26px;
    font-weight: 900;
  }
  .technician-profile strong {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: var(--text-base);
    font-weight: 900;
  }
  .technician-profile small {
    border-radius: var(--radius-full);
    padding: 3px 8px;
    background: var(--color-primary-highlight);
    color: var(--color-primary);
    font-size: var(--text-xs);
    font-weight: 900;
  }
  .technician-profile p,
  .technician-profile blockquote {
    margin: 8px 0 0;
    color: var(--color-text-muted);
    line-height: 1.55;
  }
  .technician-profile blockquote {
    border-left: 3px solid var(--color-primary);
    padding-left: 10px;
    color: var(--color-text);
    font-weight: 700;
  }
  .feedback-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 18px;
    background: rgba(0, 0, 0, 0.48);
  }
  .feedback-modal {
    width: min(560px, 100%);
    max-height: 88vh;
    overflow: auto;
    display: grid;
    gap: 14px;
    background: #fff;
    border-radius: 8px;
    padding: 18px;
  }
  .feedback-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .feedback-header p,
  .feedback-message {
    margin: 4px 0 0;
    color: #687166;
  }
  .feedback-header button {
    height: 40px;
    border: 1px solid #d9ded2;
    border-radius: 8px;
    background: #fff;
    font-weight: 900;
  }
  .star-row {
    display: flex;
    gap: 4px;
    margin-top: 8px;
  }
  .star-row button {
    border: 0;
    background: transparent;
    color: #c7cbbf;
    font-size: 30px;
  }
  .star-row button.on {
    color: #f7c948;
  }
  .category-score-list {
    display: grid;
    gap: 8px;
  }
  .category-score-list label {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }
  .feedback-checks {
    display: grid;
    gap: 8px;
  }
  .feedback-checks label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #28251d;
    font-weight: 800;
  }
  .feedback-checks input {
    width: 18px;
    height: 18px;
    margin: 0;
  }
  .warranty-type-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .warranty-type-grid label {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid #d9ded2;
    border-radius: 999px;
    color: #687166;
    font-weight: 900;
  }
  .warranty-type-grid label.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-highlight);
    color: var(--color-primary);
  }
  .warranty-type-grid input {
    display: none;
  }
  select,
  textarea,
  input {
    border: 1px solid #d9ded2;
    border-radius: 8px;
    padding: 10px;
    font-size: 16px;
  }
  textarea,
  input {
    width: 100%;
    box-sizing: border-box;
    margin-top: 8px;
  }
  .feedback-checks input[type="checkbox"] {
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    min-height: 18px;
    margin: 0;
    padding: 0;
  }
  .cancel-reason-list input[type="radio"] {
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    min-height: 18px;
    margin: 0;
    padding: 0;
  }
  textarea {
    min-height: 90px;
    resize: vertical;
  }
  @media (max-width: 640px) {
    .order-status-page {
      padding: 12px 12px 80px;
    }
    .order-trust-strip {
      grid-template-columns: 1fr;
    }
    .order-overview-panel {
      grid-template-columns: 1fr;
    }
    .order-current-panel {
      grid-template-columns: 1fr;
    }
    .payment-success-card {
      padding: 16px;
    }
    .payment-success-card dl {
      grid-template-columns: 1fr;
    }
    .payment-success-actions {
      display: grid;
    }
    .order-success-contact {
      grid-template-columns: 1fr;
      align-items: stretch;
    }
    .order-success-contact a,
    .order-success-contact button {
      width: 100%;
      min-width: 0;
    }
    .order-success-kakao-mobile-link {
      display: inline-flex !important;
    }
    .order-success-qr {
      display: none;
    }
    .next-action-buttons {
      display: grid;
    }
    .order-overview-panel > div {
      min-height: auto;
    }
    .summary-list div {
      display: grid;
    }
    .summary-list dd {
      text-align: left;
    }
    .after-photo-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .warranty-type-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`;
