import { TechnicianPhotosClient } from "./technician-photos-client";

type PageProps = {
  params: Promise<{ jobId: string }>;
};

export default async function TechnicianPhotosPage({ params }: PageProps) {
  const { jobId } = await params;
  return <TechnicianPhotosClient jobId={jobId} />;
}
