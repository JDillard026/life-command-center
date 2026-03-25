"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/* =========================================================
   LIFE COMMAND CENTER — INCOME COMMAND
   Rewritten to match the screenshot structure:
   - hero banner
   - 4 top stat cards
   - big left board
   - stacked right rail action panels
   - keeps income logic, scheduled paydays, account routing,
     and optional calendar event creation
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

/* ---------------------- defaults + mapping ---------------------- */
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

/* ---------------------- small ui helpers ---------------------- */
function toneColor(tone) {
  if (tone === "green") return "#66f0a3";
  if (tone === "amber") return "#ffcb6b";
  if (tone === "red") return "#ff8e8e";
  if (tone === "blue") return "#86b7ff";
  return "#d7e0f4";
}

function toneBg(tone) {
  if (tone === "green") return "rgba(58, 194, 120, 0.14)";
  if (tone === "amber") return "rgba(245, 158, 11, 0.16)";
  if (tone === "red") return "rgba(239, 68, 68, 0.16)";
  if (tone === "blue") return "rgba(96, 165, 250, 0.16)";
  return "rgba(255,255,255,0.06)";
}

function TonePill({ children, tone = "default" }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        border: `1px solid ${tone === "default" ? "rgba(255,255,255,.10)" : toneColor(tone)}33`,
        background: toneBg(tone),
        color: toneColor(tone),
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: ".02em",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function ActionButton({ children, tone = "default", ...props }) {
  const map = {
    default: {
      bg: "rgba(255,255,255,.055)",
      border: "rgba(255,255,255,.10)",
      color: "#eef4ff",
    },
    blue: {
      bg: "linear-gradient(180deg, rgba(44,92,190,.82), rgba(25,53,118,.88))",
      border: "rgba(139,172,255,.35)",
      color: "#ffffff",
    },
    green: {
      bg: "rgba(34,197,94,.14)",
      border: "rgba(34,197,94,.30)",
      color: "#ddffe8",
    },
    red: {
      bg: "rgba(239,68,68,.14)",
      border: "rgba(239,68,68,.30)",
      color: "#ffdede",
    },
    amber: {
      bg: "rgba(245,158,11,.14)",
      border: "rgba(245,158,11,.30)",
      color: "#fff0c7",
    },
  };

  const s = map[tone] || map.default;

  return (
    <button
      {...props}
      style={{
        height: 42,
        padding: "0 15px",
        borderRadius: 14,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.color,
        fontWeight: 800,
        fontSize: 14,
        cursor: "pointer",
        boxShadow: tone === "blue" ? "0 10px 28px rgba(30,64,175,.35)" : "none",
        transition: "0.18s ease",
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, sub, tone = "default" }) {
  return (
    <div className="statCard">
      <div
        className="statGlow"
        style={{
          background:
            tone === "green"
              ? "radial-gradient(circle at top right, rgba(34,197,94,.16), transparent 48%)"
              : tone === "amber"
              ? "radial-gradient(circle at top right, rgba(245,158,11,.16), transparent 48%)"
              : tone === "red"
              ? "radial-gradient(circle at top right, rgba(239,68,68,.16), transparent 48%)"
              : "radial-gradient(circle at top right, rgba(96,165,250,.16), transparent 48%)",
        }}
      />
      <div
        className="statTopLine"
        style={{
          background:
            tone === "green"
              ? "#66f0a3"
              : tone === "amber"
              ? "#ffcb6b"
              : tone === "red"
              ? "#ff8e8e"
              : "#8db8ff",
        }}
      />
      <div className="eyebrow">{label}</div>
      <div className="statValue">{value}</div>
      <div className="subtleText">{sub}</div>
    </div>
  );
}

function DetailTile({ label, value }) {
  return (
    <div className="detailTile">
      <div className="detailLabel">{label}</div>
      <div className="detailValue">{value || "—"}</div>
    </div>
  );
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
  const [pageMode, setPageMode] = useState("overview");

  /* settings */
  const [goalMonthly, setGoalMonthly] = useState(String(DEFAULT_SETTINGS.goalMonthly));
  const [schedule, setSchedule] = useState(DEFAULT_SETTINGS.schedule);
  const [anchorDate, setAnchorDate] = useState(DEFAULT_SETTINGS.anchorDate);
  const [paycheckAmt, setPaycheckAmt] = useState(String(DEFAULT_SETTINGS.paycheckAmt));
  const [bonusEstimate, setBonusEstimate] = useState(String(DEFAULT_SETTINGS.bonusEstimate));
  const [defaultAccountId, setDefaultAccountId] = useState(DEFAULT_SETTINGS.defaultAccountId);
  const [defaultProfileId, setDefaultProfileId] = useState(DEFAULT_SETTINGS.defaultProfileId);
  const [autoCreateCalendar, setAutoCreateCalendar] = useState(DEFAULT_SETTINGS.autoCreateCalendar);
  const [paydayEventTime, setPaydayEventTime] = useState(DEFAULT_SETTINGS.paydayEventTime);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
          setAccounts(
            accountsRes.data.map((row) => ({
              id: String(row.id),
              name: String(row.name || row.account_name || "Account"),
              balance: Number(row.balance ?? 0) || 0,
              accountType: String(row.account_type || ""),
            }))
          );
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

        setStatus("Income loaded");
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

  function resetQuickAdd() {
    setDate(isoDate());
    setSource("Paycheck");
    setAmount("");
    setNote("");
    setDestinationAccountId(defaultAccountId || "");
    setCreateCalendarEvent(false);
    setEntryMode("received");
  }

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

      setStatus("Income settings saved");
      setSettingsOpen(false);
      setDestinationAccountId(defaultAccountId || "");
    } catch (err) {
      setPageError(err?.message || "Failed to save income settings.");
    }
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
        message: `Payday scheduled.${calendarMsg}`,
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

    setStatus(`Income logged.${accountMsg}`);
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
    setStatus("Deposit updated.");
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
    setDeposits((prev) =>
      [savedDeposit, ...prev].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return Number(b.createdAt || 0) - Number(a.createdAt || 0);
      })
    );

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

    setStatus("Scheduled payday marked received.");
  }

  const computed = useMemo(() => {
    const todayIso = isoDate();
    const today = toDateOnly(todayIso) || new Date();
    const targetMonth = viewMonth || monthKeyFromISO(todayIso);

    const monthDeposits = deposits.filter((d) => monthKeyFromISO(d.date) === targetMonth);
    const monthScheduled = scheduled.filter((x) => monthKeyFromISO(x.pay_date) === targetMonth && x.status === "scheduled");

    const monthTotal = monthDeposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const scheduledMonthTotal = monthScheduled.reduce((sum, d) => sum + (Number(d.expected_amount) || 0), 0);

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

    const recentDeposits = [...deposits].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });

    const upcomingScheduled = [...monthScheduled].sort((a, b) => a.pay_date.localeCompare(b.pay_date));

    const projectedMonthDates = computeProjectedPaydaysForMonth({
      monthYM: targetMonth,
      schedule,
      anchorDateISO: anchorDate,
    });

    const sourceMap = new Map();
    for (const d of monthDeposits) {
      const key = niceSourceLabel(d.source);
      sourceMap.set(key, (sourceMap.get(key) || 0) + Number(d.amount || 0));
    }

    const sourceBreakdown = Array.from(sourceMap.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);

    const projectedThisMonth =
      monthTotal +
      scheduledMonthTotal +
      (Number.isFinite(parseMoneyInput(bonusEstimate)) ? parseMoneyInput(bonusEstimate) : 0);

    const nextPayday = [...scheduled]
      .filter((x) => x.status === "scheduled")
      .sort((a, b) => a.pay_date.localeCompare(b.pay_date))[0] || null;

    const depositCountThisMonth = monthDeposits.length;
    const avgDeposit = depositCountThisMonth ? monthTotal / depositCountThisMonth : 0;

    return {
      monthDeposits,
      monthScheduled,
      monthTotal,
      scheduledMonthTotal,
      goalNum,
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
      nextPayday,
      depositCountThisMonth,
      avgDeposit,
    };
  }, [deposits, scheduled, viewMonth, goalMonthly, bonusEstimate, schedule, anchorDate]);

  const visibleDeposits =
    pageMode === "manage" ? computed.recentDeposits : computed.recentDeposits.slice(0, 5);

  const visibleScheduled =
    pageMode === "manage" ? computed.upcomingScheduled : computed.upcomingScheduled.slice(0, 4);

  const defaultAccountName =
    accounts.find((a) => String(a.id) === String(defaultAccountId))?.name || "No default account";

  if (loading) {
    return (
      <div className="incomePage">
        <div className="pageShell">
          <div className="panel heroPanel">Loading income…</div>
          <style jsx>{styles}</style>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="incomePage">
        <div className="pageShell">
          <div className="panel heroPanel">
            <div className="heroTitle">Income Command</div>
            <div className="heroSub">You need to log in to use this page.</div>
          </div>
          <style jsx>{styles}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="incomePage">
      <div className="pageShell">
        <section className="panel heroPanel">
          <div className="heroRow">
            <div>
              <div className="eyebrow">income control</div>
              <div className="heroTitle">Income Command</div>
              <div className="heroSub">
                Real deposits, payday planning, income routing, and target pace in one cleaner base page.
              </div>

              <div className="chipRow" style={{ marginTop: 18 }}>
                <TonePill tone="default">{computed.depositCountThisMonth} deposits</TonePill>
                <TonePill tone="blue">{visibleScheduled.length} scheduled</TonePill>
                <TonePill tone="green">default: {defaultAccountName}</TonePill>
              </div>
            </div>

            <div className="heroRight">
              <div className="segmentWrap">
                <button
                  className={`segmentBtn ${pageMode === "overview" ? "active" : ""}`}
                  onClick={() => setPageMode("overview")}
                >
                  Overview
                </button>
                <button
                  className={`segmentBtn ${pageMode === "manage" ? "active" : ""}`}
                  onClick={() => setPageMode("manage")}
                >
                  Manage
                </button>
              </div>

              <div className="monthPickerWrap">
                <div className="fieldLabel">Month</div>
                <input
                  type="month"
                  value={viewMonth}
                  onChange={(e) => setViewMonth(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          {(status || warning || pageError) && (
            <div className="chipRow" style={{ marginTop: 18 }}>
              {status ? <TonePill tone="green">{status}</TonePill> : null}
              {warning ? <TonePill tone="amber">{warning}</TonePill> : null}
              {pageError ? <TonePill tone="red">{pageError}</TonePill> : null}
            </div>
          )}
        </section>

        <div className="statsGrid">
          <StatCard
            label="Received This Month"
            value={money(computed.monthTotal)}
            sub="Actual deposited income."
            tone="green"
          />
          <StatCard
            label="Scheduled This Month"
            value={money(computed.scheduledMonthTotal)}
            sub="Still planned but not received."
            tone="blue"
          />
          <StatCard
            label="Next Payday"
            value={computed.nextPayday ? money(computed.nextPayday.expected_amount) : "—"}
            sub={
              computed.nextPayday
                ? `${niceSourceLabel(computed.nextPayday.source)} • ${dateLabel(computed.nextPayday.pay_date)}`
                : "No payday scheduled."
            }
            tone="amber"
          />
          <StatCard
            label="Projected Finish"
            value={money(computed.projectedThisMonth)}
            sub={
              computed.shortByProjection > 0
                ? `Short by ${money(computed.shortByProjection)}`
                : "Projection clears target."
            }
            tone={computed.shortByProjection > 0 ? "red" : "green"}
          />
        </div>

        <div className="contentGrid">
          <div className="mainCol">
            <section className="panel boardPanel">
              <div className="boardHead">
                <div>
                  <div className="eyebrow">income board</div>
                  <div className="panelTitle">Income Board</div>
                  <div className="panelSub">
                    Received flow, scheduled paydays, deposit routing, and edit controls built in.
                  </div>
                </div>

                <div className="chipRow">
                  <TonePill tone={computed.behindBy > 0 ? "amber" : "green"}>
                    {computed.behindBy > 0 ? "behind pace" : "ahead of pace"}
                  </TonePill>
                  <TonePill tone="default">{fmtMonthLabel(viewMonth)}</TonePill>
                </div>
              </div>

              <div className="boardSection">
                <div className="sectionMiniHead">
                  <div>
                    <div className="sectionMiniTitle">Received Flow</div>
                    <div className="sectionMiniSub">
                      {pageMode === "manage" ? "All logged deposits." : "Most recent deposits."}
                    </div>
                  </div>
                  <TonePill tone="green">{computed.recentDeposits.length} total</TonePill>
                </div>

                <div className="cardStack">
                  {visibleDeposits.length === 0 ? (
                    <div className="emptyCard">No deposits logged yet.</div>
                  ) : (
                    visibleDeposits.map((d) => {
                      const sharePct = clamp(pct(d.amount, Math.max(computed.monthTotal, 1)), 0, 100);

                      return (
                        <div className="recordCard" key={d.id}>
                          {editId === d.id ? (
                            <>
                              <div className="recordEditGrid">
                                <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} className="input" />
                                <input value={eSource} onChange={(e) => setESource(e.target.value)} className="input" placeholder="Source" />
                                <input value={eAmount} onChange={(e) => setEAmount(e.target.value)} className="input" placeholder="Amount" />
                              </div>

                              <textarea
                                value={eNote}
                                onChange={(e) => setENote(e.target.value)}
                                className="textarea"
                                placeholder="Deposit note"
                              />

                              <div className="actionRow">
                                <ActionButton tone="blue" onClick={saveEdit}>Save Deposit</ActionButton>
                                <ActionButton onClick={cancelEdit}>Cancel</ActionButton>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="recordTop">
                                <div>
                                  <div className="recordTitle">{niceSourceLabel(d.source)}</div>
                                  <div className="recordMeta">
                                    Received • {dateLabel(d.date)}
                                  </div>
                                </div>

                                <div className="recordValueBlock">
                                  <div className="recordValue">{money(d.amount)}</div>
                                  <div className="recordMeta">{sharePct.toFixed(0)}% share</div>
                                </div>
                              </div>

                              <div className="barTrack">
                                <div className="barFill green" style={{ width: `${sharePct}%` }} />
                              </div>

                              <div className="detailGrid">
                                <DetailTile label="Date" value={dateLabel(d.date)} />
                                <DetailTile label="Deposit Account" value={d.accountName || "Not routed"} />
                                <DetailTile label="Status" value="Received" />
                                <DetailTile label="Note" value={d.note || "No note"} />
                              </div>

                              <div className="actionRow">
                                <ActionButton tone="blue" onClick={() => openEdit(d)}>Edit</ActionButton>
                                <ActionButton tone="red" onClick={() => deleteDeposit(d.id)}>Delete</ActionButton>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="boardDivider" />

              <div className="boardSection">
                <div className="sectionMiniHead">
                  <div>
                    <div className="sectionMiniTitle">Scheduled Paydays</div>
                    <div className="sectionMiniSub">
                      Active future income waiting to hit.
                    </div>
                  </div>
                  <TonePill tone="amber">{computed.upcomingScheduled.length} active</TonePill>
                </div>

                <div className="cardStack">
                  {visibleScheduled.length === 0 ? (
                    <div className="emptyCard">No scheduled paydays saved yet.</div>
                  ) : (
                    visibleScheduled.map((item) => {
                      const sharePct = clamp(pct(item.expected_amount, Math.max(computed.projectedThisMonth, 1)), 0, 100);

                      return (
                        <div className="recordCard" key={item.id}>
                          <div className="recordTop">
                            <div>
                              <div className="recordTitle">{niceSourceLabel(item.source)}</div>
                              <div className="recordMeta">
                                Scheduled • {dateLabel(item.pay_date)}
                              </div>
                            </div>

                            <div className="recordValueBlock">
                              <div className="recordValue">{money(item.expected_amount)}</div>
                              <div className="recordMeta">{sharePct.toFixed(0)}% share</div>
                            </div>
                          </div>

                          <div className="barTrack">
                            <div className="barFill blue" style={{ width: `${sharePct}%` }} />
                          </div>

                          <div className="detailGrid">
                            <DetailTile label="Pay Date" value={dateLabel(item.pay_date)} />
                            <DetailTile label="Target Account" value={item.account_name || "Not chosen"} />
                            <DetailTile label="Status" value="Scheduled" />
                            <DetailTile label="Note" value={item.note || "No note"} />
                          </div>

                          <div className="actionRow">
                            <ActionButton tone="green" onClick={() => markScheduledReceived(item)}>
                              Mark Received
                            </ActionButton>
                            <ActionButton tone="red" onClick={() => deleteScheduled(item.id)}>
                              Delete
                            </ActionButton>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {computed.projectedMonthDates.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div className="eyebrow" style={{ marginBottom: 10 }}>projected dates from settings</div>
                    <div className="chipRow">
                      {computed.projectedMonthDates.map((p) => (
                        <TonePill key={p.id} tone="default">
                          {dateLabel(p.pay_date)}
                        </TonePill>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="sideCol">
            <section className="panel sidePanel">
              <div className="eyebrow">income action</div>
              <div className="panelTitle">Log Income</div>
              <div className="panelSub">Log a real deposit or schedule a payday from the same box.</div>

              <div className="toggleRow">
                <button
                  className={`miniToggle ${entryMode === "received" ? "activeMini" : ""}`}
                  onClick={() => setEntryMode("received")}
                  type="button"
                >
                  Received
                </button>
                <button
                  className={`miniToggle ${entryMode === "scheduled" ? "activeMini amberMini" : ""}`}
                  onClick={() => setEntryMode("scheduled")}
                  type="button"
                >
                  Scheduled
                </button>
              </div>

              <form onSubmit={addIncome} className="formStack">
                <div className="formGrid">
                  <div>
                    <div className="fieldLabel">Amount</div>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="input"
                      placeholder="0.00"
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <div className="fieldLabel">{entryMode === "scheduled" ? "Pay Date" : "Date"}</div>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
                  </div>

                  <div>
                    <div className="fieldLabel">Source</div>
                    <select value={source} onChange={(e) => setSource(e.target.value)} className="input">
                      <option value="Paycheck">Paycheck</option>
                      <option value="Bonus">Bonus</option>
                      <option value="Side Job">Side Job</option>
                      <option value="Cash">Cash</option>
                      <option value="Refund">Refund</option>
                      <option value="Other Income">Other Income</option>
                    </select>
                  </div>

                  <div>
                    <div className="fieldLabel">Deposit Account</div>
                    <select
                      value={destinationAccountId}
                      onChange={(e) => setDestinationAccountId(e.target.value)}
                      className="input"
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
                  <div className="fieldLabel">Note</div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="textarea"
                    placeholder={entryMode === "scheduled" ? "Expected payday note" : "Optional deposit note"}
                  />
                </div>

                <label className="checkRow">
                  <input
                    type="checkbox"
                    checked={createCalendarEvent}
                    onChange={(e) => setCreateCalendarEvent(e.target.checked)}
                  />
                  <span>
                    {entryMode === "scheduled"
                      ? "Create payday event in calendar"
                      : "Also add payday event to calendar"}
                  </span>
                </label>

                <div className="actionRow">
                  <ActionButton tone="blue" type="submit">
                    {entryMode === "scheduled" ? "Schedule Payday" : "Log Deposit"}
                  </ActionButton>
                  <ActionButton type="button" onClick={resetQuickAdd}>
                    Reset
                  </ActionButton>
                </div>
              </form>
            </section>

            <section className="panel sidePanel">
              <div className="sidePanelHead">
                <div>
                  <div className="eyebrow">settings</div>
                  <div className="panelTitle">Income Settings</div>
                </div>
                <ActionButton
                  type="button"
                  onClick={() => setSettingsOpen((v) => !v)}
                  style={{ height: 38, padding: "0 12px" }}
                >
                  {settingsOpen ? "Hide" : "Open"}
                </ActionButton>
              </div>

              {!settingsOpen ? (
                <div className="detailGrid">
                  <DetailTile label="Monthly Target" value={money(parseMoneyInput(goalMonthly) || 0)} />
                  <DetailTile label="Schedule" value={schedule} />
                  <DetailTile label="Default Paycheck" value={money(parseMoneyInput(paycheckAmt) || 0)} />
                  <DetailTile label="Bonus Estimate" value={money(parseMoneyInput(bonusEstimate) || 0)} />
                </div>
              ) : (
                <div className="formStack">
                  <div className="formGrid">
                    <div>
                      <div className="fieldLabel">Monthly Target</div>
                      <input value={goalMonthly} onChange={(e) => setGoalMonthly(e.target.value)} className="input" />
                    </div>

                    <div>
                      <div className="fieldLabel">Schedule</div>
                      <select value={schedule} onChange={(e) => setSchedule(e.target.value)} className="input">
                        <option value="WEEKLY">Weekly</option>
                        <option value="BIWEEKLY">Biweekly</option>
                        <option value="TWICE_MONTHLY">Twice Monthly</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </div>

                    <div>
                      <div className="fieldLabel">Anchor Payday</div>
                      <input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} className="input" />
                    </div>

                    <div>
                      <div className="fieldLabel">Default Paycheck</div>
                      <input value={paycheckAmt} onChange={(e) => setPaycheckAmt(e.target.value)} className="input" />
                    </div>

                    <div>
                      <div className="fieldLabel">Bonus Estimate</div>
                      <input value={bonusEstimate} onChange={(e) => setBonusEstimate(e.target.value)} className="input" />
                    </div>

                    <div>
                      <div className="fieldLabel">Default Account</div>
                      <select value={defaultAccountId} onChange={(e) => setDefaultAccountId(e.target.value)} className="input">
                        <option value="">No default</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="fieldLabel">Calendar Profile</div>
                      <select value={defaultProfileId} onChange={(e) => setDefaultProfileId(e.target.value)} className="input">
                        <option value="">No default</option>
                        {profiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="fieldLabel">Payday Event Time</div>
                      <input type="time" value={paydayEventTime} onChange={(e) => setPaydayEventTime(e.target.value)} className="input" />
                    </div>
                  </div>

                  <label className="checkRow">
                    <input
                      type="checkbox"
                      checked={autoCreateCalendar}
                      onChange={(e) => setAutoCreateCalendar(e.target.checked)}
                    />
                    <span>Auto-create payday calendar events</span>
                  </label>

                  <div className="actionRow">
                    <ActionButton tone="blue" type="button" onClick={saveSettings}>
                      Save Settings
                    </ActionButton>
                    <ActionButton type="button" onClick={() => setSettingsOpen(false)}>
                      Close
                    </ActionButton>
                  </div>
                </div>
              )}
            </section>

            <section className="panel sidePanel">
              <div className="eyebrow">snapshot</div>
              <div className="panelTitle">Income Pulse</div>
              <div className="panelSub">Fast read on the month without digging around.</div>

              <div className="pulseList">
                <div className="pulseItem">
                  <div className="pulseTitle">Target Pace</div>
                  <div className="pulseBody">
                    {computed.behindBy > 0
                      ? `Behind pace by ${money(computed.behindBy)}.`
                      : `Ahead of pace by ${money(computed.aheadBy)}.`}
                  </div>
                </div>

                <div className="pulseItem">
                  <div className="pulseTitle">Still Needed</div>
                  <div className="pulseBody">
                    {computed.remaining > 0
                      ? `${money(computed.remaining)} left this month, about ${money(computed.neededPerDay)} per day.`
                      : "Target already cleared."}
                  </div>
                </div>

                <div className="pulseItem">
                  <div className="pulseTitle">Average Deposit</div>
                  <div className="pulseBody">
                    {computed.depositCountThisMonth > 0
                      ? `${money(computed.avgDeposit)} average across ${computed.depositCountThisMonth} deposits this month.`
                      : "No deposits this month yet."}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="sectionMiniTitle" style={{ marginBottom: 12 }}>Income Streams</div>
                <div className="sourceStack">
                  {computed.sourceBreakdown.length === 0 ? (
                    <div className="emptyCard">No income sources this month.</div>
                  ) : (
                    computed.sourceBreakdown.map((row) => {
                      const width = clamp(pct(row.total, Math.max(computed.monthTotal, 1)), 0, 100);
                      return (
                        <div key={row.label} className="sourceRow">
                          <div className="sourceTop">
                            <div className="sourceLabel">{row.label}</div>
                            <div className="sourceValue">{money(row.total)}</div>
                          </div>
                          <div className="barTrack smallTrack">
                            <div className="barFill neutral" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .incomePage {
    min-height: 100vh;
    padding: 24px;
    color: #eef4ff;
    background:
      radial-gradient(circle at 12% 18%, rgba(44, 92, 190, 0.10), transparent 22%),
      radial-gradient(circle at 85% 20%, rgba(44, 92, 190, 0.10), transparent 26%),
      radial-gradient(circle at 72% 72%, rgba(20, 38, 82, 0.18), transparent 24%),
      linear-gradient(180deg, #030814 0%, #02050f 100%);
  }

  .pageShell {
    max-width: 1540px;
    margin: 0 auto;
    display: grid;
    gap: 18px;
  }

  .panel {
    position: relative;
    overflow: hidden;
    border-radius: 28px;
    border: 1px solid rgba(170, 194, 255, 0.12);
    background:
      linear-gradient(180deg, rgba(10, 16, 31, 0.88), rgba(4, 8, 19, 0.92)),
      radial-gradient(circle at top left, rgba(58, 110, 255, 0.07), transparent 28%);
    box-shadow:
      0 24px 70px rgba(0, 0, 0, 0.42),
      inset 0 1px 0 rgba(255,255,255,0.04);
    backdrop-filter: blur(14px);
  }

  .panel::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01) 16%, rgba(255,255,255,0) 34%);
    opacity: 0.85;
  }

  .heroPanel {
    padding: 26px 26px 24px;
  }

  .heroRow {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
  }

  .heroRight {
    display: grid;
    gap: 12px;
    justify-items: end;
  }

  .heroTitle {
    font-size: clamp(40px, 5vw, 74px);
    line-height: 0.96;
    letter-spacing: -0.05em;
    font-weight: 900;
    color: #f6f7fb;
  }

  .heroSub {
    margin-top: 14px;
    max-width: 850px;
    color: rgba(222, 230, 245, 0.78);
    font-size: 16px;
    line-height: 1.5;
  }

  .eyebrow {
    color: rgba(193, 204, 229, 0.54);
    font-size: 12px;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    font-weight: 700;
  }

  .chipRow {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .segmentWrap {
    display: inline-flex;
    border-radius: 999px;
    padding: 4px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.10);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
  }

  .segmentBtn {
    height: 48px;
    padding: 0 24px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: rgba(229, 235, 247, 0.85);
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
  }

  .segmentBtn.active {
    background: linear-gradient(180deg, rgba(244,247,255,0.98), rgba(220,228,242,0.95));
    color: #111827;
    box-shadow: 0 10px 22px rgba(0,0,0,0.18);
  }

  .monthPickerWrap {
    min-width: 180px;
  }

  .statsGrid {
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .statCard {
    position: relative;
    overflow: hidden;
    min-height: 156px;
    border-radius: 26px;
    border: 1px solid rgba(170, 194, 255, 0.12);
    background:
      linear-gradient(180deg, rgba(7, 12, 25, 0.90), rgba(2, 7, 17, 0.92));
    padding: 18px 20px 18px;
    box-shadow:
      0 18px 48px rgba(0,0,0,0.34),
      inset 0 1px 0 rgba(255,255,255,0.04);
  }

  .statGlow {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .statTopLine {
    position: absolute;
    left: 16px;
    right: 16px;
    top: 0;
    height: 2px;
    border-radius: 999px;
    opacity: 0.95;
  }

  .statValue {
    margin-top: 14px;
    font-size: clamp(28px, 3vw, 46px);
    line-height: 1;
    letter-spacing: -0.05em;
    font-weight: 900;
    color: #f7f9fe;
  }

  .subtleText {
    margin-top: 12px;
    color: rgba(218, 226, 241, 0.72);
    font-size: 14px;
    line-height: 1.45;
  }

  .contentGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(340px, 0.9fr);
    gap: 18px;
    align-items: start;
  }

  .mainCol,
  .sideCol {
    min-width: 0;
  }

  .sideCol {
    display: grid;
    gap: 18px;
  }

  .boardPanel {
    padding: 22px;
  }

  .sidePanel {
    padding: 22px;
  }

  .boardHead,
  .sidePanelHead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 14px;
    flex-wrap: wrap;
  }

  .panelTitle {
    margin-top: 6px;
    font-size: 28px;
    line-height: 1;
    letter-spacing: -0.04em;
    font-weight: 900;
    color: #f5f7fc;
  }

  .panelSub {
    margin-top: 10px;
    color: rgba(219, 227, 241, 0.70);
    font-size: 14px;
    line-height: 1.45;
  }

  .boardSection {
    margin-top: 22px;
  }

  .boardDivider {
    height: 1px;
    margin: 24px 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent);
  }

  .sectionMiniHead {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .sectionMiniTitle {
    font-size: 18px;
    font-weight: 900;
    color: #f4f7ff;
  }

  .sectionMiniSub {
    margin-top: 4px;
    color: rgba(219, 227, 241, 0.65);
    font-size: 13px;
  }

  .cardStack {
    display: grid;
    gap: 14px;
  }

  .recordCard {
    border-radius: 22px;
    border: 1px solid rgba(170, 194, 255, 0.10);
    background:
      linear-gradient(180deg, rgba(7, 12, 25, 0.80), rgba(4, 7, 16, 0.86));
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.04),
      0 14px 34px rgba(0,0,0,0.22);
    padding: 16px;
  }

  .recordTop {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: flex-start;
  }

  .recordTitle {
    font-size: 18px;
    font-weight: 900;
    color: #f5f7fc;
    letter-spacing: -0.02em;
  }

  .recordMeta {
    margin-top: 6px;
    color: rgba(213, 221, 236, 0.70);
    font-size: 13px;
  }

  .recordValueBlock {
    text-align: right;
  }

  .recordValue {
    font-size: 20px;
    line-height: 1;
    font-weight: 900;
    color: #f5f8ff;
  }

  .barTrack {
    margin-top: 14px;
    width: 100%;
    height: 12px;
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid rgba(170, 194, 255, 0.10);
    background: rgba(255,255,255,0.045);
  }

  .smallTrack {
    height: 10px;
    margin-top: 10px;
  }

  .barFill {
    height: 100%;
    border-radius: 999px;
  }

  .barFill.green {
    background: linear-gradient(90deg, #58e79d, #9effcf);
    box-shadow: 0 0 18px rgba(88, 231, 157, 0.45);
  }

  .barFill.blue {
    background: linear-gradient(90deg, #6ea7ff, #b3d1ff);
    box-shadow: 0 0 18px rgba(110, 167, 255, 0.45);
  }

  .barFill.neutral {
    background: linear-gradient(90deg, #7d9fff, #ccd8ff);
    box-shadow: 0 0 18px rgba(125, 159, 255, 0.32);
  }

  .detailGrid {
    margin-top: 14px;
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detailTile {
    border-radius: 16px;
    border: 1px solid rgba(170, 194, 255, 0.08);
    background: rgba(255,255,255,0.035);
    padding: 12px;
    min-width: 0;
  }

  .detailLabel {
    color: rgba(193, 204, 229, 0.56);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .detailValue {
    color: #f4f8ff;
    font-weight: 800;
    font-size: 15px;
    line-height: 1.35;
    word-break: break-word;
  }

  .actionRow {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 14px;
  }

  .formStack {
    margin-top: 16px;
    display: grid;
    gap: 14px;
  }

  .formGrid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .fieldLabel {
    color: rgba(193, 204, 229, 0.58);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .input,
  .textarea {
    width: 100%;
    border-radius: 16px;
    border: 1px solid rgba(170, 194, 255, 0.12);
    background: rgba(255,255,255,0.04);
    color: #f3f7ff;
    outline: none;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
  }

  .input {
    height: 48px;
    padding: 0 14px;
  }

  .textarea {
    min-height: 96px;
    padding: 12px 14px;
    resize: vertical;
  }

  .input::placeholder,
  .textarea::placeholder {
    color: rgba(193, 204, 229, 0.46);
  }

  .input option {
    background: #09111f;
    color: #eef4ff;
  }

  .toggleRow {
    margin-top: 16px;
    display: inline-flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .miniToggle {
    height: 38px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.05);
    color: rgba(233, 238, 247, 0.86);
    font-weight: 800;
    cursor: pointer;
  }

  .activeMini {
    background: rgba(34,197,94,0.14);
    border-color: rgba(34,197,94,0.30);
    color: #ddffe8;
  }

  .amberMini.activeMini {
    background: rgba(245,158,11,0.14);
    border-color: rgba(245,158,11,0.30);
    color: #fff0c7;
  }

  .checkRow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: rgba(222, 230, 245, 0.80);
    font-size: 14px;
  }

  .pulseList,
  .sourceStack {
    display: grid;
    gap: 12px;
    margin-top: 16px;
  }

  .pulseItem,
  .sourceRow,
  .emptyCard {
    border-radius: 18px;
    border: 1px solid rgba(170, 194, 255, 0.08);
    background: rgba(255,255,255,0.035);
    padding: 14px;
  }

  .pulseTitle {
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(193, 204, 229, 0.58);
    font-weight: 700;
    margin-bottom: 8px;
  }

  .pulseBody {
    color: #eef4ff;
    font-size: 14px;
    line-height: 1.5;
    font-weight: 700;
  }

  .sourceTop {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
  }

  .sourceLabel {
    color: #f1f6ff;
    font-weight: 800;
  }

  .sourceValue {
    color: rgba(225, 233, 246, 0.84);
    font-weight: 800;
  }

  .recordEditGrid {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media (max-width: 1220px) {
    .statsGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .contentGrid {
      grid-template-columns: 1fr;
    }

    .heroRow {
      flex-direction: column;
      align-items: stretch;
    }

    .heroRight {
      justify-items: start;
    }
  }

  @media (max-width: 760px) {
    .incomePage {
      padding: 14px;
    }

    .heroPanel,
    .boardPanel,
    .sidePanel {
      padding: 16px;
      border-radius: 22px;
    }

    .panel {
      border-radius: 22px;
    }

    .statsGrid {
      grid-template-columns: 1fr;
    }

    .formGrid,
    .detailGrid,
    .recordEditGrid {
      grid-template-columns: 1fr;
    }

    .segmentWrap {
      width: 100%;
    }

    .segmentBtn {
      flex: 1 1 0;
      width: 100%;
    }

    .monthPickerWrap {
      min-width: 0;
      width: 100%;
    }

    .heroTitle {
      font-size: 48px;
    }

    .recordTop,
    .boardHead,
    .sidePanelHead,
    .sectionMiniHead,
    .sourceTop {
      flex-direction: column;
      align-items: stretch;
    }

    .recordValueBlock {
      text-align: left;
    }
  }
`;