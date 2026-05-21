"use client";

import { FormEvent, useState } from "react";

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;
type AdminOrder = { id: string; order_number: string; status: string; total_amount: number };
type AdminJob = {
  id: string;
  status: string;
  assigned_technician_name?: string | null;
  scheduled_date?: string | null;
  report_video_url?: string | null;
  orders?: { id?: string; order_number?: string; status?: string };
};

export default function AdminLabPage() {
  const [adminKey, setAdminKey] = useState("dev-admin-key");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [technicianName, setTechnicianName] = useState("김시공");
  const [scheduledDate, setScheduledDate] = useState("2026-05-15");
  const [jobStatus, setJobStatus] = useState("assigned");
  const [reportVideoUrl, setReportVideoUrl] = useState("https://example.com/report-video.mp4");
  const [message, setMessage] = useState("대기");
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState<Array<{ label: string; json: JsonValue }>>([]);

  function addResponse(label: string, json: JsonValue) {
    setResponses((current) => [{ label, json }, ...current].slice(0, 12));
  }

  async function requestJson(label: string, url: string, init?: RequestInit) {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
        ...(init?.headers ?? {})
      }
    });
    const json = (await response.json()) as JsonValue;
    addResponse(`${label} (${response.status})`, json);
    if (!response.ok) throw new Error(`${label} failed`);
    return json as { ok?: boolean; data?: Record<string, unknown> };
  }

  async function run(action: () => Promise<void>) {
    setLoading(true);
    try {
      await action();
      setMessage("완료");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders() {
    setMessage("주문 조회 중");
    const json = await requestJson("admin orders", "/api/admin/orders");
    setOrders((json.data?.orders as AdminOrder[]) ?? []);
  }

  async function loadJobs() {
    setMessage("작업 조회 중");
    const json = await requestJson("admin jobs", "/api/admin/jobs");
    const nextJobs = (json.data?.jobs as AdminJob[]) ?? [];
    setJobs(nextJobs);
    setSelectedJobId((current) => current || nextJobs[0]?.id || "");
  }

  function selectedJob() {
    return jobs.find((job) => job.id === selectedJobId) ?? null;
  }

  async function assignJob(event?: FormEvent) {
    event?.preventDefault();
    setMessage("기사 배정 중");
    await requestJson("assign job", `/api/admin/jobs/${selectedJobId}/assign`, {
      method: "PATCH",
      body: JSON.stringify({
        assigned_technician_name: technicianName,
        scheduled_date: scheduledDate
      })
    });
    await loadJobs();
  }

  async function updateJobStatus(event?: FormEvent) {
    event?.preventDefault();
    setMessage("작업 상태 변경 중");
    await requestJson("job status", `/api/admin/jobs/${selectedJobId}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status: jobStatus,
        memo: "admin lab"
      })
    });
    await loadJobs();
  }

  async function registerReportVideo(event?: FormEvent) {
    event?.preventDefault();
    setMessage("완료 보고 등록 중");
    await requestJson("report video", `/api/admin/jobs/${selectedJobId}/report-video`, {
      method: "POST",
      body: JSON.stringify({
        report_video_url: reportVideoUrl
      })
    });
    await loadOrders();
    await loadJobs();
  }

  const currentJob = selectedJob();

  return (
    <main style={pageStyle}>
      <h1 style={titleStyle}>Admin Lab</h1>
      <p style={mutedStyle}>실제 admin API로 주문/작업 조회, 기사 배정, 작업 상태 변경을 검증합니다.</p>

      <section style={panelStyle}>
        <label>
          <div>admin key</div>
          <input value={adminKey} onChange={(event) => setAdminKey(event.target.value)} style={inputStyle} />
        </label>
      </section>

      <section style={buttonGridStyle}>
        <button disabled={loading} onClick={() => run(loadOrders)} style={buttonStyle}>Load Orders</button>
        <button disabled={loading} onClick={() => run(loadJobs)} style={buttonStyle}>Load Jobs</button>
      </section>

      <section style={panelStyle}>
        <strong>선택 상태 요약</strong>
        <div style={summaryGridStyle}>
          <div><b>order_number</b><br />{currentJob?.orders?.order_number ?? "-"}</div>
          <div><b>order.status</b><br />{currentJob?.orders?.status ?? "-"}</div>
          <div><b>job.status</b><br />{currentJob?.status ?? "-"}</div>
          <div><b>scheduled_date</b><br />{currentJob?.scheduled_date ?? "-"}</div>
          <div><b>has_report_video</b><br />{currentJob?.report_video_url ? "Yes" : "No"}</div>
        </div>
      </section>

      <section style={gridTwoStyle}>
        <div style={panelStyle}>
          <strong>Orders</strong>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead><tr><th>번호</th><th>상태</th><th>금액</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}><td>{order.order_number}</td><td>{order.status}</td><td>{order.total_amount}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={panelStyle}>
          <strong>Jobs</strong>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead><tr><th>선택</th><th>상태</th><th>기사</th><th>주문</th><th>영상</th></tr></thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td><button onClick={() => setSelectedJobId(job.id)} style={smallButtonStyle}>선택</button></td>
                    <td>{job.status}</td>
                    <td>{job.assigned_technician_name ?? "-"}</td>
                    <td>{job.orders?.order_number ?? "-"}</td>
                    <td>{job.report_video_url ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={gridStyle}>
          <label>
            <div>job id</div>
            <input value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} style={inputStyle} />
          </label>
          <label>
            <div>technician</div>
            <input value={technicianName} onChange={(event) => setTechnicianName(event.target.value)} style={inputStyle} />
          </label>
          <label>
            <div>scheduled_date</div>
            <input value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} style={inputStyle} />
          </label>
          <label>
            <div>job status</div>
            <select value={jobStatus} onChange={(event) => setJobStatus(event.target.value)} style={inputStyle}>
              {["received", "material_ready", "assigned", "scheduled", "in_progress", "completed", "cancelled"].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            <div>report_video_url</div>
            <input value={reportVideoUrl} onChange={(event) => setReportVideoUrl(event.target.value)} style={inputStyle} />
          </label>
        </div>
        <div style={buttonGridStyle}>
          <button disabled={loading || !selectedJobId} onClick={() => run(assignJob)} style={buttonStyle}>Assign Technician</button>
          <button disabled={loading || !selectedJobId} onClick={() => run(updateJobStatus)} style={buttonStyle}>Update Job Status</button>
          <button disabled={loading || !selectedJobId} onClick={() => run(registerReportVideo)} style={buttonStyle}>완료 보고 등록</button>
        </div>
      </section>

      <section style={panelStyle}>
        <strong>상태</strong>
        <div style={statusStyle}>{message}</div>
      </section>

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
    </main>
  );
}

const pageStyle = { maxWidth: 1100, margin: "40px auto", padding: 20, fontFamily: "Arial, sans-serif" };
const titleStyle = { fontSize: 24, marginBottom: 8 };
const mutedStyle = { color: "#555", marginBottom: 24 };
const panelStyle = { marginTop: 20, padding: 16, border: "1px solid #ddd", background: "#fff" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 };
const gridTwoStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 };
const buttonGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 16 };
const inputStyle = { width: "100%", minHeight: 36, padding: "8px 10px", border: "1px solid #bbb", boxSizing: "border-box" as const };
const buttonStyle = { minHeight: 40, border: 0, background: "#111", color: "#fff", cursor: "pointer" };
const smallButtonStyle = { border: "1px solid #111", background: "#fff", cursor: "pointer" };
const statusStyle = { marginTop: 8, padding: 12, background: "#f6f7f8", border: "1px solid #ddd" };
const preStyle = { overflowX: "auto" as const, padding: 12, background: "#111", color: "#f8f8f8", fontSize: 12 };
const tableWrapStyle = { overflowX: "auto" as const, marginTop: 8 };
const tableStyle = { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 };
const summaryGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 12 };
