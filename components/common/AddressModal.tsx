"use client";

import { useEffect, useRef, useState } from "react";

export type AddressSelection = {
  road_address: string;
  postal_code: string;
};

type KakaoPostcodeData = {
  zonecode: string;
  address: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: "R" | "J";
};

type AddressModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (address: AddressSelection) => void;
};

async function loadKakaoPostcodeScript() {
  if ((window as any).kakao?.Postcode) return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-kakao-postcode='true']");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("주소 검색을 불러오지 못했어요.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    script.dataset.kakaoPostcode = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("주소 검색을 불러오지 못했어요."));
    document.head.appendChild(script);
  });
}

export function AddressModal({ open, onClose, onSelect }: AddressModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    async function embedPostcode() {
      try {
        setMessage("");
        await loadKakaoPostcodeScript();
        if (cancelled || !containerRef.current || !(window as any).kakao?.Postcode) return;
        containerRef.current.innerHTML = "";
        new (window as any).kakao.Postcode({
          width: "100%",
          height: "100%",
          oncomplete: (data: KakaoPostcodeData) => {
            onSelect({
              road_address: data.userSelectedType === "R" ? data.roadAddress : data.jibunAddress || data.address,
              postal_code: data.zonecode
            });
            onClose();
          }
        }).embed(containerRef.current);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "주소 검색을 다시 시도해주세요.");
      }
    }

    void embedPostcode();
    return () => {
      cancelled = true;
    };
  }, [onClose, onSelect, open]);

  if (!open) return null;

  return (
    <div className="address-modal-backdrop" onMouseDown={onClose} role="presentation">
      <div className="address-modal" role="dialog" aria-modal="true" aria-label="주소 검색" onMouseDown={(event) => event.stopPropagation()}>
        <div className="address-modal-header">
          <div>
            <strong>주소 검색</strong>
            <p>도로명 주소를 선택해주세요.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">
            닫기
          </button>
        </div>
        {message ? <p className="address-modal-error">{message}</p> : <div ref={containerRef} className="address-modal-frame" />}
      </div>
    </div>
  );
}
