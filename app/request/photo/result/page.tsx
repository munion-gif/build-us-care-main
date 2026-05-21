import { getPublicAppConfig } from "@/lib/app-config";
import { PhotoResultClient } from "./photo-result-client";

type PhotoResultPageProps = {
  searchParams: Promise<{ id?: string }>;
};

export default async function PhotoResultPage({ searchParams }: PhotoResultPageProps) {
  const [{ id }, appConfig] = await Promise.all([searchParams, getPublicAppConfig()]);

  return <PhotoResultClient diagnosisId={id ?? ""} kakaoUrl={appConfig.kakaoChannelUrl} />;
}
