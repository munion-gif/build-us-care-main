"use client";

import { useState } from "react";
import { JOB_PHOTO_GUIDES, jobPhotoGuide } from "@/lib/photo-guides";

const checklist = ["시공 전·후 사진 일치 확인", "자재 사용 영수증 확인", "누수/오작동 없음", "예상 시간 ±30분 이내", "현장 청결 유지"];
export function JobActions({ job, materials = [], isLate = false }: { job: any; materials?: any[]; isLate?: boolean }) {
  const [modal, setModal] = useState<"start" | "complete" | "inspect" | null>(null);
  const [loading, setLoading] = useState(false);
  const [lateRequested, setLateRequested] = useState(false);

  async function patch(path: string, body: any) {
    setLoading(true);
    const response = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setLoading(false);
    if (!response.ok) {
      alert("저장에 실패했어요. 입력값과 상태를 확인해주세요.");
      return;
    }
    window.location.reload();
  }

  async function uploadPhoto(type: string, file: File) {
    const guide = jobPhotoGuide(type);
    const signed = await fetch(`/api/admin/jobs/${job.id}/media/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, type })
    }).then((res) => res.json());
    const uploadUrl = signed?.data?.uploadUrl ?? signed?.uploadUrl;
    const filePath = signed?.data?.file_path ?? signed?.data?.filePath ?? signed?.file_path;
    if (!uploadUrl || !filePath) {
      alert("업로드 URL 발급에 실패했어요.");
      return;
    }
    await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    await fetch(`/api/admin/jobs/${job.id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, file_path: filePath, angle: guide.key, tags: [...guide.tags] })
    });
    window.location.reload();
  }

  async function requestLateCheck() {
    setLoading(true);
    const response = await fetch(`/api/admin/jobs/${job.id}/late-check`, { method: "POST" });
    setLoading(false);
    if (!response.ok) {
      alert("기사 재확인 요청에 실패했어요.");
      return;
    }
    setLateRequested(true);
  }

  return (
    <div className="adm-job-actions">
      <div className="adm-job-action-row">
        {isLate && (
          <button className="adm-btn adm-btn-secondary" disabled={loading || lateRequested} onClick={requestLateCheck}>
            {lateRequested ? "재확인 요청됨" : "기사 재확인"}
          </button>
        )}
        {job.status === "scheduled" && <button className="adm-btn adm-btn-primary" disabled={loading} onClick={() => setModal("start")}>시작</button>}
        {job.status === "in_progress" && <button className="adm-btn adm-btn-primary" disabled={loading} onClick={() => setModal("complete")}>완료</button>}
        {job.status === "done" && <button className="adm-btn adm-btn-primary" disabled={loading} onClick={() => setModal("inspect")}>검수</button>}
      </div>
      <div className="adm-job-photo-actions">
        {JOB_PHOTO_GUIDES.map((guide) => (
          <label key={guide.key} className="adm-btn adm-btn-secondary adm-btn-sm" title={guide.guide}>
            {guide.shortLabel}
            <input type="file" accept="image/*" hidden onChange={(event) => event.target.files?.[0] && uploadPhoto(guide.key, event.target.files[0])} />
          </label>
        ))}
      </div>
      {modal === "start" && (
        <StartModal
          expected={job.expected_minutes ?? 0}
          onClose={() => setModal(null)}
          onSave={(body) => patch(`/api/admin/jobs/${job.id}/start`, body)}
        />
      )}
      {modal === "complete" && (
        <CompleteModal
          materials={materials}
          onClose={() => setModal(null)}
          onSave={(body) => patch(`/api/admin/jobs/${job.id}/complete`, body)}
        />
      )}
      {modal === "inspect" && (
        <InspectModal
          onClose={() => setModal(null)}
          onSave={(body) => patch(`/api/admin/jobs/${job.id}/inspect`, body)}
        />
      )}
    </div>
  );
}

function StartModal({ expected, onClose, onSave }: { expected: number; onClose: () => void; onSave: (body: any) => void }) {
  const [minutes, setMinutes] = useState(expected || 60);
  return (
    <div className="adm-modal-overlay">
      <div className="adm-modal">
        <div className="adm-modal-header"><h2 className="adm-modal-title">시공 시작 확인</h2></div>
        <div className="adm-modal-body">
          <label className="adm-label">예상 시공 시간(분)</label>
          <input className="adm-input" type="number" min={0} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </div>
        <div className="adm-modal-footer">
          <button className="adm-btn adm-btn-secondary" onClick={onClose}>취소</button>
          <button className="adm-btn adm-btn-primary" onClick={() => onSave({ expected_minutes: minutes })}>시작</button>
        </div>
      </div>
    </div>
  );
}

function CompleteModal({ materials, onClose, onSave }: { materials: any[]; onClose: () => void; onSave: (body: any) => void }) {
  const [actual, setActual] = useState(60);
  const [used, setUsed] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [notes, setNotes] = useState("");
  const [issues, setIssues] = useState("");
  const selectedMaterials = materials.filter((item) => used.includes(item.sku)).map((item) => ({ sku: item.sku, qty: 1 }));
  return (
    <div className="adm-modal-overlay">
      <div className="adm-modal">
        <div className="adm-modal-header"><h2 className="adm-modal-title">시공 완료 입력</h2></div>
        <div className="adm-modal-body adm-stack">
          <label><span className="adm-label">실제 시공 시간(분)</span><input className="adm-input" type="number" min={0} value={actual} onChange={(e) => setActual(Number(e.target.value))} /></label>
          <div>
            <div className="adm-label">사용 자재</div>
            {materials.slice(0, 8).map((item) => (
              <label key={item.sku} style={{ display: "block", marginBottom: 6 }}>
                <input type="checkbox" checked={used.includes(item.sku)} onChange={(e) => setUsed((prev) => e.target.checked ? [...prev, item.sku] : prev.filter((sku) => sku !== item.sku))} /> {item.name} ({item.sku})
              </label>
            ))}
          </div>
          <label><span className="adm-label">추가 발생 자재</span><input className="adm-input" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="SKU 또는 자재명" /></label>
          <label><span className="adm-label">시공 메모</span><textarea className="adm-input" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <label><span className="adm-label">시공 중 이슈</span><textarea className="adm-input" value={issues} onChange={(e) => setIssues(e.target.value)} /></label>
        </div>
        <div className="adm-modal-footer">
          <button className="adm-btn adm-btn-secondary" onClick={onClose}>취소</button>
          <button className="adm-btn adm-btn-primary" onClick={() => onSave({ actual_minutes: actual, materials_used: selectedMaterials, extra_materials: extra ? [{ sku: extra, reason: "현장 추가" }] : [], completion_notes: notes, issues })}>완료 저장</button>
        </div>
      </div>
    </div>
  );
}

function InspectModal({ onClose, onSave }: { onClose: () => void; onSave: (body: any) => void }) {
  const [passed, setPassed] = useState(true);
  const [checks, setChecks] = useState(checklist.map((item) => ({ item, ok: true })));
  const [note, setNote] = useState("");
  return (
    <div className="adm-modal-overlay">
      <div className="adm-modal">
        <div className="adm-modal-header"><h2 className="adm-modal-title">검수 체크리스트</h2></div>
        <div className="adm-modal-body adm-stack">
          {checks.map((check, index) => (
            <label key={check.item}>
              <input type="checkbox" checked={check.ok} onChange={(e) => setChecks((prev) => prev.map((item, i) => i === index ? { ...item, ok: e.target.checked } : item))} /> {check.item}
            </label>
          ))}
          <div style={{ display: "flex", gap: 12 }}>
            <label><input type="radio" checked={passed} onChange={() => setPassed(true)} /> 통과</label>
            <label><input type="radio" checked={!passed} onChange={() => setPassed(false)} /> 불합격</label>
          </div>
          <label><span className="adm-label">불합격 메모</span><textarea className="adm-input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </div>
        <div className="adm-modal-footer">
          <button className="adm-btn adm-btn-secondary" onClick={onClose}>취소</button>
          <button className="adm-btn adm-btn-primary" onClick={() => onSave({ passed, checklist_results: checks, inspector_note: note })}>검수 저장</button>
        </div>
      </div>
    </div>
  );
}
