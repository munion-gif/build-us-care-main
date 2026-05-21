export default function Loading() {
  return (
    <div className="adm-content adm-stack">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="adm-card" style={{ minHeight: 88, background: "#f8f7f4" }} />
      ))}
    </div>
  );
}
