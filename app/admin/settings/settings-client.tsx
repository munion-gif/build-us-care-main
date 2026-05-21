"use client";

import { useState } from "react";

type Settings = {
  kakao_channel_url?: string;
  service_phone?: string;
  slot_cap?: string;
  maintenance_mode?: string;
  admin_email?: string;
  admin_phone?: string;
  notify_channel?: string;
  cancel_policy_full_refund_hours?: string;
  cancel_policy_full_refund_days_before?: string;
  cancel_policy_partial_refund_rate?: string;
  cancel_policy_no_refund_status?: string;
};

export function SettingsForm({ initialSettings }: { initialSettings: Settings }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const slotCapRaw = String(form.get("slot_cap") ?? "").trim();

    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kakao_channel_url: String(form.get("kakao_channel_url") ?? ""),
          service_phone: String(form.get("service_phone") ?? ""),
          slot_cap: slotCapRaw === "" ? 0 : Number(slotCapRaw),
          maintenance_mode: form.get("maintenance_mode") === "on",
          admin_email: String(form.get("admin_email") ?? ""),
          admin_phone: String(form.get("admin_phone") ?? ""),
          notify_channel: String(form.get("notify_channel") || "none"),
          cancel_policy_full_refund_hours: Number(form.get("cancel_policy_full_refund_hours") || 24),
          cancel_policy_full_refund_days_before: Number(form.get("cancel_policy_full_refund_days_before") || 3),
          cancel_policy_partial_refund_rate: Number(form.get("cancel_policy_partial_refund_rate") || 0.5),
          cancel_policy_no_refund_status: String(form.get("cancel_policy_no_refund_status") || "in_progress,completed,done,canceled,cancelled,warranty")
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "설정을 저장하지 못했어요.");
      setMessage("설정을 저장했습니다. 공개 화면에는 다음 요청부터 반영됩니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "설정을 다시 저장해주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="adm-card" onSubmit={submit}>
      <h2 className="adm-card-title">공통 운영 설정</h2>
      <div className="adm-form-row">
        <label>
          <span className="adm-label">카카오 채널 URL</span>
          <input className="adm-input" name="kakao_channel_url" defaultValue={initialSettings.kakao_channel_url ?? ""} placeholder="https://pf.kakao.com/..." />
        </label>
        {(initialSettings.kakao_channel_url || "").trim() && (
          <div className="adm-inline-help">
            <img src="/kakao-channel-qr.png" alt="카카오 상담 채널 QR 코드" width={96} height={96} />
            <span>홈과 서비스 화면의 PC 상담 영역에 이 QR이 함께 표시됩니다.</span>
          </div>
        )}
      </div>
      <div className="adm-form-row adm-form-row-2">
        <label>
          <span className="adm-label">대표 전화번호</span>
          <input className="adm-input" name="service_phone" defaultValue={initialSettings.service_phone ?? ""} placeholder="010-0000-0000" />
        </label>
        <label>
          <span className="adm-label">슬롯 최대 예약 수</span>
          <input className="adm-input" name="slot_cap" type="number" min={0} max={20} defaultValue={initialSettings.slot_cap ?? ""} placeholder="자동" />
          <span className="adm-help">오전/오후 각 최대 예약 건수. 비워두면 활성 기사 수 기준으로 자동 설정됩니다.</span>
        </label>
      </div>
      <label className="adm-inline-check">
        <input name="maintenance_mode" type="checkbox" defaultChecked={initialSettings.maintenance_mode === "true"} />
        서비스 점검 중 안내를 홈 상단에 표시
      </label>
      <hr className="adm-divider" />
      <h2 className="adm-card-title">관리자 알림 설정</h2>
      <div className="adm-form-row adm-form-row-2">
        <label>
          <span className="adm-label">관리자 이메일</span>
          <input className="adm-input" name="admin_email" type="email" defaultValue={initialSettings.admin_email ?? ""} placeholder="admin@example.com" />
        </label>
        <label>
          <span className="adm-label">관리자 전화번호</span>
          <input className="adm-input" name="admin_phone" defaultValue={initialSettings.admin_phone ?? ""} placeholder="010-0000-0000" />
        </label>
      </div>
      <div className="adm-form-row">
        <label>
          <span className="adm-label">알림 방식</span>
          <select className="adm-input" name="notify_channel" defaultValue={initialSettings.notify_channel ?? "none"}>
            <option value="none">DB 기록만</option>
            <option value="email">이메일</option>
            <option value="sms">SMS</option>
            <option value="kakao">카카오 알림톡</option>
          </select>
        </label>
      </div>
      <hr className="adm-divider" />
      <h2 className="adm-card-title">취소 정책</h2>
      <div className="adm-form-row adm-form-row-3">
        <label>
          <span className="adm-label">전액 환불 기준 시간</span>
          <input className="adm-input" name="cancel_policy_full_refund_hours" type="number" min={0} max={720} defaultValue={initialSettings.cancel_policy_full_refund_hours ?? "24"} />
          <span className="adm-help">결제 후 이 시간 이내일 때 전액 환불 후보가 됩니다.</span>
        </label>
        <label>
          <span className="adm-label">방문 전 남은 일수</span>
          <input className="adm-input" name="cancel_policy_full_refund_days_before" type="number" min={0} max={30} defaultValue={initialSettings.cancel_policy_full_refund_days_before ?? "3"} />
          <span className="adm-help">방문 이 일수 이상 전이면 전액 환불을 자동 처리합니다.</span>
        </label>
        <label>
          <span className="adm-label">부분 환불 비율</span>
          <input className="adm-input" name="cancel_policy_partial_refund_rate" type="number" min={0} max={1} step="0.1" defaultValue={initialSettings.cancel_policy_partial_refund_rate ?? "0.5"} />
          <span className="adm-help">방문 1-2일 전 취소 요청의 환불 비율입니다.</span>
        </label>
      </div>
      <div className="adm-form-row">
        <label>
          <span className="adm-label">환불 불가 상태</span>
          <input className="adm-input" name="cancel_policy_no_refund_status" defaultValue={initialSettings.cancel_policy_no_refund_status ?? "in_progress,completed,done,canceled,cancelled,warranty"} />
          <span className="adm-help">쉼표로 구분합니다. 예: in_progress,completed,done</span>
        </label>
      </div>
      {message && <p className="adm-form-message">{message}</p>}
      <div className="adm-modal-footer" style={{ padding: 0, marginTop: 16 }}>
        <button className="adm-btn adm-btn-primary" type="submit" disabled={saving}>
          {saving ? "저장 중..." : "설정 저장"}
        </button>
      </div>
    </form>
  );
}
