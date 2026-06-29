"use client";

import { Droplets, Plus, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EstimatePreviewModal } from "@/components/builduscare/EstimatePreviewModal";
import { MobileAppBar } from "@/components/builduscare/MobileAppChrome";
import { readEstimatePreviewPayload, type EstimatePreviewPayload } from "@/components/builduscare/estimate-preview-storage";
import { HomeLanding } from "@/components/builduscare/HomeLanding";

type OrderResultRecord = Record<string, any> | null;

function useLastOrder() {
  const [orderNumber, setOrderNumber] = useState("");
  const [orderResult, setOrderResult] = useState<OrderResultRecord>(null);

  useEffect(() => {
    setOrderNumber(window.localStorage.getItem("builduscare:lastOrderNumber") ?? "");
    try {
      const raw = window.localStorage.getItem("builduscare:lastOrderResult");
      setOrderResult(raw ? JSON.parse(raw) : null);
    } catch {
      setOrderResult(null);
    }
  }, []);

  return { orderNumber, orderResult };
}

export function QuotePreviewClient() {
  const [payload, setPayload] = useState<EstimatePreviewPayload | null>(null);

  useEffect(() => {
    setPayload(readEstimatePreviewPayload());
  }, []);

  if (!payload) {
    return (
      <main className="estimate-page estimate-page-empty">
        <section className="estimate-card estimate-standalone-card estimate-empty-card">
          <h1>견적서를 불러오지 못했습니다.</h1>
          <p>이 창은 견적서 보기 버튼으로 다시 열어주세요.</p>
        </section>
      </main>
    );
  }

  return (
    <EstimatePreviewModal
      categoryTitle={payload.categoryTitle}
      allProducts={payload.allProducts}
      selections={payload.selections}
      productAmount={payload.productAmount}
      laborAmount={payload.laborAmount}
      shippingAmount={payload.shippingAmount}
      disposalAmount={payload.disposalAmount}
      totalAmount={payload.totalAmount}
      selfDisposal={payload.selfDisposal}
      categoryTitleByService={payload.categoryTitleByService}
      cashReceiptText={payload.cashReceiptText}
      orderNumber={payload.orderNumber}
      customerName={payload.customerName}
      customerPhone={payload.customerPhone}
      addressText={payload.addressText}
      visitText={payload.visitText}
      title={payload.title}
      standalone
      onClose={() => {
        window.close();
        if (!window.closed) window.history.back();
      }}
    />
  );
}

export function AsRequestClient() {
  const { orderNumber, orderResult } = useLastOrder();
  const serviceLabel = useMemo(() => {
    const explicit = String(orderResult?.serviceName ?? "").trim();
    if (explicit) return explicit;
    const firstName = String(orderResult?.selected?.[0]?.name ?? "").trim();
    if (firstName) return firstName;
    return "수전 교체";
  }, [orderResult]);

  const orderLabel = orderNumber || "BC-240602-118";

  return (
    <>
      <div className="bc-desktop-only">
        <HomeLanding />
      </div>
      <main className="bc-page support-route-page mobile-as-request-page bc-mobile-only">
        <MobileAppBar title="A/S 접수" backHref="/order-lookup" />
        <section className="mobile-as-request-screen">
          <div className="mobile-as-order-card">
            <div className="mobile-as-order-icon">
              <Droplets aria-hidden="true" />
            </div>
            <div>
              <b>{serviceLabel}</b>
              <span>{orderLabel}</span>
            </div>
          </div>

          <div className="mobile-as-section">
            <label>어떤 문제인가요?</label>
            <div className="mobile-as-chip-row">
              <button type="button" className="on">물샘</button>
              <button type="button">고정 불량</button>
              <button type="button">작동 불량</button>
              <button type="button">기타</button>
            </div>
          </div>

          <div className="mobile-as-section">
            <label>증상 사진 (선택)</label>
            <div className="mobile-as-photo-box">
              <Plus aria-hidden="true" />
              <span>추가</span>
            </div>
          </div>

          <div className="mobile-as-section">
            <label>내용</label>
            <textarea className="input" placeholder="증상을 적어주세요" />
          </div>

          <div className="mobile-as-note">
            <ShieldCheck aria-hidden="true" />
            <div>시공 하자·고정 불량·누수는 보증 범위예요. 빠르게 확인해 드릴게요.</div>
          </div>
        </section>
        <div className="mobile-route-fixed-submit">
          <button className="web-btn pri lg block" type="button">A/S 접수하기</button>
        </div>
      </main>
    </>
  );
}
