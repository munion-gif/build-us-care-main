"use client";

import { useCallback } from "react";
import { track as trackEvent } from "@/lib/tracking";

export function useTracking() {
  const track = useCallback(
    (eventType: string, properties?: Record<string, unknown>, context?: { orderId?: string; customerId?: string }) =>
      trackEvent(eventType, properties, context),
    []
  );

  return { track };
}
