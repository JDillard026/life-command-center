"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export const dynamic = "force-dynamic";

/** =======================
 *  Premium Calendar v5
 *  - Clean toolbar (not cluttered)
 *  - Month grid + Week time blocks
 *  - Recurring events with: occurrence / future / series edits
 *  - Amount + Income/Expense + totals (day + month)
 *  - Quick Add bar
 *  - Manage modal (calendars + settings) keeps top clean
 *  - In-app reminders (while site is open)
 *  ======================= */

/** ---------- helpers ---------- */
const pad2 = (n) => String(n).padStart(2, "0");
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function todayISO() {
  return toISODate(new Date());
}
function parseISO(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function fmtLong(iso) {
  const d = parseISO(iso);
  if (!d) return "";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function monthLabel(monthStartISO) {
  const d = parseISO(monthStartISO) ?? new Date();
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
function weekdayShort(i) {
  const base = new Date(2021, 7, 1 + i);
  return base.toLocaleDateString(undefined, { weekday: "short" });
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
function inSameMonth(dayISO, monthStartISO) {
  const d = parseISO(dayISO);
  const m = parseISO(monthStartISO);
  if (!d || !m) return false;
  return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
}
function isSameDay(a, b) {
  return String(a || "") === String(b || "");
}
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
function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}
function minutesToTime(min) {
  const m = clamp(Number(min) || 0, 0, 24 * 60 - 1);
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}
function fmtMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function parseMoneyInput(v) {
  // allows: 1000, 1,000, $1,000.50, -100
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}
function sumMoney(items, pick) {
  let s = 0;
  for (const it of items) {
    const n = Number(pick(it));
    if (Number.isFinite(n)) s += n;
  }
  return s;
}

/** ---------- recurrence ---------- */
/**
 * recurrence:
 *  { freq:"none"|"weekly"|"monthly", interval:number, byWeekday?:0-6, byMonthday?:1-31, until?: "YYYY-MM-DD" }
 * extras:
 *  exceptions: ["YYYY-MM-DD"]  // skip that date
 *  overrides:  { "YYYY-MM-DD": { title?, time?, durationMin?, tag?, reminderMinBefore?, amount?, flow? } }
 */
function recurrenceMatchesDate(rec, dateISO, anchorISO) {
  if (!rec || rec.freq === "none") return false;
  if (rec.until && String(dateISO) > String(rec.until)) return false;

  const d = parseISO(dateISO);
  const a = parseISO(anchorISO);
  if (!d || !a) return false;

  const interval = clamp(Number(rec.interval ?? 1), 1, 52);

  if (rec.freq === "weekly") {
    const by = Number(rec.byWeekday);
    if (!Number.isFinite(by)) return false;
    if (d.getDay() !== by) return false;

    const aWeek = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    aWeek.setDate(aWeek.getDate() - aWeek.getDay());
    const dWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    dWeek.setDate(dWeek.getDate() - dWeek.getDay());

    const diffWeeks = Math.round((dWeek.getTime() - aWeek.getTime()) / (7 * 86400000));
    return diffWeeks >= 0 && diffWeeks % interval === 0;
  }

  if (rec.freq === "monthly") {
    let md = Number(rec.byMonthday);
    if (!Number.isFinite(md)) return false;

    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    md = clamp(md, 1, 31);
    const effective = Math.min(md, lastDay);
    if (d.getDate() !== effective) return false;

    const am = a.getFullYear() * 12 + a.getMonth();
    const dm = d.getFullYear() * 12 + d.getMonth();
    const diff = dm - am;
    return diff >= 0 && diff % interval === 0;
  }

  return false;
}

/** ---------- storage ---------- */
const LS_PROFILES = "lcc_calendar_profiles_v5";
const LS_CURRENT_PROFILE = "lcc_calendar_profile_current_v5";
const LS_EVENTS_PREFIX = "lcc_calendar_events_v5::";
const LS_FIRED_PREFIX = "lcc_calendar_reminders_fired_v1::";
const LS_CAL_PREFS = "lcc_calendar_prefs_v2";

// bills keys (read-only)
const BILL_KEYS = ["lcc_bills_v5", "lcc_bills_v4", "lcc_bills_v3", "lcc_bills_v2", "lcc_bills_v1", "lcc_bills"];

function normalizeBills(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((b) => {
      const dueDate = b?.dueDate || b?.nextDueDate || b?.due || "";
      return {
        id: b?.id ?? b?.name ?? dueDate ?? uid(),
        name: b?.name || b?.title || "Bill",
        amount: b?.amount ?? b?.payment ?? b?.dueAmount ?? null,
        dueDate: dueDate ? String(dueDate).slice(0, 10) : "",
      };
    })
    .filter((b) => b.dueDate);
}

/** ---------- ui components ---------- */
function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        className="card"
        style={{
          width: "min(860px, 100%)",
          padding: 14,
          border: "1px solid rgba(255,255,255,.10)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
          <button className="btnGhost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div style={{ height: 12 }} />
        {children}
      </div>
    </div>
  );
}

function Toast({ item, onClose, onGo }) {
  if (!item) return null;
  return (
    <div style={{ position: "fixed", bottom: 16, right: 16, width: "min(420px, calc(100% - 32px))", zIndex: 60 }}>
      <div className="card" style={{ padding: 12, border: "1px solid rgba(255,255,255,.14)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Reminder</div>
            <div style={{ marginTop: 6, fontWeight: 800 }}>{item.title}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              {item.date} {item.time ? `• ${item.time}` : ""} {item.tag ? `• ${item.tag}` : ""}
            </div>
          </div>
          <button className="btnGhost" type="button" onClick={onClose}>
            Dismiss
          </button>
        </div>
        <div style={{ height: 10 }} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btnGhost" type="button" onClick={onGo}>
            Go to day
          </button>
        </div>
      </div>
    </div>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        padding: 6,
        gap: 6,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(255,255,255,.03)",
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={active ? "btn" : "btnGhost"}
            style={{
              padding: "8px 10px",
              flex: 1,
              opacity: active ? 1 : 0.9,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** =======================
 *  Main Page
 *  ======================= */
export default function CalendarPage() {
  /** profiles */
  const [profiles, setProfiles] = useState([]);
  const [profileId, setProfileId] = useState("");

  /** view + nav */
  const [view, setView] = useState("month"); // month | week
  const [monthStart, setMonthStart] = useState(startOfMonthISO(todayISO()));
  const [selected, setSelected] = useState(todayISO());

  /** prefs */
  const [weekStartsOn, setWeekStartsOn] = useState(0);
  const [showBills, setShowBills] = useState(true);

  /** data */
  const [events, setEvents] = useState([]);
  const [bills, setBills] = useState([]);

  /** premium controls */
  const [focus, setFocus] = useState("all"); // all | finance | work | personal
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState("");

  /** modals */
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);

  /** edit state */
  const [editingBaseId, setEditingBaseId] = useState(null);
  const [editingInstanceDate, setEditingInstanceDate] = useState(null);
  const [applyMode, setApplyMode] = useState("series"); // occurrence | future | series

  const [draft, setDraft] = useState({
    title: "",
    date: todayISO(),
    time: "",
    durationMin: 60,
    tag: "Personal",
    flow: "expense", // expense | income | neutral
    amount: "",
    reminderMinBefore: 0,
    recurrence: "none",
    until: "",
    notes: "",
  });

  /** reminders */
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  /** ===== load prefs ===== */
  useEffect(() => {
    const prefs = safeParse(localStorage.getItem(LS_CAL_PREFS) || "{}", {});
    if (Number.isFinite(prefs.weekStartsOn)) setWeekStartsOn(prefs.weekStartsOn);
    if (typeof prefs.showBills === "boolean") setShowBills(prefs.showBills);
    if (typeof prefs.focus === "string") setFocus(prefs.focus);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CAL_PREFS, JSON.stringify({ weekStartsOn, showBills, focus }));
    } catch {}
  }, [weekStartsOn, showBills, focus]);

  /** ===== load profiles + bills once ===== */
  useEffect(() => {
    const savedProfiles = safeParse(localStorage.getItem(LS_PROFILES) || "[]", []);
    let profs = Array.isArray(savedProfiles) ? savedProfiles : [];

    if (profs.length === 0) {
      profs = [{ id: uid(), name: "Default" }];
      localStorage.setItem(LS_PROFILES, JSON.stringify(profs));
    }

    const savedCurrent = localStorage.getItem(LS_CURRENT_PROFILE);
    const validCurrent = profs.some((p) => p.id === savedCurrent) ? savedCurrent : profs[0].id;

    setProfiles(profs);
    setProfileId(validCurrent);
    localStorage.setItem(LS_CURRENT_PROFILE, validCurrent);

    // bills (shared)
    let found = [];
    for (const k of BILL_KEYS) {
      const v = safeParse(localStorage.getItem(k) || "[]", []);
      if (Array.isArray(v) && v.length) {
        found = v;
        break;
      }
    }
    setBills(normalizeBills(found));
  }, []);

  /** ===== load events per profile ===== */
  useEffect(() => {
    if (!profileId) return;
    const key = LS_EVENTS_PREFIX + profileId;
    const saved = safeParse(localStorage.getItem(key) || "[]", []);
    setEvents(Array.isArray(saved) ? saved : []);
  }, [profileId]);

  /** ===== persist events ===== */
  useEffect(() => {
    if (!profileId) return;
    try {
      localStorage.setItem(LS_EVENTS_PREFIX + profileId, JSON.stringify(events));
    } catch {}
  }, [events, profileId]);

  /** ===== calendar management ===== */
  function createProfile() {
    const name = prompt("New calendar name?");
    if (!name) return;
    const p = { id: uid(), name: name.trim() || "Untitled" };
    const next = [...profiles, p];
    setProfiles(next);
    localStorage.setItem(LS_PROFILES, JSON.stringify(next));
    setProfileId(p.id);
    localStorage.setItem(LS_CURRENT_PROFILE, p.id);
  }
  function renameProfile() {
    const cur = profiles.find((p) => p.id === profileId);
    if (!cur) return;
    const name = prompt("Rename calendar to:", cur.name);
    if (!name) return;
    const next = profiles.map((p) => (p.id === profileId ? { ...p, name: name.trim() || p.name } : p));
    setProfiles(next);
    localStorage.setItem(LS_PROFILES, JSON.stringify(next));
  }
  function deleteProfile() {
    if (profiles.length <= 1) {
      alert("You need at least 1 calendar.");
      return;
    }
    const cur = profiles.find((p) => p.id === profileId);
    if (!cur) return;
    const ok = confirm(`Delete "${cur.name}"? This removes its events on this device.`);
    if (!ok) return;

    try {
      localStorage.removeItem(LS_EVENTS_PREFIX + profileId);
      localStorage.removeItem(LS_FIRED_PREFIX + profileId);
    } catch {}

    const next = profiles.filter((p) => p.id !== profileId);
    setProfiles(next);
    localStorage.setItem(LS_PROFILES, JSON.stringify(next));

    const newId = next[0].id;
    setProfileId(newId);
    localStorage.setItem(LS_CURRENT_PROFILE, newId);
  }

  /** ===== instances ===== */
  function applyOverrides(base, instanceDate) {
    const ov = base?.overrides?.[instanceDate] || null;
    if (!ov) return base;
    return { ...base, ...ov };
  }
  function isException(base, instanceDate) {
    const ex = Array.isArray(base?.exceptions) ? base.exceptions : [];
    return ex.includes(instanceDate);
  }
  function expandEventsInRange(rangeStartISO, rangeEndISO) {
    const out = [];

    for (const base of events) {
      if (!base?.date) continue;

      const rec = base.recurrence || { freq: "none" };
      const baseDate = base.date;

      const pushInstance = (iso, isRecurring) => {
        if (iso < rangeStartISO || iso > rangeEndISO) return;
        if (isException(base, iso)) return;

        const applied = applyOverrides(base, iso);
        out.push({
          ...applied,
          _baseId: base.id,
          _instanceDate: iso,
          _instanceId: `${base.id}::${iso}`,
          _isRecurringInstance: isRecurring,
          _seriesRepeats: rec && rec.freq !== "none",
        });
      };

      pushInstance(baseDate, false);

      if (rec && rec.freq !== "none") {
        for (let iso = rangeStartISO; iso <= rangeEndISO; iso = addDaysISO(iso, 1)) {
          if (iso === baseDate) continue;
          if (recurrenceMatchesDate(rec, iso, baseDate)) pushInstance(iso, true);
        }
      }
    }

    out.sort((a, b) =>
      a._instanceDate > b._instanceDate
        ? 1
        : a._instanceDate < b._instanceDate
        ? -1
        : String(a.time || "99:99").localeCompare(String(b.time || "99:99"))
    );
    return out;
  }

  /** ===== month grid ===== */
  const monthGrid = useMemo(() => {
    const m = parseISO(monthStart) ?? new Date();
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);

    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - gridStart.getDay());
    const gridEnd = new Date(last);
    gridEnd.setDate(last.getDate() + (6 - gridEnd.getDay()));

    const days = [];
    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
      const iso = toISODate(d);
      days.push({
        iso,
        day: d.getDate(),
        inMonth: d.getMonth() === m.getMonth(),
        isToday: isSameDay(iso, todayISO()),
        isSelected: isSameDay(iso, selected),
      });
    }
    return days;
  }, [monthStart, selected]);

  const monthRange = useMemo(() => {
    const m = parseISO(monthStart) ?? new Date();
    const start = toISODate(new Date(m.getFullYear(), m.getMonth(), 1));
    const end = toISODate(new Date(m.getFullYear(), m.getMonth() + 1, 0));
    return { start, end };
  }, [monthStart]);

  const monthInstancesAll = useMemo(
    () => expandEventsInRange(monthRange.start, monthRange.end),
    [events, monthRange.start, monthRange.end]
  );

  const filteredMonthInstances = useMemo(() => {
    const s = (search || "").trim().toLowerCase();
    return monthInstancesAll.filter((x) => {
      const tag = String(x.tag || "").toLowerCase();
      const title = String(x.title || "").toLowerCase();

      const matchesSearch = !s || title.includes(s) || tag.includes(s);

      let matchesFocus = true;
      if (focus === "finance") matchesFocus = tag === "finance" || x.flow === "expense" || x.flow === "income";
      if (focus === "work") matchesFocus = tag === "work";
      if (focus === "personal") matchesFocus = tag === "personal" || tag === "family" || tag === "health";

      return matchesSearch && matchesFocus;
    });
  }, [monthInstancesAll, search, focus]);

  const dayCounts = useMemo(() => {
    const map = new Map();
    for (const inst of filteredMonthInstances) map.set(inst._instanceDate, (map.get(inst._instanceDate) || 0) + 1);

    if (showBills) {
      for (const b of bills) {
        if (!b?.dueDate) continue;
        if (!inSameMonth(b.dueDate, monthStart)) continue;
        map.set(b.dueDate, (map.get(b.dueDate) || 0) + 1);
      }
    }
    return map;
  }, [filteredMonthInstances, bills, showBills, monthStart]);

  /** ===== finance totals (month + selected day) ===== */
  const monthFinance = useMemo(() => {
    const inMonth = filteredMonthInstances.filter((x) => inSameMonth(x._instanceDate, monthStart));
    const income = sumMoney(inMonth.filter((x) => x.flow === "income"), (x) => x.amount);
    const expense = sumMoney(inMonth.filter((x) => x.flow === "expense"), (x) => x.amount);
    return { income, expense, net: income - expense };
  }, [filteredMonthInstances, monthStart]);

  /** ===== week view ===== */
  const weekStart = useMemo(() => startOfWeekISO(selected, weekStartsOn), [selected, weekStartsOn]);
  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDaysISO(weekStart, i)), [weekStart]);
  const weekEnd = useMemo(() => addDaysISO(weekStart, 6), [weekStart]);

  const weekInstancesAll = useMemo(() => expandEventsInRange(weekStart, weekEnd), [events, weekStart, weekEnd]);

  const filteredWeekInstances = useMemo(() => {
    const s = (search || "").trim().toLowerCase();
    return weekInstancesAll.filter((x) => {
      const tag = String(x.tag || "").toLowerCase();
      const title = String(x.title || "").toLowerCase();

      const matchesSearch = !s || title.includes(s) || tag.includes(s);

      let matchesFocus = true;
      if (focus === "finance") matchesFocus = tag === "finance" || x.flow === "expense" || x.flow === "income";
      if (focus === "work") matchesFocus = tag === "work";
      if (focus === "personal") matchesFocus = tag === "personal" || tag === "family" || tag === "health";

      return matchesSearch && matchesFocus;
    });
  }, [weekInstancesAll, search, focus]);

  const weekInstancesByDay = useMemo(() => {
    const map = new Map();
    for (const d of weekDays) map.set(d, []);
    for (const inst of filteredWeekInstances) if (map.has(inst._instanceDate)) map.get(inst._instanceDate).push(inst);
    for (const d of weekDays) map.get(d).sort((a, b) => String(a.time || "99:99").localeCompare(String(b.time || "99:99")));
    return map;
  }, [weekDays, filteredWeekInstances]);

  const billsByDayWeek = useMemo(() => {
    const map = new Map();
    if (!showBills) return map;
    for (const d of weekDays) map.set(d, []);
    for (const b of bills) if (b?.dueDate && map.has(b.dueDate)) map.get(b.dueDate).push(b);
    return map;
  }, [bills, weekDays, showBills]);

  /** ===== selected day agenda ===== */
  const selectedInstances = useMemo(() => {
    const source = view === "week" ? filteredWeekInstances : filteredMonthInstances;
    return source
      .filter((x) => x._instanceDate === selected)
      .sort((a, b) => String(a.time || "99:99").localeCompare(String(b.time || "99:99")));
  }, [filteredWeekInstances, filteredMonthInstances, selected, view]);

  const billsForSelected = useMemo(() => {
    if (!showBills) return [];
    return bills.filter((b) => b?.dueDate === selected);
  }, [bills, selected, showBills]);

  const selectedFinance = useMemo(() => {
    const income = sumMoney(selectedInstances.filter((x) => x.flow === "income"), (x) => x.amount);
    const expense = sumMoney(selectedInstances.filter((x) => x.flow === "expense"), (x) => x.amount);
    return { income, expense, net: income - expense };
  }, [selectedInstances]);

  /** ===== upcoming (premium sidebar style) ===== */
  const upcoming = useMemo(() => {
    const start = selected;
    const end = addDaysISO(selected, 14);
    const inst = expandEventsInRange(start, end)
      .filter((x) => x._instanceDate !== selected)
      .sort((a, b) => (a._instanceDate > b._instanceDate ? 1 : a._instanceDate < b._instanceDate ? -1 : String(a.time || "99:99").localeCompare(String(b.time || "99:99"))));

    const byDay = new Map();
    for (const it of inst) {
      const arr = byDay.get(it._instanceDate) || [];
      arr.push(it);
      byDay.set(it._instanceDate, arr);
    }
    const days = Array.from(byDay.keys()).sort();
    return days.slice(0, 7).map((d) => ({ date: d, items: byDay.get(d).slice(0, 3), more: Math.max(0, byDay.get(d).length - 3) }));
  }, [events, selected]);

  const upcomingBills = useMemo(() => {
    if (!showBills) return [];
    const withDue = bills.filter((b) => b?.dueDate);
    const sorted = withDue.sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1));
    return sorted.filter((b) => b.dueDate >= selected).slice(0, 6);
  }, [bills, showBills, selected]);

  /** ===== modal open helpers ===== */
  function openAddModal({ dateISO, timeHHMM = "" } = {}) {
    const date = dateISO || selected;
    setEditingBaseId(null);
    setEditingInstanceDate(date);
    setApplyMode("series");
    setDraft({
      title: "",
      date,
      time: timeHHMM,
      durationMin: 60,
      tag: focus === "work" ? "Work" : focus === "finance" ? "Finance" : "Personal",
      flow: focus === "finance" ? "expense" : "neutral",
      amount: "",
      reminderMinBefore: 0,
      recurrence: "none",
      until: "",
      notes: "",
    });
    setEventModalOpen(true);
  }

  function openEditModal(inst) {
    const base = events.find((e) => e.id === inst._baseId);
    if (!base) return;

    const shown = applyOverrides(base, inst._instanceDate);
    const rec = base.recurrence || { freq: "none" };

    let recurrence = "none";
    if (rec.freq === "weekly" && Number(rec.interval) === 1) recurrence = "weekly";
    if (rec.freq === "weekly" && Number(rec.interval) === 2) recurrence = "biweekly";
    if (rec.freq === "monthly") recurrence = "monthly";

    setEditingBaseId(base.id);
    setEditingInstanceDate(inst._instanceDate);
    setApplyMode(inst._seriesRepeats ? "occurrence" : "series");

    setDraft({
      title: shown.title || "",
      date: inst._instanceDate,
      time: shown.time || "",
      durationMin: Number(shown.durationMin || 60),
      tag: shown.tag || "Personal",
      flow: shown.flow || "neutral",
      amount: shown.amount != null && Number.isFinite(Number(shown.amount)) ? String(Number(shown.amount)) : "",
      reminderMinBefore: Number(shown.reminderMinBefore || 0),
      recurrence,
      until: rec.until || "",
      notes: shown.notes || "",
    });

    setEventModalOpen(true);
  }

  /** ===== save/delete ===== */
  function buildRecurrenceFromDraft(baseDateISO) {
    if (draft.recurrence === "weekly" || draft.recurrence === "biweekly") {
      const d = parseISO(baseDateISO) ?? new Date();
      return {
        freq: "weekly",
        interval: draft.recurrence === "biweekly" ? 2 : 1,
        byWeekday: d.getDay(),
        until: draft.until ? String(draft.until) : undefined,
      };
    }
    if (draft.recurrence === "monthly") {
      const d = parseISO(baseDateISO) ?? new Date();
      return {
        freq: "monthly",
        interval: 1,
        byMonthday: d.getDate(),
        until: draft.until ? String(draft.until) : undefined,
      };
    }
    return { freq: "none" };
  }

  function normalizeAmount() {
    const raw = String(draft.amount ?? "").trim();
    if (!raw) return null;
    const n = parseMoneyInput(raw);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  function normalizeFlow() {
    const f = String(draft.flow || "neutral");
    return f === "income" || f === "expense" ? f : "neutral";
  }

  function saveDraft() {
    const t = String(draft.title || "").trim();
    if (!t) return;

    const dateISO = String(draft.date || selected);
    const mins = clamp(Number(draft.durationMin || 60), 5, 12 * 60);
    const reminder = clamp(Number(draft.reminderMinBefore || 0), 0, 24 * 60);
    const amount = normalizeAmount();
    const flow = normalizeFlow();

    // add new
    if (!editingBaseId) {
      const rec = buildRecurrenceFromDraft(dateISO);
      setEvents((prev) => [
        ...prev,
        {
          id: uid(),
          title: t,
          date: dateISO,
          time: draft.time || "",
          durationMin: mins,
          tag: draft.tag || "Personal",
          flow,
          amount,
          notes: String(draft.notes || ""),
          reminderMinBefore: reminder,
          recurrence: rec,
          exceptions: [],
          overrides: {},
          createdAt: Date.now(),
        },
      ]);
      setEventModalOpen(false);
      return;
    }

    const base = events.find((e) => e.id === editingBaseId);
    if (!base) {
      setEventModalOpen(false);
      return;
    }

    const baseRec = base.recurrence || { freq: "none" };
    const isRepeating = baseRec && baseRec.freq !== "none";
    const instDate = editingInstanceDate || base.date;

    // non-repeating
    if (!isRepeating) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === editingBaseId
            ? {
                ...e,
                title: t,
                date: dateISO,
                time: draft.time || "",
                durationMin: mins,
                tag: draft.tag || "Personal",
                flow,
                amount,
                notes: String(draft.notes || ""),
                reminderMinBefore: reminder,
                recurrence: buildRecurrenceFromDraft(dateISO),
                updatedAt: Date.now(),
              }
            : e
        )
      );
      setEventModalOpen(false);
      return;
    }

    if (applyMode === "occurrence") {
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== editingBaseId) return e;
          const overrides = { ...(e.overrides || {}) };
          overrides[instDate] = {
            title: t,
            time: draft.time || "",
            durationMin: mins,
            tag: draft.tag || "Personal",
            flow,
            amount,
            notes: String(draft.notes || ""),
            reminderMinBefore: reminder,
          };
          return { ...e, overrides, updatedAt: Date.now() };
        })
      );
      setEventModalOpen(false);
      return;
    }

    if (applyMode === "future") {
      const dayBefore = addDaysISO(instDate, -1);
      const newRec = buildRecurrenceFromDraft(instDate);

      const newEvent = {
        id: uid(),
        title: t,
        date: instDate,
        time: draft.time || "",
        durationMin: mins,
        tag: draft.tag || "Personal",
        flow,
        amount,
        notes: String(draft.notes || ""),
        reminderMinBefore: reminder,
        recurrence: newRec,
        exceptions: [],
        overrides: {},
        createdAt: Date.now(),
        _splitFrom: editingBaseId,
      };

      setEvents((prev) =>
        prev
          .map((e) => {
            if (e.id !== editingBaseId) return e;
            const rec = { ...(e.recurrence || { freq: "none" }) };
            rec.until = dayBefore;
            return { ...e, recurrence: rec, updatedAt: Date.now() };
          })
          .concat([newEvent])
      );
      setEventModalOpen(false);
      return;
    }

    // series
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== editingBaseId) return e;
        return {
          ...e,
          title: t,
          date: dateISO,
          time: draft.time || "",
          durationMin: mins,
          tag: draft.tag || "Personal",
          flow,
          amount,
          notes: String(draft.notes || ""),
          reminderMinBefore: reminder,
          recurrence: buildRecurrenceFromDraft(dateISO),
          updatedAt: Date.now(),
        };
      })
    );
    setEventModalOpen(false);
  }

  function deleteDraft() {
    if (!editingBaseId) return;

    const base = events.find((e) => e.id === editingBaseId);
    if (!base) return;

    const rec = base.recurrence || { freq: "none" };
    const isRepeating = rec && rec.freq !== "none";
    const instDate = editingInstanceDate || base.date;

    if (!isRepeating) {
      const ok = confirm("Delete this event?");
      if (!ok) return;
      setEvents((prev) => prev.filter((e) => e.id !== editingBaseId));
      setEventModalOpen(false);
      return;
    }

    if (applyMode === "occurrence") {
      const ok = confirm("Remove just this occurrence?");
      if (!ok) return;
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== editingBaseId) return e;
          const exceptions = Array.isArray(e.exceptions) ? [...e.exceptions] : [];
          if (!exceptions.includes(instDate)) exceptions.push(instDate);

          const overrides = { ...(e.overrides || {}) };
          if (overrides[instDate]) delete overrides[instDate];

          return { ...e, exceptions, overrides, updatedAt: Date.now() };
        })
      );
      setEventModalOpen(false);
      return;
    }

    if (applyMode === "future") {
      const ok = confirm("Delete this and all future occurrences?");
      if (!ok) return;
      const dayBefore = addDaysISO(instDate, -1);
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== editingBaseId) return e;
          const r = { ...(e.recurrence || { freq: "none" }) };
          r.until = dayBefore;
          return { ...e, recurrence: r, updatedAt: Date.now() };
        })
      );
      setEventModalOpen(false);
      return;
    }

    const ok = confirm("Delete the entire series?");
    if (!ok) return;
    setEvents((prev) => prev.filter((e) => e.id !== editingBaseId));
    setEventModalOpen(false);
  }

  /** ===== navigation ===== */
  function goMonth(delta) {
    const next = addMonthsISO(monthStart, delta);
    setMonthStart(next);
    if (!inSameMonth(selected, next)) setSelected(next);
  }
  function goWeek(deltaWeeks) {
    const next = addDaysISO(weekStart, deltaWeeks * 7);
    setSelected(next);
    setMonthStart(startOfMonthISO(next));
  }

  /** ===== quick add (premium) ===== */
  function quickAdd() {
    // Fast path: "Title $12.34" (expense by default)
    const raw = String(quick || "").trim();
    if (!raw) return;

    const moneyMatch = raw.match(/(-?\$?\s?\d[\d,]*\.?\d{0,2})/);
    let amt = null;
    let title = raw;

    if (moneyMatch?.[1]) {
      const n = parseMoneyInput(moneyMatch[1]);
      if (Number.isFinite(n)) amt = n;
      title = raw.replace(moneyMatch[1], "").replace(/\s{2,}/g, " ").trim();
      if (!title) title = "Event";
    }

    const tag = focus === "work" ? "Work" : focus === "finance" ? "Finance" : "Personal";
    const flow = focus === "finance" ? "expense" : "neutral";

    setEvents((prev) => [
      ...prev,
      {
        id: uid(),
        title,
        date: selected,
        time: "",
        durationMin: 60,
        tag,
        flow,
        amount: amt,
        notes: "",
        reminderMinBefore: 0,
        recurrence: { freq: "none" },
        exceptions: [],
        overrides: {},
        createdAt: Date.now(),
      },
    ]);
    setQuick("");
  }

  /** ===== reminders (in-app) ===== */
  const firedKey = profileId ? LS_FIRED_PREFIX + profileId : null;

  function loadFired() {
    if (!firedKey) return {};
    return safeParse(localStorage.getItem(firedKey) || "{}", {});
  }
  function saveFired(map) {
    if (!firedKey) return;
    try {
      localStorage.setItem(firedKey, JSON.stringify(map || {}));
    } catch {}
  }
  function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  useEffect(() => {
    if (!profileId) return;

    const interval = setInterval(() => {
      if (toast) return;

      const fired = loadFired();
      const nowDate = todayISO();
      const nowMin = nowMinutes();
      const lookahead = 60;

      const todayInstances = expandEventsInRange(nowDate, nowDate);

      for (const inst of todayInstances) {
        const remindBefore = Number(inst.reminderMinBefore || 0);
        if (!remindBefore) continue;
        if (!inst.time) continue;

        const eventMin = timeToMinutes(inst.time);
        if (eventMin == null) continue;

        const fireAt = eventMin - remindBefore;
        const withinWindow = fireAt >= nowMin && fireAt <= nowMin + lookahead;

        const firedId = `${inst._baseId}::${inst._instanceDate}::${inst.time}::${remindBefore}`;
        if (!withinWindow) continue;
        if (fired[firedId]) continue;

        fired[firedId] = Date.now();
        saveFired(fired);

        setToast({ title: inst.title, date: inst._instanceDate, time: inst.time, tag: inst.tag });

        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => setToast(null), 20000);
        break;
      }
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, events, toast]);

  /** ===== premium styles (inline so you don’t touch global CSS) ===== */
  const panelBorder = "1px solid rgba(255,255,255,.10)";
  const softBg = "rgba(255,255,255,.03)";

  const dayCellStyle = (d) => {
    const border = d.isSelected ? "1px solid rgba(255,255,255,.35)" : panelBorder;
    const bg = d.isSelected ? "rgba(255,255,255,.08)" : d.isToday ? "rgba(255,255,255,.06)" : softBg;
    const opacity = d.inMonth ? 1 : 0.55;
    return {
      border,
      background: bg,
      opacity,
      padding: 10,
      borderRadius: 16,
      textAlign: "left",
      cursor: "pointer",
      transition: "transform .08s ease, border-color .08s ease",
    };
  };

  /** ===== week layout constants ===== */
  const HOUR_START = 6;
  const HOUR_END = 22;
  const MINUTES_PER_DAY = (HOUR_END - HOUR_START) * 60;
  const PX_PER_MIN = 1.1;

  return (
    <main className="container">
      {/* ===== Premium Header (clean + high-signal) ===== */}
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Calendar
        </div>

        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 260 }}>
            <h1 style={{ margin: 0 }}>Calendar</h1>
            <div className="muted" style={{ marginTop: 6 }}>
              {fmtLong(selected)} •{" "}
              <span style={{ fontWeight: 800 }}>
                {profiles.find((p) => p.id === profileId)?.name || "Default"}
              </span>
            </div>

            {/* Premium monthly totals (only when Finance focus or any finance exists) */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <span className="pill" style={{ padding: "7px 10px" }}>
                Month In: <b>{fmtMoney(monthFinance.income)}</b>
              </span>
              <span className="pill" style={{ padding: "7px 10px" }}>
                Month Out: <b>{fmtMoney(monthFinance.expense)}</b>
              </span>
              <span className="pill" style={{ padding: "7px 10px" }}>
                Net: <b>{fmtMoney(monthFinance.net)}</b>
              </span>
            </div>
          </div>

          <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              className="input"
              value={profileId}
              onChange={(e) => {
                setProfileId(e.target.value);
                localStorage.setItem(LS_CURRENT_PROFILE, e.target.value);
              }}
              style={{ minWidth: 200 }}
              title="Which calendar you're viewing"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button className="btnGhost" type="button" onClick={() => setManageModalOpen(true)}>
              Manage
            </button>

            <button
              className="btnGhost"
              type="button"
              onClick={() => {
                const t = todayISO();
                setSelected(t);
                setMonthStart(startOfMonthISO(t));
              }}
            >
              Today
            </button>

            <button className="btn" type="button" onClick={() => openAddModal({ dateISO: selected })}>
              + Add
            </button>
          </div>
        </div>

        <div style={{ height: 12 }} />

        {/* Premium control strip (not clutter) */}
        <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ minWidth: 260, flex: 1 }}>
            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <input
                className="input"
                placeholder='Quick add on this day: "Payday $1200"'
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    quickAdd();
                  }
                }}
                style={{ flex: 1 }}
              />
              <button className="btnGhost" type="button" onClick={quickAdd}>
                Add
              </button>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Premium flow: quick add creates a clean event. Click it to add time, recurrence, reminders, notes.
            </div>
          </div>

          <div style={{ minWidth: 240 }}>
            <Segmented
              value={view}
              onChange={(v) => setView(v)}
              options={[
                { value: "month", label: "Month" },
                { value: "week", label: "Week" },
              ]}
            />
          </div>

          <div style={{ minWidth: 260 }}>
            <Segmented
              value={focus}
              onChange={(v) => setFocus(v)}
              options={[
                { value: "all", label: "All" },
                { value: "finance", label: "Finance" },
                { value: "work", label: "Work" },
              ]}
            />
          </div>

          <input
            className="input"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 220 }}
          />
        </div>

        <div style={{ height: 12 }} />

        {/* Premium navigation row */}
        <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {view === "month" ? (
            <>
              <button className="btnGhost" type="button" onClick={() => goMonth(-1)}>
                ←
              </button>
              <div className="pill" style={{ padding: "8px 10px" }}>
                {monthLabel(monthStart)}
              </div>
              <button className="btnGhost" type="button" onClick={() => goMonth(1)}>
                →
              </button>
            </>
          ) : (
            <>
              <button className="btnGhost" type="button" onClick={() => goWeek(-1)}>
                ←
              </button>
              <div className="pill" style={{ padding: "8px 10px" }}>
                Week of {fmtLong(weekStart)}
              </div>
              <button className="btnGhost" type="button" onClick={() => goWeek(1)}>
                →
              </button>
              <select className="input" value={weekStartsOn} onChange={(e) => setWeekStartsOn(Number(e.target.value))} style={{ minWidth: 190 }}>
                <option value={0}>Week starts Sunday</option>
                <option value={1}>Week starts Monday</option>
              </select>
            </>
          )}

          <button className="btnGhost" type="button" onClick={() => setShowBills((v) => !v)} style={{ marginLeft: "auto" }}>
            {showBills ? "Bills: ON" : "Bills: OFF"}
          </button>
        </div>
      </header>

      {/* ===== Premium Layout: main + right rail ===== */}
      <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
        {/* MAIN */}
        <div style={{ flex: 1.6, minWidth: 360 }}>
          {view === "month" ? (
            <div className="card" style={{ padding: 14, border: panelBorder, background: softBg }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginBottom: 8 }}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="muted" style={{ fontSize: 12, fontWeight: 800, textAlign: "center" }}>
                    {weekdayShort(i)}
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                {monthGrid.map((d) => {
                  const count = dayCounts.get(d.iso) || 0;

                  // tiny finance indicator (income/expense present on that day)
                  const dayItems = filteredMonthInstances.filter((x) => x._instanceDate === d.iso);
                  const hasIncome = dayItems.some((x) => x.flow === "income" && Number.isFinite(Number(x.amount)));
                  const hasExpense = dayItems.some((x) => x.flow === "expense" && Number.isFinite(Number(x.amount)));

                  return (
                    <button
                      key={d.iso}
                      type="button"
                      className="card"
                      style={dayCellStyle(d)}
                      onClick={() => setSelected(d.iso)}
                      title={fmtLong(d.iso)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>{d.day}</div>
                        {count > 0 ? (
                          <span className="pill" style={{ fontSize: 11, padding: "5px 8px" }}>
                            {count}
                          </span>
                        ) : null}
                      </div>

                      <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {hasIncome ? <span className="pill" style={{ fontSize: 11, padding: "5px 8px" }}>In</span> : null}
                        {hasExpense ? <span className="pill" style={{ fontSize: 11, padding: "5px 8px" }}>Out</span> : null}
                        {showBills && bills.some((b) => b.dueDate === d.iso) ? (
                          <span className="pill" style={{ fontSize: 11, padding: "5px 8px" }}>Bill</span>
                        ) : null}
                      </div>

                      <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                        {d.iso}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <WeekGrid
              selected={selected}
              setSelected={(d) => {
                setSelected(d);
                setMonthStart(startOfMonthISO(d));
              }}
              weekStartsOn={weekStartsOn}
              weekDays={weekDays}
              weekInstancesByDay={weekInstancesByDay}
              billsByDayWeek={billsByDayWeek}
              showBills={showBills}
              HOUR_START={HOUR_START}
              HOUR_END={HOUR_END}
              MINUTES_PER_DAY={MINUTES_PER_DAY}
              PX_PER_MIN={PX_PER_MIN}
              openAddModal={openAddModal}
              openEditModal={openEditModal}
            />
          )}
        </div>

        {/* RIGHT RAIL (premium) */}
        <div style={{ flex: 1, minWidth: 340 }}>
          <DayPanel
            selected={selected}
            selectedInstances={selectedInstances}
            billsForSelected={billsForSelected}
            showBills={showBills}
            selectedFinance={selectedFinance}
            onAdd={() => openAddModal({ dateISO: selected })}
            onEdit={openEditModal}
          />

          <div style={{ height: 14 }} />

          <div className="card" style={{ padding: 14, border: panelBorder, background: softBg }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Upcoming</div>

            {upcoming.length === 0 ? (
              <div className="muted">Nothing coming up in the next couple weeks.</div>
            ) : (
              <div className="grid">
                {upcoming.map((d) => (
                  <div key={d.date} className="card" style={{ padding: 12, border: panelBorder, background: "rgba(0,0,0,0)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>{fmtLong(d.date)}</div>
                      <button className="btnGhost" type="button" onClick={() => setSelected(d.date)}>
                        Open
                      </button>
                    </div>
                    <div style={{ height: 8 }} />
                    <div style={{ display: "grid", gap: 8 }}>
                      {d.items.map((it) => (
                        <button
                          key={it._instanceId}
                          type="button"
                          className="card"
                          onClick={() => openEditModal(it)}
                          style={{ padding: 10, textAlign: "left", border: panelBorder, background: "rgba(255,255,255,.03)" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ fontWeight: 800 }}>{it.title}</div>
                            {Number.isFinite(Number(it.amount)) ? (
                              <span className="pill" style={{ padding: "6px 10px" }}>
                                {fmtMoney(it.amount)}
                              </span>
                            ) : null}
                          </div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            {it.time ? it.time : "All day"} • {it.tag || "—"}
                          </div>
                        </button>
                      ))}
                      {d.more > 0 ? <div className="muted">+{d.more} more…</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ height: 14 }} />

          <div className="card" style={{ padding: 14, border: panelBorder, background: softBg }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Upcoming bills</div>
            {!showBills ? (
              <div className="muted">Bills are turned off.</div>
            ) : upcomingBills.length === 0 ? (
              <div className="muted">No bills found with due dates.</div>
            ) : (
              <div className="grid">
                {upcomingBills.map((b) => (
                  <div key={`ub_${b.id}_${b.dueDate}`} className="card" style={{ padding: 12, border: panelBorder, background: "rgba(255,255,255,.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>{b.name}</div>
                        <div className="muted" style={{ marginTop: 4 }}>
                          Due {fmtLong(b.dueDate)}
                        </div>
                      </div>
                      <div className="pill">{b.amount != null ? fmtMoney(b.amount) : "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Event modal ===== */}
      <Modal open={eventModalOpen} title={editingBaseId ? "Edit event" : "Add event"} onClose={() => setEventModalOpen(false)}>
        {editingBaseId ? (
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <span className="muted" style={{ fontSize: 12 }}>Apply changes to:</span>
            <select className="input" value={applyMode} onChange={(e) => setApplyMode(e.target.value)} style={{ minWidth: 220 }}>
              <option value="occurrence">This occurrence only</option>
              <option value="future">This & future</option>
              <option value="series">Entire series</option>
            </select>
            <span className="muted" style={{ fontSize: 12 }}>
              (Occurrence date: <b>{editingInstanceDate}</b>)
            </span>
          </div>
        ) : null}

        <div className="grid" style={{ gap: 10 }}>
          <input
            className="input"
            placeholder="Title (Pay rent, Date night, Payday...)"
            value={draft.title}
            onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
          />

          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))}
              style={{ minWidth: 220 }}
              disabled={editingBaseId && applyMode === "occurrence"}
            />

            <input
              className="input"
              type="time"
              value={draft.time}
              onChange={(e) => setDraft((p) => ({ ...p, time: e.target.value }))}
              style={{ minWidth: 160 }}
              title="Optional start time"
            />

            <input
              className="input"
              type="number"
              min={5}
              max={720}
              value={draft.durationMin}
              onChange={(e) => setDraft((p) => ({ ...p, durationMin: e.target.value }))}
              style={{ width: 140 }}
              title="Duration (minutes)"
            />

            <select
              className="input"
              value={draft.tag}
              onChange={(e) => setDraft((p) => ({ ...p, tag: e.target.value }))}
              style={{ minWidth: 180 }}
            >
              <option value="Personal">Personal</option>
              <option value="Work">Work</option>
              <option value="Family">Family</option>
              <option value="Finance">Finance</option>
              <option value="Health">Health</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select
              className="input"
              value={draft.flow}
              onChange={(e) => setDraft((p) => ({ ...p, flow: e.target.value }))}
              style={{ minWidth: 180 }}
              title="Financial direction"
            >
              <option value="neutral">Neutral</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>

            <input
              className="input"
              placeholder="Amount (optional) e.g. 120 or $120.00"
              value={draft.amount}
              onChange={(e) => setDraft((p) => ({ ...p, amount: e.target.value }))}
              style={{ minWidth: 260 }}
              title="Optional amount"
            />

            <select
              className="input"
              value={draft.recurrence}
              onChange={(e) => setDraft((p) => ({ ...p, recurrence: e.target.value }))}
              style={{ minWidth: 220 }}
              disabled={editingBaseId && applyMode === "occurrence"}
              title="Repeat"
            >
              <option value="none">No repeat</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </select>

            <input
              className="input"
              type="date"
              value={draft.until}
              onChange={(e) => setDraft((p) => ({ ...p, until: e.target.value }))}
              style={{ minWidth: 220 }}
              disabled={editingBaseId && applyMode === "occurrence"}
              title="Optional end date for repeating"
            />

            <select
              className="input"
              value={draft.reminderMinBefore}
              onChange={(e) => setDraft((p) => ({ ...p, reminderMinBefore: Number(e.target.value) }))}
              style={{ minWidth: 220 }}
              title="In-app reminder (fires while app is open)"
            >
              <option value={0}>No reminder</option>
              <option value={5}>Remind 5 minutes before</option>
              <option value={10}>Remind 10 minutes before</option>
              <option value={15}>Remind 15 minutes before</option>
              <option value={30}>Remind 30 minutes before</option>
              <option value={60}>Remind 60 minutes before</option>
            </select>
          </div>

          <textarea
            className="input"
            placeholder="Notes (optional) — details, address, confirmation #, etc."
            value={draft.notes}
            onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
            style={{ minHeight: 90 }}
          />

          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <button className="btn" type="button" onClick={saveDraft}>
              Save
            </button>
            {editingBaseId ? (
              <button className="btnGhost" type="button" onClick={deleteDraft}>
                Delete
              </button>
            ) : null}
            <div className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>
              Premium behavior: occurrence edits are overrides; “future” splits the series.
            </div>
          </div>
        </div>
      </Modal>

      {/* ===== Manage modal ===== */}
      <Modal open={manageModalOpen} title="Manage calendars & settings" onClose={() => setManageModalOpen(false)}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn" type="button" onClick={createProfile}>
            New calendar
          </button>
          <button className="btnGhost" type="button" onClick={renameProfile}>
            Rename current
          </button>
          <button className="btnGhost" type="button" onClick={deleteProfile}>
            Delete current
          </button>
        </div>

        <div style={{ height: 14 }} />

        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Settings</div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select className="input" value={weekStartsOn} onChange={(e) => setWeekStartsOn(Number(e.target.value))} style={{ minWidth: 200 }}>
              <option value={0}>Week starts Sunday</option>
              <option value={1}>Week starts Monday</option>
            </select>

            <button className="btnGhost" type="button" onClick={() => setShowBills((v) => !v)}>
              {showBills ? "Bills: ON" : "Bills: OFF"}
            </button>
          </div>

          <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            This keeps the main screen clean while still giving control.
          </div>
        </div>
      </Modal>

      {/* ===== Reminder toast ===== */}
      <Toast
        item={toast}
        onClose={() => setToast(null)}
        onGo={() => {
          if (toast?.date) {
            setSelected(toast.date);
            setMonthStart(startOfMonthISO(toast.date));
            setView("week");
          }
          setToast(null);
        }}
      />
    </main>
  );
}

/** =======================
 *  Premium Right Rail: Day Panel
 *  ======================= */
function DayPanel({ selected, selectedInstances, billsForSelected, showBills, selectedFinance, onAdd, onEdit }) {
  const panelBorder = "1px solid rgba(255,255,255,.10)";
  const softBg = "rgba(255,255,255,.03)";

  return (
    <div className="card" style={{ padding: 14, border: panelBorder, background: softBg }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>Selected day</div>
          <div style={{ fontWeight: 900, marginTop: 4 }}>{fmtLong(selected)}</div>
        </div>
        <button className="btn" type="button" onClick={onAdd}>
          + Add
        </button>
      </div>

      <div style={{ height: 10 }} />

      {/* premium summary row */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span className="pill" style={{ padding: "7px 10px" }}>
          In: <b>{fmtMoney(selectedFinance.income)}</b>
        </span>
        <span className="pill" style={{ padding: "7px 10px" }}>
          Out: <b>{fmtMoney(selectedFinance.expense)}</b>
        </span>
        <span className="pill" style={{ padding: "7px 10px" }}>
          Net: <b>{fmtMoney(selectedFinance.net)}</b>
        </span>
        <span className="pill" style={{ padding: "7px 10px" }}>
          Events: <b>{selectedInstances.length}</b>
        </span>
      </div>

      <div style={{ height: 12 }} />

      {showBills && billsForSelected.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Bills due</div>
          <div className="grid">
            {billsForSelected.map((b) => (
              <div key={`bill_${b.id}_${b.dueDate}`} className="card" style={{ padding: 12, border: panelBorder, background: "rgba(255,255,255,.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{b.name}</div>
                    <div className="muted" style={{ marginTop: 4 }}>Due today</div>
                  </div>
                  <div className="pill">{b.amount != null ? fmtMoney(b.amount) : "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {selectedInstances.length === 0 ? (
        <div className="muted">No events for this day.</div>
      ) : (
        <div className="grid">
          {selectedInstances.map((inst) => (
            <button
              key={inst._instanceId}
              type="button"
              className="card"
              onClick={() => onEdit(inst)}
              style={{ padding: 12, textAlign: "left", border: panelBorder, background: "rgba(255,255,255,.03)" }}
              title="Click to edit"
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{inst.title}</div>
                    {inst.tag ? <span className="pill" style={{ padding: "6px 10px" }}>{inst.tag}</span> : null}
                    {inst.time ? <span className="pill" style={{ padding: "6px 10px" }}>{inst.time}</span> : null}
                    {inst.recurrence?.freq && inst.recurrence.freq !== "none" ? (
                      <span className="pill" style={{ padding: "6px 10px" }}>repeating</span>
                    ) : null}
                    {inst.flow && inst.flow !== "neutral" ? (
                      <span className="pill" style={{ padding: "6px 10px" }}>{inst.flow}</span>
                    ) : null}
                    {Number.isFinite(Number(inst.amount)) ? (
                      <span className="pill" style={{ padding: "6px 10px" }}>{fmtMoney(inst.amount)}</span>
                    ) : null}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    {inst._instanceDate} {inst._isRecurringInstance ? "• instance" : ""}
                  </div>
                </div>
                <span className="muted" style={{ fontSize: 12 }}>Edit</span>
              </div>
              {inst.notes ? (
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  {String(inst.notes).slice(0, 120)}
                  {String(inst.notes).length > 120 ? "…" : ""}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** =======================
 *  Week Grid (premium)
 *  ======================= */
function WeekGrid({
  selected,
  setSelected,
  weekStartsOn,
  weekDays,
  weekInstancesByDay,
  billsByDayWeek,
  showBills,
  HOUR_START,
  HOUR_END,
  MINUTES_PER_DAY,
  PX_PER_MIN,
  openAddModal,
  openEditModal,
}) {
  const panelBorder = "1px solid rgba(255,255,255,.10)";
  const softBg = "rgba(255,255,255,.03)";

  return (
    <div className="card" style={{ padding: 14, border: panelBorder, background: softBg }}>
      <div style={{ display: "grid", gridTemplateColumns: "80px repeat(7, 1fr)", gap: 8, marginBottom: 8 }}>
        <div />
        {weekDays.map((dISO, i) => (
          <button
            key={dISO}
            type="button"
            className="card"
            onClick={() => setSelected(dISO)}
            style={{
              padding: 10,
              border: isSameDay(dISO, selected) ? "1px solid rgba(255,255,255,.35)" : panelBorder,
              background: isSameDay(dISO, selected) ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.03)",
              textAlign: "left",
              cursor: "pointer",
              borderRadius: 16,
            }}
            title={fmtLong(dISO)}
          >
            <div style={{ fontWeight: 900 }}>
              {weekdayShort((weekStartsOn + i) % 7)}{" "}
              <span className="muted" style={{ fontWeight: 700 }}>{dISO}</span>
            </div>

            {showBills && (billsByDayWeek.get(dISO) || []).length > 0 ? (
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(billsByDayWeek.get(dISO) || []).slice(0, 2).map((b) => (
                  <span key={`bd_${b.id}`} className="pill" style={{ fontSize: 11, padding: "5px 8px" }}>
                    {b.name}
                  </span>
                ))}
                {(billsByDayWeek.get(dISO) || []).length > 2 ? (
                  <span className="pill" style={{ fontSize: 11, padding: "5px 8px" }}>
                    +{(billsByDayWeek.get(dISO) || []).length - 2}
                  </span>
                ) : null}
              </div>
            ) : null}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "80px repeat(7, 1fr)", gap: 8 }}>
        {/* time labels */}
        <div style={{ position: "relative" }}>
          <div style={{ height: MINUTES_PER_DAY * PX_PER_MIN, border: panelBorder, borderRadius: 16, background: "rgba(0,0,0,0)" }}>
            {Array.from({ length: HOUR_END - HOUR_START + 1 }).map((_, idx) => {
              const hour = HOUR_START + idx;
              const top = idx * 60 * PX_PER_MIN;
              return (
                <div key={hour} style={{ position: "absolute", top, left: 10, right: 10 }}>
                  <div className="muted" style={{ fontSize: 11 }}>{pad2(hour)}:00</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* day columns */}
        {weekDays.map((dayISO) => {
          const list = weekInstancesByDay.get(dayISO) || [];

          return (
            <div
              key={dayISO}
              className="card"
              style={{
                position: "relative",
                height: MINUTES_PER_DAY * PX_PER_MIN,
                padding: 0,
                overflow: "hidden",
                border: panelBorder,
                borderRadius: 16,
                background: "rgba(255,255,255,.03)",
              }}
            >
              {/* hour lines */}
              {Array.from({ length: HOUR_END - HOUR_START + 1 }).map((_, idx) => {
                const top = idx * 60 * PX_PER_MIN;
                return (
                  <div
                    key={idx}
                    style={{
                      position: "absolute",
                      top,
                      left: 0,
                      right: 0,
                      height: 1,
                      background: "rgba(255,255,255,.07)",
                    }}
                  />
                );
              })}

              {/* click-to-add overlay */}
              <button
                type="button"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const minutesFromTop = clamp(Math.round(y / PX_PER_MIN), 0, MINUTES_PER_DAY);
                  const snapped = Math.round(minutesFromTop / 30) * 30;
                  const startMin = HOUR_START * 60 + snapped;
                  openAddModal({ dateISO: dayISO, timeHHMM: minutesToTime(startMin) });
                }}
                style={{ position: "absolute", inset: 0, background: "transparent", border: "none", cursor: "pointer" }}
                title="Click to add an event"
              />

              {/* event blocks */}
              {list.map((ev) => {
                const start = timeToMinutes(ev.time) ?? HOUR_START * 60;
                const dur = clamp(Number(ev.durationMin || 60), 5, 12 * 60);
                const from = clamp(start - HOUR_START * 60, 0, MINUTES_PER_DAY);
                const height = clamp(dur, 10, MINUTES_PER_DAY - from) * PX_PER_MIN;

                return (
                  <button
                    key={ev._instanceId}
                    type="button"
                    onClick={() => openEditModal(ev)}
                    className="card"
                    style={{
                      position: "absolute",
                      top: from * PX_PER_MIN,
                      left: 8,
                      right: 8,
                      height,
                      padding: 10,
                      textAlign: "left",
                      cursor: "pointer",
                      border: "1px solid rgba(255,255,255,.14)",
                      background: "rgba(255,255,255,.06)",
                      overflow: "hidden",
                      borderRadius: 16,
                    }}
                    title="Click to edit"
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 900, lineHeight: 1.1 }}>{ev.title}</div>
                      {Number.isFinite(Number(ev.amount)) ? (
                        <span className="pill" style={{ fontSize: 11, padding: "5px 8px" }}>
                          {fmtMoney(ev.amount)}
                        </span>
                      ) : null}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {ev.time ? ev.time : "All day"} • {ev.tag || "—"}
                      {ev.flow && ev.flow !== "neutral" ? ` • ${ev.flow}` : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}