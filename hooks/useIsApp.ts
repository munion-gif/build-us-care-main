"use client";

import { useEffect, useState } from "react";

export function useIsApp(): boolean {
  const [isApp, setIsApp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const webview = /wv|WebView/i.test(navigator.userAgent);
    setIsApp(standalone || iosStandalone || webview);
  }, []);

  return isApp;
}
