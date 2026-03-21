"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/* =========================================================
   LIFE COMMAND CENTER — INCOME COMMAND
   - numbers first
   - darker premium theme
   - income -> accounts integration
   - optional payday -> calendar integration
   - calendar does NOT change accounts
   ========================================================= */

/* ------------------------- utils ------------------------- */
function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isoDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDateOnly(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthKeyFromISO(iso) {
  const s = String(iso || "");
  return s.length >= 7 ? s.slice(0, 7) : "";
}

function fmtMonthLabel(ym) {
  if (!ym || ym.length < 7) return "—";
  const [y, m] = ym.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function money(n) {
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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function addDays(d, days) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function startOfMonthDate(ym) {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return new Date(y, m - 1, 1);
}

function endOfMonthDate(ym) {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return new Date(y, m - 1, daysInMonth(y, m - 1));
}

function dateLabel(iso) {
  const d = toDateOnly(iso);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function pct(n, d) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
  return (n / d) * 100;
}

function niceSourceLabel(s) {
  const raw = String(s || "").trim();
  return raw || "Income";
}

function timeLabel(hhmm) {
  if (!hhmm) return "All day";
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/* -------------------- pay schedule logic -------------------- */
function computeProjectedPaydaysForMonth({ monthYM, schedule, anchorDateISO }) {
  const start = startOfMonthDate(monthYM);
  const end = endOfMonthDate(monthYM);
  if (!start || !end) return [];

  const mode = String(schedule || "BIWEEKLY").toUpperCase();

  if (mode === "TWICE_MONTHLY") {
    const [y, m] = monthYM.split("-").map(Number);
    const d1 = new Date(y, m - 1, 1);
    const d15 = new Date(y, m - 1, 15);
    return [d1, d15]
      .filter((d) => d >= start && d <= end)
      .map((d) => ({ id: `proj-${isoDate(d)}`, pay_date: isoDate(d), projected: true }));
  }

  if (mode === "MONTHLY") {
    const [y, m] = monthYM.split("-").map(Number);
    const d1 = new Date(y, m - 1, 1);
    return [{ id: `proj-${isoDate(d1)}`, pay_date: isoDate(d1), projected: true }].filter(
      (x) => toDateOnly(x.pay_date) >= start && toDateOnly(x.pay_date) <= end
    );
  }

  const step = mode === "WEEKLY" ? 7 : 14;
  const anchor = toDateOnly(anchorDateISO);
  if (!anchor) return [];

  let cur = new Date(anchor.getTime());
  while (cur > end) cur = addDays(cur, -step);
  while (addDays(cur, step) < start) cur = addDays(cur, step);

  const out = [];
  let iter = new Date(cur.getTime());
  while (iter < start) iter = addDays(iter, step);

  while (iter <= end) {
    out.push({
      id: `proj-${isoDate(iter)}`,
      pay_date: isoDate(iter),
      projected: true,
    });
    iter = addDays(iter, step);
  }

  return out;
}

/* ---------------------- styling system ---------------------- */
const C = {
  bgTop: "#07101e",
  bgBottom: "#050913",
  panel: "rgba(255,255,255,.034)",
  panelStrong: "rgba(255,255,255,.05)",
  card: "rgba(255,255,255,.04)",
  cardSoft: "rgba(255,255,255,.028)",
  border: "rgba(255,255,255,.08)",
  borderSoft: "rgba(255,255,255,.06)",
  text: "rgba(255,255,255,.95)",
  textSoft: "rgba(255,255,255,.76)",
  textMute: "rgba(255,255,255,.54)",
  green: "#22c55e",
  greenSoft: "rgba(34,197,94,.16)",
  red: "#ef4444",
  redSoft: "rgba(239,68,68,.14)",
  amber: "#f59e0b",
  amberSoft: "rgba(245,158,11,.14)",
  neutral: "#94a3b8",
  neutralSoft: "rgba(148,163,184,.14)",
};

const shadow = "0 18px 60px rgba(0,0,0,.34)";
const softShadow = "0 12px 34px rgba(0,0,0,.24)";

const panelStyle = {
  background: C.panel,
  border: `1px solid ${C.borderSoft}`,
  borderRadius: 24,
  boxShadow: shadow,
};

const cardStyle = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  boxShadow: softShadow,
};

const inputStyle = {
  width: "100%",
  height: 46,
  borderRadius: 14,
  border: `1px solid ${C.border}`,
  background: "rgba(255,255,255,.045)",
  color: C.text,
  padding: "0 14px",
  outline: "none",
};

const textareaStyle = {
  width: "100%",
  minHeight: 96,
  borderRadius: 14,
  border: `1px solid ${C.border}`,
  background: "rgba(255,255,255,.045)",
  color: C.text,
  padding: "12px 14px",
  outline: "none",
  resize: "vertical",
};

function pillStyle(bg = "rgba(255,255,255,.06)", border = "rgba(255,255,255,.10)", color = C.textSoft) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    color,
    background: bg,
    border: `1px solid ${border}`,
  };
}

function buttonBase() {
  return {
    height: 46,
    borderRadius: 14,
    border: `1px solid ${C.border}`,
    padding: "0 16px",
    fontWeight: 800,
    cursor: "pointer",
    transition: "0.18s ease",
  };
}

function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      style={{
        ...buttonBase(),
        background: "rgba(255,255,255,.09)",
        color: "white",
        border: "1px solid rgba(255,255,255,.14)",
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

function SoftButton({ children, ...props }) {
  return (
    <button
      {...props}
      style={{
        ...buttonBase(),
        background: "rgba(255,255,255,.045)",
        color: C.text,
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

function TinyAction({ children, tone = "default", ...props }) {
  const toneMap = {
    default: {
      bg: "rgba(255,255,255,.045)",
      border: "rgba(255,255,255,.08)",
      color: C.text,
    },
    good: {
      bg: C.greenSoft,
      border: "rgba(34,197,94,.28)",
      color: "#d8ffe5",
    },
    warn: {
      bg: C.amberSoft,
      border: "rgba(245,158,11,.28)",
      color: "#fff1cc",
    },
    danger: {
      bg: C.redSoft,
      border: "rgba(239,68,68,.28)",
      color: "#ffd9d9",
    },
  };

  const t = toneMap[tone] || toneMap.default;

  return (
    <button
      {...props}
      style={{
        height: 34,
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.color,
        padding: "0 12px",
        fontWeight: 700,
        cursor: "pointer",
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

function SectionTitle({ eyebrow, title, right, sub }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <div>
        {eyebrow ? (
          <div style={{ color: C.textMute, fontSize: 12, marginBottom: 6, fontWeight: 700 }}>{eyebrow}</div>
        ) : null}
        <div style={{ color: C.text, fontSize: 28, fontWeight: 900, letterSpacing: "-.03em" }}>{title}</div>
        {sub ? <div style={{ color: C.textSoft, marginTop: 8 }}>{sub}</div> : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

function HeroStat({ label, value, sub, tone = "neutral" }) {
  const toneMap = {
    neutral: { line: C.neutral, glow: C.neutralSoft },
    good: { line: C.green, glow: C.greenSoft },
    warn: { line: C.amber, glow: C.amberSoft },
    bad: { line: C.red, glow: C.redSoft },
  };
  const t = toneMap[tone] || toneMap.neutral;

  return (
    <div
      style={{
        ...cardStyle,
        padding: 18,
        minHeight: 134,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at top right, ${t.glow}, transparent 45%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: 0,
          height: 2,
          background: t.line,
          opacity: 0.95,
          borderRadius: 999,
        }}
      />
      <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>{label}</div>
      <div style={{ color: C.text, fontSize: 30, fontWeight: 900, letterSpacing: "-.03em" }}>{value}</div>
      {sub ? <div style={{ color: C.textSoft, fontSize: 13, marginTop: 8 }}>{sub}</div> : null}
    </div>
  );
}

function ProgressRow({ label, value, pctValue, tone = "neutral", sub }) {
  const fill =
    tone === "good" ? C.green : tone === "warn" ? C.amber : tone === "bad" ? C.red : C.neutral;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ color: C.text, fontWeight: 800 }}>{label}</div>
        <div style={{ color: C.textSoft, fontWeight: 700 }}>{value}</div>
      </div>

      <div
        style={{
          height: 14,
          borderRadius: 999,
          background: "rgba(255,255,255,.06)",
          border: `1px solid ${C.border}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${clamp(pctValue, 0, 100)}%`,
            height: "100%",
            borderRadius: 999,
            background: fill,
            boxShadow:
              tone === "good"
                ? "0 0 18px rgba(34,197,94,.45)"
                : tone === "warn"
                ? "0 0 18px rgba(245,158,11,.45)"
                : tone === "bad"
                ? "0 0 18px rgba(239,68,68,.45)"
                : "0 0 18px rgba(148,163,184,.40)",
          }}
        />
      </div>

      {sub ? <div style={{ color: C.textMute, fontSize: 12 }}>{sub}</div> : null}
    </div>
  );
}

/* --------------------- defaults + mapping --------------------- */
const DEFAULT_SETTINGS = {
  goalMonthly: 8000,
  schedule: "BIWEEKLY",
  anchorDate: isoDate(),
  paycheckAmt: 2000,
  bonusEstimate: 0,
  defaultAccountId: "",
  defaultProfileId: "",
  autoCreateCalendar: false,
  paydayEventTime: "09:00",
};

function normalizeDeposit(raw) {
  const x = raw || {};
  return {
    id: String(x.id || uid()),
    date: String(x.date || isoDate()),
    source: String(x.source || "Income"),
    amount: Number.isFinite(Number(x.amount)) ? Number(x.amount) : 0,
    note: String(x.note || ""),
    createdAt: Number.isFinite(Number(x.createdAt)) ? Number(x.createdAt) : Date.now(),
    accountId: x.accountId ? String(x.accountId) : "",
    accountName: x.accountName ? String(x.accountName) : "",
  };
}

function mapDepositRowToClient(row) {
  return normalizeDeposit({
    id: row.id,
    date: row.deposit_date,
    source: row.source,
    amount: row.amount,
    note: row.note,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    accountId: row.account_id || "",
    accountName: row.account_name || "",
  });
}

function mapIncomeSettingsRowToClient(row) {
  return {
    goalMonthly: Number.isFinite(Number(row?.goal_monthly))
      ? Number(row.goal_monthly)
      : DEFAULT_SETTINGS.goalMonthly,
    schedule: row?.schedule ? String(row.schedule) : DEFAULT_SETTINGS.schedule,
    anchorDate: row?.anchor_date ? String(row.anchor_date) : DEFAULT_SETTINGS.anchorDate,
    paycheckAmt: Number.isFinite(Number(row?.paycheck_amt))
      ? Number(row.paycheck_amt)
      : DEFAULT_SETTINGS.paycheckAmt,
    bonusEstimate: Number.isFinite(Number(row?.bonus_estimate))
      ? Number(row.bonus_estimate)
      : DEFAULT_SETTINGS.bonusEstimate,
    viewMonth: row?.view_month ? String(row.view_month) : monthKeyFromISO(isoDate()),
    defaultAccountId: row?.default_account_id ? String(row.default_account_id) : "",
    defaultProfileId: row?.default_profile_id ? String(row.default_profile_id) : "",
    autoCreateCalendar: Boolean(row?.auto_create_calendar),
    paydayEventTime: row?.payday_event_time ? String(row.payday_event_time) : DEFAULT_SETTINGS.paydayEventTime,
  };
}

function mapIncomeSettingsClientToRow(settings, userId) {
  return {
    user_id: userId,
    goal_monthly: Number(settings.goalMonthly) || 0,
    schedule: String(settings.schedule || "BIWEEKLY").toUpperCase(),
    anchor_date: settings.anchorDate || null,
    paycheck_amt: Number(settings.paycheckAmt) || 0,
    bonus_estimate: Number(settings.bonusEstimate) || 0,
    view_month: settings.viewMonth || monthKeyFromISO(isoDate()),
    default_account_id: settings.defaultAccountId || null,
    default_profile_id: settings.defaultProfileId || null,
    auto_create_calendar: Boolean(settings.autoCreateCalendar),
    payday_event_time: settings.paydayEventTime || null,
    updated_at: new Date().toISOString(),
  };
}

function normalizeScheduled(raw) {
  const x = raw || {};
  return {
    id: String(x.id || uid()),
    pay_date: String(x.pay_date || isoDate()),
    expected_amount: Number.isFinite(Number(x.expected_amount)) ? Number(x.expected_amount) : 0,
    source: String(x.source || "Paycheck"),
    note: String(x.note || ""),
    account_id: x.account_id ? String(x.account_id) : "",
    account_name: x.account_name ? String(x.account_name) : "",
    status: String(x.status || "scheduled"),
    calendar_event_id: x.calendar_event_id ? String(x.calendar_event_id) : "",
    created_at: x.created_at || new Date().toISOString(),
    projected: Boolean(x.projected),
  };
}

/* ------------------------ main page ------------------------ */
export default function IncomePage() {
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [user, setUser] = useState(null);

  const [deposits, setDeposits] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const [status, setStatus] = useState("");
  const [warning, setWarning] = useState("");

  const [viewMonth, setViewMonth] = useState(monthKeyFromISO(isoDate()));

  /* settings */
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [goalMonthly, setGoalMonthly] = useState(String(DEFAULT_SETTINGS.goalMonthly));
  const [schedule, setSchedule] = useState(DEFAULT_SETTINGS.schedule);
  const [anchorDate, setAnchorDate] = useState(DEFAULT_SETTINGS.anchorDate);
  const [paycheckAmt, setPaycheckAmt] = useState(String(DEFAULT_SETTINGS.paycheckAmt));
  const [bonusEstimate, setBonusEstimate] = useState(String(DEFAULT_SETTINGS.bonusEstimate));
  const [defaultAccountId, setDefaultAccountId] = useState(DEFAULT_SETTINGS.defaultAccountId);
  const [defaultProfileId, setDefaultProfileId] = useState(DEFAULT_SETTINGS.defaultProfileId);
  const [autoCreateCalendar, setAutoCreateCalendar] = useState(DEFAULT_SETTINGS.autoCreateCalendar);
  const [paydayEventTime, setPaydayEventTime] = useState(DEFAULT_SETTINGS.paydayEventTime);

  /* quick add */
  const [entryMode, setEntryMode] = useState("received"); // received | scheduled
  const [date, setDate] = useState(isoDate());
  const [source, setSource] = useState("Paycheck");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [createCalendarEvent, setCreateCalendarEvent] = useState(false);

  /* edit deposit */
  const [editId, setEditId] = useState("");
  const [eDate, setEDate] = useState(isoDate());
  const [eSource, setESource] = useState("");
  const [eAmount, setEAmount] = useState("");
  const [eNote, setENote] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        if (!supabase) throw new Error("Supabase is not configured.");

        const {
          data: { user: currentUser },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;
        if (!mounted) return;

        setUser(currentUser || null);

        if (!currentUser) {
          setLoading(false);
          return;
        }

        const [depositsRes, settingsRes, accountsRes, scheduledRes, profilesRes] = await Promise.all([
          supabase
            .from("income_deposits")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("deposit_date", { ascending: false })
            .order("created_at", { ascending: false }),

          supabase.from("income_settings").select("*").eq("user_id", currentUser.id).maybeSingle(),

          supabase.from("accounts").select("*").eq("user_id", currentUser.id).order("name", { ascending: true }),

          supabase
            .from("scheduled_paydays")
            .select("*")
            .eq("user_id", currentUser.id)
            .neq("status", "received")
            .order("pay_date", { ascending: true }),

          supabase
            .from("calendar_profiles")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: true }),
        ]);

        if (depositsRes.error) throw depositsRes.error;
        if (settingsRes.error) throw settingsRes.error;

        const loadedDeposits = (depositsRes.data || []).map(mapDepositRowToClient);
        const s = mapIncomeSettingsRowToClient(settingsRes.data);

        if (!mounted) return;

        setDeposits(loadedDeposits);
        setGoalMonthly(String(s.goalMonthly));
        setSchedule(String(s.schedule));
        setAnchorDate(String(s.anchorDate));
        setPaycheckAmt(String(s.paycheckAmt));
        setBonusEstimate(String(s.bonusEstimate));
        setViewMonth(String(s.viewMonth || monthKeyFromISO(isoDate())));
        setDefaultAccountId(String(s.defaultAccountId || ""));
        setDefaultProfileId(String(s.defaultProfileId || ""));
        setAutoCreateCalendar(Boolean(s.autoCreateCalendar));
        setPaydayEventTime(String(s.paydayEventTime || DEFAULT_SETTINGS.paydayEventTime));
        setDestinationAccountId(String(s.defaultAccountId || ""));

        if (!accountsRes.error && Array.isArray(accountsRes.data)) {
          const mappedAccounts = accountsRes.data.map((row) => ({
            id: String(row.id),
            name: String(row.name || row.account_name || "Account"),
            balance: Number(row.balance ?? 0) || 0,
            accountType: String(row.account_type || ""),
          }));
          setAccounts(mappedAccounts);
        } else {
          setAccounts([]);
        }

        if (!scheduledRes.error && Array.isArray(scheduledRes.data)) {
          setScheduled(scheduledRes.data.map(normalizeScheduled));
        } else {
          setScheduled([]);
        }

        if (!profilesRes.error && Array.isArray(profilesRes.data)) {
          const loadedProfiles = profilesRes.data.map((row) => ({
            id: String(row.id),
            name: String(row.name || "Default"),
            isDefault: Boolean(row.is_default),
          }));
          setProfiles(loadedProfiles);

          if (!s.defaultProfileId && loadedProfiles.length) {
            const picked = loadedProfiles.find((p) => p.isDefault)?.id || loadedProfiles[0].id;
            setDefaultProfileId(picked);
          }
        } else {
          setProfiles([]);
        }

        setStatus("Income loaded ✅");
      } catch (err) {
        if (!mounted) return;
        setPageError(err?.message || "Failed to load income page.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  async function saveSettings() {
    try {
      if (!user || !supabase) return;

      setPageError("");
      setStatus("");
      setWarning("");

      const payload = mapIncomeSettingsClientToRow(
        {
          goalMonthly: Number.isFinite(parseMoneyInput(goalMonthly)) ? parseMoneyInput(goalMonthly) : 0,
          schedule,
          anchorDate,
          paycheckAmt: Number.isFinite(parseMoneyInput(paycheckAmt)) ? parseMoneyInput(paycheckAmt) : 0,
          bonusEstimate: Number.isFinite(parseMoneyInput(bonusEstimate)) ? parseMoneyInput(bonusEstimate) : 0,
          viewMonth,
          defaultAccountId,
          defaultProfileId,
          autoCreateCalendar,
          paydayEventTime,
        },
        user.id
      );

      const { error } = await supabase.from("income_settings").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      setStatus("Income settings saved ✅");
      setSettingsOpen(false);
    } catch (err) {
      setPageError(err?.message || "Failed to save income settings.");
    }
  }

  function resetQuickAdd() {
    setDate(isoDate());
    setSource("Paycheck");
    setAmount("");
    setNote("");
    setDestinationAccountId(defaultAccountId || "");
    setCreateCalendarEvent(false);
    setEntryMode("received");
  }

  async function createCalendarPaydayEvent({
    title,
    payDate,
    amountValue,
    noteText,
    profileIdOverride,
    sourceId,
  }) {
    if (!user || !supabase) return { ok: false, eventId: "", message: "Not logged in." };

    const chosenProfileId =
      String(profileIdOverride || "").trim() ||
      String(defaultProfileId || "").trim() ||
      profiles.find((p) => p.isDefault)?.id ||
      profiles[0]?.id ||
      "";

    if (!chosenProfileId) {
      return {
        ok: false,
        eventId: "",
        message: "No calendar profile found for payday event.",
      };
    }

    const payload = {
      id: uid(),
      user_id: user.id,
      profile_id: chosenProfileId,
      title: title || "Payday",
      event_date: payDate,
      event_time: paydayEventTime || null,
      end_time: null,
      category: "Payday",
      flow: "income",
      amount: Number(amountValue) || 0,
      note: noteText || "",
      status: "scheduled",
      color: "#22c55e",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source_type: "income",
      source_id: sourceId || null,
    };

    try {
      const { data, error } = await supabase.from("calendar_events").insert([payload]).select("id").single();

      if (error) {
        return {
          ok: false,
          eventId: "",
          message: "Payday saved, but calendar event was not created.",
        };
      }

      return {
        ok: true,
        eventId: String(data?.id || ""),
        message: "Payday event created.",
      };
    } catch {
      return {
        ok: false,
        eventId: "",
        message: "Payday saved, but calendar event helper needs adjustment.",
      };
    }
  }

  async function applyDepositToAccount({
    accountId,
    amountValue,
    sourceId,
    sourceLabel,
    noteText,
  }) {
    if (!user || !supabase) return { ok: false, message: "Not logged in." };
    if (!accountId || !Number.isFinite(Number(amountValue)) || Number(amountValue) <= 0) {
      return { ok: false, message: "No account chosen." };
    }

    const account = accounts.find((a) => String(a.id) === String(accountId));
    if (!account) return { ok: false, message: "Account not found." };

    const currentBalance = Number(account.balance || 0);
    const nextBalance = currentBalance + Number(amountValue);

    try {
      const { error: accountErr } = await supabase
        .from("accounts")
        .update({
          balance: nextBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId)
        .eq("user_id", user.id);

      if (accountErr) {
        return {
          ok: false,
          message: "Deposit saved, but account balance did not update.",
        };
      }

      const txnPayload = {
        id: uid(),
        user_id: user.id,
        account_id: accountId,
        kind: "deposit",
        amount: Number(amountValue) || 0,
        delta: Number(amountValue) || 0,
        resulting_balance: nextBalance,
        note: noteText || "",
        related_account_id: null,
        related_account_name: null,
        source_type: "income",
        source_id: sourceId || null,
        created_at: new Date().toISOString(),
      };

      const { error: txnErr } = await supabase.from("account_transactions").insert([txnPayload]);

      if (txnErr) {
        return {
          ok: false,
          message: "Balance updated, but account transaction ledger failed.",
        };
      }

      setAccounts((prev) =>
        prev.map((a) => (String(a.id) === String(accountId) ? { ...a, balance: nextBalance } : a))
      );

      return {
        ok: true,
        message: `Posted to ${account.name}.`,
      };
    } catch {
      return {
        ok: false,
        message: "Deposit saved, but account posting helper failed.",
      };
    }
  }

  async function createScheduledPayday({
    payDate,
    expectedAmount,
    src,
    accountId,
    noteText,
    createCalendar,
  }) {
    if (!user || !supabase) return { ok: false, message: "Not logged in." };

    const account = accounts.find((a) => String(a.id) === String(accountId));
    const scheduledId = uid();

    const payload = {
      id: scheduledId,
      user_id: user.id,
      pay_date: payDate,
      expected_amount: Number(expectedAmount) || 0,
      source: src || "Paycheck",
      note: noteText || "",
      account_id: accountId || null,
      account_name: account?.name || null,
      status: "scheduled",
      calendar_event_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase.from("scheduled_paydays").insert([payload]).select().single();

      if (error) {
        return {
          ok: false,
          message: "Scheduled payday table is not fully wired yet.",
        };
      }

      let calendarMsg = "";
      let calendarEventId = "";

      if (createCalendar) {
        const cal = await createCalendarPaydayEvent({
          title: src || "Payday",
          payDate,
          amountValue: expectedAmount,
          noteText,
          sourceId: scheduledId,
        });

        if (cal.ok && cal.eventId) {
          calendarEventId = cal.eventId;
          calendarMsg = " Calendar event created.";
          await supabase
            .from("scheduled_paydays")
            .update({
              calendar_event_id: cal.eventId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", scheduledId)
            .eq("user_id", user.id);
        } else if (cal.message) {
          setWarning(cal.message);
        }
      }

      const saved = normalizeScheduled({
        ...data,
        calendar_event_id: calendarEventId || data?.calendar_event_id || "",
      });

      setScheduled((prev) =>
        [...prev.filter((x) => x.status !== "received"), saved].sort((a, b) => a.pay_date.localeCompare(b.pay_date))
      );

      return {
        ok: true,
        message: `Payday scheduled ✅${calendarMsg}`,
      };
    } catch {
      return {
        ok: false,
        message: "Scheduled payday helper needs adjustment.",
      };
    }
  }

  async function addIncome(e) {
    e.preventDefault();
    setPageError("");
    setStatus("");
    setWarning("");

    if (!user || !supabase) {
      setPageError("You must be logged in.");
      return;
    }

    const dt = String(date || "").trim();
    const src = String(source || "").trim();
    const amt = parseMoneyInput(amount);
    const nt = String(note || "").trim();
    const accountId = String(destinationAccountId || "").trim();

    if (!dt) return setPageError("Date is required.");
    if (!src) return setPageError("Source is required.");
    if (!Number.isFinite(amt) || amt <= 0) return setPageError("Amount must be greater than 0.");

    if (entryMode === "scheduled") {
      const scheduledResult = await createScheduledPayday({
        payDate: dt,
        expectedAmount: amt,
        src,
        accountId,
        noteText: nt,
        createCalendar: createCalendarEvent || autoCreateCalendar,
      });

      if (scheduledResult.ok) {
        setStatus(scheduledResult.message);
        resetQuickAdd();
      } else {
        setWarning(scheduledResult.message);
      }
      return;
    }

    const account = accounts.find((a) => String(a.id) === String(accountId));
    const depositId = uid();

    const deposit = normalizeDeposit({
      id: depositId,
      date: dt,
      source: src,
      amount: amt,
      note: nt,
      createdAt: Date.now(),
      accountId,
      accountName: account?.name || "",
    });

    const row = {
      id: deposit.id,
      user_id: user.id,
      deposit_date: deposit.date,
      source: deposit.source,
      amount: deposit.amount,
      note: deposit.note || "",
      account_id: deposit.accountId || null,
      account_name: deposit.accountName || null,
      created_at: new Date(deposit.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("income_deposits").insert([row]).select().single();

    if (error) {
      setPageError(error.message || "Failed to save income deposit.");
      return;
    }

    const savedDeposit = normalizeDeposit(mapDepositRowToClient(data));

    setDeposits((prev) =>
      [savedDeposit, ...prev].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return Number(b.createdAt || 0) - Number(a.createdAt || 0);
      })
    );

    let accountMsg = "";
    if (accountId) {
      const routed = await applyDepositToAccount({
        accountId,
        amountValue: amt,
        sourceId: deposit.id,
        sourceLabel: src,
        noteText: nt,
      });

      if (!routed.ok) {
        setWarning(routed.message);
      } else {
        accountMsg = ` ${routed.message}`;
      }
    }

    if (createCalendarEvent || autoCreateCalendar) {
      const cal = await createCalendarPaydayEvent({
        title: src || "Payday",
        payDate: dt,
        amountValue: amt,
        noteText: nt,
        sourceId: deposit.id,
      });

      if (!cal.ok && cal.message) {
        setWarning((prev) => prev || cal.message);
      }
    }

    setStatus(`Income logged ✅${accountMsg}`);
    setAmount("");
    setNote("");
  }

  function openEdit(d) {
    setEditId(d.id);
    setEDate(d.date);
    setESource(d.source);
    setEAmount(String(d.amount ?? ""));
    setENote(d.note || "");
  }

  function cancelEdit() {
    setEditId("");
    setEDate(isoDate());
    setESource("");
    setEAmount("");
    setENote("");
  }

  async function saveEdit() {
    if (!user || !supabase || !editId) return;

    const dt = String(eDate || "").trim();
    const src = String(eSource || "").trim();
    const amt = parseMoneyInput(eAmount);
    const nt = String(eNote || "").trim();

    if (!dt || !src || !Number.isFinite(amt) || amt <= 0) {
      setPageError("Need valid date, source, and amount.");
      return;
    }

    const { data, error } = await supabase
      .from("income_deposits")
      .update({
        deposit_date: dt,
        source: src,
        amount: amt,
        note: nt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      setPageError(error.message || "Failed to update deposit.");
      return;
    }

    const saved = mapDepositRowToClient(data);
    setDeposits((prev) => prev.map((x) => (x.id === editId ? saved : x)));
    setStatus("Deposit updated ✅");
    cancelEdit();
  }

  async function deleteDeposit(id) {
    if (!user || !supabase) return;
    if (!globalThis.confirm?.("Delete this deposit?")) return;

    const prev = deposits;
    setDeposits((list) => list.filter((x) => x.id !== id));

    const { error } = await supabase.from("income_deposits").delete().eq("id", id).eq("user_id", user.id);

    if (error) {
      setDeposits(prev);
      setPageError(error.message || "Failed to delete deposit.");
      return;
    }

    setStatus("Deposit deleted.");
  }

  async function deleteScheduled(id) {
    if (!user || !supabase) return;
    if (!globalThis.confirm?.("Delete this scheduled payday?")) return;

    const prev = scheduled;
    setScheduled((list) => list.filter((x) => x.id !== id));

    const { error } = await supabase.from("scheduled_paydays").delete().eq("id", id).eq("user_id", user.id);

    if (error) {
      setScheduled(prev);
      setWarning("Could not delete scheduled payday.");
      return;
    }

    setStatus("Scheduled payday deleted.");
  }

  async function markScheduledReceived(item) {
    if (!user || !supabase) return;

    setPageError("");
    setStatus("");
    setWarning("");

    const depositId = uid();
    const deposit = normalizeDeposit({
      id: depositId,
      date: item.pay_date,
      source: item.source || "Paycheck",
      amount: item.expected_amount,
      note: item.note || "",
      createdAt: Date.now(),
      accountId: item.account_id || "",
      accountName: item.account_name || "",
    });

    const row = {
      id: deposit.id,
      user_id: user.id,
      deposit_date: deposit.date,
      source: deposit.source,
      amount: deposit.amount,
      note: deposit.note || "",
      account_id: deposit.accountId || null,
      account_name: deposit.accountName || null,
      created_at: new Date(deposit.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("income_deposits").insert([row]).select().single();

    if (error) {
      setPageError(error.message || "Failed to convert payday into deposit.");
      return;
    }

    const savedDeposit = normalizeDeposit(mapDepositRowToClient(data));
    setDeposits((prev) => [savedDeposit, ...prev]);

    const updateScheduled = await supabase
      .from("scheduled_paydays")
      .update({
        status: "received",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("user_id", user.id);

    if (updateScheduled.error) {
      setWarning("Deposit logged, but scheduled payday status did not update cleanly.");
    } else {
      setScheduled((prev) => prev.filter((x) => x.id !== item.id));
    }

    if (item.account_id) {
      const routed = await applyDepositToAccount({
        accountId: item.account_id,
        amountValue: item.expected_amount,
        sourceId: deposit.id,
        sourceLabel: item.source || "Paycheck",
        noteText: item.note || "",
      });

      if (!routed.ok) setWarning(routed.message);
    }

    if (item.calendar_event_id) {
      await supabase
        .from("calendar_events")
        .update({
          status: "done",
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.calendar_event_id)
        .eq("user_id", user.id);
    }

    setStatus("Scheduled payday marked received ✅");
  }

  const computed = useMemo(() => {
    const todayIso = isoDate();
    const today = toDateOnly(todayIso) || new Date();
    const targetMonth = viewMonth || monthKeyFromISO(todayIso);

    const monthDeposits = deposits.filter((d) => monthKeyFromISO(d.date) === targetMonth);
    const monthTotal = monthDeposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    const start = startOfMonthDate(targetMonth);
    const dim = start ? daysInMonth(start.getFullYear(), start.getMonth()) : 30;
    const dayNum = start ? clamp(today.getDate(), 1, dim) : 1;
    const daysLeft = Math.max(1, dim - dayNum + 1);

    const goal = parseMoneyInput(goalMonthly);
    const goalNum = Number.isFinite(goal) ? goal : 0;
    const remaining = Math.max(0, goalNum - monthTotal);
    const neededPerDay = daysLeft > 0 ? remaining / daysLeft : remaining;

    const paceToday = goalNum > 0 ? (goalNum * dayNum) / dim : 0;
    const gap = monthTotal - paceToday;
    const behindBy = Math.max(0, -gap);
    const aheadBy = Math.max(0, gap);

    const monthScheduled = scheduled.filter((x) => monthKeyFromISO(x.pay_date) === targetMonth && x.status === "scheduled");
    const projectedMonthDates = computeProjectedPaydaysForMonth({
      monthYM: targetMonth,
      schedule,
      anchorDateISO: anchorDate,
    });

    const recentDeposits = [...deposits]
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return Number(b.createdAt || 0) - Number(a.createdAt || 0);
      })
      .slice(0, 8);

    const upcomingScheduled = [...monthScheduled].sort((a, b) => a.pay_date.localeCompare(b.pay_date));

    const sourceMap = new Map();
    for (const d of monthDeposits) {
      const key = niceSourceLabel(d.source);
      sourceMap.set(key, (sourceMap.get(key) || 0) + Number(d.amount || 0));
    }

    const sourceBreakdown = Array.from(sourceMap.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);

    const last7Start = addDays(today, -6);
    const last7Total = deposits
      .filter((d) => {
        const dd = toDateOnly(d.date);
        return dd && dd >= last7Start && dd <= today;
      })
      .reduce((sum, d) => sum + Number(d.amount || 0), 0);

    const depositStreak = (() => {
      let streak = 0;
      for (let i = 0; i < 60; i += 1) {
        const test = isoDate(addDays(today, -i));
        const has = deposits.some((d) => d.date === test);
        if (has) streak += 1;
        else break;
      }
      return streak;
    })();

    const projectedThisMonth =
      monthTotal +
      monthScheduled.reduce((sum, item) => sum + Number(item.expected_amount || 0), 0) +
      (Number.isFinite(parseMoneyInput(bonusEstimate)) ? parseMoneyInput(bonusEstimate) : 0);

    return {
      goalNum,
      monthTotal,
      remaining,
      neededPerDay,
      paceToday,
      behindBy,
      aheadBy,
      progressPct: pct(monthTotal, goalNum),
      projectedThisMonth,
      projectedPct: pct(projectedThisMonth, goalNum),
      shortByProjection: Math.max(0, goalNum - projectedThisMonth),
      recentDeposits,
      upcomingScheduled,
      sourceBreakdown,
      projectedMonthDates,
      last7Total,
      depositStreak,
    };
  }, [deposits, scheduled, viewMonth, goalMonthly, bonusEstimate, schedule, anchorDate]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top right, rgba(148,163,184,.14), transparent 30%), linear-gradient(180deg, #07101e, #050913)",
          color: "white",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 1500, margin: "0 auto" }}>
          <div style={{ ...panelStyle, padding: 24 }}>Loading income…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top right, rgba(148,163,184,.14), transparent 30%), linear-gradient(180deg, #07101e, #050913)",
          color: "white",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 1500, margin: "0 auto" }}>
          <div style={{ ...panelStyle, padding: 24 }}>
            <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 10 }}>Income Command</div>
            <div style={{ color: C.textSoft }}>You need to log in to use this page.</div>
          </div>
        </div>
      </div>
    );
  }

  const mainBg = {
    minHeight: "100vh",
    color: "white",
    background: `
      radial-gradient(circle at top right, rgba(148,163,184,.12), transparent 28%),
      radial-gradient(circle at left 35%, rgba(34,197,94,.05), transparent 24%),
      linear-gradient(180deg, ${C.bgTop}, ${C.bgBottom})
    `,
    padding: 24,
  };

  return (
    <div style={mainBg}>
      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 18 }}>
        {/* header */}
        <div style={{ ...panelStyle, padding: 22 }}>
          <SectionTitle
            eyebrow="Income"
            title="Income Command"
            sub="Track what came in, what is still coming, and where deposits landed."
            right={
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={pillStyle(C.neutralSoft, "rgba(148,163,184,.24)", C.text)}>Viewing: {fmtMonthLabel(viewMonth)}</div>
                <SoftButton onClick={() => setSettingsOpen((v) => !v)} style={{ minWidth: 56 }}>
                  ...
                </SoftButton>
              </div>
            }
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            {status ? <div style={pillStyle(C.greenSoft, "rgba(34,197,94,.28)", "#dbffe8")}>{status}</div> : null}
            {warning ? <div style={pillStyle(C.amberSoft, "rgba(245,158,11,.28)", "#fff1cc")}>{warning}</div> : null}
            {pageError ? <div style={pillStyle(C.redSoft, "rgba(239,68,68,.28)", "#ffdede")}>{pageError}</div> : null}
          </div>

          {settingsOpen ? (
            <div
              style={{
                marginTop: 18,
                ...cardStyle,
                padding: 18,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.03))",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 900, color: C.text, marginBottom: 14 }}>Income settings</div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Monthly target</div>
                  <input value={goalMonthly} onChange={(e) => setGoalMonthly(e.target.value)} style={inputStyle} placeholder="8000" />
                </div>

                <div>
                  <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Pay schedule</div>
                  <select value={schedule} onChange={(e) => setSchedule(e.target.value)} style={inputStyle}>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Biweekly</option>
                    <option value="TWICE_MONTHLY">Twice monthly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>

                <div>
                  <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Anchor payday</div>
                  <input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} style={inputStyle} />
                </div>

                <div>
                  <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Default paycheck</div>
                  <input value={paycheckAmt} onChange={(e) => setPaycheckAmt(e.target.value)} style={inputStyle} placeholder="2000" />
                </div>

                <div>
                  <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Bonus estimate</div>
                  <input value={bonusEstimate} onChange={(e) => setBonusEstimate(e.target.value)} style={inputStyle} placeholder="0" />
                </div>

                <div>
                  <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Default account</div>
                  <select value={defaultAccountId} onChange={(e) => setDefaultAccountId(e.target.value)} style={inputStyle}>
                    <option value="">No default</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Calendar profile</div>
                  <select value={defaultProfileId} onChange={(e) => setDefaultProfileId(e.target.value)} style={inputStyle}>
                    <option value="">No default</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Payday event time</div>
                  <input type="time" value={paydayEventTime} onChange={(e) => setPaydayEventTime(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}>
                <label style={{ display: "inline-flex", gap: 10, alignItems: "center", color: C.textSoft }}>
                  <input
                    type="checkbox"
                    checked={autoCreateCalendar}
                    onChange={(e) => setAutoCreateCalendar(e.target.checked)}
                  />
                  Auto-create payday calendar events
                </label>

                <SoftButton onClick={() => setSettingsOpen(false)}>Close</SoftButton>
                <PrimaryButton onClick={saveSettings}>Save settings</PrimaryButton>
              </div>
            </div>
          ) : null}
        </div>

        {/* hero stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          <HeroStat
            label="Received this month"
            value={money(computed.monthTotal)}
            sub="Actual deposited income"
            tone="good"
          />
          <HeroStat
            label="Left to target"
            value={money(computed.remaining)}
            sub={computed.remaining > 0 ? "Still needed this month" : "Target cleared"}
            tone={computed.remaining > 0 ? "warn" : "good"}
          />
          <HeroStat
            label="Projected finish"
            value={money(computed.projectedThisMonth)}
            sub={
              computed.shortByProjection > 0
                ? `Short by ${money(computed.shortByProjection)}`
                : "Projection clears target"
            }
            tone={computed.shortByProjection > 0 ? "warn" : "good"}
          />
          <HeroStat
            label="Pace gap"
            value={computed.behindBy > 0 ? `-${money(computed.behindBy)}` : `+${money(computed.aheadBy)}`}
            sub={computed.behindBy > 0 ? "Behind pace" : "Ahead of pace"}
            tone={computed.behindBy > 0 ? "bad" : "good"}
          />
        </div>

        {/* progress block */}
        <div style={{ ...panelStyle, padding: 18, display: "grid", gap: 16 }}>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 20 }}>Month progress</div>

          <ProgressRow
            label="Actual progress"
            value={`${money(computed.monthTotal)} / ${money(computed.goalNum)}`}
            pctValue={computed.progressPct}
            tone={computed.behindBy > 0 ? "warn" : "good"}
            sub={
              computed.remaining > 0
                ? `${money(computed.remaining)} left to target`
                : "You are at or above target"
            }
          />

          <ProgressRow
            label="Projected finish line"
            value={money(computed.projectedThisMonth)}
            pctValue={computed.projectedPct}
            tone={computed.shortByProjection > 0 ? "warn" : "good"}
            sub={
              computed.shortByProjection > 0
                ? `Current schedule still leaves you short`
                : "Current schedule clears the target"
            }
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ ...cardStyle, padding: 14 }}>
              <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Need per day</div>
              <div style={{ color: C.text, fontSize: 28, fontWeight: 900 }}>{money(computed.neededPerDay)}</div>
            </div>
            <div style={{ ...cardStyle, padding: 14 }}>
              <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Upcoming paydays</div>
              <div style={{ color: C.text, fontSize: 28, fontWeight: 900 }}>{computed.upcomingScheduled.length}</div>
            </div>
            <div style={{ ...cardStyle, padding: 14 }}>
              <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Last 7 days</div>
              <div style={{ color: C.text, fontSize: 28, fontWeight: 900 }}>{money(computed.last7Total)}</div>
            </div>
            <div style={{ ...cardStyle, padding: 14 }}>
              <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Deposit streak</div>
              <div style={{ color: C.text, fontSize: 28, fontWeight: 900 }}>
                {computed.depositStreak} day{computed.depositStreak === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </div>

        {/* middle section */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 18,
          }}
        >
          {/* upcoming paydays */}
          <div style={{ ...panelStyle, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Planned</div>
                <div style={{ color: C.text, fontSize: 22, fontWeight: 900 }}>Upcoming Paydays</div>
              </div>
              <div style={pillStyle()}>{computed.upcomingScheduled.length} active</div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {computed.upcomingScheduled.length === 0 ? (
                <div style={{ ...cardStyle, padding: 16, color: C.textSoft }}>
                  No scheduled paydays saved yet.
                  <div style={{ color: C.textMute, fontSize: 12, marginTop: 8 }}>
                    Use the quick add section below to schedule the next payday.
                  </div>
                </div>
              ) : (
                computed.upcomingScheduled.map((item) => (
                  <div key={item.id} style={{ ...cardStyle, padding: 16, display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ color: C.text, fontWeight: 900, fontSize: 20 }}>{money(item.expected_amount)}</div>
                        <div style={{ color: C.textSoft, marginTop: 4 }}>
                          {niceSourceLabel(item.source)} • {dateLabel(item.pay_date)}
                        </div>
                        {item.account_name ? (
                          <div style={{ color: C.textMute, fontSize: 12, marginTop: 6 }}>
                            Deposit target: {item.account_name}
                          </div>
                        ) : null}
                        {item.calendar_event_id ? (
                          <div style={{ color: C.textMute, fontSize: 12, marginTop: 6 }}>
                            Calendar linked
                          </div>
                        ) : null}
                        {item.note ? (
                          <div style={{ color: C.textMute, fontSize: 12, marginTop: 6 }}>{item.note}</div>
                        ) : null}
                      </div>

                      <div style={pillStyle(C.amberSoft, "rgba(245,158,11,.28)", "#fff1cc")}>Scheduled</div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <TinyAction tone="good" onClick={() => markScheduledReceived(item)}>
                        Mark received
                      </TinyAction>
                      <TinyAction tone="danger" onClick={() => deleteScheduled(item.id)}>
                        Delete
                      </TinyAction>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Projected dates from settings</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {computed.projectedMonthDates.length ? (
                  computed.projectedMonthDates.map((p) => (
                    <div key={p.id} style={pillStyle("rgba(255,255,255,.045)", "rgba(255,255,255,.08)", C.text)}>
                      {dateLabel(p.pay_date)}
                    </div>
                  ))
                ) : (
                  <div style={{ color: C.textMute }}>No schedule dates available.</div>
                )}
              </div>
            </div>
          </div>

          {/* recent deposits */}
          <div style={{ ...panelStyle, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Received</div>
                <div style={{ color: C.text, fontSize: 22, fontWeight: 900 }}>Recent Deposits</div>
              </div>
              <div style={pillStyle()}>{deposits.length} total</div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {computed.recentDeposits.length === 0 ? (
                <div style={{ ...cardStyle, padding: 16, color: C.textSoft }}>No deposits logged yet.</div>
              ) : (
                computed.recentDeposits.map((d) => (
                  <div key={d.id} style={{ ...cardStyle, padding: 16, display: "grid", gap: 12 }}>
                    {editId === d.id ? (
                      <>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                            gap: 10,
                          }}
                        >
                          <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} style={inputStyle} />
                          <input value={eSource} onChange={(e) => setESource(e.target.value)} style={inputStyle} />
                          <input value={eAmount} onChange={(e) => setEAmount(e.target.value)} style={inputStyle} />
                        </div>
                        <textarea value={eNote} onChange={(e) => setENote(e.target.value)} style={textareaStyle} />
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <TinyAction tone="good" onClick={saveEdit}>Save</TinyAction>
                          <TinyAction onClick={cancelEdit}>Cancel</TinyAction>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                          <div>
                            <div style={{ color: C.text, fontWeight: 900, fontSize: 20 }}>{money(d.amount)}</div>
                            <div style={{ color: C.textSoft, marginTop: 4 }}>
                              {niceSourceLabel(d.source)} • {dateLabel(d.date)}
                            </div>
                            {d.accountName ? (
                              <div style={{ color: C.textMute, fontSize: 12, marginTop: 6 }}>
                                Routed to: {d.accountName}
                              </div>
                            ) : null}
                            {d.note ? (
                              <div style={{ color: C.textMute, fontSize: 12, marginTop: 6 }}>{d.note}</div>
                            ) : null}
                          </div>

                          <div style={pillStyle(C.greenSoft, "rgba(34,197,94,.28)", "#dbffe8")}>Received</div>
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <TinyAction onClick={() => openEdit(d)}>Edit</TinyAction>
                          <TinyAction tone="danger" onClick={() => deleteDeposit(d.id)}>Delete</TinyAction>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* quick add lower */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, .8fr)",
            gap: 18,
          }}
        >
          <div style={{ ...panelStyle, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Action</div>
                <div style={{ color: C.text, fontSize: 22, fontWeight: 900 }}>Quick Add Income</div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TinyAction
                  tone={entryMode === "received" ? "good" : "default"}
                  onClick={() => setEntryMode("received")}
                >
                  Received now
                </TinyAction>
                <TinyAction
                  tone={entryMode === "scheduled" ? "warn" : "default"}
                  onClick={() => setEntryMode("scheduled")}
                >
                  Schedule payday
                </TinyAction>
              </div>
            </div>

            <form onSubmit={addIncome} style={{ display: "grid", gap: 14 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Amount</div>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={inputStyle}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Date</div>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
                </div>

                <div>
                  <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Source</div>
                  <select value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle}>
                    <option value="Paycheck">Paycheck</option>
                    <option value="Bonus">Bonus</option>
                    <option value="Side Job">Side Job</option>
                    <option value="Cash">Cash</option>
                    <option value="Refund">Refund</option>
                    <option value="Other Income">Other Income</option>
                  </select>
                </div>

                <div>
                  <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                    Deposit account
                  </div>
                  <select
                    value={destinationAccountId}
                    onChange={(e) => setDestinationAccountId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Choose account</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Note</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={textareaStyle}
                  placeholder={
                    entryMode === "scheduled"
                      ? "Expected payday note..."
                      : "Optional deposit note..."
                  }
                />
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ display: "inline-flex", gap: 10, alignItems: "center", color: C.textSoft }}>
                  <input
                    type="checkbox"
                    checked={createCalendarEvent}
                    onChange={(e) => setCreateCalendarEvent(e.target.checked)}
                  />
                  {entryMode === "scheduled"
                    ? "Create payday event in calendar"
                    : "Also add payday event to calendar"}
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <PrimaryButton type="submit">
                  {entryMode === "scheduled" ? "Schedule payday" : "Log deposit"}
                </PrimaryButton>
                <SoftButton type="button" onClick={resetQuickAdd}>
                  Reset
                </SoftButton>
              </div>
            </form>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ ...panelStyle, padding: 18 }}>
              <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Breakdown</div>
              <div style={{ color: C.text, fontSize: 22, fontWeight: 900, marginBottom: 14 }}>Income Streams</div>

              <div style={{ display: "grid", gap: 12 }}>
                {computed.sourceBreakdown.length === 0 ? (
                  <div style={{ ...cardStyle, padding: 16, color: C.textSoft }}>No income sources this month.</div>
                ) : (
                  computed.sourceBreakdown.map((row) => {
                    const width = pct(row.total, computed.monthTotal);
                    return (
                      <div key={row.label} style={{ ...cardStyle, padding: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                          <div style={{ color: C.text, fontWeight: 800 }}>{row.label}</div>
                          <div style={{ color: C.textSoft, fontWeight: 800 }}>{money(row.total)}</div>
                        </div>
                        <div
                          style={{
                            height: 12,
                            borderRadius: 999,
                            background: "rgba(255,255,255,.06)",
                            border: `1px solid ${C.border}`,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${clamp(width, 0, 100)}%`,
                              height: "100%",
                              borderRadius: 999,
                              background: C.neutral,
                              boxShadow: "0 0 18px rgba(148,163,184,.35)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ ...panelStyle, padding: 18 }}>
              <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Snapshot</div>
              <div style={{ color: C.text, fontSize: 22, fontWeight: 900, marginBottom: 14 }}>This month in plain English</div>

              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ ...cardStyle, padding: 14 }}>
                  <div style={{ color: C.textMute, fontSize: 12, marginBottom: 8 }}>Current pace</div>
                  <div style={{ color: C.text, fontWeight: 900, fontSize: 22 }}>
                    {computed.behindBy > 0 ? "Behind pace" : "On or ahead"}
                  </div>
                  <div style={{ color: C.textSoft, fontSize: 13, marginTop: 8 }}>
                    {computed.behindBy > 0
                      ? `You are behind the month pace by ${money(computed.behindBy)}.`
                      : `You are ahead of the month pace by ${money(computed.aheadBy)}.`}
                  </div>
                </div>

                <div style={{ ...cardStyle, padding: 14 }}>
                  <div style={{ color: C.textMute, fontSize: 12, marginBottom: 8 }}>Projection</div>
                  <div style={{ color: C.text, fontWeight: 900, fontSize: 22 }}>
                    {computed.shortByProjection > 0 ? "Projection is short" : "Projection clears target"}
                  </div>
                  <div style={{ color: C.textSoft, fontSize: 13, marginTop: 8 }}>
                    {computed.shortByProjection > 0
                      ? `At current scheduled flow, you miss by ${money(computed.shortByProjection)}.`
                      : "At current scheduled flow, you clear the target."}
                  </div>
                </div>

                <div style={{ ...cardStyle, padding: 14 }}>
                  <div style={{ color: C.textMute, fontSize: 12, marginBottom: 8 }}>Need from here</div>
                  <div style={{ color: C.text, fontWeight: 900, fontSize: 22 }}>{money(computed.remaining)}</div>
                  <div style={{ color: C.textSoft, fontSize: 13, marginTop: 8 }}>
                    That is about {money(computed.neededPerDay)} per remaining day.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* month switcher */}
        <div style={{ ...panelStyle, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ color: C.textMute, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>View control</div>
              <div style={{ color: C.text, fontSize: 18, fontWeight: 900 }}>Month focus</div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input type="month" value={viewMonth} onChange={(e) => setViewMonth(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}