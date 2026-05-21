const fs = require("fs");
const path = require("path");
const { randomUUID, randomBytes } = require("crypto");
const { spawnSync } = require("child_process");
const { Client } = require("pg");

const BASE_URL = "https://buildus-care-flow.vercel.app";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TEST_ORDER_MARKER = "BUILDUS_TEST_ORDER:qa-order-status-production";
const TEST_CAMPAIGN = "buildus-test-order-status-production";
const TEST_SOURCE = "web";

const TRANSITION_CASES = [
  { name: "inquiry -> quoted", from: "inquiry", to: "quoted", expectedStatus: 200 },
  { name: "quoted -> payment_pending", from: "quoted", to: "payment_pending", expectedStatus: 200 },
  { name: "inquiry -> payment_pending", from: "inquiry", to: "payment_pending", expectedStatus: 409 },
  { name: "completed -> warranty", from: "completed", to: "warranty", expectedStatus: 409 },
  { name: "done -> warranty", from: "done", to: "warranty", expectedStatus: 200 },
  { name: "scheduled -> done", from: "scheduled", to: "done", expectedStatus: 409 },
  { name: "canceled -> paid", from: "canceled", to: "paid", expectedStatus: 409 },
];

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const entries = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.trimStart().startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    });

  return Object.fromEntries(entries);
}

async function createOrder(client, status, label) {
  const customerId = randomUUID();
  const orderId = randomUUID();
  const suffix = randomBytes(5).toString("hex");
  const accessToken = randomBytes(24).toString("hex");

  await client.query(
    `
      insert into public.customers (id, phone, name)
      values ($1, $2, $3)
    `,
    [customerId, `01099${suffix.slice(0, 6)}`, `Buildus Test ${label}`],
  );

  await client.query(
    `
      insert into public.orders (
        id,
        order_number,
        customer_id,
        status,
        service_type_code,
        visit_fee,
        subtotal_amount,
        total_amount,
        special_requests,
        access_token,
        channel,
        source,
        campaign,
        skus
      )
      values (
        $1,
        $2,
        $3,
        $4::public.order_status,
        'qa-order-status',
        0,
        0,
        0,
        $6,
        $5,
        'qa',
        $7,
        $8,
        '[{"item_name":"Buildus test status check","service_type_code":"qa-order-status","qty":1}]'::jsonb
      )
    `,
    [orderId, `BTQA-${Date.now()}-${suffix}`, customerId, status, accessToken, TEST_ORDER_MARKER, TEST_SOURCE, TEST_CAMPAIGN],
  );

  return { orderId, customerId, accessToken };
}

async function cleanup(client, created) {
  const orderIds = created.map((row) => row.orderId);
  const customerIds = created.map((row) => row.customerId);
  if (orderIds.length === 0) return;

  const tablesByOrderId = [
    "public.warranty_cases",
    "public.events",
    "public.feedbacks",
    "public.media",
    "public.order_photos",
    "public.order_items",
    "public.quotes",
    "public.payments",
    "public.reservations",
    "public.jobs",
    "public.cancellations",
  ];

  for (const table of tablesByOrderId) {
    const exists = await client.query("select to_regclass($1) as table_name", [table]);
    if (exists.rows[0]?.table_name) {
      await client.query(`delete from ${table} where order_id = any($1::uuid[])`, [orderIds]);
    }
  }

  await client.query("delete from public.orders where id = any($1::uuid[])", [orderIds]);
  await client.query("delete from public.customers where id = any($1::uuid[])", [customerIds]);
}

async function cleanupStaleQaRows(client) {
  const rows = (
    await client.query(
      `
        select id as "orderId", customer_id as "customerId"
        from public.orders
        where special_requests = $1
      `,
      [TEST_ORDER_MARKER],
    )
  ).rows;

  await cleanup(client, rows);
}

async function patchStatus(orderId, status, adminKey) {
  const response = await fetch(`${BASE_URL}/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-admin-key": adminKey,
    },
    body: JSON.stringify({ status }),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 240) };
  }
  return { httpStatus: response.status, json };
}

async function getCustomerStatus(orderId, accessToken) {
  const response = await fetch(`${BASE_URL}/api/orders/${orderId}/status`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const json = await response.json();
  return { httpStatus: response.status, json };
}

async function postWarranty(orderId, accessToken) {
  const response = await fetch(`${BASE_URL}/api/orders/${orderId}/warranty`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      accessToken,
      type: "other",
      description: `${TEST_ORDER_MARKER} warranty request`,
    }),
  });
  const json = await response.json();
  return { httpStatus: response.status, json };
}

function dumpPage(orderId, accessToken) {
  const url = `${BASE_URL}/orders/${orderId}?accessToken=${accessToken}`;
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--virtual-time-budget=7000",
    "--dump-dom",
    url,
  ];
  const result = spawnSync(CHROME_PATH, args, {
    encoding: "utf8",
    timeout: 20000,
    maxBuffer: 8 * 1024 * 1024,
  });

  return {
    exitCode: result.status,
    url,
    hasAsSection: result.stdout.includes("A/S가 필요하신가요?"),
    hasAsReportButton: result.stdout.includes("A/S 신고하기"),
    hasAsSubmitButton: result.stdout.includes("A/S 접수하기"),
    hasOrderNotCompletedText: result.stdout.includes("A/S can be requested only after the order is done."),
    stderr: result.stderr.slice(0, 500),
  };
}

async function main() {
  const env = loadEnv();
  const adminKey = (env.ADMIN_API_KEY || "").split(",")[0]?.trim();
  if (!adminKey) {
    throw new Error("ADMIN_API_KEY is missing from .env.local");
  }

  const client = new Client({
    connectionString: env.MIGRATION_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const created = [];
  const results = {
    deployedBaseUrl: BASE_URL,
    transitionCases: [],
    customerCases: {},
  };

  await client.connect();
  try {
    await cleanupStaleQaRows(client);

    for (const testCase of TRANSITION_CASES) {
      const row = await createOrder(client, testCase.from, testCase.name);
      created.push(row);
      const response = await patchStatus(row.orderId, testCase.to, adminKey);
      const statusAfter = (
        await client.query("select status::text as status from public.orders where id = $1", [row.orderId])
      ).rows[0]?.status;

      results.transitionCases.push({
        name: testCase.name,
        expectedHttpStatus: testCase.expectedStatus,
        actualHttpStatus: response.httpStatus,
        passed: response.httpStatus === testCase.expectedStatus,
        statusAfter,
        responseCode: response.json?.error?.code || response.json?.code || null,
        responseMessage: response.json?.error?.message || response.json?.message || null,
      });
    }

    const completed = await createOrder(client, "completed", "customer completed");
    const done = await createOrder(client, "done", "customer done");
    created.push(completed, done);

    const completedStatus = await getCustomerStatus(completed.orderId, completed.accessToken);
    const completedPage = dumpPage(completed.orderId, completed.accessToken);
    const completedWarranty = await postWarranty(completed.orderId, completed.accessToken);

    const doneStatus = await getCustomerStatus(done.orderId, done.accessToken);
    const donePage = dumpPage(done.orderId, done.accessToken);
    const doneWarranty = await postWarranty(done.orderId, done.accessToken);
    const doneAfter = (
      await client.query("select status::text as status from public.orders where id = $1", [done.orderId])
    ).rows[0]?.status;

    results.customerCases = {
      completed: {
        statusApiHttpStatus: completedStatus.httpStatus,
        statusApiOrderStatus: completedStatus.json?.data?.order?.status || null,
        pageHasAsCta: completedPage.hasAsSection || completedPage.hasAsReportButton,
        pageDumpExitCode: completedPage.exitCode,
        warrantyPostHttpStatus: completedWarranty.httpStatus,
        warrantyPostCode: completedWarranty.json?.error?.code || completedWarranty.json?.code || null,
      },
      done: {
        statusApiHttpStatus: doneStatus.httpStatus,
        statusApiOrderStatus: doneStatus.json?.data?.order?.status || null,
        pageHasAsCta: donePage.hasAsSection && donePage.hasAsReportButton,
        pageHasAsSubmitText: donePage.hasAsSubmitButton,
        pageDumpExitCode: donePage.exitCode,
        warrantyPostHttpStatus: doneWarranty.httpStatus,
        warrantyPostCreated: doneWarranty.httpStatus === 201,
        statusAfterWarrantyPost: doneAfter,
      },
      pageUrls: {
        completed: completedPage.url,
        done: donePage.url,
      },
    };
  } finally {
    await cleanup(client, created);
    await client.end();
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error && (error.stack || error.message || String(error)));
  process.exit(1);
});
