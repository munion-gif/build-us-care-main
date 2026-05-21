import { createHash, randomUUID } from "node:crypto";

export type OperationalLogInput = {
  endpoint: string;
  method: string;
  requestId?: string;
  identifiers?: Record<string, string | number | boolean | null | undefined>;
  adminKeyId?: string | null;
  success: boolean;
  errorCode?: string;
};

export function createRequestId() {
  return randomUUID();
}

export function fingerprintSecret(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function logOperation(input: OperationalLogInput) {
  const payload = {
    timestamp: new Date().toISOString(),
    request_id: input.requestId ?? createRequestId(),
    endpoint: input.endpoint,
    method: input.method,
    identifiers: input.identifiers ?? {},
    admin_key_id: input.adminKeyId ?? null,
    success: input.success,
    error_code: input.errorCode ?? null
  };

  console.log(JSON.stringify({ type: "operational_event", ...payload }));
}
