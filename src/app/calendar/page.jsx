"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/* =========================================================
   LIFE COMMAND CENTER — CALENDAR COMMAND
   Supabase-backed
   - cleaner dark theme
   - selected day is the main breakdown
   - payday + expense friendly
   - does NOT modify accounts
   ========================================================= */

/* ------------------------- utils ------------------------- */
function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseISO(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function todayISO() {
  return toISODate(new Date());
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
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function timeSortValue(hhmm) {
  if (!hhmm) return 9999;
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 9999;
  return h * 60 + m;
}

function fmtTime(hhmm) {
  if (!hhmm) return "All day";
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* ------------------------- theme ------------------------- */
const C = {
  bg1: "#07101e",
  bg2: "#050914",
  panel: "rgba(255,255,255,.035)",
  panel2: "rgba(255,255,255,.026)",
  card: "rgba(255,255,255,.04)",
  border: "rgba(255,255,255,.08)",
  borderSoft: "rgba(255,255,255,.06)",
  text: "rgba(255,255,255,.95)",
  textSoft: "rgba(255,255,255,.76)",
  textMute: "rgba(255,255,255,.54)",
  accent: "#93c5fd",
  accentSoft: "rgba(147,197,253,.16)",
  green: "#22c55e",
  greenSoft: "rgba(34,197,94,.14)",
  red: "#ef4444",
  redSoft: "rgba(239,68,68,.14)",
  amber: "#f59e0b",
  amberSoft: "rgba(245,158,11,.14)",
};

const shellBg = {
  minHeight: "100vh",
  color: "white",
  background: `
    radial-gradient(circle at top right, rgba(147,197,253,.10), transparent 30%),
    radial-gradient(circle at left 35%, rgba(34,197,94,.05), transparent 18%),
    linear-gradient(180deg, ${C.bg1}, ${C.bg2})
  `,
  padding: 24,
};

const panelStyle = {
  borderRadius: 28,
  border: `1px solid ${C.border}`,
  background: `linear-gradient(180deg, ${C.panel}, ${C.panel2})`,
  boxShadow: "0 18px 60px rgba(0,0,0,.34)",
};

const cardStyle = {
  borderRadius: 18,
  border: `1px solid ${C.border}`,
  background: C.card,
};

const inputStyle = {
  height: 48,
  borderRadius: 14,
  border: `1px solid ${C.border}`,
  background: "rgba(255,255,255,.045)",
  color: C.text,
  padding: "0 14px",
  outline: "none",
};

const textareaStyle = {
  minHeight: 110,
  borderRadius: 14,
  border: `1px solid ${C.border}`,
  background: "rgba(255,255,255,.045)",
  color: C.text,
  padding: 14,
  outline: "none",
  resize: "vertical",
};

function buttonStyle(kind = "soft", active = false) {
  if (kind === "primary") {
    return {
      height: 48,
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,.12)",
      background: "rgba(255,255,255,.09)",
      color: "white",
      padding: "0 18px",
      fontWeight: 900,
      cursor: "pointer",
    };
  }

  if (active) {
    return {
      height: 44,
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,.12)",
      background: "rgba(255,255,255,.085)",
      color: "white",
      padding: "0 14px",
      fontWeight: 800,
      cursor: "pointer",
    };
  }

  return {
    height: 44,
    borderRadius: 14,
    border: `1px solid ${C.border}`,
    background: "rgba(255,255,255,.04)",
    color: C.textSoft,
    padding: "0 14px",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function pillStyle(bg, border, color = "white") {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "11px 14px",
    borderRadius: 18,
    background: bg,
    border: `1px solid ${border}`,
    color,
    fontWeight: 800,
  };
}

function toneForEvent(ev) {
  const flow = String(ev?.flow || "none").toLowerCase();
  const category = String(ev?.category || "").toLowerCase();
  const title = String(ev?.title || "").toLowerCase();

  if (flow === "income" || category === "payday" || title.includes("payday") || title.includes("paycheck")) {
    return {
      line: C.green,
      soft: C.greenSoft,
      border: "rgba(34,197,94,.28)",
      text: "#d7ffe5",
    };
  }

  if (flow === "expense") {
    return {
      line: C.red,
      soft: C.redSoft,
      border: "rgba(239,68,68,.28)",
      text: "#ffd9d9",
    };
  }

  if (category === "bill" || title.includes("bill")) {
    return {
      line: C.amber,
      soft: C.amberSoft,
      border: "rgba(245,158,11,.28)",
      text: "#fff0cc",
    };
  }

  return {
    line: "#94a3b8",
    soft: "rgba(148,163,184,.12)",
    border: "rgba(148,163,184,.22)",
    text: "#e5edf8",
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
  };
}

function paydayTemplate(dateISO, profileId = "") {
  return {
    id: "",
    profile_id: profileId,
    title: "Payday",
    event_date: dateISO,
    event_time: "09:00",
    end_time: "",
    category: "Payday",
    flow: "income",
    amount: "",
    note: "",
    status: "scheduled",
    color: "#22c55e",
  };
}

function expenseTemplate(dateISO, profileId = "") {
  return {
    id: "",
    profile_id: profileId,
    title: "Expense",
    event_date: dateISO,
    event_time: "",
    end_time: "",
    category: "Expense",
    flow: "expense",
    amount: "",
    note: "",
    status: "scheduled",
    color: "#ef4444",
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
  };
}

/* ------------------------- ui ------------------------- */
function Modal({ open, title, onClose, children, width = "min(880px, 100%)" }) {
  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.62)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 70,
      }}
    >
      <div
        style={{
          width,
          maxHeight: "90vh",
          overflow: "auto",
          borderRadius: 24,
          background: "linear-gradient(180deg, rgba(17,25,42,.98), rgba(8,12,24,.98))",
          border: `1px solid ${C.border}`,
          boxShadow: "0 28px 90px rgba(0,0,0,.45)",
          padding: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{title}</div>
          <button type="button" onClick={onClose} style={buttonStyle("soft")}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatPill({ label, value, tone = "default" }) {
  const tones = {
    good: pillStyle(C.greenSoft, "rgba(34,197,94,.24)", "#dbffe8"),
    bad: pillStyle(C.redSoft, "rgba(239,68,68,.24)", "#ffdede"),
    neutral: pillStyle("rgba(255,255,255,.05)", "rgba(255,255,255,.08)", C.text),
    soft: pillStyle("rgba(148,163,184,.12)", "rgba(148,163,184,.18)", "#e2e8f0"),
  };
  const style = tone === "good" ? tones.good : tone === "bad" ? tones.bad : tone === "soft" ? tones.soft : tones.neutral;
  return (
    <div style={style}>
      <span style={{ opacity: 0.8 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/* ------------------------- page ------------------------- */
export default function CalendarPage() {
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [status, setStatus] = useState("");

  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [profileId, setProfileId] = useState("");

  const [monthStart, setMonthStart] = useState(startOfMonthISO(todayISO()));
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [manageOpen, setManageOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const [newProfileName, setNewProfileName] = useState("");
  const [draft, setDraft] = useState(emptyEvent(todayISO(), ""));

  useEffect(() => {
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

  useEffect(() => {
    if (!user || !profileId) return;

    let alive = true;

    async function loadEvents() {
      try {
        setPageError("");
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

  const monthGridDays = useMemo(() => {
    const firstCell = startOfWeekISO(monthStart, 0);
    return Array.from({ length: 42 }, (_, i) => addDaysISO(firstCell, i));
  }, [monthStart]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();

    return events.filter((ev) => {
      const category = String(ev.category || "").toLowerCase();
      const flow = String(ev.flow || "").toLowerCase();
      const title = String(ev.title || "").toLowerCase();

      if (filter === "Paydays") {
        if (!(flow === "income" || category === "payday" || title.includes("payday") || title.includes("paycheck"))) {
          return false;
        }
      } else if (filter === "Expenses") {
        if (!(flow === "expense" || category === "expense")) return false;
      } else if (filter !== "All" && category !== filter.toLowerCase()) {
        return false;
      }

      if (!q) return true;

      const hay = [ev.title, ev.note, ev.category, ev.flow, ev.event_date, ev.event_time]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [events, search, filter]);

  const eventsByDate = useMemo(() => {
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
        [...arr].sort((a, b) => timeSortValue(a.event_time) - timeSortValue(b.event_time))
      );
    }
    return map;
  }, [filteredEvents]);

  const selectedDayEvents = useMemo(() => {
    return [...(eventsByDate.get(selectedDate) || [])].sort(
      (a, b) => timeSortValue(a.event_time) - timeSortValue(b.event_time)
    );
  }, [eventsByDate, selectedDate]);

  const monthEvents = useMemo(() => {
    return filteredEvents.filter((ev) => inSameMonth(ev.event_date, monthStart));
  }, [filteredEvents, monthStart]);

  const monthIn = useMemo(() => {
    return monthEvents
      .filter((ev) => String(ev.flow) === "income")
      .reduce((sum, ev) => sum + Number(ev.amount || 0), 0);
  }, [monthEvents]);

  const monthOut = useMemo(() => {
    return monthEvents
      .filter((ev) => String(ev.flow) === "expense")
      .reduce((sum, ev) => sum + Number(ev.amount || 0), 0);
  }, [monthEvents]);

  const dayIn = useMemo(() => {
    return selectedDayEvents
      .filter((ev) => String(ev.flow) === "income")
      .reduce((sum, ev) => sum + Number(ev.amount || 0), 0);
  }, [selectedDayEvents]);

  const dayOut = useMemo(() => {
    return selectedDayEvents
      .filter((ev) => String(ev.flow) === "expense")
      .reduce((sum, ev) => sum + Number(ev.amount || 0), 0);
  }, [selectedDayEvents]);

  const upcoming = useMemo(() => {
    const today = todayISO();
    return filteredEvents
      .filter((ev) => ev.event_date >= today)
      .sort((a, b) => {
        if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
        return timeSortValue(a.event_time) - timeSortValue(b.event_time);
      })
      .slice(0, 8);
  }, [filteredEvents]);

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

    setPageError("");
    setStatus("");

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
      updated_at: new Date().toISOString(),
    };

    try {
      if (draft.id) {
        const { data, error } = await supabase
          .from("calendar_events")
          .update(payload)
          .eq("id", draft.id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) throw error;

        const saved = mapEventRow(data);
        setEvents((prev) => prev.map((ev) => (ev.id === saved.id ? saved : ev)));
        setStatus("Event updated ✅");
      } else {
        const { data, error } = await supabase
          .from("calendar_events")
          .insert([{ ...payload, id: uid(), created_at: new Date().toISOString() }])
          .select()
          .single();

        if (error) throw error;

        const saved = mapEventRow(data);
        setEvents((prev) =>
          [...prev, saved].sort((a, b) => {
            if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
            return timeSortValue(a.event_time) - timeSortValue(b.event_time);
          })
        );
        setStatus("Event saved ✅");
      }

      setSelectedDate(draft.event_date);
      setEditorOpen(false);
    } catch (err) {
      setPageError(err?.message || "Failed to save event.");
    }
  }

  async function deleteEvent(id) {
    if (!user || !id) return;
    if (!globalThis.confirm?.("Delete this event?")) return;

    try {
      const old = events;
      setEvents((prev) => prev.filter((ev) => ev.id !== id));

      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        setEvents(old);
        throw error;
      }

      setStatus("Event deleted.");
    } catch (err) {
      setPageError(err?.message || "Failed to delete event.");
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
      setStatus("Profile created ✅");
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

      setStatus("Default profile updated ✅");
    } catch (err) {
      setPageError(err?.message || "Failed to update default profile.");
    }
  }

  if (loading) {
    return (
      <div style={shellBg}>
        <div style={{ maxWidth: 1540, margin: "0 auto" }}>Loading calendar…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={shellBg}>
        <div style={{ maxWidth: 1540, margin: "0 auto" }}>
          <div style={{ ...panelStyle, padding: 24 }}>
            You need to log in to use Calendar.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={shellBg}>
      <div style={{ maxWidth: 1540, margin: "0 auto", display: "grid", gap: 18 }}>
        {/* header */}
        <div style={{ ...panelStyle, padding: 22, display: "grid", gap: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ color: C.textMute, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                Calendar
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-.03em" }}>
                Daily Command Calendar
              </div>
              <div style={{ color: C.textSoft, marginTop: 8 }}>
                Track paydays, expenses, bills, and day-by-day life events without touching account balances.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                style={{ ...inputStyle, minWidth: 190, fontWeight: 800 }}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id} style={{ color: "black" }}>
                    {p.name}
                  </option>
                ))}
              </select>

              <button type="button" onClick={() => setManageOpen(true)} style={buttonStyle("soft")}>
                Manage
              </button>

              <button
                type="button"
                onClick={() => {
                  const t = todayISO();
                  setMonthStart(startOfMonthISO(t));
                  setSelectedDate(t);
                }}
                style={buttonStyle("soft")}
              >
                Today
              </button>

              <button type="button" onClick={() => openCreate(selectedDate)} style={buttonStyle("primary")}>
                + Add
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatPill label="Month In:" value={fmtMoney(monthIn)} tone="good" />
            <StatPill label="Month Out:" value={fmtMoney(monthOut)} tone="bad" />
            <StatPill label="Net:" value={fmtMoney(monthIn - monthOut)} tone="soft" />
            {status ? <StatPill label="" value={status} tone="neutral" /> : null}
            {pageError ? <StatPill label="" value={pageError} tone="bad" /> : null}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setMonthStart((m) => addMonthsISO(m, -1))} style={buttonStyle("soft")}>
                ←
              </button>

              <div
                style={{
                  minWidth: 190,
                  padding: "12px 16px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,.05)",
                  border: `1px solid ${C.border}`,
                  fontSize: 18,
                  fontWeight: 900,
                  color: C.text,
                }}
              >
                {monthLabel(monthStart)}
              </div>

              <button type="button" onClick={() => setMonthStart((m) => addMonthsISO(m, 1))} style={buttonStyle("soft")}>
                →
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {["All", "Paydays", "Expenses", "Bill", "General"].map((name) => {
                const active = filter === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setFilter(name)}
                    style={buttonStyle("soft", active)}
                  >
                    {name}
                  </button>
                );
              })}

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events..."
                style={{ ...inputStyle, width: 220 }}
              />
            </div>
          </div>
        </div>

        {/* main */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.7fr) minmax(390px, .95fr)",
            gap: 18,
            alignItems: "start",
          }}
        >
          {/* month grid */}
          <div style={{ ...panelStyle, padding: 18 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 10,
                marginBottom: 10,
              }}
            >
              {Array.from({ length: 7 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    color: "rgba(255,255,255,.72)",
                    fontSize: 13,
                    fontWeight: 800,
                    textAlign: "center",
                    padding: "8px 0",
                  }}
                >
                  {weekdayShort(i)}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              {monthGridDays.map((dayISO) => {
                const dayEvents = eventsByDate.get(dayISO) || [];
                const selected = dayISO === selectedDate;
                const today = dayISO === todayISO();
                const sameMonth = inSameMonth(dayISO, monthStart);

                const inTotal = dayEvents
                  .filter((ev) => String(ev.flow) === "income")
                  .reduce((sum, ev) => sum + Number(ev.amount || 0), 0);

                const outTotal = dayEvents
                  .filter((ev) => String(ev.flow) === "expense")
                  .reduce((sum, ev) => sum + Number(ev.amount || 0), 0);

                return (
                  <button
                    key={dayISO}
                    type="button"
                    onClick={() => setSelectedDate(dayISO)}
                    style={{
                      minHeight: 150,
                      borderRadius: 22,
                      border: selected
                        ? "1px solid rgba(255,255,255,.16)"
                        : today
                        ? "1px solid rgba(34,197,94,.24)"
                        : `1px solid ${C.border}`,
                      background: selected
                        ? "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.035))"
                        : "linear-gradient(180deg, rgba(255,255,255,.042), rgba(255,255,255,.025))",
                      color: "white",
                      padding: 12,
                      textAlign: "left",
                      cursor: "pointer",
                      opacity: sameMonth ? 1 : 0.42,
                      boxShadow: selected ? "0 12px 30px rgba(0,0,0,.20)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{parseISO(dayISO)?.getDate()}</div>
                      {dayEvents.length > 0 ? (
                        <div
                          style={{
                            minWidth: 26,
                            height: 26,
                            borderRadius: 999,
                            background: "rgba(255,255,255,.07)",
                            border: `1px solid ${C.border}`,
                            display: "grid",
                            placeItems: "center",
                            fontSize: 12,
                            fontWeight: 900,
                            color: C.text,
                          }}
                        >
                          {dayEvents.length}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ color: C.textMute, fontSize: 12, marginTop: 8 }}>{dayISO}</div>

                    {(inTotal > 0 || outTotal > 0) && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        {inTotal > 0 ? (
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: "#d8ffe5",
                              background: C.greenSoft,
                              border: "1px solid rgba(34,197,94,.24)",
                              borderRadius: 999,
                              padding: "4px 8px",
                            }}
                          >
                            + {fmtMoney(inTotal)}
                          </div>
                        ) : null}

                        {outTotal > 0 ? (
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: "#ffdede",
                              background: C.redSoft,
                              border: "1px solid rgba(239,68,68,.24)",
                              borderRadius: 999,
                              padding: "4px 8px",
                            }}
                          >
                            - {fmtMoney(outTotal)}
                          </div>
                        ) : null}
                      </div>
                    )}

                    <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                      {dayEvents.slice(0, 2).map((ev) => {
                        const tone = toneForEvent(ev);
                        return (
                          <div
                            key={ev.id}
                            style={{
                              borderRadius: 12,
                              background: "rgba(255,255,255,.04)",
                              border: `1px solid ${tone.border}`,
                              borderLeft: `3px solid ${tone.line}`,
                              padding: "7px 8px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                color: C.textMute,
                                fontWeight: 800,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {fmtTime(ev.event_time)}
                            </div>
                            <div
                              style={{
                                marginTop: 2,
                                fontSize: 12,
                                fontWeight: 800,
                                color: C.text,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {ev.title}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* right rail */}
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ ...panelStyle, padding: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Selected day
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.25, color: C.text }}>
                    {fmtLong(selectedDate)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => openPayday(selectedDate)} style={buttonStyle("soft")}>
                    + Payday
                  </button>
                  <button type="button" onClick={() => openExpense(selectedDate)} style={buttonStyle("soft")}>
                    + Expense
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <StatPill label="In:" value={fmtMoney(dayIn)} tone="good" />
                <StatPill label="Out:" value={fmtMoney(dayOut)} tone="bad" />
                <StatPill label="Net:" value={fmtMoney(dayIn - dayOut)} tone="soft" />
                <StatPill label="Events:" value={String(selectedDayEvents.length)} tone="neutral" />
              </div>

              <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                {selectedDayEvents.length === 0 ? (
                  <div style={{ ...cardStyle, padding: 16, color: C.textSoft }}>
                    No events for this day.
                  </div>
                ) : (
                  selectedDayEvents.map((ev) => {
                    const tone = toneForEvent(ev);
                    return (
                      <div
                        key={ev.id}
                        style={{
                          ...cardStyle,
                          padding: 16,
                          border: `1px solid ${tone.border}`,
                          borderLeft: `4px solid ${tone.line}`,
                          display: "grid",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>{ev.title}</div>
                            <div style={{ marginTop: 6, color: C.textSoft }}>
                              {fmtTime(ev.event_time)}
                              {ev.end_time ? ` → ${fmtTime(ev.end_time)}` : ""}
                            </div>
                          </div>

                          <div
                            style={{
                              borderRadius: 999,
                              background: tone.soft,
                              border: `1px solid ${tone.border}`,
                              color: tone.text,
                              padding: "7px 10px",
                              fontSize: 12,
                              fontWeight: 900,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {ev.category}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {ev.flow !== "none" ? (
                            <div
                              style={{
                                borderRadius: 999,
                                background: tone.soft,
                                border: `1px solid ${tone.border}`,
                                color: tone.text,
                                padding: "7px 10px",
                                fontSize: 12,
                                fontWeight: 900,
                              }}
                            >
                              {ev.flow === "income" ? "Income" : "Expense"} {fmtMoney(ev.amount || 0)}
                            </div>
                          ) : null}

                          <div
                            style={{
                              borderRadius: 999,
                              background: "rgba(255,255,255,.05)",
                              border: `1px solid ${C.border}`,
                              color: C.textSoft,
                              padding: "7px 10px",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {ev.status}
                          </div>
                        </div>

                        {ev.note ? (
                          <div style={{ color: C.textSoft, lineHeight: 1.45 }}>{ev.note}</div>
                        ) : null}

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => openEdit(ev)} style={buttonStyle("soft")}>
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteEvent(ev.id)}
                            style={{
                              ...buttonStyle("soft"),
                              border: "1px solid rgba(239,68,68,.20)",
                              color: "#ffdede",
                              background: "rgba(239,68,68,.10)",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ ...panelStyle, padding: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12, color: C.text }}>Upcoming</div>

              <div style={{ display: "grid", gap: 10 }}>
                {upcoming.length === 0 ? (
                  <div style={{ color: C.textSoft }}>Nothing coming up.</div>
                ) : (
                  upcoming.map((ev) => {
                    const tone = toneForEvent(ev);
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => {
                          setSelectedDate(ev.event_date);
                          setMonthStart(startOfMonthISO(ev.event_date));
                        }}
                        style={{
                          textAlign: "left",
                          borderRadius: 16,
                          border: `1px solid ${tone.border}`,
                          background: "rgba(255,255,255,.035)",
                          borderLeft: `4px solid ${tone.line}`,
                          padding: 12,
                          color: C.text,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>{ev.title}</div>
                        <div style={{ marginTop: 4, color: C.textSoft, fontSize: 13 }}>
                          {ev.event_date} • {fmtTime(ev.event_time)}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* manage */}
      <Modal open={manageOpen} title="Manage calendars" onClose={() => setManageOpen(false)}>
        <div style={{ display: "grid", gap: 18 }}>
          <form onSubmit={createProfile} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="New calendar name"
              style={{ ...inputStyle, flex: 1, minWidth: 220 }}
            />
            <button type="submit" style={buttonStyle("primary")}>
              Create
            </button>
          </form>

          <div style={{ display: "grid", gap: 10 }}>
            {profiles.map((p) => (
              <div
                key={p.id}
                style={{
                  ...cardStyle,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, color: C.text }}>{p.name}</div>
                  <div style={{ marginTop: 4, color: C.textMute, fontSize: 13 }}>
                    {p.is_default ? "Default calendar" : "Secondary calendar"}
                  </div>
                </div>

                {!p.is_default ? (
                  <button type="button" onClick={() => setDefaultProfile(p.id)} style={buttonStyle("soft")}>
                    Set default
                  </button>
                ) : (
                  <div
                    style={{
                      borderRadius: 999,
                      padding: "8px 12px",
                      background: C.greenSoft,
                      border: "1px solid rgba(34,197,94,.24)",
                      color: "#dbffe8",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    Default
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* editor */}
      <Modal
        open={editorOpen}
        title={draft.id ? "Edit event" : "Add event"}
        onClose={() => setEditorOpen(false)}
      >
        <form onSubmit={saveEvent} style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setDraft(paydayTemplate(draft.event_date || selectedDate, profileId))}
              style={buttonStyle("soft")}
            >
              Payday template
            </button>

            <button
              type="button"
              onClick={() => setDraft(expenseTemplate(draft.event_date || selectedDate, profileId))}
              style={buttonStyle("soft")}
            >
              Expense template
            </button>

            <button
              type="button"
              onClick={() => setDraft(emptyEvent(draft.event_date || selectedDate, profileId))}
              style={buttonStyle("soft")}
            >
              Blank
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontSize: 12, color: C.textMute, fontWeight: 800 }}>Title</label>
              <input
                value={draft.title}
                onChange={(e) => patchDraft("title", e.target.value)}
                style={inputStyle}
                placeholder="Payday"
              />
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontSize: 12, color: C.textMute, fontWeight: 800 }}>Date</label>
              <input
                type="date"
                value={draft.event_date}
                onChange={(e) => patchDraft("event_date", e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontSize: 12, color: C.textMute, fontWeight: 800 }}>Start time</label>
              <input
                type="time"
                value={draft.event_time}
                onChange={(e) => patchDraft("event_time", e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontSize: 12, color: C.textMute, fontWeight: 800 }}>End time</label>
              <input
                type="time"
                value={draft.end_time}
                onChange={(e) => patchDraft("end_time", e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontSize: 12, color: C.textMute, fontWeight: 800 }}>Category</label>
              <select
                value={draft.category}
                onChange={(e) => patchDraft("category", e.target.value)}
                style={inputStyle}
              >
                <option value="Payday" style={{ color: "black" }}>Payday</option>
                <option value="Expense" style={{ color: "black" }}>Expense</option>
                <option value="Bill" style={{ color: "black" }}>Bill</option>
                <option value="General" style={{ color: "black" }}>General</option>
                <option value="Reminder" style={{ color: "black" }}>Reminder</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontSize: 12, color: C.textMute, fontWeight: 800 }}>Flow</label>
              <select
                value={draft.flow}
                onChange={(e) => patchDraft("flow", e.target.value)}
                style={inputStyle}
              >
                <option value="none" style={{ color: "black" }}>None</option>
                <option value="income" style={{ color: "black" }}>Income</option>
                <option value="expense" style={{ color: "black" }}>Expense</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontSize: 12, color: C.textMute, fontWeight: 800 }}>Amount</label>
              <input
                value={draft.amount}
                onChange={(e) => patchDraft("amount", e.target.value)}
                style={inputStyle}
                placeholder="0.00"
              />
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontSize: 12, color: C.textMute, fontWeight: 800 }}>Status</label>
              <select
                value={draft.status}
                onChange={(e) => patchDraft("status", e.target.value)}
                style={inputStyle}
              >
                <option value="scheduled" style={{ color: "black" }}>Scheduled</option>
                <option value="done" style={{ color: "black" }}>Done</option>
                <option value="canceled" style={{ color: "black" }}>Canceled</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ fontSize: 12, color: C.textMute, fontWeight: 800 }}>Note</label>
            <textarea
              value={draft.note}
              onChange={(e) => patchDraft("note", e.target.value)}
              style={textareaStyle}
              placeholder="Optional notes..."
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setEditorOpen(false)} style={buttonStyle("soft")}>
              Cancel
            </button>

            <button type="submit" style={buttonStyle("primary")}>
              {draft.id ? "Save changes" : "Create event"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}