const baseUrl = process.env.AUDIT_BASE_URL?.trim() || "http://127.0.0.1:3001";

const checks = [
  { method: "GET", path: "/" },
  { method: "GET", path: "/service" },
  { method: "GET", path: "/products" },
  { method: "GET", path: "/products/toilet" },
  { method: "GET", path: "/products/washbasin" },
  { method: "GET", path: "/products/window-handle" },
  { method: "GET", path: "/products/faucet" },
  { method: "GET", path: "/products/bidet" },
  { method: "GET", path: "/products/ventilation" },
  { method: "GET", path: "/products/door-handle" },
  { method: "GET", path: "/products/silicone" },
  { method: "GET", path: "/products/bath-accessory" },
  { method: "GET", path: "/photo-check" },
  { method: "GET", path: "/order-lookup" },
  { method: "GET", path: "/reservation/complete" },
  { method: "GET", path: "/order-status" },
  { method: "GET", path: "/payment/transfer" },
  { method: "GET", path: "/quote-preview" },
  { method: "GET", path: "/as-request" },
  { method: "GET", path: "/admin/login", expectStatus: 307 },
  { method: "GET", path: "/admin/orders" },
  { method: "GET", path: "/admin/dashboard" },
  { method: "GET", path: "/admin/diagnoses" },
  { method: "GET", path: "/admin/slots" },
  { method: "GET", path: "/admin/settings" },
  { method: "GET", path: "/admin/technicians" },
  { method: "GET", path: "/admin/analytics" },
  { method: "GET", path: "/admin/jobs" },
  { method: "GET", path: "/admin/security" },
  { method: "GET", path: "/admin/consultations" },
  { method: "GET", path: "/admin/funnel" },
  { method: "GET", path: "/technician/login" },
  { method: "GET", path: "/technician" },
  { method: "GET", path: "/api/admin/orders/unassigned-count" },
  { method: "GET", path: "/api/admin/funnel?period=7d" },
  { method: "GET", path: "/api/admin/slot-configs" },
  { method: "GET", path: "/api/admin/settings" },
  { method: "GET", path: "/api/admin/technicians" },
  { method: "GET", path: "/api/admin/technicians/00000000-0000-0000-0000-000000000000/schedule?month=2026-06" },
  { method: "GET", path: "/api/admin/faqs" },
  { method: "GET", path: "/api/admin/feedbacks" },
  { method: "GET", path: "/api/admin/stats" },
  { method: "GET", path: "/api/admin/session" },
  { method: "GET", path: "/api/admin/data-export" },
  { method: "GET", path: "/api/admin/events/export" },
  { method: "GET", path: "/api/admin/orders/export" },
  { method: "GET", path: "/api/admin/sessions/export" },
  { method: "GET", path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000" },
  { method: "GET", path: "/api/slots?year=2026&month=6" },
  { method: "GET", path: "/api/technician/jobs" },
  { method: "GET", path: "/api/technician/jobs/test" },
  { method: "POST", path: "/api/admin/auth", body: {} },
  { method: "POST", path: "/api/admin/logout" },
  { method: "POST", path: "/api/technician/auth", body: {} },
  { method: "POST", path: "/api/admin/settings", body: {}, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/admin/faqs", body: { question: "q", answer: "a" }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "PATCH", path: "/api/admin/faqs/00000000-0000-0000-0000-000000000000", body: { question: "q", answer: "a" }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "DELETE", path: "/api/admin/faqs/00000000-0000-0000-0000-000000000000", expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "PATCH", path: "/api/admin/faqs/00000000-0000-0000-0000-000000000000/reorder", body: { display_order: 1 }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/admin/technicians", body: { name: "기사님", phone: "01012341234" }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "PATCH", path: "/api/admin/technicians", body: { id: "00000000-0000-0000-0000-000000000000", is_active: false }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "PATCH", path: "/api/admin/orders/local-order/status", body: { status: "scheduled" }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "PATCH", path: "/api/admin/orders/local-order", body: { customer_name: "테스트" }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/admin/orders/local-order/confirm-payment", body: {}, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/admin/orders/local-order/confirm-reservation", body: {}, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "PATCH", path: "/api/admin/orders/local-order/test", body: { isTest: true }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/admin/cancellations/00000000-0000-0000-0000-000000000000/approve", body: {}, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/admin/cancellations/00000000-0000-0000-0000-000000000000/reject", body: {}, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/admin/jobs", body: { orderId: "x", technicianId: "x" }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "DELETE", path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000", expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "PATCH", path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000/assign", body: { assigned_technician_name: "기사님" }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "PATCH", path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000/start", body: {}, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "PATCH", path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000/complete", body: {}, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "PATCH", path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000/inspect", body: {}, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000/late-check", body: {}, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000/media/upload-url", body: { type: "before", fileName: "a.jpg", contentType: "image/jpeg" }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000/media", body: { type: "before", file_path: "jobs/00000000-0000-0000-0000-000000000000/before/a.jpg", url: "https://example.com/a.jpg" }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/admin/jobs/00000000-0000-0000-0000-000000000000/report-video", body: { url: "https://example.com/video.mp4" }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/admin/slot-configs", body: { date: "2026-06-20", type: "date", cap: 0 }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "DELETE", path: "/api/admin/slot-configs/2026-06-20", expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "PATCH", path: "/api/admin/diagnoses/local-diagnosis-00000000", body: { result: "hold" }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "DELETE", path: "/api/admin/diagnoses/local-diagnosis-00000000", expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/admin/diagnoses/local-diagnosis-00000000/convert", body: {}, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "PATCH", path: "/api/admin/diagnoses/local-diagnosis-00000000/test", body: { isTest: true }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/builduscare/orders/lookup", body: { orderNumber: "BC-000000-000", name: "홍길동" }, expectStatus: 200 },
  { method: "POST", path: "/api/builduscare/orders/local-order/photos", body: { photos: [] }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/orders", body: {}, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/orders/local-order/cancel", body: {}, expectStatus: 404, expectCode: "NOT_FOUND" },
  { method: "POST", path: "/api/orders/local-order/feedback", body: {}, expectStatus: 404, expectCode: "NOT_FOUND" },
  { method: "POST", path: "/api/orders/local-order/warranty", body: {}, expectStatus: 404, expectCode: "NOT_FOUND" },
  { method: "PATCH", path: "/api/orders/local-order/reschedule", body: {}, expectStatus: 404, expectCode: "NOT_FOUND" },
  { method: "POST", path: "/api/orders/local-order/reservation", body: {}, expectStatus: 404, expectCode: "NOT_FOUND" },
  { method: "PATCH", path: "/api/technician/jobs/test/start", body: {}, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "PATCH", path: "/api/technician/jobs/test/complete", body: {}, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/technician/jobs/test/media/upload-url", body: { type: "before", fileName: "a.jpg", contentType: "image/jpeg" }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/technician/jobs/test/media", body: { type: "before", file_path: "jobs/test/before/a.jpg", url: "https://example.com/a.jpg" }, expectStatus: 409, expectCode: "LOCAL_READ_ONLY" },
  { method: "POST", path: "/api/events", body: { eventType: "page_view" }, expectStatus: 202 }
];

async function run() {
  const failures = [];

  for (const check of checks) {
    const headers = {};
    let body;
    if (check.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(check.body);
    }

    let response;
    let text = "";
    let json = null;
    try {
      response = await fetch(`${baseUrl}${check.path}`, {
        method: check.method,
        headers,
        body,
        redirect: "manual"
      });
      text = await response.text();
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
    } catch (error) {
      failures.push({
        method: check.method,
        path: check.path,
        reason: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    const expectedStatus = check.expectStatus ?? 200;
    const actualCode = json?.error?.code ?? null;
    const statusOk = response.status === expectedStatus;
    const codeOk = check.expectCode ? actualCode === check.expectCode : true;

    if (!statusOk || !codeOk) {
      failures.push({
        method: check.method,
        path: check.path,
        status: response.status,
        expectedStatus,
        actualCode,
        expectedCode: check.expectCode ?? null,
        preview: text.slice(0, 200)
      });
    }

    console.log(
      [
        response.status,
        check.method,
        check.path,
        check.expectCode ? actualCode ?? "-" : "ok"
      ].join("\t")
    );
  }

  if (failures.length > 0) {
    console.error("\nFAILURES");
    for (const failure of failures) {
      console.error(JSON.stringify(failure));
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\nAUDIT_OK\t${checks.length}`);
}

await run();
