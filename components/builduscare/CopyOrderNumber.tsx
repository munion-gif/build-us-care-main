"use client";

import { useState } from "react";

// 주문번호 + 복사 버튼. 텍스트 자체는 드래그 선택이 막혀 있어, 이 버튼으로만 복사할 수 있습니다.
export function CopyOrderNumber({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = String(value ?? "");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API가 막힌 환경 폴백
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span className={`copy-ordernum${className ? ` ${className}` : ""}`}>
      <span className="copy-ordernum-val">{value}</span>
      <button type="button" className="copy-ordernum-btn" onClick={copy} aria-label="주문번호 복사">
        {copied ? "복사됨 ✓" : "복사"}
      </button>
    </span>
  );
}
