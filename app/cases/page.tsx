import type { Metadata } from "next";
import { getAllCases } from "@/lib/cases-data";
import { CaseCard } from "./CaseCard";
import "./cases.css";

export const metadata: Metadata = {
  title: "교체사례 | Build us Care",
  description: "빌드어스 케어의 실제 교체 시공 사례를 확인하세요. 변기·수전·세면대·환풍기 등 부분 교체 전후를 사진으로 보여드립니다.",
  alternates: { canonical: "/cases" },
  openGraph: {
    title: "교체사례 | Build us Care",
    description: "실제 교체 시공 사례 — 전후 사진과 비용을 투명하게 공개합니다.",
    url: "/cases"
  }
};

export default function CasesListPage() {
  const cases = getAllCases();

  return (
    <div className="cases-wrap cases-list-wrap">
      <div className="cases-head">
        <h1>교체사례</h1>
        <p>실제로 진행한 교체 시공을 전후 사진과 비용까지 그대로 보여드립니다.</p>
      </div>

      {cases.length === 0 ? (
        <div className="cases-empty">아직 등록된 교체사례가 없습니다.</div>
      ) : (
        <div className="cases-grid">
          {cases.map((item) => (
            <CaseCard key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
