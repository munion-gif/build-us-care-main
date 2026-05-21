export function getKakaoChannelChatUrl(channelUrl: string | null) {
  if (!channelUrl) return null;

  try {
    const url = new URL(channelUrl);
    if (url.pathname.endsWith("/chat")) return url.toString();
    url.pathname = `${url.pathname.replace(/\/$/, "")}/chat`;
    return url.toString();
  } catch {
    const [base, suffix = ""] = channelUrl.split(/([?#].*)/, 2);
    if (base.endsWith("/chat")) return channelUrl;
    return `${base.replace(/\/$/, "")}/chat${suffix}`;
  }
}
