"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Check, ChevronLeft, Copy, Loader2, MapPin, X } from "lucide-react";
import { AddressModal, type AddressSelection } from "@/components/common/AddressModal";
import { EVENT_TYPES } from "@/lib/event-types";
import { customerErrorMessage } from "@/lib/error-messages";
import { getKakaoChannelChatUrl } from "@/lib/kakao-channel";
import { CUSTOMER_PHOTO_SLOTS } from "@/lib/photo-guides";
import { PUBLIC_SERVICE_CODES, SERVICE_AREA_LABEL } from "@/lib/public-services";
import type { QuoteServiceItem } from "@/lib/service-items";
import { useTracking } from "@/lib/use-tracking";

type PhotoRequestClientProps = {
  services: QuoteServiceItem[];
  kakaoUrl: string | null;
};

const PHOTO_REQUEST_TOTAL_STEPS = 3;
const PHOTO_SERVICE_LABELS: Record<string, string> = {
  toilet_replace: "양변기",
  basin_replace: "세면대",
  faucet_replace: "수전",
  bidet_install: "비데",
  ventilator_replace: "환풍기",
  sash_handle: "샷시손잡이",
  door_handle: "도어핸들",
  silicone_repair: "실리콘"
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function isValidKoreanMobile(phone: string) {
  return /^010\d{8}$/.test(normalizePhone(phone));
}

function selectedPhotoFiles(files: File[]) {
  return files.filter((file): file is File => file instanceof File);
}

export function PhotoRequestClient({ services, kakaoUrl }: PhotoRequestClientProps) {
  const [step, setStep] = useState(1);
  const [serviceCode, setServiceCode] = useState("toilet_replace");
  const [files, setFiles] = useState<File[]>([]);
  const [requestDetail, setRequestDetail] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", serviceAreaConfirmed: false, customerInfoConsent: false, kakaoNotice: true });
  const [address, setAddress] = useState({ road_address: "", detail_address: "", postal_code: "" });
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);
  const { track } = useTracking();
  const kakaoChatUrl = getKakaoChannelChatUrl(kakaoUrl);
  const addressFull = `${address.road_address} ${address.detail_address}`.trim();
  const visibleServices = useMemo(
    () =>
      PUBLIC_SERVICE_CODES.map((code) => services.find((service) => service.service_type_code === code)).filter(
        (service): service is QuoteServiceItem => Boolean(service)
      ),
    [services]
  );

  function handleAddressSelect(nextAddress: AddressSelection) {
    setAddress((current) => ({
      ...current,
      road_address: nextAddress.road_address,
      postal_code: nextAddress.postal_code
    }));
  }

  function goNext() {
    if (step === 1 && !serviceCode) {
      setMessage("작업을 먼저 선택해주세요.");
      return;
    }
    if (step === 2 && selectedPhotoFiles(files).length === 0) {
      setMessage("사진을 최소 1장 올려주세요.");
      return;
    }
    if (step === 2 && !requestDetail.trim()) {
      setMessage("수리 내용을 간단히 적어주세요.");
      return;
    }
    if (step === 2 && (!customer.name.trim() || !isValidKoreanMobile(customer.phone))) {
      setMessage("이름과 010 전화번호를 확인해주세요.");
      return;
    }
    if (step === 2 && !address.road_address) {
      setMessage("주소를 먼저 검색해주세요.");
      return;
    }
    if (step === 2 && address.detail_address.trim().length < 2) {
      setMessage("상세주소를 2자 이상 입력해주세요.");
      return;
    }
    if (step === 2 && !customer.customerInfoConsent) {
      setMessage("개인정보 수집·이용 동의를 확인해주세요.");
      return;
    }
    if (step === 2 && !customer.serviceAreaConfirmed) {
      setMessage("작업 가능 지역에 해당하는지 확인해주세요.");
      return;
    }
    setMessage("");
    setStep((current) => Math.min(current + 1, PHOTO_REQUEST_TOTAL_STEPS));
  }

  async function uploadTempPhoto(file: File) {
    const response = await fetch("/api/storage/upload-temp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type || "image/jpeg" })
    });
    const json = await response.json();
    if (!response.ok) throw new Error(customerErrorMessage(json?.error, "사진 업로드 준비를 완료하지 못했어요."));

    const uploadResponse = await fetch(json.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "image/jpeg" },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error("사진 업로드에 실패했어요. 잠시 후 다시 시도해주세요.");
    }

    return json.data.path as string;
  }

  async function submitDiagnosis() {
    setLoading(true);
    setMessage("사진을 올리고 있어요.");
    setReceipt(null);
    try {
      const paths = [];
      const photos = selectedPhotoFiles(files);

      if (photos.length === 0) {
        throw new Error("사진을 최소 1장 올려주세요.");
      }
      if (!requestDetail.trim()) {
        throw new Error("수리 내용을 간단히 적어주세요.");
      }
      if (!customer.name.trim() || !isValidKoreanMobile(customer.phone)) {
        throw new Error("이름과 010 전화번호를 확인해주세요.");
      }
      if (!address.road_address) {
        throw new Error("주소를 먼저 검색해주세요.");
      }
      if (address.detail_address.trim().length < 2) {
        throw new Error("상세주소를 2자 이상 입력해주세요.");
      }
      if (!customer.customerInfoConsent) {
        throw new Error("개인정보 수집·이용 동의를 확인해주세요.");
      }
      if (!customer.serviceAreaConfirmed) {
        throw new Error("작업 가능 지역에 해당하는지 확인해주세요.");
      }

      for (const file of photos) {
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
          phone: normalizePhone(customer.phone),
          address: addressFull,
          serviceAreaConfirmed: customer.serviceAreaConfirmed,
          customerInfoConsent: customer.customerInfoConsent,
          requestDetail: requestDetail.trim()
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(customerErrorMessage(json?.error, "사진 확인 요청을 다시 확인해주세요."));
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
        <div className="flow-panel">
          <span className="photo-brand-kicker">build us care</span>
          {step === 1 && (
            <>
              <h1>어떤 작업이 필요하세요?</h1>
              <p className="step-lead">
                <span>정확하지 않아도 됩니다. 사진을 보고 호환되는 제품과 견적을 보내드립니다.</span>
                <span>원하시는 제품이 있다면 카톡상담을 부탁드립니다.</span>
              </p>
            <div className="diagnosis-service-grid">
              {visibleServices.map((service) => (
                <button key={service.service_type_code} className={serviceCode === service.service_type_code ? "selected" : ""} onClick={() => setServiceCode(service.service_type_code)}>
                  {PHOTO_SERVICE_LABELS[service.service_type_code] ?? service.display_name}
                </button>
              ))}
            </div>
            </>
          )}

          {step === 2 && (
            <>
            <h1>사진 3장을 올려주세요</h1>
            <div className="photo-guide-cards" aria-label="사진 촬영 가이드">
              {CUSTOMER_PHOTO_SLOTS.map((slot, index) => (
                <span key={slot.angle}>{index + 1} {slot.label}</span>
              ))}
            </div>
            <PhotoSlots files={files} onChange={setFiles} />
            <section className="photo-inline-form" aria-label="수리 내용과 연락처">
              <label className="field-label">
                <span>
                  수리 내용 <b aria-hidden="true">*</b>
                </span>
                <small>예: 세면수전과 샤워 욕조수전을 교체하고 싶어요. 집 전체 조명을 교체하고 싶어요. 수전에서 물이 새요.</small>
                <textarea
                  value={requestDetail}
                  onChange={(event) => setRequestDetail(event.target.value)}
                  placeholder="어떤 부분이 문제인지 간단히 알려주세요"
                  rows={3}
                />
              </label>
              <div className="contact-field-grid">
                <label className="field-label">
                  <span>
                    이름 <b aria-hidden="true">*</b>
                  </span>
                  <input value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} placeholder="이름" />
                </label>
                <label className="field-label">
                  <span>
                    연락처 <b aria-hidden="true">*</b>
                  </span>
                  <input value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} placeholder="010-XXXX-XXXX" />
                </label>
              </div>
              <label className="field-label">
                <span>
                  주소 <b aria-hidden="true">*</b>
                </span>
                <button className={address.road_address ? "address-trigger filled" : "address-trigger"} type="button" onClick={() => setAddressModalOpen(true)}>
                  <MapPin size={18} />
                  <strong>{address.road_address || "주소 검색"}</strong>
                  {address.postal_code && <small>우편번호 {address.postal_code}</small>}
                </button>
              </label>
              <label className="field-label">
                <span>
                  상세주소 <b aria-hidden="true">*</b>
                </span>
                <input
                  value={address.detail_address}
                  onChange={(event) => setAddress((current) => ({ ...current, detail_address: event.target.value }))}
                  placeholder="동/호수 또는 층 정보를 입력해주세요"
                />
              </label>
              <AddressModal open={addressModalOpen} onClose={() => setAddressModalOpen(false)} onSelect={handleAddressSelect} />
              <label className={customer.customerInfoConsent ? "customer-privacy-check selected" : "customer-privacy-check"}>
                <input
                  type="checkbox"
                  checked={customer.customerInfoConsent}
                  onChange={(event) => setCustomer((current) => ({ ...current, customerInfoConsent: event.target.checked }))}
                />
                <span className="customer-privacy-check-icon">{customer.customerInfoConsent ? <Check size={15} /> : null}</span>
                <span>
                  <strong>
                    개인정보 수집·이용 동의 <em>(필수)</em>
                  </strong>
                  <a href="/privacy" target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                    내용보기
                  </a>
                </span>
              </label>
              <label className={customer.serviceAreaConfirmed ? "service-area-check selected" : "service-area-check"}>
                <input
                  type="checkbox"
                  checked={customer.serviceAreaConfirmed}
                  onChange={(event) => setCustomer((current) => ({ ...current, serviceAreaConfirmed: event.target.checked }))}
                />
                <span className="service-area-check-icon">{customer.serviceAreaConfirmed ? <Check size={15} /> : null}</span>
                <span>
                  <strong>작업 가능 지역에 해당합니다</strong>
                  <small>{SERVICE_AREA_LABEL}</small>
                </span>
              </label>
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
            </section>
            </>
          )}

          {step === 3 && (
            <div className="done-panel">
            {!receipt ? (
              <>
                <h1>사진 확인 접수를 완료하였습니다.</h1>
                <p>올려주신 사진과 연락처를 기준으로 호환 제품과 견적 가능 여부를 확인합니다.</p>
                <p>영업시간 기준 24시간 이내에 결과 안내를 이어갈게요.</p>
                <div className="done-panel-actions">
                  <button type="button" onClick={submitDiagnosis} disabled={loading}>
                    {loading ? <Loader2 className="spin" size={18} /> : null}
                    {loading ? "접수하고 있습니다..." : "사진 접수하기"}
                  </button>
                  <a href="/">홈으로 돌아가기</a>
                </div>
              </>
            ) : (
              <ReceiptComplete receipt={receipt} kakaoChatUrl={kakaoChatUrl} />
            )}
            </div>
          )}

        {message && <p className="flow-message">{message}</p>}
        {!(step === 3 && receipt) && (
          <div className={step === 3 ? "flow-actions confirm-actions" : "flow-actions"}>
            {step > 1 && (
              <button type="button" className="secondary" onClick={() => setStep((current) => current - 1)} disabled={loading}>
                <ChevronLeft size={18} />
                이전
              </button>
            )}
            {step < PHOTO_REQUEST_TOTAL_STEPS && (
              <button type="button" onClick={goNext}>
                {step === 2 ? "접수 확인" : "다음"}
              </button>
            )}
          </div>
        )}
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
      <p>원하시는 제품은 카톡 상담으로 보내주세요.</p>
      <p>접수번호를 카톡에 보내주시면 더 빠르게 확인할 수 있어요.</p>
      <p>방문은 교체 가능한 경우에만 예약 확정 후 진행합니다.</p>
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
      linear-gradient(90deg, rgba(34, 33, 29, 0.016) 1px, transparent 1px),
      linear-gradient(180deg, rgba(34, 33, 29, 0.016) 1px, transparent 1px),
      var(--color-bg);
    background-size: 34px 34px;
  }
  .photo-flow {
    width: min(920px, 100%);
    margin: 0 auto;
    padding-block: var(--space-6);
  }
  .flow-panel {
    position: relative;
    display: grid;
    gap: var(--space-4);
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    padding: var(--space-6);
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
    margin-top: 6px;
    color: var(--color-text-muted);
    font-family: var(--font-brand);
    font-size: 12px;
    font-weight: var(--brand-label-weight);
    letter-spacing: var(--brand-letter-spacing);
    text-transform: lowercase;
  }
  .flow-panel h1 {
    margin: 0;
    font-size: var(--text-xl);
    line-height: var(--leading-xl);
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .flow-panel p,
  .flow-message {
    color: var(--color-text-muted);
  }
  .step-lead {
    display: grid;
    gap: 2px;
    max-width: 680px;
    margin: -2px 0 2px;
    line-height: 1.65;
    font-weight: 700;
    word-break: keep-all;
    overflow-wrap: break-word;
  }
  .step-lead span {
    display: block;
  }
  .diagnosis-service-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
    font-weight: 600;
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
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 0 var(--space-3);
    background: rgba(168, 176, 162, 0.18);
    color: var(--color-text);
    font-size: var(--text-xs);
    font-weight: 600;
    line-height: 1.35;
  }
  .photo-guide-cards span:nth-child(2) {
    background: var(--color-gold-wash);
  }
  .photo-guide-cards span:nth-child(3) {
    border-color: rgba(184, 138, 43, 0.24);
    background: rgba(244, 234, 212, 0.58);
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
    font-size: var(--text-caption);
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
    font-size: var(--text-caption);
    font-weight: 600;
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
  .photo-inline-form {
    display: grid;
    gap: var(--space-4);
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-4);
  }
  .field-label {
    display: grid;
    gap: 8px;
    color: var(--color-text);
    font-weight: 700;
  }
  .field-label b {
    color: #dc2626;
    font-weight: 700;
  }
  .field-label small {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-weight: 600;
    line-height: 1.45;
  }
  .contact-field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .flow-panel input[type="text"],
  .flow-panel input:not([type]) {
    min-height: 52px;
  }
  .flow-panel input,
  .flow-panel textarea {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
  }
  .flow-panel input {
    padding: 0 var(--space-4);
  }
  .flow-panel textarea {
    min-height: 94px;
    padding: var(--space-3) var(--space-4);
    resize: vertical;
  }
  .address-trigger {
    width: 100%;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0 var(--space-4);
    background: var(--color-surface);
    color: var(--color-text-muted);
    font: inherit;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }
  .address-trigger.filled {
    color: var(--color-text);
  }
  .address-trigger svg {
    flex: 0 0 auto;
    color: var(--color-primary);
  }
  .address-trigger strong {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .address-trigger small {
    margin-left: auto;
    color: var(--color-text-muted);
    font-size: var(--text-caption);
    white-space: nowrap;
  }
  .address-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: 18px;
    background: rgba(0, 0, 0, 0.48);
  }
  .address-modal {
    width: min(720px, 100%);
    height: min(620px, 86vh);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    border-radius: 8px;
    background: #fff;
  }
  .address-modal-header {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: center;
    border-bottom: 1px solid var(--color-border);
    padding: 14px 16px;
  }
  .address-modal-header p,
  .address-modal-error {
    margin: 4px 0 0;
    color: var(--color-text-muted);
  }
  .address-modal-header button {
    min-width: 64px;
    height: 40px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    font-weight: 700;
    cursor: pointer;
  }
  .address-modal-frame {
    min-height: 0;
  }
  .address-modal-error {
    padding: 18px;
  }
  .service-area-check {
    position: relative;
    display: flex;
    gap: var(--space-3);
    align-items: center;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    transition: border-color var(--transition), background var(--transition), box-shadow var(--transition);
  }
  .service-area-check.selected {
    border-color: rgba(184, 138, 43, 0.42);
    background: rgba(244, 234, 212, 0.58);
  }
  .service-area-check:focus-within {
    outline: 3px solid rgba(184, 138, 43, 0.18);
    outline-offset: 2px;
  }
  .service-area-check input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .service-area-check-icon {
    flex: 0 0 auto;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-primary);
  }
  .service-area-check.selected .service-area-check-icon {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-cream);
  }
  .service-area-check > span:last-child {
    display: grid;
    gap: 3px;
    min-width: 0;
  }
  .service-area-check strong {
    font-size: var(--text-sm);
  }
  .service-area-check small {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    line-height: 1.45;
  }
  .customer-privacy-check {
    position: relative;
    width: fit-content;
    max-width: 100%;
    display: inline-flex;
    gap: 9px;
    align-items: center;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 8px 10px;
    background: rgba(255, 250, 241, 0.78);
    color: var(--color-text);
    cursor: pointer;
    transition: border-color var(--transition), background var(--transition), box-shadow var(--transition);
  }
  .customer-privacy-check.selected {
    border-color: rgba(184, 138, 43, 0.5);
    background: rgba(244, 234, 212, 0.58);
  }
  .customer-privacy-check:focus-within {
    outline: 3px solid rgba(184, 138, 43, 0.18);
    outline-offset: 2px;
  }
  .customer-privacy-check input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .customer-privacy-check-icon {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-primary);
  }
  .customer-privacy-check.selected .customer-privacy-check-icon {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: var(--color-cream);
  }
  .customer-privacy-check > span:last-child {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .customer-privacy-check strong {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 5px;
    color: var(--color-text);
    font-size: var(--text-sm);
    line-height: var(--leading-sm);
    white-space: nowrap;
  }
  .customer-privacy-check em {
    color: var(--color-text-muted);
    font-style: normal;
  }
  .customer-privacy-check a {
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
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
  .flow-actions.confirm-actions {
    margin-top: var(--space-5);
  }
  .flow-actions.confirm-actions .secondary {
    min-width: 88px;
    padding: 0 16px;
  }
  .flow-actions button:not(.secondary),
  .done-panel button:first-of-type {
    border: 0;
    background: var(--color-primary);
    color: var(--color-cream);
    padding: 0 var(--space-6);
  }
  .done-panel {
    display: grid;
    justify-items: center;
    gap: 10px;
    padding-block: clamp(28px, 5vw, 56px);
    text-align: center;
  }
  .done-panel h1,
  .done-panel p {
    margin: 0;
  }
  .done-panel p {
    max-width: 680px;
    line-height: 1.7;
    word-break: keep-all;
    overflow-wrap: break-word;
  }
  .done-panel-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
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
    font-weight: 600;
  }
  .diagnosis-result h1,
  .diagnosis-result p {
    margin: 0;
  }
  .diagnosis-result p {
    line-height: 1.65;
    word-break: keep-all;
    overflow-wrap: break-word;
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
    font-weight: 700;
  }
  .result-actions a,
  .result-actions button {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: var(--radius-full);
    padding: 0 var(--space-5, 1.25rem);
    background: var(--color-primary);
    color: var(--color-cream);
    text-decoration: none;
    font-weight: 700;
  }
  .done-panel a,
  .done-panel button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 148px;
    padding: 0 var(--space-5, 1.25rem);
  }
  .done-panel button:first-of-type {
    min-width: 176px;
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
    .contact-field-grid {
      grid-template-columns: 1fr;
    }
    .notice-choice {
      min-height: 80px;
      padding: 0.875rem 1rem;
    }
    .diagnosis-result {
      gap: 0.75rem;
      padding: 1rem 0 0;
    }
    .diagnosis-result.info {
      background: transparent;
    }
    .diagnosis-result h1 {
      line-height: 1.3;
    }
    .diagnosis-result p {
      font-size: var(--text-sm);
      line-height: 1.7;
    }
    .result-actions {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.625rem;
      margin-top: 0.25rem;
    }
    .result-actions a,
    .result-actions button {
      width: 100%;
      min-height: 48px;
      border-radius: 8px;
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
