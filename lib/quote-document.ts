import { formatServiceName } from "@/lib/format";

export type QuoteDocumentRow = {
  id: string;
  image: string | null;
  productName: string;
  sku: string;
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
  serviceName: string;
  rows: QuoteDocumentRow[];
  address: string;
  visitText: string;
  productTotal: number;
  laborTotal: number;
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
    const product = item?.metadata?.selected_replacement_product ?? item?.metadata?.selected_toilet_product ?? null;
    const qty = Math.max(1, numberValue(item?.qty) || 1);
    const productName = [product?.brand, product?.model].filter(Boolean).join(" ").trim() || item?.item_name || "선택 제품";
    const unitPrice = numberValue(product?.price ?? item?.unit_material);
    const price = numberValue(item?.line_material) || unitPrice * qty;
    const labor = numberValue(item?.line_labor) || numberValue(item?.unit_labor) * qty;
    const finalPrice = numberValue(item?.line_total) || price + labor;

    return {
      id: `${product?.sku ?? item?.sku ?? "quote"}-${index}`,
      image: product?.image ?? null,
      productName,
      sku: product?.sku ?? item?.sku ?? "-",
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
  const rows = quoteRows(quote?.items);
  const productTotal = numberValue(quote?.total_material) || rows.reduce((sum, row) => sum + row.price, 0);
  const laborTotal = numberValue(quote?.total_labor) || rows.reduce((sum, row) => sum + row.labor, 0);
  const finalTotal = numberValue(quote?.total_final) || numberValue(options.fallbackTotalAmount) || productTotal + laborTotal;
  const transferAmount = numberValue(payment?.amount ?? payment?.online_payment_amount) || numberValue(options.fallbackTransferAmount) || productTotal || finalTotal;
  const onsiteAmount = numberValue(payment?.onsite_payment_amount ?? order?.onsite_payment_amount) || numberValue(options.fallbackOnsiteAmount) || Math.max(0, finalTotal - transferAmount);

  return {
    orderNumber: order?.order_number ?? null,
    serviceName: options.serviceName ?? formatServiceName(order?.service_type_code ?? rows[0]?.sku),
    rows,
    address: order?.home?.address_full ?? "주소 확인 중",
    visitText: visitTextFromOrder(order),
    productTotal,
    laborTotal,
    finalTotal,
    transferAmount,
    onsiteAmount,
    productCatalogMode: onsiteAmount > 0,
    cashReceiptText: cashReceiptTextFromOrder(order)
  };
}

export function buildQuoteDocumentHtml(input: QuoteDocumentInput) {
  const vatIncludedFinalTotal = Math.round(input.finalTotal * 1.1);
  const rowsHtml = input.rows
    .map(
      (row) => `
        <tr>
          <td>${row.image ? `<img src="${escapeHtml(quoteDocumentImageSrc(row.image))}" alt="${escapeHtml(row.productName)} 제품 사진" crossorigin="anonymous" />` : "사진 없음"}</td>
          <td><strong>${escapeHtml(row.productName)}</strong>${row.qty > 1 ? `<small>${row.qty}개</small>` : ""}</td>
          <td>${escapeHtml(row.sku)}</td>
          <td>${won(row.price)}</td>
          <td>${won(row.labor)}</td>
          <td><strong>${won(row.finalPrice)}</strong></td>
        </tr>
      `
    )
    .join("");
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
    body { margin: 0; background: #f7f0e4; color: #22211d; font-family: Arial, "Noto Sans KR", sans-serif; line-height: 1.5; }
    main { max-width: 960px; margin: 0 auto; padding: 32px; }
    .sheet { background: #fffaf1; border: 1px solid #d6c8ad; border-radius: 10px; padding: 28px; }
    .brand { letter-spacing: 0.32em; font-size: 12px; }
    h1 { margin: 12px 0 8px; font-size: 32px; }
    p { margin: 0; color: #6f675c; }
    .meta, .summary, .bank, .receipt { display: grid; gap: 10px; margin-top: 22px; }
    .meta { grid-template-columns: 0.8fr 1.4fr 0.8fr; border: 1px solid #d6c8ad; border-radius: 8px; overflow: hidden; }
    .meta div { padding: 12px; border-right: 1px solid #d6c8ad; }
    .meta div:last-child { border-right: 0; }
    span { display: block; color: #6f675c; font-size: 12px; font-weight: 700; }
    span em { display: block; margin-top: 2px; color: #8a8174; font-size: 11px; font-style: normal; font-weight: 700; }
    strong { display: block; color: #22211d; }
    table { width: 100%; margin-top: 22px; border-collapse: collapse; border: 1px solid #d6c8ad; border-radius: 8px; overflow: hidden; }
    th { background: #f0e5ce; color: #6f675c; font-size: 12px; text-align: left; }
    th, td { padding: 12px; border-bottom: 1px solid #d6c8ad; vertical-align: middle; }
    tr:last-child td { border-bottom: 0; }
    td img { width: 64px; height: 64px; object-fit: contain; border: 1px solid #d6c8ad; border-radius: 8px; background: #fff; }
    td small { display: block; margin-top: 4px; color: #6f675c; font-weight: 700; }
    .summary { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .summary div, .bank, .receipt { border: 1px solid #d6c8ad; border-radius: 8px; background: rgba(255, 255, 255, 0.62); padding: 14px; }
    .summary strong { margin-top: 6px; font-size: 20px; }
    .summary .transfer { border-color: #c7922a; background: #efe2cc; }
    .bank { grid-template-columns: 1fr 1fr; background: #efe2cc; }
    .bank p, .receipt p { margin-top: 6px; font-size: 13px; }
    .note { margin-top: 14px; border-radius: 8px; background: #f0e5ce; padding: 12px 14px; font-weight: 700; }
    @media print {
      body { background: #fff; }
      main { padding: 0; }
      .sheet { border: 0; border-radius: 0; }
    }
  </style>
</head>
<body>
  <main>
    <section class="sheet">
      <div class="brand">build us care</div>
      <h1>최종 견적서</h1>
      <p>선택한 제품과 결제 전 금액을 정리한 견적서입니다.</p>
      <div class="meta">
        <div><span>서비스</span><strong>${escapeHtml(input.serviceName)}</strong></div>
        <div><span>방문 주소</span><strong>${escapeHtml(input.address)}</strong></div>
        <div><span>방문 일정</span><strong>${escapeHtml(input.visitText)}</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>제품사진</th>
            <th>제품명</th>
            <th>품번</th>
            <th>가격</th>
            <th>시공비</th>
            <th>최종가격</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="summary">
        <div><span>제품 가격</span><strong>${won(input.productTotal)}</strong></div>
        <div><span>${input.productCatalogMode ? "시공비 현장결제" : "시공비"}</span><strong>${won(input.laborTotal)}</strong></div>
        <div><span>최종 합계<em>부가세 10% 포함</em></span><strong>${won(vatIncludedFinalTotal)}</strong></div>
        <div class="transfer"><span>계좌이체 금액</span><strong>${won(input.transferAmount)}</strong></div>
      </div>
      <div class="bank">
        <div>
          <span>입금 계좌</span>
          <strong>계좌번호 안내 예정</strong>
          <p>주문 확인 후 카톡으로 계좌와 입금 방법을 안내드립니다.</p>
        </div>
        <div>
          <span>입금 금액</span>
          <strong>${won(input.transferAmount)}</strong>
          <p>입금자명은 주문자 이름으로 보내주세요.</p>
        </div>
      </div>
      <div class="receipt">
        <span>현금영수증</span>
        <strong>${escapeHtml(cashReceiptText)}</strong>
        <p>입금 확인 후 입력된 정보 기준으로 현금영수증 처리를 도와드립니다.</p>
      </div>
      ${input.productCatalogMode && input.onsiteAmount > 0 ? `<p class="note">제품값은 계좌이체로 결제하고, 시공비 ${won(input.onsiteAmount)}은 시공 완료 후 현장에서 결제합니다.</p>` : ""}
    </section>
  </main>
</body>
</html>`;
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
      "width:64px",
      "height:64px",
      "display:grid",
      "place-items:center",
      "border:1px solid #d6c8ad",
      "border-radius:8px",
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
