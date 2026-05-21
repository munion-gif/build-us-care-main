import { formatKRW, formatServiceName } from "@/lib/format";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

type NotifyNewOrderParams = {
  orderNumber: string;
  customerName: string;
  serviceType: string;
  reservationDate?: string;
  timeSlot?: string;
  addressFull?: string;
  orderId?: string;
};

type NotifyPaymentCompletedParams = {
  orderNumber: string;
  customerName: string;
  amount: number;
  orderId?: string;
};

async function getConfigs(keys: string[]) {
  if (!hasSupabaseEnv()) return new Map<string, string>();
  const { data } = await getSupabaseAdmin().from("app_configs").select("key,value").in("key", keys);
  return new Map((data ?? []).map((row) => [row.key, row.value]));
}

async function recordNotification(type: string, message: string, payload: Record<string, unknown>, orderId?: string) {
  if (!hasSupabaseEnv()) return;
  await getSupabaseAdmin().from("notifications").insert({
    order_id: orderId ?? null,
    channel: "admin",
    template_code: type,
    recipient: "admin",
    send_status: "queued",
    payload: { message, ...payload }
  });
}

async function sendEmail(to: string, subject: string, message: string) {
  if (!process.env.RESEND_API_KEY) return false;
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
      text: message
    })
  });
  return response.ok;
}

async function notifyAdmin(type: string, subject: string, message: string, payload: Record<string, unknown>, orderId?: string) {
  try {
    const configs = await getConfigs(["notify_channel", "admin_email", "admin_phone", "kakao_biz_api_key", "kakao_sender_key", "solapi_api_key", "solapi_api_secret"]);
    const channel = configs.get("notify_channel") ?? "none";

    if (channel === "email" && configs.get("admin_email") && (await sendEmail(configs.get("admin_email")!, subject, message))) {
      await recordNotification(type, message, { ...payload, notify_channel: "email", sent: true }, orderId);
      return;
    }

    await recordNotification(type, message, { ...payload, notify_channel: channel, sent: false, reason: "external_channel_not_configured" }, orderId);
  } catch {
    // Notification failures must never block order/payment flows.
  }
}

export async function notifyNewOrder(params: NotifyNewOrderParams): Promise<void> {
  const serviceName = formatServiceName(params.serviceType);
  const reservation = params.reservationDate ? `\n예약: ${params.reservationDate} ${params.timeSlot === "morning" ? "오전" : "오후"}` : "";
  const message = `[빌드어스] 새 주문\n주문번호: ${params.orderNumber}\n고객명: ${params.customerName}\n서비스: ${serviceName}${reservation}`;
  await notifyAdmin("admin_new_order", "빌드어스 새 주문", message, params as Record<string, unknown>, params.orderId);
}

export async function notifyPaymentCompleted(params: NotifyPaymentCompletedParams): Promise<void> {
  const message = `[빌드어스] 결제 완료\n주문번호: ${params.orderNumber}\n고객명: ${params.customerName}\n금액: ${formatKRW(params.amount)}`;
  await notifyAdmin("admin_payment_completed", "빌드어스 결제 완료", message, params as Record<string, unknown>, params.orderId);
}
