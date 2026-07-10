"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

/* ---------- 공용 fetch ---------- */
export async function adminFetch<T = any>(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; data?: T; message?: string }> {
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: init?.body ? { "Content-Type": "application/json", ...(init?.headers ?? {}) } : init?.headers,
      ...init
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.ok === false) {
      return { ok: false, message: json?.error?.message ?? `요청 실패 (${response.status})` };
    }
    return { ok: true, data: (json?.data ?? json) as T };
  } catch {
    return { ok: false, message: "네트워크 오류가 발생했어요." };
  }
}

/* ---------- 화면 간 메모리 캐시 (탭 이동 시 이전 데이터 즉시 표시 → 백그라운드 갱신) ---------- */
const memCache = new Map<string, unknown>();
export function getCache<T>(key: string): T | undefined {
  return memCache.get(key) as T | undefined;
}
export function setCache(key: string, value: unknown) {
  memCache.set(key, value);
}

/* ---------- 토스트 ---------- */
type ToastFn = (message: string, kind?: "info" | "err") => void;
const ToastContext = createContext<ToastFn>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ message: string; kind: "info" | "err"; on: boolean }>({
    message: "",
    kind: "info",
    on: false
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback<ToastFn>((message, kind = "info") => {
    setState({ message, kind, on: true });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState((s) => ({ ...s, on: false })), 3000);
  }, []);
  const value = useMemo(() => toast, [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={`toast ${state.kind === "err" ? "err" : ""} ${state.on ? "on" : ""}`} role="status">
        {state.message}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- 포맷 ---------- */
export const won = (n: number | null | undefined) =>
  `${Number(n || 0).toLocaleString("ko-KR")}원`;
export const wonN = (n: number | null | undefined) => Number(n || 0).toLocaleString("ko-KR");

export function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}분 경과`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 경과`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제 접수";
  return `${days}일 경과`;
}

export function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const SLOT_LABEL: Record<string, string> = { morning: "오전", afternoon: "오후" };

export function visitText(date?: string | null, slot?: string | null) {
  if (!date) return "미정";
  const d = new Date(`${date}T00:00:00`);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${dow})${slot ? ` ${SLOT_LABEL[slot] ?? slot}` : ""}`;
}
