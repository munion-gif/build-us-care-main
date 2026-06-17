"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Package, Palette, Ruler, X } from "lucide-react";
import {
  buildImageAlt,
  colorChoiceLabel,
  colorVariantChoices,
  defaultColor,
  formatKRW,
  initialDetailProduct,
  isProductGroupSelected,
  normalizeSelectedColor,
  productColorText,
  productDisplayLabel,
  selectionKey,
  sashColorChoices,
  sashSizeChoices,
  sashSizeOf
} from "@/components/builduscare/product-helpers";
import { featureSpec, primarySpec, skuSpec } from "@/components/builduscare/product-detail-utils";
import type { ProductSelection } from "@/components/builduscare/product-types";
import type { BuilduscarePublicProduct } from "@/lib/builduscare-public-products";
import type { BuilduscareCategory } from "@/lib/builduscare-public-routes";

type ProductDetailModalProps = {
  category: BuilduscareCategory;
  product: BuilduscarePublicProduct;
  products: BuilduscarePublicProduct[];
  selections: ProductSelection[];
  onClose: () => void;
  onBuy: (sourceProduct: BuilduscarePublicProduct, selectedProduct: BuilduscarePublicProduct, selectedColor: string) => void;
};

function cleanChoiceLabel(value: string) {
  return colorChoiceLabel(value);
}

function selectedColorOf(product: BuilduscarePublicProduct) {
  const firstOption = product.colorOptions[0];
  if (firstOption) return normalizeSelectedColor(product, firstOption);
  const firstColor = String(product.color ?? "").split("/")[0]?.trim();
  return normalizeSelectedColor(product, firstColor);
}

function selectedColorFromState(product: BuilduscarePublicProduct, selections: ProductSelection[]) {
  return selections.find((item) => item.product.id === product.id)?.selectedColor;
}

export function ProductDetailModal({
  category,
  product,
  products,
  selections,
  onClose,
  onBuy
}: ProductDetailModalProps) {
  const initialProduct = useMemo(() => initialDetailProduct(product, products, selections), [product, products, selections]);
  const [activeProduct, setActiveProduct] = useState(initialProduct);
  const [selectedColor, setSelectedColor] = useState(selectedColorFromState(initialProduct, selections) ?? selectedColorOf(initialProduct));

  useEffect(() => {
    setActiveProduct(initialProduct);
    setSelectedColor(selectedColorFromState(initialProduct, selections) ?? selectedColorOf(initialProduct));
  }, [initialProduct, selections]);

  const price = formatKRW(activeProduct.roundedPrice).replace(/원$/, "");
  const sizeChoices = sashSizeChoices(product, products);
  const showSizeChoices = sizeChoices.length > 1 || (sizeChoices.length === 1 && sizeChoices[0]?.size !== "기본");
  const sashColors = sashColorChoices(product, activeProduct, products);
  const colorVariants = colorVariantChoices(product, products);
  const generalColors = product.serviceCode === "sash_handle" || colorVariants.length > 0 || product.colorOptions.length <= 1 ? [] : product.colorOptions;
  const isVariantChoice = sizeChoices.length > 0 || colorVariants.length > 0;
  const normalizedSelectedColor = normalizeSelectedColor(activeProduct, selectedColor || defaultColor(activeProduct));
  const activeSelectionKey = selectionKey(activeProduct, normalizedSelectedColor);
  const mainSpec = primarySpec(activeProduct);
  const detailsSpec = featureSpec(activeProduct, mainSpec);
  const hasGeneralColorChoices = generalColors.length > 0;
  const selected = isVariantChoice
    ? selections.some((item) => selectionKey(item.product, item.selectedColor) === activeSelectionKey)
    : hasGeneralColorChoices
      ? selections.some((item) => selectionKey(item.product, item.selectedColor) === activeSelectionKey)
    : isProductGroupSelected(selections, activeProduct, products);

  function chooseSashSize(choiceProduct: BuilduscarePublicProduct) {
    const choices = sashColorChoices(product, choiceProduct, products);
    const wantedColor = selectedColor && choices.some((choice) => choice.color === selectedColor)
      ? selectedColor
      : selectedColorOf(choiceProduct);
    const resolved = choices.find((choice) => choice.color === wantedColor)?.product ?? choiceProduct;
    setActiveProduct(resolved);
    setSelectedColor(wantedColor);
  }

  function chooseSashColor(color: string, choiceProduct: BuilduscarePublicProduct) {
    setActiveProduct(choiceProduct);
    setSelectedColor(normalizeSelectedColor(choiceProduct, color));
  }

  function chooseColorVariant(color: string, choiceProduct: BuilduscarePublicProduct) {
    setActiveProduct(choiceProduct);
    setSelectedColor(normalizeSelectedColor(choiceProduct, color));
  }

  function buy() {
    onBuy(product, activeProduct, normalizedSelectedColor);
    onClose();
  }

  return (
    <div className="pm-scrim" role="presentation" onMouseDown={onClose}>
      <article className="pm-card" role="dialog" aria-modal="true" aria-label="제품 상세" onMouseDown={(event) => event.stopPropagation()}>
        <button className="pm-close" type="button" onClick={onClose} aria-label="닫기">
          <X size={20} />
        </button>
        <div className="pm-body">
          <div className="pm-gallery">
            <div className="pm-hero imgph has-img">
              <img className="product-img" src={activeProduct.image ?? category.image} alt={buildImageAlt(activeProduct)} decoding="async" />
            </div>
          </div>
          <div className="pm-detail-info">
            <span className="pm-brand">{product.brand}</span>
            <h2 className="pm-title">{productDisplayLabel(product)}</h2>
            <div className="pm-row">
              <strong className="pm-price">{price}<small>원</small></strong>
              <button className={`pm-buy${selected ? " added" : ""}`} type="button" onClick={buy}>
                {selected ? "담김 ✓" : "담기"}
              </button>
            </div>

            {showSizeChoices && (
              <div className="size-choice-box">
                <div className="size-choice-label">사이즈</div>
                <div className="size-choice-options">
                  {sizeChoices.map((item) => {
                    const active = (sashSizeOf(activeProduct) || "기본") === item.size;
                    return (
                      <button
                        key={item.size}
                        className={`size-choice-btn${active ? " selected" : ""}`}
                        type="button"
                        data-variant-id={item.product.id}
                        data-sash-size={item.size}
                        onClick={() => chooseSashSize(item.product)}
                      >
                        <b>{item.size}</b>
                        <span>{formatKRW(item.product.roundedPrice)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {sashColors.length > 0 && (
              <div className="size-choice-box color-choice-box">
                <div className="size-choice-label">색상</div>
                <div className="size-choice-options">
                  {sashColors.map((item) => (
                    <button
                      key={item.color}
                      className={`size-choice-btn color-choice-btn${selectedColor === item.color ? " selected" : ""}`}
                      type="button"
                      data-variant-id={item.product.id}
                      data-sash-color={item.color}
                      onClick={() => chooseSashColor(item.color, item.product)}
                    >
                      <b>{item.color}</b>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {colorVariants.length > 0 && (
              <div className="size-choice-box color-choice-box">
                <div className="size-choice-label">색상</div>
                <div className="size-choice-options">
                  {colorVariants.map((item) => (
                    <button
                      key={item.color}
                      className={`size-choice-btn color-choice-btn${activeProduct.id === item.product.id ? " selected" : ""}`}
                      type="button"
                      data-variant-id={item.product.id}
                      onClick={() => chooseColorVariant(item.color, item.product)}
                    >
                      <b>{item.color}</b>
                      <span>{formatKRW(item.product.roundedPrice)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {generalColors.length > 0 && (
              <div className="size-choice-box color-choice-box">
                <div className="size-choice-label">색상</div>
                <div className="size-choice-options">
                  {generalColors.map((item) => {
                    const label = cleanChoiceLabel(item);
                    const active = selectedColor === item || selectedColor === label;
                    return (
                      <button
                        key={item}
                        className={`size-choice-btn color-choice-btn${active ? " selected" : ""}`}
                        type="button"
                        onClick={() => setSelectedColor(normalizeSelectedColor(activeProduct, label || item))}
                      >
                        <b>{label}</b>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pm-specs">
              <div className="pm-spec">
                <span className="pm-ic"><Ruler size={20} /></span>
                <p>{mainSpec}</p>
              </div>
              <div className="pm-spec">
                <span className="pm-ic"><Package size={20} /></span>
                <p>품번 · {skuSpec(activeProduct)}</p>
              </div>
              <div className="pm-spec">
                <span className="pm-ic"><Palette size={20} /></span>
                <p>색상 · {selectedColor || productColorText(activeProduct)}</p>
              </div>
              <div className="pm-spec">
                <span className="pm-ic"><Info size={20} /></span>
                <p>{detailsSpec}</p>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
