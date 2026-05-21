export default function Loading() {
  return (
    <div className="adm-content adm-stack">
      <div className="adm-kpi-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="adm-kpi-card" style={{ minHeight: 96, background: "#f8f7f4" }} />
        ))}
      </div>
      <div className="adm-card" style={{ height: 280, background: "#f8f7f4" }} />
    </div>
  );
}
