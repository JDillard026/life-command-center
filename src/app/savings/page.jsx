"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

const LS_KEY = "lcc_savings_goals";

/** ---------- utils ---------- **/
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

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(iso) {
  if (!iso) return null;
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const d = new Date(iso + "T00:00:00").getTime();
  return Math.round((d - t0) / 86400000);
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function computeNeeded(left, dueIso) {
  const d = daysUntil(dueIso);
  if (d === null) return { daysLeft: null, perDay: null, perWeek: null };
  const daysLeft = Math.max(0, d);
  if (daysLeft === 0) return { daysLeft, perDay: left, perWeek: left };
  const perDay = left / daysLeft;
  const perWeek = left / (daysLeft / 7);
  return { daysLeft, perDay, perWeek };
}

/** ---------- presets ---------- **/
const GOAL_PRESETS = [
  "Emergency Fund",
  "Vacation",
  "Truck / Car Fund",
  "House Projects",
  "Christmas / Gifts",
  "Taxes",
  "Investing (Cash to Brokerage)",
  "Other",
];

const QUICK_AMOUNTS = [25, 100, 250, 500];

function Pill({ children, tone = "default", title }) {
  const tones = {
    default: { bg: "rgba(255,255,255,.06)", bd: "rgba(255,255,255,.10)", tx: "var(--text)" },
    emerald: { bg: "rgba(16,185,129,.14)", bd: "rgba(16,185,129,.28)", tx: "var(--text)" },
    steel: { bg: "rgba(148,163,184,.12)", bd: "rgba(148,163,184,.22)", tx: "var(--text)" },
    danger: { bg: "rgba(239,68,68,.14)", bd: "rgba(239,68,68,.28)", tx: "var(--text)" },
  };
  const t = tones[tone] || tones.default;

  return (
    <span
      className="pill"
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "7px 12px",
        borderRadius: 999,
        border: `1px solid ${t.bd}`,
        background: t.bg,
        color: t.tx,
        fontWeight: 900,
        fontSize: 12,
        lineHeight: "12px",
        letterSpacing: 0.4,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Select({ value, onChange, children, style, title }) {
  return (
    <select
      className="input"
      value={value}
      onChange={onChange}
      title={title}
      style={{
        color: "var(--text)",
        backgroundColor: "rgba(15,26,47,.85)",
        border: "1px solid var(--stroke)",
        paddingRight: 34,
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        backgroundImage:
          "linear-gradient(45deg, transparent 50%, rgba(233,240,255,.75) 50%), linear-gradient(135deg, rgba(233,240,255,.75) 50%, transparent 50%)",
        backgroundPosition: "calc(100% - 18px) 50%, calc(100% - 12px) 50%",
        backgroundSize: "6px 6px, 6px 6px",
        backgroundRepeat: "no-repeat",
        ...style,
      }}
    >
      {children}
    </select>
  );
}

export default function SavingsPage() {
  const [goals, setGoals] = useState([]);

  // add form
  const [preset, setPreset] = useState(GOAL_PRESETS[0]);
  const [customName, setCustomName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [error, setError] = useState("");

  // list controls
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("priority_then_due");
  const [showArchived, setShowArchived] = useState(false);

  // edit
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    name: "",
    target: "",
    current: "",
    dueDate: "",
    priority: "Medium",
    archived: false,
  });

  // contribute panel
  const [openId, setOpenId] = useState(null);
  const [customAdd, setCustomAdd] = useState({});
  const [customNote, setCustomNote] = useState({});

  // import/export
  const [ioOpen, setIoOpen] = useState(false);
  const [ioText, setIoText] = useState("");

  // responsive
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 980);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // load
  useEffect(() => {
    const saved = safeParse(localStorage.getItem(LS_KEY) || "[]", []);
    const normalized = Array.isArray(saved) ? saved : [];
    const fixed = normalized.map((g) => ({
      id: g.id ?? uid(),
      name: String(g.name ?? "").trim(),
      target: Number(g.target) || 0,
      current: Number(g.current) || 0,
      dueDate: g.dueDate || "",
      priority: g.priority || "Medium",
      archived: !!g.archived,
      createdAt: g.createdAt ?? Date.now(),
      contributions: Array.isArray(g.contributions) ? g.contributions : [],
    }));
    setGoals(fixed);
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(goals));
    } catch {}
  }, [goals]);

  function resolvedName() {
    if (preset && preset !== "Other") return preset;
    return customName.trim();
  }

  function clearAddForm() {
    setPreset(GOAL_PRESETS[0]);
    setCustomName("");
    setTarget("");
    setCurrent("");
    setDueDate("");
    setPriority("Medium");
    setError("");
  }

  function addGoal(e) {
    e.preventDefault();
    setError("");

    const n = resolvedName();
    const t = parseMoneyInput(target);
    const c = parseMoneyInput(current === "" ? "0" : current);

    if (!n) return setError("Goal name is required.");
    if (!Number.isFinite(t) || t <= 0) return setError("Target must be a number greater than 0.");
    if (!Number.isFinite(c) || c < 0) return setError("Current saved must be 0 or more.");

    const id = uid();

    setGoals((prev) => [
      {
        id,
        name: n,
        target: t,
        current: c,
        dueDate: dueDate || "",
        priority: priority || "Medium",
        archived: false,
        createdAt: Date.now(),
        contributions: c > 0 ? [{ id: uid(), date: todayISO(), amount: c, note: "Starting balance" }] : [],
      },
      ...prev,
    ]);

    clearAddForm();
  }

  function startEdit(g) {
    setEditingId(g.id);
    setError("");
    setEditDraft({
      name: g.name || "",
      target: String(g.target ?? ""),
      current: String(g.current ?? ""),
      dueDate: g.dueDate || "",
      priority: g.priority || "Medium",
      archived: !!g.archived,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({ name: "", target: "", current: "", dueDate: "", priority: "Medium", archived: false });
  }

  function saveEdit(id) {
    setError("");

    const n = editDraft.name.trim();
    const t = parseMoneyInput(editDraft.target);
    const c = parseMoneyInput(editDraft.current === "" ? "0" : editDraft.current);

    if (!n) return setError("Goal name is required.");
    if (!Number.isFinite(t) || t <= 0) return setError("Target must be a number greater than 0.");
    if (!Number.isFinite(c) || c < 0) return setError("Current saved must be 0 or more.");

    setGoals((prev) =>
      prev.map((g) =>
        g.id === id
          ? {
              ...g,
              name: n,
              target: t,
              current: c,
              dueDate: editDraft.dueDate || "",
              priority: editDraft.priority || "Medium",
              archived: !!editDraft.archived,
            }
          : g
      )
    );

    cancelEdit();
  }

  function removeGoal(id) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (openId === id) setOpenId(null);
    if (editingId === id) cancelEdit();
  }

  function setArchived(goalId, archived) {
    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, archived: !!archived } : g)));
  }

  function applyContribution(goalId, amount, note) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Contribution amount must be a number greater than 0.");
      return;
    }
    setError("");

    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const nextCurrent = (Number(g.current) || 0) + amt;
        const entry = { id: uid(), date: todayISO(), amount: amt, note: String(note || "").trim() };
        return {
          ...g,
          current: nextCurrent,
          contributions: [entry, ...(Array.isArray(g.contributions) ? g.contributions : [])],
        };
      })
    );

    setCustomAdd((m) => ({ ...m, [goalId]: "" }));
    setCustomNote((m) => ({ ...m, [goalId]: "" }));
  }

  function undoLast(goalId) {
    setError("");
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const list = Array.isArray(g.contributions) ? g.contributions : [];
        if (list.length === 0) return g;
        const [last, ...rest] = list;
        const nextCurrent = Math.max(0, (Number(g.current) || 0) - (Number(last.amount) || 0));
        return { ...g, current: nextCurrent, contributions: rest };
      })
    );
  }

  const totals = useMemo(() => {
    const active = goals.filter((g) => !g.archived);
    const totalTarget = active.reduce((s, g) => s + (Number(g.target) || 0), 0);
    const totalCurrent = active.reduce((s, g) => s + (Number(g.current) || 0), 0);
    const left = Math.max(0, totalTarget - totalCurrent);
    const overallPct = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

    const dueSoonCount = active.reduce((count, g) => {
      const d = daysUntil(g.dueDate);
      if (d === null) return count;
      return d >= 0 && d <= 14 ? count + 1 : count;
    }, 0);

    return { totalTarget, totalCurrent, left, overallPct: clamp(overallPct, 0, 100), dueSoonCount };
  }, [goals]);

  const filteredGoals = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = goals.slice();

    if (!showArchived) list = list.filter((g) => !g.archived);
    if (q) list = list.filter((g) => String(g.name || "").toLowerCase().includes(q));

    const prioRank = (p) => (p === "High" ? 0 : p === "Medium" ? 1 : 2);

    const getPct = (g) => {
      const t = Number(g.target) || 0;
      const c = Number(g.current) || 0;
      if (t <= 0) return 0;
      return clamp((c / t) * 100, 0, 100);
    };

    const dueKey = (g) => {
      if (!g.dueDate) return Number.POSITIVE_INFINITY;
      const d = daysUntil(g.dueDate);
      return d === null ? Number.POSITIVE_INFINITY : d;
    };

    list.sort((a, b) => {
      if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""));
      if (sortBy === "due") return dueKey(a) - dueKey(b);
      if (sortBy === "progress") return getPct(b) - getPct(a);
      if (sortBy === "left") {
        const la = Math.max(0, (Number(a.target) || 0) - (Number(a.current) || 0));
        const lb = Math.max(0, (Number(b.target) || 0) - (Number(b.current) || 0));
        return lb - la;
      }
      const pr = prioRank(a.priority) - prioRank(b.priority);
      if (pr !== 0) return pr;
      return dueKey(a) - dueKey(b);
    });

    return list;
  }, [goals, query, sortBy, showArchived]);

  const prTone = (p) => (p === "High" ? "danger" : p === "Low" ? "steel" : "emerald");

  // MAIN GRID: minmax(0,1fr) prevents right column overflow.
  const gridWrapStyle = isNarrow
    ? { display: "grid", gridTemplateColumns: "1fr", gap: 12, alignItems: "start" }
    : { display: "grid", gridTemplateColumns: "380px minmax(0, 1fr)", gap: 12, alignItems: "start" };

  // ADD FORM: FIX “New allocation” alignment by using grid (not flex rows)
  const pairGrid = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    alignItems: "start",
    minWidth: 0,
  };

  return (
    <main className="container">
      <header style={{ marginBottom: 10 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
          Savings • Allocations
        </div>

        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, letterSpacing: -0.3 }}>Savings Goals</h1>
            <div className="muted" style={{ marginTop: 6 }}>
              Build targets, then fund them with contributions. Clean. Trackable. Done.
            </div>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button className="btnGhost" type="button" onClick={() => setIoOpen((v) => !v)}>
              Import / Export
            </button>
            <button
              className="btnGhost"
              type="button"
              onClick={() => {
                setQuery("");
                setSortBy("priority_then_due");
                setShowArchived(false);
              }}
            >
              Reset view
            </button>
          </div>
        </div>
      </header>

      {/* KPI strip */}
      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="card" style={{ padding: 12, flex: 1, minWidth: 170 }}>
            <div className="muted" style={{ fontSize: 12 }}>Total saved</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{money(totals.totalCurrent)}</div>
          </div>

          <div className="card" style={{ padding: 12, flex: 1, minWidth: 170 }}>
            <div className="muted" style={{ fontSize: 12 }}>Total target</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{money(totals.totalTarget)}</div>
          </div>

          <div className="card" style={{ padding: 12, flex: 1, minWidth: 170 }}>
            <div className="muted" style={{ fontSize: 12 }}>Left to fund</div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{money(totals.left)}</div>
          </div>

          <div className="card" style={{ padding: 12, flex: 1, minWidth: 170 }}>
            <div className="muted" style={{ fontSize: 12 }}>Funded</div>
            <div className="row" style={{ gap: 10, alignItems: "center", marginTop: 6 }}>
              <div
                style={{
                  flex: 1,
                  height: 10,
                  borderRadius: 999,
                  border: "1px solid var(--stroke)",
                  overflow: "hidden",
                  background: "rgba(255,255,255,.04)",
                }}
              >
                <div
                  style={{
                    width: `${totals.overallPct}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, rgba(16,185,129,.62), rgba(52,211,153,.38))",
                  }}
                />
              </div>
              <Pill tone="emerald" title="Across active goals only">
                {totals.overallPct}%
              </Pill>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Due soon (14 days): <b>{totals.dueSoonCount}</b>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div style={gridWrapStyle}>
        {/* LEFT: New allocation */}
        <div className="card" style={{ padding: 12, minWidth: 0 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 900 }}>New allocation</div>
            <Pill tone="steel" title="Saved in your browser (localStorage)">
              LOCAL
            </Pill>
          </div>

          <form onSubmit={addGoal} className="grid" style={{ gap: 10 }}>
            <div className="grid" style={{ gap: 8 }}>
              <div className="muted" style={{ fontSize: 12 }}>Goal</div>
              <Select value={preset} onChange={(e) => setPreset(e.target.value)} title="Choose a goal type" style={{ width: "100%", minWidth: 0 }}>
                {GOAL_PRESETS.map((p) => (
                  <option key={p} value={p} style={{ color: "#0b1220", background: "#e9f0ff" }}>
                    {p}
                  </option>
                ))}
              </Select>
              {preset === "Other" && (
                <input
                  className="input"
                  placeholder="Custom goal name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  style={{ width: "100%", minWidth: 0 }}
                />
              )}
            </div>

            {/* FIXED: Target + Starting saved as a real 2-col grid */}
            <div style={pairGrid}>
              <div style={{ minWidth: 0 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Target</div>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="$10,000"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  style={{ width: "100%", minWidth: 0 }}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Starting saved</div>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="$0"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  style={{ width: "100%", minWidth: 0 }}
                />
              </div>
            </div>

            {/* FIXED: Due date + Priority as a real 2-col grid */}
            <div style={pairGrid}>
              <div style={{ minWidth: 0 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Due date (optional)</div>
                <input
                  className="input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ width: "100%", minWidth: 0 }}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Priority</div>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  title="High shows first"
                  style={{ width: "100%", minWidth: 0 }}
                >
                  {["High", "Medium", "Low"].map((p) => (
                    <option key={p} value={p} style={{ color: "#0b1220", background: "#e9f0ff" }}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {error && (
              <div className="card" style={{ padding: 10, border: "1px solid rgba(239,68,68,.32)" }}>
                <div style={{ fontWeight: 900 }}>Fix this:</div>
                <div className="muted" style={{ marginTop: 4 }}>{error}</div>
              </div>
            )}

            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <button className="btn" type="submit">Add goal</button>
              <button className="btnGhost" type="button" onClick={clearAddForm}>Clear</button>
            </div>

            <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
              Executive rule: if it has a due date, it gets funded faster. Use the “Needed/day” math.
            </div>
          </form>
        </div>

        {/* RIGHT: Allocations */}
        <div
          className="card"
          style={{
            padding: 12,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900 }}>Allocations</div>

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <input
                className="input"
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: 220 }}
              />

              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: 210 }} title="Sort allocations">
                <option value="priority_then_due" style={{ color: "#0b1220", background: "#e9f0ff" }}>Priority → Due</option>
                <option value="due" style={{ color: "#0b1220", background: "#e9f0ff" }}>Due date</option>
                <option value="progress" style={{ color: "#0b1220", background: "#e9f0ff" }}>Progress</option>
                <option value="left" style={{ color: "#0b1220", background: "#e9f0ff" }}>Amount left</option>
                <option value="name" style={{ color: "#0b1220", background: "#e9f0ff" }}>Name</option>
              </Select>

              <button className="btnGhost" type="button" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? "Hide archived" : "Show archived"}
              </button>
            </div>
          </div>

          <div style={{ height: 10 }} />

          {filteredGoals.length === 0 ? (
            <div
              className="card"
              style={{
                padding: 14,
                minHeight: 160,
                display: "grid",
                alignContent: "center",
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 6 }}>No active allocations</div>
              <div className="muted" style={{ lineHeight: 1.4 }}>
                Add an <b>Emergency Fund</b> first, then a <b>Vacation</b> or <b>Truck/Car Fund</b>.
              </div>
            </div>
          ) : (
            <div className="grid" style={{ gap: 10 }}>
              {filteredGoals.map((g) => {
                const t = Number(g.target) || 0;
                const c = Number(g.current) || 0;
                const left = Math.max(0, t - c);
                const pct = t > 0 ? clamp(Math.round((c / t) * 100), 0, 999) : 0;
                const pctBar = t > 0 ? clamp((c / t) * 100, 0, 100) : 0;

                const d = daysUntil(g.dueDate);
                const dueLabel =
                  !g.dueDate ? "No due date" : d < 0 ? `Overdue • ${fmtDate(g.dueDate)}` : d === 0 ? `Due today` : `Due in ${d} day${d === 1 ? "" : "s"}`;

                const need = g.dueDate && left > 0 ? computeNeeded(left, g.dueDate) : { daysLeft: null, perDay: null, perWeek: null };

                const isEditing = editingId === g.id;
                const panelOpen = openId === g.id;
                const archived = !!g.archived;

                return (
                  <div key={g.id} className="card" style={{ padding: 12, opacity: archived ? 0.78 : 1, minWidth: 0 }}>
                    {isEditing ? (
                      <div className="grid" style={{ gap: 10 }}>
                        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                          <input
                            className="input"
                            value={editDraft.name}
                            onChange={(e) => setEditDraft((d2) => ({ ...d2, name: e.target.value }))}
                            style={{ flex: 2, minWidth: 200 }}
                          />
                          <input
                            className="input"
                            inputMode="decimal"
                            value={editDraft.target}
                            onChange={(e) => setEditDraft((d2) => ({ ...d2, target: e.target.value }))}
                            placeholder="Target"
                            style={{ width: 150 }}
                          />
                          <input
                            className="input"
                            inputMode="decimal"
                            value={editDraft.current}
                            onChange={(e) => setEditDraft((d2) => ({ ...d2, current: e.target.value }))}
                            placeholder="Saved"
                            style={{ width: 150 }}
                          />
                          <input
                            className="input"
                            type="date"
                            value={editDraft.dueDate}
                            onChange={(e) => setEditDraft((d2) => ({ ...d2, dueDate: e.target.value }))}
                            style={{ width: 170 }}
                          />
                          <Select
                            value={editDraft.priority}
                            onChange={(e) => setEditDraft((d2) => ({ ...d2, priority: e.target.value }))}
                            style={{ width: 150 }}
                            title="Priority"
                          >
                            {["High", "Medium", "Low"].map((p) => (
                              <option key={p} value={p} style={{ color: "#0b1220", background: "#e9f0ff" }}>
                                {p}
                              </option>
                            ))}
                          </Select>
                          <label className="row" style={{ gap: 8, alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={!!editDraft.archived}
                              onChange={(e) => setEditDraft((d2) => ({ ...d2, archived: e.target.checked }))}
                            />
                            <span className="muted" style={{ fontSize: 12 }}>Archived</span>
                          </label>
                        </div>

                        <div className="row" style={{ gap: 10 }}>
                          <button className="btn" type="button" onClick={() => saveEdit(g.id)}>Save</button>
                          <button className="btnGhost" type="button" onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                          <div style={{ minWidth: 240 }}>
                            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 900, fontSize: 16 }}>{g.name}</div>
                              <Pill tone={prTone(g.priority)} title="Priority">
                                {(g.priority || "Medium").toUpperCase()}
                              </Pill>
                              {archived && <Pill title="Hidden by default">ARCHIVED</Pill>}
                            </div>

                            <div className="muted" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.35 }}>
                              Saved <b>{money(c)}</b> • Target <b>{money(t)}</b> • Left <b>{money(left)}</b> • {dueLabel}
                            </div>

                            {g.dueDate && left > 0 && need.daysLeft !== null && need.daysLeft >= 0 && (
                              <div className="muted" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.35 }}>
                                Needed: <b>{money(need.perDay)}</b>/day • <b>{money(need.perWeek)}</b>/week
                              </div>
                            )}
                          </div>

                          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                            <button className="btn" type="button" onClick={() => setOpenId(panelOpen ? null : g.id)}>
                              {panelOpen ? "Close" : "Contribute"}
                            </button>
                            <button className="btnGhost" type="button" onClick={() => startEdit(g)}>Edit</button>
                            <button className="btnGhost" type="button" onClick={() => setArchived(g.id, !archived)}>
                              {archived ? "Unarchive" : "Archive"}
                            </button>
                            <button className="btnGhost" type="button" onClick={() => removeGoal(g.id)}>Delete</button>
                          </div>
                        </div>

                        <div style={{ height: 10 }} />

                        <div className="row" style={{ gap: 10, alignItems: "center" }}>
                          <div style={{ flex: 1, height: 12, borderRadius: 999, border: "1px solid var(--stroke)", overflow: "hidden", background: "rgba(255,255,255,.04)" }}>
                            <div
                              style={{
                                width: `${pctBar}%`,
                                height: "100%",
                                background:
                                  left <= 0
                                    ? "linear-gradient(90deg, rgba(16,185,129,.62), rgba(52,211,153,.38))"
                                    : "linear-gradient(90deg, rgba(16,185,129,.52), rgba(34,197,94,.26))",
                              }}
                            />
                          </div>
                          <Pill tone="emerald" title={`${money(c)} / ${money(t)}`}>{t > 0 ? `${pct}%` : "—"}</Pill>
                        </div>

                        {panelOpen && (
                          <div style={{ marginTop: 10 }} className="card">
                            <div style={{ padding: 12 }}>
                              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <div style={{ fontWeight: 900 }}>Fund this goal</div>
                                <button className="btnGhost" type="button" onClick={() => undoLast(g.id)}>Undo last</button>
                              </div>

                              <div style={{ height: 10 }} />

                              <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                {QUICK_AMOUNTS.map((amt) => (
                                  <button
                                    key={amt}
                                    className="btnGhost"
                                    type="button"
                                    onClick={() => applyContribution(g.id, amt, "Quick add")}
                                    style={{ border: "1px solid rgba(16,185,129,.28)", background: "rgba(16,185,129,.10)" }}
                                  >
                                    +{money(amt)}
                                  </button>
                                ))}

                                <input
                                  className="input"
                                  inputMode="decimal"
                                  placeholder="Custom amount"
                                  value={customAdd[g.id] ?? ""}
                                  onChange={(e) => setCustomAdd((m) => ({ ...m, [g.id]: e.target.value }))}
                                  style={{ width: 160 }}
                                />
                                <input
                                  className="input"
                                  placeholder="Note (optional)"
                                  value={customNote[g.id] ?? ""}
                                  onChange={(e) => setCustomNote((m) => ({ ...m, [g.id]: e.target.value }))}
                                  style={{ flex: 1, minWidth: 200 }}
                                />
                                <button
                                  className="btn"
                                  type="button"
                                  onClick={() =>
                                    applyContribution(g.id, parseMoneyInput(customAdd[g.id] ?? ""), customNote[g.id] ?? "")
                                  }
                                >
                                  Add
                                </button>
                              </div>

                              <div style={{ height: 10 }} />
                              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Recent contributions</div>

                              {Array.isArray(g.contributions) && g.contributions.length > 0 ? (
                                <div className="grid" style={{ gap: 8 }}>
                                  {g.contributions.slice(0, 5).map((x) => (
                                    <div key={x.id} className="card" style={{ padding: 10 }}>
                                      <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                        <div>
                                          <div style={{ fontWeight: 900 }}>{money(x.amount)}</div>
                                          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                                            {fmtDate(x.date)} {x.note ? `• ${x.note}` : ""}
                                          </div>
                                        </div>
                                        <Pill tone="steel">LOGGED</Pill>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="muted" style={{ fontSize: 12 }}>No contributions yet.</div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* IO panel */}
      {ioOpen && (
        <div className="card" style={{ marginTop: 12, padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Import / Export</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 10, lineHeight: 1.35 }}>
            Export copies JSON. Import replaces your current goals with the JSON you paste.
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              className="btn"
              type="button"
              onClick={async () => {
                const payload = JSON.stringify(goals, null, 2);
                setIoText(payload);
                try {
                  await navigator.clipboard.writeText(payload);
                } catch {}
              }}
            >
              Export (copy)
            </button>

            <button className="btnGhost" type="button" onClick={() => setIoText("")}>
              Clear text
            </button>

            <button
              className="btnGhost"
              type="button"
              onClick={() => {
                setError("");
                const parsed = safeParse(ioText || "[]", null);
                if (!Array.isArray(parsed)) {
                  setError("Import failed: JSON must be an array of goals.");
                  return;
                }
                const fixed = parsed.map((g) => ({
                  id: g.id ?? uid(),
                  name: String(g.name ?? "").trim(),
                  target: Number(g.target) || 0,
                  current: Number(g.current) || 0,
                  dueDate: g.dueDate || "",
                  priority: g.priority || "Medium",
                  archived: !!g.archived,
                  createdAt: g.createdAt ?? Date.now(),
                  contributions: Array.isArray(g.contributions) ? g.contributions : [],
                }));
                setGoals(fixed);
              }}
            >
              Import (replace)
            </button>
          </div>

          <div style={{ height: 10 }} />
          <textarea
            className="input"
            value={ioText}
            onChange={(e) => setIoText(e.target.value)}
            placeholder="Paste exported JSON here to import…"
            style={{
              width: "100%",
              minHeight: 180,
              resize: "vertical",
              padding: 12,
              lineHeight: 1.35,
              color: "var(--text)",
              backgroundColor: "rgba(15,26,47,.75)",
            }}
          />
        </div>
      )}
    </main>
  );
}