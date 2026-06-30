"use client";

import { Check } from "lucide-react";

type ProductFilterBarProps = {
  group: string;
  sort: string;
  brand: string;
  color: string;
  groupNames: string[];
  groupLabels?: Record<string, string>;
  brands: string[];
  colors: string[];
  onGroupChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onClearFilters: () => void;
};

const sortOptions = [
  ["rank", "랭킹순"],
  ["low", "낮은가격순"],
  ["high", "높은가격순"],
  ["popular", "인기순"]
] as const;

export function ProductFilterBar({
  group,
  sort,
  brand,
  color,
  groupNames,
  groupLabels,
  brands,
  colors,
  onGroupChange,
  onSortChange,
  onBrandChange,
  onColorChange,
  onClearFilters
}: ProductFilterBarProps) {
  const hasFilters = group !== "전체" || brand !== "전체" || color !== "전체";
  const showGroupFilters = groupNames.length > 1;

  return (
    <div>
      {showGroupFilters && (
        <div className="filterbar filter-tabs">
          {["전체", ...groupNames].map((item) => (
            <button key={item} className={`fbtn ${group === item ? "on" : ""}`} type="button" onClick={() => onGroupChange(item)}>
              {groupLabels?.[item] ?? item}
            </button>
          ))}
        </div>
      )}
      <div className="filterbar filter-sort" style={{ marginTop: showGroupFilters ? 8 : 0 }}>
        {sortOptions.map(([value, label]) => (
          <button key={value} className={`fbtn sort-chip ${sort === value ? "on" : ""}`} type="button" onClick={() => onSortChange(value)}>
            {sort === value && <Check size={13} />}
            {label}
          </button>
        ))}
      </div>
      <div className="filterbar filter-selects" style={{ marginTop: 8, marginBottom: 18 }}>
        <label className="filter-select">
          <span>브랜드</span>
          <select value={brand} onChange={(event) => onBrandChange(event.target.value)} aria-label="브랜드 필터">
            <option value="전체">전체</option>
            {brands.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        {colors.length > 0 && (
          <label className="filter-select">
            <span>색상</span>
            <select value={color} onChange={(event) => onColorChange(event.target.value)} aria-label="색상 필터">
              <option value="전체">전체</option>
              {colors.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        )}
        {hasFilters && (
          <button className="fbtn" type="button" onClick={onClearFilters}>
            초기화
          </button>
        )}
      </div>
    </div>
  );
}
