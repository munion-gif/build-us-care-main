"use client";

import { useMemo, useState } from "react";
import type { FAQItem } from "@/lib/faqs";

type FAQDraft = {
  id?: string;
  question: string;
  answer: string;
  category: string;
  display_order: number;
  is_active: boolean;
};

const emptyDraft: FAQDraft = {
  question: "",
  answer: "",
  category: "general",
  display_order: 0,
  is_active: true
};

function toDraft(faq?: FAQItem | null): FAQDraft {
  if (!faq) return emptyDraft;
  return {
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    category: faq.category ?? "general",
    display_order: faq.display_order ?? 0,
    is_active: faq.is_active !== false
  };
}

export function FAQManager({ initialFaqs }: { initialFaqs: FAQItem[] }) {
  const [faqs, setFaqs] = useState(initialFaqs);
  const [draft, setDraft] = useState<FAQDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const sortedFaqs = useMemo(() => [...faqs].sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0)), [faqs]);

  function updateDraft(patch: Partial<FAQDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function reload() {
    const response = await fetch("/api/admin/faqs", { cache: "no-store" });
    const json = await response.json();
    if (response.ok) setFaqs(json.data?.faqs ?? []);
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(draft.id ? `/api/admin/faqs/${draft.id}` : "/api/admin/faqs", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: draft.question,
          answer: draft.answer,
          category: draft.category,
          display_order: draft.display_order,
          is_active: draft.is_active
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "FAQ를 저장하지 못했어요.");
      setDraft(emptyDraft);
      setMessage("FAQ를 저장했습니다.");
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "FAQ를 다시 저장해주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("이 FAQ를 삭제할까요?")) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/faqs/${id}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "FAQ를 삭제하지 못했어요.");
      setMessage("FAQ를 삭제했습니다.");
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "FAQ 삭제를 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function move(faq: FAQItem, delta: number) {
    const nextOrder = Math.max(0, Number(faq.display_order ?? 0) + delta);
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/faqs/${faq.id}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_order: nextOrder })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message ?? "순서를 변경하지 못했어요.");
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "순서 변경을 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="adm-card adm-stack">
      <div>
        <h2 className="adm-card-title">FAQ 관리</h2>
        <p className="adm-muted">홈 하단에 노출되는 자주 묻는 질문을 관리합니다.</p>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>순서</th><th>질문</th><th>상태</th><th>관리</th></tr>
          </thead>
          <tbody>
            {sortedFaqs.map((faq) => (
              <tr key={faq.id}>
                <td>{faq.display_order ?? 0}</td>
                <td>
                  <strong>{faq.question}</strong>
                  <p className="adm-muted" style={{ margin: "4px 0 0" }}>{faq.answer}</p>
                </td>
                <td><span className={`adm-badge ${faq.is_active === false ? "adm-badge-gray" : "adm-badge-green"}`}>{faq.is_active === false ? "숨김" : "노출"}</span></td>
                <td>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => setDraft(toDraft(faq))}>수정</button>
                    <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => move(faq, -1)} disabled={saving}>↑</button>
                    <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={() => move(faq, 1)} disabled={saving}>↓</button>
                    <button className="adm-btn adm-btn-danger adm-btn-sm" type="button" onClick={() => remove(faq.id)} disabled={saving}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="adm-card" style={{ padding: 16 }}>
        <h3 className="adm-section-title">{draft.id ? "FAQ 수정" : "새 FAQ 추가"}</h3>
        <div className="adm-form-row adm-form-row-2">
          <label>
            <span className="adm-label">질문</span>
            <input className="adm-input" value={draft.question} onChange={(event) => updateDraft({ question: event.target.value })} />
          </label>
          <label>
            <span className="adm-label">카테고리</span>
            <input className="adm-input" value={draft.category} onChange={(event) => updateDraft({ category: event.target.value })} />
          </label>
        </div>
        <div className="adm-form-row">
          <label>
            <span className="adm-label">답변</span>
            <textarea className="adm-input" rows={4} value={draft.answer} onChange={(event) => updateDraft({ answer: event.target.value })} />
          </label>
        </div>
        <div className="adm-form-row adm-form-row-2">
          <label>
            <span className="adm-label">표시 순서</span>
            <input className="adm-input" type="number" min={0} value={draft.display_order} onChange={(event) => updateDraft({ display_order: Number(event.target.value) })} />
          </label>
          <label className="adm-inline-check" style={{ alignSelf: "end" }}>
            <input type="checkbox" checked={draft.is_active} onChange={(event) => updateDraft({ is_active: event.target.checked })} />
            홈에 노출
          </label>
        </div>
        {message && <p className="adm-form-message">{message}</p>}
        <div className="adm-modal-footer" style={{ padding: 0 }}>
          {draft.id && <button className="adm-btn adm-btn-secondary" type="button" onClick={() => setDraft(emptyDraft)}>새 FAQ로 전환</button>}
          <button className="adm-btn adm-btn-primary" type="button" onClick={save} disabled={saving || !draft.question.trim() || !draft.answer.trim()}>
            {saving ? "저장 중..." : draft.id ? "수정 저장" : "FAQ 추가"}
          </button>
        </div>
      </div>
    </section>
  );
}
