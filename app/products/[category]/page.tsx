import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ProductsClient } from "@/components/builduscare/ProductsClient";
import { BUILDUSCARE_CATEGORIES, findBuilduscareCategory } from "@/lib/builduscare-public-routes";
import { getBuilduscarePublicCatalog } from "@/lib/builduscare-public-products";

type ProductCategoryPageProps = {
  params: Promise<{ category: string }>;
};

export const dynamic = "force-dynamic";

const PRODUCT_SELECTIONS_COOKIE_KEY = "builduscare_productSelections";
const PRODUCT_ORDER_PREFS_COOKIE_KEY = "builduscare_productOrderPrefs";

function parseJsonCookie<T>(value?: string): T | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as T;
  } catch {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
}

export async function generateStaticParams() {
  return BUILDUSCARE_CATEGORIES.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: ProductCategoryPageProps) {
  const { category: slug } = await params;
  const category = findBuilduscareCategory(slug);
  return {
    title: "Build us Care",
    description: "집 전체가 아니라, 바꿀 수 있는 것부터.",
    alternates: {
      canonical: "/"
    },
    openGraph: {
      url: "/"
    }
  };
}

export default async function ProductCategoryPage({ params }: ProductCategoryPageProps) {
  const { category: slug } = await params;
  const category = findBuilduscareCategory(slug);
  if (!category) notFound();

  const catalog = getBuilduscarePublicCatalog(category.serviceCode);
  if (!catalog) notFound();

  const groupNames = catalog.groups.map((group) => group.name);
  const catalogs = BUILDUSCARE_CATEGORIES.flatMap((item) => {
    const itemCatalog = getBuilduscarePublicCatalog(item.serviceCode);
    if (!itemCatalog) return [];
    return [{
      category: item,
      products: itemCatalog.products,
      groupNames: itemCatalog.groups.map((group) => group.name)
    }];
  });
  const cookieStore = await cookies();
  const initialStoredSelections = parseJsonCookie<Array<{ id?: string; selectedColor?: string; qty?: number; product?: any }>>(
    cookieStore.get(PRODUCT_SELECTIONS_COOKIE_KEY)?.value
  );
  const initialStoredOrderPrefs = parseJsonCookie<{ selfDisposal?: boolean; itemLabel?: string }>(
    cookieStore.get(PRODUCT_ORDER_PREFS_COOKIE_KEY)?.value
  );

  return (
    <ProductsClient
      category={category}
      categories={BUILDUSCARE_CATEGORIES}
      products={catalog.products}
      groupNames={groupNames}
      catalogs={catalogs}
      initialStoredSelections={Array.isArray(initialStoredSelections) ? initialStoredSelections : null}
      initialStoredOrderPrefs={initialStoredOrderPrefs && typeof initialStoredOrderPrefs === "object" ? initialStoredOrderPrefs : null}
    />
  );
}
