"use client";

import { getOrderStatusLabel } from "@/lib/order-status-label";

type LookupOrder = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  serviceName: string;
  paymentStatus: string | null;
  isPaid: boolean;
  reservation: { reservedDate: string; timeSlot: string; status: string } | null;
  jobStatus: string | null;
  link: string;
};

type OrderLookupResultCardProps = {
  order: LookupOrder;
};

function slotLabel(slot?: string | null) {
  if (slot === "morning") return "오전";
  if (slot === "afternoon") return "오후";
  if (slot === "all_day") return "종일";
  return "미정";
}

function paymentLabel(order: LookupOrder) {
  if (order.paymentStatus === "done" || order.isPaid) return "결제 완료";
  if (order.paymentStatus === "failed") return "결제 실패";
  if (order.paymentStatus === "pending" || order.paymentStatus === "ready") return "결제 대기";
  return "결제 확인 중";
}

function reservationLabel(order: LookupOrder) {
  return order.reservation ? `${order.reservation.reservedDate} ${slotLabel(order.reservation.timeSlot)}` : "예약 확인 중";
}

export function OrderLookupResultCard({ order }: OrderLookupResultCardProps) {
  const status = getOrderStatusLabel({ orderStatus: order.status, jobStatus: order.jobStatus });

  return (
    <article className="lookup-order-card">
      <div className="lookup-order-main">
        <span className="lookup-order-number">{order.orderNumber}</span>
        <h3>{order.serviceName}</h3>
        <p className="lookup-order-summary">{reservationLabel(order)}</p>
        <div className="lookup-badges">
          <span>{status.label}</span>
          <span>{paymentLabel(order)}</span>
        </div>
      </div>
      <a className="lookup-link" href={order.link}>주문 상세 보기</a>
    </article>
  );
}
