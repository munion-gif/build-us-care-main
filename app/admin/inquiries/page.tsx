import { getIntakeList } from "@/lib/admin-intake-data";
import InquiriesClient from "./inquiries-client";

export const dynamic = "force-dynamic";

export default async function AdminInquiriesPage() {
  const { items } = await getIntakeList();
  return <InquiriesClient items={items} />;
}
