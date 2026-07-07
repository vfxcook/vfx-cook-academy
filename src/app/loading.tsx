export default function Loading() {
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <section className="card">
        <h1 style={{ marginTop: 0, marginBottom: "0.4rem" }}>Loading...</h1>
        <p className="muted" style={{ margin: 0 }}>
          Fetching latest course and dashboard data.
        </p>
      </section>
      <section className="card" style={{ minHeight: 120 }} />
    </div>
  );
}
