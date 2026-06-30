"use client";

import { Check } from "lucide-react";
import type { ProductSelection } from "@/components/builduscare/product-types";
import { buildImageAlt, formatKRW, isProductGroupSelected, productCapacityLabel, productDisplayLabel } from "@/components/builduscare/product-helpers";
import type { BuilduscarePublicProduct } from "@/lib/builduscare-public-products";
import type { BuilduscareCategory } from "@/lib/builduscare-public-routes";

type ProductGridProps = {
  category: BuilduscareCategory;
  products: BuilduscarePublicProduct[];
  allProducts: BuilduscarePublicProduct[];
  selections: ProductSelection[];
  onOpenDetail: (product: BuilduscarePublicProduct) => void;
  onQuickSelect: (product: BuilduscarePublicProduct) => void;
};

function renderCardName(name: string) {
  return name.split(/(\s+)/).map((part, index) => {
    if (!part.trim()) return part;
    return <span key={`${part}-${index}`} className="pname-token">{part}</span>;
  });
}

export function ProductGrid({ category, products, allProducts, selections, onOpenDetail, onQuickSelect }: ProductGridProps) {
  return (
    <div className="prodgrid">
      {products.map((product, index) => {
        const active = isProductGroupSelected(selections, product, allProducts);
        const price = formatKRW(product.roundedPrice).replace(/원$/, "");
        return (
          <article key={product.id} className={`pcard${active ? " sel selected" : ""}`} data-pid={product.id}>
            <button
              className="psel"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onQuickSelect(product);
              }}
              aria-pressed={active}
              aria-label={`${productDisplayLabel(product)} ${active ? "선택 해제" : "담기"}`}
            >
              <Check size={15} />
            </button>
            <button className="pcard-main" type="button" onClick={() => onOpenDetail(product)} aria-label={`${productDisplayLabel(product)} 상세 보기`}>
              <div className="pimg imgph has-img">
                <img
                  className="product-img"
                  src={product.image ?? category.image}
                  alt={buildImageAlt(product)}
                  loading={index < 6 ? "eager" : "lazy"}
                  decoding="async"
                />
              </div>
              <div className="pinfo">
                <div className="pbrand">{product.brand}</div>
                <div className="pname">
                  {renderCardName(productDisplayLabel(product))}
                  {productCapacityLabel(product) ? <span className="product-capacity-label">{productCapacityLabel(product)}</span> : null}
                </div>
                <div className="pprice">
                  {price}<small> 원</small>
                </div>
              </div>
            </button>
          </article>
        );
      })}
    </div>
  );
}
