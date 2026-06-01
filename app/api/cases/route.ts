import { fail, ok } from "@/lib/api-response";
import { getPublicCases, parseBoundedInt } from "@/lib/public-cases";

export const revalidate = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const result = await getPublicCases({
      service: searchParams.get("service") ?? "all",
      region: searchParams.get("region") ?? "all",
      limit: parseBoundedInt(searchParams.get("limit"), 20, 1, 50),
      offset: parseBoundedInt(searchParams.get("offset"), 0, 0, 10000)
    });

    return ok(result, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800"
      }
    });
  } catch (error) {
    return fail("internal_error", error instanceof Error ? error.message : "Failed to load cases.", 500);
  }
}
