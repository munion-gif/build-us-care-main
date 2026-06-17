"use client";

import { DesktopProductDetailClient } from "@/components/builduscare/DesktopProductDetailClient";
import { MobileProductDetailClient } from "@/components/builduscare/MobileProductDetailClient";
import type { BuilduscarePublicProduct } from "@/lib/builduscare-public-products";
import type { BuilduscareCategory } from "@/lib/builduscare-public-routes";

type ProductDetailRouteClientProps = {
  category: BuilduscareCategory;
  product: BuilduscarePublicProduct;
  products: BuilduscarePublicProduct[];
};

export function ProductDetailRouteClient({ category, product, products }: ProductDetailRouteClientProps) {
  return (
    <>
      <div className="bc-desktop-only">
        <DesktopProductDetailClient category={category} product={product} products={products} />
      </div>
      <div className="bc-mobile-only">
        <MobileProductDetailClient category={category} product={product} products={products} />
      </div>
    </>
  );
}
