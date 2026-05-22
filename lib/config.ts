const DEFAULT_KAKAO_CHANNEL_URL = "https://pf.kakao.com/_PxkzsX?from=qr";
const configuredKakaoChannelUrl = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL?.trim();

export const KAKAO_CHANNEL_URL =
  configuredKakaoChannelUrl && !configuredKakaoChannelUrl.includes("_placeholder")
    ? configuredKakaoChannelUrl
    : DEFAULT_KAKAO_CHANNEL_URL;
