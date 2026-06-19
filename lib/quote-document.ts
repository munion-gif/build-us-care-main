import { formatServiceName } from "@/lib/format";

export type QuoteDocumentRow = {
  id: string;
  image: string | null;
  productName: string;
  sku: string;
  categoryLabel?: string;
  qty: number;
  price: number;
  labor: number;
  finalPrice: number;
};

export type QuoteDocumentCashReceipt = {
  type: "none" | "personal" | "business";
  value: string;
};

export type QuoteDocumentInput = {
  orderNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  serviceName: string;
  rows: QuoteDocumentRow[];
  address: string;
  visitText: string;
  productTotal: number;
  laborTotal: number;
  subtotalTotal?: number;
  finalTotal: number;
  transferAmount: number;
  onsiteAmount: number;
  productCatalogMode: boolean;
  cashReceipt?: QuoteDocumentCashReceipt;
  cashReceiptText?: string;
};

function won(value: number) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function wonNumber(value: number) {
  return Number(value || 0).toLocaleString("ko-KR");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function asArray<T = any>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function quoteDownloadFileName(orderNumber?: string | null) {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const prefix = orderNumber ? `buildus-care-quote-${orderNumber}` : `buildus-care-quote-${date}-${time}`;
  return `${prefix}.pdf`;
}

export function cashReceiptSummary(info?: QuoteDocumentCashReceipt | null) {
  if (!info || info.type === "none") return "신청 안 함";
  const value = info.value.replace(/\D/g, "");
  if (info.type === "personal") return `개인 소득공제 / ${value || "정보 입력 전"}`;
  return `사업자 지출증빙 / ${value || "정보 입력 전"}`;
}

function quoteDocumentImageSrc(src: string | null) {
  if (!src) return "";
  if (typeof window === "undefined") return src;
  try {
    return new URL(src, window.location.origin).toString();
  } catch {
    return src;
  }
}

function latestQuote(quotes: any[] = []) {
  return asArray(quotes).sort((a, b) => Number(b?.version ?? 0) - Number(a?.version ?? 0))[0] ?? null;
}

function latestPayment(payments: any[] = []) {
  return asArray(payments).sort((a, b) => String(b?.paid_at ?? b?.approved_at ?? b?.created_at ?? "").localeCompare(String(a?.paid_at ?? a?.approved_at ?? a?.created_at ?? "")))[0] ?? null;
}

function quoteRows(items: any[] | undefined): QuoteDocumentRow[] {
  return asArray(items).map((item, index) => {
    const product = item?.metadata?.selected_replacement_product_snapshot ?? item?.metadata?.selected_replacement_product ?? item?.metadata?.selected_toilet_product ?? null;
    const qty = Math.max(1, numberValue(item?.qty) || 1);
    const productName = [product?.brand, product?.model ?? product?.name].filter(Boolean).join(" ").trim() || item?.item_name || "선택 제품";
    const unitPrice = numberValue(product?.price ?? item?.unit_material);
    const price = numberValue(item?.line_material) || unitPrice * qty;
    const labor = numberValue(item?.line_labor) || numberValue(item?.unit_labor) * qty;
    const finalPrice = numberValue(item?.line_total) || price + labor;

    return {
      id: `${product?.sku ?? item?.sku ?? "quote"}-${index}`,
      image: product?.image ?? null,
      productName,
      sku: product?.sku ?? item?.sku ?? "-",
      categoryLabel: formatServiceName(item?.service_type_code ?? item?.metadata?.service_type_code ?? product?.serviceCode ?? ""),
      qty,
      price,
      labor,
      finalPrice
    };
  });
}

function visitTextFromOrder(order: any) {
  const reservation = asArray(order?.reservations)[0];
  if (reservation?.reserved_date) {
    const slot = reservation.time_slot === "afternoon" ? "오후" : reservation.time_slot === "morning" ? "오전" : "";
    return [reservation.reserved_date, slot].filter(Boolean).join(" ");
  }

  const job = asArray(order?.jobs)[0];
  if (job?.scheduled_at) return new Date(job.scheduled_at).toLocaleString("ko-KR");
  return "방문일 확인 중";
}

function cashReceiptTextFromOrder(order: any) {
  const text = String(order?.special_requests ?? "");
  const line = text.split(/\r?\n/).find((entry) => entry.includes("현금영수증:"));
  return line?.replace(/^.*?현금영수증:\s*/, "").trim() || "신청 안 함";
}

function customerFromOrder(order: any) {
  const customer = asArray(order?.customers)[0] ?? order?.customer ?? null;
  return {
    name: customer?.name ?? order?.customerName ?? order?.customer_name ?? null,
    phone: customer?.phone ?? order?.phone ?? order?.customer_phone ?? null
  };
}

export function buildQuoteDocumentInputFromOrderStatus(
  order: any,
  options: {
    payment?: any;
    serviceName?: string;
    fallbackTransferAmount?: number;
    fallbackOnsiteAmount?: number;
    fallbackTotalAmount?: number;
  } = {}
): QuoteDocumentInput {
  const quote = latestQuote(order?.quotes ?? []);
  const payment = options.payment ?? latestPayment(order?.payments ?? []);
  const customer = customerFromOrder(order);
  const rows = quoteRows(quote?.items);
  const productTotal = numberValue(quote?.total_material) || rows.reduce((sum, row) => sum + row.price, 0);
  const laborTotal = numberValue(quote?.total_labor) || rows.reduce((sum, row) => sum + row.labor, 0);
  const subtotalTotal = numberValue(quote?.total_material) + numberValue(quote?.total_labor) + numberValue(quote?.visit_fee) - numberValue(quote?.discount);
  const finalTotal = numberValue(quote?.total_final) || numberValue(options.fallbackTotalAmount) || subtotalTotal || productTotal + laborTotal;
  const transferAmount = numberValue(payment?.amount ?? payment?.online_payment_amount) || numberValue(options.fallbackTransferAmount) || productTotal || finalTotal;
  const onsiteAmount = numberValue(payment?.onsite_payment_amount ?? order?.onsite_payment_amount) || numberValue(options.fallbackOnsiteAmount) || Math.max(0, finalTotal - transferAmount);

  return {
    orderNumber: order?.order_number ?? null,
    customerName: customer.name,
    customerPhone: customer.phone,
    serviceName: options.serviceName ?? formatServiceName(order?.service_type_code ?? rows[0]?.sku),
    rows,
    address: asArray(order?.homes)[0]?.address_full ?? order?.home?.address_full ?? order?.roadAddress ?? "주소 확인 중",
    visitText: visitTextFromOrder(order),
    productTotal,
    laborTotal,
    subtotalTotal: subtotalTotal > 0 ? subtotalTotal : undefined,
    finalTotal,
    transferAmount,
    onsiteAmount,
    productCatalogMode: onsiteAmount > 0,
    cashReceiptText: cashReceiptTextFromOrder(order)
  };
}

export function buildQuoteDocumentHtml(input: QuoteDocumentInput) {
  const subtotalTotal = numberValue(input.subtotalTotal) || Math.max(0, Math.round(input.finalTotal / 1.1));
  const vatIncludedFinalTotal = numberValue(input.finalTotal);
  const laborGroups = input.rows.reduce<Map<string, { label: string; qty: number; amount: number }>>((map, row) => {
    const key = row.categoryLabel || "시공";
    const current = map.get(key) ?? { label: key, qty: 0, amount: 0 };
    current.qty += row.qty;
    current.amount += row.labor;
    map.set(key, current);
    return map;
  }, new Map());
  const disposalAmount = Math.max(0, subtotalTotal - input.productTotal - input.laborTotal);
  const totalQty = input.rows.reduce((sum, row) => sum + row.qty, 0);
  const issuedAt = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" });
  const summaryCategories = Array.from(new Set(input.rows.map((row) => row.categoryLabel || input.serviceName).filter(Boolean)));
  const rowsHtml = input.rows.map((row) => `
      <tr>
        <td class="photo-cell">${row.image ? `<img src="${escapeHtml(quoteDocumentImageSrc(row.image))}" alt="${escapeHtml(row.productName)} 제품 사진" crossorigin="anonymous" />` : `<span class="photo-empty">-</span>`}</td>
        <td class="sku-cell">${escapeHtml(row.sku || "-")}</td>
        <td>
          <div class="product-copy">
            <strong>${escapeHtml(row.productName)}</strong>
            ${row.categoryLabel ? `<small>${escapeHtml(row.categoryLabel)}</small>` : ""}
          </div>
        </td>
        <td class="c">${row.qty}</td>
        <td class="r">${wonNumber(row.price)}</td>
      </tr>
    `).join("") + [...laborGroups.values()].map((group) => `
      <tr class="fee-row">
        <td colspan="3" class="fee-label">시공비 · ${escapeHtml(group.label)}</td>
        <td class="c">×${group.qty}</td>
        <td class="r">${wonNumber(group.amount)}</td>
      </tr>
    `).join("") + `
      <tr class="fee-row">
        <td colspan="3" class="fee-label">폐기물 처리비</td>
        <td class="c">${disposalAmount > 0 ? `×${totalQty}` : "-"}</td>
        <td class="r">${wonNumber(disposalAmount)}</td>
      </tr>
      <tr class="total-row">
        <td colspan="3" class="fee-label">합계</td>
        <td class="c"></td>
        <td class="r">${wonNumber(subtotalTotal)}</td>
      </tr>
    `;
  const cashReceiptText = input.cashReceiptText ?? cashReceiptSummary(input.cashReceipt);

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${typeof window !== "undefined" ? `<base href="${escapeHtml(window.location.origin)}/" />` : ""}
  <title>Build us Care 견적서</title>
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
    .doc > p { margin: 4px 0 18px; color: #6e6e73; font-size: 11px; line-height: 17px; }
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
    .photo-cell img, .photo-empty { width: 40px; height: 40px; object-fit: contain; border-radius: 6px; background: #fff; display: grid; place-items: center; color: #8e8e93; font-size: 10px; border: 1px solid #ececf0; }
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
    .receipt-row { display: flex; justify-content: space-between; gap: 16px; margin-top: 18px; padding-top: 14px; border-top: 1px solid #e5e5ea; font-size: 12px; line-height: 18px; font-weight: 800; }
    .receipt-row small { display: block; color: #6e6e73; font-size: 10px; line-height: 15px; font-weight: 700; }
    .actions { display: flex; justify-content: center; gap: 10px; padding: 0 28px 22px; }
    .btn { min-width: 138px; min-height: 48px; border-radius: 999px; font-size: 16px; font-weight: 800; cursor: pointer; }
    .btn-sec { border: 1px solid #d2d2d7; background: #fff; color: #1d1d1f; }
    .btn-pri { border: 0; background: #245fff; color: #fff; }
    @media print {
      body { background: #fff; }
      main { padding: 0; }
      .sheet { width: 100%; box-shadow: none; border-radius: 0; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <main>
    <section class="sheet">
      <header class="head">
        <img src="/builduscare-logo.png" alt="build us care" />
        <div>
          <p>발행일 ${escapeHtml(issuedAt)}</p>
          <p>${input.orderNumber ? `접수번호 ${escapeHtml(input.orderNumber)}` : "견적번호 임시 견적서"}</p>
          <p>유효기간 발행일로부터 14일</p>
        </div>
      </header>
      <section class="doc">
        <h1>최종 견적서</h1>
        <p>${escapeHtml(summaryCategories.join(" · ") || input.serviceName)} · 선택 제품 ${input.rows.length}종 · 총 ${totalQty}개</p>
        <section class="meta-card">
          <div><small>예약자</small><strong>${escapeHtml(input.customerName || "확인 중")}</strong></div>
          <div><small>연락처</small><strong>${escapeHtml(input.customerPhone || "확인 중")}</strong></div>
          <div class="full"><small>시공 주소</small><strong>${escapeHtml(input.address || "주소 확인 중")}</strong></div>
          <div class="full"><small>예약 일시</small><strong>${escapeHtml(input.visitText || "방문일 확인 중")}</strong></div>
          <div class="full"><small>현금영수증</small><strong>${escapeHtml(cashReceiptText)}</strong></div>
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
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="vat">
          <div><strong>최종합계</strong><small>부가세 10% 포함</small></div>
          <span>${won(vatIncludedFinalTotal)}</span>
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

export function openQuoteDocumentPreviewWindow(input: QuoteDocumentInput) {
  if (typeof window === "undefined") return;
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
  popup.document.write(buildQuoteDocumentHtml(input));
  popup.document.close();
  try {
    popup.moveTo(left, top);
    popup.resizeTo(width, height);
  } catch {
    // Browser may block window positioning.
  }
  popup.focus();
}

async function waitForQuoteDocumentImages(root: Document) {
  const images = Array.from(root.images);
  await Promise.all(
    images.map((image) =>
      image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            image.onload = () => resolve();
            image.onerror = () => resolve();
          })
    )
  );
}

function replaceQuoteDocumentImagesWithFallback(root: Document) {
  Array.from(root.querySelectorAll<HTMLImageElement>("td img")).forEach((image) => {
    const fallback = root.createElement("span");
    fallback.textContent = "제품사진";
    fallback.setAttribute("aria-label", image.alt || "제품사진");
    fallback.style.cssText = [
      "width:40px",
      "height:40px",
      "display:grid",
      "place-items:center",
      "border:1px solid #d6c8ad",
      "border-radius:6px",
      "background:#fff",
      "color:#6f675c",
      "font-size:11px",
      "font-weight:700"
    ].join(";");
    image.replaceWith(fallback);
  });
}

async function captureQuoteCanvas(
  html2canvas: (element: HTMLElement, options: Record<string, unknown>) => Promise<HTMLCanvasElement>,
  target: HTMLElement
) {
  const canvas = await html2canvas(target, {
    backgroundColor: "#fffaf1",
    scale: Math.min(2, window.devicePixelRatio || 2),
    useCORS: true,
    allowTaint: false,
    imageTimeout: 5000,
    logging: false
  });
  return {
    canvas,
    imageData: canvas.toDataURL("image/png")
  };
}

export async function downloadQuotePdf(fileName: string, html: string) {
  if (typeof document === "undefined") return;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "1024px";
  iframe.style.height = "1400px";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      iframe.srcdoc = html;
    });

    const frameDocument = iframe.contentDocument;
    const target = frameDocument?.querySelector<HTMLElement>(".sheet");
    if (!frameDocument || !target) {
      throw new Error("견적서 화면을 준비하지 못했어요.");
    }

    await waitForQuoteDocumentImages(frameDocument);
    await frameDocument.fonts?.ready;

    let capture;
    try {
      capture = await captureQuoteCanvas(html2canvas, target);
    } catch {
      replaceQuoteDocumentImagesWithFallback(frameDocument);
      capture = await captureQuoteCanvas(html2canvas, target);
    }

    const { canvas, imageData } = capture;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageHeight = (canvas.height * pageWidth) / canvas.width;
    let heightLeft = imageHeight;
    let position = 0;

    pdf.addImage(imageData, "PNG", 0, position, pageWidth, imageHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imageHeight;
      pdf.addPage();
      pdf.addImage(imageData, "PNG", 0, position, pageWidth, imageHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
  } finally {
    iframe.remove();
  }
}

export async function downloadQuoteDocument(input: QuoteDocumentInput) {
  await downloadQuotePdf(quoteDownloadFileName(input.orderNumber), buildQuoteDocumentHtml(input));
}
