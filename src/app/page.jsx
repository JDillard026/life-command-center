export default function Dashboard() {
  return (
    <main className="container">
      <header style={{ marginBottom: 18 }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
          Life Command Center
        </div>
        <h1 style={{ margin: 0, fontSize: 30, letterSpacing: "-0.02em" }}>
          Dashboard
        </h1>
        <div className="muted" style={{ marginTop: 8 }}>
          Quick snapshot of income, bills, spending, and investments.
        </div>
      </header>

      <section className="grid grid-4">
        <Kpi title="Income (MTD)" value="$0" sub="Paychecks + side income" />
        <Kpi title="Bills Due" value="$0" sub="Next 14 days" />
        <Kpi title="Spending (Week)" value="$0" sub="Daily purchases" />
        <Kpi title="Investments" value="$0" sub="Total across accounts" />
      </section>

      <section className="row" style={{ marginTop: 18 }}>
        <Card title="Upcoming (Next 7 Days)">
          <List
            items={[
              { left: "No bills yet", right: "Add your first bill →" },
              { left: "No reminders yet", right: "Add a reminder →" },
              { left: "No subscriptions yet", right: "Track recurring →" },
            ]}
          />
        </Card>

        <Card title="Recent Spending">
          <List
            items={[
              { left: "No transactions yet", right: "Add a purchase →" },
              { left: "Tip: track coffee/food/gas", right: "Fast wins" },
              { left: "Tip: tag purchases", right: "Makes reports easy" },
            ]}
          />
        </Card>
      </section>

      <section className="row" style={{ marginTop: 18 }}>
        <Card title="What to do next">
          <div className="muted" style={{ lineHeight: 1.6 }}>
            1) Add bills + due dates<br />
            2) Add income sources (you + wife)<br />
            3) Track daily purchases (fast entry)<br />
            4) Add investment accounts (VOO/QQQ/crypto/etc.)
          </div>
        </Card>

        <Card title="Rules (simple but powerful)">
          <div className="muted" style={{ lineHeight: 1.6 }}>
            • Bills first, then spending.<br />
            • Weekly “leftover” is the truth number.<br />
            • Track categories so you can cut the right thing.<br />
            • Investing stays consistent (auto, not emotional).
          </div>
        </Card>
      </section>
    </main>
  );
}

function Kpi({ title, value, sub }) {
  return (
    <div className="card">
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        {title}
      </div>
      <div className="kpi">{value}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        {sub}
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 320 }}>
      <div style={{ fontWeight: 850, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function List({ items }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((it, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.08)",
            background: "rgba(255,255,255,.03)",
          }}
        >
          <div>{it.left}</div>
          <div className="muted">{it.right}</div>
        </div>
      ))}
    </div>
  );
}