import { TechnicianCheckinClient } from "./technician-checkin-client";

type PageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function TechnicianCheckinPage({ params }: PageProps) {
  const { jobId } = await params;
  return <TechnicianCheckinClient jobId={jobId} />;
}
