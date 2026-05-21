"use client";

import { useState } from "react";
import { CANONICAL_SERVICE_OPTIONS } from "@/lib/service-catalog";
import { formatServiceName } from "@/lib/format";
import { maskAddress } from "@/lib/pii";

export function TechnicianCreateForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    await fetch("/api/admin/technicians", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        phone: form.get("phone"),
        type: form.get("type"),
        grade: form.get("grade"),
        region: form.get("region"),
        note: form.get("note"),
        experience_years: Number(form.get("experience_years") || 0),
        specialties: form.getAll("specialties"),
        bio: form.get("bio"),
        profile_image_url: form.get("profile_image_url"),
        is_active: form.get("is_active") === "on",
        skills: form.getAll("skills")
      })
    });
    setLoading(false);
    window.location.reload();
  }
  return (
    <>
      <button className="adm-btn adm-btn-primary" onClick={() => setOpen(true)}>기사 등록</button>
      {open && (
        <div className="adm-modal-overlay">
          <form className="adm-modal" onSubmit={submit}>
            <div className="adm-modal-header"><h2 className="adm-modal-title">기사 등록</h2></div>
            <div className="adm-modal-body">
              <div className="adm-form-row adm-form-row-2">
                <label><span className="adm-label">이름 *</span><input className="adm-input" name="name" required /></label>
                <label><span className="adm-label">전화번호 *</span><input className="adm-input" name="phone" required /></label>
              </div>
              <div className="adm-form-row adm-form-row-2">
                <label><span className="adm-label">담당 지역</span><input className="adm-input" name="region" placeholder="예: 수원·용인" /></label>
                <label><span className="adm-label">메모</span><input className="adm-input" name="note" placeholder="운영 메모" /></label>
              </div>
              <div className="adm-form-row adm-form-row-2">
                <label><span className="adm-label">유형 *</span><select className="adm-input" name="type" defaultValue="contractor"><option value="direct">직고용</option><option value="contractor">계약직</option></select></label>
                <label><span className="adm-label">등급</span><select className="adm-input" name="grade" defaultValue="bronze"><option value="bronze">bronze</option><option value="silver">silver</option><option value="gold">gold</option><option value="premium">premium</option></select></label>
              </div>
              <div className="adm-form-row adm-form-row-2">
                <label><span className="adm-label">경력</span><input className="adm-input" name="experience_years" type="number" min={0} max={80} defaultValue={0} /></label>
                <label><span className="adm-label">프로필 사진 URL</span><input className="adm-input" name="profile_image_url" placeholder="https://..." /></label>
              </div>
              <div className="adm-form-row">
                <label><span className="adm-label">한 줄 소개</span><input className="adm-input" name="bio" placeholder="예: 정확하고 깔끔한 시공을 약속합니다" /></label>
              </div>
              <label className="adm-inline-check"><input type="checkbox" name="is_active" defaultChecked /> 활성 기사로 등록</label>
              <div className="adm-section">
                <div className="adm-label">담당 서비스</div>
                {CANONICAL_SERVICE_OPTIONS.map(({ code, displayName }) => (
                  <label key={code} style={{ display: "inline-flex", gap: 6, marginRight: 12, marginBottom: 8 }}>
                    <input type="checkbox" name="skills" value={code} /> {displayName}
                  </label>
                ))}
              </div>
              <div className="adm-section">
                <div className="adm-label">전문 분야</div>
                {CANONICAL_SERVICE_OPTIONS.map(({ code, displayName }) => (
                  <label key={code} style={{ display: "inline-flex", gap: 6, marginRight: 12, marginBottom: 8 }}>
                    <input type="checkbox" name="specialties" value={displayName} /> {displayName}
                  </label>
                ))}
              </div>
            </div>
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" type="button" onClick={() => setOpen(false)}>취소</button>
              <button className="adm-btn adm-btn-primary" disabled={loading}>{loading ? "등록 중..." : "등록"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function TechnicianActiveToggle({ id, active }: { id: string; active: boolean }) {
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const response = await fetch("/api/admin/technicians", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !active })
    });
    setLoading(false);
    if (response.ok) window.location.reload();
  }

  return (
    <button className={`adm-badge ${active ? "adm-badge-green" : "adm-badge-gray"}`} type="button" onClick={toggle} disabled={loading}>
      {loading ? "변경 중" : active ? "활성" : "비활성"}
    </button>
  );
}

function monthText(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function scheduleTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function firstServiceCode(order: any) {
  const sku = Array.isArray(order?.skus) ? order.skus[0] : null;
  return sku?.service_type_code ?? sku?.sku ?? order?.service_type_code;
}

export function TechnicianScheduleButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [month, setMonth] = useState(monthText());

  async function load(nextMonth = month) {
    setLoading(true);
    const response = await fetch(`/api/admin/technicians/${id}/schedule?month=${nextMonth}`, { cache: "no-store" });
    const json = await response.json();
    setJobs(response.ok ? json.data?.jobs ?? [] : []);
    setLoading(false);
  }

  async function show() {
    setOpen(true);
    await load(month);
  }

  return (
    <>
      <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={show}>일정 보기</button>
      {open && (
        <div className="adm-modal-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
          <div className="adm-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="adm-modal-header"><h2 className="adm-modal-title">{name} 일정</h2></div>
            <div className="adm-modal-body adm-stack">
              <label>
                <span className="adm-label">조회 월</span>
                <input className="adm-input" type="month" value={month} onChange={(event) => { setMonth(event.target.value); void load(event.target.value); }} />
              </label>
              {loading ? <p className="adm-muted">일정을 불러오는 중입니다...</p> : jobs.length === 0 ? <p className="adm-muted">해당 월 배정 일정이 없습니다.</p> : jobs.map((job) => (
                <p key={job.id}>{scheduleTime(job.scheduled_at)} — {job.orders?.order_number ?? "주문"} {formatServiceName(firstServiceCode(job.orders))} {maskAddress(job.orders?.homes?.address_full, 3)}</p>
              ))}
            </div>
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" type="button" onClick={() => setOpen(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
