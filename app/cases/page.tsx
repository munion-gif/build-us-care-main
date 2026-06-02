import { CasesClient } from "./cases-client";
import { getPublicCases } from "@/lib/public-cases";

export const revalidate = 300;

export default async function CasesPage() {
  const initialCases = await getPublicCases({ service: "all", limit: 30 }).catch(() => ({
    cases: []
  }));

  return <CasesClient initialCases={initialCases.cases} initialLoaded />;
}
