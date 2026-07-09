// 관리자 홈 대시보드 — 가벼운 카운트 위주 로딩
import { formatServiceName } from "@/lib/format";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export type DashStats = { newIntake: number; paymentPending: number; visitPending: number; todayVisit: number };
export type DashVisit = { name: string; slot: string; address: string };
export type DashIntake = { id: string; name: string; item: string; at: string | null; isNew: boolean };

export type Dashboard = {
  hasDb: boolean;
  todayText: string;
  stats: DashStats;
  todayVisits: DashVisit[];
  recentIntakes: DashIntake[];
};

function one(v: any): any {
  return Array.isArray(v) ? v[0] : v;
}
function kstToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function todayDisplay() {
  const s = kstToday();
  const d = new Date(`${s}T00:00:00+09:00`);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${Number(s.slice(5, 7))}월 ${Number(s.slice(8))}일 (${dow})`;
}
function slotFromAt(value?: string | null) {
  if (!value) return "";
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hour12: false }).format(new Date(value)));
  return hour < 13 ? "오전" : "오후";
}
function shortTime(iso?: string | null) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

async function countOf(query: any): Promise<number> {
  const { count } = await query;
  return Number(count ?? 0);
}

export async function getDashboard(): Promise<Dashboard> {
  if (!hasSupabaseEnv()) return SAMPLE_DASHBOARD;
  const supabase = getSupabaseAdmin();
  const today = kstToday();
  const notTest = (q: any) => q.or("is_test.is.null,is_test.eq.false");

  const [newIntake, paymentPending, visitPending, todayVisitsRes, recentRes] = await Promise.all([
    countOf(notTest(supabase.from("diagnoses").select("id", { count: "exact", head: true })).is("result", null)),
    countOf(notTest(supabase.from("orders").select("id", { count: "exact", head: true })).is("deleted_at", null).in("status", ["payment_pending", "pending_product_payment"])),
    countOf(notTest(supabase.from("orders").select("id", { count: "exact", head: true })).is("deleted_at", null).in("status", ["paid", "product_paid"])),
    supabase
      .from("jobs")
      .select("id,scheduled_at,status,orders(service_type_code,customers(name,address_full),homes(address_full))")
      .gte("scheduled_at", `${today}T00:00:00+09:00`)
      .lte("scheduled_at", `${today}T23:59:59+09:00`)
      .neq("status", "cancelled")
      .order("scheduled_at", { ascending: true })
      .limit(20),
    notTest(supabase.from("diagnoses").select("id,result,customer_name,service_type_code,service_code,created_at,raw_response,orders(customers(name))"))
      .order("created_at", { ascending: false })
      .limit(5)
  ]);

  const todayVisits: DashVisit[] = (todayVisitsRes.data ?? []).map((j: any) => {
    const order = one(j.orders);
    const cust = one(order?.customers);
    const home = one(order?.homes);
    return {
      name: cust?.name ?? "고객",
      slot: slotFromAt(j.scheduled_at),
      address: (home?.address_full ?? cust?.address_full ?? "").split(" ").slice(0, 3).join(" ")
    };
  });

  const recentIntakes: DashIntake[] = (recentRes.data ?? []).map((d: any) => ({
    id: String(d.id),
    name: d.customer_name ?? one(one(d.orders)?.customers)?.name ?? "이름 미입력",
    item: d.raw_response?.item ?? formatServiceName(d.service_type_code ?? d.service_code),
    at: shortTime(d.created_at),
    isNew: d.result == null
  }));

  return {
    hasDb: true,
    todayText: todayDisplay(),
    stats: { newIntake, paymentPending, visitPending, todayVisit: todayVisits.length },
    todayVisits,
    recentIntakes
  };
}

const SAMPLE_DASHBOARD: Dashboard = {
  hasDb: false,
  todayText: todayDisplay(),
  stats: { newIntake: 3, paymentPending: 2, visitPending: 2, todayVisit: 1 },
  todayVisits: [{ name: "최지아", slot: "오후", address: "경기 의왕시 신안" }],
  recentIntakes: [
    { id: "s1", name: "박서연", item: "세면대", at: "7/9 09:12", isNew: true },
    { id: "s2", name: "이준호", item: "양변기", at: "7/9 08:40", isNew: false },
    { id: "s3", name: "최지아", item: "주방수전", at: "7/8 18:05", isNew: false }
  ]
};
