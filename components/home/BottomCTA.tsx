"use client";

import { getKakaoChannelChatUrl } from "@/lib/kakao-channel";

type BottomCTAProps = {
  hidden: boolean;
  kakaoUrl: string | null;
  photoHref?: string;
};

export function BottomCTA({ hidden, kakaoUrl, photoHref = "/request/photo" }: BottomCTAProps) {
  const kakaoChatUrl = getKakaoChannelChatUrl(kakaoUrl);

  return (
    <div className={hidden ? "bottom-cta hidden" : "bottom-cta"} style={{ paddingBottom: "calc(0.75rem + var(--safe-area-bottom))" }}>
      <a href={photoHref}>사진확인</a>
      {kakaoChatUrl ? (
        <a href={kakaoChatUrl} target="_blank" rel="noreferrer">
          카톡 상담하기
        </a>
      ) : (
        <button type="button" disabled>
          카톡 상담 준비 중
        </button>
      )}
    </div>
  );
}
