import { TechnicianCompleteClient } from "./technician-complete-client";

type PageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function TechnicianCompletePage({ params }: PageProps) {
  const { jobId } = await params;
  return <TechnicianCompleteClient jobId={jobId} />;
}
