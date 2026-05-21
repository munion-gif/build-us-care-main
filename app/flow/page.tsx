"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

type KakaoPostcodeData = {
  zonecode: string;
  address: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: "R" | "J";
  bname: string;
  buildingName: string;
  apartment: "Y" | "N";
};

declare global {
  interface Window {
    kakao?: {
      Postcode: new (options: {
        oncomplete: (data: KakaoPostcodeData) => void;
        width?: string;
        height?: string;
        maxSuggestItems?: number;
        onresize?: (size: { width: number; height: number }) => void;
      }) => { open: () => void; embed: (element: HTMLElement) => void };
    };
  }
}

type ServiceItem = {
  service_type_code: string;
  display_name: string;
  base_price: number;
  estimated_minutes?: number;
  metadata?: { category?: string };
};

type QuoteResult = {
  visit_fee: number;
  subtotal_amount: number;
  total_amount: number;
  items: Array<{
    item_name: string;
    qty: number;
    unit_price: number;
    line_total: number;
    metadata?: Record<string, unknown>;
  }>;
};

type FlowState = {
  serviceItems: ServiceItem[];
  selectedServiceCode: string;
  serviceItem?: ServiceItem;
  quote?: QuoteResult;
  order?: Record<string, unknown>;
  orderId: string;
  orderNumber: string;
  accessToken: string;
  totalAmount: number;
  statusUrl: string;
  jobId: string;
  reservation?: Record<string, unknown>;
  payment?: Record<string, unknown>;
  status?: Record<string, unknown>;
};

type CustomerForm = {
  name: string;
  phone: string;
  road_address: string;
  detail_address: string;
  postal_code: string;
  special_requests: string;
  acquisition_source: string;
  address_dong: string;
  address_apt: string;
  size_pyung: number;
  building_type: "apartment" | "villa" | "house" | "officetel" | "commercial" | "unknown";
  year_built: number;
  housing_type: "owner" | "jeonse" | "monthly_rent" | "unknown";
  reason: string;
  urgency: string;
};

type ReservationForm = {
  reserved_date: string;
  time_slot: "morning" | "afternoon" | "all_day";
  notes: string;
};

const steps = ["홈", "카탈로그", "상품 상세", "장바구니", "사진+주소", "캘린더 예약", "결제", "마이페이지"];

const categoryLabels: Record<string, string> = {
  bathroom: "욕실",
  kitchen: "주방",
  lighting: "조명",
  door: "문/손잡이",
  service: "서비스"
};

const timeSlotLabels: Record<ReservationForm["time_slot"], string> = {
  morning: "오전",
  afternoon: "오후",
  all_day: "종일"
};

const timeSlotDescriptions: Record<ReservationForm["time_slot"], string> = {
  morning: "오전 방문",
  afternoon: "오후 방문",
  all_day: "종일 가능"
};

const weekLabels = ["일", "월", "화", "수", "목", "금", "토"];
const calendarMonth = { year: 2026, month: 4, label: "2026년 5월" };

const statusLabels: Record<string, string> = {
  inquiry: "문의 접수",
  submitted: "문의 접수",
  draft: "문의 접수",
  quoted: "견적 완료",
  payment_pending: "결제 대기",
  received: "작업 접수",
  confirmed: "예약 확정",
  reservation_pending: "예약 대기",
  reservation_confirmed: "방문 확정",
  preparing: "방문 확정",
  in_progress: "시공 중",
  in_service: "시공 중",
  completed: "검수 대기",
  done: "완료",
  DONE: "결제 완료",
  paid: "결제 완료",
  pending: "대기 중",
  canceled: "취소",
  cancelled: "취소",
  cancel_requested: "취소 요청",
  issue: "이슈",
  warranty: "A/S"
};

const serviceCodeLabels: Record<string, string> = {
  bathroom_basic: "욕실 기본 점검/소모품 교체",
  kitchen_faucet: "주방 수전 교체",
  light_replace: "조명 교체",
  door_handle: "도어 핸들 교체",
  toilet_replace: "변기 교체",
  bath_fan: "욕실 환풍기 교체",
  slide_bar: "샤워 슬라이드바 교체",
  drain_replace: "욕실 유가 교체"
};

const initialFlowState: FlowState = {
  serviceItems: [],
  selectedServiceCode: "",
  orderId: "",
  orderNumber: "",
  accessToken: "",
  totalAmount: 0,
  statusUrl: "",
  jobId: ""
};

const fallbackItems: ServiceItem[] = [
  { service_type_code: "toilet_replace", display_name: "변기 교체", base_price: 80000, estimated_minutes: 120, metadata: { category: "bathroom" } },
  { service_type_code: "bathroom_basic", display_name: "욕실 기본 점검", base_price: 60000, estimated_minutes: 60, metadata: { category: "bathroom" } },
  { service_type_code: "kitchen_faucet", display_name: "주방 수전 교체", base_price: 90000, estimated_minutes: 90, metadata: { category: "kitchen" } },
  { service_type_code: "light_replace", display_name: "조명 교체", base_price: 40000, estimated_minutes: 40, metadata: { category: "lighting" } },
  { service_type_code: "bath_fan", display_name: "욕실 환풍기 교체", base_price: 70000, estimated_minutes: 80, metadata: { category: "bathroom" } },
  { service_type_code: "door_handle", display_name: "도어 핸들 교체", base_price: 35000, estimated_minutes: 30, metadata: { category: "door" } }
];

const imageSets: Record<string, string[]> = {
  toilet_replace: [
    "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=900&q=80"
  ],
  kitchen_faucet: [
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80"
  ],
  light_replace: [
    "https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1517991104123-1d56a6e81ed9?auto=format&fit=crop&w=900&q=80"
  ],
  door_handle: [
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=900&q=80"
  ],
  bath_fan: [
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1585412727339-54e4bae3bbf9?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1595514535215-74f25f536b3f?auto=format&fit=crop&w=900&q=80"
  ],
  bathroom_basic: [
    "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80"
  ]
};

export default function FlowPage() {
  const [step, setStep] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [materialGrade, setMaterialGrade] = useState<"일반" | "고급">("일반");
  const [addons, setAddons] = useState<string[]>([]);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [flow, setFlow] = useState<FlowState>(initialFlowState);
  const [customer, setCustomer] = useState<CustomerForm>({
    name: "QA 테스트",
    phone: "01012345678",
    road_address: "경기 수원시 테스트로 100",
    detail_address: "101호",
    postal_code: "16490",
    special_requests: "흐름 검증 요청",
    acquisition_source: "web",
    address_dong: "수원시 테스트동",
    address_apt: "",
    size_pyung: 24,
    building_type: "apartment",
    year_built: 1995,
    housing_type: "owner",
    reason: "old",
    urgency: "within_1w"
  });
  const [reservation, setReservation] = useState<ReservationForm>({
    reserved_date: "2026-05-26",
    time_slot: "morning",
    notes: "흐름 검증 예약"
  });
  const [responses, setResponses] = useState<Array<{ label: string; json: JsonValue }>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("대기");
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const [addressSearchOpen, setAddressSearchOpen] = useState(false);
  const addressSearchRef = useRef<HTMLDivElement>(null);

  const selectedItem = useMemo(
    () => flow.serviceItems.find((item) => item.service_type_code === flow.selectedServiceCode) ?? flow.serviceItem,
    [flow.selectedServiceCode, flow.serviceItem, flow.serviceItems]
  );

  const finalStatus = flow.status?.order as
    | {
        status?: string;
        total_amount?: number;
        jobs?: { status?: string };
        reservations?: Array<{ status?: string }>;
        payments?: Array<{ status?: string }>;
      }
    | undefined;
  const filteredItems = useMemo(
    () =>
      categoryFilter === "전체"
        ? flow.serviceItems
        : flow.serviceItems.filter((item) => categoryLabel(item.metadata?.category) === categoryFilter),
    [categoryFilter, flow.serviceItems]
  );
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth.year, calendarMonth.month), []);
  const availableTimeSlots = availableSlotsForDate(reservation.reserved_date);
  const selectedAddonsTotal = addons.reduce((sum, addon) => sum + (addon === "방수 실리콘" ? 15000 : addon === "폐기물 수거" ? 20000 : 10000), 0);
  const displayTotal = (flow.quote?.total_amount ?? selectedItem?.base_price ?? 0) + (materialGrade === "고급" ? 100000 : 0) + selectedAddonsTotal;

  useEffect(() => {
    if (flow.serviceItems.length > 0 || loading) return;

    void run(loadServiceItems);
    // Initial load only. The action function reads the current state intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addResponse(label: string, json: JsonValue) {
    setResponses((current) => [{ label, json }, ...current].slice(0, 12));
  }

  async function requestJson(label: string, url: string, init?: RequestInit) {
    const response = await fetch(url, init);
    const json = (await response.json()) as JsonValue;
    addResponse(`${label} (${response.status})`, json);

    if (!response.ok) {
      throw new Error(`${label} 요청을 다시 확인해 주세요.`);
    }

    return json as { ok?: boolean; data?: Record<string, unknown> };
  }

  async function run(action: () => Promise<void>, nextStep?: number) {
    setLoading(true);
    try {
      await action();
      if (typeof nextStep === "number") setStep(nextStep);
      setMessage("완료");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  async function loadServiceItems() {
    setMessage("서비스 목록 조회 중");
    const json = await requestJson("1. 서비스 목록", "/api/service-items");
    const items = ((json.data?.items as ServiceItem[]) ?? []);
    const nextSelected = items.find((item) => item.service_type_code === flow.selectedServiceCode) ?? items[0];

    setFlow((current) => ({
      ...current,
      serviceItems: items,
      selectedServiceCode: nextSelected?.service_type_code ?? current.selectedServiceCode,
      serviceItem: nextSelected ?? current.serviceItem
    }));
  }

  async function calculateQuote() {
    const item = selectedItem;
    if (!item) throw new Error("서비스를 먼저 선택하세요.");

    setMessage("견적 계산 중");
    const json = await requestJson("2. 견적 계산", "/api/quote", {
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
    const quote = json.data as QuoteResult;
    const optionTotal = (materialGrade === "고급" ? 100000 : 0) + selectedAddonsTotal;

    setFlow((current) => ({
      ...current,
      quote,
      totalAmount: quote.total_amount + optionTotal
    }));
  }

  async function createOrder() {
    const item = selectedItem;
    if (!item) throw new Error("서비스를 먼저 선택해 주세요.");

    setMessage("주문 생성 중");
    const json = await requestJson("3. 주문 생성", "/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: {
          name: customer.name,
          phone: customer.phone,
          acquisition_source: customer.acquisition_source
        },
        address: {
          road_address: customer.road_address,
          detail_address: customer.detail_address,
          postal_code: customer.postal_code
        },
        home: {
          address_full: `${customer.road_address} ${customer.detail_address}`.trim(),
          address_dong: customer.address_dong,
          address_apt: customer.address_apt,
          postal_code: customer.postal_code,
          size_pyung: customer.size_pyung,
          building_type: customer.building_type,
          year_built: customer.year_built,
          housing_type: customer.housing_type
        },
        order: {
          channel: "web",
          reason: customer.reason,
          urgency: customer.urgency,
          self_diagnosis: customer.special_requests,
          skus: [
            {
              sku: item.service_type_code,
              qty: 1,
              service_type: "labor_service",
              options: [],
              material_skus: []
            }
          ]
        },
        special_requests: customer.special_requests,
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

    const order = json.data?.order as { id?: string; order_number?: string; access_token?: string; total_amount?: number };
    const job = json.data?.job as { id?: string };
    const orderId = order.id ?? "";
    const accessToken = order.access_token ?? "";

    setFlow((current) => ({
      ...current,
      order,
      orderId,
      orderNumber: order.order_number ?? "",
      accessToken,
      totalAmount: Number(order.total_amount ?? current.totalAmount),
      statusUrl: orderId && accessToken ? `/api/orders/${orderId}/status?accessToken=${accessToken}` : "",
      jobId: job.id ?? ""
    }));
  }

  async function createReservation() {
    if (!flow.orderId) throw new Error("주문을 먼저 생성하세요.");

    setMessage("예약 생성 중");
    const startDate = parseReservationDate(reservation.reserved_date);

    for (let offset = 0; offset < 14; offset += 1) {
      const reservedDate = formatReservationDate(addDays(startDate, offset));
      const response = await fetch(`/api/orders/${flow.orderId}/reservation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reserved_date: reservedDate,
          time_slot: reservation.time_slot,
          status: "confirmed",
          notes: reservation.notes
        })
      });
      const json = (await response.json()) as { ok?: boolean; data?: Record<string, unknown>; error?: { code?: string; message?: string } };
      addResponse(`4. 예약 생성 (${response.status})`, json);

      if (response.ok) {
        setReservation((current) => ({ ...current, reserved_date: reservedDate }));
        setFlow((current) => ({
          ...current,
          reservation: json.data?.reservation as Record<string, unknown>
        }));
        if (offset > 0) setMessage(`${reservedDate} ${timeSlotLabels[reservation.time_slot]}으로 예약했습니다.`);
        return;
      }

      const isSlotConflict = response.status === 409 && json.error?.message?.includes("reservations_confirmed_slot_uq");
      if (!isSlotConflict) {
        throw new Error("예약 정보를 다시 확인해 주세요.");
      }
    }

    throw new Error("선택한 시간대가 마감되어 다른 날짜를 선택해 주세요.");
  }

  async function confirmPayment() {
    if (!flow.orderId) throw new Error("주문을 먼저 생성하세요.");
    const itemName = selectedItem?.display_name ?? "Buildus Care order";

    setMessage("토스 테스트 결제 승인 중");
    const json = await requestJson("5. 토스 결제 승인", "/api/payments/toss/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: flow.orderId,
        paymentKey: `mock-flow-${Date.now()}`,
        amount: flow.totalAmount,
        orderName: `${itemName} ${flow.orderNumber}`.trim()
      })
    });

    setFlow((current) => ({
      ...current,
      payment: json.data?.payment as Record<string, unknown>
    }));
  }

  async function loadStatus() {
    if (!flow.orderId || !flow.accessToken) throw new Error("주문과 accessToken이 필요합니다.");

    setMessage("상태 조회 중");
    const json = await requestJson("6. 상태 조회", `/api/orders/${flow.orderId}/status?accessToken=${encodeURIComponent(flow.accessToken)}`);

    setFlow((current) => ({
      ...current,
      status: json.data as Record<string, unknown>
    }));
  }

  function loadKakaoPostcodeScript() {
    return new Promise<void>((resolve, reject) => {
      if (typeof window === "undefined") return reject(new Error("브라우저에서만 주소 검색을 사용할 수 있어요."));
      if (window.kakao?.Postcode) return resolve();

      const existingScript = document.querySelector<HTMLScriptElement>('script[data-kakao-postcode="true"]');
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("주소 검색을 불러오지 못했어요.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.async = true;
      script.dataset.kakaoPostcode = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("주소 검색을 불러오지 못했어요."));
      document.head.appendChild(script);
    });
  }

  async function openAddressSearch() {
    setAddressSearchLoading(true);
    setMessage("주소 검색창을 여는 중");
    try {
      await loadKakaoPostcodeScript();
      if (!window.kakao?.Postcode) throw new Error("주소 검색 서비스를 사용할 수 없어요.");
      const container = addressSearchRef.current;
      if (!container) throw new Error("주소 검색 영역을 준비하지 못했어요.");

      setAddressSearchOpen(true);
      container.innerHTML = "";
      new window.kakao.Postcode({
        width: "100%",
        height: "100%",
        maxSuggestItems: 5,
        onresize: (size) => {
          container.style.height = `${Math.max(size.height, 420)}px`;
        },
        oncomplete: (data) => {
          const selectedAddress = data.userSelectedType === "R" ? data.roadAddress : data.jibunAddress;
          const extraAddress = buildExtraAddress(data);
          setCustomer((current) => ({
            ...current,
            road_address: selectedAddress || data.address,
            postal_code: data.zonecode,
            detail_address: extraAddress ? `${current.detail_address} ${extraAddress}`.trim() : current.detail_address
          }));
          setAddressSearchOpen(false);
          container.innerHTML = "";
          setMessage("주소를 선택했습니다. 상세주소를 확인해 주세요.");
        }
      }).embed(container);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "주소 검색을 다시 시도해 주세요.");
    } finally {
      setAddressSearchLoading(false);
    }
  }

  function closeAddressSearch() {
    if (addressSearchRef.current) addressSearchRef.current.innerHTML = "";
    setAddressSearchOpen(false);
    setMessage("주소 검색을 닫았습니다.");
  }

  function goNext() {
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function goPrev() {
    setStep((current) => Math.max(current - 1, 0));
  }

  function toggleAddon(addon: string) {
    setAddons((current) => (current.includes(addon) ? current.filter((item) => item !== addon) : [...current, addon]));
  }

  async function runPrimaryAction() {
    if (step === 0) return run(loadServiceItems, 1);
    if (step === 1) return setStep(2);
    if (step === 2) return run(calculateQuote, 3);
    if (step === 3) return setStep(4);
    if (step === 4 && !flow.quote) {
      return run(async () => {
        await calculateQuote();
        await createOrder();
      }, 5);
    }
    if (step === 4) return run(createOrder, 5);
    if (step === 5) return run(createReservation, 6);
    if (step === 6) return run(confirmPayment, 7);
    return run(loadStatus);
  }

  function primaryCtaLabel() {
    if (loading) return "잠시만 기다려 주세요";
    return ["지금 견적 보기", "선택한 서비스 보기", "장바구니 담기", "다음", "예약 단계로 이동", "결제 단계로 이동", "테스트 결제하기", "상태 새로고침"][step];
  }

  function primaryDisabled() {
    if (loading) return true;
    if (step === 1) return !selectedItem;
    if (step === 2) return !selectedItem;
    if (step === 3) return !selectedItem;
    if (step === 4) return !selectedItem;
    if (step === 5) return !flow.orderId;
    if (step === 6) return !flow.orderId || !termsAgreed;
    if (step === 7) return !flow.orderId || !flow.accessToken;
    return false;
  }

  return (
    <main className="flow-app">
      <style>{flowCss}</style>
      <section className="phone-shell" aria-label="빌드어스케어 웹앱 주문 흐름">
        <header className="app-top">
          <button type="button" className="icon-button" onClick={goPrev} disabled={step === 0 || loading} aria-label="이전 화면">‹</button>
          <div>
            <span>빌드어스케어</span>
            <strong>{steps[step]}</strong>
          </div>
          <a className="icon-button" href="/lab/admin" aria-label="관리자 화면">관리</a>
        </header>

        <Progress current={step} />

        <section className="screen">
          {step === 0 && (
            <ScreenBlock eyebrow="정찰가 시공" title="수원·용인·성남 집수리, 가격 먼저 확인하세요" desc="회원가입 없이 전화번호만으로 견적, 예약, 결제 테스트까지 진행합니다.">
              <div className="hero-photo" style={{ backgroundImage: `url(${serviceImage("toilet_replace")})` }}>
                <span>실제 시공 품목 기준</span>
              </div>
              <div className="sku-grid home-skus">
                {(flow.serviceItems.length ? flow.serviceItems.slice(0, 6) : fallbackItems).map((item) => (
                  <button
                    type="button"
                    key={item.service_type_code}
                    className="mini-sku"
                    onClick={() => {
                      setFlow((current) => ({ ...current, selectedServiceCode: item.service_type_code, serviceItem: item as ServiceItem }));
                      setStep(2);
                    }}
                  >
                    <span className="sku-image" style={{ backgroundImage: `url(${serviceImage(item.service_type_code)})` }} />
                    <strong>{item.display_name}</strong>
                    <span>{item.base_price.toLocaleString()}원부터</span>
                  </button>
                ))}
              </div>
              <div className="review-strip">
                <strong>후기 4.8</strong>
                <span>“가격이 먼저 보여서 안심됐어요.”</span>
              </div>
            </ScreenBlock>
          )}

          {step === 1 && (
            <ScreenBlock eyebrow="카탈로그" title="필요한 시공을 골라주세요" desc="카테고리를 좁히고 카드 하나를 선택하시면 됩니다.">
              <div className="chip-row">
                {["전체", "욕실", "주방", "조명", "문/손잡이"].map((category) => (
                  <button type="button" key={category} className={category === categoryFilter ? "chip active" : "chip"} onClick={() => setCategoryFilter(category)}>
                    {category}
                  </button>
                ))}
              </div>
              <div className="sku-list">
                {(filteredItems.length ? filteredItems : fallbackItems).map((item) => (
                  <button
                    type="button"
                    key={item.service_type_code}
                    className={item.service_type_code === flow.selectedServiceCode ? "sku-card selected" : "sku-card"}
                    onClick={() => {
                      setFlow((current) => ({ ...current, selectedServiceCode: item.service_type_code, serviceItem: item as ServiceItem }));
                      setStep(2);
                    }}
                  >
                    <span className="sku-thumb" style={{ backgroundImage: `url(${serviceImage(item.service_type_code)})` }} />
                    <span>
                      <b>{item.display_name}</b>
                      <small>{categoryLabel(item.metadata?.category)} · {item.estimated_minutes ?? 60}분 예상</small>
                    </span>
                    <strong>{item.base_price.toLocaleString()}원</strong>
                  </button>
                ))}
              </div>
            </ScreenBlock>
          )}

          {step === 2 && (
            <ScreenBlock eyebrow="상품 상세" title={selectedItem?.display_name ?? "서비스를 선택해 주세요"} desc="자재 등급과 함께 구매할 항목을 선택해 주세요.">
              <div className="image-slider">
                {[0, 1, 2].map((index) => (
                  <span key={index} style={{ backgroundImage: `url(${serviceImage(selectedItem?.service_type_code ?? "toilet_replace", index)})` }} />
                ))}
              </div>
              <div className="option-box">
                <strong>자재 등급</strong>
                <label><input type="radio" checked={materialGrade === "일반"} onChange={() => setMaterialGrade("일반")} /> 일반형</label>
                <label><input type="radio" checked={materialGrade === "고급"} onChange={() => setMaterialGrade("고급")} /> 고급형 +100,000원</label>
              </div>
              <div className="option-box">
                <strong>함께 구매</strong>
                {["방수 실리콘", "폐기물 수거", "부속 교체"].map((addon) => (
                  <label key={addon}><input type="checkbox" checked={addons.includes(addon)} onChange={() => toggleAddon(addon)} /> {addon}</label>
                ))}
              </div>
              <div className="info-grid">
                <KeyValue label="시공 시간" value={selectedItem?.estimated_minutes ? `${selectedItem.estimated_minutes}분` : "60분 내외"} />
                <KeyValue label="AS" value="기본 1년" />
              </div>
            </ScreenBlock>
          )}

          {step === 3 && (
            <ScreenBlock eyebrow="장바구니" title="담은 시공을 확인해 주세요" desc="출장비는 한 번만 적용됩니다.">
              <div className="cart-list">
                <div className="cart-row">
                  <span className="sku-thumb" style={{ backgroundImage: `url(${serviceImage(selectedItem?.service_type_code ?? "toilet_replace")})` }} />
                  <span><b>{selectedItem?.display_name ?? "-"}</b><small>수정 · 삭제는 다음 단계에서 확장 예정</small></span>
                  <strong>{selectedItem ? selectedItem.base_price.toLocaleString() : 0}원</strong>
                </div>
                {addons.map((addon) => (
                  <div className="cart-row compact" key={addon}>
                    <span>{addon}</span>
                    <strong>{(addon === "방수 실리콘" ? 15000 : addon === "폐기물 수거" ? 20000 : 10000).toLocaleString()}원</strong>
                  </div>
                ))}
              </div>
              <div className="saving-box">출장비 15,000원은 1회만 적용되어요.</div>
              <div className="total-box"><span>예상 결제금액</span><strong>{displayTotal.toLocaleString()}원</strong></div>
            </ScreenBlock>
          )}

          {step === 4 && (
            <ScreenBlock eyebrow="사진 + 주소" title="방문 전 정보를 알려주세요" desc="사진은 나중에 실제 업로드 API와 연결됩니다.">
              <div className="photo-grid">
                {["카메라", "앨범", "추가"].map((label) => <button type="button" key={label}>+ {label}</button>)}
              </div>
              <button type="button" className="planned-button" onClick={() => void openAddressSearch()} disabled={addressSearchLoading}>
                {addressSearchLoading ? "주소 검색 준비 중" : "카카오 주소 검색"}
              </button>
              <div className={addressSearchOpen ? "postcode-panel open" : "postcode-panel"}>
                <div className="postcode-panel-head">
                  <strong>주소 검색</strong>
                  <button type="button" onClick={closeAddressSearch}>닫기</button>
                </div>
                <div ref={addressSearchRef} className="postcode-embed" />
              </div>
              <div className="form-list">
                <TextInput label="이름" value={customer.name} onChange={(value) => setCustomer({ ...customer, name: value })} />
                <TextInput label="전화번호" value={customer.phone} onChange={(value) => setCustomer({ ...customer, phone: value })} />
                <TextInput label="우편번호" value={customer.postal_code} onChange={(value) => setCustomer({ ...customer, postal_code: value })} />
                <TextInput label="도로명 주소" value={customer.road_address} onChange={(value) => setCustomer({ ...customer, road_address: value })} />
                <TextInput label="상세 주소" value={customer.detail_address} onChange={(value) => setCustomer({ ...customer, detail_address: value })} />
                <TextInput label="특이사항" value={customer.special_requests} onChange={(value) => setCustomer({ ...customer, special_requests: value })} />
              </div>
            </ScreenBlock>
          )}

          {step === 5 && (
            <ScreenBlock eyebrow="캘린더 예약" title="방문 날짜와 시간을 선택해 주세요" desc="가능한 날짜만 진하게 표시됩니다. 실제 기사 일정 API 연결 전까지는 테스트 캘린더로 검증합니다.">
              <div className="calendar-card" aria-label="예약 날짜 선택">
                <div className="calendar-head">
                  <strong>{calendarMonth.label}</strong>
                  <span>가능 날짜 선택</span>
                </div>
                <div className="calendar-week">
                  {weekLabels.map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="calendar-grid">
                  {calendarDays.map((day) => {
                    const disabled = !day.date || isCalendarDateUnavailable(day.date);
                    const selected = day.date === reservation.reserved_date;
                    return (
                      <button
                        type="button"
                        key={day.key}
                        className={selected ? "calendar-day selected" : disabled ? "calendar-day disabled" : "calendar-day"}
                        disabled={disabled}
                        onClick={() => {
                          const selectedDate = day.date;
                          if (!selectedDate) return;
                          const nextSlots = availableSlotsForDate(selectedDate);
                          setReservation((current) => ({
                            ...current,
                            reserved_date: selectedDate,
                            time_slot: nextSlots.includes(current.time_slot) ? current.time_slot : nextSlots[0] ?? "morning"
                          }));
                        }}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="slot-grid" aria-label="예약 시간대 선택">
                {(Object.keys(timeSlotLabels) as ReservationForm["time_slot"][]).map((slot) => {
                  const disabled = !availableTimeSlots.includes(slot);
                  return (
                    <button
                      type="button"
                      key={slot}
                      className={disabled ? "slot disabled" : reservation.time_slot === slot ? "slot active" : "slot"}
                      disabled={disabled}
                      onClick={() => setReservation((current) => ({ ...current, time_slot: slot }))}
                    >
                      <strong>{timeSlotLabels[slot]}</strong>
                      <span>{disabled ? "마감" : timeSlotDescriptions[slot]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="reservation-summary">
                <span>선택한 예약</span>
                <strong>{formatKoreanDate(reservation.reserved_date)} {timeSlotLabels[reservation.time_slot]}</strong>
              </div>
              <div className="form-list">
                <TextInput label="요청사항" value={reservation.notes} onChange={(value) => setReservation({ ...reservation, notes: value })} />
              </div>
            </ScreenBlock>
          )}

          {step === 6 && (
            <ScreenBlock eyebrow="결제" title="마지막으로 금액을 확인해 주세요" desc="현재는 토스페이먼츠 테스트 승인으로 검증합니다.">
              <div className="pay-box">
                <span>최종 결제금액</span>
                <strong>{(flow.totalAmount || displayTotal).toLocaleString()}원</strong>
                <small>카드 · 간편결제 · 할부는 실제 Toss 창 연동 시 제공됩니다.</small>
              </div>
              <label className="agree-row">
                <input type="checkbox" checked={termsAgreed} onChange={(event) => setTermsAgreed(event.target.checked)} />
                결제 및 방문 예약 안내를 확인했습니다.
              </label>
            </ScreenBlock>
          )}

          {step === 7 && (
            <ScreenBlock eyebrow="마이페이지" title="진행 상태를 확인해 주세요" desc="전화번호와 접근 토큰으로 주문 상태를 조회합니다.">
              <StatusTimeline finalStatus={finalStatus} payment={flow.payment} />
              <FinalSummary flow={flow} finalStatus={finalStatus} />
              <div className="next-actions">
                <a href={flow.orderId && flow.accessToken ? `/lab/photo-upload?orderId=${flow.orderId}&accessToken=${flow.accessToken}` : "/lab/photo-upload"}>시공 사진 보기</a>
                <a href="/lab/admin">관리자 확인</a>
              </div>
            </ScreenBlock>
          )}
        </section>

        <section className="support-panel">
          <details>
            <summary>현재 검증 상태 보기</summary>
            <KeyValue label="선택 서비스" value={selectedItem?.display_name ?? "-"} />
            <KeyValue label="예약 시간대" value={timeSlotLabels[reservation.time_slot]} />
            <KeyValue label="주문번호" value={flow.orderNumber || "-"} />
            <KeyValue label="총 금액" value={flow.totalAmount ? `${flow.totalAmount.toLocaleString()}원` : "-"} />
            <div className="friendly-status">{loading ? "처리 중입니다. 잠시만 기다려 주세요." : message}</div>
          </details>
          <details>
            <summary>API 원문 응답</summary>
            <div className="raw-list">
              {responses.map((response, index) => (
                <details key={`${response.label}-${index}`} open={index === 0}>
                  <summary>{response.label}</summary>
                  <pre>{JSON.stringify(response.json, null, 2)}</pre>
                </details>
              ))}
            </div>
          </details>
        </section>

        <footer className="sticky-cta">
          <button type="button" className="ghost-cta" onClick={goPrev} disabled={step === 0 || loading}>이전</button>
          <button type="button" className="primary-cta" disabled={primaryDisabled()} onClick={() => void runPrimaryAction()}>
            {primaryCtaLabel()} →
          </button>
        </footer>
      </section>
    </main>
  );
}

function categoryLabel(category?: string) {
  return categoryLabels[category ?? "service"] ?? category ?? "서비스";
}

function serviceImage(code: string, index = 0) {
  const images = imageSets[code] ?? imageSets.bathroom_basic;
  return images[index % images.length];
}

function parseReservationDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date("2026-05-24T00:00:00") : parsed;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatReservationDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const days: Array<{ key: string; label: string; date: string | null }> = [];

  for (let blank = 0; blank < firstDay.getDay(); blank += 1) {
    days.push({ key: `blank-${blank}`, label: "", date: null });
  }

  for (let day = 1; day <= lastDate; day += 1) {
    const date = formatReservationDate(new Date(year, month, day));
    days.push({ key: date, label: `${day}`, date });
  }

  return days;
}

function isCalendarDateUnavailable(date: string) {
  const parsed = parseReservationDate(date);
  const beforeOpenDate = date < "2026-05-08";
  const sunday = parsed.getDay() === 0;
  return beforeOpenDate || sunday;
}

function availableSlotsForDate(date: string): ReservationForm["time_slot"][] {
  if (isCalendarDateUnavailable(date)) return [];
  return ["morning", "afternoon", "all_day"];
}

function formatKoreanDate(date: string) {
  const parsed = parseReservationDate(date);
  return `${parsed.getMonth() + 1}월 ${parsed.getDate()}일`;
}

function buildExtraAddress(data: KakaoPostcodeData) {
  if (data.userSelectedType !== "R") return "";

  const extraParts: string[] = [];
  if (data.bname && /[동로가]$/.test(data.bname)) extraParts.push(data.bname);
  if (data.buildingName && data.apartment === "Y") extraParts.push(data.buildingName);

  return extraParts.length > 0 ? `(${extraParts.join(", ")})` : "";
}

function serviceCodeLabel(code: string) {
  return serviceCodeLabels[code] ?? code;
}

function statusLabel(status?: string) {
  if (!status) return "-";
  return statusLabels[status] ?? status;
}

function Progress({ current }: { current: number }) {
  const stages = ["선택", "견적", "정보", "예약", "결제"];
  const active = current <= 1 ? 0 : current <= 3 ? 1 : current === 4 ? 2 : current === 5 ? 3 : 4;

  return (
    <nav className="progress" aria-label="주문 진행 단계">
      {stages.map((stage, index) => (
        <span key={stage} className={index <= active ? "progress-step active" : "progress-step"}>
          {stage}
        </span>
      ))}
    </nav>
  );
}

function ScreenBlock({ eyebrow, title, desc, children }: { eyebrow: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <article className="screen-block">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{desc}</p>
      {children}
    </article>
  );
}

function StatusTimeline({ finalStatus, payment }: { finalStatus: { status?: string } | undefined; payment?: Record<string, unknown> }) {
  const done = Boolean(payment) || finalStatus?.status === "completed";
  const stages = ["접수", "예약", "결제", "시공", "완료"];

  return (
    <div className="timeline">
      {stages.map((stage, index) => (
        <span key={stage} className={index < (done ? 3 : 2) ? "timeline-step active" : "timeline-step"}>
          {stage}
        </span>
      ))}
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <nav style={stepperStyle}>
      {steps.map((label, index) => (
        <div key={label} style={index === current ? activeStepStyle : stepStyle}>
          <span>{index + 1}</span>
          <b>{label}</b>
        </div>
      ))}
    </nav>
  );
}

function StepCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={cardStyle}>
      <h2 style={cardTitleStyle}>{title}</h2>
      <div style={{ display: "grid", gap: 14 }}>{children}</div>
    </section>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <div>{label}</div>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div style={keyValueStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FinalSummary({
  flow,
  finalStatus
}: {
  flow: FlowState;
  finalStatus:
    | {
        status?: string;
        total_amount?: number;
        jobs?: { status?: string };
        reservations?: Array<{ status?: string }>;
        payments?: Array<{ status?: string }>;
      }
    | undefined;
}) {
  return (
    <div style={finalGridStyle}>
      <KeyValue label="주문 ID" value={flow.orderId || "-"} />
      <KeyValue label="주문번호" value={flow.orderNumber || "-"} />
      <KeyValue label="주문 상태" value={statusLabel(finalStatus?.status)} />
      <KeyValue label="작업 상태" value={statusLabel(finalStatus?.jobs?.status)} />
      <KeyValue label="결제 상태" value={statusLabel(finalStatus?.payments?.[0]?.status)} />
      <KeyValue label="예약 상태" value={statusLabel(finalStatus?.reservations?.[0]?.status)} />
      <KeyValue label="총 결제금액" value={`${Number(finalStatus?.total_amount ?? flow.totalAmount ?? 0).toLocaleString()}원`} />
    </div>
  );
}

const flowCss = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b0b0b; }
  .flow-app {
    min-height: 100vh;
    padding: 18px 12px 32px;
    background: radial-gradient(circle at top, #29231a 0, #0b0b0b 38%);
    color: #1c1b18;
    font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", sans-serif;
  }
  .phone-shell {
    width: min(100%, 520px);
    min-height: calc(100vh - 36px);
    margin: 0 auto;
    background: #fffdf7;
    border: 1px solid #332d23;
    border-radius: 28px;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(0,0,0,.36);
    position: relative;
    padding-bottom: 96px;
  }
  .app-top {
    min-height: 64px;
    display: grid;
    grid-template-columns: 48px 1fr 48px;
    gap: 8px;
    align-items: center;
    padding: 12px 14px;
    background: #ffd166;
    color: #20180b;
    text-align: center;
    position: sticky;
    top: 0;
    z-index: 4;
  }
  .app-top span { display: block; font-size: 12px; font-weight: 800; opacity: .78; }
  .app-top strong { display: block; font-size: 18px; }
  .icon-button {
    min-height: 40px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 12px;
    background: rgba(255,255,255,.58);
    color: #1c1b18;
    text-decoration: none;
    font-weight: 900;
    font-size: 14px;
  }
  .icon-button:disabled { opacity: .35; }
  .progress {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    padding: 12px 14px;
    background: #fff7df;
    border-bottom: 1px solid #f2dfae;
  }
  .progress-step {
    min-height: 30px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: #eee9dd;
    color: #817660;
    font-size: 12px;
    font-weight: 800;
  }
  .progress-step.active { background: #20180b; color: #ffd166; }
  .screen { padding: 16px 14px 8px; }
  .screen-block { display: grid; gap: 14px; }
  .screen-block h1 {
    margin: 0;
    font-size: 25px;
    line-height: 1.22;
    letter-spacing: 0;
    color: #1f1d18;
  }
  .screen-block p {
    margin: -6px 0 0;
    color: #6b6254;
    font-size: 16px;
    line-height: 1.55;
  }
  .eyebrow { color: #a66f00; font-size: 13px; font-weight: 900; }
  .hero-photo {
    min-height: 210px;
    border-radius: 18px;
    background-size: cover;
    background-position: center;
    overflow: hidden;
    display: flex;
    align-items: flex-end;
    padding: 14px;
  }
  .hero-photo span {
    border-radius: 999px;
    padding: 8px 12px;
    background: rgba(255,255,255,.9);
    font-weight: 900;
  }
  .sku-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .mini-sku, .sku-card {
    border: 1px solid #eee1bd;
    background: #fff;
    border-radius: 16px;
    padding: 10px;
    text-align: left;
    color: #1f1d18;
    cursor: pointer;
  }
  .mini-sku { display: grid; gap: 8px; min-height: 154px; }
  .mini-sku strong, .sku-card b { font-size: 16px; }
  .mini-sku span:last-child, .sku-card small { color: #766d5f; font-size: 13px; }
  .sku-image, .sku-thumb {
    display: block;
    background-size: cover;
    background-position: center;
    background-color: #e8e1d3;
  }
  .sku-image { height: 78px; border-radius: 12px; }
  .sku-thumb { width: 74px; height: 74px; border-radius: 14px; flex: 0 0 auto; }
  .review-strip, .saving-box, .total-box, .pay-box, .friendly-status {
    border-radius: 16px;
    background: #fff4cf;
    padding: 14px;
    color: #342813;
  }
  .review-strip { display: grid; gap: 4px; font-size: 15px; }
  .chip-row { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
  .chip {
    min-height: 42px;
    padding: 0 15px;
    border: 1px solid #ead7a7;
    border-radius: 999px;
    background: #fff;
    font-weight: 900;
    color: #5e5445;
    white-space: nowrap;
  }
  .chip.active { background: #1f1d18; color: #ffd166; border-color: #1f1d18; }
  .sku-list, .cart-list, .form-list { display: grid; gap: 10px; }
  .sku-card {
    width: 100%;
    display: grid;
    grid-template-columns: 74px 1fr auto;
    gap: 12px;
    align-items: center;
    min-height: 98px;
  }
  .sku-card.selected { border-color: #d99a00; box-shadow: 0 0 0 3px #ffe8a3; }
  .sku-card span:not(.sku-thumb) { display: grid; gap: 4px; }
  .image-slider {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 78%;
    gap: 10px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }
  .image-slider span {
    height: 230px;
    border-radius: 18px;
    background-size: cover;
    background-position: center;
    scroll-snap-align: start;
  }
  .option-box {
    display: grid;
    gap: 10px;
    border: 1px solid #eee1bd;
    border-radius: 16px;
    background: #fff;
    padding: 14px;
  }
  .option-box label, .agree-row {
    min-height: 38px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
  }
  input[type="radio"], input[type="checkbox"] { width: 20px; height: 20px; accent-color: #d99a00; }
  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .cart-row {
    display: grid;
    grid-template-columns: 74px 1fr auto;
    gap: 12px;
    align-items: center;
    border: 1px solid #eee1bd;
    border-radius: 16px;
    background: #fff;
    padding: 10px;
  }
  .cart-row.compact { grid-template-columns: 1fr auto; min-height: 52px; }
  .cart-row span:not(.sku-thumb) { display: grid; gap: 4px; }
  .cart-row small { color: #766d5f; }
  .total-box { display: flex; justify-content: space-between; align-items: center; font-size: 17px; }
  .total-box strong, .pay-box strong { font-size: 26px; }
  .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .photo-grid button {
    min-height: 104px;
    border: 1px dashed #d7bd79;
    border-radius: 16px;
    background: #fff9e8;
    color: #7a5b0c;
    font-weight: 900;
  }
  .planned-button {
    min-height: 48px;
    border: 1px solid #eee1bd;
    border-radius: 14px;
    background: #fff;
    color: #7a5b0c;
    font-weight: 900;
  }
  .planned-button:disabled { opacity: 0.7; }
  .postcode-panel {
    display: none;
    overflow: hidden;
    border: 1px solid #ead7a7;
    border-radius: 18px;
    background: #fff;
  }
  .postcode-panel.open {
    display: grid;
    grid-template-rows: auto 1fr;
  }
  .postcode-panel-head {
    min-height: 48px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid #f0dfb3;
    background: #fff9e8;
    padding: 8px 12px;
  }
  .postcode-panel-head strong {
    color: #1f1d18;
    font-size: 16px;
  }
  .postcode-panel-head button {
    min-height: 34px;
    border: 1px solid #d7bd79;
    border-radius: 999px;
    background: #fff;
    color: #7a5b0c;
    padding: 0 12px;
    font-weight: 900;
  }
  .postcode-embed {
    min-height: 420px;
    height: 420px;
  }
  .form-list label { display: grid; gap: 6px; color: #4f4638; font-weight: 800; }
  .form-list label div, .form-list label span { font-size: 14px; }
  .form-list input, .form-list select, label select {
    width: 100%;
    min-height: 54px;
    border: 1px solid #ead7a7;
    border-radius: 14px;
    background: #fff;
    color: #1f1d18;
    padding: 0 14px;
    font-size: 16px;
  }
  .calendar-card {
    display: grid;
    gap: 10px;
    border: 1px solid #eee1bd;
    border-radius: 18px;
    background: #fffdf6;
    padding: 14px;
  }
  .calendar-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .calendar-head strong { font-size: 18px; }
  .calendar-head span { color: #7a5b0c; font-size: 14px; font-weight: 900; }
  .calendar-week, .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
  }
  .calendar-week span {
    min-height: 28px;
    display: grid;
    place-items: center;
    color: #7b7162;
    font-size: 13px;
    font-weight: 900;
  }
  .calendar-day {
    aspect-ratio: 1;
    min-height: 42px;
    border: 1px solid #ead7a7;
    border-radius: 12px;
    background: #fff;
    color: #1f1d18;
    font-size: 15px;
    font-weight: 900;
  }
  .calendar-day.selected {
    border-color: #1f1d18;
    background: #ffd166;
    color: #1f1d18;
  }
  .calendar-day.disabled {
    border-color: #eee7d8;
    background: #f3f0e9;
    color: #b8ad9b;
  }
  .slot-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .slot {
    min-height: 66px;
    display: grid;
    place-items: center;
    gap: 2px;
    border: 1px solid #ead7a7;
    border-radius: 16px;
    background: #fff;
    color: #1f1d18;
    font-weight: 900;
  }
  .slot span { color: #6b6254; font-size: 13px; font-weight: 800; }
  .slot.active { background: #d7f1d9; border-color: #70b779; }
  .slot.disabled { background: #eee; color: #aaa; }
  .slot.disabled span { color: #aaa; }
  .reservation-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    border-radius: 16px;
    background: #1f1d18;
    color: #fff5db;
    padding: 14px 16px;
  }
  .reservation-summary span { color: #ffd166; font-weight: 900; }
  .reservation-summary strong { font-size: 18px; }
  .pay-box { display: grid; gap: 8px; }
  .pay-box small { color: #6b6254; font-size: 14px; }
  .timeline {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }
  .timeline-step {
    min-height: 44px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    background: #eee9dd;
    color: #7b7162;
    font-weight: 900;
    font-size: 13px;
  }
  .timeline-step.active { background: #d7f1d9; color: #276a32; }
  .next-actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .next-actions a {
    min-height: 50px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    background: #1f1d18;
    color: #ffd166;
    text-decoration: none;
    font-weight: 900;
  }
  .support-panel {
    display: grid;
    gap: 8px;
    padding: 10px 14px 14px;
    color: #1f1d18;
  }
  .support-panel > details {
    border: 1px solid #eee1bd;
    border-radius: 16px;
    background: #fff;
    padding: 12px;
  }
  .support-panel summary { cursor: pointer; font-weight: 900; }
  .raw-list { display: grid; gap: 8px; margin-top: 10px; }
  .raw-list pre {
    overflow-x: auto;
    border-radius: 12px;
    background: #1f1d18;
    color: #fff7df;
    padding: 12px;
    font-size: 12px;
  }
  .sticky-cta {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: 86px 1fr;
    gap: 8px;
    padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
    background: rgba(255,253,247,.94);
    border-top: 1px solid #eee1bd;
    backdrop-filter: blur(14px);
  }
  .primary-cta, .ghost-cta {
    min-height: 58px;
    border: 0;
    border-radius: 16px;
    font-size: 16px;
    font-weight: 900;
  }
  .primary-cta { background: #ffd166; color: #1f1d18; }
  .ghost-cta { background: #f2ead8; color: #6b6254; }
  .primary-cta:disabled, .ghost-cta:disabled { opacity: .45; }
  @media (min-width: 900px) {
    .flow-app { padding: 32px; }
    .phone-shell {
      width: min(100%, 1180px);
      min-height: calc(100vh - 64px);
      border-radius: 24px;
      padding-bottom: 102px;
    }
    .app-top {
      grid-template-columns: 56px 1fr 72px;
      padding: 16px 24px;
      text-align: left;
    }
    .app-top div { text-align: center; }
    .progress { padding: 16px 24px; }
    .screen { padding: 28px 28px 14px; }
    .screen-block {
      grid-template-columns: minmax(0, 1.05fr) minmax(360px, .95fr);
      align-items: start;
      column-gap: 24px;
    }
    .screen-block > .eyebrow,
    .screen-block > h1,
    .screen-block > p {
      grid-column: 1 / -1;
      max-width: 760px;
    }
    .screen-block h1 { font-size: 34px; }
    .hero-photo {
      min-height: 420px;
      grid-row: span 3;
    }
    .home-skus { grid-template-columns: repeat(3, 1fr); }
    .review-strip { align-self: start; }
    .sku-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .image-slider {
      grid-auto-flow: initial;
      grid-template-columns: 1.4fr 1fr;
      grid-auto-columns: initial;
      overflow: visible;
    }
    .image-slider span { height: 220px; }
    .image-slider span:first-child {
      grid-row: span 2;
      height: 450px;
    }
    .option-box,
    .info-grid,
    .cart-list,
    .saving-box,
    .total-box,
    .photo-grid,
    .planned-button,
    .form-list,
    .slot-grid,
    .pay-box,
    .agree-row,
    .timeline,
    .next-actions,
    .final-grid {
      align-self: start;
    }
    .photo-grid { grid-template-columns: repeat(3, 1fr); }
    .photo-grid button { min-height: 150px; }
    .form-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .support-panel {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      padding: 12px 28px 18px;
    }
    .sticky-cta {
      grid-template-columns: 120px minmax(240px, 420px);
      justify-content: end;
      padding: 16px 28px;
    }
  }

  /* Web-first layout. The earlier rules keep the mobile details; these make desktop the primary surface. */
  .flow-app {
    padding: 28px;
    background: #f5efe3;
  }
  .phone-shell {
    width: min(100%, 1200px);
    min-height: auto;
    margin: 0 auto;
    padding-bottom: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    overflow: visible;
  }
  .app-top {
    position: sticky;
    top: 16px;
    z-index: 8;
    grid-template-columns: 56px 1fr 76px;
    min-height: 76px;
    margin-bottom: 18px;
    padding: 16px 22px;
    border-radius: 18px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(73, 50, 7, .12);
  }
  .app-top strong { font-size: 22px; }
  .progress {
    margin-bottom: 18px;
    padding: 14px;
    border: 1px solid #ead7a7;
    border-radius: 18px;
    background: #fffdf7;
  }
  .progress-step { min-height: 38px; font-size: 14px; }
  .screen {
    padding: 34px;
    border: 1px solid #ead7a7;
    border-radius: 22px;
    background: #fffdf7;
    box-shadow: 0 18px 50px rgba(73, 50, 7, .08);
  }
  .screen-block {
    grid-template-columns: minmax(0, 1.08fr) minmax(360px, .92fr);
    align-items: start;
    column-gap: 28px;
    row-gap: 18px;
  }
  .screen-block > .eyebrow,
  .screen-block > h1,
  .screen-block > p {
    grid-column: 1 / -1;
    max-width: 780px;
  }
  .screen-block h1 { font-size: 36px; }
  .hero-photo {
    min-height: 430px;
    grid-row: span 3;
  }
  .home-skus { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .mini-sku { min-height: 188px; }
  .sku-image { height: 106px; }
  .review-strip { align-self: start; font-size: 16px; }
  .sku-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .image-slider {
    grid-auto-flow: initial;
    grid-template-columns: 1.35fr 1fr;
    grid-auto-columns: initial;
    overflow: visible;
  }
  .image-slider span { height: 220px; }
  .image-slider span:first-child {
    grid-row: span 2;
    height: 456px;
  }
  .form-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .photo-grid button { min-height: 150px; }
  .support-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 18px 0 0;
  }
  .sticky-cta {
    position: sticky;
    left: auto;
    right: auto;
    bottom: 18px;
    width: min(100%, 1200px);
    margin: 18px auto 0;
    grid-template-columns: 120px minmax(240px, 430px);
    justify-content: end;
    padding: 14px;
    border: 1px solid #ead7a7;
    border-radius: 18px;
    background: rgba(255, 253, 247, .94);
    box-shadow: 0 18px 46px rgba(73, 50, 7, .12);
  }

  @media (max-width: 760px) {
    .flow-app {
      padding: 0;
      background: #fffdf7;
    }
    .phone-shell {
      width: 100%;
      min-height: 100vh;
      background: #fffdf7;
    }
    .app-top {
      top: 0;
      grid-template-columns: 48px 1fr 48px;
      min-height: 64px;
      margin-bottom: 0;
      padding: 12px 14px;
      border-radius: 0;
      box-shadow: none;
    }
    .app-top strong { font-size: 18px; }
    .progress {
      margin-bottom: 0;
      padding: 12px 14px;
      border-width: 0 0 1px;
      border-radius: 0;
    }
    .progress-step {
      min-height: 30px;
      font-size: 12px;
    }
    .screen {
      padding: 16px 14px 8px;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }
    .screen-block {
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .screen-block > .eyebrow,
    .screen-block > h1,
    .screen-block > p {
      grid-column: auto;
    }
    .screen-block h1 { font-size: 25px; }
    .hero-photo {
      min-height: 210px;
      grid-row: auto;
    }
    .home-skus { grid-template-columns: repeat(2, 1fr); }
    .mini-sku { min-height: 154px; }
    .sku-image { height: 78px; }
    .sku-list { grid-template-columns: 1fr; }
    .image-slider {
      grid-auto-flow: column;
      grid-auto-columns: 78%;
      grid-template-columns: none;
      overflow-x: auto;
    }
    .image-slider span,
    .image-slider span:first-child {
      height: 230px;
      grid-row: auto;
    }
    .form-list { grid-template-columns: 1fr; }
    .photo-grid button { min-height: 104px; }
    .support-panel {
      grid-template-columns: 1fr;
      padding: 10px 14px 14px;
    }
    .sticky-cta {
      position: sticky;
      bottom: 0;
      width: 100%;
      margin: 0;
      grid-template-columns: 86px 1fr;
      padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
      border-width: 1px 0 0;
      border-radius: 0;
    }
  }
`;

const pageStyle = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: 20,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", sans-serif',
  color: "#e8e8e8",
  background: "#0a0a0a",
  minHeight: "100vh"
};
const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18,
  padding: "32px 28px",
  background: "linear-gradient(135deg, #ffd166 0%, #f4a261 55%, #fae100 100%)",
  color: "#1a1a1a",
  borderRadius: 20
};
const badgeStyle = {
  display: "inline-block",
  background: "#1a1a1a",
  color: "#ffd166",
  padding: "6px 12px",
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 14
};
const titleStyle = { fontSize: 34, lineHeight: 1.18, margin: "0 0 10px", fontWeight: 900 };
const mutedStyle = { color: "#2c2412", margin: 0, fontSize: 16, fontWeight: 700 };
const stepperStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 18 };
const stepStyle = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#2a2a2a",
  padding: 10,
  background: "#1a1a1a",
  display: "grid",
  gap: 4,
  color: "#aaa",
  borderRadius: 8
};
const activeStepStyle = { ...stepStyle, borderColor: "#ffd166", background: "#2a2400", color: "#fff" };
const layoutStyle = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 18 };
const mainPanelStyle = { minWidth: 0 };
const sidePanelStyle = { border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, alignSelf: "start", background: "#1a1a1a" };
const sideTitleStyle = { fontSize: 18, margin: "0 0 12px", color: "#ffd166" };
const cardStyle = { border: "1px solid #2a2a2a", borderRadius: 8, padding: 18, background: "#1a1a1a" };
const cardTitleStyle = { fontSize: 22, margin: "0 0 14px", color: "#fff" };
const startPanelStyle = {
  display: "grid",
  gap: 6,
  background: "#0f0f0f",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
  padding: 16,
  color: "#ddd"
};
const serviceGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 };
const serviceButtonStyle = {
  minHeight: 118,
  padding: 14,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#2a2a2a",
  background: "#0f0f0f",
  color: "#e8e8e8",
  borderRadius: 8,
  textAlign: "left" as const,
  display: "grid",
  gap: 6,
  cursor: "pointer"
};
const selectedServiceStyle = { ...serviceButtonStyle, borderColor: "#ffd166", background: "#2a2400" };
const serviceCategoryStyle = { color: "#ffd166", fontSize: 12, fontWeight: 800 };
const photoPlaceholderGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 };
const photoPlaceholderStyle = {
  minHeight: 92,
  display: "grid",
  placeItems: "center",
  background: "#0f0f0f",
  border: "1px dashed #4a4a4a",
  borderRadius: 8,
  color: "#aaa"
};
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
const inputStyle = {
  width: "100%",
  minHeight: 46,
  padding: "10px 12px",
  border: "1px solid #3a3a3a",
  borderRadius: 8,
  background: "#0f0f0f",
  color: "#fff",
  boxSizing: "border-box" as const,
  fontSize: 16
};
const buttonStyle = { minHeight: 56, border: 0, borderRadius: 8, background: "#ffd166", color: "#1a1a1a", cursor: "pointer", padding: "0 18px", fontWeight: 800, fontSize: 16 };
const secondaryButtonStyle = { ...buttonStyle, background: "#2a2a2a", color: "#fff", border: "1px solid #444" };
const linkButtonStyle = { ...buttonStyle, display: "grid", placeItems: "center", textDecoration: "none" };
const navStyle = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 14,
  gap: 8,
  position: "sticky" as const,
  bottom: 12,
  padding: 10,
  background: "rgba(10,10,10,0.86)",
  backdropFilter: "blur(10px)",
  border: "1px solid #2a2a2a",
  borderRadius: 12
};
const buttonRowStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 };
const keyValueStyle = { display: "grid", gap: 4, padding: "10px 0", borderBottom: "1px solid #2a2a2a", wordBreak: "break-all" as const };
const resultGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 };
const finalGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 };
const statusBoxStyle = { marginTop: 12, padding: 12, background: "#0f0f0f", border: "1px solid #6bff8e", borderRadius: 8, color: "#d9ffe2" };
const rawPanelStyle = { marginTop: 18, border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, background: "#1a1a1a" };
const preStyle = { overflowX: "auto" as const, padding: 12, background: "#0a0a0a", color: "#f8f8f8", fontSize: 12, borderRadius: 8 };
const smallLinkStyle = { border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 12px", color: "#1a1a1a", textDecoration: "none", fontWeight: 800 };
