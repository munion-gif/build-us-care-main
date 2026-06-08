export function getKakaoChannelChatUrl(channelUrl: string | null) {
  if (!channelUrl) return null;

  try {
    const url = new URL(channelUrl);
    url.pathname = url.pathname.replace(/\/chat\/?$/, "");
    return url.toString();
  } catch {
    const [base, suffix = ""] = channelUrl.split(/([?#].*)/, 2);
    return `${base.replace(/\/chat\/?$/, "")}${suffix}`;
  }
}
