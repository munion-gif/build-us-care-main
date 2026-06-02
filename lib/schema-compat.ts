export function isSchemaCompatibilityError(error: unknown) {
  const err = error as { code?: string; message?: string } | null | undefined;
  const message = String(err?.message ?? "");
  return (
    err?.code === "PGRST204" ||
    err?.code === "42703" ||
    message.includes("Could not find") ||
    /column .* does not exist/.test(message) ||
    /column .* does not exist/.test(message.toLowerCase())
  );
}

export function isLifecycleSchemaError(error: unknown) {
  const message = String((error as { message?: string } | null | undefined)?.message ?? "");
  return isSchemaCompatibilityError(error) && /(deleted_at|deleted_by|deleted_reason|is_test|test_marked_at|test_marked_by|test_note)/.test(message);
}
