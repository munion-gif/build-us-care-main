import { fail, ok } from "@/lib/api-response";
import { processNotificationQueue } from "@/lib/notification-dispatcher";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}` || new URL(request.url).searchParams.get("secret") === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return fail("unauthorized", "Cron secret is required.", 401);

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 20);

  try {
    return ok(await processNotificationQueue(limit));
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Notification processing failed.", 500);
  }
}

export async function GET(request: Request) {
  return POST(request);
}
