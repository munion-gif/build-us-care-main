import Link from "next/link";
import type { CaseItem } from "@/lib/cases-data";
import { formatWon } from "@/lib/cases-data";

export function CaseCard({ item }: { item: CaseItem }) {
  return (
    <Link className="case-card" href={`/cases/${item.slug}`}>
      <div className="case-thumb">
        {item.afterImage ? (
          <img src={item.afterImage} alt={item.title} />
        ) : (
          <span className="ph-label">시공 사진</span>
        )}
        <span className="case-cat">{item.category}</span>
      </div>
      <div className="case-card-body">
        <h3>{item.title}</h3>
        <p className="region">{item.region}</p>
        <div className="price">
          {formatWon(item.costTotal)} {item.costTotal ? <small>· VAT 포함</small> : null}
        </div>
      </div>
    </Link>
  );
}
