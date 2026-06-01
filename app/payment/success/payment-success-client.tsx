"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

type ConfirmState =
  | { status: "loading"; message: string }
  | { status: "success"; productAmount: number; serviceFeeAmount: number; totalAmount: number; statusUrl: string | null }
  | { status: "error"; message: string; retryUrl: string };

export function PaymentSuccessClient() {
  const searchParams = useSearchParams();
  const calledRef = useRef(false);
  const [state, setState] = useState<ConfirmState>({
    status: "loading",
    message: "결제 승인 정보를 확인하고 있어요."
  });

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    async function confirmPayment() {
      const paymentKey = searchParams.get("paymentKey") ?? "";
      const orderId = searchParams.get("orderId") ?? "";
      const amount = Number(searchParams.get("amount") ?? 0);
      const serviceCode = searchParams.get("serviceCode") ?? "";
      const accessToken = searchParams.get("accessToken") ?? "";
      const retryUrl = serviceCode ? `/quote/${encodeURIComponent(serviceCode)}` : "/";

      if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
        setState({ status: "error", message: "결제 승인 정보가 부족합니다. 다시 결제해 주세요.", retryUrl });
        return;
      }

      try {
        const response = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentKey, orderId, ...(accessToken ? { accessToken } : {}), amount })
        });
        const json = await response.json().catch(() => null);

        if (!response.ok || !json?.ok) {
          throw new Error(json?.error?.message ?? "결제 승인에 실패했습니다.");
        }

        const data = json.data;
        const internalOrderId = data?.order?.id;
        setState({
          status: "success",
          productAmount: Number(data?.productAmount ?? data?.amount ?? amount),
          serviceFeeAmount: Number(data?.serviceFeeAmount ?? data?.onsitePaymentAmount ?? 0),
          totalAmount: Number(data?.totalAmount ?? amount),
          statusUrl: internalOrderId && accessToken ? `/orders/${internalOrderId}?accessToken=${encodeURIComponent(accessToken)}` : null
        });
      } catch (error) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "결제 승인에 실패했습니다.",
          retryUrl
        });
      }
    }

    void confirmPayment();
  }, [searchParams]);

  return (
    <main className="payment-result-page">
      <section className="payment-result-card">
        <p>build us care</p>
        {state.status === "loading" && (
          <>
            <h1>결제 승인 중입니다</h1>
            <span>{state.message}</span>
          </>
        )}
        {state.status === "success" && (
          <>
            <h1>제품값 결제가 완료되었습니다.</h1>
            <strong>{won(state.productAmount)}</strong>
            <span>시공비 {won(state.serviceFeeAmount)}은 설치 완료 후 현장에서 결제해 주세요.</span>
            <small>예상 총액 {won(state.totalAmount)}</small>
            <p>주문정보를 확인한 뒤 카톡으로 안내드릴게요.</p>
            {state.statusUrl ? (
              <Link className="payment-result-action" href={state.statusUrl}>주문정보 보기</Link>
            ) : (
              <Link className="payment-result-action" href="/">홈으로 이동</Link>
            )}
          </>
        )}
        {state.status === "error" && (
          <>
            <h1>결제 확인이 필요합니다</h1>
            <span>{state.message}</span>
            <Link className="payment-result-action" href={state.retryUrl}>다시 결제하기</Link>
          </>
        )}
      </section>
      <style jsx>{`
        .payment-result-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: var(--color-bg);
          color: var(--color-text);
          padding: 24px;
        }
        .payment-result-card {
          width: min(560px, 100%);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          background: var(--color-surface);
          padding: 28px;
          display: grid;
          gap: 14px;
          box-shadow: 0 18px 50px rgba(34, 33, 29, 0.08);
        }
        p {
          margin: 0;
          color: var(--color-muted);
          font-weight: 700;
          letter-spacing: 0.32em;
          text-transform: lowercase;
        }
        h1 {
          margin: 0;
          font-size: var(--text-h1);
          line-height: var(--leading-h1);
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        strong {
          font-size: var(--text-price-main);
          line-height: var(--leading-price-main);
          font-weight: 700;
          letter-spacing: -0.015em;
          font-variant-numeric: tabular-nums;
        }
        span,
        small {
          color: var(--color-muted);
          font-weight: 700;
          line-height: 1.55;
          font-size: 18px;
        }
        :global(.payment-result-action) {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          min-height: 54px;
          border-radius: 8px;
          background: var(--color-charcoal, #211f1b);
          color: var(--color-cream, #fffaf1);
          font-weight: 700;
          text-decoration: none;
          margin-top: 8px;
        }
      `}</style>
    </main>
  );
}
