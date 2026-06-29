"use client";

import type { ProductSelection } from "@/components/builduscare/product-types";
import { colorChoiceLabel, selectionDisplayLabel } from "@/components/builduscare/product-helpers";
import type { BuilduscarePublicProduct } from "@/lib/builduscare-public-products";

export type EstimatePreviewPayload = {
  categoryTitle: string;
  allProducts?: BuilduscarePublicProduct[];
  selections: ProductSelection[];
  productAmount: number;
  laborAmount: number;
  shippingAmount?: number;
  disposalAmount: number;
  totalAmount: number;
  selfDisposal: boolean;
  categoryTitleByService: Record<string, string>;
  cashReceiptText?: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  addressText?: string;
  visitText?: string;
  title?: string;
};

export const ESTIMATE_PREVIEW_STORAGE_KEY = "builduscare:quotePreviewPayload";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function won(value: number) {
  return Number(value || 0).toLocaleString("ko-KR");
}

function absoluteImageSrc(src: string | null | undefined) {
  if (!src) return "";
  try {
    return new URL(src, window.location.origin).toString();
  } catch {
    return src;
  }
}

function todayText() {
  return new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" });
}

function laborRows(payload: EstimatePreviewPayload) {
  const grouped = new Map<string, { label: string; qty: number; amount: number }>();
  for (const item of payload.selections) {
    const key = item.product.serviceCode || payload.categoryTitle;
    const label = payload.categoryTitleByService[item.product.serviceCode] ?? payload.categoryTitle;
    const current = grouped.get(key) ?? { label, qty: 0, amount: 0 };
    current.qty += item.qty;
    current.amount += item.product.laborPrice * item.qty;
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

function summaryText(payload: EstimatePreviewPayload) {
  const labels = Array.from(
    new Set(payload.selections.map((item) => payload.categoryTitleByService[item.product.serviceCode] ?? payload.categoryTitle).filter(Boolean))
  );
  const units = payload.selections.reduce((sum, item) => sum + item.qty, 0);
  return `${labels.join(" · ") || payload.categoryTitle} · 선택 제품 ${payload.selections.length}종 · 총 ${units}개`;
}

function buildEstimatePreviewHtml(payload: EstimatePreviewPayload) {
  const displayNumber = payload.orderNumber || `BC-EST-${Date.now().toString().slice(-6)}`;
  const rowsHtml = payload.selections.map((item) => {
    const productName = `${item.product.brand} ${selectionDisplayLabel(item.product, colorChoiceLabel(item.selectedColor), payload.allProducts ?? [])}`.trim();
    const categoryLabel = payload.categoryTitleByService[item.product.serviceCode] ?? payload.categoryTitle;
    const image = absoluteImageSrc(item.product.image);
    return `
      <tr>
        <td class="photo-cell">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(productName)}" />` : ""}</td>
        <td class="sku-cell">${escapeHtml(item.product.sku || "-")}</td>
        <td>
          <div class="product-copy">
            <strong title="${escapeHtml(productName)}">${escapeHtml(productName)}</strong>
            <small>${escapeHtml(categoryLabel)}</small>
          </div>
        </td>
        <td class="c">${item.qty}</td>
        <td class="r">${won(item.product.roundedPrice * item.qty)}</td>
      </tr>
    `;
  }).join("");

  const laborHtml = laborRows(payload).map((row) => `
      <tr class="fee-row">
        <td colspan="3" class="fee-label">시공비 · ${escapeHtml(row.label)}</td>
        <td class="c">×${row.qty}</td>
        <td class="r">${won(row.amount)}</td>
      </tr>
  `).join("");

  const disposalHtml = `
      <tr class="fee-row">
        <td colspan="3" class="fee-label">배송비</td>
        <td class="c">-</td>
        <td class="r">${won(payload.shippingAmount ?? 0)}</td>
      </tr>
      <tr class="fee-row">
        <td colspan="3" class="fee-label">폐기물 처리비${payload.selfDisposal ? " (직접 처리)" : ""}</td>
        <td class="c">×${payload.selections.reduce((sum, item) => sum + item.qty, 0)}</td>
        <td class="r">${won(payload.disposalAmount)}</td>
      </tr>
  `;

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(payload.title || "최종 견적서")} · Build us Care</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f4f4f7; color: #1d1d1f; font-family: Arial, "Noto Sans KR", sans-serif; }
    main { padding: 28px 0; }
    .sheet { position: relative; width: min(720px, calc(100vw - 32px)); margin: 0 auto; border-radius: 26px; background: #fff; box-shadow: 0 20px 50px rgba(16,24,40,0.08); overflow: hidden; }
    .head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; padding: 30px 32px 22px; border-bottom: 2px solid #1d1d1f; }
    .head img { width: 128px; height: auto; object-fit: contain; }
    .head p { margin: 0 0 3px; color: #6e6e73; font-size: 11px; line-height: 16px; text-align: right; }
    .doc { padding: 24px 28px 18px; }
    h1 { margin: 0; color: #111; font-size: 22px; line-height: 30px; font-weight: 800; letter-spacing: -0.02em; }
    .summary { margin: 4px 0 18px; color: #6e6e73; font-size: 11px; line-height: 17px; }
    .meta-card { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid #d8d8de; border-radius: 18px; overflow: hidden; background: #fff; margin-bottom: 22px; }
    .meta-card > div { padding: 14px 18px; border-bottom: 1px solid #ececf0; }
    .meta-card > div:nth-child(odd):not(.full) { border-right: 1px solid #ececf0; }
    .meta-card > div.full { grid-column: 1 / -1; }
    .meta-card small { display: block; color: #8e8e93; font-size: 10px; line-height: 15px; font-weight: 700; }
    .meta-card strong { display: block; margin-top: 4px; color: #111; font-size: 13px; line-height: 20px; font-weight: 800; letter-spacing: -0.01em; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    col.photo { width: 52px; }
    col.sku { width: 64px; }
    col.qty { width: 72px; }
    col.amount { width: 96px; }
    th { padding: 9px 0; border-bottom: 1px solid #d2d2d7; color: #6e6e73; font-size: 10px; font-weight: 700; text-align: left; }
    td { padding: 10px 0; border-bottom: 1px solid #e5e5ea; vertical-align: top; font-size: 13px; line-height: 19px; }
    .photo-cell img { width: 40px; height: 40px; object-fit: contain; border-radius: 6px; background: #fff; }
    .sku-cell { color: #6e6e73; font-size: 10px; line-height: 15px; font-weight: 700; }
    .product-copy strong { display: block; color: #111; font-size: 13px; line-height: 19px; font-weight: 800; letter-spacing: -0.01em; }
    .product-copy small { display: block; margin-top: 2px; color: #8e8e93; font-size: 11px; line-height: 17px; font-weight: 700; }
    .c { text-align: center; white-space: nowrap; }
    .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 700; }
    .fee-row td { padding-top: 11px; padding-bottom: 11px; }
    .fee-label { color: #1d1d1f; font-weight: 800; }
    .total-row td { border-bottom: 2px solid #1d1d1f; font-weight: 800; }
    .vat { display: flex; justify-content: space-between; gap: 20px; align-items: center; margin-top: 22px; padding-top: 0; }
    .vat strong { display: block; color: #111; font-size: 16px; line-height: 23px; font-weight: 800; }
    .vat small { display: block; margin-top: 2px; color: #8e8e93; font-size: 11px; line-height: 17px; font-weight: 700; }
    .vat span { color: #245fff; font-size: 28px; line-height: 34px; font-weight: 800; letter-spacing: -0.02em; text-align: right; }
    .actions { display: flex; justify-content: center; gap: 10px; padding: 0 28px 22px; }
    .btn { min-width: 138px; min-height: 48px; border-radius: 999px; font-size: 16px; font-weight: 800; cursor: pointer; }
    .btn-sec { border: 1px solid #d2d2d7; background: #fff; color: #1d1d1f; }
    .btn-pri { border: 0; background: #245fff; color: #fff; }
    @media (max-width: 520px) {
      main { padding: 0; }
      .sheet { width: 100%; min-height: 100vh; border-radius: 0; box-shadow: none; }
      .head { padding: 22px 20px 18px; gap: 14px; }
      .head img { width: 108px; }
      .head p { font-size: 10px; line-height: 15px; }
      .doc { padding: 20px 20px 14px; }
      h1 { font-size: 20px; line-height: 27px; }
      .summary { margin-bottom: 14px; }
      .meta-card { border-radius: 14px; margin-bottom: 18px; }
      .meta-card > div { padding: 11px 13px; }
      .meta-card strong { font-size: 12px; line-height: 18px; }
      col.photo { width: 42px; }
      col.sku { width: 48px; }
      col.qty { width: 38px; }
      col.amount { width: 76px; }
      th { padding: 8px 0; font-size: 9px; }
      td { padding: 9px 0; font-size: 11px; line-height: 16px; }
      .photo-cell img { width: 34px; height: 34px; border-radius: 6px; }
      .sku-cell { font-size: 9px; line-height: 13px; word-break: break-all; }
      .product-copy strong {
        display: -webkit-box;
        max-height: 32px;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        font-size: 11px;
        line-height: 16px;
        letter-spacing: 0;
      }
      .product-copy small { font-size: 10px; line-height: 14px; }
      .c, .r { font-size: 11px; line-height: 16px; }
      .fee-label { font-size: 11px; line-height: 16px; }
      .vat { margin-top: 18px; gap: 12px; }
      .vat strong { font-size: 14px; line-height: 20px; }
      .vat span { font-size: 24px; line-height: 30px; }
      .actions { padding: 0 20px 18px; gap: 8px; }
      .btn { min-width: 0; flex: 1; min-height: 44px; font-size: 14px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="sheet">
      <header class="head">
        <img src="${escapeHtml(new URL("/builduscare-logo.png", window.location.origin).toString())}" alt="build us care" />
        <div>
          <p>${escapeHtml((payload.title || "견적서") === "최종 견적서" ? `발행일 ${todayText()}` : `견적일 ${todayText()}`)}</p>
          <p>${escapeHtml((payload.title || "견적서") === "최종 견적서" ? `접수번호 ${displayNumber}` : `견적번호 ${displayNumber}`)}</p>
          <p>유효기간 발행일로부터 14일</p>
        </div>
      </header>
      <section class="doc">
        <h1>${escapeHtml(payload.title || "견적서")}</h1>
        <p class="summary">${escapeHtml(summaryText(payload))}</p>
        <section class="meta-card">
          <div><small>예약자</small><strong>${escapeHtml(payload.customerName || "확인 중")}</strong></div>
          <div><small>연락처</small><strong>${escapeHtml(payload.customerPhone || "확인 중")}</strong></div>
          <div class="full"><small>시공 주소</small><strong>${escapeHtml(payload.addressText || "주소 확인 중")}</strong></div>
          <div class="full"><small>예약 일시</small><strong>${escapeHtml(payload.visitText || "방문일 확인 중")}</strong></div>
          <div class="full"><small>현금영수증</small><strong>${escapeHtml(payload.cashReceiptText || "신청 안 함")}</strong></div>
        </section>
        <table>
          <colgroup>
            <col class="photo" />
            <col class="sku" />
            <col />
            <col class="qty" />
            <col class="amount" />
          </colgroup>
          <thead>
            <tr>
              <th>사진</th>
              <th>품번</th>
              <th>제품명</th>
              <th class="c">수량</th>
              <th class="r">금액 (원)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${laborHtml}
            ${disposalHtml}
          </tbody>
        </table>
        <div class="vat">
          <div><strong>최종합계</strong></div>
          <span>${won(payload.totalAmount)}원</span>
        </div>
      </section>
      <div class="actions">
        <button class="btn btn-sec" onclick="window.print()">인쇄 / PDF 저장</button>
        <button class="btn btn-pri" onclick="window.close()">닫기</button>
      </div>
    </section>
  </main>
</body>
</html>`;
}

export function openEstimatePreviewWindow(payload: EstimatePreviewPayload) {
  try {
    window.localStorage.setItem(ESTIMATE_PREVIEW_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
  const width = Math.min(820, Math.max(760, window.screen.availWidth - 80));
  const height = Math.min(980, Math.max(760, window.screen.availHeight - 80));
  const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
  const features = [
    "popup=yes",
    "noopener=no",
    "noreferrer=no",
    "menubar=no",
    "toolbar=no",
    "location=no",
    "status=no",
    "scrollbars=yes",
    "resizable=yes",
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`
  ].join(",");
  const popup = window.open("about:blank", "_blank", features);
  if (!popup) return;
  popup.document.open();
  popup.document.write(buildEstimatePreviewHtml(payload));
  popup.document.close();
  try {
    popup.moveTo(left, top);
    popup.resizeTo(width, height);
  } catch {
    // Browser may block window positioning/resizing.
  }
  popup.focus();
}

export function readEstimatePreviewPayload(): EstimatePreviewPayload | null {
  try {
    const raw = window.localStorage.getItem(ESTIMATE_PREVIEW_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EstimatePreviewPayload) : null;
  } catch {
    return null;
  }
}
