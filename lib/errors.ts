import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "CONFIGURATION_ERROR"
  | "SUPABASE_NOT_CONFIGURED"
  | "PAYMENT_ERROR"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "INTERNAL_ERROR";

const legacyCodeMap: Record<string, ApiErrorCode> = {
  bad_request: "BAD_REQUEST",
  unauthorized: "UNAUTHORIZED",
  forbidden: "FORBIDDEN",
  not_found: "NOT_FOUND",
  conflict: "CONFLICT",
  supabase_not_configured: "SUPABASE_NOT_CONFIGURED",
  internal_error: "INTERNAL_ERROR"
};

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function normalizeErrorCode(code: string): ApiErrorCode {
  if (code in legacyCodeMap) return legacyCodeMap[code];
  return code as ApiErrorCode;
}

export function apiError(code: ApiErrorCode | string, message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: normalizeErrorCode(code),
        message,
        ...(details === undefined ? {} : { details })
      }
    },
    { status }
  );
}

export function validationError(error: ZodError, message = "Validation failed.") {
  return apiError("VALIDATION_ERROR", message, 400, error.flatten());
}

export function unknownError(error: unknown) {
  if (error instanceof ApiError) {
    return apiError(error.code, error.message, error.status, error.details);
  }

  const message = error instanceof Error ? error.message : "Unknown server error.";
  return apiError("INTERNAL_ERROR", message, 500);
}

export async function readJson(request: Request) {
  return request.json().catch(() => null);
}
