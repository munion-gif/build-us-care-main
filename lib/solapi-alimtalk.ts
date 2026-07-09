import crypto from "crypto";

type SolapiAlimtalkResult = {
  ok: boolean;
  providerResponse?: unknown;
  error?: string;
};

export type QuoteAlimtalkPayload = {
  to: string;
  itemSummary: string;
  orderId: string;
  accessToken: string;
};

export type PhotoRequestAlimtalkPayload = {
  to: string;
  consultationMemo: string;
  orderId: string;
  accessToken: string;
};

export type OrderNoticeAlimtalkPayload = {
  to: string;
  noticeMemo: string;
  orderId: string;
  accessToken: string;
};

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function solapiAuthHeaders(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "");
  const signature = crypto.createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

function config() {
  return {
    apiKey: process.env.SOLAPI_API_KEY || "",
    apiSecret: process.env.SOLAPI_API_SECRET || "",
    pfId: process.env.SOLAPI_KAKAO_PFID || "",
    templateId: process.env.SOLAPI_QUOTE_TEMPLATE_ID || "",
    from: digits(process.env.SOLAPI_SENDER_PHONE || process.env.NEXT_PUBLIC_SERVICE_PHONE || "")
  };
}

function photoRequestConfig() {
  return {
    ...config(),
    templateId: process.env.SOLAPI_PHOTO_REQUEST_TEMPLATE_ID || ""
  };
}

function orderNoticeConfig() {
  return {
    ...config(),
    templateId: process.env.SOLAPI_ORDER_NOTICE_TEMPLATE_ID || ""
  };
}

export function quoteAlimtalkConfigStatus() {
  const current = config();
  return {
    configured: Boolean(current.apiKey && current.apiSecret && current.pfId && current.templateId && current.from),
    missing: [
      !current.apiKey ? "SOLAPI_API_KEY" : "",
      !current.apiSecret ? "SOLAPI_API_SECRET" : "",
      !current.pfId ? "SOLAPI_KAKAO_PFID" : "",
      !current.templateId ? "SOLAPI_QUOTE_TEMPLATE_ID" : "",
      !current.from ? "SOLAPI_SENDER_PHONE" : ""
    ].filter(Boolean)
  };
}

export function photoRequestAlimtalkConfigStatus() {
  const current = photoRequestConfig();
  return {
    configured: Boolean(current.apiKey && current.apiSecret && current.pfId && current.templateId && current.from),
    missing: [
      !current.apiKey ? "SOLAPI_API_KEY" : "",
      !current.apiSecret ? "SOLAPI_API_SECRET" : "",
      !current.pfId ? "SOLAPI_KAKAO_PFID" : "",
      !current.templateId ? "SOLAPI_PHOTO_REQUEST_TEMPLATE_ID" : "",
      !current.from ? "SOLAPI_SENDER_PHONE" : ""
    ].filter(Boolean)
  };
}

export function orderNoticeAlimtalkConfigStatus() {
  const current = orderNoticeConfig();
  return {
    configured: Boolean(current.apiKey && current.apiSecret && current.pfId && current.templateId && current.from),
    missing: [
      !current.apiKey ? "SOLAPI_API_KEY" : "",
      !current.apiSecret ? "SOLAPI_API_SECRET" : "",
      !current.pfId ? "SOLAPI_KAKAO_PFID" : "",
      !current.templateId ? "SOLAPI_ORDER_NOTICE_TEMPLATE_ID" : "",
      !current.from ? "SOLAPI_SENDER_PHONE" : ""
    ].filter(Boolean)
  };
}

export async function sendQuoteAlimtalk(payload: QuoteAlimtalkPayload): Promise<SolapiAlimtalkResult> {
  const current = config();
  const recipient = digits(payload.to);
  const missing = quoteAlimtalkConfigStatus().missing;

  if (missing.length > 0) {
    return { ok: false, error: `SOLAPI 설정이 없습니다: ${missing.join(", ")}` };
  }
  if (recipient.length < 8) {
    return { ok: false, error: "고객 연락처가 올바르지 않습니다." };
  }
  if (!payload.orderId || !payload.accessToken) {
    return { ok: false, error: "알림톡 버튼 링크에 필요한 주문ID 또는 접근토큰이 없습니다." };
  }

  const response = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      Authorization: solapiAuthHeaders(current.apiKey, current.apiSecret),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        to: recipient,
        from: current.from,
        text: `사진 기준 예상 견적서가 준비되었습니다.\n견적 내용: ${payload.itemSummary}`,
        kakaoOptions: {
          pfId: current.pfId,
          templateId: current.templateId,
          variables: {
            "#{품목요약}": text(payload.itemSummary, "견적 내용 확인"),
            "#{주문ID}": payload.orderId,
            "#{접근토큰}": payload.accessToken
          }
        }
      }
    })
  });

  const raw = await response.json().catch(() => ({}));
  if (response.ok) {
    // 솔라피는 HTTP 200을 주면서도 실제 접수는 실패할 수 있음(statusCode 2000=정상). 코드 확인.
    const statusCode = String((raw as any).statusCode ?? "");
    const failedCount = Number((raw as any).groupInfo?.count?.registeredFailed ?? 0);
    if ((statusCode && statusCode !== "2000") || failedCount > 0) {
      return {
        ok: false,
        error: text((raw as any).statusMessage) || `카카오 알림톡 접수 실패 (코드 ${statusCode || "확인필요"})`,
        providerResponse: raw
      };
    }
    return { ok: true, providerResponse: raw };
  }

  const errorMessage =
    text((raw as any).errorMessage) ||
    text((raw as any).message) ||
    text((raw as any).error?.message) ||
    response.statusText;
  return { ok: false, error: errorMessage, providerResponse: raw };
}

export async function sendPhotoRequestAlimtalk(payload: PhotoRequestAlimtalkPayload): Promise<SolapiAlimtalkResult> {
  const current = photoRequestConfig();
  const recipient = digits(payload.to);
  const consultationMemo = text(payload.consultationMemo);
  const missing = photoRequestAlimtalkConfigStatus().missing;

  if (missing.length > 0) {
    return { ok: false, error: `SOLAPI 설정이 없습니다: ${missing.join(", ")}` };
  }
  if (recipient.length < 8) {
    return { ok: false, error: "고객 연락처가 올바르지 않습니다." };
  }
  if (!consultationMemo) {
    return { ok: false, error: "발송할 상담 메모를 입력해주세요." };
  }
  if (!payload.orderId || !payload.accessToken) {
    return { ok: false, error: "알림톡 버튼 링크에 필요한 주문ID 또는 접근토큰이 없습니다." };
  }

  const response = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      Authorization: solapiAuthHeaders(current.apiKey, current.apiSecret),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        to: recipient,
        from: current.from,
        text: `[Build us Care]\n\n${consultationMemo}`,
        kakaoOptions: {
          pfId: current.pfId,
          templateId: current.templateId,
          variables: {
            "#{상담메모}": consultationMemo,
            "#{주문ID}": payload.orderId,
            "#{접근토큰}": payload.accessToken
          }
        }
      }
    })
  });

  const raw = await response.json().catch(() => ({}));
  if (response.ok) return { ok: true, providerResponse: raw };

  const errorMessage =
    text((raw as any).errorMessage) ||
    text((raw as any).message) ||
    text((raw as any).error?.message) ||
    response.statusText;
  return { ok: false, error: errorMessage, providerResponse: raw };
}

export async function sendOrderNoticeAlimtalk(payload: OrderNoticeAlimtalkPayload): Promise<SolapiAlimtalkResult> {
  const current = orderNoticeConfig();
  const recipient = digits(payload.to);
  const noticeMemo = text(payload.noticeMemo);
  const missing = orderNoticeAlimtalkConfigStatus().missing;

  if (missing.length > 0) {
    return { ok: false, error: `SOLAPI 설정이 없습니다: ${missing.join(", ")}` };
  }
  if (recipient.length < 8) {
    return { ok: false, error: "고객 연락처가 올바르지 않습니다." };
  }
  if (!noticeMemo) {
    return { ok: false, error: "발송할 안내 메모를 입력해주세요." };
  }
  if (!payload.orderId || !payload.accessToken) {
    return { ok: false, error: "알림톡 버튼 링크에 필요한 주문ID 또는 접근토큰이 없습니다." };
  }

  const response = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      Authorization: solapiAuthHeaders(current.apiKey, current.apiSecret),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        to: recipient,
        from: current.from,
        text: `[Build us Care]\n\n${noticeMemo}`,
        kakaoOptions: {
          pfId: current.pfId,
          templateId: current.templateId,
          variables: {
            "#{안내메모}": noticeMemo,
            "#{주문ID}": payload.orderId,
            "#{접근토큰}": payload.accessToken
          }
        }
      }
    })
  });

  const raw = await response.json().catch(() => ({}));
  if (response.ok) return { ok: true, providerResponse: raw };

  const errorMessage =
    text((raw as any).errorMessage) ||
    text((raw as any).message) ||
    text((raw as any).error?.message) ||
    response.statusText;
  return { ok: false, error: errorMessage, providerResponse: raw };
}
