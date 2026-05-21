"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getKakaoChannelChatUrl } from "@/lib/kakao-channel";
import { appendSourceParams, readClientSourceContext, type SourceContext } from "@/lib/traffic-source";

type PhotoResultClientProps = {
  diagnosisId: string;
  kakaoUrl: string | null;
};

const resultCopy: Record<string, { tone: string; title: string; cta: string }> = {
  photo_check_received: { tone: "blue", title: "사진 확인이 접수됐어요", cta: "카톡 상담 이어가기" },
  교체추천: { tone: "red", title: "교체를 권장드려요", cta: "견적 받기" },
  보류: { tone: "yellow", title: "사진을 다시 확인해주세요", cta: "사진 다시 올리기" },
  교체불필요: { tone: "green", title: "지금 당장은 교체가 필요 없어요", cta: "그래도 상담하기" },
  현장확인필요: { tone: "blue", title: "현장 확인이 필요해요", cta: "견적 받기" },
  replace_recommended: { tone: "green", title: "교체를 권장드려요", cta: "견적 보기" },
  hold: { tone: "yellow", title: "조금 더 지켜보세요", cta: "상담하기" },
  no_replacement_needed: { tone: "blue", title: "지금 당장은 교체가 필요 없어요", cta: "3개월 후 알림 받기" },
  site_check_required: { tone: "orange", title: "현장 확인이 필요해요", cta: "상담하기" }
};

export function PhotoResultClient({ diagnosisId, kakaoUrl }: PhotoResultClientProps) {
  const [sourceContext, setSourceContext] = useState<SourceContext>(() => readClientSourceContext());
  const [state, setState] = useState<{ loading: boolean; diagnosis?: any; message: string }>({
    loading: true,
    message: "확인 중이에요..."
  });

  useEffect(() => {
    setSourceContext(readClientSourceContext());
  }, []);

  useEffect(() => {
    if (!diagnosisId) {
      setState({ loading: false, message: "판정 요청을 찾을 수 없어요." });
      return;
    }

    let count = 0;
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch(`/api/diagnoses/${diagnosisId}`);
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error?.message ?? "판정 결과를 확인하지 못했어요.");
        if (cancelled) return;
        setState({ loading: json.data.pending, diagnosis: json.data.diagnosis, message: json.data.pending ? "확인 중이에요..." : "" });
        count += 1;
        if (json.data.pending && count < 36) {
          window.setTimeout(poll, 5000);
        }
      } catch (error) {
        if (!cancelled) {
          setState({ loading: false, message: error instanceof Error ? error.message : "다시 시도해주세요." });
        }
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [diagnosisId]);

  const result = state.diagnosis?.result ? resultCopy[state.diagnosis.result] : null;
  const kakaoChatUrl = getKakaoChannelChatUrl(kakaoUrl);

  return (
    <main className="photo-result-page">
      <style>{resultCss}</style>
      <section>
        {state.loading || !result ? (
          <>
            <Loader2 className="spin" size={34} />
            <h1>{state.message}</h1>
            <p>사진과 연락처를 확인하고 있어요.</p>
          </>
        ) : (
          <>
            <span className={`result-badge ${result.tone}`}>{result.title}</span>
            <h1>{state.diagnosis.recommendation ?? state.diagnosis.result_message ?? result.title}</h1>
            <p>{state.diagnosis.reason ?? "확인 후 카톡 또는 전화로 견적 가능 여부를 안내드릴게요."}</p>
            {state.diagnosis.details ? <p>{state.diagnosis.details}</p> : null}
            {typeof state.diagnosis.confidence === "number" && state.diagnosis.result !== "photo_check_received" ? <strong>신뢰도 {Math.round(state.diagnosis.confidence * 100)}%</strong> : null}
            {(state.diagnosis.result === "replace_recommended" || state.diagnosis.result === "교체추천" || state.diagnosis.result === "현장확인필요") && state.diagnosis.suggested_service_code ? (
              <a href={appendSourceParams(`/quote/${state.diagnosis.suggested_service_code}`, sourceContext)}>{result.cta}</a>
            ) : state.diagnosis.result === "보류" ? (
              <a href={appendSourceParams("/request/photo", sourceContext)}>{result.cta}</a>
            ) : kakaoChatUrl ? (
              <a href={kakaoChatUrl} target="_blank" rel="noreferrer">
                {result.cta}
              </a>
            ) : (
              <button type="button" disabled>
                상담 채널 준비 중
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}

const resultCss = `
  .photo-result-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: var(--space-4);
    background: var(--color-bg);
  }
  section {
    width: min(560px, 100%);
    display: grid;
    justify-items: start;
    gap: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    padding: var(--space-8);
    box-shadow: var(--shadow-md);
  }
  h1 {
    margin: 0;
    font-size: var(--text-xl);
  }
  p {
    margin: 0;
    color: var(--color-text-muted);
    line-height: 1.6;
  }
  .result-badge {
    border-radius: var(--radius-full);
    padding: 6px 12px;
    font-weight: 800;
  }
  .green { background: var(--color-primary-highlight); color: var(--color-primary); }
  .red { background: #fee2e2; color: #991b1b; }
  .yellow { background: #fff8d8; color: #886800; }
  .blue { background: #e8f1ff; color: #235a9d; }
  .orange { background: #fff4ec; color: var(--color-accent-orange); }
  a,
  button {
    min-height: 54px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--radius-full);
    padding: 0 var(--space-6);
    background: var(--color-primary);
    color: #fff;
    text-decoration: none;
    font-weight: 800;
  }
  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .spin {
    color: var(--color-primary);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
