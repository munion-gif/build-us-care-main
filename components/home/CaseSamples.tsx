"use client";

const cases = [
  ["수원 영통구", "변기 교체", "215,000원", "45분"],
  ["성남 분당구", "수전 교체", "180,000원", "30분"],
  ["용인 수지구", "환풍기 교체", "150,000원", "50분"]
];

export function CaseSamples() {
  return (
    <section className="home-section">
      <h2 className="case-section-title">실제 시공 사례</h2>
      <div className="case-grid">
        {cases.map(([region, service, price, minutes]) => (
          <article key={`${region}-${service}`} className="case-card">
            <div className="case-image" />
            <div className="case-body">
              <span>{region}</span>
              <strong>{service}</strong>
              <p>
                {price} · {minutes}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
