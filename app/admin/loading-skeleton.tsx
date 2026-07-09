export function AdminSkeleton() {
  const bar = (w: number | string, h: number) => ({ width: w, height: h, borderRadius: 8, background: "#eef1f5" });
  return (
    <div style={{ padding: "26px clamp(16px, 2.4vw, 34px)" }}>
      <style>{`@keyframes admpulse{0%,100%{opacity:1}50%{opacity:.5}} .adm-sk *{animation:admpulse 1.1s ease-in-out infinite}`}</style>
      <div className="adm-sk" style={{ display: "grid", gap: 16 }}>
        <div style={bar(200, 26)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 92, borderRadius: 16, background: "#f1f3f6" }} />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 90, borderRadius: 14, background: "#f1f3f6" }} />
        ))}
      </div>
    </div>
  );
}
