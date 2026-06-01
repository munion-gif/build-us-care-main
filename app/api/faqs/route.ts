import { ok } from "@/lib/api-response";
import { getPublicFaqs } from "@/lib/faqs";

export const revalidate = 300;

export async function GET() {
  const faqs = await getPublicFaqs();
  return ok(
    { faqs },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800"
      }
    }
  );
}
