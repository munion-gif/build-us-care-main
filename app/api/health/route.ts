import { ok } from "@/lib/api-response";

export async function GET() {
  return ok({
    status: "healthy"
  });
}
