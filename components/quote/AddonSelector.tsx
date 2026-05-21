"use client";

import type { MaterialItem } from "@/lib/service-items";

type AddonSelectorProps = {
  addons: MaterialItem[];
  selectedAddons: string[];
  onChange: (selected: string[]) => void;
};

export function AddonSelector({ addons, selectedAddons, onChange }: AddonSelectorProps) {
  function toggle(sku: string) {
    onChange(selectedAddons.includes(sku) ? selectedAddons.filter((item) => item !== sku) : [...selectedAddons, sku]);
  }

  return (
    <section className="quote-section">
      <div className="section-title-row">
        <h2>추가 옵션</h2>
        <span>필요한 것만 선택</span>
      </div>
      <div className="addon-list">
        {addons.length === 0 ? (
          <p className="muted">추가 옵션이 없는 서비스입니다.</p>
        ) : (
          addons.map((addon) => (
            <label key={addon.sku} className={selectedAddons.includes(addon.sku) ? "addon-row selected" : "addon-row"}>
              <input type="checkbox" checked={selectedAddons.includes(addon.sku)} onChange={() => toggle(addon.sku)} />
              <span>{addon.name}</span>
              <strong>+{addon.retail_price.toLocaleString("ko-KR")}원</strong>
            </label>
          ))
        )}
      </div>
    </section>
  );
}
