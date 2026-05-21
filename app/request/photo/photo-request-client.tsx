"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Check, ChevronLeft, Copy, Loader2, X } from "lucide-react";
import { EVENT_TYPES } from "@/lib/event-types";
import { getKakaoChannelChatUrl } from "@/lib/kakao-channel";
import { CUSTOMER_PHOTO_SLOTS } from "@/lib/photo-guides";
import type { QuoteServiceItem } from "@/lib/service-items";
import { useTracking } from "@/lib/use-tracking";

type PhotoRequestClientProps = {
  services: QuoteServiceItem[];
  kakaoUrl: string | null;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function isValidKoreanMobile(phone: string) {
  return /^010\d{8}$/.test(normalizePhone(phone));
}

export function PhotoRequestClient({ services, kakaoUrl }: PhotoRequestClientProps) {
  const [step, setStep] = useState(1);
  const [serviceCode, setServiceCode] = useState("toilet_replace");
  const [files, setFiles] = useState<File[]>([]);
  const [customer, setCustomer] = useState({ name: "", phone: "", kakaoNotice: true });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);
  const { track } = useTracking();
  const kakaoChatUrl = getKakaoChannelChatUrl(kakaoUrl);

  const selectedService = useMemo(() => services.find((service) => service.service_type_code === serviceCode), [serviceCode, services]);
  const guide = selectedService?.photo_guide ?? "전체 사진 / 문제 부위 / 주변 환경이 보이는 사진을 올려주세요.";

  function goNext() {
    if (step === 1 && !serviceCode) {
      setMessage("작업을 먼저 선택해주세요.");
      return;
    }
    if (step === 2 && files.length === 0) {
      setMessage("사진을 최소 1장 올려주세요.");
      return;
    }
    if (step === 3 && (!customer.name.trim() || !isValidKoreanMobile(customer.phone))) {
      setMessage("이름과 010 전화번호를 확인해주세요.");
      return;
    }
    setMessage("");
    setStep((current) => Math.min(current + 1, 4));
  }

  async function uploadTempPhoto(file: File) {
    const response = await fetch("/api/storage/upload-temp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type || "image/jpeg" })
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error?.message ?? "사진 업로드 URL을 만들지 못했어요.");

    await fetch(json.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "image/jpeg" },
      body: file
    });

    return json.data.path as string;
  }

  async function submitDiagnosis() {
    setLoading(true);
    setMessage("사진을 올리고 있어요.");
    setReceipt(null);
    try {
      const paths = [];
      for (const file of files) {
        paths.push(await uploadTempPhoto(file));
      }

      setMessage("사진 확인 접수를 남기고 있어요.");
      const response = await fetch("/api/diagnoses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceTypeCode: serviceCode === "unknown" ? "toilet_replace" : serviceCode,
          imageUrls: paths,
          name: customer.name.trim(),
          phone: normalizePhone(customer.phone)
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "사진 확인 요청을 다시 확인해주세요.");
      setReceipt(json.data);
      setMessage("");
      void track(EVENT_TYPES.DIAGNOSIS_REQUESTED, {
        diagnosis_id: json.data.diagnosisId,
        service_code: serviceCode,
        result: "received"
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "요청을 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="photo-request-page">
      <style>{photoRequestCss}</style>
      <section className="photo-flow">
        <div className="step-indicator" aria-label={`사진확인 ${step}단계`}>
          <span>step {step}/4</span>
          {["작업 선택", "사진 업로드", "연락처", "접수 확인"].map((label, index) => {
            const itemStep = index + 1;
            return (
              <p key={label} className={step === itemStep ? "current" : step > itemStep ? "done" : ""}>
                {step > itemStep ? <Check size={13} /> : null}
                {label}
              </p>
            );
          })}
        </div>

        <div className="flow-panel">
          <span className="photo-brand-kicker">build us care</span>
          {step === 1 && (
            <>
              <h1>어떤 작업이 필요하세요?</h1>
              <p className="flow-lead">정확하지 않아도 됩니다. 사진을 보고 교체 가능 여부와 필요한 제품을 다시 확인할게요.</p>
            <div className="diagnosis-service-grid">
              {services.map((service) => (
                <button key={service.service_type_code} className={serviceCode === service.service_type_code ? "selected" : ""} onClick={() => setServiceCode(service.service_type_code)}>
                  {service.display_name}
                </button>
              ))}
            </div>
            </>
          )}

          {step === 2 && (
            <>
            <h1>사진 3장을 올려주세요</h1>
            <p className="flow-lead">{guide}</p>
            <div className="photo-guide-cards" aria-label="사진 촬영 가이드">
              {CUSTOMER_PHOTO_SLOTS.map((slot, index) => (
                <span key={slot.angle}>{index + 1} {slot.label}</span>
              ))}
            </div>
            <PhotoSlots files={files} onChange={setFiles} />
            </>
          )}

          {step === 3 && (
            <>
            <h1>결과 받을 연락처</h1>
            <p className="flow-lead">사진 확인 결과와 견적 가능 여부를 안내받을 이름과 전화번호를 남겨주세요.</p>
            <input value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} placeholder="이름" />
            <input value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} placeholder="010-XXXX-XXXX" />
            <button
              type="button"
              className={customer.kakaoNotice ? "notice-choice selected" : "notice-choice"}
              aria-pressed={customer.kakaoNotice}
              onClick={() => setCustomer((current) => ({ ...current, kakaoNotice: !current.kakaoNotice }))}
            >
              <span className="notice-choice-icon">{customer.kakaoNotice ? <Check size={16} /> : null}</span>
              <span>
                <strong>카톡으로 견적 안내 받기</strong>
                <small>사진 확인 후 호환 제품과 견적 가능 여부를 이어서 안내받을게요.</small>
              </span>
            </button>
            </>
          )}

          {step === 4 && (
            <div className="done-panel">
            {!receipt ? (
              <>
                <h1>사진 확인을 접수할게요</h1>
                <p>올려주신 사진과 연락처를 기준으로 호환 가능한 제품과 견적 가능 여부를 확인합니다.</p>
                <p>확인 후 영업시간 기준 24시간 이내에 결과 안내를 이어갈게요.</p>
                <button type="button" onClick={submitDiagnosis} disabled={loading}>
                  {loading ? <Loader2 className="spin" size={18} /> : null}
                  {loading ? "접수하고 있습니다..." : "사진 확인 접수하기"}
                </button>
                <a href="/">홈으로 돌아가기</a>
              </>
            ) : (
              <ReceiptComplete receipt={receipt} kakaoChatUrl={kakaoChatUrl} />
            )}
            </div>
          )}

        {message && <p className="flow-message">{message}</p>}
        <div className="flow-actions">
          {step > 1 && (
            <button type="button" className="secondary" onClick={() => setStep((current) => current - 1)} disabled={loading}>
              <ChevronLeft size={18} />
              이전
            </button>
          )}
          {step < 4 && (
            <button type="button" onClick={goNext}>
              {step === 3 ? "접수 확인" : "다음"}
            </button>
          )}
        </div>
        </div>
      </section>
    </main>
  );
}

function ReceiptComplete({ receipt, kakaoChatUrl }: { receipt: any; kakaoChatUrl: string | null }) {
  const receiptNumber = receipt?.receiptNumber ? String(receipt.receiptNumber) : receipt?.orderNumber ? String(receipt.orderNumber) : receipt?.diagnosisId ? String(receipt.diagnosisId).slice(0, 8).toUpperCase() : "";
  const [copied, setCopied] = useState(false);

  async function copyReceiptNumber() {
    if (!receiptNumber) return;
    const text = `사진확인 접수번호 ${receiptNumber}입니다. 사진 확인 결과와 견적 안내를 받고 싶어요.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="diagnosis-result info">
      <span>접수완료</span>
      <h1>사진 확인 접수가 완료됐어요</h1>
      <p>올려주신 사진을 확인한 뒤 호환 제품과 견적 가능 여부를 안내할게요.</p>
      <p>카톡 상담방에 접수번호를 보내주시면 상담원이 더 빠르게 이어서 확인할 수 있어요.</p>
      <p>방문은 교체가 가능한 경우에만 예약으로 이어집니다.</p>
      {receiptNumber ? <strong>접수번호 {receiptNumber}</strong> : null}
      {copied ? <p className="receipt-copy-message">접수번호가 복사됐어요. 카톡에 붙여넣어 보내주세요.</p> : null}
      <div className="result-actions">
        {receiptNumber ? (
          <button type="button" onClick={copyReceiptNumber}>
            <Copy size={16} />
            접수번호 복사
          </button>
        ) : null}
        {kakaoChatUrl ? <a href={kakaoChatUrl} target="_blank" rel="noreferrer">카톡 상담 이어가기</a> : <button type="button" disabled>상담 채널 준비 중</button>}
        <a href="/">홈으로 돌아가기</a>
      </div>
    </div>
  );
}

function PhotoSlots({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const nextUrls = files.map((file) => URL.createObjectURL(file));
    setUrls(nextUrls);
    return () => nextUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  return (
    <div className="photo-slot-grid">
      {CUSTOMER_PHOTO_SLOTS.map((slot, index) => (
        <div key={index} className={files[index] ? "photo-slot filled" : "photo-slot"}>
          {files[index] ? (
            <>
              <img src={urls[index]} alt={`사진 ${index + 1}`} />
              <span className="photo-slot-caption">{slot.label}</span>
              <button type="button" onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}>
                <X size={16} />
              </button>
            </>
          ) : (
            <label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const next = [...files];
                  next[index] = file;
                  onChange(next.slice(0, 3));
                  event.target.value = "";
                }}
              />
              <Camera size={22} />
              <strong>{slot.label}</strong>
              <span>{slot.guide}</span>
            </label>
          )}
        </div>
      ))}
    </div>
  );
}

const photoRequestCss = `
  .photo-request-page {
    min-height: 100vh;
    padding: var(--space-4);
    background:
      linear-gradient(90deg, rgba(34, 33, 29, 0.022) 1px, transparent 1px),
      linear-gradient(180deg, rgba(34, 33, 29, 0.022) 1px, transparent 1px),
      var(--color-bg);
    background-size: 34px 34px;
  }
  .photo-flow {
    width: min(920px, 100%);
    margin: 0 auto;
    padding-block: var(--space-8);
  }
  .step-indicator {
    display: grid;
    grid-template-columns: auto repeat(4, minmax(0, 1fr));
    gap: var(--space-2);
    align-items: center;
    margin-bottom: var(--space-4);
  }
  .step-indicator span {
    display: none;
    color: var(--color-primary);
    font-weight: 680;
  }
  .step-indicator p {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    box-sizing: border-box;
    width: 100%;
    height: 36px;
    min-height: 36px;
    margin: 0;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0 var(--space-2);
    background: rgba(255, 250, 241, 0.72);
    color: var(--color-text-faint);
    font-size: var(--text-xs);
    font-weight: 620;
    line-height: 1;
    white-space: nowrap;
  }
  .step-indicator p.current,
  .step-indicator p.done {
    background: rgba(168, 176, 162, 0.18);
    color: var(--color-primary);
  }
  .flow-panel {
    position: relative;
    display: grid;
    gap: var(--space-4);
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    padding: calc(var(--space-6) + 8px) var(--space-6) var(--space-6);
    box-shadow: 0 10px 28px rgba(34, 33, 29, 0.045);
  }
  .flow-panel::before {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: 4px;
    background: linear-gradient(90deg, var(--color-text) 0 34%, rgba(184, 138, 43, 0.56) 34% 67%, var(--color-sage) 67% 100%);
  }
  .flow-panel > * {
    position: relative;
  }
  .photo-brand-kicker {
    z-index: 1;
    margin-top: 14px;
    color: var(--color-text-muted);
    font-family: var(--font-brand);
    font-size: 12px;
    font-weight: var(--brand-label-weight);
    letter-spacing: var(--brand-letter-spacing);
    text-transform: lowercase;
  }
  .flow-panel h1 {
    margin: 0;
    font-size: clamp(1.45rem, 2.45vw, 2rem);
    font-weight: 640;
  }
  .flow-lead {
    max-width: 42rem;
    margin: -4px 0 var(--space-2);
    line-height: 1.6;
  }
  .flow-panel p,
  .flow-message {
    color: var(--color-text-muted);
  }
  .diagnosis-service-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--space-3);
  }
  .diagnosis-service-grid button,
  .flow-actions button,
  .done-panel button,
  .done-panel a {
    min-height: 52px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-text);
    font-weight: 650;
    text-decoration: none;
  }
  .diagnosis-service-grid button.selected {
    border-color: var(--color-sage);
    background: var(--color-sage-soft);
    color: var(--color-text);
  }
  .photo-guide-cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }
  .photo-guide-cards span {
    min-height: 44px;
    display: flex;
    align-items: center;
    border-radius: 8px;
    padding: 0 var(--space-3);
    background: rgba(168, 176, 162, 0.18);
    color: var(--color-text);
    font-size: var(--text-xs);
    font-weight: 650;
    line-height: 1.35;
  }
  .photo-guide-cards span:nth-child(2) {
    background: var(--color-gold-wash);
  }
  .photo-guide-cards span:nth-child(3) {
    background: rgba(255, 250, 241, 0.9);
  }
  .photo-slot-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .photo-slot {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    border: 1.5px dashed var(--color-border);
    border-radius: 8px;
    background: var(--color-sage-soft);
  }
  .photo-slot label {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    align-content: center;
    gap: var(--space-2);
    color: var(--color-text-muted);
    cursor: pointer;
    text-align: center;
    padding: var(--space-2);
  }
  .photo-slot label strong {
    color: var(--color-text);
    font-size: var(--text-sm);
  }
  .photo-slot label span {
    max-width: 13ch;
    font-size: 0.72rem;
    line-height: 1.35;
  }
  .photo-slot-caption {
    position: absolute;
    left: 8px;
    bottom: 8px;
    border-radius: var(--radius-full);
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.62);
    color: #fff;
    font-size: 0.72rem;
    font-weight: 650;
  }
  .photo-slot input {
    display: none;
  }
  .photo-slot img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .photo-slot button {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: var(--radius-full);
    background: rgba(255,255,255,0.92);
  }
  .flow-panel input[type="text"],
  .flow-panel input:not([type]) {
    min-height: 52px;
  }
  .flow-panel input {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0 var(--space-4);
    background: var(--color-surface);
  }
  .notice-choice {
    display: flex;
    width: 100%;
    min-height: 72px;
    gap: var(--space-3);
    align-items: center;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    color: var(--color-text);
    text-align: left;
    cursor: pointer;
    transition: border-color var(--transition), background var(--transition), box-shadow var(--transition);
  }
  .notice-choice.selected {
    border-color: var(--color-sage);
    background: var(--color-sage-soft);
    box-shadow: none;
  }
  .notice-choice-icon {
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-primary);
  }
  .notice-choice.selected .notice-choice-icon {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-cream);
  }
  .notice-choice span:last-child {
    display: grid;
    gap: 3px;
    min-width: 0;
  }
  .notice-choice strong {
    font-size: var(--text-sm);
  }
  .notice-choice small {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    line-height: 1.45;
  }
  .flow-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }
  .flow-actions button:not(.secondary),
  .done-panel button:first-of-type {
    border: 0;
    background: var(--color-primary);
    color: var(--color-cream);
    padding: 0 var(--space-6);
  }
  .done-panel {
    text-align: center;
  }
  .diagnosis-result {
    width: 100%;
    display: grid;
    justify-items: start;
    gap: var(--space-3);
    border-radius: 8px;
    padding: var(--space-6);
    text-align: left;
  }
  .diagnosis-result.danger { background: var(--color-alert-soft); color: #7a371f; }
  .diagnosis-result.success { background: var(--color-sage-soft); color: #374136; }
  .diagnosis-result.warning { background: var(--color-gold-wash); color: #6d4d11; }
  .diagnosis-result.info { background: rgba(255, 250, 241, 0.92); color: var(--color-text); }
  .diagnosis-result span {
    border-radius: var(--radius-full);
    padding: 4px 10px;
    background: rgba(255,255,255,0.72);
    font-size: var(--text-xs);
    font-weight: 650;
  }
  .diagnosis-result h1,
  .diagnosis-result p {
    margin: 0;
  }
  .diagnosis-result strong {
    font-size: var(--text-sm);
  }
  .result-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .receipt-copy-message {
    border-radius: 8px;
    padding: 10px 12px;
    background: rgba(184, 138, 43, 0.12);
    color: #6d4d11;
    font-size: var(--text-sm);
    font-weight: 800;
  }
  .result-actions a,
  .result-actions button {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--radius-full);
    padding: 0 var(--space-5, 1.25rem);
    background: var(--color-primary);
    color: var(--color-cream);
    text-decoration: none;
    font-weight: 680;
  }
  .done-panel a,
  .done-panel button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 var(--space-5, 1.25rem);
  }
  .done-panel button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .spin {
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @media (max-width: 640px) {
    .photo-request-page {
      padding: 0;
      overflow-x: hidden;
    }
    .photo-flow {
      width: 100%;
      padding: 2.25rem 18px 4.75rem;
    }
    .flow-panel {
      min-width: 0;
    }
    .flow-panel {
      gap: 1.125rem;
      padding: 2rem 1.25rem 1.5rem;
      border-radius: var(--radius-md);
      box-shadow: 0 14px 32px rgba(34, 33, 29, 0.065);
    }
    .photo-brand-kicker {
      margin-top: 0.375rem;
    }
    .flow-panel h1 {
      font-size: var(--text-lg);
      line-height: 1.3;
    }
    .flow-lead {
      margin: -0.25rem 0 0.125rem;
      line-height: 1.7;
    }
    .step-indicator {
      grid-template-columns: auto;
      margin: 0 0 0.875rem;
      padding-inline: 0.125rem;
    }
    .step-indicator span {
      display: block;
      font-size: 0.875rem;
      line-height: 1.2;
    }
    .step-indicator p {
      display: none;
    }
    .diagnosis-service-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
      margin-top: 0.125rem;
    }
    .diagnosis-service-grid button,
    .flow-actions button,
    .done-panel button,
    .done-panel a {
      min-height: 48px;
    }
    .photo-guide-cards {
      grid-template-columns: 1fr;
    }
    .photo-slot-grid {
      grid-template-columns: 1fr;
      gap: 0.875rem;
    }
    .photo-slot {
      aspect-ratio: 1.55;
    }
    .notice-choice {
      min-height: 80px;
      padding: 0.875rem 1rem;
    }
    .flow-actions {
      position: sticky;
      bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
      z-index: 2;
      align-items: center;
      gap: 0.75rem;
      margin-top: 1.125rem;
    }
    .flow-actions button {
      min-width: 112px;
    }
    .flow-actions button:not(.secondary) {
      flex: 1;
    }
  }
  @media (max-width: 390px) {
    .photo-flow {
      padding-inline: 16px;
    }
    .flow-panel {
      padding-inline: 1rem;
    }
  }
`;
