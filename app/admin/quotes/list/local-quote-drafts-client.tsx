"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatKRDateTime, formatKRW } from "@/lib/format";

type LocalQuoteDraft = {
  id?: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  addressText?: string;
  summary?: string;
  items?: Array<{
    service_type_code?: string;
    product_id?: string;
    qty?: number;
  }>;
  visitFee?: number;
  discount?: number;
  scheduleDate?: string;
  scheduleTime?: "morning" | "afternoon" | "";
  productTotal?: number;
  laborTotal?: number;
  finalTotal?: number;
  createdAt?: string;
};

const STORAGE_KEY = "builduscare:adminQuoteDrafts";

export function LocalQuoteDraftsClient() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<LocalQuoteDraft[]>([]);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      setDrafts(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDrafts([]);
    }
  }, []);

  function clearDrafts() {
    window.localStorage.removeItem(STORAGE_KEY);
    setDrafts([]);
  }

  function removeDraft(draft: LocalQuoteDraft) {
    if (!draft.id) return;
    if (!window.confirm(`${draft.orderNumber || "임시 견적서"}를 목록에서 삭제할까요?`)) return;

    setDrafts((current) => {
      const next = current.filter((item) => item.id !== draft.id);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setMessage("임시 견적을 삭제했습니다.");
  }

  async function convertDraftToOrder(draft: LocalQuoteDraft) {
    if (!draft.id) return;
    setConvertingId(draft.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/local-manual-quotes/convert-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "제품 주문 전환에 실패했습니다.");
      }

      const orderId = payload?.data?.orderId;
      setDrafts((current) => {
        const next = current.filter((item) => item.id !== draft.id);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setMessage("로컬 제품 주문으로 전환했습니다.");
      router.refresh();
      if (orderId) {
        window.setTimeout(() => router.push(`/admin/orders/${orderId}`), 500);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "제품 주문 전환에 실패했습니다.");
    } finally {
      setConvertingId(null);
    }
  }

  if (drafts.length === 0) return null;

  return (
    <section className="adm-card adm-quote-list-section">
      <div className="adm-section-head">
        <div>
          <h2 className="adm-card-title">로컬 임시 견적</h2>
          <p className="adm-muted">주문 없이 작성한 견적입니다. 이 목록은 현재 브라우저에만 저장됩니다.</p>
        </div>
        <button className="adm-btn adm-btn-secondary adm-btn-sm" type="button" onClick={clearDrafts}>
          임시 목록 비우기
        </button>
      </div>
      {message ? <p className="adm-form-message">{message}</p> : null}
      <div className="adm-order-queue-list">
        {drafts.map((draft, index) => (
          <article className="adm-order-queue-card" key={draft.id ?? `local-draft-${index}`}>
            <div className="adm-order-queue-main">
              <div className="adm-order-queue-title">
                <strong>{draft.orderNumber || "임시 견적서"}</strong>
                <span className="adm-badge adm-badge-blue">로컬 저장</span>
              </div>
              <strong>{draft.summary || `수동 견적 ${draft.items?.length ?? 0}개 항목`}</strong>
              <p>{draft.customerName || "-"} · {draft.customerPhone || "-"}</p>
              <p>{draft.addressText || "주소 확인 중"}</p>
            </div>
            <div className="adm-order-queue-meta">
              <span>
                <b>제품값</b>
                <strong>{formatKRW(Number(draft.productTotal ?? 0))}</strong>
                <small>임시 저장 기준</small>
              </span>
              <span>
                <b>시공비</b>
                <strong>{formatKRW(Number(draft.laborTotal ?? 0))}</strong>
                <small>임시 저장 기준</small>
              </span>
              <span>
                <b>저장 시각</b>
                <strong>{formatKRDateTime(draft.createdAt)}</strong>
                <small>{formatKRW(Number(draft.finalTotal ?? 0))}</small>
              </span>
            </div>
            <div className="adm-order-queue-actions">
              {draft.id ? (
                <Link className="adm-btn adm-btn-primary" href={`/admin/quotes?draftId=${encodeURIComponent(draft.id)}`}>
                  수정
                </Link>
              ) : null}
              <Link className="adm-btn adm-btn-secondary" href="/admin/quotes">
                새 견적 작성
              </Link>
              {draft.id ? (
                <button className="adm-btn adm-btn-secondary" type="button" onClick={() => convertDraftToOrder(draft)} disabled={convertingId === draft.id}>
                  {convertingId === draft.id ? "전환 중..." : "제품 주문으로 전환"}
                </button>
              ) : null}
              {draft.id ? (
                <button className="adm-btn adm-btn-danger" type="button" onClick={() => removeDraft(draft)} disabled={convertingId === draft.id}>
                  삭제
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
