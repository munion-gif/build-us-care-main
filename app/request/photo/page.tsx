import { getPublicAppConfig } from "@/lib/app-config";
import { getAllServiceItems } from "@/lib/service-items";
import { PhotoRequestClient } from "./photo-request-client";

export default async function PhotoRequestPage() {
  const [services, appConfig] = await Promise.all([getAllServiceItems(), getPublicAppConfig()]);
  const hiddenServiceCodes = new Set(["drain_clog", "partial_wallpaper"]);

  return <PhotoRequestClient services={services.filter((service) => service.standardizable && !hiddenServiceCodes.has(service.service_type_code))} kakaoUrl={appConfig.kakaoChannelUrl} />;
}
