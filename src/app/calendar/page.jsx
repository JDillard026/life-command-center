"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

/* =========================================================
   LIFE COMMAND CENTER — CALENDAR COMMAND
   Full rewrite v2
   - cleaner month grid
   - click day opens scrollable timeline drawer
   - synced spending/planned/income items supported
   - manual events editable
   ========================================================= */

const TONE = {
  green: "#4ade80",
  red: "#ff6b7f",
  amber: "#f59e0b",
  blue: "#8fd0ff",
  slate: "#94a3b8",
};

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
function parseISO(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfMonthISO(iso) {
  const d = parseISO(iso) ?? new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}
function addMonthsISO(monthStartISO, delta) {
  const d = parseISO(monthStartISO) ?? new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}
function addDaysISO(iso, delta) {
  const d = parseISO(iso) ?? new Date();
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}
function startOfWeekISO(iso, weekStartsOn = 0) {
  const d = parseISO(iso) ?? new Date();
  const day = d.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return toISODate(d);
}
function monthLabel(monthStartISO) {
  const d = parseISO(monthStartISO) ?? new Date();
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function fmtLongDate(iso) {
  const d = parseISO(iso);
  if (!d) return "";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function weekdayShort(i) {
  const base = new Date(2021, 7, 1 + i);
  return base.toLocaleDateString(undefined, { weekday: "short" });
}
function inSameMonth(dayISO, monthStartISO) {
  const d = parseISO(dayISO);
  const m = parseISO(monthStartISO);
  if (!d || !m) return false;
  return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
}
function fmtMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0.00";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}
function timeSortValue(hhmm) {
  if (!hhmm) return -1;
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}
function fmtTime(hhmm) {
  if (!hhmm) return "All day";
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function isTodayISO(iso) {
  return iso === todayISO();
}
function sourceLabel(ev) {
  if (ev.source === "spending") return "Synced from Spending";
  if (ev.source === "planned_expense") return "Synced planned item";
  if (ev.source === "income") return "Synced income";
  return "Manual event";
}
function toneForEvent(ev) {
  const source = String(ev?.source || "");
  const flow = String(ev?.flow || "none").toLowerCase();
  const category = String(ev?.category || "").toLowerCase();
  const title = String(ev?.title || "").toLowerCase();

  if (flow === "income" || category === "payday" || source === "income" || title.includes("payday") || title.includes("income")) {
    return {
      line: TONE.green,
      border: "rgba(74,222,128,.22)",
      badgeClass: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
      cardGlow: "0 0 0 1px rgba(74,222,128,.10), 0 0 20px rgba(74,222,128,.08)",
      label: "Income",
    };
  }

  if (source === "planned_expense") {
    return {
      line: TONE.amber,
      border: "rgba(245,158,11,.22)",
      badgeClass: "border-amber-400/20 bg-amber-400/10 text-amber-200",
      cardGlow: "0 0 0 1px rgba(245,158,11,.10), 0 0 20px rgba(245,158,11,.08)",
      label: "Planned",
    };
  }

  if (flow === "expense" || source === "spending") {
    return {
      line: TONE.red,
      border: "rgba(255,107,127,.22)",
      badgeClass: "border-red-400/20 bg-red-400/10 text-red-200",
      cardGlow: "0 0 0 1px rgba(255,107,127,.10), 0 0 20px rgba(255,107,127,.08)",
      label: "Expense",
    };
  }

  return {
    line: TONE.blue,
    border: "rgba(143,208,255,.22)",
    badgeClass: "border-sky-400/20 bg-sky-400/10 text-sky-200",
    cardGlow: "0 0 0 1px rgba(143,208,255,.10), 0 0 20px rgba(143,208,255,.08)",
    label: "General",
  };
}
function emptyEvent(dateISO, profileId = "") {
  return {
    id: "",
    profile_id: profileId,
    title: "",
    event_date: dateISO,
    event_time: "",
    end_time: "",
    category: "General",
    flow: "none",
    amount: "",
    note: "",
    status: "scheduled",
    color: "#94a3b8",
    source: "manual",
    source_id: "",
    source_table: "",
    auto_created: false,
    transaction_type: null,
  };
}
function paydayTemplate(dateISO, profileId = "") {
  return {
    ...emptyEvent(dateISO, profileId),
    title: "Payday",
    event_time: "09:00",
    category: "Payday",
    flow: "income",
    color: "#22c55e",
    transaction_type: "income",
  };
}
function expenseTemplate(dateISO, profileId = "") {
  return {
    ...emptyEvent(dateISO, profileId),
    title: "Expense",
    category: "Expense",
    flow: "expense",
    color: "#ef4444",
    transaction_type: "expense",
  };
}
function mapProfileRow(row) {
  return {
    id: row.id,
    name: row.name || "Default",
    is_default: Boolean(row.is_default),
    color: row.color || "#94a3b8",
  };
}
function mapEventRow(row) {
  return {
    id: row.id,
    profile_id: row.profile_id || "",
    title: row.title || "",
    event_date: row.event_date,
    event_time: row.event_time || "",
    end_time: row.end_time || "",
    category: row.category || "General",
    flow: row.flow || "none",
    amount: Number(row.amount || 0),
    note: row.note || "",
    status: row.status || "scheduled",
    color: row.color || "#94a3b8",
    source: row.source || "manual",
    source_id: row.source_id || "",
    source_table: row.source_table || "",
    auto_created: Boolean(row.auto_created),
    transaction_type: row.transaction_type || null,
  };
}

function ShellCard({ children, className = "" }) {
  return (
    <div className={`rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,28,.95),rgba(7,11,21,.92))] shadow-[0_24px_60px_rgba(0,0,0,.42)] backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}
function NativeSelect({ value, onChange, children, className = "", ...rest }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/10 ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
function StatCard({ title, value, sub, tone = "neutral" }) {
  const map = {
    good: { border: "rgba(74,222,128,.18)", glow: "rgba(74,222,128,.16)" },
    bad: { border: "rgba(255,107,127,.18)", glow: "rgba(255,107,127,.16)" },
    warn: { border: "rgba(245,158,11,.18)", glow: "rgba(245,158,11,.16)" },
    neutral: { border: "rgba(255,255,255,.10)", glow: "rgba(255,255,255,.04)" },
  };
  const t = map[tone] || map.neutral;

  return (
    <div
      className="rounded-[24px] border p-5"
      style={{
        borderColor: t.border,
        background: "linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.02))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.03), 0 0 28px ${t.glow}`,
      }}
    >
      <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/38">{title}</div>
      <div className="text-[28px] font-black leading-none text-white md:text-[34px]">{value}</div>
      <div className="mt-2 text-sm text-white/52">{sub}</div>
    </div>
  );
}
function DotBadge({ children, tone = "neutral" }) {
  const map = {
    good: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    bad: "border-red-400/20 bg-red-400/10 text-red-200",
    warn: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    neutral: "border-white/10 bg-white/[0.04] text-white/80",
    blue: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${map[tone] || map.neutral}`}>{children}</span>;
}
function RowMenu({ children }) {
  return (
    <details className="relative">
      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-white/80 transition hover:bg-white/[0.07]">
        …
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-52 rounded-2xl border border-white/10 bg-[#0c1322] p-2 shadow-[0_20px_50px_rgba(0,0,0,.45)]">
        {children}
      </div>
    </details>
  );
}
function MenuButton({ children, onClick, tone = "default" }) {
  const toneClass =
    tone === "danger"
      ? "text-red-300 hover:bg-red-400/10"
      : tone === "success"
      ? "text-emerald-300 hover:bg-emerald-400/10"
      : "text-white/82 hover:bg-white/8";

  return (
    <button type="button" onClick={onClick} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${toneClass}`}>
      {children}
    </button>
  );
}
function Modal({ open, title, onClose, children, width = "min(860px, 100%)" }) {
  if (!open) return null;
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-5"
    >
      <div
        className="max-h-[92vh] overflow-auto rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,25,42,.98),rgba(8,12,24,.98))] p-5 shadow-[0_28px_90px_rgba(0,0,0,.45)]"
        style={{ width }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-xl font-black text-white">{title}</div>
          <Button type="button" onClick={onClose} variant="outline" className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Drawer({ open, onClose, children }) {
  return (
    <div className={`fixed inset-0 z-[65] transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/55 transition ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-[720px] transform border-l border-white/10 bg-[linear-gradient(180deg,rgba(11,18,32,.98),rgba(6,10,18,.98))] shadow-[-24px_0_70px_rgba(0,0,0,.35)] transition duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {children}
      </div>
    </div>
  );
}
function TimelineItem({ ev, onEdit, onDelete, onDuplicate }) {
  const tone = toneForEvent(ev);

  return (
    <div className="relative pl-11">
      <div className="absolute left-[13px] top-0 bottom-[-24px] w-px bg-white/10" />
      <div className="absolute left-0 top-4 flex h-7 w-7 items-center justify-center rounded-full border bg-[#0f1627]" style={{ borderColor: tone.border }}>
        <div className="h-3 w-3 rounded-full" style={{ background: tone.line, boxShadow: `0 0 15px ${tone.line}66` }} />
      </div>

      <div
        className="rounded-[22px] border p-4"
        style={{
          borderColor: tone.border,
          boxShadow: tone.cardGlow,
          background: "linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.018))",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate text-lg font-black text-white">{ev.title}</div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${tone.badgeClass}`}>{tone.label}</span>
              {ev.auto_created ? <DotBadge tone="neutral">Synced</DotBadge> : <DotBadge tone="blue">Manual</DotBadge>}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <DotBadge tone="neutral">{fmtTime(ev.event_time)}</DotBadge>
              {ev.end_time ? <DotBadge tone="neutral">Ends {fmtTime(ev.end_time)}</DotBadge> : null}
              {ev.amount ? (
                <DotBadge tone={ev.source === "planned_expense" ? "warn" : ev.flow === "income" ? "good" : ev.flow === "expense" ? "bad" : "neutral"}>
                  {fmtMoney(ev.amount)}
                </DotBadge>
              ) : null}
              {ev.category ? <DotBadge tone="neutral">{ev.category}</DotBadge> : null}
              <DotBadge tone="neutral">{sourceLabel(ev)}</DotBadge>
            </div>

            {ev.note ? <div className="mt-3 text-sm leading-6 text-white/66">{ev.note}</div> : null}
          </div>

          <RowMenu>
            {ev.auto_created ? (
              <>
                <MenuButton onClick={() => onDuplicate(ev)} tone="success">Copy as manual event</MenuButton>
                <div className="px-3 py-2 text-xs leading-5 text-white/45">
                  Edit or delete this from Spending/Income so sync stays clean.
                </div>
              </>
            ) : (
              <>
                <MenuButton onClick={() => onEdit(ev)}>Edit</MenuButton>
                <MenuButton onClick={() => onDelete(ev)} tone="danger">Delete</MenuButton>
              </>
            )}
          </RowMenu>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [loading, setLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState("");
  const [status, setStatus] = React.useState("");

  const [user, setUser] = React.useState(null);
  const [profiles, setProfiles] = React.useState([]);
  const [profileId, setProfileId] = React.useState("");

  const [monthStart, setMonthStart] = React.useState(startOfMonthISO(todayISO()));
  const [selectedDate, setSelectedDate] = React.useState(todayISO());

  const [events, setEvents] = React.useState([]);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState("All");

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [editorOpen, setEditorOpen] = React.useState(false);

  const [newProfileName, setNewProfileName] = React.useState("");
  const [draft, setDraft] = React.useState(emptyEvent(todayISO(), ""));

  React.useEffect(() => {
    let alive = true;

    async function boot() {
      try {
        setLoading(true);
        setPageError("");

        const {
          data: { user: currentUser },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;
        if (!alive) return;

        setUser(currentUser || null);

        if (!currentUser) {
          setLoading(false);
          return;
        }

        const { data: profileRows, error: profileErr } = await supabase
          .from("calendar_profiles")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true });

        if (profileErr) throw profileErr;

        let loadedProfiles = (profileRows || []).map(mapProfileRow);

        if (loadedProfiles.length === 0) {
          const fallback = {
            id: uid(),
            user_id: currentUser.id,
            name: "Default",
            is_default: true,
            color: "#94a3b8",
          };

          const { data: inserted, error: createErr } = await supabase
            .from("calendar_profiles")
            .insert([fallback])
            .select()
            .single();

          if (createErr) throw createErr;
          loadedProfiles = [mapProfileRow(inserted)];
        }

        if (!alive) return;

        setProfiles(loadedProfiles);
        const chosen = loadedProfiles.find((p) => p.is_default)?.id || loadedProfiles[0]?.id || "";
        setProfileId(chosen);
        setDraft((prev) => ({ ...prev, profile_id: chosen }));
      } catch (err) {
        if (!alive) return;
        setPageError(err?.message || "Failed to load calendar.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    boot();
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    if (!user || !profileId) return;

    let alive = true;

    async function loadEvents() {
      try {
        const gridStart = startOfWeekISO(monthStart, 0);
        const gridEnd = addDaysISO(gridStart, 41);

        const { data, error } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("user_id", user.id)
          .eq("profile_id", profileId)
          .gte("event_date", gridStart)
          .lte("event_date", gridEnd)
          .order("event_date", { ascending: true })
          .order("event_time", { ascending: true });

        if (error) throw error;
        if (!alive) return;

        setEvents((data || []).map(mapEventRow));
      } catch (err) {
        if (!alive) return;
        setPageError(err?.message || "Failed to load events.");
      }
    }

    loadEvents();
    return () => {
      alive = false;
    };
  }, [user, profileId, monthStart]);

  const monthGridDays = React.useMemo(() => {
    const firstCell = startOfWeekISO(monthStart, 0);
    return Array.from({ length: 42 }, (_, i) => addDaysISO(firstCell, i));
  }, [monthStart]);

  const filteredEvents = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return events.filter((ev) => {
      const category = String(ev.category || "").toLowerCase();
      const flow = String(ev.flow || "").toLowerCase();
      const source = String(ev.source || "").toLowerCase();
      const title = String(ev.title || "").toLowerCase();

      if (filter === "Paydays") {
        if (!(flow === "income" || category === "payday" || source === "income" || title.includes("payday") || title.includes("income"))) return false;
      } else if (filter === "Expenses") {
        if (!(flow === "expense" || source === "spending")) return false;
      } else if (filter === "Planned") {
        if (source !== "planned_expense") return false;
      } else if (filter === "Manual") {
        if (source !== "manual") return false;
      }

      if (!q) return true;

      const hay = [ev.title, ev.note, ev.category, ev.flow, ev.source, ev.event_date, ev.event_time].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [events, search, filter]);

  const eventsByDate = React.useMemo(() => {
    const map = new Map();
    for (const ev of filteredEvents) {
      const key = ev.event_date;
      const arr = map.get(key) || [];
      arr.push(ev);
      map.set(key, arr);
    }
    for (const [key, arr] of map.entries()) {
      map.set(
        key,
        [...arr].sort((a, b) => {
          const aTime = timeSortValue(a.event_time);
          const bTime = timeSortValue(b.event_time);
          if (aTime !== bTime) return aTime - bTime;
          return String(a.title).localeCompare(String(b.title));
        })
      );
    }
    return map;
  }, [filteredEvents]);

  const selectedDayEvents = React.useMemo(() => {
    return [...(eventsByDate.get(selectedDate) || [])].sort((a, b) => {
      const aTime = timeSortValue(a.event_time);
      const bTime = timeSortValue(b.event_time);
      if (aTime !== bTime) return aTime - bTime;
      return String(a.title).localeCompare(String(b.title));
    });
  }, [eventsByDate, selectedDate]);

  const selectedAllDay = React.useMemo(() => selectedDayEvents.filter((ev) => !ev.event_time), [selectedDayEvents]);
  const selectedTimed = React.useMemo(() => selectedDayEvents.filter((ev) => !!ev.event_time), [selectedDayEvents]);

  const monthEvents = React.useMemo(() => filteredEvents.filter((ev) => inSameMonth(ev.event_date, monthStart)), [filteredEvents, monthStart]);

  const monthIn = React.useMemo(
    () => monthEvents.filter((ev) => String(ev.flow) === "income").reduce((sum, ev) => sum + Number(ev.amount || 0), 0),
    [monthEvents]
  );
  const monthOut = React.useMemo(
    () => monthEvents.filter((ev) => String(ev.flow) === "expense" && ev.source !== "planned_expense").reduce((sum, ev) => sum + Number(ev.amount || 0), 0),
    [monthEvents]
  );
  const monthPlanned = React.useMemo(
    () => monthEvents.filter((ev) => ev.source === "planned_expense").reduce((sum, ev) => sum + Number(ev.amount || 0), 0),
    [monthEvents]
  );

  const dayIn = React.useMemo(
    () => selectedDayEvents.filter((ev) => String(ev.flow) === "income").reduce((sum, ev) => sum + Number(ev.amount || 0), 0),
    [selectedDayEvents]
  );
  const dayOut = React.useMemo(
    () => selectedDayEvents.filter((ev) => String(ev.flow) === "expense" && ev.source !== "planned_expense").reduce((sum, ev) => sum + Number(ev.amount || 0), 0),
    [selectedDayEvents]
  );
  const dayPlanned = React.useMemo(
    () => selectedDayEvents.filter((ev) => ev.source === "planned_expense").reduce((sum, ev) => sum + Number(ev.amount || 0), 0),
    [selectedDayEvents]
  );

  function openDay(dayISO) {
    setSelectedDate(dayISO);
    setDrawerOpen(true);
  }

  function openCreate(dateISO) {
    setDraft(emptyEvent(dateISO || selectedDate, profileId));
    setEditorOpen(true);
  }

  function openPayday(dateISO) {
    setDraft(paydayTemplate(dateISO || selectedDate, profileId));
    setEditorOpen(true);
  }

  function openExpense(dateISO) {
    setDraft(expenseTemplate(dateISO || selectedDate, profileId));
    setEditorOpen(true);
  }

  function openEdit(ev) {
    if (ev.auto_created) {
      setPageError("That item is synced from Spending/Income. Edit it from the source page so the sync stays clean.");
      return;
    }

    setDraft({
      id: ev.id,
      profile_id: ev.profile_id || profileId,
      title: ev.title || "",
      event_date: ev.event_date || selectedDate,
      event_time: ev.event_time || "",
      end_time: ev.end_time || "",
      category: ev.category || "General",
      flow: ev.flow || "none",
      amount: String(ev.amount ?? ""),
      note: ev.note || "",
      status: ev.status || "scheduled",
      color: ev.color || "#94a3b8",
      source: ev.source || "manual",
      source_id: ev.source_id || "",
      source_table: ev.source_table || "",
      auto_created: Boolean(ev.auto_created),
      transaction_type: ev.transaction_type || null,
    });
    setEditorOpen(true);
  }

  function patchDraft(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function saveEvent(e) {
    e?.preventDefault?.();
    if (!user || !profileId) return;

    const title = String(draft.title || "").trim();
    if (!title) {
      setPageError("Title is required.");
      return;
    }

    const amountValue = parseMoneyInput(draft.amount);

    const payload = {
      user_id: user.id,
      profile_id: draft.profile_id || profileId,
      title,
      event_date: draft.event_date,
      event_time: draft.event_time || null,
      end_time: draft.end_time || null,
      category: draft.category || "General",
      flow: draft.flow || "none",
      amount: Number.isFinite(amountValue) ? amountValue : 0,
      note: draft.note || "",
      status: draft.status || "scheduled",
      color: draft.color || "#94a3b8",
      source: "manual",
      source_id: null,
      source_table: null,
      auto_created: false,
      transaction_type:
        draft.flow === "income" ? "income" : draft.flow === "expense" ? "expense" : null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (draft.id) {
        const { data, error } = await supabase
          .from("calendar_events")
          .update(payload)
          .eq("id", draft.id)
          .eq("user_id", user.id)
          .eq("auto_created", false)
          .select()
          .single();

        if (error) throw error;

        const saved = mapEventRow(data);
        setEvents((prev) => prev.map((ev) => (ev.id === saved.id ? saved : ev)));
      } else {
        const { data, error } = await supabase
          .from("calendar_events")
          .insert([{ ...payload, id: uid(), created_at: new Date().toISOString() }])
          .select()
          .single();

        if (error) throw error;

        const saved = mapEventRow(data);
        setEvents((prev) => [...prev, saved]);
      }

      setSelectedDate(draft.event_date);
      setEditorOpen(false);
      setDrawerOpen(true);
      setStatus("Event saved.");
    } catch (err) {
      setPageError(err?.message || "Failed to save event.");
    }
  }

  async function deleteEvent(ev) {
    if (!user || !ev?.id) return;

    if (ev.auto_created) {
      setPageError("That item is synced from Spending/Income. Delete it from the source page so the calendar stays correct.");
      return;
    }

    if (!globalThis.confirm?.("Delete this event?")) return;

    try {
      const old = events;
      setEvents((prev) => prev.filter((x) => x.id !== ev.id));

      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", ev.id)
        .eq("user_id", user.id)
        .eq("auto_created", false);

      if (error) {
        setEvents(old);
        throw error;
      }

      setStatus("Event deleted.");
    } catch (err) {
      setPageError(err?.message || "Failed to delete event.");
    }
  }

  async function duplicateToManual(ev) {
    if (!user || !profileId) return;

    try {
      const payload = {
        user_id: user.id,
        profile_id: profileId,
        title: ev.title || "Copied event",
        event_date: ev.event_date,
        event_time: ev.event_time || null,
        end_time: ev.end_time || null,
        category: ev.category || "General",
        flow: ev.flow || "none",
        amount: Number(ev.amount || 0),
        note: ev.note || "",
        status: ev.status || "scheduled",
        color: ev.color || "#94a3b8",
        source: "manual",
        source_id: null,
        source_table: null,
        auto_created: false,
        transaction_type: ev.transaction_type || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("calendar_events")
        .insert([{ ...payload, id: uid(), created_at: new Date().toISOString() }])
        .select()
        .single();

      if (error) throw error;

      const saved = mapEventRow(data);
      setEvents((prev) => [...prev, saved]);
      setStatus("Copied as manual event.");
    } catch (err) {
      setPageError(err?.message || "Failed to duplicate event.");
    }
  }

  async function createProfile(e) {
    e?.preventDefault?.();
    if (!user) return;

    const name = String(newProfileName || "").trim();
    if (!name) return;

    try {
      const payload = {
        id: uid(),
        user_id: user.id,
        name,
        is_default: profiles.length === 0,
        color: "#94a3b8",
      };

      const { data, error } = await supabase
        .from("calendar_profiles")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      const saved = mapProfileRow(data);
      setProfiles((prev) => [...prev, saved]);
      setProfileId(saved.id);
      setNewProfileName("");
      setStatus("Profile created.");
    } catch (err) {
      setPageError(err?.message || "Failed to create profile.");
    }
  }

  async function setDefaultProfile(id) {
    if (!user) return;

    try {
      const current = profiles;
      setProfiles((prev) => prev.map((p) => ({ ...p, is_default: p.id === id })));

      const oldDefault = profiles.find((p) => p.is_default);
      if (oldDefault && oldDefault.id !== id) {
        await supabase
          .from("calendar_profiles")
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq("id", oldDefault.id)
          .eq("user_id", user.id);
      }

      const { error } = await supabase
        .from("calendar_profiles")
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        setProfiles(current);
        throw error;
      }

      setStatus("Default profile updated.");
    } catch (err) {
      setPageError(err?.message || "Failed to update default profile.");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1720px] px-4 py-4">
        <ShellCard className="p-5 text-white/70">Loading calendar...</ShellCard>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-[1720px] px-4 py-4">
        <ShellCard className="p-6">
          <div className="text-lg font-black text-white">Please log in</div>
          <div className="mt-2 text-sm text-white/60">Calendar is Supabase-backed, so you need to be signed in.</div>
        </ShellCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1720px] space-y-4 px-4 py-4">
      <ShellCard className="overflow-hidden px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.28em] text-white/45">
              Life Command Center
            </div>
            <h1 className="m-0 text-3xl font-black tracking-tight text-white md:text-[2.2rem]">
              Calendar Command
            </h1>
            <div className="mt-1 text-sm text-white/56">
              Clean month view with a scrollable day timeline.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect value={profileId} onChange={(e) => setProfileId(e.target.value)} className="w-[210px] font-bold">
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </NativeSelect>

            <Button type="button" onClick={() => setManageOpen(true)} variant="outline" className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">
              Manage
            </Button>

            <Button
              type="button"
              onClick={() => {
                const t = todayISO();
                setMonthStart(startOfMonthISO(t));
                setSelectedDate(t);
                setDrawerOpen(true);
              }}
              variant="outline"
              className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
            >
              Today
            </Button>

            <Button type="button" onClick={() => openCreate(selectedDate)} className="rounded-2xl bg-white px-5 text-[#09111f] hover:bg-white/90">
              + Add Event
            </Button>
          </div>
        </div>
      </ShellCard>

      {pageError ? (
        <ShellCard className="border-red-400/20 p-4">
          <div className="font-black text-white">Calendar issue</div>
          <div className="mt-1 text-sm text-white/60">{pageError}</div>
        </ShellCard>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard title="Month In" value={fmtMoney(monthIn)} sub="income on calendar" tone="good" />
        <StatCard title="Month Out" value={fmtMoney(monthOut)} sub="expense on calendar" tone="bad" />
        <StatCard title="Planned" value={fmtMoney(monthPlanned)} sub="planned items still coming" tone="warn" />
        <StatCard title="Net" value={fmtMoney(monthIn - monthOut - monthPlanned)} sub={status || "calendar total"} tone="neutral" />
      </div>

      <ShellCard className="p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setMonthStart((m) => addMonthsISO(m, -1))} className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">
              ←
            </Button>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-lg font-black text-white">
              {monthLabel(monthStart)}
            </div>

            <Button type="button" variant="outline" onClick={() => setMonthStart((m) => addMonthsISO(m, 1))} className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">
              →
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[180px_220px]">
            <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="All">All</option>
              <option value="Paydays">Paydays</option>
              <option value="Expenses">Expenses</option>
              <option value="Planned">Planned</option>
              <option value="Manual">Manual</option>
            </NativeSelect>

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events..."
              className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white"
            />
          </div>
        </div>

        <div className="mb-3 grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="py-2 text-center text-xs font-black uppercase tracking-[0.15em] text-white/44">
              {weekdayShort(i)}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {monthGridDays.map((dayISO) => {
            const dayEvents = eventsByDate.get(dayISO) || [];
            const selected = dayISO === selectedDate;
            const today = isTodayISO(dayISO);
            const sameMonth = inSameMonth(dayISO, monthStart);

            const inTotal = dayEvents.filter((ev) => String(ev.flow) === "income").reduce((sum, ev) => sum + Number(ev.amount || 0), 0);
            const expenseTotal = dayEvents.filter((ev) => String(ev.flow) === "expense" && ev.source !== "planned_expense").reduce((sum, ev) => sum + Number(ev.amount || 0), 0);
            const plannedTotal = dayEvents.filter((ev) => ev.source === "planned_expense").reduce((sum, ev) => sum + Number(ev.amount || 0), 0);

            return (
              <button
                key={dayISO}
                type="button"
                onClick={() => openDay(dayISO)}
                className="min-h-[122px] rounded-[22px] p-3 text-left transition"
                style={{
                  border: selected
                    ? "1px solid rgba(255,255,255,.16)"
                    : today
                    ? "1px solid rgba(74,222,128,.24)"
                    : "1px solid rgba(255,255,255,.09)",
                  background: selected
                    ? "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03))"
                    : "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))",
                  opacity: sameMonth ? 1 : 0.38,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[30px] font-black leading-none text-white">{parseISO(dayISO)?.getDate()}</div>
                  {dayEvents.length > 0 ? (
                    <div className="grid h-7 min-w-7 place-items-center rounded-full border border-white/10 bg-white/[0.06] px-2 text-[11px] font-black text-white">
                      {dayEvents.length}
                    </div>
                  ) : null}
                </div>

                <div className="mt-1 text-[11px] text-white/35">{dayISO}</div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {inTotal > 0 ? <DotBadge tone="good">+ {fmtMoney(inTotal)}</DotBadge> : null}
                  {expenseTotal > 0 ? <DotBadge tone="bad">- {fmtMoney(expenseTotal)}</DotBadge> : null}
                  {plannedTotal > 0 ? <DotBadge tone="warn">{fmtMoney(plannedTotal)}</DotBadge> : null}
                </div>
              </button>
            );
          })}
        </div>
      </ShellCard>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Selected day</div>
                <div className="mt-1 text-2xl font-black text-white">{fmtLongDate(selectedDate)}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <DotBadge tone="good">In {fmtMoney(dayIn)}</DotBadge>
                  <DotBadge tone="bad">Out {fmtMoney(dayOut)}</DotBadge>
                  <DotBadge tone="warn">Planned {fmtMoney(dayPlanned)}</DotBadge>
                  <DotBadge tone="neutral">{selectedDayEvents.length} events</DotBadge>
                </div>
              </div>

              <Button type="button" onClick={() => setDrawerOpen(false)} variant="outline" className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">
                Close
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => openCreate(selectedDate)} className="rounded-2xl bg-white px-5 text-[#09111f] hover:bg-white/90">
                + Add Event
              </Button>
              <Button type="button" variant="outline" onClick={() => openPayday(selectedDate)} className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">
                + Payday
              </Button>
              <Button type="button" variant="outline" onClick={() => openExpense(selectedDate)} className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">
                + Expense
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {selectedDayEvents.length === 0 ? (
              <div className="rounded-[18px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/56">
                No events for this day.
              </div>
            ) : (
              <div className="space-y-6">
                {selectedAllDay.length > 0 ? (
                  <div>
                    <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/40">All day</div>
                    <div className="space-y-4">
                      {selectedAllDay.map((ev) => (
                        <TimelineItem
                          key={ev.id}
                          ev={ev}
                          onEdit={openEdit}
                          onDelete={deleteEvent}
                          onDuplicate={duplicateToManual}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedTimed.length > 0 ? (
                  <div>
                    <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/40">Timed</div>
                    <div className="space-y-4">
                      {selectedTimed.map((ev) => (
                        <TimelineItem
                          key={ev.id}
                          ev={ev}
                          onEdit={openEdit}
                          onDelete={deleteEvent}
                          onDuplicate={duplicateToManual}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </Drawer>

      <Modal open={manageOpen} title="Manage calendars" onClose={() => setManageOpen(false)}>
        <div className="grid gap-5">
          <form onSubmit={createProfile} className="flex flex-wrap gap-3">
            <Input
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="New calendar name"
              className="h-11 min-w-[220px] flex-1 rounded-2xl border-white/10 bg-white/[0.04] text-white"
            />
            <Button type="submit" className="rounded-2xl bg-white px-5 text-[#09111f] hover:bg-white/90">
              Create
            </Button>
          </form>

          <div className="grid gap-3">
            {profiles.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
                <div>
                  <div className="font-black text-white">{p.name}</div>
                  <div className="mt-1 text-sm text-white/50">{p.is_default ? "Default calendar" : "Secondary calendar"}</div>
                </div>

                {!p.is_default ? (
                  <Button type="button" onClick={() => setDefaultProfile(p.id)} variant="outline" className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">
                    Set default
                  </Button>
                ) : (
                  <DotBadge tone="good">Default</DotBadge>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal open={editorOpen} title={draft.id ? "Edit event" : "Add event"} onClose={() => setEditorOpen(false)}>
        <form onSubmit={saveEvent} className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setDraft(paydayTemplate(draft.event_date || selectedDate, profileId))} variant="outline" className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">
              Payday template
            </Button>
            <Button type="button" onClick={() => setDraft(expenseTemplate(draft.event_date || selectedDate, profileId))} variant="outline" className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">
              Expense template
            </Button>
            <Button type="button" onClick={() => setDraft(emptyEvent(draft.event_date || selectedDate, profileId))} variant="outline" className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">
              Blank
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="mb-2 block text-white/72">Title</Label>
              <Input value={draft.title} onChange={(e) => patchDraft("title", e.target.value)} placeholder="Payday" className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
            </div>

            <div>
              <Label className="mb-2 block text-white/72">Date</Label>
              <Input type="date" value={draft.event_date} onChange={(e) => patchDraft("event_date", e.target.value)} className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
            </div>

            <div>
              <Label className="mb-2 block text-white/72">Start time</Label>
              <Input type="time" value={draft.event_time} onChange={(e) => patchDraft("event_time", e.target.value)} className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
            </div>

            <div>
              <Label className="mb-2 block text-white/72">End time</Label>
              <Input type="time" value={draft.end_time} onChange={(e) => patchDraft("end_time", e.target.value)} className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
            </div>

            <div>
              <Label className="mb-2 block text-white/72">Category</Label>
              <NativeSelect value={draft.category} onChange={(e) => patchDraft("category", e.target.value)}>
                <option value="Payday">Payday</option>
                <option value="Expense">Expense</option>
                <option value="Bill">Bill</option>
                <option value="General">General</option>
                <option value="Reminder">Reminder</option>
              </NativeSelect>
            </div>

            <div>
              <Label className="mb-2 block text-white/72">Flow</Label>
              <NativeSelect value={draft.flow} onChange={(e) => patchDraft("flow", e.target.value)}>
                <option value="none">None</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </NativeSelect>
            </div>

            <div>
              <Label className="mb-2 block text-white/72">Amount</Label>
              <Input value={draft.amount} onChange={(e) => patchDraft("amount", e.target.value)} placeholder="0.00" className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white" />
            </div>

            <div>
              <Label className="mb-2 block text-white/72">Status</Label>
              <NativeSelect value={draft.status} onChange={(e) => patchDraft("status", e.target.value)}>
                <option value="scheduled">Scheduled</option>
                <option value="done">Done</option>
                <option value="canceled">Canceled</option>
              </NativeSelect>
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-white/72">Note</Label>
            <textarea
              value={draft.note}
              onChange={(e) => patchDraft("note", e.target.value)}
              placeholder="Optional notes..."
              className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-white outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/10"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" className="rounded-2xl bg-white px-5 text-[#09111f] hover:bg-white/90">
              Save event
            </Button>

            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} className="rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]">
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}