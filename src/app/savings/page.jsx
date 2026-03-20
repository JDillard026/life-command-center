"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

/* =========================
   constants
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

const RED = "#ff5d73";
const GREEN = "#4ade80";
const BLUE = "#38bdf8";
const AMBER = "#f59e0b";
const PINK = "#fb7185";

/* =========================
   utils
========================= */
function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0.00";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return "";
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
  if (!Number.isFinite(target)) return null;
  return Math.round((target - today) / 86400000);
}

function pct(goal) {
  const t = Number(goal?.target) || 0;
  const c = Number(goal?.current) || 0;
  if (t <= 0) return 0;
  return clamp((c / t) * 100, 0, 100);
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

function dueTone(goal) {
  if (!goal?.dueDate) return "steel";
  const d = daysUntil(goal.dueDate);
  if (d === null) return "steel";
  if (d < 0) return "danger";
  if (d === 0) return "danger";
  if (d <= 7) return "amber";
  if (d <= 30) return "blue";
  return "green";
}

function priorityTone(priority) {
  if (priority === "High") return "danger";
  if (priority === "Low") return "steel";
  return "green";
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

function projectedFinishDate(goal) {
  const contributions = Array.isArray(goal?.contributions) ? goal.contributions : [];
  const current = Number(goal?.current) || 0;
  const target = Number(goal?.target) || 0;
  const left = Math.max(0, target - current);

  if (left <= 0) return { status: "done", text: "Already funded" };
  if (contributions.length === 0) return { status: "none", text: "No contribution history yet" };

  const recent = contributions
    .slice()
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .slice(-8);

  const totalRecent = recent.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);

  const dates = recent
    .map((x) => (x?.date ? new Date(`${x.date}T00:00:00`).getTime() : NaN))
    .filter((n) => Number.isFinite(n));

  if (dates.length < 2 || totalRecent <= 0) {
    return { status: "weak", text: "Need more contribution history" };
  }

  const first = Math.min(...dates);
  const last = Math.max(...dates);
  const spanDays = Math.max(1, Math.round((last - first) / 86400000) + 1);

  const perDay = totalRecent / spanDays;
  if (!Number.isFinite(perDay) || perDay <= 0) {
    return { status: "weak", text: "Need more contribution history" };
  }

  const daysToFinish = Math.ceil(left / perDay);
  const finish = new Date();
  finish.setDate(finish.getDate() + daysToFinish);

  return {
    status: "forecast",
    text: `At recent pace, finish around ${finish.toLocaleDateString()}`,
    perDay,
    daysToFinish,
  };
}

function paceTone(goal) {
  const proj = projectedFinishDate(goal);
  if (proj.status === "done") return "green";
  if (proj.status === "forecast") {
    if (proj.daysToFinish <= 30) return "green";
    if (proj.daysToFinish <= 90) return "blue";
    return "amber";
  }
  return "steel";
}

function progressColor(value) {
  if (value >= 100) return GREEN;
  if (value >= 70) return "#22c55e";
  if (value >= 30) return BLUE;
  return PINK;
}

/* =========================
   shared visual pieces
========================= */
function GlassSection({ children, className = "" }) {
  return (
    <div
      className={
        "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,24,.96),rgba(7,11,21,.94))] shadow-[0_24px_60px_rgba(0,0,0,.42)] backdrop-blur-xl " +
        className
      }
    >
      {children}
    </div>
  );
}

function NativeSelect({ value, onChange, children, className = "", ...rest }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={
        "w-full h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 " +
        className
      }
      {...rest}
    >
      {children}
    </select>
  );
}

function CommandMetricCard({ title, value, sub, accentValue, tone = "green" }) {
  const toneMap = {
    red: { border: "rgba(255,93,115,.18)", glow: "rgba(255,93,115,.18)", accent: RED },
    green: { border: "rgba(74,222,128,.18)", glow: "rgba(74,222,128,.18)", accent: GREEN },
    blue: { border: "rgba(56,189,248,.18)", glow: "rgba(56,189,248,.18)", accent: BLUE },
    amber: { border: "rgba(245,158,11,.18)", glow: "rgba(245,158,11,.18)", accent: AMBER },
  };

  const t = toneMap[tone] || toneMap.green;

  return (
    <div
      className="relative overflow-hidden rounded-[24px] border p-5"
      style={{
        borderColor: t.border,
        background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.03), 0 0 28px ${t.glow}`,
      }}
    >
      <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/40">{title}</div>
      <div className="text-[26px] font-black leading-none text-white md:text-[32px]">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        {accentValue ? (
          <span className="font-black" style={{ color: t.accent }}>
            {accentValue}
          </span>
        ) : null}
        <span className="text-white/52">{sub}</span>
      </div>
    </div>
  );
}

function ProgressBar({ value = 0, color = GREEN, height = "h-3", animated = true }) {
  const pctValue = clamp(Number(value) || 0, 0, 100);

  return (
    <div
      className={`${height} relative overflow-hidden rounded-full bg-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,.25)]`}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.00) 100%)",
        }}
      />
      <div
        className={`h-full rounded-full ${animated ? "transition-all duration-700 ease-out" : ""}`}
        style={{
          width: `${pctValue}%`,
          background: `linear-gradient(90deg, ${color} 0%, rgba(255,255,255,.92) 180%)`,
          boxShadow: `0 0 18px ${color}55, 0 0 30px ${color}33`,
        }}
      >
        <div
          className="h-full w-full rounded-full opacity-40"
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 45%)",
          }}
        />
      </div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[10px] uppercase tracking-[0.22em] text-white/38">{label}</div>
      <div className="mt-2 text-lg font-black text-white">{value}</div>
    </div>
  );
}

function ToneBadge({ children, tone = "steel" }) {
  const tones = {
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    blue: "border-sky-400/20 bg-sky-400/10 text-sky-200",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    danger: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    steel: "border-white/10 bg-white/5 text-white/70",
  };

  return (
    <div className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] ${tones[tone] || tones.steel}`}>
      {children}
    </div>
  );
}

function SavingsProgressCard({ goal }) {
  const value = pct(goal);
  const color = progressColor(value);
  const projection = projectedFinishDate(goal);

  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 transition-all duration-200 hover:scale-[1.01] hover:bg-white/[0.045] hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[28px] font-black leading-none tracking-tight text-white md:text-[32px]">
            {goal.name}
          </div>
          <div className="mt-2 text-sm text-white/52">
            {money(goal.current)} of {money(goal.target)}
          </div>
        </div>

        <ToneBadge tone={value >= 100 ? "green" : value >= 30 ? "blue" : "steel"}>
          {Math.round(value)}%
        </ToneBadge>
      </div>

      <ProgressBar value={value} color={color} />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="text-white/45">{dueLabel(goal)}</div>
        <div className="font-black text-white/75">{goal.priority || "Medium"}</div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-white/[0.025] px-3 py-2">
        <div className="text-xs text-white/58">{projection.text}</div>
        <ToneBadge tone={paceTone(goal)}>
          {projection.status === "done"
            ? "Done"
            : projection.status === "forecast"
            ? "Momentum"
            : "Building"}
        </ToneBadge>
      </div>
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
  const [loading, setLoading] = React.useState(true);
  const [userId, setUserId] = React.useState(null);
  const [goals, setGoals] = React.useState([]);
  const [savingIds, setSavingIds] = React.useState({});
  const [pageError, setPageError] = React.useState("");

  const [tab, setTab] = React.useState("overview");

  const [preset, setPreset] = React.useState(GOAL_PRESETS[0]);
  const [customName, setCustomName] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [current, setCurrent] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [priority, setPriority] = React.useState("Medium");

  const [query, setQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState("priority_then_due");
  const [showArchived, setShowArchived] = React.useState(false);

  const [editingId, setEditingId] = React.useState(null);
  const [editDraft, setEditDraft] = React.useState({
    name: "",
    target: "",
    current: "",
    dueDate: "",
    priority: "Medium",
    archived: false,
  });

  const [openId, setOpenId] = React.useState(null);
  const [manageId, setManageId] = React.useState(null);

  const [customAdd, setCustomAdd] = React.useState({});
  const [customNote, setCustomNote] = React.useState({});

  const [ioText, setIoText] = React.useState("");

  const saveTimersRef = React.useRef({});

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
    setPageError("");

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
      setPageError(error.message || "Failed to load savings goals.");
      setGoals([]);
      setLoading(false);
      return;
    }

    setGoals((data || []).map(mapGoalRow));
    setLoading(false);
  }

  React.useEffect(() => {
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
      setPageError(error.message || "Failed to save goal.");
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
    setPageError("");
  }

  async function addGoal() {
    setPageError("");

    const n = resolvedName();
    const t = parseMoneyInput(target);
    const c = parseMoneyInput(current === "" ? "0" : current);

    if (!n) return alert("Goal name is required.");
    if (!Number.isFinite(t) || t <= 0) return alert("Target must be greater than 0.");
    if (!Number.isFinite(c) || c < 0) return alert("Starting saved must be 0 or more.");
    if (!userId) return alert("You must be signed in.");

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
      setPageError(insertError.message || "Failed to add goal.");
      await loadGoals();
    }
  }

  function startEdit(goal) {
    setEditingId(goal.id);
    setPageError("");
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
    setPageError("");

    const n = editDraft.name.trim();
    const t = parseMoneyInput(editDraft.target);
    const c = parseMoneyInput(editDraft.current === "" ? "0" : editDraft.current);

    if (!n) return alert("Goal name is required.");
    if (!Number.isFinite(t) || t <= 0) return alert("Target must be greater than 0.");
    if (!Number.isFinite(c) || c < 0) return alert("Current saved must be 0 or more.");

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
      setPageError(error.message || "Failed to delete goal.");
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
      return alert("Contribution amount must be greater than 0.");
    }

    setPageError("");

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
    setPageError("");

    setGoals((prev) => {
      const next = prev.map((g) => {
        if (g.id !== goalId) return g;

        const list = Array.isArray(g.contributions) ? g.contributions : [];
        if (list.length === 0) return g;

        const [last, ...rest] = list;
        const nextCurrent = Math.max(0, (Number(g.current) || 0) - (Number(last.amount) || 0));

        return {
          ...g,
          current: nextCurrent,
          contributions: rest,
        };
      });

      const changed = next.find((g) => g.id === goalId);
      if (changed) scheduleSave(changed);

      return next;
    });
  }

  const activeGoals = React.useMemo(() => goals.filter((g) => !g.archived), [goals]);

  const totals = React.useMemo(() => {
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

    const topOpenGoal =
      active
        .slice()
        .sort((a, b) => {
          const aLeft = Math.max(0, (Number(a.target) || 0) - (Number(a.current) || 0));
          const bLeft = Math.max(0, (Number(b.target) || 0) - (Number(b.current) || 0));
          return bLeft - aLeft;
        })[0] || null;

    const closestDueGoal =
      active
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

  const filteredGoals = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = goals.slice();

    if (!showArchived) list = list.filter((g) => !g.archived);
    if (q) {
      list = list.filter((g) => String(g.name || "").toLowerCase().includes(q));
    }

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

  const progressGoals = React.useMemo(() => {
    return activeGoals.slice().sort((a, b) => pct(b) - pct(a)).slice(0, 6);
  }, [activeGoals]);

  const focusGoal = totals.topOpenGoal;

  if (loading) {
    return (
      <div className="mx-auto max-w-[1700px] px-4 py-4">
        <GlassSection className="p-5 text-white/70">Loading savings...</GlassSection>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <GlassSection className="overflow-hidden px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.26em] text-sky-300/75">
              Life Command Center
            </div>
            <h1 className="m-0 text-3xl font-bold tracking-tight text-white">
              Savings Control
            </h1>
            <div className="mt-1 text-sm text-white/50">
              Track goal pressure, build reserves, and forecast what needs funded next.
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-11 rounded-full border border-white/10 bg-black/40 p-1">
              <TabsTrigger value="overview" className="rounded-full px-5 text-sm">Overview</TabsTrigger>
              <TabsTrigger value="manage" className="rounded-full px-5 text-sm">Manage</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </GlassSection>

      {pageError ? (
        <GlassSection className="border-red-400/20 p-4">
          <div className="font-black text-white">Savings issue</div>
          <div className="mt-1 text-sm text-white/60">{pageError}</div>
        </GlassSection>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <CommandMetricCard
          title="Saved"
          value={money(totals.totalCurrent)}
          sub={`${totals.activeCount} active goal${totals.activeCount === 1 ? "" : "s"}`}
          accentValue={`${totals.fundedCount} funded`}
          tone="green"
        />
        <CommandMetricCard
          title="Remaining"
          value={money(totals.left)}
          sub={`from ${money(totals.totalTarget)} total target`}
          accentValue={totals.left > 0 ? "still open" : "fully covered"}
          tone="blue"
        />
        <CommandMetricCard
          title="Funding Health"
          value={`${totals.overallPct}%`}
          sub={
            totals.closestDueGoal
              ? `${dueLabel(totals.closestDueGoal)}`
              : "No current due-date pressure"
          }
          accentValue={
            totals.closestDueGoal ? totals.closestDueGoal.name : "stable"
          }
          tone={totals.dueSoonCount > 0 ? "amber" : "green"}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="hidden" />

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,.85fr)]">
            <GlassSection className="p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-2xl font-black text-white">Savings Progress</div>
                  <div className="mt-1 text-sm text-white/52">
                    Best-funded goals right now.
                  </div>
                </div>

                <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/60">
                  Top funded
                </div>
              </div>

              <div className="space-y-3">
                {progressGoals.length === 0 ? (
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
                    No active goals yet.
                  </div>
                ) : (
                  progressGoals.map((g) => <SavingsProgressCard key={g.id} goal={g} />)
                )}
              </div>
            </GlassSection>

            <GlassSection className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-[0.24em] text-white/40">Focus Goal</div>
                  <div className="text-xl font-black text-white">
                    {focusGoal?.name || "No active goals"}
                  </div>
                </div>

                <ToneBadge tone={focusGoal ? priorityTone(focusGoal.priority) : "steel"}>
                  {focusGoal ? (focusGoal.priority || "Medium") : "Idle"}
                </ToneBadge>
              </div>

              <div className="mt-5">
                <ProgressBar
                  value={focusGoal ? pct(focusGoal) : 0}
                  color={focusGoal ? progressColor(pct(focusGoal)) : BLUE}
                  height="h-4"
                />
              </div>

              <div className="mt-4 grid gap-3">
                <MiniMetric label="Saved" value={money(focusGoal?.current || 0)} />
                <MiniMetric label="Target" value={money(focusGoal?.target || 0)} />
                <MiniMetric
                  label="Left"
                  value={money(
                    Math.max(
                      0,
                      (Number(focusGoal?.target) || 0) - (Number(focusGoal?.current) || 0)
                    )
                  )}
                />
                <MiniMetric label="Due" value={focusGoal ? dueLabel(focusGoal) : "No due date"} />
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.025))] p-4">
                <div className="mb-2 text-sm text-white/55">Quick read</div>
                <div className="text-sm leading-7 text-white/88">
                  {focusGoal ? (
                    (() => {
                      const left = Math.max(
                        0,
                        (Number(focusGoal.target) || 0) - (Number(focusGoal.current) || 0)
                      );
                      const projection = projectedFinishDate(focusGoal);

                      if (left <= 0) return "This goal is already fully funded.";
                      if (projection.status === "forecast") return projection.text;
                      if (focusGoal.dueDate) {
                        return `You still need ${money(left)} before ${fmtDate(focusGoal.dueDate)}.`;
                      }
                      return "This goal has no due date yet, so pace pressure is low until you assign one.";
                    })()
                  ) : (
                    "Add a savings goal to generate live focus insights."
                  )}
                </div>
              </div>
            </GlassSection>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,.82fr)]">
            <GlassSection className="p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-2xl font-black text-white">Goals</div>
                  <div className="mt-1 text-sm text-white/52">Priority-first savings pressure view.</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Input
                    className="h-11 w-[220px] rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                    placeholder="Search goals..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />

                  <NativeSelect
                    className="w-[210px]"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="priority_then_due">Priority → Due</option>
                    <option value="due">Due date</option>
                    <option value="progress">Progress</option>
                    <option value="left">Amount left</option>
                    <option value="name">Name</option>
                  </NativeSelect>

                  <Button variant="secondary" onClick={() => setShowArchived((v) => !v)}>
                    {showArchived ? "Hide archived" : "Show archived"}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {filteredGoals.length === 0 ? (
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
                    No goals showing.
                  </div>
                ) : (
                  filteredGoals.map((g) => {
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
                        className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 transition-all duration-200 hover:scale-[1.005] hover:bg-white/[0.045] hover:shadow-[0_0_34px_rgba(255,255,255,0.045)]"
                      >
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                              <Input
                                className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white"
                                value={editDraft.name}
                                onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                                placeholder="Goal name"
                              />

                              <Input
                                className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white"
                                value={editDraft.target}
                                onChange={(e) => setEditDraft((d) => ({ ...d, target: e.target.value }))}
                                inputMode="decimal"
                                placeholder="Target"
                              />

                              <Input
                                className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white"
                                value={editDraft.current}
                                onChange={(e) => setEditDraft((d) => ({ ...d, current: e.target.value }))}
                                inputMode="decimal"
                                placeholder="Saved"
                              />

                              <Input
                                className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white"
                                type="date"
                                value={editDraft.dueDate}
                                onChange={(e) => setEditDraft((d) => ({ ...d, dueDate: e.target.value }))}
                              />

                              <NativeSelect
                                value={editDraft.priority}
                                onChange={(e) => setEditDraft((d) => ({ ...d, priority: e.target.value }))}
                              >
                                {["High", "Medium", "Low"].map((p) => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </NativeSelect>
                            </div>

                            <label className="flex items-center gap-2 text-sm text-white/65">
                              <input
                                type="checkbox"
                                checked={!!editDraft.archived}
                                onChange={(e) => setEditDraft((d) => ({ ...d, archived: e.target.checked }))}
                              />
                              Archive this goal
                            </label>

                            <div className="flex flex-wrap gap-2">
                              <Button onClick={() => saveEdit(g.id)}>Save</Button>
                              <Button variant="secondary" onClick={cancelEdit}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="truncate text-2xl font-black tracking-tight text-white">
                                    {g.name}
                                  </div>

                                  <ToneBadge tone={priorityTone(g.priority)}>
                                    {g.priority || "Medium"}
                                  </ToneBadge>

                                  <ToneBadge tone={dueTone(g)}>
                                    {dueLabel(g)}
                                  </ToneBadge>

                                  {archived ? <ToneBadge tone="steel">Archived</ToneBadge> : null}
                                  {savingIds[g.id] ? <ToneBadge tone="blue">Saving</ToneBadge> : null}
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                  <MiniMetric label="Saved" value={money(c)} />
                                  <MiniMetric label="Target" value={money(t)} />
                                  <MiniMetric label="Left" value={money(left)} />
                                  <MiniMetric label="Funded" value={`${Math.round(value)}%`} />
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button onClick={() => setOpenId(panelOpen ? null : g.id)}>
                                  {panelOpen ? "Close" : "Contribute"}
                                </Button>

                                <Button variant="secondary" onClick={() => setManageId(manageOpen ? null : g.id)}>
                                  {manageOpen ? "Close" : "Manage"}
                                </Button>
                              </div>
                            </div>

                            <div className="mt-4">
                              <ProgressBar value={value} color={progressColor(value)} />

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                                <div className="text-white/55">
                                  {g.dueDate && left > 0 && pace.daysLeft !== null && pace.daysLeft >= 0 ? (
                                    <>
                                      Need <b>{money(pace.perMonth)}</b>/month • <b>{money(pace.perWeek)}</b>/week • <b>{money(pace.perDay)}</b>/day
                                    </>
                                  ) : (
                                    <>No pace target needed yet.</>
                                  )}
                                </div>

                                <div className="font-black text-white/75">
                                  {money(c)} / {money(t)}
                                </div>
                              </div>
                            </div>

                            {manageOpen ? (
                              <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-lg font-black text-white">Manage {g.name}</div>
                                    <div className="mt-1 text-sm text-white/55">
                                      Edit, archive, or delete this goal.
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    <Button variant="secondary" onClick={() => startEdit(g)}>
                                      Edit
                                    </Button>
                                    <Button variant="secondary" onClick={() => setArchived(g.id, !archived)}>
                                      {archived ? "Unarchive" : "Archive"}
                                    </Button>
                                    <Button variant="destructive" onClick={() => removeGoal(g.id)}>
                                      Delete
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {panelOpen ? (
                              <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-lg font-black text-white">Contribute to {g.name}</div>
                                    <div className="mt-1 text-sm text-white/55">
                                      Quick adds or a custom contribution with note.
                                    </div>
                                  </div>

                                  <Button variant="secondary" onClick={() => undoLast(g.id)}>
                                    Undo last
                                  </Button>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                  {QUICK_AMOUNTS.map((amt) => (
                                    <Button
                                      key={amt}
                                      variant="secondary"
                                      onClick={() => applyContribution(g.id, amt, "Quick add")}
                                    >
                                      +{money(amt)}
                                    </Button>
                                  ))}
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_120px]">
                                  <Input
                                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white"
                                    inputMode="decimal"
                                    placeholder="Custom amount"
                                    value={customAdd[g.id] ?? ""}
                                    onChange={(e) => setCustomAdd((m) => ({ ...m, [g.id]: e.target.value }))}
                                  />

                                  <Input
                                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white"
                                    placeholder="Note (optional)"
                                    value={customNote[g.id] ?? ""}
                                    onChange={(e) => setCustomNote((m) => ({ ...m, [g.id]: e.target.value }))}
                                  />

                                  <Button
                                    onClick={() =>
                                      applyContribution(
                                        g.id,
                                        parseMoneyInput(customAdd[g.id] ?? ""),
                                        customNote[g.id] ?? ""
                                      )
                                    }
                                  >
                                    Add
                                  </Button>
                                </div>

                                <div className="mt-4">
                                  <div className="mb-2 text-sm text-white/55">Recent contributions</div>

                                  {Array.isArray(g.contributions) && g.contributions.length > 0 ? (
                                    <div className="space-y-2">
                                      {g.contributions.slice(0, 5).map((x) => (
                                        <div key={x.id} className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
                                          <div className="flex items-center justify-between gap-3">
                                            <div>
                                              <div className="text-base font-black text-white">{money(x.amount)}</div>
                                              <div className="mt-1 text-xs text-white/45">
                                                {fmtDate(x.date)} {x.note ? `• ${x.note}` : ""}
                                              </div>
                                            </div>
                                            <Badge variant="outline">Logged</Badge>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-white/55">No contributions yet.</div>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </GlassSection>

            <GlassSection className="p-5">
              <div className="mb-4">
                <div className="text-2xl font-black text-white">Priority Pressure</div>
                <div className="mt-1 text-sm text-white/52">Deadlines and pace risk.</div>
              </div>

              <div className="space-y-3">
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 text-[10px] uppercase tracking-[0.24em] text-white/40">Closest Due Goal</div>
                      <div className="text-lg font-black text-white">
                        {totals.closestDueGoal ? totals.closestDueGoal.name : "No urgent due dates"}
                      </div>
                    </div>

                    <ToneBadge tone={totals.closestDueGoal ? dueTone(totals.closestDueGoal) : "steel"}>
                      {totals.closestDueGoal ? dueLabel(totals.closestDueGoal) : "Relaxed"}
                    </ToneBadge>
                  </div>

                  <div className="mt-3 text-sm leading-7 text-white/80">
                    {totals.closestDueGoal
                      ? `Closest dated goal is ${totals.closestDueGoal.name}. ${dueLabel(totals.closestDueGoal)}.`
                      : "No goal currently has a due date. Pace pressure is low right now."}
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-2 text-sm text-white/55">Quick read</div>
                  <div className="text-sm leading-7 text-white/88">
                    {totals.dueSoonCount > 0
                      ? `${totals.dueSoonCount} goal${totals.dueSoonCount === 1 ? "" : "s"} due inside 14 days.`
                      : "No immediate due-date pressure in the next 14 days."}
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.24em] text-white/40">Activity</div>
                  <div className="text-lg font-black text-white">
                    {totals.recentContributionCount} logged contribution{totals.recentContributionCount === 1 ? "" : "s"}
                  </div>
                  <div className="mt-2 text-sm text-white/55">
                    This page is saving cloud-first through Supabase across devices.
                  </div>
                </div>
              </div>
            </GlassSection>
          </div>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
            <GlassSection className="p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-black text-white">Create Goal</div>
                  <div className="mt-1 text-sm text-white/55">Saved directly to Supabase.</div>
                </div>

                <ToneBadge tone="blue">Cloud</ToneBadge>
              </div>

              <div className="grid gap-3 md:grid-cols-12">
                <div className="md:col-span-4">
                  <Label className="mb-2 block text-xs text-white/55">Goal</Label>
                  <NativeSelect value={preset} onChange={(e) => setPreset(e.target.value)}>
                    {GOAL_PRESETS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="md:col-span-4">
                  <Label className="mb-2 block text-xs text-white/55">Target</Label>
                  <Input
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                    inputMode="decimal"
                    placeholder="$10,000"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                </div>

                <div className="md:col-span-4">
                  <Label className="mb-2 block text-xs text-white/55">Starting saved</Label>
                  <Input
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                    inputMode="decimal"
                    placeholder="$0"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                  />
                </div>
              </div>

              {preset === "Other" ? (
                <div className="mt-3">
                  <Label className="mb-2 block text-xs text-white/55">Custom goal name</Label>
                  <Input
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                    placeholder="Custom goal name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>
              ) : null}

              <div className="mt-3 grid gap-3 md:grid-cols-12">
                <div className="md:col-span-6">
                  <Label className="mb-2 block text-xs text-white/55">Due date</Label>
                  <Input
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div className="md:col-span-6">
                  <Label className="mb-2 block text-xs text-white/55">Priority</Label>
                  <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value)}>
                    {["High", "Medium", "Low"].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={addGoal}>Add Goal</Button>
                <Button variant="secondary" onClick={clearAddForm}>Clear</Button>
              </div>
            </GlassSection>

            <GlassSection className="p-5">
              <div className="mb-4">
                <div className="text-lg font-black text-white">Import / Export</div>
                <div className="mt-1 text-sm text-white/55">
                  Export copies JSON. Import replaces this signed-in user’s current savings goals in Supabase.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={async () => {
                    const payload = JSON.stringify(goals, null, 2);
                    setIoText(payload);
                    try {
                      await navigator.clipboard.writeText(payload);
                    } catch {}
                  }}
                >
                  Export (copy)
                </Button>

                <Button variant="secondary" onClick={() => setIoText("")}>
                  Clear text
                </Button>

                <Button
                  variant="secondary"
                  onClick={async () => {
                    setPageError("");

                    let parsed = null;
                    try {
                      parsed = JSON.parse(ioText || "[]");
                    } catch {
                      setPageError("Import failed: invalid JSON.");
                      return;
                    }

                    if (!Array.isArray(parsed)) {
                      setPageError("Import failed: JSON must be an array of goals.");
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
                        setPageError(deleteError.message || "Import delete failed.");
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
                          setPageError(insertError.message || "Import failed.");
                          await loadGoals();
                        }
                      }
                    }
                  }}
                >
                  Import (replace)
                </Button>
              </div>

              <div className="mt-4">
                <textarea
                  className="min-h-[260px] w-full rounded-[22px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white outline-none placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-sky-400/40"
                  value={ioText}
                  onChange={(e) => setIoText(e.target.value)}
                  placeholder="Paste exported JSON here to import..."
                />
              </div>
            </GlassSection>
          </div>

          <GlassSection className="p-5">
            <div className="mb-4">
              <div className="text-lg font-black text-white">Manage Goals</div>
              <div className="mt-1 text-sm text-white/55">Search, sort, archive, edit, and fund.</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Input
                className="h-11 w-[220px] rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/35"
                placeholder="Search goals..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              <NativeSelect
                className="w-[210px]"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="priority_then_due">Priority → Due</option>
                <option value="due">Due date</option>
                <option value="progress">Progress</option>
                <option value="left">Amount left</option>
                <option value="name">Name</option>
              </NativeSelect>

              <Button variant="secondary" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? "Hide archived" : "Show archived"}
              </Button>
            </div>
          </GlassSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}