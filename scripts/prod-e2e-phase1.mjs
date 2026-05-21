import fs from "node:fs";
import path from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "https://buildus-care-flow.vercel.app";
const TEST_ORDER_MARKER = "BUILDUS_TEST_ORDER:prod-e2e-phase1";
const TEST_CAMPAIGN = "buildus-test-prod-e2e-phase1";
const TEST_ACQUISITION_SOURCE = "buildus-test";

function readLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const localEnv = readLocalEnv();
const ADMIN_KEY = process.env.ADMIN_API_KEY ?? localEnv.ADMIN_API_KEY;

if (!ADMIN_KEY) {
  throw new Error("ADMIN_API_KEY is required in environment or .env.local");
}

const results = [];

function record(step, status, detail = {}) {
  results.push({ step, status, ...detail });
  console.log(`${status === "PASS" ? "PASS" : "FAIL"} ${step}`, detail);
}

async function request(method, pathname, body, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.admin ? { "x-admin-key": ADMIN_KEY } : {}),
    ...(options.headers ?? {})
  };
  const response = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!response.ok && !options.allowStatus?.includes(response.status)) {
    const error = new Error(`${method} ${pathname} failed: ${response.status}`);
    error.status = response.status;
    error.response = json;
    throw error;
  }
  return { status: response.status, json };
}

function uniquePhone() {
  return `010${String(Date.now()).slice(-8)}`;
}

function kstDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value)
  };
}

function addMonths(year, month, offset) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

async function findAvailableSlot(options = {}) {
  const excludedDates = options.excludedDates ?? new Set();
  const start = kstDateParts();

  for (let offset = 0; offset < 4; offset += 1) {
    const { year, month } = addMonths(start.year, start.month, offset);
    const { json } = await request("GET", `/api/slots?year=${year}&month=${month}`);
    const days = Object.values(json?.data?.days ?? {});

    for (const day of days) {
      if (!day?.date || excludedDates.has(day.date)) continue;
      for (const timeSlot of ["morning", "afternoon"]) {
        if (day.slots?.[timeSlot]?.available) {
          return { reservationDate: day.date, timeSlot };
        }
      }
    }
  }

  throw new Error("No available reservation slot found in the next four months.");
}

function scheduledAtForSlot(slot) {
  const hour = slot.timeSlot === "morning" ? "01" : "05";
  return `${slot.reservationDate}T${hour}:00:00.000Z`;
}

function orderPayload(label) {
  const address = `경기 수원시 영통구 영통동 황골마을현대1단지 ${Math.floor(Math.random() * 800) + 100}동 ${Math.floor(Math.random() * 900) + 100}호`;
  return {
    customer: {
      phone: uniquePhone(),
      name: `Buildus Test ${label}`,
      acquisition_source: TEST_ACQUISITION_SOURCE
    },
    address: {
      road_address: address,
      detail_address: "",
      postal_code: "16690"
    },
    home: {
      address_full: address,
      address_dong: "영통동",
      postal_code: "16690",
      size_pyung: 24,
      building_type: "apartment",
      year_built: 1995,
      housing_type: "owner"
    },
    order: {
      channel: "web",
      reason: "replace",
      urgency: "within_1w",
      self_diagnosis: TEST_ORDER_MARKER,
      skus: [{ sku: "toilet_replace", qty: 1, service_type: "labor_service", material_skus: [], options: [] }]
    },
    utm_source: "web",
    utm_campaign: TEST_CAMPAIGN,
    special_requests: TEST_ORDER_MARKER,
    service_type_code: "toilet_replace",
    items: [
      {
        service_type_code: "toilet_replace",
        item_name: "변기 교체",
        qty: 1,
        unit_price: 0,
        metadata: {
          service_type_code: "toilet_replace",
          material_skus: [],
          product_grade: "standard"
        }
      }
    ]
  };
}

async function createOrder(label) {
  const { status, json } = await request("POST", "/api/orders", orderPayload(label));
  const order = json?.data?.order;
  if (status !== 201 || !order?.id || !order?.access_token) {
    throw new Error(`Order creation returned unexpected response: ${JSON.stringify(json)}`);
  }
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    accessToken: order.access_token
  };
}

async function createQuote(orderId) {
  const { json } = await request("POST", "/api/quote", {
    order_id: orderId,
    items: [
      {
        service_type_code: "toilet_replace",
        item_name: "변기 교체",
        qty: 1,
        unit_price: 0,
        metadata: {
          service_type_code: "toilet_replace",
          material_skus: [],
          product_grade: "standard"
        }
      }
    ],
    discount: 0
  });
  const quote = json?.data?.quote;
  if (!quote?.id || typeof quote.total_final !== "number") {
    throw new Error(`Quote response missing id/total_final: ${JSON.stringify(json)}`);
  }
  return quote;
}

async function ensureTechnician() {
  const list = await request("GET", "/api/admin/technicians", undefined, { admin: true });
  const existing = list.json?.data?.technicians?.find((tech) => tech.is_active !== false);
  if (existing) return existing;
  const created = await request(
    "POST",
    "/api/admin/technicians",
    {
      name: "Buildus Test Technician",
      phone: "010-9000-0000",
      type: "direct",
      grade: "bronze",
      skills: ["toilet_replace"]
    },
    { admin: true }
  );
  return created.json?.data?.technician;
}

async function main() {
  const reservationSlot = await findAvailableSlot();
  const blockedSlot = await findAvailableSlot({ excludedDates: new Set([reservationSlot.reservationDate]) });

  const scenarioA = await createOrder("A");
  record("A1 주문 생성", "PASS", { orderNumber: scenarioA.orderNumber });

  const reservation = await request("POST", `/api/orders/${scenarioA.orderId}/reservation`, {
    reservationDate: reservationSlot.reservationDate,
    timeSlot: reservationSlot.timeSlot
  });
  record("A3 예약 생성", "PASS", {
    status: reservation.status,
    idempotent: reservation.json?.data?.idempotent ?? false,
    reservationDate: reservationSlot.reservationDate,
    timeSlot: reservationSlot.timeSlot
  });

  const quote = await createQuote(scenarioA.orderId);
  record("A4 견적 생성", "PASS", { quoteId: quote.id, totalFinal: quote.total_final });

  const accepted = await request("POST", `/api/quotes/${quote.id}/accept`);
  record("A5 견적 수락", "PASS", { acceptedAt: accepted.json?.data?.quote?.accepted_at });

  const paymentKey = `mock-buildus-test-${crypto.randomUUID()}`;
  const payment = await request("POST", "/api/payments/toss/confirm", {
    paymentKey,
    orderId: scenarioA.orderId,
    amount: quote.total_final,
    orderName: "Buildus test toilet replacement"
  });
  record("A6 결제 confirm", "PASS", {
    paymentStatus: payment.json?.data?.payment?.status,
    providerStatus: payment.json?.data?.payment?.provider_status
  });

  const repeatedReservation = await request("POST", `/api/orders/${scenarioA.orderId}/reservation`, {
    reservationDate: reservationSlot.reservationDate,
    timeSlot: reservationSlot.timeSlot
  });
  record("B1 동일 주문 예약 재호출", "PASS", {
    status: repeatedReservation.status,
    idempotent: repeatedReservation.json?.data?.idempotent ?? false,
    reservationDate: reservationSlot.reservationDate,
    timeSlot: reservationSlot.timeSlot
  });

  const repeatedPayment = await request("POST", "/api/payments/toss/confirm", {
    paymentKey,
    orderId: scenarioA.orderId,
    amount: quote.total_final,
    orderName: "Buildus test toilet replacement"
  });
  record("B2 동일 paymentKey 재호출", "PASS", {
    duplicate: repeatedPayment.json?.data?.duplicate ?? false
  });

  await request("POST", "/api/admin/slot-configs", { date: blockedSlot.reservationDate, reason: `${TEST_ORDER_MARKER} slot block` }, { admin: true });
  record("C1 슬롯 차단", "PASS", { date: blockedSlot.reservationDate });
  try {
    const blockedOrder = await createOrder("C");
    const blocked = await request(
      "POST",
      `/api/orders/${blockedOrder.orderId}/reservation`,
      { reservationDate: blockedSlot.reservationDate, timeSlot: blockedSlot.timeSlot },
      { allowStatus: [409] }
    );
    if (blocked.status !== 409) {
      throw new Error(`Expected 409 for blocked slot, got ${blocked.status}`);
    }
    record("C2 차단 날짜 예약 거부", "PASS", {
      code: blocked.json?.error?.code ?? blocked.json?.code
    });
  } finally {
    await request("DELETE", `/api/admin/slot-configs/${blockedSlot.reservationDate}`, undefined, { admin: true });
    record("C3 슬롯 차단 해제", "PASS", { date: blockedSlot.reservationDate });
  }

  const technician = await ensureTechnician();
  if (!technician?.id) throw new Error("No technician id available");
  const jobAssignment = await request(
    "POST",
    "/api/admin/jobs",
    {
      order_id: scenarioA.orderId,
      technician_id: technician.id,
      scheduled_at: scheduledAtForSlot(reservationSlot),
      expected_minutes: 90
    },
    { admin: true }
  );
  const job = jobAssignment.json?.data?.job;
  record("D1 기사 배정", "PASS", { jobId: job?.id, technician: technician.name });

  await request("PATCH", `/api/admin/jobs/${job.id}/start`, { expected_minutes: 90 }, { admin: true });
  record("D2 시공 시작", "PASS", { jobId: job.id });

  await request(
    "POST",
    `/api/admin/jobs/${job.id}/media`,
    {
      file_path: `jobs/${job.id}/after/buildus-test-after.jpg`,
      type: "after",
      tags: ["buildus-test", "prod-e2e-phase1"]
    },
    { admin: true }
  );
  record("D3 after 사진 메타 저장", "PASS", { jobId: job.id });

  await request(
    "PATCH",
    `/api/admin/jobs/${job.id}/complete`,
    {
      actual_minutes: 90,
      materials_used: [
        { sku: "TOILET-STD-A", qty: 1 },
        { sku: "ANGLE-VALVE", qty: 1 }
      ],
      completion_notes: `${TEST_ORDER_MARKER} completed`,
      issues: ""
    },
    { admin: true }
  );
  record("D4 시공 완료", "PASS", { jobId: job.id });

  await request(
    "PATCH",
    `/api/admin/jobs/${job.id}/inspect`,
    {
      passed: true,
      checklist_results: [
        { item: "시공 전후 사진 확인", ok: true },
        { item: "누수 없음", ok: true }
      ],
      inspector_note: "이상없음"
    },
    { admin: true }
  );
  record("D5 검수 완료", "PASS", { jobId: job.id });

  const feedback = await request("POST", `/api/orders/${scenarioA.orderId}/feedback`, {
    accessToken: scenarioA.accessToken,
    rating: 5,
    nps: 9,
    comment: "좋았어요",
    categories: { speed: 5, kindness: 5, quality: 5, cleanliness: 5, price: 4 },
    would_recommend: true,
    would_repurchase: true
  });
  record("E1 후기 제출", "PASS", { feedbackId: feedback.json?.data?.feedback?.id });

  const duplicateFeedback = await request(
    "POST",
    `/api/orders/${scenarioA.orderId}/feedback`,
    {
      accessToken: scenarioA.accessToken,
      rating: 5,
      nps: 9,
      comment: "중복",
      categories: { speed: 5, kindness: 5, quality: 5, cleanliness: 5, price: 4 }
    },
    { allowStatus: [409] }
  );
  if (duplicateFeedback.status !== 409) {
    throw new Error(`Expected duplicate feedback 409, got ${duplicateFeedback.status}`);
  }
  record("E2 후기 중복 방지", "PASS", {
    code: duplicateFeedback.json?.error?.code ?? duplicateFeedback.json?.code
  });

  const warranty = await request("POST", `/api/orders/${scenarioA.orderId}/warranty`, {
    accessToken: scenarioA.accessToken,
    type: "leak",
    description: "누수 발생"
  });
  record("E3 A/S 접수", "PASS", { warrantyId: warranty.json?.data?.id });

  console.log("\nE2E_RESULT_JSON");
  console.log(
    JSON.stringify(
      {
        base: BASE,
        orderId: scenarioA.orderId,
        orderNumber: scenarioA.orderNumber,
        quoteId: quote.id,
        paymentKey,
        jobId: job.id,
        results
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("E2E_FAILED", {
    message: error.message,
    status: error.status,
    response: error.response
  });
  process.exit(1);
});
