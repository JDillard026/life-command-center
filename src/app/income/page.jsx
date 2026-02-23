"use client";
import { useEffect, useMemo, useState } from "react";

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function Income() {
const [items, setItems] = useState([]);
const [mounted, setMounted] = useState(false);


  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
  setMounted(true);
  const saved = JSON.parse(localStorage.getItem("income") || "[]");
  setItems(saved);
}, []);

  useEffect(() => {
    localStorage.setItem("income", JSON.stringify(items));
  }, [items]);

  function addIncome(e) {
    e.preventDefault();
    const amt = Number(amount);
    if (!name.trim()) return;
    if (!Number.isFinite(amt) || amt <= 0) return;

    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        name: name.trim(),
        amount: amt,
      },
    ]);

    setName("");
    setAmount("");
  }

  function removeIncome(id) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  const monthlyTotal = useMemo(
    () => items.reduce((sum, x) => sum + x.amount, 0),
    [items]
  );

  return (
    <main className="container">
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Income
        </div>
        <h1 style={{ margin: 0 }}>Income Tracker</h1>

<div className="muted" style={{ marginTop: 8 }}>
  Monthly total:{" "}
  <span style={{ fontWeight: 900 }}>
    {mounted ? money(monthlyTotal) : "—"}
  </span>
</div>
      </header>

      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={addIncome} className="formGrid">
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Income name
            </div>
            <input
              className="input"
              placeholder="Jacob paycheck, Wife paycheck, Side hustle..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Monthly amount
            </div>
            <input
              className="input"
              placeholder="0.00"
              inputMode="decimal"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div />

          <button className="btn" type="submit">
            Add Income
          </button>
        </form>

        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Tip: Put the monthly net amount (take-home). We’ll add “pay frequency” later.
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 900 }}>Income Sources</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Saved automatically
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {items.length === 0 ? (
            <div className="muted">No income yet. Add one above.</div>
          ) : (
            items.map((x) => (
              <div key={x.id} className="tableRow">
                <div style={{ fontWeight: 850 }}>{x.name}</div>
                <div style={{ fontWeight: 900 }}>{money(x.amount)}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  monthly
                </div>
                <button className="btnGhost" onClick={() => removeIncome(x.id)}>
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}