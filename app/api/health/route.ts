import { ok } from "@/lib/api-response";
import { hasSupabaseEnv } from "@/lib/supabase";

export async function GET() {
  return ok({
    status: "healthy",
    supabaseConfigured: hasSupabaseEnv(),
    paymentMockMode: process.env.PAYMENT_MOCK_MODE !== "false" || !process.env.TOSS_SECRET_KEY,
    timestamp: new Date().toISOString()
  });
}
