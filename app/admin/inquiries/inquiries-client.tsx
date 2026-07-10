"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { IntakeItem } from "@/lib/admin-intake-data";
import { adminFetch, timeAgo, useToast } from "../_lib/ui";

const TABS = [
  { key: "wait", label: "답장 대기" },
  { key: "progress", label: "상담·견적 진행" },
  { key: "closed", label: "종료" },
  { key: "all", label: "전체" }
] as const;

function tabOf(item: IntakeItem): "wait" | "progress" | "closed" {
  if (item.status.tone === "new") return "wait";
  if (item.status.tone === "done") return "closed";
  return "progress";
}

function pillClass(tone: IntakeItem["status"]["tone"]) {
  if (tone === "new") return "p-new";
  if (tone === "done") return "p-done";
  if (tone === "sent") return "p-pay";
  return "p-assign";
}

function hoursSince(iso: string | null) {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

export default function InquiriesClient({ items }: { items: IntakeItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<string>("wait");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function deleteInquiry(it: IntakeItem) {
    if (!window.confirm(`${it.name ?? "고객"}님의 문의를 삭제할까요?\n삭제하면 되돌릴 수 없어요.`)) return;
    setBusyId(it.id);
    const res = await adminFetch(`/api/admin/diagnoses/${it.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      toast(
        res.message?.includes("주문") || res.message?.includes("order")
          ? "이 문의는 이미 주문으로 이어져 있어요 — 예약 주문에서 해당 주문을 삭제하면 일정까지 함께 정리됩니다."
          : (res.message ?? "삭제에 실패했어요"),
        "err"
      );
      return;
    }
    toast("문의를 삭제했어요");
    router.refresh();
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { wait: 0, progress: 0, closed: 0, all: items.length };
    for (const it of items) c[tabOf(it)] += 1;
    return c;
  }, [items]);

  const visible = items.filter((it) => tab === "all" || tabOf(it) === tab);

  return (
    <>
      <h1>사진확인 문의</h1>
      <p className="h-sub">
        사진 3장으로 들어온 문의입니다. 카드를 누르면 상세에서 상담하고 견적서를 보낼 수 있어요. 고객이 결제하면{" "}
        <b>예약 주문</b>으로 자동 전환돼요.
      </p>

      <div className="tabs" role="tablist" aria-label="문의 상태 필터">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "on" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label} <span className="n">{counts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="cards-board">
        {visible.length === 0 ? (
          <p className="loading-note">해당하는 문의가 없어요.</p>
        ) : (
          <div className="cards">
            {visible.map((it) => {
              const old = tabOf(it) === "wait" && hoursSince(it.createdAt) >= 2;
              return (
                <div
                  key={it.id}
                  className="card clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/admin/inquiries/${it.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/admin/inquiries/${it.id}`);
                  }}
                >
                  <div className="c-top">
                    <span className="c-who">
                      {it.name ?? "고객"} <span>{it.phone ?? ""}</span>
                    </span>
                    <span className={`pill ${pillClass(it.status.tone)}`}>{it.status.text}</span>
                  </div>
                  <div className="c-what">
                    {it.item} · {it.memo ?? "요청 메모 없음"} — {it.address}
                  </div>
                  <div className="c-foot">
                    <button
                      className="cta"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/inquiries/${it.id}`);
                      }}
                    >
                      견적 보내기
                    </button>
                    <button
                      className="btn danger"
                      disabled={busyId === it.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteInquiry(it);
                      }}
                    >
                      {busyId === it.id ? "삭제 중…" : "삭제"}
                    </button>
                    <span className="next-hint">사진 {it.photoCount}장</span>
                    <span className={`age ${old ? "hot" : ""}`}>{timeAgo(it.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
