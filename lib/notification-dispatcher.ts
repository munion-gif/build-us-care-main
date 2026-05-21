import crypto from "crypto";
import { formatKRW } from "@/lib/format";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

type NotificationRow = {
  id: string;
  order_id?: string | null;
  job_id?: string | null;
  channel: string;
  template_code: string;
  recipient: string;
  send_status: string;
  payload?: Record<string, unknown> | null;
  attempts?: number | null;
};

type AppConfig = Map<string, string>;

type DispatchResult = {
  ok: boolean;
  channel: "email" | "sms" | "kakao" | "none";
  provider?: string;
  message?: string;
  error?: string;
  providerResponse?: unknown;
};

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://buildus-care-flow.vercel.app";
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function templateMessage(row: NotificationRow) {
  const payload = row.payload ?? {};
  const orderNumber = text(payload.order_number, "주문");
  const statusUrl = text(payload.status_url);

  if (row.template_code === "order_submitted") {
    return {
      subject: `[빌드어스] ${orderNumber} 주문이 접수되었습니다`,
      body: `[빌드어스] 주문이 접수되었습니다.\n주문번호: ${orderNumber}\n담당자가 확인 후 다음 단계를 안내드릴게요.`
    };
  }

  if (row.template_code === "diagnosis_quote_ready") {
    const total = Number(payload.total_final ?? 0);
    return {
      subject: `[빌드어스] ${orderNumber} 사진 판정 견적이 준비되었습니다`,
      body: [
        "[빌드어스] 사진 판정 기준 견적이 준비되었습니다.",
        `주문번호: ${orderNumber}`,
        total > 0 ? `견적금액: ${formatKRW(total)}` : "",
        statusUrl ? `견적 확인/결제: ${statusUrl}` : `${siteUrl()}/orders/${text(payload.order_id)}`
      ].filter(Boolean).join("\n")
    };
  }

  if (row.template_code === "technician_late_check") {
    return {
      subject: `[빌드어스] ${orderNumber} 방문 시작 재확인 요청`,
      body: [
        "[빌드어스] 방문 시작 시간이 지나 관리자 재확인 요청이 접수되었습니다.",
        `주문번호: ${orderNumber}`,
        `기사: ${text(payload.technician_name, "담당 기사")}`,
        payload.scheduled_at ? `예정시각: ${String(payload.scheduled_at)}` : "",
        "도착/시작 여부를 확인해주세요."
      ].filter(Boolean).join("\n")
    };
  }

  if (row.template_code === "reservation_confirmed") {
    return {
      subject: `[빌드어스] ${orderNumber} 방문 예약이 확정되었습니다`,
      body: [
        "[빌드어스] 방문 예약이 확정되었습니다.",
        `주문번호: ${orderNumber}`,
        payload.reservation_date ? `방문일정: ${String(payload.reservation_date)} ${text(payload.time_slot_label)}` : "",
        payload.technician_name ? `담당기사: ${String(payload.technician_name)}` : "",
        statusUrl ? `주문현황: ${statusUrl}` : ""
      ].filter(Boolean).join("\n")
    };
  }


  if (row.template_code === "report_video_ready") {
    return {
      subject: `[빌드어스] ${orderNumber} 완료 보고가 준비되었습니다`,
      body: `[빌드어스] 시공 완료 보고가 준비되었습니다.\n${text(payload.report_video_url)}`
    };
  }

  if (row.template_code === "admin_payment_completed") {
    return {
      subject: `[빌드어스] ${orderNumber} 결제 완료`,
      body: text(payload.message, `[빌드어스] 결제가 완료되었습니다.\n주문번호: ${orderNumber}`)
    };
  }

  if (row.template_code === "admin_new_order") {
    return {
      subject: `[빌드어스] ${orderNumber} 새 주문`,
      body: text(payload.message, `[빌드어스] 새 주문이 접수되었습니다.\n주문번호: ${orderNumber}`)
    };
  }

  return {
    subject: `[빌드어스] ${orderNumber} 알림`,
    body: text(payload.message, `[빌드어스] 알림이 도착했습니다.\n주문번호: ${orderNumber}`)
  };
}

async function loadConfigs(): Promise<AppConfig> {
  if (!hasSupabaseEnv()) return new Map();
  const keys = [
    "notify_channel",
    "admin_email",
    "admin_phone",
    "service_phone",
    "kakao_biz_api_key",
    "kakao_sender_key",
    "solapi_api_key",
    "solapi_api_secret",
    "solapi_sender_phone"
  ];
  const { data } = await getSupabaseAdmin().from("app_configs").select("key,value").in("key", keys);
  return new Map((data ?? []).map((row) => [row.key, row.value]));
}

function resolveRecipient(row: NotificationRow, configs: AppConfig) {
  if (row.recipient === "admin") {
    const channel = configs.get("notify_channel") || "none";
    if (channel === "email") return { channel, recipient: configs.get("admin_email") || "" };
    if (channel === "sms" || channel === "kakao") return { channel, recipient: configs.get("admin_phone") || "" };
    return { channel: "none", recipient: "" };
  }

  if (row.channel === "email") return { channel: "email", recipient: row.recipient };
  if (row.channel === "sms" || row.channel === "kakao") return { channel: row.channel, recipient: row.recipient };
  if (isEmail(row.recipient)) return { channel: "email", recipient: row.recipient };
  if (digits(row.recipient).length >= 8) return { channel: "sms", recipient: digits(row.recipient) };
  return { channel: "none", recipient: row.recipient };
}

async function sendEmail(to: string, subject: string, body: string): Promise<DispatchResult> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, channel: "email", error: "RESEND_API_KEY is not configured." };
  }
  if (!isEmail(to)) {
    return { ok: false, channel: "email", error: "Recipient is not a valid email address." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Buildus Care <onboarding@resend.dev>",
      to,
      subject,
      text: body
    })
  });
  const raw = await response.json().catch(() => ({}));
  return response.ok
    ? { ok: true, channel: "email", provider: "resend", providerResponse: raw }
    : { ok: false, channel: "email", provider: "resend", error: text((raw as any).message, response.statusText), providerResponse: raw };
}

function solapiAuthHeaders(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "");
  const signature = crypto.createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

async function sendSms(to: string, body: string, configs: AppConfig): Promise<DispatchResult> {
  const apiKey = process.env.SOLAPI_API_KEY || configs.get("solapi_api_key") || "";
  const apiSecret = process.env.SOLAPI_API_SECRET || configs.get("solapi_api_secret") || "";
  const from = digits(process.env.SOLAPI_SENDER_PHONE || configs.get("solapi_sender_phone") || configs.get("service_phone") || "");
  const recipient = digits(to);

  if (!apiKey || !apiSecret || !from) {
    return { ok: false, channel: "sms", error: "SOLAPI credentials or sender phone are not configured." };
  }
  if (recipient.length < 8) {
    return { ok: false, channel: "sms", error: "Recipient phone number is invalid." };
  }

  const response = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      Authorization: solapiAuthHeaders(apiKey, apiSecret),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        to: recipient,
        from,
        text: body.slice(0, 1000)
      }
    })
  });
  const raw = await response.json().catch(() => ({}));
  return response.ok
    ? { ok: true, channel: "sms", provider: "solapi", providerResponse: raw }
    : { ok: false, channel: "sms", provider: "solapi", error: text((raw as any).errorMessage, response.statusText), providerResponse: raw };
}

async function dispatchNotification(row: NotificationRow, configs: AppConfig): Promise<DispatchResult> {
  const { subject, body } = templateMessage(row);
  const target = resolveRecipient(row, configs);

  if (target.channel === "email") return sendEmail(target.recipient, subject, body);
  if (target.channel === "sms") return sendSms(target.recipient, body, configs);
  if (target.channel === "kakao") {
    return {
      ok: false,
      channel: "kakao",
      error: "Kakao AlimTalk provider is not configured. Use SMS or email until approved Kakao templates are connected."
    };
  }
  return { ok: false, channel: "none", error: "No dispatch channel was resolved for this notification." };
}

async function updateNotification(row: NotificationRow, result: DispatchResult) {
  const supabase = getSupabaseAdmin();
  const payload = {
    ...(row.payload ?? {}),
    dispatch: {
      channel: result.channel,
      provider: result.provider ?? null,
      message: result.message ?? null,
      error: result.error ?? null,
      provider_response: result.providerResponse ?? null,
      processed_at: new Date().toISOString()
    }
  };
  const patch: Record<string, unknown> = {
    send_status: result.ok ? "sent" : "failed",
    sent_at: result.ok ? new Date().toISOString() : null,
    payload,
    attempts: Number(row.attempts ?? 0) + 1,
    last_error: result.ok ? null : result.error ?? "Notification dispatch failed."
  };

  const { error } = await supabase.from("notifications").update(patch).eq("id", row.id);
  if (error && /attempts|last_error/i.test(error.message)) {
    const { attempts: _attempts, last_error: _lastError, ...legacyPatch } = patch;
    await supabase.from("notifications").update(legacyPatch).eq("id", row.id);
  }
}

export async function processNotificationQueue(limit = 20) {
  if (!hasSupabaseEnv()) throw new Error("Supabase is required.");

  const supabase = getSupabaseAdmin();
  const configs = await loadConfigs();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .in("send_status", ["queued", "pending"])
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as NotificationRow[];
  const results = [];
  for (const row of rows) {
    const result = await dispatchNotification(row, configs);
    await updateNotification(row, result);
    results.push({ id: row.id, template_code: row.template_code, ok: result.ok, channel: result.channel, error: result.error ?? null });
  }

  return {
    processed: results.length,
    sent: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results
  };
}
