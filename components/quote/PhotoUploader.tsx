"use client";

import { Camera, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CUSTOMER_PHOTO_SLOTS } from "@/lib/photo-guides";

type PhotoUploaderProps = {
  files: File[];
  guide: string;
  onChange: (files: File[]) => void;
};

export function PhotoUploader({ files, guide, onChange }: PhotoUploaderProps) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  function removeAt(index: number) {
    onChange(files.filter((_, fileIndex) => fileIndex !== index));
  }

  return (
    <section className="quote-section photo-upload-section">
      <div className="section-title-row">
        <h2>사진 업로드</h2>
        <span>{files.length}/3장</span>
      </div>
      <p className="guide-text">{guide}</p>
      <div className="photo-slot-grid">
        {CUSTOMER_PHOTO_SLOTS.map((slot, index) => (
          <div key={index} className={files[index] ? "photo-slot filled" : "photo-slot"}>
            {files[index] ? (
              <>
                <img src={previewUrls[index]} alt={`업로드 사진 ${index + 1}`} />
                <span className="photo-slot-caption">{slot.label}</span>
                <button type="button" onClick={() => removeAt(index)} aria-label="사진 삭제">
                  <X size={16} />
                </button>
              </>
            ) : (
              <label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const next = [...files];
                    next[index] = file;
                    onChange(next.slice(0, 3));
                    event.target.value = "";
                  }}
                />
                <Camera size={22} />
                <strong>{slot.label}</strong>
                <span>{slot.guide}</span>
              </label>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
