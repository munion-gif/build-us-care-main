"use client";

type ReservationCardProps = {
  job?: Record<string, any> | null;
  reservation?: Record<string, any> | null;
  address?: string | null;
  servicePhone?: string | null;
};

function dateTimeLabel(value?: string | null) {
  if (!value) return "배정 중";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function slotLabel(slot?: string | null) {
  if (slot === "morning") return "오전 09:00-12:00";
  if (slot === "afternoon") return "오후 13:00-17:00";
  return slot ?? "시간 배정 중";
}

function contactLabel(job?: Record<string, any> | null, servicePhone?: string | null) {
  return job?.technicians?.phone ?? job?.technician?.phone ?? servicePhone ?? "대표번호 준비 중";
}

export function ReservationCard({ job, reservation, address, servicePhone }: ReservationCardProps) {
  const scheduledAt = job?.scheduled_at ?? job?.scheduled_date ?? reservation?.reserved_date ?? null;
  const technicianName = job?.technician?.name ?? job?.technicians?.name ?? job?.assigned_technician_name ?? "배정 중";

  return (
    <section className="order-card">
      <h2>예약 정보</h2>
      <dl className="summary-list">
        <div>
          <dt>방문 예정일</dt>
          <dd>{scheduledAt ? dateTimeLabel(scheduledAt) : "배정 중"}</dd>
        </div>
        <div>
          <dt>시간대</dt>
          <dd>{slotLabel(reservation?.time_slot)}</dd>
        </div>
        <div>
          <dt>담당 기사</dt>
          <dd>{technicianName}</dd>
        </div>
        <div>
          <dt>문의</dt>
          <dd>{contactLabel(job, servicePhone)}</dd>
        </div>
        <div>
          <dt>방문 주소</dt>
          <dd>{address ?? "주소 확인 중"}</dd>
        </div>
      </dl>
    </section>
  );
}
