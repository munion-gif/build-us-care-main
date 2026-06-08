"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { buildQuoteDocumentInputFromOrderStatus, downloadQuoteDocument } from "@/lib/quote-document";

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function numberParam(value: string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function TransferPaymentClient() {
  const searchParams = useSearchParams();
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState("");
  const orderId = searchParams.get("orderId") ?? "";
  const accessToken = searchParams.get("accessToken") ?? "";
  const amount = numberParam(searchParams.get("amount"));
  const productAmount = numberParam(searchParams.get("productAmount")) || amount;
  const serviceFeeAmount = numberParam(searchParams.get("serviceFeeAmount"));
  const onsiteAmount = numberParam(searchParams.get("onsiteAmount"));
  const totalAmount = numberParam(searchParams.get("totalAmount")) || productAmount + serviceFeeAmount;
  const bankName = process.env.NEXT_PUBLIC_BANK_TRANSFER_BANK ?? "농협";
  const bankAccount = process.env.NEXT_PUBLIC_BANK_TRANSFER_ACCOUNT ?? "355-0094-9209-33";
  const accountHolder = process.env.NEXT_PUBLIC_BANK_TRANSFER_HOLDER ?? "주식회사 무니온";
  const hasBankAccount = Boolean(bankName && bankAccount && accountHolder);
  const statusUrl = orderId && accessToken ? `/orders/${orderId}?accessToken=${encodeURIComponent(accessToken)}` : null;

  async function handleQuoteDownload() {
    if (!orderId || !accessToken) {
      setDownloadMessage("주문 링크를 확인한 뒤 다시 시도해 주세요.");
      return;
    }

    setDownloadLoading(true);
    setDownloadMessage("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status?accessToken=${encodeURIComponent(accessToken)}`);
      const result = await response.json().catch(() => null);
      const order = result?.data?.order;
      if (!response.ok || !order) {
        throw new Error(result?.error?.message ?? result?.message ?? "견적 정보를 불러오지 못했어요.");
      }

      await downloadQuoteDocument(
        buildQuoteDocumentInputFromOrderStatus(order, {
          fallbackTransferAmount: amount,
          fallbackOnsiteAmount: onsiteAmount,
          fallbackTotalAmount: totalAmount
        })
      );
    } catch (error) {
      setDownloadMessage(error instanceof Error ? error.message : "견적서 다운로드에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setDownloadLoading(false);
    }
  }

  return (
    <main className="transfer-page">
      <section className="transfer-card">
        <p className="brand-kicker">build us care</p>
        <h1>계좌이체 안내</h1>
        <span>최종 견적이 저장되었습니다. 금액을 확인한 뒤 입금 안내에 따라 진행해 주세요.</span>

        <div className="transfer-amount">
          <small>계좌이체 금액</small>
          <strong>{won(amount)}</strong>
        </div>

        <dl className="transfer-breakdown">
          <div>
            <dt>제품 가격</dt>
            <dd>{won(productAmount)}</dd>
          </div>
          <div>
            <dt>시공비</dt>
            <dd>{won(serviceFeeAmount)}</dd>
          </div>
          <div>
            <dt>예상 총액</dt>
            <dd>{won(totalAmount)}</dd>
          </div>
          {onsiteAmount > 0 && (
            <div>
              <dt>현장 결제 예정</dt>
              <dd>{won(onsiteAmount)}</dd>
            </div>
          )}
        </dl>

        <div className="transfer-bank">
          <small>입금 계좌</small>
          {hasBankAccount ? (
            <>
              <strong>{bankName} {bankAccount}</strong>
              <span>예금주 {accountHolder}</span>
            </>
          ) : (
            <>
              <strong>카톡으로 계좌 안내 예정</strong>
              <span>주문 확인 후 담당자가 입금 계좌와 진행 방법을 안내드립니다.</span>
            </>
          )}
        </div>

        <div className="transfer-actions">
          <button className="transfer-action-button secondary" type="button" onClick={handleQuoteDownload} disabled={downloadLoading || !statusUrl}>
            {downloadLoading ? "견적서 준비 중..." : "견적서 다운로드"}
          </button>
          {statusUrl ? (
            <Link className="transfer-action-button" href={statusUrl}>주문정보 보기</Link>
          ) : (
            <Link className="transfer-action-button" href="/">홈으로 이동</Link>
          )}
        </div>
        {downloadMessage && <p className="transfer-inline-message">{downloadMessage}</p>}
      </section>
      <style jsx>{`
        .transfer-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: var(--color-bg);
          color: var(--color-text);
          padding: 24px;
        }
        .transfer-card {
          width: min(620px, 100%);
          display: grid;
          gap: 16px;
          border: 1px solid var(--color-border);
          border-radius: 10px;
          background: var(--color-surface);
          padding: 28px;
          box-shadow: 0 18px 50px rgba(34, 33, 29, 0.08);
        }
        .transfer-card h1 {
          margin: 0;
          color: var(--color-text);
          font-size: var(--text-h1);
          line-height: var(--leading-h1);
          letter-spacing: 0;
        }
        .transfer-card > span,
        .transfer-bank span {
          color: var(--color-text-muted);
          font-size: var(--text-body-sm);
          line-height: var(--leading-body-sm);
          font-weight: 700;
        }
        .transfer-amount,
        .transfer-bank {
          display: grid;
          gap: 8px;
          border: 1px solid rgba(199, 146, 42, 0.5);
          border-radius: 8px;
          background: var(--color-primary-highlight);
          padding: 16px;
        }
        .transfer-amount small,
        .transfer-bank small,
        .transfer-breakdown dt {
          color: var(--color-text-muted);
          font-size: var(--text-xs);
          font-weight: 800;
        }
        .transfer-amount strong {
          color: var(--color-text);
          font-size: var(--text-price-main);
          line-height: var(--leading-price-main);
          font-variant-numeric: tabular-nums;
        }
        .transfer-bank strong {
          color: var(--color-text);
          font-size: var(--text-lg);
          line-height: 1.35;
        }
        .transfer-breakdown {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 0;
        }
        .transfer-breakdown div {
          display: grid;
          gap: 6px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.72);
        }
        .transfer-breakdown dd {
          margin: 0;
          color: var(--color-text);
          font-size: var(--text-price-sub);
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }
        .transfer-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        :global(.transfer-action-button) {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          min-height: 54px;
          border-radius: 8px;
          background: var(--color-charcoal, #211f1b);
          color: var(--color-cream, #fffaf1);
          font-weight: 800;
          text-decoration: none;
        }
        .transfer-action-button.secondary {
          border: 1px solid var(--color-border);
          background: #fff;
          color: var(--color-text);
        }
        .transfer-action-button:disabled {
          opacity: 0.56;
          cursor: wait;
        }
        .transfer-inline-message {
          margin: -4px 0 0;
          color: #b42318;
          font-size: var(--text-label);
          line-height: var(--leading-label);
          font-weight: 700;
        }
        @media (max-width: 520px) {
          .transfer-page {
            padding: 12px;
          }
          .transfer-card {
            padding: 18px;
          }
          .transfer-breakdown {
            grid-template-columns: 1fr;
          }
          .transfer-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
