"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch, useToast } from "../_lib/ui";

type Technician = {
  id: string;
  name: string;
  phone?: string | null;
  is_active?: boolean;
  region?: string | null;
};

type SettingRow = { key: string; value: string | null };

export default function AdminSettingsPage() {
  const toast = useToast();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [slotCap, setSlotCap] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [t, s] = await Promise.all([
      adminFetch<{ technicians: Technician[] }>("/api/admin/technicians"),
      adminFetch<{ settings: SettingRow[] } | SettingRow[] | Record<string, unknown>>("/api/admin/settings")
    ]);
    if (t.ok && t.data) setTechnicians(t.data.technicians ?? []);
    if (s.ok && s.data) {
      const rows: SettingRow[] = Array.isArray(s.data)
        ? (s.data as SettingRow[])
        : Array.isArray((s.data as any).settings)
          ? (s.data as any).settings
          : [];
      const map: Record<string, string> = {};
      for (const row of rows) if (row?.key) map[row.key] = row.value ?? "";
      setSettings(map);
      setSlotCap(map.slot_cap ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addTechnician() {
    if (!newName.trim()) {
      toast("기사 이름을 입력해주세요", "err");
      return;
    }
    setBusy(true);
    const res = await adminFetch("/api/admin/technicians", {
      method: "POST",
      body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim() || undefined, type: "contractor", is_active: true })
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.message ?? "기사 등록에 실패했어요", "err");
      return;
    }
    setNewName("");
    setNewPhone("");
    toast("기사를 등록했어요 — 활성 기사 수에 따라 예약 슬롯 정원도 함께 늘어나요");
    load();
  }

  async function toggleTechnician(t: Technician) {
    setBusy(true);
    const res = await adminFetch("/api/admin/technicians", {
      method: "PATCH",
      body: JSON.stringify({ id: t.id, is_active: !(t.is_active !== false) })
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.message ?? "변경에 실패했어요", "err");
      return;
    }
    toast(t.is_active !== false ? `${t.name} 기사를 비활성화했어요` : `${t.name} 기사를 활성화했어요`);
    load();
  }

  async function saveSlotCap() {
    setBusy(true);
    const res = await adminFetch("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({ slot_cap: slotCap === "" ? 0 : Number(slotCap) })
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.message ?? "저장에 실패했어요", "err");
      return;
    }
    toast(
      slotCap === "" || Number(slotCap) === 0
        ? "슬롯 정원을 자동(활성 기사 수 기준)으로 바꿨어요 — 홈페이지 예약 달력에 바로 반영됩니다"
        : `시간대당 최대 ${slotCap}건으로 저장했어요 — 홈페이지 예약 달력에 바로 반영됩니다`
    );
    load();
  }

  return (
    <>
      <h1>설정</h1>
      <p className="h-sub">자주 바꾸는 것만 남겼어요. 결제·알림톡 키 같은 민감한 값은 Vercel 환경변수에서 관리합니다.</p>

      <div className="set-list">
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="p-head">
            <span className="p-t">기사 관리</span>
            <span className="p-link" role="presentation">
              활성 기사 수 = 홈페이지 예약 가능 건수 기준
            </span>
          </div>
          <p className="p-s">기사를 배정할 때 이 목록에서 선택해요. 비활성 기사는 배정 목록에서 빠집니다.</p>
          {loading ? (
            <div className="spin" />
          ) : (
            <>
              {technicians.map((t) => (
                <div
                  key={t.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}
                >
                  <span style={{ fontWeight: 650 }}>{t.name}</span>
                  <span style={{ color: "var(--ink-3)", fontSize: 12.5 }}>{t.phone ?? ""}</span>
                  <span className={`pill ${t.is_active !== false ? "p-booked" : "p-done"}`} style={{ marginLeft: "auto" }}>
                    {t.is_active !== false ? "활성" : "비활성"}
                  </span>
                  <button className="btn" disabled={busy} onClick={() => toggleTechnician(t)}>
                    {t.is_active !== false ? "비활성화" : "활성화"}
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="기사 이름"
                  style={{
                    flex: 1,
                    border: "1px solid var(--line)",
                    background: "var(--surface-2)",
                    color: "var(--ink)",
                    borderRadius: 8,
                    padding: "7px 11px",
                    font: "inherit",
                    fontSize: 13
                  }}
                />
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="연락처 (선택)"
                  style={{
                    flex: 1,
                    border: "1px solid var(--line)",
                    background: "var(--surface-2)",
                    color: "var(--ink)",
                    borderRadius: 8,
                    padding: "7px 11px",
                    font: "inherit",
                    fontSize: 13
                  }}
                />
                <button className="cta" disabled={busy} onClick={addTechnician}>
                  기사 추가
                </button>
              </div>
            </>
          )}
        </div>

        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="p-head">
            <span className="p-t">예약 슬롯 정원</span>
          </div>
          <p className="p-s">
            오전/오후 각각 받을 수 있는 최대 방문 건수예요. 비워두면(0) 활성 기사 수만큼 자동으로 잡혀요. 저장하면 홈페이지
            예약 달력에 즉시 반영됩니다.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              min={0}
              max={20}
              value={slotCap}
              onChange={(e) => setSlotCap(e.target.value)}
              placeholder="자동"
              style={{
                width: 110,
                border: "1px solid var(--line)",
                background: "var(--surface-2)",
                color: "var(--ink)",
                borderRadius: 8,
                padding: "7px 11px",
                font: "inherit",
                fontSize: 13
              }}
            />
            <span style={{ color: "var(--ink-3)", fontSize: 12.5 }}>건 / 시간대</span>
            <button className="cta" disabled={busy} onClick={saveSlotCap}>
              저장
            </button>
          </div>
        </div>

        <div className="set-row">
          <div>
            <div className="s-k">카카오 채널</div>
            <div className="s-d">{settings.kakao_channel_url || "환경변수 기본값 사용"}</div>
          </div>
          <a className="btn" href={settings.kakao_channel_url || "https://pf.kakao.com/_PxkzsX"} target="_blank" rel="noreferrer">
            열기 ↗
          </a>
        </div>
        <div className="set-row">
          <div>
            <div className="s-k">관리자 보안</div>
            <div className="s-d">비밀번호·허용 IP·자동 로그인은 Vercel 환경변수(ADMIN_*)에서 관리해요.</div>
          </div>
        </div>
      </div>
    </>
  );
}
