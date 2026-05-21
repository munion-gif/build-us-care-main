import { fail } from "@/lib/api-response";
import type { getSupabaseAdmin } from "@/lib/supabase";

type Supabase = ReturnType<typeof getSupabaseAdmin>;

function parseCookie(header: string | null, name: string) {
  if (!header) return null;
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function getTechnicianSessionToken(request: Request) {
  return parseCookie(request.headers.get("cookie"), "tech_session");
}

export async function requireTechnician(supabase: Supabase, request: Request) {
  const token = getTechnicianSessionToken(request);

  if (!token) {
    return { technician: null, response: fail("UNAUTHORIZED", "Technician session is required.", 401) };
  }

  const { data, error } = await supabase
    .from("technicians")
    .select("*")
    .eq("access_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return { technician: null, response: fail("internal_error", error.message, 500) };
  }

  if (!data) {
    return { technician: null, response: fail("UNAUTHORIZED", "Technician session is invalid.", 401) };
  }

  return { technician: data, response: null };
}

export async function readTechnicianJobOrForbidden(supabase: Supabase, jobId: string, technicianId: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      `
      *,
      orders (
        id,
        order_number,
        status,
        service_type_code,
        skus,
        customers (*),
        homes (*),
        quotes (*),
        feedbacks (*)
      ),
      technicians (*),
      media (*),
      inspections (*)
    `
    )
    .eq("id", jobId)
    .eq("technician_id", technicianId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export function maskPhone(phone?: string | null) {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "*".repeat(phone.length);
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export function maskAddress(address?: string | null) {
  if (!address) return address;
  const parts = address.split(" ");
  if (parts.length <= 3) return `${parts[0] ?? ""} ${parts[1] ?? ""} ***`.trim();
  return `${parts.slice(0, 3).join(" ")} ***`;
}

export function maskName(name?: string | null) {
  if (!name) return name;
  return `${name.slice(0, 1)}${"*".repeat(Math.max(name.length - 1, 1))}`;
}

export function canRevealJobContact(job: { scheduled_at?: string | null }) {
  if (!job.scheduled_at) return false;
  const scheduled = new Date(job.scheduled_at).getTime();
  const now = Date.now();
  return scheduled - now <= 24 * 60 * 60 * 1000;
}
