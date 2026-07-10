import { redirect } from "next/navigation";

// 예전 관리자 주소(/admin/dashboard) 북마크 호환용
export default function LegacyDashboardRedirect() {
  redirect("/admin");
}
