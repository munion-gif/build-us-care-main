import { SettingsForm } from "./settings-client";
import { FAQManager } from "./faq-manager-client";
import { getAdminFaqs } from "@/lib/faqs";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getSettings() {
  if (!hasSupabaseEnv()) return {};
  const { data } = await getSupabaseAdmin()
    .from("app_configs")
    .select("key,value")
    .in("key", [
      "kakao_channel_url",
      "service_phone",
      "slot_cap",
      "maintenance_mode",
      "admin_email",
      "admin_phone",
      "notify_channel",
      "cancel_policy_full_refund_hours",
      "cancel_policy_full_refund_days_before",
      "cancel_policy_partial_refund_rate",
      "cancel_policy_no_refund_status"
    ]);
  return Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
}

export default async function AdminSettingsPage() {
  const [settings, faqs] = await Promise.all([getSettings(), getAdminFaqs()]);

  return (
    <>
      <header className="adm-page-header">
        <h1 className="adm-page-title">운영 설정</h1>
        <p className="adm-page-sub">카카오 상담 링크, 대표 전화번호, 예약 슬롯 수, 점검 안내를 관리합니다.</p>
      </header>
      <div className="adm-content adm-stack">
        <section className="adm-card adm-section">
          <div className="adm-section-head">
            <div>
              <h2 className="adm-card-title">데이터 내보내기</h2>
              <p className="adm-muted adm-section-note">Supabase를 원본으로 두고, 필요할 때 운영 데이터셋을 Excel 파일로 내려받습니다.</p>
            </div>
          </div>
          <div className="adm-quick-filter-row" aria-label="데이터 내보내기">
            <a className="adm-btn adm-btn-primary" href="/api/admin/data-export">마스킹 Excel 다운로드</a>
            <a className="adm-btn adm-btn-secondary" href="/api/admin/data-export?include_pii=1">개인정보 포함 다운로드</a>
          </div>
          <p className="adm-help">기본 다운로드는 고객명, 전화번호, 주소를 마스킹합니다. 개인정보 포함 파일은 운영상 필요한 경우에만 사용하세요.</p>
        </section>
        <SettingsForm initialSettings={settings} />
        <FAQManager initialFaqs={faqs} />
      </div>
    </>
  );
}
