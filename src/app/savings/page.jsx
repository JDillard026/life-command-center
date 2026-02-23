export default function Savings() {
  return (
    <main className="container">
      <h1 style={{ marginTop: 0 }}>Savings Goals</h1>

      <div className="grid grid-3">
        <GoalCard
          title="Emergency Fund"
          current={2000}
          target={10000}
        />
        <GoalCard
          title="House Projects"
          current={1500}
          target={5000}
        />
        <GoalCard
          title="Future Investment Boost"
          current={3000}
          target={15000}
        />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          Monthly Savings Strategy (coming next)
        </div>
        <div className="muted">
          We’ll auto-allocate leftover money into goals based on priority.
        </div>
      </div>
    </main>
  );
}

function GoalCard({ title, current, target }) {
  const percent = Math.min(100, Math.round((current / target) * 100));

  return (
    <div className="card">
      <div style={{ fontWeight: 800, marginBottom: 8 }}>
        {title}
      </div>

      <div style={{ fontSize: 22, fontWeight: 900 }}>
        ${current.toLocaleString()}
      </div>

      <div className="muted" style={{ marginBottom: 12 }}>
        of ${target.toLocaleString()}
      </div>

      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: "rgba(255,255,255,.08)",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            background: "linear-gradient(90deg,#4ade80,#22d3ee)"
          }}
        />
      </div>

      <div className="muted" style={{ marginTop: 8 }}>
        {percent}% complete
      </div>
    </div>
  );
}