export default function Loading() {
  return (
    <main className="route-loading-page" aria-label="페이지 로딩 중">
      <section className="route-loading-panel">
        <div className="route-loading-line short" />
        <div className="route-loading-block hero" />
        <div className="route-loading-grid">
          <div className="route-loading-block" />
          <div className="route-loading-block" />
          <div className="route-loading-block" />
        </div>
      </section>
    </main>
  );
}
