import { getAllServiceItems } from "@/lib/service-items";
import { getPublicAppConfig } from "@/lib/app-config";
import { getPublicFaqs } from "@/lib/faqs";
import { HomeClient } from "./home-client";

export const revalidate = 3600;

export default async function HomePage() {
  const [services, appConfig, faqs] = await Promise.all([getAllServiceItems(), getPublicAppConfig(), getPublicFaqs()]);

  return <HomeClient services={services} kakaoUrl={appConfig.kakaoChannelUrl} faqs={faqs} />;
}
