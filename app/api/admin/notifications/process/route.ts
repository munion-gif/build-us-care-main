import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { processNotificationQueue } from "@/lib/notification-dispatcher";

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 20);

  try {
    return ok(await processNotificationQueue(limit));
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Notification processing failed.", 500);
  }
}
