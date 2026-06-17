import { notFound } from "next/navigation";
import { ProductDetailRouteClient } from "@/components/builduscare/ProductDetailRouteClient";
import { findBuilduscareCategory } from "@/lib/builduscare-public-routes";
import { getBuilduscarePublicCatalog } from "@/lib/builduscare-public-products";

type ProductDetailPageProps = {
  params: Promise<{ category: string; productId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ProductDetailPageProps) {
  const { category: slug, productId } = await params;
  const category = findBuilduscareCategory(slug);
  const catalog = category ? getBuilduscarePublicCatalog(category.serviceCode) : null;
  const decodedProductId = decodeURIComponent(productId);
  const product = catalog?.products.find((item) => item.id === decodedProductId);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://builduscare.co.kr";
  const canonical = product ? `${baseUrl}/products/${slug}/${encodeURIComponent(product.id)}` : baseUrl;
  return {
    title: product ? `${product.displayModel} | Build us Care` : "Build us Care",
    alternates: {
      canonical
    },
    openGraph: {
      url: canonical
    }
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { category: slug, productId } = await params;
  const category = findBuilduscareCategory(slug);
  if (!category) notFound();

  const catalog = getBuilduscarePublicCatalog(category.serviceCode);
  if (!catalog) notFound();

  const decodedProductId = decodeURIComponent(productId);
  const product = catalog.products.find((item) => item.id === decodedProductId);
  if (!product) notFound();

  return (
    <ProductDetailRouteClient
      category={category}
      product={product}
      products={catalog.products}
    />
  );
}
