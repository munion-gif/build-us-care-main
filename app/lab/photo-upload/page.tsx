"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const ORDER_PHOTOS_BUCKET = "buildus-order-photos";

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

type UploadUrlResponse = {
  uploadUrl: string;
  token: string;
  path: string;
  expiresIn: number;
};

export default function PhotoUploadLabPage() {
  return (
    <Suspense fallback={<main style={{ maxWidth: 760, margin: "40px auto", padding: 20, fontFamily: "Arial, sans-serif" }}>Loading...</main>}>
      <PhotoUploadLabContent />
    </Suspense>
  );
}

function PhotoUploadLabContent() {
  const searchParams = useSearchParams();
  const [orderId, setOrderId] = useState(searchParams.get("orderId") ?? "");
  const [accessToken, setAccessToken] = useState(searchParams.get("accessToken") ?? "");
  const [sortOrder, setSortOrder] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [responses, setResponses] = useState<Array<{ label: string; json: JsonValue }>>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) return null;
    return createClient(url, anonKey);
  }, []);

  async function readJson(response: Response) {
    const json = (await response.json()) as JsonValue;
    return json;
  }

  function addResponse(label: string, json: JsonValue) {
    setResponses((current) => [{ label, json }, ...current].slice(0, 8));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!file) {
      setMessage("파일을 선택하세요.");
      return;
    }

    if (!supabase) {
      setMessage("Supabase public env가 없습니다.");
      return;
    }

    setLoading(true);
    setMessage("업로드 URL 발급 중...");
    setPreviewUrls([]);

    try {
      const uploadUrlResponse = await fetch(`/api/orders/${orderId}/photos/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          accessToken
        })
      });
      const uploadUrlJson = (await readJson(uploadUrlResponse)) as { ok?: boolean; data?: UploadUrlResponse };
      addResponse("1. upload-url", uploadUrlJson);

      if (!uploadUrlResponse.ok || !uploadUrlJson.ok || !uploadUrlJson.data) {
        throw new Error("업로드 URL 발급 실패");
      }

      setMessage("Supabase Storage 업로드 중...");
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(ORDER_PHOTOS_BUCKET)
        .uploadToSignedUrl(uploadUrlJson.data.path, uploadUrlJson.data.token, file, {
          contentType: file.type
        });

      addResponse("2. storage upload", uploadError ? { error: uploadError.message } : uploadData);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setMessage("메타데이터 저장 중...");
      const metadataResponse = await fetch(`/api/orders/${orderId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          photos: [{ file_path: uploadUrlJson.data.path, sort_order: sortOrder }]
        })
      });
      const metadataJson = await readJson(metadataResponse);
      addResponse("3. metadata", metadataJson);

      if (!metadataResponse.ok) {
        throw new Error("메타데이터 저장 실패");
      }

      setMessage("상태 조회 중...");
      const statusResponse = await fetch(`/api/orders/${orderId}/status?accessToken=${encodeURIComponent(accessToken)}`);
      const statusJson = (await readJson(statusResponse)) as {
        ok?: boolean;
        data?: { order?: { photos?: Array<{ viewUrl?: string | null }> } };
      };
      addResponse("4. status", statusJson);

      if (!statusResponse.ok || !statusJson.ok) {
        throw new Error("상태 조회 실패");
      }

      setPreviewUrls((statusJson.data?.order?.photos ?? []).map((photo) => photo.viewUrl).filter(Boolean) as string[]);
      setMessage("완료");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Photo Upload Lab</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>주문 사진 signed upload URL 플로우 검증용 최소 페이지입니다.</p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          <div>orderId</div>
          <input value={orderId} onChange={(event) => setOrderId(event.target.value)} required style={inputStyle} />
        </label>
        <label>
          <div>accessToken</div>
          <input value={accessToken} onChange={(event) => setAccessToken(event.target.value)} required style={inputStyle} />
        </label>
        <label>
          <div>file</div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
        </label>
        <label>
          <div>sort_order</div>
          <input
            type="number"
            value={sortOrder}
            min={0}
            onChange={(event) => setSortOrder(Number(event.target.value))}
            style={inputStyle}
          />
        </label>
        <button disabled={loading} style={buttonStyle}>
          {loading ? "처리 중..." : "Upload Test"}
        </button>
      </form>

      <section style={{ marginTop: 24 }}>
        <strong>상태</strong>
        <div style={{ marginTop: 8, padding: 12, background: "#f6f7f8", border: "1px solid #ddd" }}>{message || "대기"}</div>
      </section>

      {previewUrls.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <strong>미리보기</strong>
          <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
            {previewUrls.map((url) => (
              <img key={url} src={url} alt="Uploaded order photo preview" style={{ maxWidth: "100%", border: "1px solid #ddd" }} />
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: 24 }}>
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

const inputStyle = {
  width: "100%",
  minHeight: 36,
  padding: "8px 10px",
  border: "1px solid #bbb",
  boxSizing: "border-box" as const
};

const buttonStyle = {
  minHeight: 42,
  border: 0,
  background: "#111",
  color: "#fff",
  cursor: "pointer"
};

const preStyle = {
  overflowX: "auto" as const,
  padding: 12,
  background: "#111",
  color: "#f8f8f8",
  fontSize: 12
};
