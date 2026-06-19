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

function orderNumber(diagnosis: any) {
  const order = Array.isArray(diagnosis.orders) ? diagnosis.orders[0] : diagnosis.orders;
  return order?.order_number ?? diagnosis.raw_response?.receipt_number ?? diagnosis.raw_response?.order_number ?? null;
}

function relatedOrder(diagnosis: any) {
  return Array.isArray(diagnosis.orders) ? diagnosis.orders[0] : diagnosis.orders;
}

function convertedOrderId(diagnosis: any) {
  return typeof diagnosis.raw_response?.converted_order_id === "string" ? diagnosis.raw_response.converted_order_id : null;
}

function customerName(diagnosis: any) {
  return diagnosis.customer_name ?? diagnosis.raw_response?.customer?.name ?? relatedOrder(diagnosis)?.customers?.name ?? "이름 미입력";
}

function customerPhone(diagnosis: any) {
  return diagnosis.customer_phone ?? diagnosis.raw_response?.customer?.phone ?? relatedOrder(diagnosis)?.customers?.phone ?? "연락처 없음";
}

function addressLine(diagnosis: any) {
  const order = relatedOrder(diagnosis);
  const rawAddress = diagnosis.raw_response?.address;
  const full = rawAddress?.full || [rawAddress?.roadAddress, rawAddress?.detailAddress].filter(Boolean).join(" ");
  return full || [order?.homes?.address_full ?? order?.customers?.address_full, order?.homes?.address_apt ?? order?.customers?.address_apt].filter(Boolean).join(" ") || "주소 미입력";
}

function requestItemLabel(diagnosis: any) {
  return diagnosis.raw_response?.item ?? CANONICAL_SERVICE_OPTIONS.find((option) => option.code === canonicalServiceCode(diagnosis.service_type_code ?? diagnosis.service_code))?.displayName ?? diagnosis.service_type_code ?? diagnosis.service_code ?? "사진 확인";
}

function cashReceiptTextFromOrder(diagnosis: any) {
  const text = String(relatedOrder(diagnosis)?.special_requests ?? "");
  const line = text.split(/\r?\n/).find((entry) => entry.includes("현금영수증:"));
  return line?.replace(/^.*?현금영수증:\s*/, "").trim() || "신청 안 함";
}

function isPhotoSrc(value?: string | null) {
  const src = String(value ?? "").trim();
  return /^(https?:)?\/\//i.test(src) || src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:");
}

export function DiagnosisPanel({ diagnosis, localMode = false }: { diagnosis: any; localMode?: boolean }) {
  const [result, setResult] = useState(normalizeResult(diagnosis.result));
  const [reason, setReason] = useState(diagnosis.reason ?? "");
  const [service, setService] = useState(canonicalServiceCode(diagnosis.suggested_service_code ?? diagnosis.service_type_code ?? diagnosis.service_code));
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [message, setMessage] = useState("");
  const photoInputs = (diagnosis.signedPhotos ?? diagnosis.image_urls ?? diagnosis.photos ?? [])
    .filter((value: unknown): value is string => typeof value === "string" && value.length > 0);

  useEffect(() => {
    setResult(normalizeResult(diagnosis.result));
    setReason(diagnosis.reason ?? "");
    setService(canonicalServiceCode(diagnosis.suggested_service_code ?? diagnosis.service_type_code ?? diagnosis.service_code));
    setMessage("");
  }, [diagnosis.id, diagnosis.reason, diagnosis.result, diagnosis.service_code, diagnosis.service_type_code, diagnosis.suggested_service_code]);

  async function save() {
    if (localMode) {
      setMessage("로컬 확인 모드에서는 저장할 수 없어요.");
      return;
    }
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
    if (localMode) {
      setMessage("로컬 확인 모드에서는 주문·견적을 생성할 수 없어요.");
      return;
    }
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
          <h2>접수 상세</h2>
          <p>
            {orderNumber(diagnosis) ? `접수번호 ${orderNumber(diagnosis)} · ` : ""}
            고객 {customerName(diagnosis)} · {customerPhone(diagnosis)}
          </p>
        </div>
        <div className="adm-action-row-buttons">
          <span className="adm-badge adm-badge-gray">
            사진 {(diagnosis.signedPhotos ?? diagnosis.image_urls ?? diagnosis.photos ?? []).length}장
          </span>
          {relatedOrder(diagnosis)?.id ? (
            <a className="adm-btn adm-btn-secondary adm-btn-sm" href={`/admin/orders/${relatedOrder(diagnosis).id}`}>
              접수 주문 보기
            </a>
          ) : null}
          {convertedOrderId(diagnosis) ? (
            <a className="adm-btn adm-btn-primary adm-btn-sm" href={`/admin/orders/${convertedOrderId(diagnosis)}`}>
              제품 주문 보기
            </a>
          ) : null}
        </div>
      </div>
      <div className="adm-admin-info-grid adm-admin-info-grid-compact">
        <span><b>요청 품목</b><strong>{requestItemLabel(diagnosis)}</strong></span>
        <span><b>고객 성함</b><strong>{customerName(diagnosis)}</strong></span>
        <span><b>연락처</b><strong>{customerPhone(diagnosis)}</strong></span>
        <span><b>주소</b><strong>{addressLine(diagnosis)}</strong></span>
        <span><b>현금영수증</b><strong>{cashReceiptTextFromOrder(diagnosis)}</strong></span>
      </div>
      <div className="adm-diagnosis-panel-grid">
        <section className="adm-diagnosis-info">
          <div className="adm-photo-grid">
            {photoInputs.length ? photoInputs.map((photo: string, index: number) => (
              isPhotoSrc(photo) ? (
                <a className="adm-photo-item" href={photo} target="_blank" rel="noreferrer" key={photo}>
                  <img src={photo} alt="확인 사진" />
                </a>
              ) : (
                <div className="adm-photo-item adm-photo-placeholder" key={`${photo}-${index}`}>
                  첨부 사진 {index + 1}
                </div>
              )
            )) : <p className="adm-photo-empty">등록 사진 없음</p>}
          </div>
        </section>
        <section className="adm-diagnosis-form">
          <label>
            <span className="adm-label">판정</span>
            <select className="adm-input" value={result} onChange={(e) => setResult(e.target.value)} disabled={localMode}>
              <option value="교체추천">교체추천</option>
              <option value="보류">보류</option>
              <option value="교체불필요">교체불필요</option>
              <option value="현장확인필요">현장확인필요</option>
            </select>
          </label>
          <label>
            <span className="adm-label">추천 서비스</span>
            <select className="adm-input" value={service} onChange={(e) => setService(e.target.value)} disabled={localMode}>
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
            <textarea className="adm-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="고객 메시지 및 내부 메모" disabled={localMode} />
          </label>
          {message ? <p className="adm-form-message adm-form-message-error">{message}</p> : null}
          {localMode ? <p className="adm-help">로컬 확인 모드에서는 판정 저장, 주문·견적 생성이 비활성입니다.</p> : null}
          <div className="adm-action-row-buttons">
            <button className="adm-btn adm-btn-primary" onClick={save} disabled={saving || localMode}>{saving ? "저장 중" : localMode ? "로컬에서 저장 불가" : "확인 저장"}</button>
            <button className="adm-btn adm-btn-secondary" type="button" onClick={convertToQuote} disabled={converting || localMode}>
              {converting ? "전환 중" : localMode ? "로컬에서 전환 불가" : convertedOrderId(diagnosis) ? "제품 주문 보기" : "제품 주문 생성"}
            </button>
            <a className="adm-btn adm-btn-secondary" href="/admin/orders?flow=intake">상담 주문 확인</a>
          </div>
          <div className="adm-action-row-buttons">
            <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => setReason("사진이 부족해 추가 사진이 필요합니다. 전체 사진, 문제 부위 근접 사진, 주변 환경 사진을 다시 요청해주세요.")} disabled={localMode}>추가 사진 요청</button>
            <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => setReason("사진 기준으로 교체가 필요하지 않아 보입니다. 현재는 사용 유지 안내 후 종료합니다.")} disabled={localMode}>종료 안내</button>
          </div>
        </section>
      </div>
    </div>
  );
}
