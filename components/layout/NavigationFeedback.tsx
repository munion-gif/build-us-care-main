"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const ROUTE_LABELS: Array<[RegExp, string]> = [
  [/^\/services/, "서비스 목록을 불러오고 있어요."],
  [/^\/cases/, "시공 사례를 불러오고 있어요."],
  [/^\/request\/photo/, "사진확인 화면을 준비하고 있어요."],
  [/^\/orders\/lookup/, "주문조회 화면을 준비하고 있어요."],
  [/^\/orders\//, "주문 상태를 불러오고 있어요."],
  [/^\/quote\//, "견적 화면을 준비하고 있어요."],
  [/^\/$/, "홈으로 이동하고 있어요."]
];

function routeMessage(pathname: string) {
  return ROUTE_LABELS.find(([pattern]) => pattern.test(pathname))?.[1] ?? "페이지를 불러오고 있어요.";
}

function normalizedUrl(url: URL) {
  return `${url.origin}${url.pathname}${url.search}`;
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const timeoutRef = useRef<number | null>(null);
  const visible = message.length > 0;
  const currentRouteMessage = useMemo(() => routeMessage(pathname), [pathname]);

  useEffect(() => {
    setMessage("");
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    function clearLater() {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setMessage("");
        timeoutRef.current = null;
      }, 8000);
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target && target.target !== "_self") return;
      if (target.hasAttribute("download")) return;

      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (normalizedUrl(destination) === normalizedUrl(new URL(window.location.href)) && destination.hash) return;
      if (normalizedUrl(destination) === normalizedUrl(new URL(window.location.href))) return;

      setMessage(routeMessage(destination.pathname));
      clearLater();
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const method = (form.method || "get").toLowerCase();
      if (method !== "get") return;
      setMessage(currentRouteMessage);
      clearLater();
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [currentRouteMessage]);

  if (!visible) return null;

  return (
    <div className="navigation-feedback" role="status" aria-live="polite">
      <span className="navigation-feedback-spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
