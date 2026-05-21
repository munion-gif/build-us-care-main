import { createHmac, timingSafeEqual } from "node:crypto";

export type TossConfirmInput = {
  paymentKey: string;
  orderId: string;
  amount: number;
};

export type TossConfirmResult = {
  provider: "toss";
  paymentKey: string;
  status: "DONE" | "FAILED";
  approvedAt: string | null;
  raw: Record<string, unknown>;
};

export async function confirmTossPayment(input: TossConfirmInput): Promise<TossConfirmResult> {
  const mockMode = process.env.PAYMENT_MOCK_MODE === "true" || !process.env.TOSS_SECRET_KEY || input.paymentKey.startsWith("mock-");

  if (mockMode) {
    return {
      provider: "toss",
      paymentKey: input.paymentKey,
      status: "DONE",
      approvedAt: new Date().toISOString(),
      raw: {
        mock: true,
        paymentKey: input.paymentKey,
        orderId: input.orderId,
        amount: input.amount,
        status: "DONE"
      }
    };
  }

  const response = await fetch(process.env.TOSS_CONFIRM_URL || "https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const raw = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    return {
      provider: "toss",
      paymentKey: input.paymentKey,
      status: "FAILED",
      approvedAt: null,
      raw
    };
  }

  return {
    provider: "toss",
    paymentKey: String(raw.paymentKey ?? input.paymentKey),
    status: raw.status === "DONE" ? "DONE" : "FAILED",
    approvedAt: typeof raw.approvedAt === "string" ? raw.approvedAt : null,
    raw
  };
}

export function isPaymentMockMode() {
  return process.env.PAYMENT_MOCK_MODE === "true" || !process.env.TOSS_SECRET_KEY;
}

export async function cancelTossPayment(params: {
  paymentKey: string;
  cancelReason: string;
  refundAmount?: number;
}) {
  const mockMode = isPaymentMockMode() || params.paymentKey.startsWith("mock-");

  if (mockMode) {
    return {
      mock: true,
      paymentKey: params.paymentKey,
      status: "CANCELED",
      cancelReason: params.cancelReason,
      cancelAmount: params.refundAmount ?? null,
      canceledAt: new Date().toISOString()
    };
  }

  const response = await fetch(`https://api.tosspayments.com/v1/payments/${params.paymentKey}/cancel`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      cancelReason: params.cancelReason,
      ...(params.refundAmount !== undefined ? { cancelAmount: params.refundAmount } : {})
    })
  });

  const raw = await response.json();
  if (!response.ok) {
    throw new Error(typeof raw?.message === "string" ? raw.message : "Toss cancel failed.");
  }

  return raw;
}

export function verifyTossWebhookSignature(rawBody: string, signature: string | null, secret: string | undefined) {
  if (!secret) {
    return false;
  }

  if (!signature) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
  const candidates = signature
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return candidates.some((candidate) => safeCompare(candidate, expected) || safeCompare(candidate, expectedHex));
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
