"use client";

import { useEffect, useState } from "react";
import { CANONICAL_SERVICE_OPTIONS, canonicalServiceCode } from "@/lib/service-catalog";

function normalizeResult(result?: string | null) {
  const labels: Record<string, string> = {
    replace_recommended: "교체추천",
    replacement_recommended: "교체추천",
    no_replacement_needed: "교체불필요",
    not_needed: "교체불필요",
    hold: "보류",
    site_check_required: "현장확인필요"
  };
  return labels[result ?? ""] ?? result ?? "현장확인필요";
}

function workflowHint(result: string) {
  if (result === "교체추천") return "교체가 필요해 보이면 추천 서비스 코드와 고객 안내 문구를 정리한 뒤 견적/서비스 단계로 넘기세요.";
  if (result === "현장확인필요") return "사진만으로 판단이 어려운 건입니다. 상담 메모를 남기고 방문 확인 대상으로 분류하세요.";
  if (result === "보류") return "사진이 부족하거나 조건이 애매한 건입니다. 추가 사진 요청 문구를 남겨두세요.";
  if (result === "교체불필요") return "교체가 필요하지 않은 사유를 고객이 이해할 수 있게 남기고 종료 처리하세요.";
  return "사진을 확인한 뒤 고객에게 안내할 다음 단계를 선택하세요.";
}

function orderNumber(diagnosis: any) {
  const order = Array.isArray(diagnosis.orders) ? diagnosis.orders[0] : diagnosis.orders;
  return order?.order_number ?? diagnosis.raw_response?.receipt_number ?? diagnosis.raw_response?.order_number ?? null;
}

function customerName(diagnosis: any) {
  return diagnosis.customer_name ?? diagnosis.raw_response?.customer?.name ?? "이름 미입력";
}

function customerPhone(diagnosis: any) {
  return diagnosis.customer_phone ?? diagnosis.raw_response?.customer?.phone ?? "연락처 없음";
}

export function DiagnosisPanel({ diagnosis }: { diagnosis: any }) {
  const [result, setResult] = useState(normalizeResult(diagnosis.result));
  const [reason, setReason] = useState(diagnosis.reason ?? "");
  const [service, setService] = useState(canonicalServiceCode(diagnosis.suggested_service_code ?? diagnosis.service_type_code ?? diagnosis.service_code));
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setResult(normalizeResult(diagnosis.result));
    setReason(diagnosis.reason ?? "");
    setService(canonicalServiceCode(diagnosis.suggested_service_code ?? diagnosis.service_type_code ?? diagnosis.service_code));
    setMessage("");
  }, [diagnosis.id, diagnosis.reason, diagnosis.result, diagnosis.service_code, diagnosis.service_type_code, diagnosis.suggested_service_code]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/diagnoses/${diagnosis.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, reason, result_message: reason, suggested_service_code: service })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "판정을 저장하지 못했습니다.");
      }
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "판정을 저장하지 못했습니다.");
      setSaving(false);
    }
  }

  async function convertToQuote() {
    setConverting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/diagnoses/${diagnosis.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_type_code: service, reason })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "견적 전환에 실패했습니다.");
      }
      window.location.href = payload.data?.adminUrl ?? `/admin/orders/${payload.data?.order?.id ?? ""}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "견적 전환에 실패했습니다.");
      setConverting(false);
    }
  }

  return (
    <div className="adm-card adm-stack adm-diagnosis-panel">
      <div className="adm-diagnosis-panel-head">
        <div>
          <h2>상세정보</h2>
          <p>
            {orderNumber(diagnosis) ? `접수번호 ${orderNumber(diagnosis)} · ` : ""}
            고객 {customerName(diagnosis)} · {customerPhone(diagnosis)}
          </p>
        </div>
        <span className="adm-badge adm-badge-gray">
          사진 {(diagnosis.signedPhotos ?? diagnosis.image_urls ?? diagnosis.photos ?? []).length}장
        </span>
      </div>
      <div className="adm-diagnosis-panel-grid">
        <section className="adm-diagnosis-info">
          <div className="adm-next-action">
            <strong>다음 액션</strong>
            <p>{workflowHint(result)}</p>
          </div>
          <div className="adm-photo-grid">
            {(diagnosis.signedPhotos ?? []).map((photo: string) => (
              <a className="adm-photo-item" href={photo} target="_blank" rel="noreferrer" key={photo}>
                <img src={photo} alt="확인 사진" />
              </a>
            ))}
          </div>
          {diagnosis.recommendation ? <p className="adm-muted">{diagnosis.recommendation}</p> : null}
          {diagnosis.details ? <p className="adm-muted">{diagnosis.details}</p> : null}
        </section>
        <section className="adm-diagnosis-form">
          <label>
            <span className="adm-label">판정</span>
            <select className="adm-input" value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="교체추천">교체추천</option>
              <option value="보류">보류</option>
              <option value="교체불필요">교체불필요</option>
              <option value="현장확인필요">현장확인필요</option>
            </select>
          </label>
          <label>
            <span className="adm-label">추천 서비스</span>
            <select className="adm-input" value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">추천 서비스 선택</option>
              {CANONICAL_SERVICE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>{option.displayName}</option>
              ))}
              {service && !CANONICAL_SERVICE_OPTIONS.some((option) => option.code === service) ? (
                <option value={service}>{service}</option>
              ) : null}
            </select>
          </label>
          <label>
            <span className="adm-label">상담 메모</span>
            <textarea className="adm-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="고객 메시지 및 내부 메모" />
          </label>
          {message ? <p className="adm-form-message adm-form-message-error">{message}</p> : null}
          <div className="adm-action-row-buttons">
            <button className="adm-btn adm-btn-primary" onClick={save} disabled={saving}>{saving ? "저장 중" : "확인 저장"}</button>
            <button className="adm-btn adm-btn-secondary" type="button" onClick={convertToQuote} disabled={converting}>
              {converting ? "전환 중" : "주문·견적 생성"}
            </button>
            <a className="adm-btn adm-btn-secondary" href="/admin/orders?flow=intake">상담 주문 확인</a>
          </div>
          <div className="adm-action-row-buttons">
            <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => setReason("사진이 부족해 추가 사진이 필요합니다. 전체 사진, 문제 부위 근접 사진, 주변 환경 사진을 다시 요청해주세요.")}>추가 사진 요청</button>
            <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => setReason("사진 기준으로 교체가 필요하지 않아 보입니다. 현재는 사용 유지 안내 후 종료합니다.")}>종료 안내</button>
          </div>
        </section>
      </div>
    </div>
  );
}
