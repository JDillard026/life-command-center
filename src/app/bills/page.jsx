"use client";

import { useEffect, useMemo, useState } from "react";

const LS_BILLS = "lcc_bills_v1";

function safeParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now());
}

function isoDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

export default function BillsPage() {
  const [items, setItems] = useState([]); // {id,name,amount,dueDate,createdAt}
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(isoDate());
  const [sortBy, setSortBy] = useState("due_asc"); // due_asc | amt_desc | name_asc
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = safeParse(localStorage.getItem(LS_BILLS) || "[]", []);
    setItems(Array.isArray(saved) ? saved : []);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_BILLS, JSON.stringify(items));
    } catch {}
  }, [items]);

  function addBill(e) {
    e.preventDefault();
    setError("");

    const nm = String(name || "").trim();
    const amt = parseMoneyInput(amount);
    const dd = String(dueDate || "").trim();

    if (!nm) return setError("Bill name is required.");
    if (!Number.isFinite(amt) || amt <= 0) return setError("Amount must be > 0.");
    if (!dd) return setError("Due date is required.");

    setItems((prev) => [
      { id: uid(), name: nm, amount: amt, dueDate: dd, createdAt: Date.now() },
      ...prev,
    ]);

    setName("");
    setAmount("");
    setDueDate(isoDate());
  }

  function removeBill(id) {
    if (!confirm("Delete this bill?")) return;
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  const computed = useMemo(() => {
    const list = items.slice();

    list.sort((a, b) => {
      if (sortBy === "due_asc") return String(a.dueDate).localeCompare(String(b.dueDate));
      if (sortBy === "amt_desc") return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (sortBy === "name_asc") return String(a.name).localeCompare(String(b.name));
      return 0;
    });

    const total = list.reduce((s, x) => s + (Number(x.amount) || 0), 0);

    const today = isoDate();
    const nextDue = list
      .filter((x) => x.dueDate >= today)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];

    return { list, total, nextDue };
  }, [items, sortBy]);

  return (
    <main className="container">
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Bills</div>
        <h1 style={{ margin: 0 }}>Bills Tracker</h1>
        <div className="muted" style={{ marginTop: 6 }}>
          Total monthly bills: <b>{money(computed.total)}</b> • Next due:{" "}
          <b>{computed.nextDue ? `${computed.nextDue.name} (${computed.nextDue.dueDate})` : "—"}</b>
        </div>
      </header>

      {/* Add Bill */}
      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>Add Bill</div>

        <form onSubmit={addBill} className="grid" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="Bill name (Rent, Internet, Car payment...)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
            <input
              className="input"
              placeholder="Amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ width: 180 }}
            />
            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ width: 180 }}
            />
          </div>

          {error ? (
            <div className="card" style={{ padding: 10 }}>
              <div style={{ fontWeight: 950 }}>Fix this:</div>
              <div className="muted" style={{ marginTop: 4 }}>{error}</div>
            </div>
          ) : null}

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn" type="submit">Add Bill</button>
            <button
              className="btnGhost"
              type="button"
              onClick={() => {
                setName("");
                setAmount("");
                setDueDate(isoDate());
                setError("");
              }}
            >
              Clear
            </button>

            <div className="muted" style={{ fontSize: 12 }}>
              Tip: Use the real due date for this month. We’ll add “recurring monthly” automation next.
            </div>
          </div>
        </form>
      </div>

      {/* Upcoming Bills */}
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 950 }}>Upcoming Bills</div>

          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <div className="muted" style={{ fontSize: 12 }}>Sort</div>
            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: 200 }}>
              <option value="due_asc">Due date (soon → later)</option>
              <option value="amt_desc">Amount (high → low)</option>
              <option value="name_asc">Name (A → Z)</option>
            </select>
          </div>
        </div>

        <div style={{ height: 10 }} />

        {computed.list.length === 0 ? (
          <div className="muted">No bills yet. Add your first one above.</div>
        ) : (
          <div className="grid">
            {computed.list.map((b) => (
              <div key={b.id} className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 950 }}>{b.name}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Amount {money(b.amount)} • Due {b.dueDate}
                    </div>
                  </div>

                  <div className="row" style={{ gap: 8 }}>
                    <button className="btnGhost" type="button" onClick={() => removeBill(b.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}