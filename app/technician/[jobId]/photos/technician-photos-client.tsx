"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { JOB_PHOTO_GUIDES, jobPhotoGuide } from "@/lib/photo-guides";

type Media = {
  id: string;
  type: string;
  viewUrl: string | null;
};

export function TechnicianPhotosClient({ jobId }: { jobId: string }) {
  const [active, setActive] = useState<(typeof JOB_PHOTO_GUIDES)[number]["key"]>("before");
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [localMode, setLocalMode] = useState(false);

  async function load() {
    const response = await fetch(`/api/technician/jobs/${jobId}`);
    const payload = await response.json();
    const code = String(payload?.error?.code ?? "");
    const isLocalMode = Boolean(payload?.data?.localMode) || code === "SUPABASE_NOT_CONFIGURED";
    setLocalMode(isLocalMode);
    setMessage(isLocalMode ? "로컬 확인 모드에서는 기사 사진 업로드를 사용할 수 없습니다." : "");
    setMedia(payload.data?.job?.media ?? []);
  }

  useEffect(() => {
    load();
  }, [jobId]);

  const activePhotos = useMemo(() => media.filter((item) => item.type === active), [active, media]);
  const guide = jobPhotoGuide(active);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    if (localMode) return;
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const uploadResponse = await fetch(`/api/technician/jobs/${jobId}/media/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, fileSize: file.size, type: active })
    });
    const uploadPayload = await uploadResponse.json();
    if (!uploadResponse.ok) {
      setLoading(false);
      alert(uploadPayload.message ?? "업로드 URL 생성 실패");
      return;
    }
    await fetch(uploadPayload.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file
    });
    const metadataResponse = await fetch(`/api/technician/jobs/${jobId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_path: uploadPayload.data.file_path, type: active, angle: guide.key, tags: [...guide.tags] })
    });
    setLoading(false);
    if (!metadataResponse.ok) {
      alert("사진 저장에 실패했어요.");
      return;
    }
    await load();
  }

  return (
    <main className="tech-container">
      <header className="tech-header">
        <div>
          <span className="tech-kicker">Photos</span>
          <h1 className="tech-title">현장 사진</h1>
          <p className="tech-sub">{guide.guide}</p>
        </div>
      </header>
      <section className="tech-stack">
        {localMode ? (
          <section className="tech-empty">
            <div className="tech-stack" style={{ width: "100%" }}>
              <strong>로컬 확인 모드입니다.</strong>
              <p className="tech-sub">{message || "기사 사진 업로드는 실제 현장 작업 데이터가 연결된 뒤 사용할 수 있습니다."}</p>
              <Link className="tech-button secondary" href="/technician">목록으로 돌아가기</Link>
            </div>
          </section>
        ) : null}
        <div className="tech-tabs">
          {JOB_PHOTO_GUIDES.slice(0, 3).map((type) => (
            <button key={type.key} type="button" className={active === type.key ? "active" : ""} onClick={() => setActive(type.key)}>
              {type.label}
            </button>
          ))}
        </div>
        <div className="tech-photo-grid">
          {activePhotos.slice(0, 3).map((photo) => (
            <div className="tech-photo-slot filled" key={photo.id}>{photo.viewUrl ? <img src={photo.viewUrl} alt="현장 사진" /> : "저장됨"}<span>{guide.label}</span></div>
          ))}
          {!localMode && activePhotos.length < 3 ? (
            <label className={`tech-photo-slot${localMode ? " disabled" : ""}`}>
              {loading ? "업로드 중" : <><strong>{guide.label}</strong><small>{guide.guide}</small></>}
              <input type="file" accept="image/*" capture="environment" onChange={upload} hidden disabled={loading || localMode} />
            </label>
          ) : null}
        </div>
      </section>
    </main>
  );
}
