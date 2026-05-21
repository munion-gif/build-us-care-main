"use client";

import { useState } from "react";

type FeedbackModalProps = {
  open: boolean;
  loading: boolean;
  message: string;
  onClose: () => void;
  onSubmit: (payload: {
    rating: number;
    nps: number;
    comment?: string;
    categories: Record<string, number>;
    score_time: number;
    score_quality: number;
    score_response: number;
    score_clean: number;
    score_price: number;
    would_recommend: boolean;
    would_repurchase: boolean;
  }) => Promise<void>;
};

const SCORE_AXES = [
  { key: "score_time", categoryKey: "speed", label: "시간 준수" },
  { key: "score_quality", categoryKey: "quality", label: "시공 품질" },
  { key: "score_response", categoryKey: "kindness", label: "친절한 응대" },
  { key: "score_clean", categoryKey: "cleanliness", label: "현장 청결" },
  { key: "score_price", categoryKey: "price", label: "가격 만족" }
] as const;

export function FeedbackModal({ open, loading, message, onClose, onSubmit }: FeedbackModalProps) {
  const [rating, setRating] = useState(5);
  const [nps, setNps] = useState("");
  const [comment, setComment] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({
    score_time: 5,
    score_quality: 5,
    score_response: 5,
    score_clean: 5,
    score_price: 5
  });
  const [wouldRecommend, setWouldRecommend] = useState(false);
  const [wouldRepurchase, setWouldRepurchase] = useState(false);

  if (!open) return null;

  const npsValue = nps === "" ? null : Number(nps);
  const canSubmit = !loading && npsValue !== null && npsValue >= 0 && npsValue <= 10;

  return (
    <div className="feedback-backdrop" onMouseDown={onClose} role="presentation">
      <form
        className="feedback-modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({
            rating,
            nps: Number(nps),
            comment: comment.trim() || undefined,
            categories: {
              speed: scores.score_time,
              quality: scores.score_quality,
              kindness: scores.score_response,
              cleanliness: scores.score_clean,
              price: scores.score_price
            },
            score_time: scores.score_time,
            score_quality: scores.score_quality,
            score_response: scores.score_response,
            score_clean: scores.score_clean,
            score_price: scores.score_price,
            would_recommend: wouldRecommend,
            would_repurchase: wouldRepurchase
          });
        }}
      >
        <div className="feedback-header">
          <div>
            <strong>별점 남기기</strong>
            <p>후기는 다음 고객에게 큰 도움이 됩니다.</p>
          </div>
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </div>

        <label>
          별점
          <div className="star-row">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" className={value <= rating ? "on" : ""} onClick={() => setRating(value)}>
                ★
              </button>
            ))}
          </div>
        </label>

        <div className="category-score-list">
          {SCORE_AXES.map(({ key, label }) => (
            <label key={key}>
              <span>{label}</span>
              <select value={scores[key]} onChange={(event) => setScores((current) => ({ ...current, [key]: Number(event.target.value) }))}>
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value}점
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <label>
          한줄 코멘트
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="선택 사항입니다." />
        </label>

        <label>
          추천 의향 *
          <input required type="number" min={0} max={10} value={nps} onChange={(event) => setNps(event.target.value)} placeholder="0-10" />
        </label>

        <div className="feedback-checks">
          <label>
            <input type="checkbox" checked={wouldRecommend} onChange={(event) => setWouldRecommend(event.target.checked)} />
            주변에 추천하고 싶어요
          </label>
          <label>
            <input type="checkbox" checked={wouldRepurchase} onChange={(event) => setWouldRepurchase(event.target.checked)} />
            다음에도 이용할 것 같아요
          </label>
        </div>

        {message && <p className="feedback-message">{message}</p>}
        <button className="submit-feedback" type="submit" disabled={!canSubmit}>
          후기 제출하기
        </button>
      </form>
    </div>
  );
}
