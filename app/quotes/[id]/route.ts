import { NextResponse } from "next/server";
import { buildManualQuoteDocumentInput } from "@/lib/manual-quote-document";
import { buildQuoteDocumentHtml, buildQuoteDocumentInputFromOrderStatus } from "@/lib/quote-document";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

function htmlResponse(html: string, status = 200) {
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store"
    }
  });
}

function errorHtml(title: string, message: string) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f4f7; color: #1d1d1f; font-family: Arial, "Noto Sans KR", sans-serif; }
    main { width: min(420px, calc(100vw - 32px)); padding: 28px; border-radius: 18px; background: #fff; box-shadow: 0 16px 40px rgba(16,24,40,0.08); }
    h1 { margin: 0 0 10px; font-size: 22px; line-height: 30px; }
    p { margin: 0; color: #6e6e73; font-size: 14px; line-height: 22px; }
  </style>
</head>
<body><main><h1>${title}</h1><p>${message}</p></main></body>
</html>`;
}

async function fetchManualQuote(id: string, accessToken: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("manual_quotes")
    .select(`
      id,
      quote_number,
      customer_name,
      customer_phone,
      address_text,
      items,
      total_material,
      total_labor,
      visit_fee,
      discount,
      total_final,
      public_access_token,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .eq("public_access_token", accessToken)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function fetchOrderQuote(id: string, accessToken: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("orders")
    .select(`
      id,
      order_number,
      access_token,
      service_type_code,
      special_requests,
      homes(address_full),
      customers(name,phone),
      quotes(
        id,
        version,
        items,
        total_material,
        total_labor,
        total_final,
        accepted_at,
        created_at
      ),
      jobs(id,scheduled_at,created_at),
      reservations(id,reserved_date,time_slot),
      payments(
        id,
        status,
        provider,
        method,
        amount,
        online_payment_amount,
        onsite_payment_amount,
        total_amount,
        paid_at,
        approved_at,
        created_at
      )
    `)
    .eq("id", id)
    .eq("access_token", accessToken)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function GET(request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    return htmlResponse(errorHtml("견적서를 불러올 수 없습니다", "현재 서버 환경이 준비되지 않았습니다."), 503);
  }

  const { id } = await context.params;
  const parsedId = uuidSchema.safeParse(id);
  const accessToken = new URL(request.url).searchParams.get("accessToken") ?? "";
  if (!parsedId.success || !accessToken) {
    return htmlResponse(errorHtml("견적서 링크를 확인해주세요", "견적서 주소 또는 접근토큰이 올바르지 않습니다."), 400);
  }

  try {
    const manualQuote = await fetchManualQuote(parsedId.data, accessToken);
    if (manualQuote) {
      return htmlResponse(buildQuoteDocumentHtml(buildManualQuoteDocumentInput(manualQuote)));
    }

    const order = await fetchOrderQuote(parsedId.data, accessToken);
    if (order) {
      return htmlResponse(buildQuoteDocumentHtml(buildQuoteDocumentInputFromOrderStatus(order)));
    }

    return htmlResponse(errorHtml("견적서를 찾을 수 없습니다", "링크가 만료되었거나 접근 정보가 올바르지 않습니다."), 404);
  } catch (error) {
    return htmlResponse(
      errorHtml("견적서를 불러오지 못했습니다", error instanceof Error ? error.message : "잠시 후 다시 시도해주세요."),
      500
    );
  }
}
