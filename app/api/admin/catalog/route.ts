import { ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { getBuilduscarePublicCatalog } from "@/lib/builduscare-public-products";
import type { ReplacementProductServiceCode } from "@/lib/replacement-products";

// 새 관리자 견적서 작성기용: 홈페이지 판매 제품 카탈로그를 카테고리별로 반환
const SERVICE_CODES: Array<{ code: ReplacementProductServiceCode; label: string }> = [
  { code: "toilet_replace", label: "양변기 교체" },
  { code: "basin_replace", label: "세면대 교체" },
  { code: "faucet_replace", label: "수전 교체" },
  { code: "bidet_install", label: "비데 설치" },
  { code: "ventilator_replace", label: "환풍기 교체" },
  { code: "sash_handle", label: "샷시손잡이 교체" },
  { code: "door_handle", label: "도어핸들 교체" },
  { code: "silicone_repair", label: "실리콘 재시공" },
  { code: "bath_accessory", label: "욕실 액세서리" }
];

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const categories = SERVICE_CODES.map(({ code, label }) => {
    const catalog = getBuilduscarePublicCatalog(code);
    const products = (catalog?.products ?? []).map((p) => ({
      id: p.id,
      name: p.displayName,
      sku: p.sku,
      price: p.roundedPrice,
      laborPrice: p.laborPrice,
      image: p.image ?? null,
      popular: Boolean(p.popular)
    }));
    products.sort((a, b) => Number(b.popular) - Number(a.popular) || a.price - b.price);
    return { code, label, products };
  }).filter((c) => c.products.length > 0);

  return ok({ categories });
}
