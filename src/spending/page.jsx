"use client";

import { useEffect, useMemo, useState } from "react";
import { lsGet, lsSet } from "../lib/storage";

export const dynamic = "force-dynamic";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeekISO(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // make Monday start
  d.setDate(d.getDate() - diff);
  return d.toISOString().split("T")[0];
}

const CATS = ["Gas", "Food", "Coffee", "Bills", "Misc"];

export default function SpendingPage() {
  const [items, setItems] = useState([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Misc");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());

  useEffect(() => {
    setItems(lsGet("lcc_spending", []));
  }, []);

  useEffect(() => {
    lsSet("lcc_spending", items);
  }, [items]);

  function add(e) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;

    const id = globalThis.crypto?.randomUUID?.() ?? String(Date.now());

    setItems((prev) => [
      { id, amount: n, category, note: note.trim(), date, createdAt: Date.now() },
      ...prev,
    ]);

    setAmount("");
    setNote("");
    setCategory("Misc");
    setDate(todayISO());
  }

  function remove(id) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  const weekStart = startOfWeekISO();
  const weekItems = useMemo(() => items.filter((x) => x.date >= weekStart), [items, weekStart]);

  const weekTotal = useMemo(
    () => weekItems.reduce((sum, x) => sum + (Number(x.amount) || 0), 0),
    [weekItems]
  );

  const topCategory = useMemo(() => {
    const map = new Map();
    for (const x of weekItems) {
      const k = x.category || "Misc";
      map.set(k, (map.get(k) || 0) + (Number(x.amount) || 0));
    }
    let best = null;
    for (const [k, v] of map.entries()) if (!best || v > best.v) best = { k, v };
    return best?.k ?? "—";
  }, [weekItems]);

  const avgPerDay = useMemo(() => {
    if (weekItems.length === 0) return 0;
    // rough avg: total / 7
    return weekTotal / 7;
  }, [weekTotal, weekItems.length]);

  return (
    <main className="container">
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Spending
        </div>
        <h1 style={{ margin: 0 }}>Daily Spending</h1>
        <div className="muted" style={{ marginTop: 8 }}>
          Quick entry. Weekly summary. No guilt—just truth.
        </div>
      </header>

      <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Quick Add</div>

          <form onSubmit={add} className="grid" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 10 }}>
              <input
                className="input"
                inputMode="decimal"
                placeholder="Amount (ex: 12.50)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                className="input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ width: 170 }}
              />
            </div>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {CATS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={c === category ? "btn" : "btnGhost"}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="row" style={{ gap: 10 }}>
              <input
                className="input"
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn" type="submit">
                Add
              </button>
            </div>

            <div className="muted" style={{ fontSize: 12 }}>
              Tip: keep notes short (“Wawa”, “Lunch”, “Oil”, “Kids snacks”).
            </div>
          </form>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>This Week</div>

          <div className="grid" style={{ gap: 10 }}>
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>Total</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>
                {weekTotal.toLocaleString(undefined, { style: "currency", currency: "USD" })}
              </div>
            </div>

            <div className="row" style={{ gap: 10 }}>
              <div className="card" style={{ padding: 12, flex: 1 }}>
                <div className="muted" style={{ fontSize: 12 }}>Top category</div>
                <div style={{ fontWeight: 900 }}>{topCategory}</div>
              </div>
              <div className="card" style={{ padding: 12, flex: 1 }}>
                <div className="muted" style={{ fontSize: 12 }}>Avg/day</div>
                <div style={{ fontWeight: 900 }}>
                  {avgPerDay.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                </div>
              </div>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={{ fontWeight: 900, marginBottom: 8 }}>Recent Purchases</div>

          {items.length === 0 ? (
            <div className="muted">No purchases yet.</div>
          ) : (
            <div className="grid">
              {items.slice(0, 20).map((x) => (
                <div key={x.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>
                        {Number(x.amount).toLocaleString(undefined, { style: "currency", currency: "USD" })} •{" "}
                        {x.category || "Misc"}
                      </div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {x.date} {x.note ? `• ${x.note}` : ""}
                      </div>
                    </div>
                    <button className="btnGhost" type="button" onClick={() => remove(x.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}