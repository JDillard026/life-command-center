export default function Spending() {
  return (
    <main className="container">
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Spending</div>
        <h1 style={{ margin: 0 }}>Daily Spending</h1>
        <div className="muted" style={{ marginTop: 6 }}>
          Quick add, weekly summary, and recent purchases.
        </div>
      </header>

      {/* Quick Add */}
      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>Quick Add</div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input className="input" placeholder="Amount" inputMode="decimal" style={{ width: 160 }} />
          <select className="input" style={{ width: 220 }}>
            <option value="">Category…</option>
            <option>Gas</option>
            <option>Food</option>
            <option>Coffee</option>
            <option>Bills</option>
            <option>Misc</option>
          </select>
          <input className="input" placeholder="Note (optional)" style={{ flex: 1, minWidth: 220 }} />
          <input className="input" type="date" style={{ width: 170 }} />

          <button className="btn" type="button">Add</button>
          <button className="btnGhost" type="button">Clear</button>
        </div>

        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          (Hook this to storage next) One-tap categories + fast entry.
        </div>
      </div>

      {/* Summary cards */}
      <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "stretch" }}>
        <div className="card" style={{ padding: 12, flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 950, marginBottom: 6 }}>This Week</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Total: $0 • Top category: — • Avg/day: —
          </div>

          <div className="card" style={{ padding: 12, marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>(Next: chart + list)</div>
          </div>
        </div>

        <div className="card" style={{ padding: 12, flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 950, marginBottom: 6 }}>Recent Purchases</div>
          <div className="muted" style={{ fontSize: 12 }}>No purchases yet.</div>

          <div style={{ height: 10 }} />

          <div className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Add items above to populate this list.
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* Placeholder list card */}
      <div className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 950, marginBottom: 6 }}>All Spending</div>
        <div className="muted" style={{ fontSize: 12 }}>
          (Next: filters + table just like Investments transactions)
        </div>
      </div>
    </main>
  );
}