import { ServiceLanding } from "@/components/builduscare/ServiceLanding";

export const metadata = {
  title: "Build us Care",
  description: "집 전체가 아니라, 바꿀 수 있는 것부터.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    url: "/"
  }
};

export default function ServicePage() {
  return <ServiceLanding />;
}
