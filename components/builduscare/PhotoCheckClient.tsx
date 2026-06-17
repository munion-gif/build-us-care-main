"use client";

import Link from "next/link";
import { AlertCircle, Check, ChevronRight, ImagePlus, Info, MapPin, MessageCircle, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AddressModal, type AddressSelection } from "@/components/common/AddressModal";
import { MobileAppBar } from "@/components/builduscare/MobileAppChrome";
import { appendOptimizedPhotos } from "@/components/builduscare/photo-upload-utils";

const DEFAULT_PHOTO_CHECK_ITEM = "사진 확인";
const ORDER_RESULT_STORAGE_KEY = "builduscare:lastOrderResult";

type PhotoResult = {
  orderNumber: string;
  photoCount: number;
};

type PhotoEntry = {
  file: File;
  url: string;
};

function normalizedPhotoCheckItem(value: string | null | undefined) {
  const item = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!item) return DEFAULT_PHOTO_CHECK_ITEM;
  return item.slice(0, 40);
}

export function PhotoCheckClient() {
  const [item, setItem] = useState(DEFAULT_PHOTO_CHECK_ITEM);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [roadAddress, setRoadAddress] = useState("");
  const [detailAddress, setDetailAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [memo, setMemo] = useState("");
  const [photoGroups, setPhotoGroups] = useState<PhotoEntry[][]>([[], [], []]);
  const photoGroupsRef = useRef(photoGroups);
  const [regionConfirmed, setRegionConfirmed] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PhotoResult | null>(null);
  const photoLabels = ["전체", "문제부위", "규격·연결부"];
  const uploadedPhotos = photoGroups.flat().map((entry) => entry.file);
  const canSubmit =
    customerName.trim().length > 0 &&
    phone.replace(/\D/g, "").length >= 10 &&
    roadAddress.trim().length > 0 &&
    detailAddress.trim().length > 0 &&
    regionConfirmed &&
    photoGroups[0].length >= 3 &&
    privacyAccepted &&
    !submitting;

  useEffect(() => {
    try {
      const nextItem = normalizedPhotoCheckItem(new URL(window.location.href).searchParams.get("item"));
      setItem(nextItem);
    } catch {
      setItem(DEFAULT_PHOTO_CHECK_ITEM);
    }
  }, []);

  function handleAddressSelect(address: AddressSelection) {
    setRoadAddress(address.road_address);
    setPostalCode(address.postal_code);
  }

  useEffect(() => {
    photoGroupsRef.current = photoGroups;
  }, [photoGroups]);

  useEffect(() => {
    return () => {
      photoGroupsRef.current.flat().forEach((entry) => URL.revokeObjectURL(entry.url));
    };
  }, []);

  function updateGroupFiles(groupIndex: number, fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setPhotoGroups((current) => {
      const next = current.map((group) => [...group]);
      const currentGroup = next[groupIndex] ?? [];
      const remaining = Math.max(0, 3 - currentGroup.length);
      const nextFiles = files.slice(0, remaining).map((file) => ({
        file,
        url: URL.createObjectURL(file)
      }));
      if (!nextFiles.length) return current;
      next[groupIndex] = [...currentGroup, ...nextFiles];
      return next;
    });
  }

  function removeGroupPhoto(groupIndex: number, photoIndex: number) {
    setPhotoGroups((current) => {
      const next = current.map((group) => [...group]);
      const [removed] = next[groupIndex].splice(photoIndex, 1);
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  }

  async function submitPhotoCheck() {
    setError("");
    setResult(null);
    if (!customerName.trim() || !phone.trim() || !roadAddress.trim() || !detailAddress.trim()) {
      setError("성함, 연락처, 주소와 상세 주소를 입력해주세요.");
      return;
    }
    if (!regionConfirmed) {
      setError("예약 가능 지역 여부를 확인해주세요.");
      return;
    }
    if (photoGroups[0].length < 3) {
      setError("교체할 곳 1의 사진 3장을 올려주세요.");
      return;
    }
    if (!privacyAccepted) {
      setError("개인정보 수집·이용에 동의해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("payload", JSON.stringify({
        deviceType: window.innerWidth <= 760 ? "mobile" : "desktop",
        item,
        customer: { name: customerName.trim(), phone: phone.trim() },
        address: { roadAddress: roadAddress.trim(), detailAddress: detailAddress.trim(), postalCode },
        reservation: { date: null, time: null },
        selected: [],
        totals: { productAmount: 0, laborAmount: 0, disposalAmount: 0, totalAmount: 0 },
        memo: memo.trim()
      }));
      await appendOptimizedPhotos(formData, uploadedPhotos);
      const response = await fetch("/api/builduscare/photo-checks", { method: "POST", body: formData });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? json?.message ?? "사진 확인 접수에 실패했어요.");
      }
      const order = json.data?.order;
      const orderNumber = String(order?.orderNumber ?? "");
      if (orderNumber) {
        window.localStorage.setItem("builduscare:lastOrderNumber", orderNumber);
        window.localStorage.setItem("builduscare:lastCustomerName", customerName.trim());
        window.localStorage.setItem(ORDER_RESULT_STORAGE_KEY, JSON.stringify({
          ...order,
          orderNumber,
          customerName: order?.customerName ?? customerName.trim(),
          phone: order?.phone ?? phone.trim(),
          roadAddress: order?.roadAddress ?? roadAddress.trim(),
          detailAddress: order?.detailAddress ?? detailAddress.trim(),
          item
        }));
      }
      setResult({ orderNumber, photoCount: uploadedPhotos.length });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "사진 확인 접수에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <main className="bc-page photo-check-page">
        <MobileAppBar title="접수 완료" backHref="/photo-check" />
        <div className="wrap narrow" style={{ textAlign: "center" }}>
          <div className="featured-icon circle" style={{ width: 76, height: 76, background: "var(--success-50)", color: "var(--success-600)", margin: "24px auto 0" }}>
            <Check aria-hidden="true" style={{ width: 38, height: 38 }} />
          </div>
          <h1 className="web-h2" style={{ marginTop: 18 }}>신청이 접수됐어요</h1>
          <p className="web-lede" style={{ fontSize: 16, marginTop: 8 }}>영업시간 기준 2시간 내 견적을 카카오톡으로 안내해 드릴게요.</p>
          <div className="bcard pad" style={{ padding: 22, textAlign: "left", maxWidth: 440, margin: "22px auto 0" }}>
            <div className="between"><div className="p-sm strong" style={{ color: "var(--gray-700)" }}>접수번호</div><div className="p-sm strong">{result.orderNumber}</div></div>
            <div className="between" style={{ marginTop: 8 }}><div className="p-sm strong" style={{ color: "var(--gray-700)" }}>현재 상태</div><span className="badge badge-warning dot">확인 중</span></div>
            <div className="divline" style={{ margin: "12px 0" }}></div>
            <div className="row gap10">
              <span className="tile" style={{ width: 38, height: 38 }}><ImagePlus aria-hidden="true" style={{ width: 20, height: 20 }} /></span>
              <div className="grow">
                <div className="p-sm strong" style={{ color: "var(--gray-900)" }}>{item} · 사진 {result.photoCount}장</div>
                <div className="p-sm">{roadAddress || "주소 확인 중"} · 확인 중</div>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 10, maxWidth: 360, margin: "16px auto 0" }}>
            <a className="web-btn kkbtn lg block" href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" style={{ width: 18, height: 18 }} /> 카카오톡으로 결과 알림 받기</a>
            <Link className="web-btn sec lg block" href="/">홈으로</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bc-page photo-check-page">
      <MobileAppBar title="사진으로 호환제품 문의" backHref="/products" />
      <div className="wrap narrow">
        <div className="stepline" aria-label="진행 단계">
          <span>제품 선택</span><ChevronRight aria-hidden="true" /><span className="on">사진 확인</span><ChevronRight aria-hidden="true" /><span>예약</span><ChevronRight aria-hidden="true" /><span>접수</span>
        </div>
        <h1 className="web-h2" style={{ margin: "14px 0 6px" }}>사진 3장으로 먼저 확인해 드립니다.</h1>
        <p className="web-lede" style={{ fontSize: 16 }}>
          <span className="photo-check-lede-desktop">전체 · 문제부위 · 규격/연결부를 올려주세요. 매니저가 직접 확인합니다.</span>
          <span className="photo-check-lede-mobile">교체할 곳마다 전체·문제부위·규격/연결부를 올려주세요. 매니저가 직접 확인합니다.</span>
        </p>

        <section className="bcard pad photo-upload-card" style={{ padding: 24, marginTop: 24 }}>
          {[0, 1, 2].map((groupIndex) => {
            const groupFiles = photoGroups[groupIndex] ?? [];
            return (
              <div key={groupIndex} style={groupIndex > 0 ? { marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--gray-100)" } : undefined}>
                <input
                  id={`photo-check-group-${groupIndex}`}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(event) => {
                    updateGroupFiles(groupIndex, event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
                <div className="between" style={{ marginBottom: 10 }}>
                  <div className="p-sm strong" style={{ color: "var(--gray-700)" }}>
                    교체할 곳 {groupIndex + 1}
                    <span className={groupIndex === 0 ? "bc-required-pill" : "bc-optional-pill"}>{groupIndex === 0 ? "필수" : "선택"}</span>
                  </div>
                  <div className="p-sm" style={{ color: "var(--gray-500)" }}>{groupFiles.length} / 3장</div>
                </div>
                <div className="slots">
                  {photoLabels.map((label, index) => {
                    const entry = groupFiles[index];
                    return entry ? (
                      <div key={label} className="slot filled has-photo" style={{ aspectRatio: "1" }}>
                        <img src={entry.url} alt={label} />
                        <button type="button" className="slot-remove" onClick={() => removeGroupPhoto(groupIndex, index)} aria-label="사진 삭제">
                          <X aria-hidden="true" />
                        </button>
                        <span className="ph-tag">{label}</span>
                        <span className="slot-name">{entry.file.name}</span>
                        <span className="ph-check"><Check aria-hidden="true" /></span>
                      </div>
                    ) : (
                      <label key={label} className="slot" style={{ aspectRatio: "1" }} htmlFor={`photo-check-group-${groupIndex}`}>
                        <>
                          <Plus className="sl-ic" aria-hidden="true" />
                          <span className="sl-t">{label}</span>
                        </>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="note info" style={{ marginTop: 16 }}><Info aria-hidden="true" /><div>교체할 곳이 여러 곳이면 <b>곳마다</b> 사진을 올려주세요. <b>교체할 곳 1</b>의 사진 3장은 필수, 2·3은 선택이에요.</div></div>
          <div className="note" style={{ marginTop: 10, background: "#FEF8D6", color: "#46443d", display: "flex", gap: 9, padding: "13px 15px", borderRadius: 14, fontSize: 13, lineHeight: 1.6 }}>
            <MessageCircle aria-hidden="true" style={{ width: 18, height: 18, flex: "none", color: "#9a8a00" }} />
            <div>교체할 곳이 <b>3곳보다 많다면</b> 카카오톡 실시간 상담으로 도와드려요.<span className="photo-extra-help"> 사진을 보내주시면 빠르게 확인해 드립니다.</span></div>
          </div>
          <a className="web-btn kkbtn photo-kakao-btn" style={{ marginTop: 10 }} href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" style={{ width: 18, height: 18 }} /> 카카오톡 실시간 상담</a>
        </section>

        <section className="bcard pad photo-memo-card" style={{ padding: 24, marginTop: 18 }}>
          <div className="h-md">문의 내용을 적어주세요</div>
          <p className="p-sm" style={{ marginTop: 6, color: "var(--gray-500)" }}>
            교체하고 싶은 제품이나 증상을 자유롭게 적어주세요. 사진과 함께 매니저가 확인합니다.
          </p>
          <textarea
            className="input photo-memo-input"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder={"예: 세면수전과 샤워 욕조수전을 교체하고 싶어요.\n집 전체 조명을 교체하고 싶어요.\n수전에서 물이 새요."}
            rows={5}
            style={{ marginTop: 16, minHeight: 128, resize: "vertical", lineHeight: 1.6 }}
          />
        </section>

        <section className="bcard pad" style={{ padding: 24, marginTop: 18 }}>
          <div className="h-md">연락 받을 정보</div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>시공 받을 지역</label>
            <button type="button" className={`input addr-trigger${roadAddress ? "" : " empty"}`} onClick={() => setAddressOpen(true)}>
              <span className="addr-trigger-txt">{roadAddress || "주소 검색"}</span>
              <Search aria-hidden="true" />
            </button>
            {postalCode && <div className="addr-postal">우편번호 {postalCode}</div>}
            {roadAddress && <input className="input addr-detail" placeholder="상세 주소 (동·호수)" value={detailAddress} onChange={(event) => setDetailAddress(event.target.value)} />}
          </div>
          <div className="row gap16" style={{ marginTop: 14, alignItems: "flex-start" }}>
            <div className="field grow"><label>성함</label><input className="input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="홍길동" /></div>
            <div className="field grow"><label>연락 받을 번호</label><input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="010-0000-0000" inputMode="tel" /></div>
          </div>
          <div className="note info photo-contact-note" style={{ marginTop: 14 }}><Info aria-hidden="true" /><div>이 번호로 사진 확인 결과와 예상 견적을 안내드려요.</div></div>
          <div className="note region" style={{ marginTop: 10 }}><MapPin aria-hidden="true" /><div><b>예약 가능 지역</b> · 수원 · 성남(분당구) · 용인 · 의왕 · 군포 · 화성(동탄)<span className="region-soon">추후 확장 예정</span></div></div>
          <label className="disp-opt region-check">
            <input type="checkbox" checked={regionConfirmed} onChange={(event) => setRegionConfirmed(event.target.checked)} />
            <span className="disp-box"></span>
            <span className="disp-txt">
              우리 집이 예약 가능 지역이 맞나요?
              <span className="disp-sub photo-region-sub-desktop">위 지역에 해당해야 예약을 진행할 수 있어요. 맞으면 체크해 주세요.</span>
              <span className="disp-sub photo-region-sub-mobile">위 지역에 해당해야 진행할 수 있어요. 맞으면 체크해 주세요.</span>
            </span>
          </label>
          <label className="disp-opt region-check" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
            <span className="disp-box"></span>
            <span className="disp-txt">
              개인정보 수집·이용에 동의합니다 <Link href="/privacy" style={{ color: "#245FFF", fontWeight: 600 }} target="_blank">(보기)</Link>
              <span className="disp-sub photo-privacy-sub-desktop">사진 확인·연락 목적으로 이름·연락처·주소·사진을 수집하며, 목적 달성 후 파기합니다. (필수)</span>
              <span className="disp-sub photo-privacy-sub-mobile">사진 확인·연락 목적으로 수집하며, 목적 달성 후 파기합니다. (필수)</span>
            </span>
          </label>
        </section>

        {error && <div className="note" style={{ marginTop: 14, background: "#FDECEC", color: "#B42318", display: "flex", gap: 9, padding: "13px 15px", borderRadius: 14, fontSize: 13 }}><AlertCircle aria-hidden="true" style={{ width: 18, height: 18, flex: "none" }} /><div>{error}</div></div>}

        <button className="web-btn pri lg block desktop-submit-btn" type="button" style={{ marginTop: 20 }} aria-disabled={canSubmit ? "false" : "true"} disabled={submitting} onClick={submitPhotoCheck}>
          {submitting ? "접수 저장 중..." : "사진으로 호환제품 문의접수 하기"}
        </button>
        <div className="bc-mobile-only mobile-fixed-submit">
          <button className="web-btn pri lg block" type="button" aria-disabled={canSubmit ? "false" : "true"} disabled={submitting} onClick={submitPhotoCheck}>
            {submitting ? "접수 저장 중..." : "사진으로 호환제품 문의접수 하기"}
          </button>
        </div>
      </div>
      <AddressModal open={addressOpen} onClose={() => setAddressOpen(false)} onSelect={handleAddressSelect} />
    </main>
  );
}
