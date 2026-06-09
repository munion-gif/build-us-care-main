import { AdminSlotsClient } from "./slots-client";

export const dynamic = "force-dynamic";

export default function AdminSlotsPage() {
  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">일정관리</h1>
        <p className="adm-page-sub">날짜별 오전/오후 예약과 현장 방문 정보를 확인합니다.</p>
      </header>
      <AdminSlotsClient />
    </>
  );
}
