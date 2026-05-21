"use client";

import { useEffect, useMemo, useState } from "react";
import { formatServiceName } from "@/lib/format";

const MATERIALS_BY_SERVICE: Record<string, { sku: string; name: string }[]> = {
  toilet_replace: [
    { sku: "toilet_body", name: "양변기 본체" },
    { sku: "angle_valve", name: "앵글밸브" },
    { sku: "bidet_hose", name: "비데호스" }
  ],
  faucet_replace: [
    { sku: "faucet_body", name: "수전 본체" },
    { sku: "angle_valve", name: "앵글밸브" },
    { sku: "hose", name: "연결 호스" }
  ],
  light_replace: [{ sku: "light_body", name: "등기구" }],
  outlet_replace: [{ sku: "outlet_body", name: "콘센트" }]
};

export function TechnicianCompleteClient({ jobId }: { jobId: string }) {
  const [serviceCode, setServiceCode] = useState("");
  const [actualMinutes, setActualMinutes] = useState(90);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [completionNotes, setCompletionNotes] = useState("");
  const [issues, setIssues] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/technician/jobs/${jobId}`);
      const payload = await response.json();
      setServiceCode(payload.data?.job?.service_code ?? "");
    }
    load();
  }, [jobId]);

  const materials = useMemo(() => MATERIALS_BY_SERVICE[serviceCode] ?? [{ sku: serviceCode || "service_material", name: `${formatServiceName(serviceCode)} 자재` }], [serviceCode]);

  async function submit() {
    setLoading(true);
    const materialsUsed = Object.entries(selected)
      .filter(([, qty]) => qty > 0)
      .map(([sku, qty]) => ({ sku, qty }));
    const response = await fetch(`/api/technician/jobs/${jobId}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actual_minutes: actualMinutes,
        materials_used: materialsUsed,
        completion_notes: completionNotes || undefined,
        issues: issues || undefined
      })
    });
    setLoading(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      alert(payload?.message ?? "완료 보고에 실패했어요.");
      return;
    }
    window.location.href = "/technician";
  }

  return (
    <main className="tech-container">
      <header className="tech-header">
        <div>
          <span className="tech-kicker">Complete</span>
          <h1 className="tech-title">완료 보고</h1>
          <p className="tech-sub">소요시간과 사용 자재만 빠르게 남겨주세요.</p>
        </div>
      </header>
      <section className="tech-card tech-stack">
        <label className="tech-label">
          실제 소요시간
          <input className="tech-input" type="number" min={1} value={actualMinutes} onChange={(event) => setActualMinutes(Number(event.target.value))} />
        </label>
        <div className="tech-stack">
          <strong>사용 자재</strong>
          {materials.map((material) => (
            <label className="tech-row" key={material.sku}>
              <span>{material.name}</span>
              <input
                className="tech-input"
                style={{ width: 88 }}
                type="number"
                min={0}
                value={selected[material.sku] ?? 0}
                onChange={(event) => setSelected((prev) => ({ ...prev, [material.sku]: Number(event.target.value) }))}
              />
            </label>
          ))}
        </div>
        <label className="tech-label">
          이슈 메모
          <textarea className="tech-textarea" value={issues} onChange={(event) => setIssues(event.target.value)} placeholder="선택 입력" />
        </label>
        <label className="tech-label">
          완료 메모
          <textarea className="tech-textarea" value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} placeholder="선택 입력" />
        </label>
        <button className="tech-button" type="button" onClick={submit} disabled={loading || actualMinutes <= 0}>
          {loading ? "저장 중" : "완료 보고"}
        </button>
      </section>
    </main>
  );
}
