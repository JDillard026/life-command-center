export default function Spending() {
  return (
    <main className="container">
      <h1 style={{ marginTop: 0 }}>Daily Spending</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Quick Add (coming next)</div>
        <div className="muted">
          We’ll add a fast form here: amount, category, note, date — with “gas / food / coffee / bills / misc”
          one-tap buttons.
        </div>
      </div>

      <div className="row">
        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>This Week</div>
          <div className="muted">Total: $0 • Top category: — • Avg/day: —</div>
          <div style={{ marginTop: 12 }} className="muted">
            (Next: chart + list)
          </div>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Recent Purchases</div>
          <div className="muted">No purchases yet.</div>
        </div>
      </div>
    </main>
  );
}