const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const { randomBytes, randomUUID } = require("crypto");
const { Client } = require("pg");

const BASE_URL = "http://127.0.0.1:3000";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TEST_ORDER_MARKER = "BUILDUS_TEST_ORDER:local-visual-qa";
const TEST_CAMPAIGN = "buildus-test-local-visual-qa";
const SCREENSHOT_DIR = path.join(process.cwd(), "screenshots", "ux-order-status");
const START_NEXT_SERVER = process.env.START_NEXT_SERVER === "1";

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

  await client.query("insert into public.customers (id, phone, name) values ($1, $2, $3)", [
    customerId,
    `01098${suffix.slice(0, 6)}`,
    `Buildus Test Visual ${label}`,
  ]);

  await client.query(
    `
      insert into public.orders (
        id, order_number, customer_id, status, service_type_code,
        visit_fee, subtotal_amount, total_amount, special_requests,
        access_token, channel, source, campaign, skus
      )
      values (
        $1, $2, $3, $4::public.order_status, 'toilet_replace',
        0, 0, 0, $5,
        $6, 'qa', 'web', $7,
        '[{"item_name":"Buildus test visual order","service_type_code":"toilet_replace","qty":1}]'::jsonb
      )
    `,
    [orderId, `BTVQA-${Date.now()}-${suffix}`, customerId, status, TEST_ORDER_MARKER, accessToken, TEST_CAMPAIGN],
  );

  return { orderId, customerId, accessToken, status };
}

async function cleanup(client, rows) {
  if (!rows.length) return;
  const orderIds = rows.map((row) => row.orderId);
  const customerIds = rows.map((row) => row.customerId);
  const tables = [
    "public.warranty_cases",
    "public.events",
    "public.feedbacks",
    "public.media",
    "public.order_items",
    "public.quotes",
    "public.payments",
    "public.reservations",
    "public.jobs",
    "public.cancellations",
  ];
  for (const table of tables) {
    const exists = await client.query("select to_regclass($1) as table_name", [table]);
    if (exists.rows[0]?.table_name) {
      await client.query(`delete from ${table} where order_id = any($1::uuid[])`, [orderIds]);
    }
  }
  await client.query("delete from public.orders where id = any($1::uuid[])", [orderIds]);
  await client.query("delete from public.customers where id = any($1::uuid[])", [customerIds]);
}

async function cleanupStale(client) {
  const rows = (
    await client.query(
      `select id as "orderId", customer_id as "customerId" from public.orders where special_requests = $1`,
      [TEST_ORDER_MARKER],
    )
  ).rows;
  await cleanup(client, rows);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAppServer() {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(500);
  }
  throw new Error(`App server is not ready at ${BASE_URL}: ${lastError?.message ?? "unknown error"}`);
}

async function startNextServer() {
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const server = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", "3000"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs = [];
  server.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  server.stderr.on("data", (chunk) => logs.push(chunk.toString()));
  server.on("exit", (code) => {
    if (code !== null && code !== 0) logs.push(`next start exited with code ${code}`);
  });
  try {
    await waitForAppServer();
  } catch (error) {
    server.kill();
    throw new Error(`${error.message}\n${logs.join("")}`);
  }
  return server;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function connectDebugger(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const callbacks = new Map();
  const events = [];
  let id = 0;
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && callbacks.has(message.id)) {
      callbacks.get(message.id)(message);
      callbacks.delete(message.id);
      return;
    }
    if (message.method) events.push(message);
  });

  function send(method, params = {}) {
    const nextId = ++id;
    ws.send(JSON.stringify({ id: nextId, method, params }));
    return new Promise((resolve, reject) => {
      callbacks.set(nextId, (message) => {
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result);
      });
    });
  }

  return { ws, send, events };
}

async function setupChrome() {
  const userDataDir = path.join(os.tmpdir(), `buildus-visual-qa-${Date.now()}`);
  const port = 9224;
  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--disable-gpu",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--window-size=1365,900",
    "about:blank",
  ], { stdio: "ignore" });

  let pageTarget;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      pageTarget = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (pageTarget) break;
    } catch {
      await wait(250);
    }
  }
  if (!pageTarget?.webSocketDebuggerUrl) throw new Error("Chrome page debugging endpoint is unavailable.");
  return { chrome, userDataDir, cdp: await connectDebugger(pageTarget.webSocketDebuggerUrl) };
}

async function capturePage(cdp, page) {
  const { send, events } = cdp;
  const startIndex = events.length;
  await send("Emulation.setDeviceMetricsOverride", {
    width: page.width,
    height: page.height,
    deviceScaleFactor: page.mobile ? 2 : 1,
    mobile: page.mobile,
  });
  await send("Page.navigate", { url: page.url });
  await wait(page.waitMs ?? 3500);

  const textResult = await send("Runtime.evaluate", {
    expression: "document.body ? document.body.innerText : ''",
    returnByValue: true,
  });
  const text = textResult.result?.value ?? "";
  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  const filePath = path.join(SCREENSHOT_DIR, `${page.name}.png`);
  fs.writeFileSync(filePath, Buffer.from(screenshot.data, "base64"));

  const pageEvents = events.slice(startIndex);
  const consoleErrors = pageEvents
    .filter((event) =>
      event.method === "Runtime.exceptionThrown" ||
      (event.method === "Runtime.consoleAPICalled" && event.params?.type === "error") ||
      (event.method === "Log.entryAdded" && event.params?.entry?.level === "error")
    )
    .map((event) => event.params?.exceptionDetails?.text || event.params?.entry?.text || event.params?.args?.map((arg) => arg.value || arg.description).join(" ") || event.method);

  return {
    name: page.name,
    url: page.url,
    viewport: `${page.width}x${page.height}${page.mobile ? " mobile" : " desktop"}`,
    screenshot: filePath,
    consoleErrors,
    checks: Object.fromEntries(
      page.checks.map((check) => {
        const exists = text.includes(check.text);
        return [check.label, check.shouldExist === false ? !exists : exists];
      })
    ),
  };
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const env = loadEnv();
  const client = new Client({ connectionString: env.MIGRATION_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const created = [];
  let appServer;
  let chrome;

  if (START_NEXT_SERVER) appServer = await startNextServer();
  await client.connect();
  try {
    await cleanupStale(client);
    const inquiry = await createOrder(client, "inquiry", "inquiry");
    const completed = await createOrder(client, "completed", "completed");
    const done = await createOrder(client, "done", "done");
    const scheduled = await createOrder(client, "scheduled", "scheduled");
    const canceled = await createOrder(client, "canceled", "canceled");
    created.push(inquiry, completed, done, scheduled, canceled);

    const chromeSetup = await setupChrome();
    chrome = chromeSetup.chrome;
    const cdp = chromeSetup.cdp;
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Network.enable");
    if (env.ADMIN_SESSION_SECRET) {
      await cdp.send("Network.setCookie", {
        name: "admin_session",
        value: env.ADMIN_SESSION_SECRET,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      });
    }

    const pages = [
      {
        name: "landing-mobile",
        url: `${BASE_URL}/`,
        width: 390,
        height: 844,
        mobile: true,
        checks: [
          { label: "primary service CTA", text: "사진으로 먼저 확인" },
          { label: "instant section", text: "바로 예약 가능한 작업" },
          { label: "consult section", text: "사진 확인 후 확정하는 작업" },
          { label: "quick win mini timeline", text: "견적부터 A/S까지 주문 링크에서 확인" },
          { label: "six step flow", text: "완료" },
        ],
      },
      {
        name: "landing-desktop",
        url: `${BASE_URL}/`,
        width: 1365,
        height: 900,
        mobile: false,
        checks: [
          { label: "quick win mini timeline", text: "견적부터 A/S까지 주문 링크에서 확인" },
          { label: "trust summary", text: "정찰가 기준" },
          { label: "instant section", text: "즉시예약형" },
          { label: "consult section", text: "상담/견적형" },
          { label: "as condition summary", text: "최종 완료 후 A/S" },
        ],
      },
      {
        name: "quote-mobile",
        url: `${BASE_URL}/quote/toilet_replace`,
        width: 390,
        height: 844,
        mobile: true,
        checks: [
          { label: "instant flow copy", text: "가격 확인 후 일정과 결제로 이어집니다" },
          { label: "scope included card", text: "포함 항목" },
          { label: "scope excluded card", text: "제외 항목" },
          { label: "field add-on card", text: "현장 추가 가능" },
          { label: "optional details collapsed", text: "세부 옵션과 결제 요약" },
          { label: "home info collapsed", text: "집 정보 입력" },
          { label: "active schedule picker", text: "예약일 선택" },
          { label: "payment-after-schedule-copy", text: "방문 일정이 확정" },
          { label: "payment CTA copy", text: "견적 확인 후 결제 진행하기" },
        ],
      },
      {
        name: "quote-consult-mobile",
        url: `${BASE_URL}/quote/drain_clog`,
        width: 390,
        height: 844,
        mobile: true,
        checks: [
          { label: "consult badge", text: "상담 필요" },
          { label: "consult flow copy", text: "사진과 주소 확인 후 견적을 확정합니다" },
          { label: "work info first", text: "작업 정보 입력" },
          { label: "consult next", text: "견적 확정 후 일정 조율" },
          { label: "no active schedule picker", text: "예약일 선택", shouldExist: false },
        ],
      },
      {
        name: "customer-completed-mobile",
        url: `${BASE_URL}/orders/${completed.orderId}?accessToken=${completed.accessToken}`,
        width: 390,
        height: 844,
        mobile: true,
        checks: [
          { label: "completed copy", text: "작업 완료 확인 중" },
          { label: "settlement copy", text: "최종 확인 및 정산" },
          { label: "as not yet copy", text: "A/S 접수는 최종 완료 후 가능합니다" },
          { label: "next happens card", text: "다음에 일어나는 일" },
          { label: "as report button hidden", text: "A/S 신고하기", shouldExist: false },
        ],
      },
      {
        name: "customer-done-mobile",
        url: `${BASE_URL}/orders/${done.orderId}?accessToken=${done.accessToken}`,
        width: 390,
        height: 844,
        mobile: true,
        checks: [
          { label: "done copy", text: "최종 완료" },
          { label: "as available copy", text: "보증 조건에 해당하면 이 링크에서 접수하세요" },
          { label: "as report button", text: "A/S 신고하기" },
          { label: "next happens card", text: "A/S 가능 조건을 확인할 수 있습니다" },
        ],
      },
      {
        name: "admin-inquiry-desktop",
        url: `${BASE_URL}/admin/orders/${inquiry.orderId}`,
        width: 1365,
        height: 900,
        mobile: false,
        checks: [
          { label: "transition panel", text: "상태 변경" },
          { label: "quoted action", text: "견적 완료" },
          { label: "blocked payment pending", text: "먼저 견적 완료로 전환하세요" },
        ],
      },
      {
        name: "admin-completed-desktop",
        url: `${BASE_URL}/admin/orders/${completed.orderId}`,
        width: 1365,
        height: 900,
        mobile: false,
        checks: [
          { label: "transition panel", text: "상태 변경" },
          { label: "completed admin copy", text: "작업 완료, 검수 전" },
          { label: "blocked warranty hint", text: "A/S로 바로 전환할 수 없습니다" },
          { label: "blocked note", text: "A/S 처리 차단" },
          { label: "done button", text: "최종 완료" },
        ],
      },
      {
        name: "admin-done-desktop",
        url: `${BASE_URL}/admin/orders/${done.orderId}`,
        width: 1365,
        height: 900,
        mobile: false,
        checks: [
          { label: "transition panel", text: "상태 변경" },
          { label: "done admin copy", text: "최종 완료" },
          { label: "warranty action", text: "A/S 처리" },
        ],
      },
      {
        name: "admin-completed-mobile",
        url: `${BASE_URL}/admin/orders/${completed.orderId}`,
        width: 390,
        height: 844,
        mobile: true,
        checks: [
          { label: "mobile transition panel", text: "상태 변경" },
          { label: "blocked warranty hint", text: "A/S로 바로 전환할 수 없습니다" },
        ],
      },
      {
        name: "admin-scheduled-desktop",
        url: `${BASE_URL}/admin/orders/${scheduled.orderId}`,
        width: 1365,
        height: 900,
        mobile: false,
        checks: [
          { label: "in progress action", text: "작업 진행" },
          { label: "blocked done", text: "작업 진행/완료 단계를 먼저 처리하세요" },
        ],
      },
      {
        name: "admin-canceled-desktop",
        url: `${BASE_URL}/admin/orders/${canceled.orderId}`,
        width: 1365,
        height: 900,
        mobile: false,
        checks: [
          { label: "canceled admin copy", text: "취소됨" },
          { label: "blocked paid", text: "결제 완료 상태로 되돌릴 수 없습니다" },
        ],
      },
    ];

    const results = [];
    for (const page of pages) {
      results.push(await capturePage(cdp, page));
    }

    cdp.ws.close();
    await cleanup(client, created);
    created.length = 0;
    const staleCountAfterCleanup = (
      await client.query("select count(id)::int as count from public.orders where special_requests = $1", [TEST_ORDER_MARKER])
    ).rows[0].count;

    console.log(JSON.stringify({ baseUrl: BASE_URL, screenshotsDir: SCREENSHOT_DIR, staleCountAfterCleanup, results }, null, 2));
  } finally {
    await cleanup(client, created);
    await client.end();
    if (chrome) chrome.kill();
    if (appServer) appServer.kill();
  }
}

main().catch((error) => {
  console.error(error && (error.stack || error.message || String(error)));
  process.exit(1);
});
