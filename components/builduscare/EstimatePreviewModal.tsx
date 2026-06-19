"use client";

import { useMemo } from "react";
import { Printer, X } from "lucide-react";
import type { ProductSelection } from "@/components/builduscare/product-types";
import { formatKRW, selectionDisplayLabel } from "@/components/builduscare/product-helpers";
import type { BuilduscarePublicProduct } from "@/lib/builduscare-public-products";

type EstimatePreviewModalProps = {
  categoryTitle: string;
  allProducts?: BuilduscarePublicProduct[];
  selections: ProductSelection[];
  productAmount: number;
  laborAmount: number;
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
  standalone?: boolean;
  onClose: () => void;
};

function todayText() {
  return new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" });
}

function laborRows(
  selections: ProductSelection[],
  categoryTitleByService: Record<string, string>,
  fallbackCategoryTitle: string
) {
  const grouped = new Map<string, { label: string; qty: number; amount: number }>();
  for (const item of selections) {
    const key = item.product.serviceCode || fallbackCategoryTitle;
    const label = categoryTitleByService[item.product.serviceCode] ?? fallbackCategoryTitle;
    const current = grouped.get(key) ?? { label, qty: 0, amount: 0 };
    current.qty += item.qty;
    current.amount += item.product.laborPrice * item.qty;
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

export function EstimatePreviewModal({
  categoryTitle,
  allProducts = [],
  selections,
  laborAmount,
  disposalAmount,
  totalAmount,
  selfDisposal,
  categoryTitleByService,
  cashReceiptText,
  orderNumber,
  customerName,
  customerPhone,
  addressText,
  visitText,
  title = "견적서",
  standalone = false,
  onClose
}: EstimatePreviewModalProps) {
  const units = selections.reduce((sum, item) => sum + item.qty, 0);
  const estimateNumber = useMemo(() => `BC-EST-${Date.now().toString().slice(-6)}`, []);
  const serviceSummary = useMemo(() => {
    const uniqueTitles = Array.from(
      new Set(selections.map((item) => categoryTitleByService[item.product.serviceCode] ?? categoryTitle).filter(Boolean))
    );
    return uniqueTitles.join(" · ");
  }, [categoryTitle, categoryTitleByService, selections]);
  const displayNumber = orderNumber || estimateNumber;
  const laborSummaryRows = useMemo(
    () => laborRows(selections, categoryTitleByService, categoryTitle),
    [categoryTitle, categoryTitleByService, selections]
  );

  const content = (
      <article className={`estimate-card${standalone ? " estimate-standalone-card" : ""}`} role="dialog" aria-modal={!standalone} aria-label={title} onMouseDown={(event) => !standalone && event.stopPropagation()}>
        {!standalone ? (
          <button className="pm-close" type="button" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        ) : null}
        <header className="estimate-head">
          <img src="/builduscare-logo.png" alt="build us care" />
          <div>
            <p>{title === "최종 견적서" ? `발행일 ${todayText()}` : `견적일 ${todayText()}`}</p>
            <p>{title === "최종 견적서" ? `접수번호 ${displayNumber}` : `견적번호 ${displayNumber}`}</p>
            <p>유효기간 발행일로부터 14일</p>
          </div>
        </header>
        <section className="estimate-doc">
          <h1>{title}</h1>
          <p className="estimate-summary">{serviceSummary || categoryTitle} · 선택 제품 {selections.length}종 · 총 {units}개</p>
          {(customerName || customerPhone || addressText || visitText || cashReceiptText) ? (
            <section className="estimate-meta-card">
              <div>
                <small>예약자</small>
                <strong>{customerName || "확인 중"}</strong>
              </div>
              <div>
                <small>연락처</small>
                <strong>{customerPhone || "확인 중"}</strong>
              </div>
              <div className="full">
                <small>시공 주소</small>
                <strong>{addressText || "주소 확인 중"}</strong>
              </div>
              <div className="full">
                <small>예약 일시</small>
                <strong>{visitText || "방문일 확인 중"}</strong>
              </div>
              <div className="full">
                <small>현금영수증</small>
                <strong>{cashReceiptText || "신청 안 함"}</strong>
              </div>
            </section>
          ) : null}
          <table>
            <colgroup>
              <col style={{ width: "52px" }} />
              <col style={{ width: "88px" }} />
              <col />
              <col style={{ width: "72px" }} />
              <col style={{ width: "96px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>사진</th>
                <th>품번</th>
                <th>제품명</th>
                <th className="c">수량</th>
                <th className="r">금액 (원)</th>
              </tr>
            </thead>
            <tbody>
              {selections.map((item) => (
                <tr key={`${item.product.id}-${item.selectedColor}`}>
                  <td className="estimate-photo-cell">
                    {item.product.image ? <img src={item.product.image} alt={selectionDisplayLabel(item.product, item.selectedColor, allProducts)} /> : <span className="estimate-photo-empty">-</span>}
                  </td>
                  <td className="estimate-sku-cell">{item.product.sku || "-"}</td>
                  <td>
                    <div className="estimate-product-copy">
                      <strong>{item.product.brand} {selectionDisplayLabel(item.product, item.selectedColor, allProducts)}</strong>
                      <small>{categoryTitleByService[item.product.serviceCode] ?? categoryTitle}</small>
                    </div>
                  </td>
                  <td className="c">{item.qty}</td>
                  <td className="r">{(item.product.roundedPrice * item.qty).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
              {laborSummaryRows.map((row) => (
                <tr key={`labor-${row.label}`} className="estimate-fee-row">
                  <td colSpan={3} className="estimate-fee-label">시공비 · {row.label}</td>
                  <td className="c">×{row.qty}</td>
                  <td className="r">{row.amount.toLocaleString("ko-KR")}</td>
                </tr>
              ))}
              <tr className="estimate-fee-row">
                <td colSpan={3} className="estimate-fee-label">폐기물 처리비{selfDisposal ? " (직접 처리)" : ""}</td>
                <td className="c">×{units}</td>
                <td className="r">{disposalAmount.toLocaleString("ko-KR")}</td>
              </tr>
            </tbody>
          </table>
          <div className="estimate-vat">
            <div>
              <strong>최종합계</strong>
            </div>
            <span>{formatKRW(totalAmount)}</span>
          </div>
          {selfDisposal && (
            <div className="estimate-self-disposal">
              <b>폐기물 직접 처리</b>로 선택하셨습니다. 폐기물 처리비는 청구되지 않습니다.
            </div>
          )}
        </section>
        <div className="estimate-actions">
          <button className="web-btn sec lg" type="button" onClick={() => window.print()}><Printer size={18} /> 인쇄 / PDF 저장</button>
          <button className="web-btn pri lg" type="button" onClick={onClose}>닫기</button>
        </div>
      </article>
  );

  if (standalone) {
    return <main className="estimate-page">{content}</main>;
  }

  return (
    <div className="pm-scrim estimate-scrim" role="presentation" onMouseDown={onClose}>
      {content}
    </div>
  );
}
