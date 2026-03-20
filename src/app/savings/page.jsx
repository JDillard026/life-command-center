"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/* =========================
   utils
========================= */
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
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(iso) {
  if (!iso) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(`${iso}T00:00:00`).getTime();
  return Math.round((target - today) / 86400000);
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pct(goal) {
  const t = Number(goal?.target) || 0;
  const c = Number(goal?.current) || 0;
  if (t <= 0) return 0;
  return clamp((c / t) * 100, 0, 100);
}

function computeNeeded(left, dueIso) {
  const d = daysUntil(dueIso);
  if (d === null) {
    return { daysLeft: null, perDay: null, perWeek: null, perMonth: null };
  }
  const daysLeft = Math.max(0, d);
  if (daysLeft === 0) {
    return {
      daysLeft,
      perDay: left,
      perWeek: left,
      perMonth: left,
    };
  }
  return {
    daysLeft,
    perDay: left / daysLeft,
    perWeek: left / (daysLeft / 7),
    perMonth: left / (daysLeft / 30),
  };
}

function priorityRank(p) {
  if (p === "High") return 0;
  if (p === "Medium") return 1;
  return 2;
}

function dueLabel(goal) {
  if (!goal?.dueDate) return "No due date";
  const d = daysUntil(goal.dueDate);
  if (d === null) return "No due date";
  if (d < 0) return `Overdue • ${fmtDate(goal.dueDate)}`;
  if (d === 0) return "Due today";
  return `Due in ${d} day${d === 1 ? "" : "s"}`;
}

function progressGradient(value) {
  if (value >= 100) return "linear-gradient(90deg, rgba(16,185,129,.95), rgba(52,211,153,.72))";
  if (value >= 70) return "linear-gradient(90deg, rgba(34,197,94,.88), rgba(16,185,129,.62))";
  if (value >= 30) return "linear-gradient(90deg, rgba(59,130,246,.86), rgba(56,189,248,.56))";
  return "linear-gradient(90deg, rgba(244,114,182,.90), rgba(239,68,68,.62))";
}

/* =========================
   presets
========================= */
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

/* =========================
   ui bits
========================= */
function Pill({ children, tone = "default", title }) {
  const tones = {
    default: {
      bg: "rgba(255,255,255,.06)",
      bd: "rgba(255,255,255,.10)",
      tx: "var(--text)",
    },
    accent: {
      bg: "rgba(59,130,246,.14)",
      bd: "rgba(59,130,246,.28)",
      tx: "var(--text)",
    },
    emerald: {
      bg: "rgba(16,185,129,.14)",
      bd: "rgba(16,185,129,.28)",
      tx: "var(--text)",
    },
    steel: {
      bg: "rgba(148,163,184,.14)",
      bd: "rgba(148,163,184,.24)",
      tx: "var(--text)",
    },
    danger: {
      bg: "rgba(239,68,68,.14)",
      bd: "rgba(239,68,68,.28)",
      tx: "var(--text)",
    },
    amber: {
      bg: "rgba(245,158,11,.14)",
      bd: "rgba(245,158,11,.26)",
      tx: "var(--text)",
    },
  };

  const t = tones[tone] || tones.default;

  return (
    <span
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
        letterSpacing: 0.35,
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
        backgroundColor: "rgba(15,26,47,.84)",
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

function TopShell({ children }) {
  return (
    <header
      className="card"
      style={{
        padding: "18px 22px",
        marginBottom: 14,
        background:
          "linear-gradient(180deg, rgba(4,9,21,.94), rgba(4,9,21,.86)), radial-gradient(circle at top center, rgba(59,130,246,.12), transparent 40%)",
      }}
    >
      {children}
    </header>
  );
}

function StatCard({ label, value, subtext, accent = "rgba(59,130,246,.14)", children }) {
  return (
    <div
      className="card"
      style={{
        padding: 18,
        minHeight: 126,
        background:
          `linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.025)), radial-gradient(circle at top left, ${accent}, transparent 44%)`,
      }}
    >
      <div
        className="muted"
        style={{
          fontSize: 11,
          letterSpacing: 3,
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.45 }}>{value}</div>
      {subtext ? (
        <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.35 }}>
          {subtext}
        </div>
      ) : null}
      {children ? <div style={{ marginTop: 12 }}>{children}</div> : null}
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div
      className="card"
      style={{
        padding: 12,
        background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.03))",
      }}
    >
      <div
        className="muted"
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 2,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontWeight: 900, fontSize: 16 }}>{value}</div>
    </div>
  );
}

/* =========================
   db mapping
========================= */
function mapGoalRow(row) {
  return {
    id: row.id,
    name: String(row.name ?? "").trim(),
    target: Number(row.target_amount) || 0,
    current: Number(row.current_amount) || 0,
    dueDate: row.target_date || "",
    priority: row.priority || "Medium",
    archived: !!row.archived,
    createdAt:
      row.created_at_ms ??
      (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
    contributions: Array.isArray(row.contributions) ? row.contributions : [],
  };
}

function mapGoalToRow(goal, userId) {
  return {
    id: goal.id,
    user_id: userId,
    name: String(goal.name ?? "").trim(),
    target_amount: Number(goal.target) || 0,
    current_amount: Number(goal.current) || 0,
    target_date: goal.dueDate || null,
    category: "general",
    notes: "",
    priority: goal.priority || "Medium",
    archived: !!goal.archived,
    contributions: Array.isArray(goal.contributions) ? goal.contributions : [],
    created_at_ms: goal.createdAt ?? Date.now(),
    updated_at: new Date().toISOString(),
  };
}

/* =========================
   page
========================= */
export default function SavingsPage() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [savingIds, setSavingIds] = useState({});

  // mode
  const [mode, setMode] = useState("overview");

  // add
  const [preset, setPreset] = useState(GOAL_PRESETS[0]);
  const [customName, setCustomName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [error, setError] = useState("");

  // controls
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

  // panels
  const [openId, setOpenId] = useState(null);
  const [manageId, setManageId] = useState(null);

  // contribute inputs
  const [customAdd, setCustomAdd] = useState({});
  const [customNote, setCustomNote] = useState({});

  // io
  const [ioOpen, setIoOpen] = useState(false);
  const [ioText, setIoText] = useState("");

  // responsive
  const [isNarrow, setIsNarrow] = useState(false);

  const saveTimersRef = useRef({});

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 1180);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function getCurrentUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("getUser error:", error);
      return null;
    }
    return user ?? null;
  }

  async function loadGoals() {
    setLoading(true);

    const user = await getCurrentUser();
    if (!user) {
      setUserId(null);
      setGoals([]);
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data, error } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("load savings error:", error);
      setGoals([]);
      setLoading(false);
      return;
    }

    setGoals((data || []).map(mapGoalRow));
    setLoading(false);
  }

  useEffect(() => {
    loadGoals();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadGoals();
    });

    return () => {
      subscription?.unsubscribe?.();
      Object.values(saveTimersRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  async function persistGoal(goal) {
    if (!userId) return;

    setSavingIds((prev) => ({ ...prev, [goal.id]: true }));

    const { error } = await supabase.from("savings_goals").upsert(mapGoalToRow(goal, userId), {
      onConflict: "id",
    });

    if (error) {
      console.error("save goal error:", error);
    }

    setSavingIds((prev) => ({ ...prev, [goal.id]: false }));
  }

  function scheduleSave(goal) {
    if (saveTimersRef.current[goal.id]) {
      clearTimeout(saveTimersRef.current[goal.id]);
    }
    saveTimersRef.current[goal.id] = setTimeout(() => {
      persistGoal(goal);
    }, 250);
  }

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

  async function addGoal(e) {
    e.preventDefault();
    setError("");

    const n = resolvedName();
    const t = parseMoneyInput(target);
    const c = parseMoneyInput(current === "" ? "0" : current);

    if (!n) return setError("Goal name is required.");
    if (!Number.isFinite(t) || t <= 0) return setError("Target must be greater than 0.");
    if (!Number.isFinite(c) || c < 0) return setError("Starting saved must be 0 or more.");
    if (!userId) return setError("You must be signed in.");

    const id = uid();
    const nextGoal = {
      id,
      name: n,
      target: t,
      current: c,
      dueDate: dueDate || "",
      priority: priority || "Medium",
      archived: false,
      createdAt: Date.now(),
      contributions:
        c > 0
          ? [{ id: uid(), date: todayISO(), amount: c, note: "Starting balance" }]
          : [],
    };

    setGoals((prev) => [nextGoal, ...prev]);
    clearAddForm();

    const { error: insertError } = await supabase
      .from("savings_goals")
      .insert(mapGoalToRow(nextGoal, userId));

    if (insertError) {
      console.error("add goal error:", insertError);
      await loadGoals();
    }
  }

  function startEdit(goal) {
    setEditingId(goal.id);
    setError("");
    setEditDraft({
      name: goal.name || "",
      target: String(goal.target ?? ""),
      current: String(goal.current ?? ""),
      dueDate: goal.dueDate || "",
      priority: goal.priority || "Medium",
      archived: !!goal.archived,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({
      name: "",
      target: "",
      current: "",
      dueDate: "",
      priority: "Medium",
      archived: false,
    });
  }

  function saveEdit(id) {
    setError("");

    const n = editDraft.name.trim();
    const t = parseMoneyInput(editDraft.target);
    const c = parseMoneyInput(editDraft.current === "" ? "0" : editDraft.current);

    if (!n) return setError("Goal name is required.");
    if (!Number.isFinite(t) || t <= 0) return setError("Target must be greater than 0.");
    if (!Number.isFinite(c) || c < 0) return setError("Current saved must be 0 or more.");

    setGoals((prev) => {
      const next = prev.map((g) =>
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
      );
      const changed = next.find((g) => g.id === id);
      if (changed) scheduleSave(changed);
      return next;
    });

    cancelEdit();
  }

  async function removeGoal(id) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (openId === id) setOpenId(null);
    if (manageId === id) setManageId(null);
    if (editingId === id) cancelEdit();

    const { error } = await supabase.from("savings_goals").delete().eq("id", id);
    if (error) {
      console.error("delete goal error:", error);
      await loadGoals();
    }
  }

  function setArchived(goalId, archived) {
    setGoals((prev) => {
      const next = prev.map((g) => (g.id === goalId ? { ...g, archived: !!archived } : g));
      const changed = next.find((g) => g.id === goalId);
      if (changed) scheduleSave(changed);
      return next;
    });
  }

  function applyContribution(goalId, amount, note) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Contribution amount must be greater than 0.");
      return;
    }

    setError("");

    setGoals((prev) => {
      const next = prev.map((g) => {
        if (g.id !== goalId) return g;
        const nextCurrent = (Number(g.current) || 0) + amt;
        const entry = {
          id: uid(),
          date: todayISO(),
          amount: amt,
          note: String(note || "").trim(),
        };
        return {
          ...g,
          current: nextCurrent,
          contributions: [entry, ...(Array.isArray(g.contributions) ? g.contributions : [])],
        };
      });

      const changed = next.find((g) => g.id === goalId);
      if (changed) scheduleSave(changed);
      return next;
    });

    setCustomAdd((m) => ({ ...m, [goalId]: "" }));
    setCustomNote((m) => ({ ...m, [goalId]: "" }));
  }

  function undoLast(goalId) {
    setError("");

    setGoals((prev) => {
      const next = prev.map((g) => {
        if (g.id !== goalId) return g;
        const list = Array.isArray(g.contributions) ? g.contributions : [];
        if (list.length === 0) return g;
        const [last, ...rest] = list;
        const nextCurrent = Math.max(0, (Number(g.current) || 0) - (Number(last.amount) || 0));
        return { ...g, current: nextCurrent, contributions: rest };
      });

      const changed = next.find((g) => g.id === goalId);
      if (changed) scheduleSave(changed);
      return next;
    });
  }

  const totals = useMemo(() => {
    const active = goals.filter((g) => !g.archived);
    const totalTarget = active.reduce((sum, g) => sum + (Number(g.target) || 0), 0);
    const totalCurrent = active.reduce((sum, g) => sum + (Number(g.current) || 0), 0);
    const left = Math.max(0, totalTarget - totalCurrent);
    const overallPct = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

    const dueSoonCount = active.reduce((count, g) => {
      const d = daysUntil(g.dueDate);
      if (d === null) return count;
      return d >= 0 && d <= 14 ? count + 1 : count;
    }, 0);

    const fundedCount = active.reduce((count, g) => {
      const t = Number(g.target) || 0;
      const c = Number(g.current) || 0;
      return t > 0 && c >= t ? count + 1 : count;
    }, 0);

    const topOpenGoal = active
      .slice()
      .sort((a, b) => {
        const aLeft = Math.max(0, (Number(a.target) || 0) - (Number(a.current) || 0));
        const bLeft = Math.max(0, (Number(b.target) || 0) - (Number(b.current) || 0));
        return bLeft - aLeft;
      })[0] || null;

    const closestDueGoal = active
      .filter((g) => g.dueDate)
      .slice()
      .sort((a, b) => {
        const ad = daysUntil(a.dueDate);
        const bd = daysUntil(b.dueDate);
        return (ad ?? Number.POSITIVE_INFINITY) - (bd ?? Number.POSITIVE_INFINITY);
      })[0] || null;

    const recentContributionCount = active.reduce(
      (sum, g) => sum + (Array.isArray(g.contributions) ? g.contributions.length : 0),
      0
    );

    return {
      totalTarget,
      totalCurrent,
      left,
      overallPct: clamp(overallPct, 0, 100),
      dueSoonCount,
      fundedCount,
      activeCount: active.length,
      topOpenGoal,
      closestDueGoal,
      recentContributionCount,
    };
  }, [goals]);

  const filteredGoals = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = goals.slice();

    if (!showArchived) list = list.filter((g) => !g.archived);
    if (q) list = list.filter((g) => String(g.name || "").toLowerCase().includes(q));

    const dueKey = (g) => {
      if (!g.dueDate) return Number.POSITIVE_INFINITY;
      const d = daysUntil(g.dueDate);
      return d === null ? Number.POSITIVE_INFINITY : d;
    };

    list.sort((a, b) => {
      if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""));
      if (sortBy === "due") return dueKey(a) - dueKey(b);
      if (sortBy === "progress") return pct(b) - pct(a);
      if (sortBy === "left") {
        const la = Math.max(0, (Number(a.target) || 0) - (Number(a.current) || 0));
        const lb = Math.max(0, (Number(b.target) || 0) - (Number(b.current) || 0));
        return lb - la;
      }
      const pr = priorityRank(a.priority) - priorityRank(b.priority);
      if (pr !== 0) return pr;
      return dueKey(a) - dueKey(b);
    });

    return list;
  }, [goals, query, sortBy, showArchived]);

  function priorityPillTone(p) {
    if (p === "High") return "danger";
    if (p === "Low") return "steel";
    return "emerald";
  }

  const statsCols = isNarrow ? "1fr" : "repeat(4, minmax(0, 1fr))";
  const overviewCols = isNarrow ? "1fr" : "minmax(0, 1.55fr) 380px";

  const activeGoals = goals.filter((g) => !g.archived);
  const topGoal = totals.topOpenGoal;
  const progressGoals = activeGoals
    .slice()
    .sort((a, b) => pct(b) - pct(a))
    .slice(0, 5);

  if (loading) {
    return (
      <main className="container">
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 20 }}>Loading savings goals...</div>
          <div className="muted" style={{ marginTop: 8 }}>
            Pulling your savings data from Supabase.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <TopShell>
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              className="muted"
              style={{
                fontSize: 11,
                letterSpacing: 3,
                textTransform: "uppercase",
                marginBottom: 6,
                color: "rgba(125,211,252,.92)",
                fontWeight: 800,
              }}
            >
              Life Command Center
            </div>

            <h1 style={{ margin: 0, letterSpacing: -0.7, fontSize: 32, lineHeight: 1.05 }}>
              Savings Control
            </h1>

            <div className="muted" style={{ marginTop: 8, fontSize: 15 }}>
              Build targets, track progress, and fund future moves.
            </div>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div
              className="card"
              style={{
                padding: 4,
                display: "inline-flex",
                gap: 4,
                borderRadius: 999,
                background: "rgba(8,12,22,.78)",
              }}
            >
              <button
                type="button"
                className={mode === "overview" ? "btn" : "btnGhost"}
                onClick={() => setMode("overview")}
                style={{ minWidth: 108 }}
              >
                Overview
              </button>
              <button
                type="button"
                className={mode === "manage" ? "btn" : "btnGhost"}
                onClick={() => setMode("manage")}
                style={{ minWidth: 108 }}
              >
                Manage
              </button>
            </div>

            <button className="btnGhost" type="button" onClick={() => setIoOpen((v) => !v)}>
              {ioOpen ? "Close Import / Export" : "Import / Export"}
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
      </TopShell>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: statsCols,
          gap: 14,
          marginBottom: 14,
        }}
      >
        <StatCard
          label="Total Saved"
          value={money(totals.totalCurrent)}
          subtext={`${totals.activeCount} active goal${totals.activeCount === 1 ? "" : "s"}`}
          accent="rgba(244,114,182,.14)"
        />

        <StatCard
          label="Total Target"
          value={money(totals.totalTarget)}
          subtext={`${totals.fundedCount} fully funded`}
          accent="rgba(59,130,246,.14)"
        />

        <StatCard
          label="Remaining"
          value={money(totals.left)}
          subtext={`${totals.dueSoonCount} due within 14 days`}
          accent="rgba(16,185,129,.14)"
        />

        <StatCard
          label="Funding Health"
          value={`${totals.overallPct}%`}
          subtext={
            totals.topOpenGoal
              ? `Largest open goal: ${totals.topOpenGoal.name}`
              : "Across active goals"
          }
          accent="rgba(14,165,233,.14)"
        >
          <div
            style={{
              height: 12,
              borderRadius: 999,
              overflow: "hidden",
              border: "1px solid var(--stroke)",
              background: "rgba(255,255,255,.05)",
            }}
          >
            <div
              style={{
                width: `${totals.overallPct}%`,
                height: "100%",
                background: progressGradient(totals.overallPct),
                boxShadow: "0 0 18px rgba(56,189,248,.18)",
              }}
            />
          </div>
        </StatCard>
      </section>

      {mode === "overview" ? (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: overviewCols,
            gap: 14,
            alignItems: "start",
          }}
        >
          <div className="grid" style={{ gap: 14 }}>
            <section
              className="card"
              style={{
                padding: 18,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)), radial-gradient(circle at top left, rgba(59,130,246,.09), transparent 38%)",
              }}
            >
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>Funding Progress</div>
                  <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                    Top goals by percent funded.
                  </div>
                </div>
                <Pill tone="accent">Overview</Pill>
              </div>

              {progressGoals.length === 0 ? (
                <div className="muted" style={{ fontSize: 14 }}>No active goals yet.</div>
              ) : (
                <div className="grid" style={{ gap: 12 }}>
                  {progressGoals.map((g) => {
                    const value = pct(g);
                    return (
                      <div key={g.id} className="card" style={{ padding: 14, background: "rgba(255,255,255,.025)" }}>
                        <div
                          className="row"
                          style={{ justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}
                        >
                          <div>
                            <div style={{ fontWeight: 900, fontSize: 18 }}>{g.name}</div>
                            <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                              {money(g.current)} of {money(g.target)}
                            </div>
                          </div>
                          <Pill tone={value >= 100 ? "emerald" : value >= 30 ? "accent" : "steel"}>
                            {Math.round(value)}%
                          </Pill>
                        </div>

                        <div style={{ marginTop: 10 }}>
                          <div
                            style={{
                              height: 12,
                              borderRadius: 999,
                              overflow: "hidden",
                              border: "1px solid var(--stroke)",
                              background: "rgba(255,255,255,.05)",
                            }}
                          >
                            <div
                              style={{
                                width: `${value}%`,
                                height: "100%",
                                background: progressGradient(value),
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section
              className="card"
              style={{
                padding: 18,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)), radial-gradient(circle at top center, rgba(244,114,182,.07), transparent 36%)",
              }}
            >
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>Goals</div>
                  <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                    Priority-first funding view.
                  </div>
                </div>

                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <input
                    className="input"
                    placeholder="Search goals..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ width: 220 }}
                  />

                  <Select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{ width: 210 }}
                    title="Sort goals"
                  >
                    <option value="priority_then_due" style={{ color: "#0b1220", background: "#e9f0ff" }}>
                      Priority → Due
                    </option>
                    <option value="due" style={{ color: "#0b1220", background: "#e9f0ff" }}>
                      Due date
                    </option>
                    <option value="progress" style={{ color: "#0b1220", background: "#e9f0ff" }}>
                      Progress
                    </option>
                    <option value="left" style={{ color: "#0b1220", background: "#e9f0ff" }}>
                      Amount left
                    </option>
                    <option value="name" style={{ color: "#0b1220", background: "#e9f0ff" }}>
                      Name
                    </option>
                  </Select>

                  <button className="btnGhost" type="button" onClick={() => setShowArchived((v) => !v)}>
                    {showArchived ? "Hide archived" : "Show archived"}
                  </button>
                </div>
              </div>

              {filteredGoals.length === 0 ? (
                <div
                  className="card"
                  style={{
                    padding: 18,
                    minHeight: 180,
                    display: "grid",
                    alignContent: "center",
                    background: "rgba(255,255,255,.025)",
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>No goals showing</div>
                  <div className="muted" style={{ lineHeight: 1.45 }}>
                    Add an <b>Emergency Fund</b> first, then build out things like <b>Vacation</b>, <b>Truck / Car Fund</b>, or <b>House Projects</b>.
                  </div>
                </div>
              ) : (
                <div className="grid" style={{ gap: 14 }}>
                  {filteredGoals.map((g) => {
                    const t = Number(g.target) || 0;
                    const c = Number(g.current) || 0;
                    const left = Math.max(0, t - c);
                    const value = pct(g);
                    const pace =
                      g.dueDate && left > 0
                        ? computeNeeded(left, g.dueDate)
                        : { daysLeft: null, perDay: null, perWeek: null, perMonth: null };

                    const archived = !!g.archived;
                    const isEditing = editingId === g.id;
                    const panelOpen = openId === g.id;
                    const manageOpen = manageId === g.id;

                    return (
                      <div
                        key={g.id}
                        className="card"
                        style={{
                          padding: 16,
                          opacity: archived ? 0.76 : 1,
                          minWidth: 0,
                          background:
                            "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.028))",
                        }}
                      >
                        {isEditing ? (
                          <div className="grid" style={{ gap: 12 }}>
                            <div
                              className="grid"
                              style={{
                                gridTemplateColumns: isNarrow
                                  ? "1fr"
                                  : "minmax(220px,1.3fr) repeat(4, minmax(120px,.7fr))",
                                gap: 10,
                              }}
                            >
                              <input
                                className="input"
                                value={editDraft.name}
                                onChange={(e) => setEditDraft((d2) => ({ ...d2, name: e.target.value }))}
                                placeholder="Goal name"
                              />

                              <input
                                className="input"
                                inputMode="decimal"
                                value={editDraft.target}
                                onChange={(e) => setEditDraft((d2) => ({ ...d2, target: e.target.value }))}
                                placeholder="Target"
                              />

                              <input
                                className="input"
                                inputMode="decimal"
                                value={editDraft.current}
                                onChange={(e) => setEditDraft((d2) => ({ ...d2, current: e.target.value }))}
                                placeholder="Saved"
                              />

                              <input
                                className="input"
                                type="date"
                                value={editDraft.dueDate}
                                onChange={(e) => setEditDraft((d2) => ({ ...d2, dueDate: e.target.value }))}
                              />

                              <Select
                                value={editDraft.priority}
                                onChange={(e) => setEditDraft((d2) => ({ ...d2, priority: e.target.value }))}
                                title="Priority"
                              >
                                {["High", "Medium", "Low"].map((p) => (
                                  <option key={p} value={p} style={{ color: "#0b1220", background: "#e9f0ff" }}>
                                    {p}
                                  </option>
                                ))}
                              </Select>
                            </div>

                            <label className="row" style={{ gap: 8, alignItems: "center" }}>
                              <input
                                type="checkbox"
                                checked={!!editDraft.archived}
                                onChange={(e) => setEditDraft((d2) => ({ ...d2, archived: e.target.checked }))}
                              />
                              <span className="muted" style={{ fontSize: 13 }}>Archive this goal</span>
                            </label>

                            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                              <button className="btn" type="button" onClick={() => saveEdit(g.id)}>Save</button>
                              <button className="btnGhost" type="button" onClick={cancelEdit}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div
                              className="row"
                              style={{
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: 14,
                                flexWrap: "wrap",
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  className="row"
                                  style={{
                                    gap: 10,
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    marginBottom: 12,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: 900,
                                      fontSize: isNarrow ? 26 : 30,
                                      lineHeight: 1,
                                      letterSpacing: -0.5,
                                    }}
                                  >
                                    {g.name}
                                  </div>

                                  <Pill tone={priorityPillTone(g.priority)}>
                                    {(g.priority || "Medium").toUpperCase()}
                                  </Pill>

                                  <Pill tone={dueTone(g)} title={g.dueDate ? fmtDate(g.dueDate) : "No due date"}>
                                    {dueLabel(g)}
                                  </Pill>

                                  {archived ? <Pill tone="steel">ARCHIVED</Pill> : null}
                                  {savingIds[g.id] ? <Pill tone="accent">SAVING</Pill> : null}
                                </div>

                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: isNarrow ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))",
                                    gap: 10,
                                    marginBottom: 12,
                                  }}
                                >
                                  <MiniMetric label="Saved" value={money(c)} />
                                  <MiniMetric label="Target" value={money(t)} />
                                  <MiniMetric label="Left" value={money(left)} />
                                  <MiniMetric label="Funded" value={t > 0 ? `${Math.round(value)}%` : "—"} />
                                </div>
                              </div>

                              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                <button
                                  className="btn"
                                  type="button"
                                  onClick={() => setOpenId(panelOpen ? null : g.id)}
                                >
                                  {panelOpen ? "Close" : "Contribute"}
                                </button>

                                <button
                                  className="btnGhost"
                                  type="button"
                                  onClick={() => setManageId(manageOpen ? null : g.id)}
                                >
                                  {manageOpen ? "Close" : "Manage"}
                                </button>
                              </div>
                            </div>

                            <div style={{ marginTop: 4 }}>
                              <div
                                style={{
                                  height: 14,
                                  borderRadius: 999,
                                  border: "1px solid var(--stroke)",
                                  overflow: "hidden",
                                  background: "rgba(255,255,255,.05)",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${value}%`,
                                    height: "100%",
                                    background: progressGradient(value),
                                    boxShadow: "0 0 18px rgba(96,165,250,.16)",
                                  }}
                                />
                              </div>

                              <div
                                className="row"
                                style={{
                                  justifyContent: "space-between",
                                  gap: 12,
                                  flexWrap: "wrap",
                                  marginTop: 8,
                                }}
                              >
                                <div className="muted" style={{ fontSize: 13 }}>
                                  {g.dueDate && left > 0 && pace.daysLeft !== null && pace.daysLeft >= 0 ? (
                                    <>
                                      Need <b>{money(pace.perMonth)}</b>/month • <b>{money(pace.perWeek)}</b>/week • <b>{money(pace.perDay)}</b>/day
                                    </>
                                  ) : (
                                    <>No pace target needed yet.</>
                                  )}
                                </div>

                                <Pill tone={value >= 100 ? "emerald" : value >= 25 ? "accent" : "steel"}>
                                  {money(c)} / {money(t)}
                                </Pill>
                              </div>
                            </div>

                            {manageOpen ? (
                              <div
                                className="card"
                                style={{
                                  marginTop: 14,
                                  padding: 14,
                                  background: "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.025))",
                                }}
                              >
                                <div
                                  className="row"
                                  style={{
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 10,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 900, fontSize: 17 }}>Manage {g.name}</div>
                                    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                                      Edit or archive from here instead of cluttering the card face.
                                    </div>
                                  </div>

                                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                    <button className="btnGhost" type="button" onClick={() => startEdit(g)}>
                                      Edit
                                    </button>
                                    <button
                                      className="btnGhost"
                                      type="button"
                                      onClick={() => setArchived(g.id, !archived)}
                                    >
                                      {archived ? "Unarchive" : "Archive"}
                                    </button>
                                    <button className="btnGhost" type="button" onClick={() => removeGoal(g.id)}>
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {panelOpen ? (
                              <div
                                className="card"
                                style={{
                                  marginTop: 14,
                                  padding: 14,
                                  background: "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.025))",
                                }}
                              >
                                <div
                                  className="row"
                                  style={{
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 10,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 900, fontSize: 17 }}>Contribute to {g.name}</div>
                                    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                                      Quick adds or custom contribution with note.
                                    </div>
                                  </div>

                                  <button className="btnGhost" type="button" onClick={() => undoLast(g.id)}>
                                    Undo last
                                  </button>
                                </div>

                                <div style={{ height: 12 }} />

                                <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                  {QUICK_AMOUNTS.map((amt) => (
                                    <button
                                      key={amt}
                                      className="btnGhost"
                                      type="button"
                                      onClick={() => applyContribution(g.id, amt, "Quick add")}
                                      style={{
                                        border: "1px solid rgba(16,185,129,.28)",
                                        background: "rgba(16,185,129,.10)",
                                      }}
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
                                    style={{ flex: 1, minWidth: 220 }}
                                  />

                                  <button
                                    className="btn"
                                    type="button"
                                    onClick={() =>
                                      applyContribution(
                                        g.id,
                                        parseMoneyInput(customAdd[g.id] ?? ""),
                                        customNote[g.id] ?? ""
                                      )
                                    }
                                  >
                                    Add
                                  </button>
                                </div>

                                <div style={{ height: 12 }} />

                                <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                                  Recent contributions
                                </div>

                                {Array.isArray(g.contributions) && g.contributions.length > 0 ? (
                                  <div className="grid" style={{ gap: 8 }}>
                                    {g.contributions.slice(0, 5).map((x) => (
                                      <div
                                        key={x.id}
                                        className="card"
                                        style={{
                                          padding: 10,
                                          background: "rgba(255,255,255,.025)",
                                        }}
                                      >
                                        <div
                                          className="row"
                                          style={{
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gap: 10,
                                          }}
                                        >
                                          <div>
                                            <div style={{ fontWeight: 900, fontSize: 16 }}>{money(x.amount)}</div>
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
                                  <div className="muted" style={{ fontSize: 13 }}>No contributions yet.</div>
                                )}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="grid" style={{ gap: 14 }}>
            <section
              className="card"
              style={{
                padding: 18,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)), radial-gradient(circle at top center, rgba(16,185,129,.09), transparent 38%)",
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <div
                    className="muted"
                    style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}
                  >
                    Focus Goal
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    {topGoal ? topGoal.name : "No active goals"}
                  </div>
                </div>
                <Pill tone={topGoal ? priorityPillTone(topGoal.priority) : "steel"}>
                  {topGoal ? (topGoal.priority || "Medium").toUpperCase() : "IDLE"}
                </Pill>
              </div>

              {topGoal ? (
                <>
                  <div style={{ marginTop: 14 }}>
                    <div
                      style={{
                        height: 14,
                        borderRadius: 999,
                        overflow: "hidden",
                        border: "1px solid var(--stroke)",
                        background: "rgba(255,255,255,.05)",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct(topGoal)}%`,
                          height: "100%",
                          background: progressGradient(pct(topGoal)),
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid" style={{ gap: 10, marginTop: 14 }}>
                    <MiniMetric label="Saved" value={money(topGoal.current)} />
                    <MiniMetric label="Target" value={money(topGoal.target)} />
                    <MiniMetric label="Left" value={money(Math.max(0, (Number(topGoal.target) || 0) - (Number(topGoal.current) || 0)))} />
                    <MiniMetric label="Due" value={dueLabel(topGoal)} />
                  </div>
                </>
              ) : (
                <div className="muted" style={{ marginTop: 12, fontSize: 14 }}>
                  Add a goal to start tracking focus.
                </div>
              )}
            </section>

            <section
              className="card"
              style={{
                padding: 18,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)), radial-gradient(circle at top right, rgba(245,158,11,.08), transparent 34%)",
              }}
            >
              <div
                className="muted"
                style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}
              >
                Quick Read
              </div>

              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>
                {totals.closestDueGoal ? totals.closestDueGoal.name : "No urgent due dates"}
              </div>

              <div className="muted" style={{ fontSize: 14, lineHeight: 1.45 }}>
                {totals.closestDueGoal
                  ? `Closest dated goal is ${totals.closestDueGoal.name}. ${dueLabel(totals.closestDueGoal)}.`
                  : "No goal currently has a due date. Pace pressure is low right now."}
              </div>

              <div style={{ marginTop: 14 }}>
                <Pill tone={totals.closestDueGoal ? dueTone(totals.closestDueGoal) : "steel"}>
                  {totals.closestDueGoal ? dueLabel(totals.closestDueGoal) : "No due date pressure"}
                </Pill>
              </div>
            </section>

            <section
              className="card"
              style={{
                padding: 18,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)), radial-gradient(circle at bottom left, rgba(59,130,246,.08), transparent 34%)",
              }}
            >
              <div
                className="muted"
                style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}
              >
                Activity
              </div>

              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
                {totals.recentContributionCount} logged contribution{totals.recentContributionCount === 1 ? "" : "s"}
              </div>

              <div className="muted" style={{ fontSize: 14, lineHeight: 1.45 }}>
                This page is running cloud-first with Supabase persistence across devices.
              </div>
            </section>
          </aside>
        </section>
      ) : (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: isNarrow ? "1fr" : "360px minmax(0, 1fr)",
            gap: 14,
            alignItems: "start",
          }}
        >
          <aside
            className="card"
            style={{
              padding: 18,
              minWidth: 0,
              background:
                "linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.022)), radial-gradient(circle at top left, rgba(59,130,246,.14), transparent 35%)",
            }}
          >
            <div
              className="row"
              style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Create Goal</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Saved directly to Supabase.
                </div>
              </div>
              <Pill tone="accent">CLOUD</Pill>
            </div>

            <form onSubmit={addGoal} className="grid" style={{ gap: 12 }}>
              <div className="grid" style={{ gap: 8 }}>
                <div className="muted" style={{ fontSize: 12 }}>Goal</div>
                <Select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value)}
                  title="Choose a goal"
                  style={{ width: "100%" }}
                >
                  {GOAL_PRESETS.map((p) => (
                    <option key={p} value={p} style={{ color: "#0b1220", background: "#e9f0ff" }}>
                      {p}
                    </option>
                  ))}
                </Select>

                {preset === "Other" ? (
                  <input
                    className="input"
                    placeholder="Custom goal name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    style={{ width: "100%" }}
                  />
                ) : null}
              </div>

              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Target</div>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="$10,000"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Starting saved</div>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="$0"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Due date</div>
                  <input
                    className="input"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Priority</div>
                  <Select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    title="Priority"
                    style={{ width: "100%" }}
                  >
                    {["High", "Medium", "Low"].map((p) => (
                      <option key={p} value={p} style={{ color: "#0b1220", background: "#e9f0ff" }}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {error ? (
                <div
                  className="card"
                  style={{
                    padding: 10,
                    border: "1px solid rgba(239,68,68,.32)",
                    background: "rgba(239,68,68,.06)",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 4 }}>Fix this</div>
                  <div className="muted" style={{ fontSize: 13 }}>{error}</div>
                </div>
              ) : null}

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button className="btn" type="submit">Add goal</button>
                <button className="btnGhost" type="button" onClick={clearAddForm}>Clear</button>
              </div>
            </form>
          </aside>

          <section
            className="card"
            style={{
              padding: 18,
              minWidth: 0,
              background:
                "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)), radial-gradient(circle at top right, rgba(99,102,241,.10), transparent 38%)",
            }}
          >
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Manage Goals</div>
                <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                  Search, sort, archive, edit, and fund.
                </div>
              </div>

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input
                  className="input"
                  placeholder="Search goals..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ width: 220 }}
                />

                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ width: 210 }}
                  title="Sort goals"
                >
                  <option value="priority_then_due" style={{ color: "#0b1220", background: "#e9f0ff" }}>
                    Priority → Due
                  </option>
                  <option value="due" style={{ color: "#0b1220", background: "#e9f0ff" }}>
                    Due date
                  </option>
                  <option value="progress" style={{ color: "#0b1220", background: "#e9f0ff" }}>
                    Progress
                  </option>
                  <option value="left" style={{ color: "#0b1220", background: "#e9f0ff" }}>
                    Amount left
                  </option>
                  <option value="name" style={{ color: "#0b1220", background: "#e9f0ff" }}>
                    Name
                  </option>
                </Select>

                <button className="btnGhost" type="button" onClick={() => setShowArchived((v) => !v)}>
                  {showArchived ? "Hide archived" : "Show archived"}
                </button>
              </div>
            </div>

            <div className="muted" style={{ fontSize: 14 }}>
              Use the Overview tab when you want the premium dashboard feel. Use Manage when you want raw control.
            </div>
          </section>
        </section>
      )}

      {ioOpen ? (
        <div className="card" style={{ marginTop: 14, padding: 16 }}>
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Import / Export</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Export copies JSON. Import replaces this signed-in user’s current savings goals in Supabase.
              </div>
            </div>
            <Pill tone="accent">SUPABASE</Pill>
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
              onClick={async () => {
                setError("");

                let parsed = null;
                try {
                  parsed = JSON.parse(ioText || "[]");
                } catch {
                  setError("Import failed: invalid JSON.");
                  return;
                }

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

                if (userId) {
                  const { error: deleteError } = await supabase
                    .from("savings_goals")
                    .delete()
                    .eq("user_id", userId);

                  if (deleteError) {
                    console.error("replace delete error:", deleteError);
                    await loadGoals();
                    return;
                  }

                  if (fixed.length > 0) {
                    const rows = fixed.map((g) => mapGoalToRow(g, userId));
                    const { error: insertError } = await supabase
                      .from("savings_goals")
                      .upsert(rows, { onConflict: "id" });

                    if (insertError) {
                      console.error("replace import error:", insertError);
                      await loadGoals();
                    }
                  }
                }
              }}
            >
              Import (replace)
            </button>
          </div>

          <div style={{ height: 12 }} />

          <textarea
            className="input"
            value={ioText}
            onChange={(e) => setIoText(e.target.value)}
            placeholder="Paste exported JSON here to import..."
            style={{
              width: "100%",
              minHeight: 220,
              resize: "vertical",
              padding: 12,
              lineHeight: 1.4,
              color: "var(--text)",
              backgroundColor: "rgba(15,26,47,.75)",
            }}
          />
        </div>
      ) : null}
    </main>
  );
}