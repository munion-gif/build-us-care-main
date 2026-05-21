import { TechnicianJobDetailClient } from "./technician-job-detail-client";

type PageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function TechnicianJobPage({ params }: PageProps) {
  const { jobId } = await params;
  return <TechnicianJobDetailClient jobId={jobId} />;
}
