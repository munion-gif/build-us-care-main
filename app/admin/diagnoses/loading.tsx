export default function Loading() {
  return (
    <div className="adm-content adm-stack">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="adm-card" style={{ minHeight: 78, background: "#f8f7f4" }} />
      ))}
    </div>
  );
}
