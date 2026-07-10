import { notFound } from "next/navigation";
import { getIntakeDetail } from "@/lib/admin-intake-data";
import InquiryDetailClient from "./inquiry-detail-client";

export const dynamic = "force-dynamic";

export default async function AdminInquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getIntakeDetail(id);
  if (!detail) notFound();
  const kakaoUrl = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL?.trim() || "https://pf.kakao.com/_PxkzsX/chat";
  return <InquiryDetailClient detail={detail} kakaoUrl={kakaoUrl} />;
}
