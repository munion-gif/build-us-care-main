"use client";

import { useEffect, useMemo, useState } from "react";

type SlotPeriod = "morning" | "afternoon";
type SlotDay = {
  date: string;
  allFull: boolean;
  blocked: boolean;
  beforeMinDate: boolean;
  slots: Record<SlotPeriod, { available?: boolean; isFull: boolean; usedCount: number; maxCount: number }>;
};
type AdminJob = {
  id: string;
  status?: string | null;
  scheduled_at?: string | null;
  technicians?: { name?: string | null } | null;
  orders?: {
    id?: string | null;
    order_number?: string | null;
    status?: string | null;
    total_amount?: number | null;
    service_type_code?: string | null;
    skus?: any[] | null;
    customers?: { name?: string | null; phone?: string | null } | null;
    homes?: { address_full?: string | null; address_apt?: string | null } | null;
    quotes?: any[] | null;
  } | null;
};
type AdminManualQuote = {
  id: string;
  quote_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  address_text?: string | null;
  items?: any[] | null;
  total_final?: number | null;
  reserved_date?: string | null;
  time_slot?: SlotPeriod | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function monthLabel(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function kstDateOnly(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function kstSlot(value?: string | null): SlotPeriod | null {
  if (!value) return null;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date(value)));
  return hour < 13 ? "morning" : "afternoon";
}

function kstTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function slotLabel(period: SlotPeriod) {
  return period === "morning" ? "오전" : "오후";
}

function slotUsageLabel(slot: SlotDay["slots"][SlotPeriod] | undefined, label: string, fallbackCap: number) {
  if (!slot) return `${label} 확인 중`;
  const max = slot.maxCount ?? fallbackCap;
  return `${label} ${slot.usedCount ?? 0}/${max}`;
}

function formatKRW(amount?: number | null) {
  return `${Number(amount ?? 0).toLocaleString("ko-KR")}원`;
}

function asArray(value: any) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function latestQuote(order: AdminJob["orders"]) {
  return asArray(order?.quotes).sort((a: any, b: any) => String(b.accepted_at ?? b.created_at ?? "").localeCompare(String(a.accepted_at ?? a.created_at ?? "")))[0] ?? null;
}

function productSnapshot(line: any) {
  const metadata = line?.metadata ?? {};
  return metadata.selected_replacement_product_snapshot ?? metadata.selected_replacement_product ?? null;
}

function productLabel(line: any) {
  const product = productSnapshot(line);
  return [product?.brand, product?.model ?? product?.name].filter(Boolean).join(" ") || line?.item_name || line?.sku || "제품 확인";
}

function jobProductLabel(job: AdminJob) {
  const order = job.orders;
  const items = latestQuote(order)?.items;
  if (Array.isArray(items) && items.length > 0) {
    const first = items[0];
    return `${productLabel(first)}${items.length > 1 ? ` 외 ${items.length - 1}개` : ""}`;
  }
  const sku = Array.isArray(order?.skus) ? order?.skus?.[0] : null;
  return sku?.item_name ?? sku?.sku ?? order?.service_type_code ?? "제품 확인";
}

function jobAddress(job: AdminJob) {
  return [job.orders?.homes?.address_full, job.orders?.homes?.address_apt].filter(Boolean).join(" ") || "주소 미입력";
}

function jobCustomer(job: AdminJob) {
  return [job.orders?.customers?.name || "성함 없음", job.orders?.customers?.phone || "연락처 없음"].join(" · ");
}

function quoteProductLabel(quote: AdminManualQuote) {
  const items = Array.isArray(quote.items) ? quote.items : [];
  const first = items[0];
  const metadata = first?.metadata ?? {};
  const product = metadata.selected_replacement_product_snapshot ?? metadata.selected_replacement_product ?? null;
  const label = [product?.brand, product?.model ?? product?.name].filter(Boolean).join(" ") || first?.item_name || "견적 품목 확인";
  return `${label}${items.length > 1 ? ` 외 ${items.length - 1}개` : ""}`;
}

export function AdminSlotsClient({ localMode = false }: { localMode?: boolean }) {
  const [month, setMonth] = useState(() => new Date());
  const [days, setDays] = useState<Record<string, SlotDay>>({});
  const [cap, setCap] = useState(0);
  const [draftCap, setDraftCap] = useState("");
  const [capSource, setCapSource] = useState("no_active_technicians");
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [manualQuotes, setManualQuotes] = useState<AdminManualQuote[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const calendarDays = useMemo(() => buildCalendarDays(month), [month]);

  async function loadSlots(target = month) {
    const start = performance.now();
    setLoading(true);
    setMessage("");
    try {
      const startDate = toIsoDate(new Date(target.getFullYear(), target.getMonth(), 1));
      const endDate = toIsoDate(new Date(target.getFullYear(), target.getMonth() + 1, 1));
      const [slotsResponse, configResponse, jobsResponse, reservationsResponse] = await Promise.all([
        fetch(`/api/slots?year=${target.getFullYear()}&month=${target.getMonth() + 1}&fresh=1`, { cache: "no-store" }),
        fetch("/api/admin/slot-configs"),
        fetch(`/api/admin/jobs?date_from=${startDate}T00:00:00%2B09:00&date_to=${endDate}T00:00:00%2B09:00&limit=100`, { cache: "no-store" }),
        fetch(`/api/admin/slot-reservations?date_from=${startDate}&date_to=${endDate}`, { cache: "no-store" })
      ]);
      const slotsJson = await slotsResponse.json();
      const configJson = await configResponse.json();
      const jobsJson = await jobsResponse.json();
      const reservationsJson = await reservationsResponse.json();
      if (!slotsResponse.ok || !slotsJson.ok) throw new Error("슬롯 현황을 불러오지 못했습니다.");
      if (!configResponse.ok || !configJson.ok) throw new Error("슬롯 설정을 불러오지 못했습니다.");
      setDays(slotsJson.data?.days ?? {});
      const nextCap = Number(configJson.data?.cap ?? slotsJson.data?.effectiveMaxSlotsPerPeriod ?? 3);
      setCap(nextCap);
      setCapSource(configJson.data?.capSource ?? slotsJson.data?.capSource ?? "no_active_technicians");
      setDraftCap(configJson.data?.capSource === "manual" ? String(nextCap) : "");
      setJobs(jobsResponse.ok ? jobsJson.data?.jobs ?? [] : []);
      setManualQuotes(reservationsResponse.ok ? reservationsJson.data?.manualQuotes ?? [] : []);
    } catch (error) {
      setDays({});
      setJobs([]);
      setManualQuotes([]);
      setMessage(error instanceof Error ? error.message : "슬롯 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      console.log(`[perf] admin.slots.loadSlots: ${Math.round(performance.now() - start)}ms`);
    }
  }

  useEffect(() => {
    void loadSlots(month);
  }, [month]);

  function moveMonth(offset: number) {
    setDays({});
    setLoading(true);
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  async function toggleBlock(dateText: string) {
    if (localMode) {
      setMessage("로컬 확인 모드에서는 날짜 차단을 변경하지 않습니다.");
      return;
    }
    const day = days[dateText];
    setMessage("");
    const response = day?.blocked
      ? await fetch(`/api/admin/slot-configs/${dateText}`, { method: "DELETE" })
      : await fetch("/api/admin/slot-configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateText, reason: "관리자 차단" })
        });
    if (!response.ok) {
      setMessage("차단 상태를 변경하지 못했습니다.");
      return;
    }
    await loadSlots(month);
  }

  async function saveCap() {
    if (localMode) {
      setMessage("로컬 확인 모드에서는 슬롯 cap을 저장하지 않습니다.");
      return;
    }
    setMessage("");
    const nextCap = draftCap.trim() === "" ? 0 : Number(draftCap);
    if (!Number.isFinite(nextCap) || nextCap < 0) {
      setMessage("cap은 0 이상 숫자로 입력해주세요.");
      return;
    }
    const response = await fetch("/api/admin/slot-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "cap", cap_value: nextCap })
    });
    if (!response.ok) {
      setMessage("전체 cap을 저장하지 못했습니다.");
      return;
    }
    await loadSlots(month);
    setMessage(nextCap > 0 ? "전체 cap을 저장했습니다." : "활성 기사 수 기준 자동 설정으로 전환했습니다.");
  }

  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, Record<SlotPeriod, AdminJob[]>>();
    for (const job of jobs) {
      if (!job.scheduled_at || job.status === "cancelled") continue;
      const day = kstDateOnly(job.scheduled_at);
      const slot = kstSlot(job.scheduled_at);
      if (!slot) continue;
      if (!map.has(day)) map.set(day, { morning: [], afternoon: [] });
      map.get(day)![slot].push(job);
    }
    return map;
  }, [jobs]);

  const manualQuotesByDate = useMemo(() => {
    const map = new Map<string, Record<SlotPeriod, AdminManualQuote[]>>();
    for (const quote of manualQuotes) {
      const day = quote.reserved_date ? String(quote.reserved_date).slice(0, 10) : null;
      const slot = quote.time_slot;
      if (!day || (slot !== "morning" && slot !== "afternoon")) continue;
      if (!map.has(day)) map.set(day, { morning: [], afternoon: [] });
      map.get(day)![slot].push(quote);
    }
    return map;
  }, [manualQuotes]);

  const monthSummary = useMemo(() => {
    const currentMonthPrefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    const visibleDays = Object.values(days).filter((day) => day.date.startsWith(currentMonthPrefix));
    const orderCount = jobs.filter((job) => job.status !== "cancelled" && job.scheduled_at && kstDateOnly(job.scheduled_at).startsWith(currentMonthPrefix)).length;
    const quoteCount = manualQuotes.filter((quote) => quote.reserved_date?.startsWith(currentMonthPrefix)).length;
    const blockedCount = visibleDays.filter((day) => day.blocked).length;
    const fullSlotCount = visibleDays.reduce((sum, day) => sum + (day.slots.morning.isFull ? 1 : 0) + (day.slots.afternoon.isFull ? 1 : 0), 0);
    return { orderCount, quoteCount, blockedCount, fullSlotCount };
  }, [days, jobs, manualQuotes, month]);

  const selectedAssignments = selectedDate ? assignmentsByDate.get(selectedDate) : null;
  const selectedManualQuotes = selectedDate ? manualQuotesByDate.get(selectedDate) : null;

  return (
    <div className="adm-content">
      {localMode ? (
        <section className="adm-card adm-admin-warning" role="status">
          <strong>로컬 확인 모드입니다.</strong>
          <p>Supabase 연결 전에는 슬롯 cap 저장과 날짜 차단 변경을 비활성화합니다.</p>
        </section>
      ) : null}
      <section className="adm-card adm-section adm-slot-controls">
        <div>
          <h2 className="adm-section-title">전체 방문 cap</h2>
          <p className="adm-muted">날짜별 설정이 없으면 오전/오후 각각 이 값을 사용합니다. 현재 {cap}건입니다. ({capSource === "manual" ? "수동 설정" : capSource === "active_technicians" ? "활성 기사 수 자동 연동" : "활성 기사 없음"})</p>
        </div>
        <label className="adm-slot-cap">
          <span>슬롯당 최대 건수</span>
          <input className="adm-input" type="number" min={0} max={20} value={draftCap} placeholder="자동" onChange={(event) => setDraftCap(event.target.value)} disabled={localMode} />
        </label>
        <button className="adm-btn adm-btn-primary" type="button" onClick={saveCap} disabled={localMode}>
          {localMode ? "로컬에서 저장 불가" : "저장"}
        </button>
      </section>

      <section className="adm-card adm-section">
        <div className="adm-slot-summary-grid" aria-label="월별 일정 요약">
          <article>
            <span>제품 주문 예약</span>
            <strong>{monthSummary.orderCount}건</strong>
          </article>
          <article>
            <span>견적 희망 일정</span>
            <strong>{monthSummary.quoteCount}건</strong>
          </article>
          <article>
            <span>마감 시간대</span>
            <strong>{monthSummary.fullSlotCount}개</strong>
          </article>
          <article>
            <span>휴무/차단일</span>
            <strong>{monthSummary.blockedCount}일</strong>
          </article>
        </div>
        <div className="adm-slot-header">
          <button className="adm-btn adm-btn-secondary" type="button" onClick={() => moveMonth(-1)}>
            이전 달
          </button>
          <strong>{monthLabel(month)}</strong>
          <button className="adm-btn adm-btn-secondary" type="button" onClick={() => moveMonth(1)}>
            다음 달
          </button>
        </div>
        {message && <p className="adm-slot-message">{message}</p>}
        <div className="adm-slot-weekdays">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="adm-slot-calendar" aria-busy={loading}>
          {calendarDays.map((date) => {
            const iso = toIsoDate(date);
            const day = days[iso];
            const outside = date.getMonth() !== month.getMonth();
            const morning = day?.slots.morning;
            const afternoon = day?.slots.afternoon;
            const assignments = assignmentsByDate.get(iso);
            const quotes = manualQuotesByDate.get(iso);
            const quoteCount = (quotes?.morning.length ?? 0) + (quotes?.afternoon.length ?? 0);
            const jobCount = (assignments?.morning.length ?? 0) + (assignments?.afternoon.length ?? 0);
            const morningNames = (assignments?.morning ?? []).map((job) => job.technicians?.name).filter(Boolean).join(", ");
            const afternoonNames = (assignments?.afternoon ?? []).map((job) => job.technicians?.name).filter(Boolean).join(", ");
            return (
              <button
                key={iso}
                type="button"
                className={[outside ? "outside" : "", day?.blocked ? "blocked" : "", day?.allFull ? "full" : "", loading ? "loading" : ""]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => !loading && !outside && setSelectedDate(iso)}
              >
                <strong>{date.getDate()}</strong>
                {loading ? (
                  <span className="adm-slot-skeleton" />
                ) : day ? (
                  <>
                    <span className={morning?.isFull ? "danger" : "ok"}>{slotUsageLabel(morning, "오전", cap)}</span>
                    {morningNames && <small>{morningNames}</small>}
                    <span className={afternoon?.isFull ? "danger" : "ok"}>{slotUsageLabel(afternoon, "오후", cap)}</span>
                    {afternoonNames && <small>{afternoonNames}</small>}
                    {(jobCount > 0 || quoteCount > 0) && <small>주문 {jobCount} · 견적 {quoteCount}</small>}
                    {day.blocked && <em>휴무/차단</em>}
                  </>
                ) : (
                  <span className="adm-muted">-</span>
                )}
              </button>
            );
          })}
        </div>
      </section>
      {selectedDate && days[selectedDate] && (
        <section className="adm-card adm-section">
          <div className="adm-slot-panel-head">
            <div>
              <h2 className="adm-section-title">{selectedDate} 배정 현황</h2>
              <p className="adm-muted">현재 cap {cap}건 기준으로 남은 슬롯을 확인합니다.</p>
            </div>
            <button className={`adm-btn ${days[selectedDate].blocked ? "adm-btn-secondary" : "adm-btn-danger"}`} type="button" onClick={() => void toggleBlock(selectedDate)} disabled={localMode}>
              {localMode ? "로컬에서 변경 불가" : days[selectedDate].blocked ? "차단 해제" : "날짜 차단"}
            </button>
          </div>
          {(["morning", "afternoon"] as const).map((period) => {
            const periodJobs = selectedAssignments?.[period] ?? [];
            const periodQuotes = selectedManualQuotes?.[period] ?? [];
            const maxCount = days[selectedDate].slots[period].maxCount ?? cap;
            const usedCount = days[selectedDate].slots[period].usedCount ?? periodJobs.length + periodQuotes.length;
            const remaining = Math.max(0, maxCount - usedCount);
            return (
              <div className="adm-slot-panel-section" key={period}>
                <h3>{period === "morning" ? "오전" : "오후"} · {usedCount}/{maxCount}</h3>
                {periodJobs.map((job) => (
                  <article className="adm-slot-job-card" key={job.id}>
                    <div>
                      <strong>
                        <a href={job.orders?.id ? `/admin/orders/${job.orders.id}` : "#"}>{job.orders?.order_number ?? "주문번호 없음"}</a>
                      </strong>
                      <p>제품 · {jobProductLabel(job)}</p>
                      <p>주소 · {jobAddress(job)}</p>
                      <p>연락처 · {jobCustomer(job)}</p>
                      <p>예약시간대 · {slotLabel(period)} {kstTime(job.scheduled_at)}</p>
                      <p>담당기사 · {job.technicians?.name ?? "미배정"}</p>
                    </div>
                    <span>제품 주문</span>
                  </article>
                ))}
                {periodQuotes.map((quote) => (
                  <article className="adm-slot-job-card adm-slot-quote-card" key={quote.id}>
                    <div>
                      <strong>
                        <a href={`/admin/quotes?manualQuoteId=${encodeURIComponent(quote.id)}`}>{quote.quote_number ?? "견적번호 없음"}</a>
                      </strong>
                      <p>품목 · {quoteProductLabel(quote)}</p>
                      <p>주소 · {quote.address_text || "주소 미입력"}</p>
                      <p>연락처 · {[quote.customer_name || "성함 없음", quote.customer_phone || "연락처 없음"].join(" · ")}</p>
                      <p>희망 일정 · {selectedDate} {slotLabel(period)}</p>
                      <p>견적 금액 · {formatKRW(quote.total_final)}</p>
                    </div>
                    <span>견적 희망</span>
                  </article>
                ))}
                {periodJobs.length === 0 && periodQuotes.length === 0 ? <p className="adm-muted">해당 시간대 일정이 없습니다.</p> : null}
                {remaining > 0 ? <p className="adm-muted">남은 슬롯 {remaining}개</p> : <p className="adm-muted">해당 시간대는 현재 마감입니다.</p>}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
