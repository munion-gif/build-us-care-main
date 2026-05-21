import type { SupabaseClient } from "@supabase/supabase-js";
import { ORDER_PHOTOS_BUCKET } from "@/lib/storage";

type MediaOwner = { order_id: string; job_id?: never } | { order_id?: never; job_id: string };

export function storageUrlForPath(filePath: string) {
  return `storage://${ORDER_PHOTOS_BUCKET}/${filePath}`;
}

export function assertSingleMediaOwner(owner: { order_id?: string; job_id?: string }) {
  const hasOrderId = Boolean(owner.order_id);
  const hasJobId = Boolean(owner.job_id);

  return (hasOrderId || hasJobId) && hasOrderId !== hasJobId;
}

export async function getNextMediaSortOrder(supabase: SupabaseClient<any, "public", any>, owner: MediaOwner) {
  const ownerColumn = owner.order_id ? "order_id" : "job_id";
  const ownerId = owner.order_id ?? owner.job_id;
  const { data, error } = await supabase
    .from("media")
    .select("sort_order")
    .eq(ownerColumn, ownerId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return ((data?.sort_order as number | undefined) ?? 0) + 1;
}
