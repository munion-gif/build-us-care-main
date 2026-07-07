"use client";

import { CalendarCheck, Package, ShoppingBag, Trash2, Truck, Wrench } from "lucide-react";
import type { ProductSelection } from "@/components/builduscare/product-types";
import { formatKRW, selectionDisplayLabel, selectionKey } from "@/components/builduscare/product-helpers";
import type { BuilduscarePublicProduct } from "@/lib/builduscare-public-products";
import type { BuilduscareCategory } from "@/lib/builduscare-public-routes";
import { isSiliconeLaborService, laborQtyText } from "@/lib/builduscare-labor";

type EstimatePanelProps = {
  category: BuilduscareCategory;
  allProducts: BuilduscarePublicProduct[];
  selections: ProductSelection[];
  units: number;
  productAmount: number;
  laborAmount: number;
  shippingAmount: number;
  disposalAmount: number;
  totalAmount: number;
  selfDisposal: boolean;
  categoryTitleByService: Record<string, string>;
  onAdjustSelection: (key: string, delta: number) => void;
  onToggleSelfDisposal: () => void;
  onRemoveSelection: (key: string) => void;
  onOpenEstimate: () => void;
  onOpenOrderForm: () => void;
  sheetOpen?: boolean; // 모바일에서 하단 시트로 열렸는지
  onCloseSheet?: () => void; // 모바일 시트 닫기
};

function KakaoIcon() {
  return (
    <svg className="kkic" viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18, flex: "none" }} aria-hidden="true">
      <path d="M12 3.4C6.7 3.4 2.4 6.85 2.4 11.1c0 2.74 1.82 5.14 4.55 6.52-.2.72-.72 2.62-.83 3.03-.14.5.18.5.39.37.16-.1 2.5-1.7 3.52-2.4.51.07 1.03.11 1.57.11 5.3 0 9.6-3.45 9.6-7.63S17.3 3.4 12 3.4z" />
    </svg>
  );
}

export function EstimatePanel({
  category,
  allProducts,
  selections,
  units,
  productAmount,
  laborAmount,
  shippingAmount,
  disposalAmount,
  totalAmount,
  selfDisposal,
  categoryTitleByService,
  onAdjustSelection,
  onToggleSelfDisposal,
  onRemoveSelection,
  onOpenEstimate,
  onOpenOrderForm,
  sheetOpen,
  onCloseSheet
}: EstimatePanelProps) {
  const hasSelections = selections.length > 0;
  const hasSiliconeSelection = selections.some((item) => isSiliconeLaborService(item.product.serviceCode));
  const onlySiliconeSelection = hasSelections && selections.every((item) => isSiliconeLaborService(item.product.serviceCode));
  const laborUnitSummary = onlySiliconeSelection ? laborQtyText("silicone_repair", units) : hasSiliconeSelection ? "품목별" : `×${units}`;

  return (
    <aside className={`sticky-side${sheetOpen ? " cartsheet-open" : ""}`} style={{ position: "sticky", top: 92, alignSelf: "start", height: "max-content" }}>
      {onCloseSheet ? (
        <button type="button" className="cartsheet-close" onClick={onCloseSheet} aria-label="견적 닫기">
          ✕ 닫기
        </button>
      ) : null}
      <div className="bcard pad" id="wEstimate">
        <h2 className="h-md">예상 견적</h2>
        <div style={{ marginTop: 14 }}>
          {hasSelections ? (
            <>
              {selections.map((item) => {
                const key = selectionKey(item.product, item.selectedColor);
                const itemCategory = categoryTitleByService[item.product.serviceCode] ?? category.title;
                const displayName = selectionDisplayLabel(item.product, item.selectedColor, allProducts);
                return (
                  <div key={key} className="qrow-sel">
                    <div className="qrs-info">
                      <div className="qrs-name"><span className="qrs-cat">{itemCategory}</span> {displayName}</div>
                      <div className="qrs-price">{formatKRW(item.product.roundedPrice)}</div>
                    </div>
                    <div className="qstep">
                      <button type="button" onClick={() => item.qty <= 1 ? onRemoveSelection(key) : onAdjustSelection(key, -1)} aria-label="감소">
                        −
                      </button>
                      <span>{isSiliconeLaborService(item.product.serviceCode) ? `${item.qty}m` : item.qty}</span>
                      <button type="button" onClick={() => onAdjustSelection(key, 1)} aria-label="증가">
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="quote-total">
                <div className="prow">
                  <span className="pk"><Package aria-hidden="true" /> 제품가 합계 <span className="sub">{units}개</span></span>
                  <span className="pv">{formatKRW(productAmount).replace(/원$/, "")}</span>
                </div>
                <div className="prow">
                  <span className="pk">
                    <Wrench aria-hidden="true" /> 시공비 <span className="sub">{laborUnitSummary}</span>
                  </span>
                  <span className="pv">{formatKRW(laborAmount).replace(/원$/, "")}</span>
                </div>
                <div className="prow">
                  <span className="pk"><Truck aria-hidden="true" /> 배송비</span>
                  <span className="pv">{formatKRW(shippingAmount).replace(/원$/, "")}</span>
                </div>
                <div className="prow">
                  <span className="pk"><Trash2 aria-hidden="true" /> 폐기물 처리비 <span className="sub">×{units}</span></span>
                  <span className={`pv${selfDisposal ? " strike" : ""}`}>{formatKRW(disposalAmount).replace(/원$/, "")}</span>
                </div>
                <label className="disp-opt">
                  <input type="checkbox" checked={selfDisposal} onChange={onToggleSelfDisposal} />
                  <span className="disp-box" />
                  <span className="disp-txt">폐기물은 직접 처리할게요 <span className="disp-sub">직접 처리 시 폐기물 처리비 제외</span></span>
                </label>
                <div className="prow tot">
                  <span className="pk">예상 합계</span>
                  <span className="pv">{formatKRW(totalAmount).replace(/원$/, "")}<span className="sub" style={{ fontWeight: 600 }}> 원~</span></span>
                </div>
              </div>
            </>
          ) : (
            <div className="qest-empty">
              <ShoppingBag size={30} />
              <div className="qest-empty-t">선택한 제품이 없어요</div>
              <div className="qest-empty-d">바꿀 제품을 담으면<br />예상 견적이 여기에 표시돼요.</div>
            </div>
          )}
        </div>
        <button className="web-btn pri block lg" style={{ marginTop: 16 }} type="button" aria-disabled={!hasSelections} onClick={hasSelections ? onOpenEstimate : undefined}>
          견적서 보기
        </button>
        <button className="web-btn book-btn block lg" style={{ marginTop: 10 }} type="button" aria-disabled={!hasSelections} onClick={hasSelections ? onOpenOrderForm : undefined}>
          <CalendarCheck aria-hidden="true" style={{ width: 18, height: 18 }} /> 바로 예약하기
        </button>
        <a className="web-btn kkbtn block" style={{ marginTop: 10 }} href="https://pf.kakao.com/_PxkzsX" target="_blank" rel="noreferrer">
          <KakaoIcon /> 카카오톡 상담
        </a>
      </div>
    </aside>
  );
}
