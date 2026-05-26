import { ok } from "@/lib/api-response";
import { hasSupabaseEnv } from "@/lib/supabase";

export async function GET() {
  return ok({
    status: "healthy",
    supabaseConfigured: hasSupabaseEnv(),
    tossConfigured: Boolean(process.env.TOSS_SECRET_KEY),
    paymentMockMode: process.env.PAYMENT_MOCK_MODE === "true",
    timestamp: new Date().toISOString()
  });
}
