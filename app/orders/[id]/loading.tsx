export default function Loading() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--color-bg)", padding: "18px" }}>
      <section style={{ width: "min(780px, 100%)", margin: "0 auto", display: "grid", gap: 14 }}>
        <div style={{ height: 130, borderRadius: 20, background: "#f3f1ee" }} />
        <div style={{ height: 220, borderRadius: 20, background: "#f3f1ee" }} />
        <div style={{ height: 160, borderRadius: 20, background: "#f3f1ee" }} />
      </section>
    </main>
  );
}
