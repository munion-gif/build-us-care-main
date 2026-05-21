import { AdminSlotsClient } from "./slots-client";

export const dynamic = "force-dynamic";

export default function AdminSlotsPage() {
  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">슬롯 관리</h1>
        <p className="adm-page-sub">예약 가능 수량과 차단 날짜를 운영자가 직접 관리합니다.</p>
      </header>
      <AdminSlotsClient />
    </>
  );
}
