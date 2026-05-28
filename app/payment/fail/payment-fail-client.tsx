"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function PaymentFailClient() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || searchParams.get("code") || "결제가 취소되었거나 실패했습니다.";
  const serviceCode = searchParams.get("serviceCode") ?? "";
  const retryUrl = serviceCode ? `/quote/${encodeURIComponent(serviceCode)}` : "/";

  return (
    <main className="payment-result-page">
      <section className="payment-result-card">
        <p>build us care</p>
        <h1>결제를 완료하지 못했습니다</h1>
        <span>{message}</span>
        <Link href={retryUrl}>다시 결제하기</Link>
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
          gap: 16px;
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
        span {
          color: var(--color-muted);
          font-weight: 700;
          line-height: 1.55;
          font-size: 18px;
        }
        a {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          min-height: 54px;
          border-radius: 8px;
          background: var(--color-charcoal);
          color: var(--color-cream);
          font-weight: 700;
          text-decoration: none;
          margin-top: 8px;
        }
      `}</style>
    </main>
  );
}
