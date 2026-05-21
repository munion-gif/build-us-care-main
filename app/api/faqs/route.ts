import { ok } from "@/lib/api-response";
import { getPublicFaqs } from "@/lib/faqs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const faqs = await getPublicFaqs();
  return ok({ faqs });
}
