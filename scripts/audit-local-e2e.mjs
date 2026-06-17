const baseUrl = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3001";

const cookieJar = new Map();

function updateCookiesFromHeaders(headers) {
  const setCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);
  for (const row of setCookies) {
    const [pair] = String(row).split(";");
    const eqIndex = pair.indexOf("=");
    if (eqIndex <= 0) continue;
    const name = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();
    cookieJar.set(name, value);
  }
}

function cookieHeader() {
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers ?? {});
  const cookie = cookieHeader();
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(new URL(path, baseUrl), { ...init, headers, redirect: "manual" });
  updateCookiesFromHeaders(response.headers);
  return response;
}

async function expectStatus(path, expectedStatus, init = {}) {
  const response = await request(path, init);
  if (response.status !== expectedStatus) {
    const body = await response.text().catch(() => "");
    throw new Error(`${path} expected ${expectedStatus} but got ${response.status}\n${body}`);
  }
  return response;
}

function logStep(message, payload = undefined) {
  if (payload === undefined) {
    console.log(`[e2e] ${message}`);
    return;
  }
  console.log(`[e2e] ${message}`, payload);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function futureDate(daysAhead = 4) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function createBuilduscareOrder() {
  const formData = new FormData();
  formData.append(
    "payload",
    JSON.stringify({
      deviceType: "desktop",
      item: "샷시손잡이",
      customer: { name: "E2E주문검수", phone: "010-2222-3333" },
      address: {
        roadAddress: "경기 수원시 영통구 광교로 32",
        detailAddress: "101동 1203호",
        postalCode: "16229"
      },
      reservation: {
        date: futureDate(4),
        time: "morning"
      },
      selected: [
        {
          id: "sash_handle:sash-handle:01:003",
          qty: 1,
          selectedColor: "실버"
        }
      ],
      selfDisposal: false,
      totals: {
        productAmount: 15000,
        laborAmount: 100000,
        disposalAmount: 10000,
        totalAmount: 125000
      },
      cashReceipt: {
        type: "personal",
        identity: "01022223333"
      }
    })
  );

  const response = await expectStatus("/api/builduscare/orders", 201, {
    method: "POST",
    body: formData
  });
  const json = await response.json();
  assert(json?.ok, "builduscare order response not ok");
  const order = json.data?.order;
  assert(order?.id, "missing builduscare order id");
  assert(order?.orderNumber, "missing builduscare order number");
  assert(order?.statusUrl, "missing builduscare statusUrl");
  logStep("created builduscare order", {
    orderId: order.id,
    orderNumber: order.orderNumber
  });
  return order;
}

async function createPhotoCheck() {
  const formData = new FormData();
  formData.append(
    "payload",
    JSON.stringify({
      deviceType: "mobile",
      item: "사진 확인",
      customer: { name: "E2E사진검수", phone: "010-3333-4444" },
      address: {
        roadAddress: "경기 수원시 영통구 센트럴타운로 85",
        detailAddress: "202동 703호",
        postalCode: "16514"
      },
      reservation: { date: null, time: null },
      selected: [],
      totals: { productAmount: 0, laborAmount: 0, disposalAmount: 0, totalAmount: 0 },
      memo: "로컬 e2e 검수"
    })
  );
  for (let index = 0; index < 3; index += 1) {
    const file = new File([`fake-jpeg-${index}`], `photo-${index + 1}.jpg`, { type: "image/jpeg" });
    formData.append("photos", file);
  }
  const response = await expectStatus("/api/builduscare/photo-checks", 201, {
    method: "POST",
    body: formData
  });
  const json = await response.json();
  assert(json?.ok, "photo-check response not ok");
  const order = json.data?.order;
  assert(order?.id, "missing photo-check order id");
  assert(order?.orderNumber, "missing photo-check order number");
  logStep("created photo-check order", {
    orderId: order.id,
    orderNumber: order.orderNumber
  });
  return order;
}

async function verifyLookup(orderNumber, customerName) {
  const response = await expectStatus("/api/builduscare/orders/lookup", 200, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderNumber, name: customerName })
  });
  const json = await response.json();
  assert(json?.ok, "lookup response not ok");
  assert(json?.data?.order?.orderNumber === orderNumber, "lookup did not return expected order");
  logStep("lookup verified", { orderNumber });
}

async function verifyCustomerApis(order) {
  const encodedAccessToken = encodeURIComponent(order.accessToken);
  const statusApi = await expectStatus(`/api/orders/${encodeURIComponent(order.id)}/status?accessToken=${encodedAccessToken}`, 200);
  const statusJson = await statusApi.json();
  assert(statusJson?.ok, "customer status api not ok");

  const phoneApi = await expectStatus(`/api/orders?phone=${encodeURIComponent(order.phone)}`, 200);
  const phoneJson = await phoneApi.json();
  assert(phoneJson?.ok, "phone lookup api not ok");
  assert(Array.isArray(phoneJson?.data?.orders), "phone lookup orders missing");
}

async function verifyUrl(path) {
  const response = await expectStatus(path, 200);
  const html = await response.text();
  assert(html.length > 0, `empty html for ${path}`);
}

async function verifyAdminDetailApis(orderId) {
  const orderApi = await expectStatus(`/api/admin/orders/${encodeURIComponent(orderId)}`, 200);
  const orderJson = await orderApi.json();
  assert(orderJson?.ok, "admin order detail api not ok");
  assert(orderJson?.data?.order?.id === orderId, "admin order detail mismatch");
}

async function main() {
  logStep("baseUrl", baseUrl);

  const buildusOrder = await createBuilduscareOrder();
  await verifyLookup(buildusOrder.orderNumber, buildusOrder.customerName ?? "E2E주문검수");
  await verifyUrl(buildusOrder.statusUrl);
  if (buildusOrder.transferUrl) {
    await verifyUrl(buildusOrder.transferUrl);
  }
  await verifyCustomerApis(buildusOrder);
  await verifyAdminDetailApis(buildusOrder.id);

  const photoOrder = await createPhotoCheck();
  await verifyLookup(photoOrder.orderNumber, photoOrder.customerName ?? "E2E사진검수");
  await verifyUrl(photoOrder.statusUrl);
  const diagnosisApi = await expectStatus("/admin/diagnoses", 200);
  await diagnosisApi.text();

  logStep("E2E_OK", {
    builduscareOrderId: buildusOrder.id,
    photoCheckOrderId: photoOrder.id,
    cookies: cookieJar.size
  });
}

main().catch((error) => {
  console.error("[e2e] FAILED");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
