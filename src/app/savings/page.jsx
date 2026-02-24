"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

const LS_KEY = "lcc_savings_goals";

function safeParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function parseMoneyInput(v) {
  // allows: 1000, 1,000, $1,000.50
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function SavingsPage() {
  const [goals, setGoals] = useState([]);

  // add form
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");

  // edit
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    name: "",
    target: "",
    current: "",
    dueDate: "",
  });

  // load
  useEffect(() => {
    const saved = safeParse(localStorage.getItem(LS_KEY) || "[]", []);
    setGoals(Array.isArray(saved) ? saved : []);
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(goals));
    } catch {}
  }, [goals]);

  function addGoal(e) {
    e.preventDefault();
    setError("");

    const n = name.trim();
    const t = parseMoneyInput(target);
    const c = parseMoneyInput(current === "" ? "0" : current);

    if (!n) return setError("Goal name is required.");
    if (!Number.isFinite(t) || t <= 0) return setError("Target must be a number greater than 0.");
    if (!Number.isFinite(c) || c < 0) return setError("Current saved must be 0 or more.");

    const id = globalThis.crypto?.randomUUID?.() ?? String(Date.now());

    setGoals((prev) => [
      {
        id,
        name: n,
        target: t,
        current: c,
        dueDate: dueDate || "",
        createdAt: Date.now(),
      },
      ...prev,
    ]);

    setName("");
    setTarget("");
    setCurrent("");
    setDueDate("");
  }

  function startEdit(g) {
    setEditingId(g.id);
    setError("");
    setEditDraft({
      name: g.name || "",
      target: String(g.target ?? ""),
      current: String(g.current ?? ""),
      dueDate: g.dueDate || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({ name: "", target: "", current: "", dueDate: "" });
  }

  function saveEdit(id) {
    const n = editDraft.name.trim();
    const t = parseMoneyInput(editDraft.target);
    const c = parseMoneyInput(editDraft.current === "" ? "0" : editDraft.current);

    if (!n) return setError("Goal name is required.");
    if (!Number.isFinite(t) || t <= 0) return setError("Target must be a number greater than 0.");
    if (!Number.isFinite(c) || c < 0) return setError("Current saved must be 0 or more.");

    setGoals((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, name: n, target: t, current: c, dueDate: editDraft.dueDate || "" } : g
      )
    );
    cancelEdit();
  }

  function removeGoal(id) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (editingId === id) cancelEdit();
  }

  const totals = useMemo(() => {
    const totalTarget = goals.reduce((s, g) => s + (Number(g.target) || 0), 0);
    const totalCurrent = goals.reduce((s, g) => s + (Number(g.current) || 0), 0);
    return { totalTarget, totalCurrent };
  }, [goals]);

  return (
    <main className="container">
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Savings
        </div>
        <h1 style={{ margin: 0 }}>Savings Goals</h1>
        <div className="muted" style={{ marginTop: 8 }}>
          Add goals, update progress, and track what’s left.
        </div>
      </header>

      <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
        {/* LEFT: Add */}
        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Add a goal</div>

          <form onSubmit={addGoal} className="grid" style={{ gap: 10 }}>
            <input
              className="input"
              placeholder="Goal name (ex: Emergency Fund, Vacation, Truck down payment)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="row" style={{ gap: 10 }}>
              <input
                className="input"
                inputMode="decimal"
                placeholder="Target amount (ex: 1000 or $1,000)"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                className="input"
                inputMode="decimal"
                placeholder="Current saved (ex: 250)"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>

            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <input
                className="input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ width: 180 }}
              />
            </div>

            {/* Show error (below inputs, above buttons) */}
            {error && (
              <div className="card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 900 }}>Fix this:</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {error}
                </div>
              </div>
            )}

            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <button className="btn" type="submit">
                Add
              </button>
              <button
                className="btnGhost"
                type="button"
                onClick={() => {
                  setName("");
                  setTarget("");
                  setCurrent("");
                  setDueDate("");
                  setError("");
                }}
              >
                Clear
              </button>
            </div>

            <div className="muted" style={{ fontSize: 12 }}>
              Tip: Keep goals separate (Emergency Fund, Vacation, House projects).
            </div>
          </form>
        </div>

        {/* RIGHT: Summary */}
        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Summary</div>

          <div className="row" style={{ gap: 10 }}>
            <div className="card" style={{ padding: 12, flex: 1 }}>
              <div className="muted" style={{ fontSize: 12 }}>Total saved</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{money(totals.totalCurrent)}</div>
            </div>
            <div className="card" style={{ padding: 12, flex: 1 }}>
              <div className="muted" style={{ fontSize: 12 }}>Total targets</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{money(totals.totalTarget)}</div>
            </div>
          </div>

          <div style={{ height: 10 }} />
          <div className="muted" style={{ fontSize: 12 }}>
            Next: We can add “Quick add” buttons (+$25/+100/custom) per goal.
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* LIST */}
      <div className="card">
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Your goals</div>

        {goals.length === 0 ? (
          <div className="muted">No goals yet. Add your first goal above.</div>
        ) : (
          <div className="grid">
            {goals.map((g) => {
              const t = Number(g.target) || 0;
              const c = Number(g.current) || 0;
              const pct = t > 0 ? Math.min(100, Math.round((c / t) * 100)) : 0;
              const left = Math.max(0, t - c);
              const isEditing = editingId === g.id;

              return (
                <div key={g.id} className="card" style={{ padding: 12 }}>
                  {isEditing ? (
                    <>
                      <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <input
                          className="input"
                          value={editDraft.name}
                          onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                          style={{ flex: 2, minWidth: 220 }}
                        />
                        <input
                          className="input"
                          inputMode="decimal"
                          value={editDraft.target}
                          onChange={(e) => setEditDraft((d) => ({ ...d, target: e.target.value }))}
                          placeholder="Target"
                          style={{ width: 140 }}
                        />
                        <input
                          className="input"
                          inputMode="decimal"
                          value={editDraft.current}
                          onChange={(e) => setEditDraft((d) => ({ ...d, current: e.target.value }))}
                          placeholder="Current"
                          style={{ width: 140 }}
                        />
                        <input
                          className="input"
                          type="date"
                          value={editDraft.dueDate}
                          onChange={(e) => setEditDraft((d) => ({ ...d, dueDate: e.target.value }))}
                          style={{ width: 170 }}
                        />

                        <button className="btn" type="button" onClick={() => saveEdit(g.id)}>
                          Save
                        </button>
                        <button className="btnGhost" type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 16 }}>{g.name}</div>
                          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                            Target {money(t)} • Saved {money(c)} • Left {money(left)}
                            {g.dueDate ? ` • Due ${g.dueDate}` : ""}
                          </div>
                        </div>

                        <div className="row" style={{ gap: 8 }}>
                          <button className="btnGhost" type="button" onClick={() => startEdit(g)}>
                            Edit
                          </button>
                          <button className="btnGhost" type="button" onClick={() => removeGoal(g.id)}>
                            Delete
                          </button>
                        </div>
                      </div>

                      <div style={{ height: 10 }} />

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            flex: 1,
                            height: 10,
                            borderRadius: 999,
                            border: "1px solid var(--stroke)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: "rgba(99, 179, 237, .35)",
                            }}
                          />
                        </div>
                        <div className="pill">{pct}%</div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}