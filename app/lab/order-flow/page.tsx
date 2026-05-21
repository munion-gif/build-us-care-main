"use client";

import { useState } from "react";

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;
type ServiceItem = { service_type_code: string; display_name: string; base_price: number };
type LabState = {
  serviceItems: ServiceItem[];
  selectedServiceCode: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  accessToken: string;
  amount: number;
  orderName: string;
  reservedDate: string;
  timeSlot: "morning" | "afternoon" | "all_day";
};

function defaultReservationDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7 + Math.floor(Math.random() * 14));
  return date.toISOString().slice(0, 10);
}

const initialState: LabState = {
  serviceItems: [],
  selectedServiceCode: "toilet_replace",
  orderId: "",
  orderNumber: "",
  orderStatus: "",
  accessToken: "",
  amount: 110000,
  orderName: "변기 교체",
  reservedDate: defaultReservationDate(),
  timeSlot: "morning"
};

export default function OrderFlowLabPage() {
  const [state, setState] = useState<LabState>(initialState);
  const [responses, setResponses] = useState<Array<{ label: string; json: JsonValue }>>([]);
  const [message, setMessage] = useState("대기");
  const [loading, setLoading] = useState(false);

  function addResponse(label: string, json: JsonValue) {
    setResponses((current) => [{ label, json }, ...current].slice(0, 12));
  }

  async function requestJson(label: string, url: string, init?: RequestInit) {
    const response = await fetch(url, init);
    const json = (await response.json()) as JsonValue;
    addResponse(`${label} (${response.status})`, json);

    if (!response.ok) {
      throw new Error(`${label} failed`);
    }

    return json as { ok?: boolean; data?: Record<string, unknown> };
  }

  async function loadServiceItems() {
    setMessage("서비스 항목 조회 중");
    const json = await requestJson("1. service-items", "/api/service-items");
    const items = ((json.data?.items as ServiceItem[]) ?? []);
    const first = items[0];
    setState((current) => ({
      ...current,
      serviceItems: items,
      selectedServiceCode: current.selectedServiceCode || first?.service_type_code || "toilet_replace",
      orderName: first?.display_name || current.orderName,
      amount: (first?.base_price ?? 95000) + 15000
    }));
  }

  function currentItem() {
    return state.serviceItems.find((item) => item.service_type_code === state.selectedServiceCode) ?? {
      service_type_code: state.selectedServiceCode,
      display_name: state.orderName,
      base_price: Math.max(state.amount - 15000, 0)
    };
  }

  async function quote() {
    setMessage("견적 계산 중");
    const item = currentItem();
    const json = await requestJson("2. quote", "/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            service_type_code: item.service_type_code,
            item_name: item.display_name,
            qty: 1,
            unit_price: item.base_price
          }
        ]
      })
    });
    setState((current) => ({
      ...current,
      amount: Number(json.data?.total_amount ?? current.amount),
      orderName: item.display_name
    }));
  }

  async function createOrder() {
    setMessage("주문 생성 중");
    const item = currentItem();
    const json = await requestJson("3. orders", "/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: { phone: `010${Math.floor(10000000 + Math.random() * 89999999)}`, name: "랩테스트" },
        address: {
          road_address: "경기 수원시 테스트로 100",
          detail_address: "랩 1호",
          postal_code: "16490"
        },
        special_requests: "order-flow lab",
        items: [
          {
            service_type_code: item.service_type_code,
            item_name: item.display_name,
            qty: 1,
            unit_price: item.base_price
          }
        ]
      })
    });
    const order = json.data?.order as { id?: string; access_token?: string; total_amount?: number; order_number?: string };
    setState((current) => ({
      ...current,
      orderId: order.id ?? current.orderId,
      orderNumber: order.order_number ?? current.orderNumber,
      accessToken: order.access_token ?? current.accessToken,
      amount: Number(order.total_amount ?? current.amount),
      orderName: order.order_number ? `${item.display_name} ${order.order_number}` : item.display_name
    }));
  }

  async function reserve() {
    setMessage("예약 연결 중");
    await requestJson("4. reservation", `/api/orders/${state.orderId}/reservation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reserved_date: state.reservedDate,
        time_slot: state.timeSlot,
        status: "confirmed",
        notes: "order-flow lab"
      })
    });
  }

  async function pay() {
    setMessage("결제 mock 승인 중");
    await requestJson("5. toss confirm", "/api/payments/toss/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: state.orderId,
        paymentKey: `mock-lab-${Date.now()}`,
        amount: state.amount,
        orderName: state.orderName
      })
    });
  }

  async function status() {
    setMessage("상태 조회 중");
    const json = await requestJson("6. status", `/api/orders/${state.orderId}/status?accessToken=${encodeURIComponent(state.accessToken)}`);
    const order = json.data?.order as { order_number?: string; status?: string; total_amount?: number };
    setState((current) => ({
      ...current,
      orderNumber: order.order_number ?? current.orderNumber,
      orderStatus: order.status ?? current.orderStatus,
      amount: Number(order.total_amount ?? current.amount)
    }));
  }

  async function runStep(step: () => Promise<void>) {
    setLoading(true);
    try {
      await step();
      setMessage("완료");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  async function runAll() {
    setLoading(true);
    try {
      setMessage("전체 플로우 실행 중");
      const serviceJson = await requestJson("1. service-items", "/api/service-items");
      const items = ((serviceJson.data?.items as ServiceItem[]) ?? []);
      const item = items.find((entry) => entry.service_type_code === state.selectedServiceCode) ?? items[0] ?? currentItem();

      const quoteJson = await requestJson("2. quote", "/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              service_type_code: item.service_type_code,
              item_name: item.display_name,
              qty: 1,
              unit_price: item.base_price
            }
          ]
        })
      });

      const amount = Number(quoteJson.data?.total_amount ?? item.base_price + 15000);
      const orderJson = await requestJson("3. orders", "/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { phone: `010${Math.floor(10000000 + Math.random() * 89999999)}`, name: "랩테스트" },
          address: {
            road_address: "경기 수원시 테스트로 100",
            detail_address: "랩 1호",
            postal_code: "16490"
          },
          special_requests: "order-flow lab full run",
          items: [
            {
              service_type_code: item.service_type_code,
              item_name: item.display_name,
              qty: 1,
              unit_price: item.base_price
            }
          ]
        })
      });

      const order = orderJson.data?.order as { id?: string; access_token?: string; total_amount?: number; order_number?: string };
      const orderId = order.id ?? "";
      const accessToken = order.access_token ?? "";
      const totalAmount = Number(order.total_amount ?? amount);
      const orderName = `${item.display_name} ${order.order_number ?? ""}`.trim();

      setState((current) => ({
        ...current,
        serviceItems: items,
        selectedServiceCode: item.service_type_code,
        orderId,
        orderNumber: order.order_number ?? "",
        accessToken,
        amount: totalAmount,
        orderName
      }));

      await requestJson("4. reservation", `/api/orders/${orderId}/reservation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reserved_date: state.reservedDate,
          time_slot: state.timeSlot,
          status: "confirmed",
          notes: "order-flow lab full run"
        })
      });

      await requestJson("5. toss confirm", "/api/payments/toss/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          paymentKey: `mock-lab-${Date.now()}`,
          amount: totalAmount,
          orderName
        })
      });

      const statusJson = await requestJson("6. status", `/api/orders/${orderId}/status?accessToken=${encodeURIComponent(accessToken)}`);
      const statusOrder = statusJson.data?.order as { order_number?: string; status?: string; total_amount?: number };
      setState((current) => ({
        ...current,
        orderNumber: statusOrder.order_number ?? current.orderNumber,
        orderStatus: statusOrder.status ?? current.orderStatus,
        amount: Number(statusOrder.total_amount ?? current.amount)
      }));
      setMessage("전체 플로우 완료");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  async function runAfterOrder() {
    await runStep(async () => {
      await reserve();
      await pay();
      await status();
    });
  }

  return (
    <main style={pageStyle}>
      <h1 style={titleStyle}>Order Flow Lab</h1>
      <p style={mutedStyle}>실제 /api 엔드포인트로 서비스 조회부터 주문, 예약, 결제, 상태 조회까지 검증합니다.</p>

      <section style={panelStyle}>
        <div style={gridStyle}>
          <label>
            <div>service</div>
            <select
              value={state.selectedServiceCode}
              onChange={(event) => {
                const selected = state.serviceItems.find((item) => item.service_type_code === event.target.value);
                setState((current) => ({
                  ...current,
                  selectedServiceCode: event.target.value,
                  orderName: selected?.display_name ?? current.orderName,
                  amount: selected ? selected.base_price + 15000 : current.amount
                }));
              }}
              style={inputStyle}
            >
              <option value={state.selectedServiceCode}>{state.selectedServiceCode}</option>
              {state.serviceItems.map((item) => (
                <option key={item.service_type_code} value={item.service_type_code}>
                  {item.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div>orderId</div>
            <input data-order-id value={state.orderId} onChange={(event) => setState({ ...state, orderId: event.target.value })} style={inputStyle} />
          </label>
          <label>
            <div>accessToken</div>
            <input value={state.accessToken} onChange={(event) => setState({ ...state, accessToken: event.target.value })} style={inputStyle} />
          </label>
          <label>
            <div>amount</div>
            <input type="number" value={state.amount} onChange={(event) => setState({ ...state, amount: Number(event.target.value) })} style={inputStyle} />
          </label>
          <label>
            <div>reserved_date</div>
            <input value={state.reservedDate} onChange={(event) => setState({ ...state, reservedDate: event.target.value })} style={inputStyle} />
          </label>
          <label>
            <div>time_slot</div>
            <select value={state.timeSlot} onChange={(event) => setState({ ...state, timeSlot: event.target.value as LabState["timeSlot"] })} style={inputStyle}>
              <option value="morning">morning</option>
              <option value="afternoon">afternoon</option>
              <option value="all_day">all_day</option>
            </select>
          </label>
        </div>
      </section>

      <section style={buttonGridStyle}>
        <button disabled={loading} onClick={() => runStep(loadServiceItems)} style={buttonStyle}>1. service-items</button>
        <button disabled={loading} onClick={() => runStep(quote)} style={buttonStyle}>2. quote</button>
        <button disabled={loading} onClick={() => runStep(createOrder)} style={buttonStyle}>3. order</button>
        <button disabled={loading || !state.orderId} onClick={() => runStep(reserve)} style={buttonStyle}>4. reservation</button>
        <button disabled={loading || !state.orderId} onClick={() => runStep(pay)} style={buttonStyle}>5. payment</button>
        <button disabled={loading || !state.orderId || !state.accessToken} onClick={() => runStep(status)} style={buttonStyle}>6. status</button>
        <button disabled={loading} onClick={runAll} style={secondaryButtonStyle}>Run 1-6</button>
        <button disabled={loading || !state.orderId || !state.accessToken} onClick={runAfterOrder} style={secondaryButtonStyle}>Run 4-6</button>
      </section>

      <Status message={message} />
      <OrderSummary state={state} />
      <Responses responses={responses} />
    </main>
  );
}

function Status({ message }: { message: string }) {
  return <section style={panelStyle}><strong>상태</strong><div style={statusStyle}>{message}</div></section>;
}

function OrderSummary({ state }: { state: LabState }) {
  const statusUrl = state.orderId && state.accessToken ? `/api/orders/${state.orderId}/status?accessToken=${encodeURIComponent(state.accessToken)}` : "";
  const uploadHref =
    state.orderId && state.accessToken
      ? `/lab/photo-upload?orderId=${encodeURIComponent(state.orderId)}&accessToken=${encodeURIComponent(state.accessToken)}`
      : "";

  async function copy(value: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  }

  return (
    <section style={panelStyle}>
      <strong>마지막 주문 요약</strong>
      <div style={summaryGridStyle}>
        <div><b>orderId</b><br />{state.orderId || "-"}</div>
        <div><b>orderNumber</b><br />{state.orderNumber || "-"}</div>
        <div><b>status</b><br />{state.orderStatus || "-"}</div>
        <div><b>total_amount</b><br />{state.amount || "-"}</div>
      </div>
      <div style={buttonGridStyle}>
        <button disabled={!state.orderId} onClick={() => copy(state.orderId)} style={secondaryButtonStyle}>orderId 복사</button>
        <button disabled={!statusUrl} onClick={() => copy(statusUrl)} style={secondaryButtonStyle}>statusUrl 복사</button>
        <a href={uploadHref || undefined} aria-disabled={!uploadHref} style={linkButtonStyle}>이 주문 사진 업로드 하러 가기</a>
      </div>
      {statusUrl && <pre style={lightPreStyle}>{statusUrl}</pre>}
    </section>
  );
}

function Responses({ responses }: { responses: Array<{ label: string; json: JsonValue }> }) {
  return (
    <section style={panelStyle}>
      <strong>JSON 응답</strong>
      <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
        {responses.map((response, index) => (
          <details key={`${response.label}-${index}`} open={index === 0}>
            <summary>{response.label}</summary>
            <pre style={preStyle}>{JSON.stringify(response.json, null, 2)}</pre>
          </details>
        ))}
      </div>
    </section>
  );
}

const pageStyle = { maxWidth: 980, margin: "40px auto", padding: 20, fontFamily: "Arial, sans-serif" };
const titleStyle = { fontSize: 24, marginBottom: 8 };
const mutedStyle = { color: "#555", marginBottom: 24 };
const panelStyle = { marginTop: 20, padding: 16, border: "1px solid #ddd", background: "#fff" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
const buttonGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 16 };
const inputStyle = { width: "100%", minHeight: 36, padding: "8px 10px", border: "1px solid #bbb", boxSizing: "border-box" as const };
const buttonStyle = { minHeight: 40, border: 0, background: "#111", color: "#fff", cursor: "pointer" };
const secondaryButtonStyle = { ...buttonStyle, background: "#555" };
const statusStyle = { marginTop: 8, padding: 12, background: "#f6f7f8", border: "1px solid #ddd" };
const preStyle = { overflowX: "auto" as const, padding: 12, background: "#111", color: "#f8f8f8", fontSize: 12 };
const lightPreStyle = { overflowX: "auto" as const, padding: 12, background: "#f6f7f8", border: "1px solid #ddd", fontSize: 12 };
const summaryGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 12 };
const linkButtonStyle = { ...secondaryButtonStyle, display: "grid", placeItems: "center", textDecoration: "none" };
