import { DEFAULT_VISIT_FEE } from "@/lib/constants";
import type { QuoteInputItem } from "@/lib/types";
import type { getSupabaseAdmin } from "@/lib/supabase";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

type ServerQuoteLine = {
  sku: string;
  item_name: string;
  qty: number;
  unit_labor: number;
  unit_material: number;
  option_total: number;
  line_labor: number;
  line_material: number;
  line_total: number;
  options: unknown[];
  material_skus: string[];
  metadata: Record<string, unknown>;
};

export type ServerQuoteResult = {
  items: ServerQuoteLine[];
  total_material: number;
  total_labor: number;
  visit_fee: number;
  discount: number;
  total_final: number;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];
}

export async function calculateServerQuote(
  supabase: SupabaseAdmin,
  items: QuoteInputItem[],
  options: { visitFee?: number; discount?: number } = {}
): Promise<ServerQuoteResult> {
  const visitFee = options.visitFee ?? DEFAULT_VISIT_FEE;
  const discount = options.discount ?? 0;

  const serviceCodes = Array.from(new Set(items.map((item) => item.service_type_code).filter(Boolean))) as string[];
  const materialSkus = Array.from(
    new Set(items.flatMap((item) => asStringArray(item.metadata?.material_skus)))
  );

  const serviceMap = new Map<string, { display_name: string; base_price: number; metadata?: Record<string, unknown> }>();
  if (serviceCodes.length > 0) {
    const { data, error } = await supabase
      .from("service_items")
      .select("service_type_code,display_name,base_price,metadata")
      .in("service_type_code", serviceCodes);

    if (error) {
      throw new Error(error.message);
    }

    for (const row of data ?? []) {
      serviceMap.set(row.service_type_code, row);
    }
  }

  const materialMap = new Map<string, { sku: string; retail_price: number; wholesale_price: number }>();
  if (materialSkus.length > 0) {
    const { data, error } = await supabase
      .from("materials")
      .select("sku,retail_price,wholesale_price")
      .in("sku", materialSkus);

    if (error) {
      throw new Error(error.message);
    }

    for (const row of data ?? []) {
      materialMap.set(row.sku, row);
    }
  }

  const quoteItems = items.map((item) => {
    const sku = item.service_type_code ?? "unknown";
    const service = item.service_type_code ? serviceMap.get(item.service_type_code) : undefined;
    const materialCodes = asStringArray(item.metadata?.material_skus);
    const materialUnitTotal = materialCodes.reduce((sum, materialSku) => {
      const material = materialMap.get(materialSku);
      return sum + (material?.retail_price ?? 0);
    }, 0);
    const optionTotal = (item.options ?? []).reduce((sum, option) => sum + option.price_delta, 0) * item.qty;
    const unitLabor = service?.base_price ?? 0;
    const lineLabor = unitLabor * item.qty;
    const lineMaterial = materialUnitTotal * item.qty;

    return {
      sku,
      item_name: service?.display_name ?? item.item_name,
      qty: item.qty,
      unit_labor: unitLabor,
      unit_material: materialUnitTotal,
      option_total: optionTotal,
      line_labor: lineLabor,
      line_material: lineMaterial,
      line_total: lineLabor + lineMaterial + optionTotal,
      options: item.options ?? [],
      material_skus: materialCodes,
      metadata: {
        ...(item.metadata ?? {}),
        service_type_code: item.service_type_code ?? null,
        client_unit_price_ignored: item.unit_price
      }
    };
  });

  const totalMaterial = quoteItems.reduce((sum, item) => sum + item.line_material, 0);
  const totalLabor = quoteItems.reduce((sum, item) => sum + item.line_labor + item.option_total, 0);
  const totalFinal = Math.max(0, totalMaterial + totalLabor + visitFee - discount);

  return {
    items: quoteItems,
    total_material: totalMaterial,
    total_labor: totalLabor,
    visit_fee: visitFee,
    discount,
    total_final: totalFinal
  };
}
