import { fail } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { workbookXml } from "@/lib/excel-xml";
import { maskAddress, maskName, maskPhone } from "@/lib/pii";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const revalidate = 0;

type ExportSheet = {
  name: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

type QuerySpec = {
  table: string;
  sheet: string;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  map?: (row: Record<string, unknown>, options: { includePii: boolean }) => Record<string, unknown>;
};

function json(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

function maybeMaskName(value: unknown, includePii: boolean) {
  return includePii ? value ?? "" : maskName(String(value ?? ""));
}

function maybeMaskPhone(value: unknown, includePii: boolean) {
  return includePii ? value ?? "" : maskPhone(String(value ?? ""));
}

function maybeMaskAddress(value: unknown, includePii: boolean) {
  return includePii ? value ?? "" : maskAddress(String(value ?? ""), 3);
}

const specs: QuerySpec[] = [
  {
    table: "customers",
    sheet: "customers_private",
    orderBy: "created_at",
    map: (row, { includePii }) => ({
      customer_id: row.id,
      created_at: row.created_at,
      name: maybeMaskName(row.name, includePii),
      phone: maybeMaskPhone(row.phone, includePii),
      acquisition_source: row.acquisition_source,
      first_contact_at: row.first_contact_at,
      address_full: maybeMaskAddress(row.address_full, includePii),
      address_dong: row.address_dong,
      address_apt: includePii ? row.address_apt ?? "" : row.address_apt ? "***" : "",
      housing_type: row.housing_type,
      household_size: row.household_size,
      has_kids: row.has_kids,
      has_elderly: row.has_elderly,
      utm_source: row.utm_source,
      utm_campaign: row.utm_campaign,
      referrer_url: row.referrer_url
    })
  },
  {
    table: "homes",
    sheet: "homes",
    orderBy: "created_at",
    map: (row, { includePii }) => ({
      home_id: row.id,
      customer_id: row.customer_id,
      address_full: maybeMaskAddress(row.address_full, includePii),
      address_dong: row.address_dong,
      address_apt: includePii ? row.address_apt ?? "" : row.address_apt ? "***" : "",
      postal_code: row.postal_code,
      size_pyung: row.size_pyung,
      building_type: row.building_type,
      year_built: row.year_built,
      floor: row.floor,
      complex_id: row.complex_id,
      created_at: row.created_at
    })
  },
  {
    table: "orders",
    sheet: "orders",
    orderBy: "created_at",
    map: (row) => ({
      order_id: row.id,
      order_number: row.order_number,
      customer_id: row.customer_id,
      home_id: row.home_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      channel: row.channel,
      source: row.source,
      campaign: row.campaign,
      session_id: row.session_id,
      landing_path: row.landing_path,
      device_type: row.device_type,
      region_code: row.region_code,
      service_code: row.service_type_code,
      skus: json(row.skus),
      reason: row.reason,
      urgency: row.urgency,
      self_diagnosis: row.self_diagnosis,
      status: row.status,
      subtotal_amount: row.subtotal_amount,
      visit_fee: row.visit_fee,
      total_amount: row.total_amount,
      quality_flag: row.quality_flag
    })
  },
  {
    table: "quotes",
    sheet: "quotes",
    orderBy: "created_at",
    map: (row) => ({
      quote_id: row.id,
      order_id: row.order_id,
      version: row.version,
      items: json(row.items),
      total_material: row.total_material,
      total_labor: row.total_labor,
      visit_fee: row.visit_fee,
      discount: row.discount,
      total_final: row.total_final,
      quoted_at: row.quoted_at,
      accepted_at: row.accepted_at,
      created_at: row.created_at
    })
  },
  {
    table: "payments",
    sheet: "payments",
    orderBy: "created_at",
    map: (row) => ({
      payment_id: row.id,
      order_id: row.order_id,
      quote_id: row.quote_id,
      provider: row.provider,
      payment_key: row.payment_key ? "stored" : "",
      order_name: row.order_name,
      method: row.method,
      amount: row.amount,
      status: row.status,
      requested_at: row.requested_at,
      approved_at: row.approved_at,
      paid_at: row.paid_at,
      refund_amount: row.refund_amount,
      provider_status: row.provider_status,
      created_at: row.created_at
    })
  },
  { table: "reservations", sheet: "reservations", orderBy: "created_at" },
  { table: "jobs", sheet: "jobs", orderBy: "created_at" },
  { table: "media", sheet: "media", orderBy: "created_at" },
  { table: "inspections", sheet: "inspections", orderBy: "created_at" },
  { table: "feedbacks", sheet: "feedbacks", orderBy: "submitted_at" },
  { table: "warranty_cases", sheet: "warranty_cases", orderBy: "created_at" },
  {
    table: "notifications",
    sheet: "notification_queue",
    orderBy: "created_at",
    map: (row, { includePii }) => ({
      notification_id: row.id,
      order_id: row.order_id,
      job_id: row.job_id,
      channel: row.channel,
      template_key: row.template_code,
      recipient: includePii ? row.recipient ?? "" : maskPhone(String(row.recipient ?? "")),
      status: row.send_status,
      payload: json(row.payload),
      sent_at: row.sent_at,
      created_at: row.created_at
    })
  },
  { table: "events", sheet: "events", orderBy: "occurred_at", limit: 50000 },
  { table: "sessions", sheet: "sessions", orderBy: "first_event_time" },
  { table: "materials", sheet: "materials", orderBy: "name", ascending: true },
  {
    table: "technicians",
    sheet: "technicians",
    orderBy: "created_at",
    map: (row, { includePii }) => ({
      technician_id: row.id,
      name: includePii ? row.name ?? "" : maskName(String(row.name ?? "")),
      phone: includePii ? row.phone ?? "" : maskPhone(String(row.phone ?? "")),
      region: row.region,
      type: row.type,
      grade: row.grade,
      skills: json(row.skills),
      experience_years: row.experience_years,
      specialties: json(row.specialties),
      avg_nps: row.avg_nps,
      pass_rate: row.pass_rate,
      active_jobs_per_month: row.active_jobs_per_month,
      is_active: row.is_active,
      created_at: row.created_at
    })
  },
  { table: "dim_services", sheet: "dim_services", orderBy: "code", ascending: true },
  { table: "dim_channels", sheet: "dim_channels", orderBy: "code", ascending: true },
  { table: "dim_campaigns", sheet: "dim_campaigns", orderBy: "code", ascending: true },
  { table: "dim_regions", sheet: "dim_regions", orderBy: "code", ascending: true }
];

const photoAngleRows = [
  { angle: "wide", label: "전체 컷", owner: "customer", description: "설치 위치와 주변 전체" },
  { angle: "close", label: "문제 부위", owner: "customer", description: "파손/누수/오작동 부위 클로즈업" },
  { angle: "context", label: "주변·규격", owner: "customer", description: "배관/벽/바닥/규격 정보" },
  { angle: "before", label: "시공 전", owner: "technician", description: "작업 전 상태" },
  { angle: "during", label: "작업 중", owner: "technician", description: "철거/설치 중 핵심 장면" },
  { angle: "after", label: "완료 후", owner: "technician", description: "완료 전체/마감" },
  { angle: "material", label: "자재", owner: "technician", description: "사용 자재/영수증" },
  { angle: "issue", label: "이슈", owner: "technician", description: "추가 비용/파손/특이사항" }
];

function columnsForRows(rows: Record<string, unknown>[]) {
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  return columns;
}

function filterByDate(rows: Record<string, unknown>[], from: string | null, to: string | null) {
  if (!from && !to) return rows;
  const fromTime = from ? new Date(from).getTime() : -Infinity;
  const toTime = to ? new Date(to).getTime() : Infinity;
  return rows.filter((row) => {
    const value = row.created_at ?? row.occurred_at ?? row.first_event_time ?? row.quoted_at ?? row.submitted_at;
    if (!value) return true;
    const time = new Date(String(value)).getTime();
    if (!Number.isFinite(time)) return true;
    return time >= fromTime && time < toTime;
  });
}

function summarySheet(sheets: ExportSheet[], includePii: boolean) {
  return {
    name: "README",
    columns: ["항목", "값", "설명"],
    rows: [
      { 항목: "exported_at", 값: new Date().toISOString(), 설명: "Supabase DB 기준 내보내기 생성 시각" },
      { 항목: "pii_mode", 값: includePii ? "include_pii" : "masked", 설명: includePii ? "관리자 요청으로 개인정보 원문 포함" : "기본값: 이름/전화/주소 마스킹" },
      { 항목: "source_of_truth", 값: "Supabase", 설명: "엑셀 파일은 원본 저장소가 아니라 다운로드 산출물입니다." },
      ...sheets.map((sheet) => ({ 항목: sheet.name, 값: sheet.rows.length, 설명: "rows" }))
    ]
  };
}

async function readSheet(spec: QuerySpec, includePii: boolean, from: string | null, to: string | null): Promise<ExportSheet> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from(spec.table).select("*");
  if (spec.orderBy) query = query.order(spec.orderBy, { ascending: spec.ascending ?? false });
  const { data, error } = await query.limit(spec.limit ?? 10000);
  if (error) throw new Error(`${spec.table}: ${error.message}`);
  const rows = filterByDate(((data ?? []) as Record<string, unknown>[]).map((row) => spec.map ? spec.map(row, { includePii }) : row), from, to);
  return {
    name: spec.sheet,
    columns: rows.length ? columnsForRows(rows) : ["empty"],
    rows: rows.length ? rows : [{ empty: "" }]
  };
}

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { searchParams } = new URL(request.url);
  const includePii = searchParams.get("include_pii") === "1";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    const dataSheets = [];
    for (const spec of specs) {
      dataSheets.push(await readSheet(spec, includePii, from, to));
    }
    dataSheets.push({
      name: "dim_photo_angles",
      columns: ["angle", "label", "owner", "description"],
      rows: photoAngleRows
    });

    const sheets = [summarySheet(dataSheets, includePii), ...dataSheets];
    const body = workbookXml(sheets);
    const suffix = includePii ? "with-pii" : "masked";

    return new Response(body, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="buildus-care-data-export-${suffix}.xls"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Failed to export data.", 500);
  }
}
