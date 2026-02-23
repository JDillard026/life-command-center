"use client";
import { useMemo, useState, useEffect } from "react";

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Bills() {
const [bills, setBills] = useState([]);
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
  const saved = JSON.parse(localStorage.getItem("bills") || "[]");
  setBills(saved);
}, []);

useEffect(() => {
  if (!mounted) return;
  localStorage.setItem("bills", JSON.stringify(bills));
}, [mounted, bills]);

const [name, setName] = useState("");
const [amount, setAmount] = useState("");
const [dueDate, setDueDate] = useState(""); // YYYY-MM-DD

  function addBill(e) {
    e.preventDefault();
    const amt = Number(amount);

    if (!name.trim()) return;
    if (!Number.isFinite(amt) || amt <= 0) return;
    if (!dueDate) return;

    setBills((prev) => [
      ...prev,
      {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        name: name.trim(),
        amount: amt,
        dueDate,
      },
    ]);

    setName("");
    setAmount("");
    setDueDate("");
  }

  function removeBill(id) {
    setBills((prev) => prev.filter((b) => b.id !== id));
  }

  const total = useMemo(() => bills.reduce((sum, b) => sum + b.amount, 0), [bills]);

  const sorted = useMemo(() => {
    return [...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [bills]);

  const nextDue = sorted[0]?.dueDate ?? null;

  return (
    <main className="container">
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Bills
        </div>
        <h1 style={{ margin: 0 }}>Bills Tracker</h1>
        <div className="muted" style={{ marginTop: 8 }}>
          Total monthly bills: <span style={{ fontWeight: 900 }}>{money(total)}</span> • Next due:{" "}
          <span style={{ fontWeight: 900 }}>{fmtDate(nextDue)}</span>
        </div>
      </header>

      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={addBill} className="formGrid">
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Bill name
            </div>
            <input
              className="input"
              placeholder="Rent, Internet, Car payment..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Amount
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

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Due date
            </div>
            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <button className="btn" type="submit">
            Add Bill
          </button>
        </form>

        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Tip: Use the real due date for this month. We’ll add “recurring monthly” automation next.
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
          <div style={{ fontWeight: 900 }}>Upcoming Bills</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Sorted by due date
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {sorted.length === 0 ? (
            <div className="muted">No bills yet. Add your first one above.</div>
          ) : (
            sorted.map((b) => {
              const pct = total > 0 ? Math.round((b.amount / total) * 100) : 0;

              return (
                <div key={b.id} className="tableRow">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {b.name}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Due {fmtDate(b.dueDate)} • {pct}% of total bills
                    </div>
                    <div className="barWrap" style={{ marginTop: 10 }}>
                      <div className="barFill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div style={{ fontWeight: 900 }}>{money(b.amount)}</div>

                  <div className="muted" style={{ fontSize: 12 }}>
                    {b.dueDate}
                  </div>

                  <button className="btnGhost" onClick={() => removeBill(b.id)} title="Remove">
                    Remove
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}