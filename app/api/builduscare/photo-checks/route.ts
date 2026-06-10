import { fail } from "@/lib/api-response";
import { POST as createBuilduscareOrder } from "../orders/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePayload(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let sourceForm: FormData;
  try {
    sourceForm = await request.formData();
  } catch {
    return fail("BAD_REQUEST", "접수 정보를 다시 확인해주세요.", 400);
  }
  const payload = parsePayload(sourceForm.get("payload"));
  if (!payload) {
    return fail("BAD_REQUEST", "접수 정보를 다시 확인해주세요.", 400);
  }

  const formData = new FormData();
  formData.append(
    "payload",
    JSON.stringify({
      ...payload,
      item: String(payload.item || "사진 확인"),
      reservation: { date: null, time: null },
      selected: [],
      totals: { productAmount: 0, laborAmount: 0, disposalAmount: 0, totalAmount: 0 }
    })
  );

  for (const [index, entry] of sourceForm.getAll("photos").entries()) {
    if (entry instanceof File && entry.size > 0) {
      formData.append("photos", entry, entry.name || `photo-${index + 1}.jpg`);
    }
  }

  const response = await createBuilduscareOrder(new Request(new URL("/api/builduscare/orders", request.url), {
    method: "POST",
    headers: {
      "x-builduscare-submission-type": "photo_check",
      "user-agent": request.headers.get("user-agent") ?? "builduscare-static",
      "x-forwarded-for": request.headers.get("x-forwarded-for") ?? ""
    },
    body: formData
  }));

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json"
    }
  });
}
