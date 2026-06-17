"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const ROUTE_LABELS: Array<[RegExp, string]> = [
  [/^\/products(?:\/|$)/, "제품을 불러오고 있어요."],
  [/^\/photo-check(?:\/|$)/, "사진 확인 화면을 불러오고 있어요."],
  [/^\/reservation(?:\/|$)/, "예약 화면을 불러오고 있어요."],
  [/^\/order-lookup(?:\/|$)/, "주문 조회 화면을 불러오고 있어요."],
  [/^\/orders\//, "주문 상태를 불러오고 있어요."],
  [/^\/payment\/transfer/, "계좌이체 안내를 불러오고 있어요."],
  [/^\/$/, "홈으로 이동하고 있어요."]
];

const FEEDBACK_DELAY_MS = 1600;

function routeMessage(pathname: string) {
  return ROUTE_LABELS.find(([pattern]) => pattern.test(pathname))?.[1] ?? "페이지를 불러오고 있어요.";
}

function normalizedUrl(url: URL) {
  return `${url.origin}${url.pathname}${url.search}`;
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const showTimeoutRef = useRef<number | null>(null);
  const clearTimeoutRef = useRef<number | null>(null);
  const visible = message.length > 0;
  const currentRouteMessage = useMemo(() => routeMessage(pathname), [pathname]);

  useEffect(() => {
    setMessage("");
    if (showTimeoutRef.current) {
      window.clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (clearTimeoutRef.current) {
      window.clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    function clearAllTimers() {
      if (showTimeoutRef.current) {
        window.clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = null;
      }
      if (clearTimeoutRef.current) {
        window.clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }
    }

    function showIfStillWaiting(nextMessage: string) {
      clearAllTimers();
      showTimeoutRef.current = window.setTimeout(() => {
        setMessage(nextMessage);
        showTimeoutRef.current = null;
        clearTimeoutRef.current = window.setTimeout(() => {
          setMessage("");
          clearTimeoutRef.current = null;
        }, 8000);
      }, FEEDBACK_DELAY_MS);
    }

    function clearNow() {
      clearAllTimers();
      setMessage("");
    }

    function clearOnPageReady() {
      window.requestAnimationFrame(() => {
        setMessage("");
      });
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

      showIfStillWaiting(routeMessage(destination.pathname));
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const method = (form.method || "get").toLowerCase();
      if (method !== "get") return;
      showIfStillWaiting(currentRouteMessage);
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("pageshow", clearNow);
    window.addEventListener("popstate", clearOnPageReady);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("pageshow", clearNow);
      window.removeEventListener("popstate", clearOnPageReady);
      clearAllTimers();
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
