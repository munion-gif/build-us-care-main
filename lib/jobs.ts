import { fail } from "@/lib/api-response";
import type { getSupabaseAdmin } from "@/lib/supabase";

export type Phase1JobStatus = "scheduled" | "in_progress" | "done" | "inspected";

export async function readJobOr404(supabase: ReturnType<typeof getSupabaseAdmin>, jobId: string) {
  const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export function invalidStatus(currentStatus: string, expectedStatus: Phase1JobStatus) {
  return fail("INVALID_STATUS", `Job status must be ${expectedStatus}.`, 400, {
    currentStatus,
    expectedStatus
  });
}

export async function insertJobStatusLog(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  jobId: string,
  fromStatus: string | null,
  toStatus: string,
  memo: string
) {
  await supabase.from("job_status_logs").insert({
    job_id: jobId,
    from_status: fromStatus,
    to_status: toStatus,
    memo
  });
}
