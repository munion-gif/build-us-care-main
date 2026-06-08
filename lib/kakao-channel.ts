export function getKakaoChannelChatUrl(channelUrl: string | null) {
  const trimmed = channelUrl?.trim();
  return trimmed || null;
}
