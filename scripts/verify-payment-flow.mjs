import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const BASE = process.env.E2E_BASE_URL ?? "https://buildus-care-flow.vercel.app";
const TEST_ORDER_MARKER = "BUILDUS_TEST_ORDER:verify-payment-flow";
const TEST_CAMPAIGN = "buildus-test-verify-payment-flow";
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
const connectionString = process.env.MIGRATION_DATABASE_URL || localEnv.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || localEnv.DATABASE_URL;

async function request(method, pathname, body, options = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { response, json };
}

function assertOk(label, result, expectedStatus) {
  const ok = Array.isArray(expectedStatus) ? expectedStatus.includes(result.response.status) : result.response.status === expectedStatus;
  if (!ok) {
    const error = new Error(`${label} failed: ${result.response.status}`);
    error.response = result.json;
    throw error;
  }
  console.log(`PASS ${label}`, { status: result.response.status });
}

function uniquePhone() {
  return `010${String(Date.now()).slice(-8)}`;
}

async function main() {
  const phone = uniquePhone();
  const address = `경기 수원시 영통구 영통동 Buildus Test Road ${Math.floor(Math.random() * 500) + 100}`;

  const orderResult = await request("POST", "/api/orders", {
    customer: {
      phone,
      name: "Buildus Test Payment",
      acquisition_source: TEST_ACQUISITION_SOURCE
    },
    address: {
      road_address: address,
      detail_address: "101동 101호",
      postal_code: "16690"
    },
    home: {
      address_full: `${address} 101동 101호`,
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
        metadata: { service_type_code: "toilet_replace", material_skus: [], product_grade: "standard" }
      }
    ]
  });
  assertOk("POST /api/orders", orderResult, 201);

  const order = orderResult.json?.data?.order;
  if (!order?.id || !order?.access_token) throw new Error("Order response missing id/access_token");

  const reservationResult = await request("POST", `/api/orders/${order.id}/reservation`, {
    reservationDate: "2026-05-25",
    timeSlot: "morning"
  });
  assertOk("POST /api/orders/:id/reservation", reservationResult, [200, 201]);

  const quoteResult = await request("POST", "/api/quote", {
    order_id: order.id,
    items: [
      {
        service_type_code: "toilet_replace",
        item_name: "변기 교체",
        qty: 1,
        unit_price: 0,
        metadata: { service_type_code: "toilet_replace", material_skus: [], product_grade: "standard" }
      }
    ],
    discount: 0
  });
  assertOk("POST /api/quote", quoteResult, 200);

  const quote = quoteResult.json?.data?.quote;
  if (!quote?.id || typeof quote.total_final !== "number") throw new Error("Quote response missing id/total_final");

  const acceptResult = await request("POST", `/api/quotes/${quote.id}/accept`);
  assertOk("POST /api/quotes/:id/accept", acceptResult, 200);

  const paymentKey = `mock-buildus-test-${crypto.randomUUID()}`;
  const confirmResult = await request("POST", "/api/payments/toss/confirm", {
    paymentKey,
    orderId: order.id,
    amount: quote.total_final,
    orderName: "변기 교체"
  });
  assertOk("POST /api/payments/toss/confirm", confirmResult, 200);

  const statusResult = await request("GET", `/api/orders/${order.id}/status`, undefined, {
    headers: { Authorization: `Bearer ${order.access_token}` }
  });
  assertOk("GET /api/orders/:id/status", statusResult, 200);

  const statusOrder = statusResult.json?.data?.order;
  console.log("STATUS_API_RESULT", {
    orderId: order.id,
    orderNumber: order.order_number,
    orderStatus: statusOrder?.status,
    quoteTotal: quote.total_final,
    paymentStatus: confirmResult.json?.data?.payment?.status,
    providerStatus: confirmResult.json?.data?.payment?.provider_status
  });

  if (connectionString) {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      const db = await client.query(
        `
        SELECT
          o.id,
          o.order_number,
          o.status,
          q.id AS quote_id,
          q.total_final AS quote_total,
          q.accepted_at,
          p.id AS payment_id,
          p.status AS payment_status,
          p.provider_status,
          p.quote_id,
          p.paid_at
        FROM orders o
        LEFT JOIN quotes q ON q.order_id = o.id
        LEFT JOIN payments p ON p.order_id = o.id
        WHERE o.id = $1
        ORDER BY q.created_at DESC NULLS LAST, p.created_at DESC NULLS LAST
        LIMIT 1
        `,
        [order.id]
      );
      console.log("DB_RESULT");
      console.table(db.rows);
    } finally {
      await client.end();
    }
  } else {
    console.log("DB_RESULT skipped: no DATABASE_URL/MIGRATION_DATABASE_URL");
  }
}

main().catch((error) => {
  console.error("FAIL verify payment flow", error.message);
  if (error.response) console.error(JSON.stringify(error.response, null, 2));
  process.exit(1);
});
