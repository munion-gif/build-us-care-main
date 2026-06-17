import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { ADMIN_FUNNEL_STEPS, buildAdminFunnelReport, findAdminFunnelStep, formatAdminFunnelPercent } from "@/lib/admin-funnel";
import { EVENT_TYPES } from "@/lib/event-types";
import { measure } from "@/lib/perf";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const revalidate = 60;

function periodStart(period: string | null) {
  const days = period === "30d" || period === "month" ? 30 : 7;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function percent(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 1000) / 10}%`;
}

function diagnosisResultLabel(result?: string | null) {
  const labels: Record<string, string> = {
    replace_recommended: "교체추천",
    replacement_recommended: "교체추천",
    no_replacement_needed: "교체불필요",
    not_needed: "교체불필요",
    hold: "보류",
    site_check_required: "현장확인필요"
  };
  return labels[result ?? ""] ?? result ?? "대기";
}

async function getWarrantyWindow(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data } = await supabase
    .from("app_configs")
    .select("key,value")
    .in("key", ["warranty_period_days", "warranty_reminder_days"]);
  const configs = new Map((data ?? []).map((row) => [row.key, row.value]));
  const warrantyDays = Number(configs.get("warranty_period_days") ?? 365);
  const reminderDays = Number(configs.get("warranty_reminder_days") ?? 30);
  const now = Date.now();
  const lower = new Date(now - warrantyDays * 24 * 60 * 60 * 1000).toISOString();
  const upper = new Date(now - Math.max(warrantyDays - reminderDays, 0) * 24 * 60 * 60 * 1000).toISOString();
  return { lower, upper };
}

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) {
    return ok({
      period: "week",
      orders: { total: 0, paid: 0, conversionRate: "0%" },
      diagnoses: {
        total: 0,
        byResult: {
          교체추천: 0,
          교체불필요: 0,
          보류: 0,
          현장확인필요: 0
        }
      },
      funnel: {
        steps: buildAdminFunnelReport([]).steps,
        channels: buildAdminFunnelReport([]).channels,
        diagnosisRequested: 0,
        quoteStarted: 0,
        quoteSubmitted: 0,
        paymentCompleted: 0,
        quoteStartRate: "0%",
        quoteSubmitRate: "0%",
        paymentCompletionRate: "0%"
      },
      warrantyExpiringSoon: {
        count: 0,
        orders: []
      },
      localMode: true
    });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "week";
  const since = periodStart(period);
  const supabase = getSupabaseAdmin();

  const warrantyWindow = await measure("api.admin.analytics.getWarrantyWindow", () => getWarrantyWindow(supabase));

  const [orders, paidOrders, diagnoses, events, warrantyJobs] = await Promise.all([
    measure("api.admin.analytics.countOrders", () => supabase.from("orders").select("id", { count: "exact", head: true }).or("is_test.is.null,is_test.eq.false").is("deleted_at", null).gte("created_at", since)),
    measure("api.admin.analytics.countPaidOrders", () => supabase.from("orders").select("id", { count: "exact", head: true }).or("is_test.is.null,is_test.eq.false").is("deleted_at", null).in("status", ["paid", "product_paid"]).gte("created_at", since)),
    measure("api.admin.analytics.fetchDiagnoses", () => supabase.from("diagnoses").select("result").or("is_test.is.null,is_test.eq.false").gte("created_at", since)),
    measure("api.admin.analytics.fetchEvents", () => supabase
      .from("events")
      .select("id,event_type,session_id,source,properties")
      .in("event_type", [...ADMIN_FUNNEL_STEPS])
      .gte("occurred_at", since)),
    measure("api.admin.analytics.fetchWarrantyJobs", () => supabase
      .from("jobs")
      .select("id,completed_at,orders(order_number,customers(name,phone))")
      .in("status", ["done", "inspected"])
      .not("completed_at", "is", null)
      .gt("completed_at", warrantyWindow.lower)
      .lt("completed_at", warrantyWindow.upper)
      .order("completed_at", { ascending: true })
      .limit(10))
  ]);

  if (orders.error) return fail("internal_error", orders.error.message, 500);
  if (paidOrders.error) return fail("internal_error", paidOrders.error.message, 500);
  if (diagnoses.error) return fail("internal_error", diagnoses.error.message, 500);
  if (events.error) return fail("internal_error", events.error.message, 500);
  if (warrantyJobs.error) return fail("internal_error", warrantyJobs.error.message, 500);

  const diagnosisRows = diagnoses.data ?? [];
  const byResult: Record<string, number> = {
    교체추천: 0,
    교체불필요: 0,
    보류: 0,
    현장확인필요: 0
  };

  for (const row of diagnosisRows as any[]) {
    const result = diagnosisResultLabel(row.result);
    byResult[result] = (byResult[result] ?? 0) + 1;
  }

  const eventRows = events.data ?? [];
  const funnel = buildAdminFunnelReport(eventRows as any[]);
  const diagnosisRequested = findAdminFunnelStep(funnel, EVENT_TYPES.DIAGNOSIS_REQUESTED);
  const quoteStarted = findAdminFunnelStep(funnel, EVENT_TYPES.QUOTE_PAGE_VIEW);
  const quoteSubmitted = findAdminFunnelStep(funnel, EVENT_TYPES.ORDER_CREATED);
  const paymentCompleted = findAdminFunnelStep(funnel, EVENT_TYPES.PAYMENT_COMPLETED);

  return ok({
    period: period === "30d" || period === "month" ? "month" : "week",
    orders: {
      total: orders.count ?? 0,
      paid: paidOrders.count ?? 0,
      conversionRate: percent(paidOrders.count ?? 0, orders.count ?? 0)
    },
    diagnoses: {
      total: diagnosisRows.length,
      byResult
    },
    funnel: {
      steps: funnel.steps,
      channels: funnel.channels,
      diagnosisRequested: diagnosisRequested?.sessions ?? 0,
      quoteStarted: quoteStarted?.sessions ?? 0,
      quoteSubmitted: quoteSubmitted?.sessions ?? 0,
      paymentCompleted: paymentCompleted?.sessions ?? 0,
      quoteStartRate: formatAdminFunnelPercent(quoteStarted?.conversionFromPrevious),
      quoteSubmitRate: formatAdminFunnelPercent(quoteSubmitted?.conversionFromPrevious),
      paymentCompletionRate: formatAdminFunnelPercent(paymentCompleted?.conversionFromPrevious)
    },
    warrantyExpiringSoon: {
      count: warrantyJobs.data?.length ?? 0,
      orders: (warrantyJobs.data ?? []).map((job: any) => ({
        orderNumber: job.orders?.order_number ?? "-",
        customerName: job.orders?.customers?.name ?? "-",
        phone: job.orders?.customers?.phone ?? "-",
        completedAt: job.completed_at
      }))
    },
    localMode: false
  });
}
