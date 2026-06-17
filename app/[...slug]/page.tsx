import { notFound } from "next/navigation";

type PublicRoutePageProps = {
  params: Promise<{ slug: string[] }>;
};

export default async function PublicRoutePage({ params }: PublicRoutePageProps) {
  await params;
  notFound();
}
