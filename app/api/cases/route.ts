import { ok, fail } from "@/lib/api-response";
import { formatServiceName } from "@/lib/format";
import { ORDER_PHOTO_VIEW_EXPIRES_IN, ORDER_PHOTOS_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const revalidate = 300;

const CASE_CATEGORY_BY_SERVICE: Record<string, string> = {
  toilet_replace: "plumbing",
  faucet_replace: "plumbing",
  kitchen_faucet: "plumbing",
  bidet_install: "plumbing",
  ventilator_replace: "plumbing",
  bath_fan: "plumbing",
  drain_clog: "plumbing",
  light_replace: "electric",
  outlet_replace: "electric",
  partial_wallpaper: "wallpaper",
  door_handle: "other"
};

const SUPPORTED_CASE_SERVICE_CODES = new Set([
  "toilet_replace",
  "faucet_replace",
  "kitchen_faucet",
  "light_replace",
  "outlet_replace",
  "door_handle",
  "bidet_install",
  "ventilator_replace",
  "bath_fan"
]);

const CASE_SERVICE_ALIASES: Record<string, string[]> = {
  faucet_replace: ["faucet_replace", "kitchen_faucet"],
  ventilator_replace: ["ventilator_replace", "bath_fan"]
};

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function getFirstServiceCode(skus: unknown): string {
  if (Array.isArray(skus)) {
    const first = skus[0] as { sku?: unknown; service_type_code?: unknown } | undefined;
    return String(first?.service_type_code ?? first?.sku ?? "");
  }
  return "";
}

function getCaseCategory(serviceCode: string) {
  return CASE_CATEGORY_BY_SERVICE[serviceCode] ?? "other";
}

function matchesServiceFilter(serviceCode: string, filter: string) {
  if (filter === "all") return true;
  return (CASE_SERVICE_ALIASES[filter] ?? [filter]).includes(serviceCode);
}

function getAverageRating(feedbacks: unknown): number | null {
  if (!Array.isArray(feedbacks) || feedbacks.length === 0) return null;
  const ratings = feedbacks
    .map((feedback) => Number((feedback as { rating?: unknown }).rating))
    .filter((rating) => Number.isFinite(rating));
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10;
}

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) {
    return ok({ cases: [], count: 0, source: "empty_without_supabase" });
  }

  const { searchParams } = new URL(request.url);
  const service = searchParams.get("service") ?? "all";
  const region = searchParams.get("region") ?? "all";
  const limit = parseBoundedInt(searchParams.get("limit"), 20, 1, 50);
  const offset = parseBoundedInt(searchParams.get("offset"), 0, 0, 10000);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("media")
    .select(
      `
      id,
      file_path,
      sort_order,
      jobs!inner (
        id,
        completed_at,
        status,
        orders (
          id,
          skus,
          service_type_code,
          subtotal_amount,
          total_amount,
          visit_fee,
          reason,
          feedbacks (
            rating,
            nps
          ),
          homes (
            address_dong,
            address_apt,
            address_full,
            building_type
          )
        )
      )
    `
    )
    .eq("type", "after")
    .eq("jobs.status", "inspected")
    .order("sort_order", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return fail("internal_error", error.message, 500);
  }

  const rows = data ?? [];
  const beforeByJob = new Map<string, string>();
  const jobIds = rows
    .map((row: any) => {
      const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
      return job?.id;
    })
    .filter(Boolean);
  const orderIds = rows
    .map((row: any) => {
      const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
      const order = Array.isArray(job?.orders) ? job.orders[0] : job?.orders;
      return order?.id;
    })
    .filter(Boolean);
  const serviceCodes = [
    ...new Set(
      rows
        .map((row: any) => {
          const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
          const order = Array.isArray(job?.orders) ? job.orders[0] : job?.orders;
          return getFirstServiceCode(order?.skus) || order?.service_type_code;
        })
        .filter(Boolean)
    )
  ];
  const quoteByOrder = new Map<string, any>();
  const serviceBasePriceByCode = new Map<string, number>();

  if (jobIds.length > 0) {
    const { data: beforeRows } = await supabase
      .from("media")
      .select("job_id,file_path,sort_order")
      .eq("type", "before")
      .in("job_id", jobIds)
      .order("sort_order", { ascending: true });
    for (const row of beforeRows ?? []) {
      if (!beforeByJob.has(row.job_id)) beforeByJob.set(row.job_id, row.file_path);
    }
  }
  if (orderIds.length > 0) {
    const { data: quoteRows } = await supabase
      .from("quotes")
      .select("order_id,total_material,total_labor,visit_fee,discount,total_final,accepted_at,quoted_at,version")
      .in("order_id", orderIds)
      .order("version", { ascending: false });
    for (const quote of quoteRows ?? []) {
      if (!quoteByOrder.has(quote.order_id)) quoteByOrder.set(quote.order_id, quote);
    }
  }
  if (serviceCodes.length > 0) {
    const { data: serviceRows } = await supabase
      .from("service_items")
      .select("service_type_code,base_price")
      .in("service_type_code", serviceCodes);
    for (const serviceRow of serviceRows ?? []) {
      serviceBasePriceByCode.set(serviceRow.service_type_code, Number(serviceRow.base_price ?? 0));
    }
  }

  const cases = await Promise.all(
    rows.map(async (row: any) => {
      const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
      const order = Array.isArray(job?.orders) ? job.orders[0] : job?.orders;
      const home = Array.isArray(order?.homes) ? order.homes[0] : order?.homes;
      const serviceCode = getFirstServiceCode(order?.skus) || order?.service_type_code || "service";
      const itemCategory = getCaseCategory(serviceCode);
      const beforePath = beforeByJob.get(job?.id);
      const quote = order?.id ? quoteByOrder.get(order.id) : null;
      const fallbackLabor = serviceBasePriceByCode.get(serviceCode) ?? Number(order?.subtotal_amount ?? 0);
      const totalPrice = Number(quote?.total_final ?? order?.total_amount ?? 0);
      const laborPrice = Number(quote?.total_labor ?? fallbackLabor ?? 0);
      const materialPrice = Number(quote?.total_material ?? 0);
      const visitFee = Number(quote?.visit_fee ?? order?.visit_fee ?? 0);

      const [afterSigned, beforeSigned] = await Promise.all([
        supabase.storage.from(ORDER_PHOTOS_BUCKET).createSignedUrl(row.file_path, ORDER_PHOTO_VIEW_EXPIRES_IN),
        beforePath ? supabase.storage.from(ORDER_PHOTOS_BUCKET).createSignedUrl(beforePath, ORDER_PHOTO_VIEW_EXPIRES_IN) : Promise.resolve({ data: null })
      ]);
      const regionText = home?.address_dong ?? home?.address_full?.split(" ").slice(0, 2).join(" ") ?? "지역 비공개";
      const buildingType = home?.building_type ?? "unknown";

      return {
        id: row.id,
        job_id: job?.id ?? null,
        service_code: serviceCode,
        service_name: formatServiceName(serviceCode),
        category: itemCategory,
        completed_at: job?.completed_at ?? null,
        image_url: afterSigned.data?.signedUrl ?? null,
        before_image_url: beforeSigned.data?.signedUrl ?? null,
        file_path: row.file_path,
        rating: getAverageRating(order?.feedbacks),
        total_price: totalPrice > 0 ? totalPrice : null,
        labor_price: laborPrice > 0 ? laborPrice : null,
        material_price: materialPrice > 0 ? materialPrice : null,
        visit_fee: visitFee > 0 ? visitFee : null,
        price_note: totalPrice > 0 ? "완료 견적 기준" : "공임 기준가",
        summary: `${formatServiceName(serviceCode)} 작업을 완료한 실제 검수 사례입니다.`,
        problem: order?.reason ?? "생활 불편 해결",
        work: "현장 상태 확인 후 필요한 자재와 시공 범위를 정리해 작업했습니다.",
        region: regionText,
        building_type: buildingType,
        tags: [regionText, buildingType].filter(Boolean).slice(0, 2),
        quote_href: `/quote/${serviceCode}`,
        photo_href: `/request/photo?service=${serviceCode}`
      };
    })
  );

  const supportedCases = cases.filter((item) => SUPPORTED_CASE_SERVICE_CODES.has(item.service_code));
  const filtered = supportedCases.filter((item) => {
    if (!matchesServiceFilter(item.service_code, service)) return false;
    if (region !== "all" && !item.region.includes(region)) return false;
    return true;
  });
  const services = [...new Map(supportedCases.map((item) => [item.service_code, item.service_name])).entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const regions = [...new Set(supportedCases.map((item) => item.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko")).slice(0, 12);

  return ok({
    cases: filtered,
    count: filtered.length,
    facets: { services, regions },
    limit,
    offset
  });
}
