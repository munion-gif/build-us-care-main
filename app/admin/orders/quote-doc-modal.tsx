"use client";

import { useState } from "react";
import { buildQuoteDocumentHtml, saveQuoteAsImage, saveQuoteAsPdf, type QuoteDocumentInput } from "@/lib/quote-document";

export function QuoteDocModal({ doc, onClose }: { doc: QuoteDocumentInput; onClose: () => void }) {
  const [busy, setBusy] = useState<"pdf" | "jpg" | null>(null);
  const html = buildQuoteDocumentHtml(doc);

  async function save(kind: "pdf" | "jpg") {
    setBusy(kind);
    try {
      if (kind === "pdf") await saveQuoteAsPdf(doc);
      else await saveQuoteAsImage(doc);
    } catch {
      // no-op
    } finally {
      setBusy(null);
    }
  }

  function fit(e: React.SyntheticEvent<HTMLIFrameElement>) {
    const iframe = e.currentTarget;
    try {
      const d = iframe.contentDocument;
      const sheet = d?.querySelector<HTMLElement>(".sheet");
      if (!d || !sheet) return;
      d.documentElement.style.background = "#fffaf1";
      d.body.style.margin = "0";
      const scale = Math.min((iframe.clientWidth - 40) / sheet.scrollWidth, (iframe.clientHeight - 28) / sheet.scrollHeight, 1);
      (d.body.style as any).zoom = String(Math.max(0.3, scale));
    } catch {
      // cross-frame guard
    }
  }

  return (
    <div className="qd-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{QD_CSS}</style>
      <div className="qd-modal">
        <div className="qd-bar">
          <b>견적서 미리보기</b>
          <div className="qd-actions">
            <button type="button" className="qd-btn" onClick={() => save("pdf")} disabled={Boolean(busy)}>{busy === "pdf" ? "저장 중…" : "📄 PDF 저장"}</button>
            <button type="button" className="qd-btn" onClick={() => save("jpg")} disabled={Boolean(busy)}>{busy === "jpg" ? "저장 중…" : "🖼 JPG 저장"}</button>
            <button type="button" className="qd-btn x" onClick={onClose}>닫기</button>
          </div>
        </div>
        <iframe className="qd-frame" srcDoc={html} title="견적서" onLoad={fit} />
        <div className="qd-hint">💾 저장 시 <b>폴더를 직접 고를 수 있어요</b> (지원 브라우저). 안 되면 다운로드 폴더에 저장돼요.</div>
      </div>
    </div>
  );
}

const QD_CSS = `
.qd-overlay { position: fixed; inset: 0; background: rgba(16,24,40,.55); z-index: 60; display: flex; align-items: center; justify-content: center; padding: 24px; }
.qd-modal { background: #fff; border-radius: 16px; width: 96vw; height: 94vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 60px -20px rgba(0,0,0,.5); }
.qd-bar { display: flex; align-items: center; gap: 12px; padding: 13px 16px; border-bottom: 1px solid #e5e7eb; }
.qd-bar b { font-size: 14px; font-weight: 800; color: #101828; }
.qd-actions { margin-left: auto; display: flex; gap: 8px; }
.qd-btn { border: 1px solid #e5e7eb; background: #f2f4f7; color: #667085; font-weight: 800; font-size: 12.5px; padding: 8px 13px; border-radius: 9px; cursor: pointer; }
.qd-btn:hover { background: #eff4ff; border-color: #245fff; color: #1647d7; }
.qd-btn.x { background: #245fff; color: #fff; border-color: #245fff; }
.qd-btn:disabled { opacity: .55; cursor: default; }
.qd-frame { flex: 1; width: 100%; border: none; background: #fffaf1; }
.qd-hint { padding: 9px 16px; font-size: 11.5px; color: #98a2b3; border-top: 1px solid #e5e7eb; }
.qd-hint b { color: #667085; }
`;
