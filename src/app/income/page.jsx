"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { writeIncomeDepositSplits, writeAccountDelta } from "@/lib/accountLedger";

export const dynamic = "force-dynamic";

/* =========================================================
   LIFE COMMAND CENTER — INCOME COMMAND
   Phase 2 cleanup rewrite
   - restore clean income page structure
   - keep deposits / scheduled paydays / accounts aligned
   - route account posting through shared ledger helper
   - keep calendar sync source-owned and safe
   - make the page feel like one real product on mobile + desktop
   ========================================================= */

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

function sortDeposits(list = []) {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });
}

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
    out.push({ id: `proj-${isoDate(iter)}`, pay_date: isoDate(iter), projected: true });
    iter = addDays(iter, step);
  }

  return out;
}

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
    goalMonthly: Number.isFinite(Number(row?.goal_monthly)) ? Number(row.goal_monthly) : DEFAULT_SETTINGS.goalMonthly,
    schedule: row?.schedule ? String(row.schedule) : DEFAULT_SETTINGS.schedule,
    anchorDate: row?.anchor_date ? String(row.anchor_date) : DEFAULT_SETTINGS.anchorDate,
    paycheckAmt: Number.isFinite(Number(row?.paycheck_amt)) ? Number(row.paycheck_amt) : DEFAULT_SETTINGS.paycheckAmt,
    bonusEstimate: Number.isFinite(Number(row?.bonus_estimate)) ? Number(row.bonus_estimate) : DEFAULT_SETTINGS.bonusEstimate,
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

function toneClassFromDelta(value) {
  if (value > 0) return "good";
  if (value < 0) return "bad";
  return "neutral";
}

function StatCard({ label, value, sub, tone = "neutral" }) {
  return (
    <div className={`statCard ${tone}`}>
      <div className="statLabel">{label}</div>
      <div className="statValue">{value}</div>
      {sub ? <div className="statSub">{sub}</div> : null}
    </div>
  );
}

function ProgressBar({ label, value, pctValue, tone = "neutral", sub }) {
  return (
    <div className="progressBlock">
      <div className="progressTop">
        <div className="progressLabel">{label}</div>
        <div className="progressValue">{value}</div>
      </div>
      <div className="progressTrack">
        <div className={`progressFill ${tone}`} style={{ width: `${clamp(pctValue, 0, 100)}%` }} />
      </div>
      {sub ? <div className="progressSub">{sub}</div> : null}
    </div>
  );
}

function TinyButton({ children, tone = "default", className = "", ...props }) {
  return (
    <button {...props} className={`tinyBtn ${tone} ${className}`.trim()}>
      {children}
    </button>
  );
}

function MainButton({ children, className = "", variant = "primary", ...props }) {
  return (
    <button {...props} className={`mainBtn ${variant} ${className}`.trim()}>
      {children}
    </button>
  );
}

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

  const [entryMode, setEntryMode] = useState("received");
  const [date, setDate] = useState(isoDate());
  const [source, setSource] = useState("Paycheck");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [createCalendarEvent, setCreateCalendarEvent] = useState(false);

  const [editId, setEditId] = useState("");
  const [eDate, setEDate] = useState(isoDate());
  const [eSource, setESource] = useState("");
  const [eAmount, setEAmount] = useState("");
  const [eNote, setENote] = useState("");

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(""), 3200);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (!warning) return;
    const t = setTimeout(() => setWarning(""), 4200);
    return () => clearTimeout(t);
  }, [warning]);

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

      setStatus("Income settings saved.");
      setSettingsOpen(false);
    } catch (err) {
      setPageError(err?.message || "Failed to save income settings.");
    }
  }

  async function deleteCalendarEventBySource(sourceKey, sourceId) {
    if (!user || !sourceId) return;
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("user_id", user.id)
      .eq("source", sourceKey)
      .eq("source_id", sourceId);

    if (error) throw error;
  }

  async function upsertIncomeCalendarEvent({
    sourceId,
    sourceTable,
    title,
    payDate,
    amountValue,
    noteText,
    statusValue = "scheduled",
    profileIdOverride,
    existingEventId = "",
  }) {
    if (!user || !supabase) return { ok: false, eventId: "", message: "Not logged in." };

    const chosenProfileId =
      String(profileIdOverride || "").trim() ||
      String(defaultProfileId || "").trim() ||
      profiles.find((p) => p.isDefault)?.id ||
      profiles[0]?.id ||
      "";

    if (!chosenProfileId) {
      return { ok: false, eventId: "", message: "No calendar profile found for payday event." };
    }

    const payload = {
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
      status: statusValue,
      color: "#22c55e",
      source: "income",
      source_id: sourceId || null,
      source_table: sourceTable || "income_deposits",
      auto_created: true,
      transaction_type: "income",
      updated_at: new Date().toISOString(),
    };

    try {
      let targetId = existingEventId;

      if (!targetId && sourceId) {
        const { data: existing } = await supabase
          .from("calendar_events")
          .select("id")
          .eq("user_id", user.id)
          .eq("source", "income")
          .eq("source_id", sourceId)
          .maybeSingle();

        targetId = String(existing?.id || "");
      }

      if (targetId) {
        const { error } = await supabase
          .from("calendar_events")
          .update(payload)
          .eq("id", targetId)
          .eq("user_id", user.id);

        if (error) throw error;
        return { ok: true, eventId: targetId, message: "Payday event updated." };
      }

      const insertPayload = { id: uid(), created_at: new Date().toISOString(), ...payload };
      const { data, error } = await supabase.from("calendar_events").insert([insertPayload]).select("id").single();

      if (error) throw error;
      return { ok: true, eventId: String(data?.id || insertPayload.id), message: "Payday event created." };
    } catch {
      return { ok: false, eventId: "", message: "Payday saved, but calendar event helper needs adjustment." };
    }
  }

  async function updateIncomeCalendarEventIfExists({ sourceId, title, payDate, amountValue, noteText }) {
    if (!user || !sourceId) return;

    const { data: existing } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("user_id", user.id)
      .eq("source", "income")
      .eq("source_id", sourceId)
      .maybeSingle();

    if (!existing?.id) return;

    await upsertIncomeCalendarEvent({
      sourceId,
      sourceTable: "income_deposits",
      title,
      payDate,
      amountValue,
      noteText,
      statusValue: "done",
      existingEventId: existing.id,
    });
  }

  async function addDepositLedger({ accountId, accountName, amountValue, sourceId, sourceLabel, noteText, createdAt }) {
    if (!user || !accountId || !Number.isFinite(Number(amountValue)) || Number(amountValue) <= 0) {
      return { ok: true, message: "" };
    }

    try {
      await writeIncomeDepositSplits({
        userId: user.id,
        splits: [{ accountId, amount: Number(amountValue), accountName: accountName || "" }],
        source: sourceLabel || "Income",
        note: noteText || "",
        sourceType: "income_deposit",
        sourceId,
        createdAt,
      });

      setAccounts((prev) =>
        prev.map((a) =>
          String(a.id) === String(accountId)
            ? { ...a, balance: Number(a.balance || 0) + Number(amountValue || 0) }
            : a
        )
      );

      return { ok: true, message: `Posted to ${accountName || "account"}.` };
    } catch (err) {
      return { ok: false, message: err?.message || "Income deposit ledger write failed." };
    }
  }

  async function reverseDepositLedger({ deposit, reasonKind = "income_delete", noteSuffix = "deleted" }) {
    if (!user || !deposit?.accountId || !Number.isFinite(Number(deposit.amount)) || Number(deposit.amount) <= 0) {
      return { ok: true };
    }

    await writeAccountDelta({
      userId: user.id,
      accountId: deposit.accountId,
      delta: -Number(deposit.amount),
      kind: reasonKind,
      amount: Number(deposit.amount),
      note: `${deposit.source || "Income"}${deposit.note ? ` • ${deposit.note}` : ""} • ${noteSuffix}`,
      sourceType: reasonKind,
      sourceId: deposit.id,
      createdAt: new Date().toISOString(),
    });

    setAccounts((prev) =>
      prev.map((a) =>
        String(a.id) === String(deposit.accountId)
          ? { ...a, balance: Number(a.balance || 0) - Number(deposit.amount || 0) }
          : a
      )
    );

    return { ok: true };
  }

  async function createScheduledPayday({ payDate, expectedAmount, src, accountId, noteText, createCalendar }) {
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
      if (error) return { ok: false, message: error.message || "Scheduled payday table is not fully wired yet." };

      let calendarMsg = "";
      let calendarEventId = "";

      if (createCalendar) {
        const cal = await upsertIncomeCalendarEvent({
          sourceId: scheduledId,
          sourceTable: "scheduled_paydays",
          title: src || "Payday",
          payDate,
          amountValue: expectedAmount,
          noteText,
          statusValue: "scheduled",
        });

        if (cal.ok && cal.eventId) {
          calendarEventId = cal.eventId;
          calendarMsg = " Calendar event created.";

          await supabase
            .from("scheduled_paydays")
            .update({ calendar_event_id: cal.eventId, updated_at: new Date().toISOString() })
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

      return { ok: true, message: `Payday scheduled.${calendarMsg}` };
    } catch (err) {
      return { ok: false, message: err?.message || "Scheduled payday helper needs adjustment." };
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
    const createdAtIso = new Date().toISOString();

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
      created_at: createdAtIso,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("income_deposits").insert([row]).select().single();
    if (error) return setPageError(error.message || "Failed to save income deposit.");

    const savedDeposit = normalizeDeposit(mapDepositRowToClient(data));

    let accountMsg = "";

    if (accountId) {
      const routed = await addDepositLedger({
        accountId,
        accountName: account?.name || "",
        amountValue: amt,
        sourceId: deposit.id,
        sourceLabel: src,
        noteText: nt,
        createdAt: createdAtIso,
      });

      if (!routed.ok) {
        await supabase.from("income_deposits").delete().eq("id", deposit.id).eq("user_id", user.id);
        return setPageError(routed.message || "Income deposit ledger write failed.");
      }

      accountMsg = routed.message ? ` ${routed.message}` : "";
    }

    setDeposits((prev) => sortDeposits([savedDeposit, ...prev]));

    if (createCalendarEvent || autoCreateCalendar) {
      const cal = await upsertIncomeCalendarEvent({
        sourceId: deposit.id,
        sourceTable: "income_deposits",
        title: src || "Payday",
        payDate: dt,
        amountValue: amt,
        noteText: nt,
        statusValue: "done",
      });

      if (!cal.ok && cal.message) setWarning((prev) => prev || cal.message);
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

    const existing = deposits.find((x) => x.id === editId);
    if (!existing) return;

    const dt = String(eDate || "").trim();
    const src = String(eSource || "").trim();
    const amt = parseMoneyInput(eAmount);
    const nt = String(eNote || "").trim();

    if (!dt || !src || !Number.isFinite(amt) || amt <= 0) {
      setPageError("Need valid date, source, and amount.");
      return;
    }

    if (existing.accountId && Number(existing.amount) !== Number(amt)) {
      const delta = Number(amt) - Number(existing.amount || 0);

      if (delta !== 0) {
        try {
          await writeAccountDelta({
            userId: user.id,
            accountId: existing.accountId,
            delta,
            kind: "income_edit_adjustment",
            amount: Math.abs(delta),
            note: `${src}${nt ? ` • ${nt}` : ""} • edit adjustment`,
            sourceType: "income_deposit_edit",
            sourceId: existing.id,
            createdAt: new Date().toISOString(),
          });

          setAccounts((prev) =>
            prev.map((a) =>
              String(a.id) === String(existing.accountId)
                ? { ...a, balance: Number(a.balance || 0) + delta }
                : a
            )
          );
        } catch (err) {
          setPageError(err?.message || "Failed to adjust linked account.");
          return;
        }
      }
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
    setDeposits((prev) => sortDeposits(prev.map((x) => (x.id === editId ? saved : x))));
    await updateIncomeCalendarEventIfExists({
      sourceId: editId,
      title: src,
      payDate: dt,
      amountValue: amt,
      noteText: nt,
    });

    setStatus("Deposit updated.");
    cancelEdit();
  }

  async function deleteDeposit(id) {
    if (!user || !supabase) return;
    if (!globalThis.confirm?.("Delete this deposit?")) return;

    const existing = deposits.find((x) => x.id === id);
    if (!existing) return;

    try {
      if (existing.accountId) {
        await reverseDepositLedger({ deposit: existing });
      }

      const { error } = await supabase.from("income_deposits").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;

      await deleteCalendarEventBySource("income", id).catch(() => {});
      setDeposits((list) => list.filter((x) => x.id !== id));
      setStatus("Deposit deleted.");
    } catch (err) {
      setPageError(err?.message || "Failed to delete deposit.");
    }
  }

  async function deleteScheduled(id) {
    if (!user || !supabase) return;
    if (!globalThis.confirm?.("Delete this scheduled payday?")) return;

    const existing = scheduled.find((x) => x.id === id);
    const prev = scheduled;
    setScheduled((list) => list.filter((x) => x.id !== id));

    const { error } = await supabase.from("scheduled_paydays").delete().eq("id", id).eq("user_id", user.id);

    if (error) {
      setScheduled(prev);
      setWarning(error.message || "Could not delete scheduled payday.");
      return;
    }

    if (existing?.calendar_event_id) {
      await supabase.from("calendar_events").delete().eq("id", existing.calendar_event_id).eq("user_id", user.id);
    } else {
      await deleteCalendarEventBySource("income", id).catch(() => {});
    }

    setStatus("Scheduled payday deleted.");
  }

  async function markScheduledReceived(item) {
    if (!user || !supabase) return;

    setPageError("");
    setStatus("");
    setWarning("");

    const depositId = uid();
    const createdAtIso = new Date().toISOString();

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
      created_at: createdAtIso,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("income_deposits").insert([row]).select().single();
    if (error) {
      setPageError(error.message || "Failed to convert payday into deposit.");
      return;
    }

    const savedDeposit = normalizeDeposit(mapDepositRowToClient(data));

    if (item.account_id) {
      const routed = await addDepositLedger({
        accountId: item.account_id,
        accountName: item.account_name || "",
        amountValue: item.expected_amount,
        sourceId: deposit.id,
        sourceLabel: item.source || "Paycheck",
        noteText: item.note || "",
        createdAt: createdAtIso,
      });

      if (!routed.ok) {
        await supabase.from("income_deposits").delete().eq("id", deposit.id).eq("user_id", user.id);
        setPageError(routed.message || "Failed to route payday to account.");
        return;
      }
    }

    const updateScheduled = await supabase
      .from("scheduled_paydays")
      .update({ status: "received", updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("user_id", user.id);

    if (updateScheduled.error) {
      setWarning("Deposit logged, but scheduled payday status did not update cleanly.");
    } else {
      setScheduled((prev) => prev.filter((x) => x.id !== item.id));
    }

    if (item.calendar_event_id) {
      await supabase
        .from("calendar_events")
        .update({ status: "done", updated_at: new Date().toISOString() })
        .eq("id", item.calendar_event_id)
        .eq("user_id", user.id);
    } else {
      await upsertIncomeCalendarEvent({
        sourceId: item.id,
        sourceTable: "scheduled_paydays",
        title: item.source || "Payday",
        payDate: item.pay_date,
        amountValue: item.expected_amount,
        noteText: item.note || "",
        statusValue: "done",
      }).catch(() => {});
    }

    setDeposits((prev) => sortDeposits([savedDeposit, ...prev]));
    setStatus("Scheduled payday marked received.");
  }

  const computed = useMemo(() => {
    const todayIso = isoDate();
    const today = toDateOnly(todayIso) || new Date();
    const targetMonth = viewMonth || monthKeyFromISO(todayIso);

    const monthDeposits = deposits.filter((d) => monthKeyFromISO(d.date) === targetMonth);
    const monthTotal = monthDeposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    const start = startOfMonthDate(targetMonth);
    const dim = start ? daysInMonth(start.getFullYear(), start.getMonth()) : 30;

    const currentMonthKey = monthKeyFromISO(todayIso);

    let dayNum = 1;
    let daysLeft = dim;

    if (targetMonth === currentMonthKey) {
      dayNum = clamp(today.getDate(), 1, dim);
      daysLeft = Math.max(1, dim - dayNum + 1);
    } else if (targetMonth < currentMonthKey) {
      dayNum = dim;
      daysLeft = 0;
    } else {
      dayNum = 0;
      daysLeft = dim;
    }

    const goal = parseMoneyInput(goalMonthly);
    const goalNum = Number.isFinite(goal) ? goal : 0;
    const remaining = Math.max(0, goalNum - monthTotal);
    const neededPerDay = daysLeft > 0 ? remaining / daysLeft : remaining;

    const paceToday = targetMonth === currentMonthKey && goalNum > 0 ? (goalNum * dayNum) / dim : targetMonth < currentMonthKey ? goalNum : 0;
    const gap = monthTotal - paceToday;
    const behindBy = Math.max(0, -gap);
    const aheadBy = Math.max(0, gap);

    const monthScheduled = scheduled.filter((x) => monthKeyFromISO(x.pay_date) === targetMonth && x.status === "scheduled");
    const projectedMonthDates = computeProjectedPaydaysForMonth({
      monthYM: targetMonth,
      schedule,
      anchorDateISO: anchorDate,
    });

    const recentDeposits = sortDeposits(deposits).slice(0, 8);
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
      targetMonth,
    };
  }, [deposits, scheduled, viewMonth, goalMonthly, bonusEstimate, schedule, anchorDate]);

  const projectedOnly = useMemo(() => {
    const scheduledDates = new Set(
      scheduled.filter((x) => x.status === "scheduled").map((x) => x.pay_date)
    );
    return computed.projectedMonthDates.filter((x) => !scheduledDates.has(x.pay_date)).slice(0, 10);
  }, [computed.projectedMonthDates, scheduled]);

  const monthDeposits = useMemo(
    () => sortDeposits(deposits.filter((d) => monthKeyFromISO(d.date) === viewMonth)),
    [deposits, viewMonth]
  );

  if (loading) {
    return (
      <div className="incomePage">
        <div className="incomeShell">
          <section className="panel">
            <div className="panelBody">Loading income…</div>
          </section>
          <style jsx>{styles}</style>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="incomePage">
        <div className="incomeShell">
          <section className="panel">
            <div className="panelBody">
              <div className="eyebrow">Income</div>
              <h1 className="pageTitle">Income Command</h1>
              <p className="pageSub">You need to log in to use this page.</p>
            </div>
          </section>
          <style jsx>{styles}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="incomePage">
      <div className="glow glowA" />
      <div className="glow glowB" />
      <div className="glow glowC" />

      <div className="incomeShell">
        <section className="panel topPanel">
          <div className="headerRow">
            <div className="headerCopy">
              <div className="eyebrow">Income</div>
              <h1 className="pageTitle">Income Command</h1>
              <p className="pageSub">
                Track what came in, what is still coming, and where deposits landed.
              </p>
            </div>

            <div className="headerActions">
              <div className="fieldBlock compact">
                <label className="fieldLabel">Viewing month</label>
                <input
                  type="month"
                  className="input"
                  value={viewMonth}
                  onChange={(e) => setViewMonth(e.target.value)}
                />
              </div>
              <MainButton variant="soft" onClick={() => setSettingsOpen((v) => !v)}>
                {settingsOpen ? "Close settings" : "Settings"}
              </MainButton>
            </div>
          </div>

          {(status || warning || pageError) && (
            <div className="messageRow">
              {status ? <div className="msg good">{status}</div> : null}
              {warning ? <div className="msg warn">{warning}</div> : null}
              {pageError ? <div className="msg bad">{pageError}</div> : null}
            </div>
          )}

          {settingsOpen ? (
            <div className="settingsWrap">
              <div className="sectionMiniTitle">Income settings</div>

              <div className="formGrid formGridSettings">
                <div className="fieldBlock">
                  <label className="fieldLabel">Monthly target</label>
                  <input
                    value={goalMonthly}
                    onChange={(e) => setGoalMonthly(e.target.value)}
                    className="input"
                    placeholder="8000"
                  />
                </div>

                <div className="fieldBlock">
                  <label className="fieldLabel">Pay schedule</label>
                  <select value={schedule} onChange={(e) => setSchedule(e.target.value)} className="input">
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Biweekly</option>
                    <option value="TWICE_MONTHLY">Twice monthly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>

                <div className="fieldBlock">
                  <label className="fieldLabel">Anchor payday</label>
                  <input
                    type="date"
                    value={anchorDate}
                    onChange={(e) => setAnchorDate(e.target.value)}
                    className="input"
                  />
                </div>

                <div className="fieldBlock">
                  <label className="fieldLabel">Default paycheck</label>
                  <input
                    value={paycheckAmt}
                    onChange={(e) => setPaycheckAmt(e.target.value)}
                    className="input"
                    placeholder="2000"
                  />
                </div>

                <div className="fieldBlock">
                  <label className="fieldLabel">Bonus estimate</label>
                  <input
                    value={bonusEstimate}
                    onChange={(e) => setBonusEstimate(e.target.value)}
                    className="input"
                    placeholder="0"
                  />
                </div>

                <div className="fieldBlock">
                  <label className="fieldLabel">Default account</label>
                  <select
                    value={defaultAccountId}
                    onChange={(e) => setDefaultAccountId(e.target.value)}
                    className="input"
                  >
                    <option value="">No default</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fieldBlock">
                  <label className="fieldLabel">Calendar profile</label>
                  <select
                    value={defaultProfileId}
                    onChange={(e) => setDefaultProfileId(e.target.value)}
                    className="input"
                  >
                    <option value="">No default</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fieldBlock">
                  <label className="fieldLabel">Payday event time</label>
                  <input
                    type="time"
                    value={paydayEventTime}
                    onChange={(e) => setPaydayEventTime(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div className="settingsFooter">
                <label className="checkboxLine">
                  <input
                    type="checkbox"
                    checked={autoCreateCalendar}
                    onChange={(e) => setAutoCreateCalendar(e.target.checked)}
                  />
                  <span>Auto-create payday calendar events</span>
                </label>

                <div className="inlineActions">
                  <MainButton variant="soft" onClick={() => setSettingsOpen(false)}>
                    Close
                  </MainButton>
                  <MainButton onClick={saveSettings}>Save settings</MainButton>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="statsGrid">
          <StatCard
            label="Received this month"
            value={money(computed.monthTotal)}
            sub="Actual deposited income"
            tone="good"
          />
          <StatCard
            label="Left to target"
            value={money(computed.remaining)}
            sub={computed.remaining > 0 ? "Still needed this month" : "Target cleared"}
            tone={computed.remaining > 0 ? "warn" : "good"}
          />
          <StatCard
            label="Projected finish"
            value={money(computed.projectedThisMonth)}
            sub={
              computed.shortByProjection > 0
                ? `Short by ${money(computed.shortByProjection)}`
                : "Projection clears target"
            }
            tone={computed.shortByProjection > 0 ? "warn" : "good"}
          />
          <StatCard
            label="Pace gap"
            value={
              computed.behindBy > 0 ? `-${money(computed.behindBy)}` : `+${money(computed.aheadBy)}`
            }
            sub={computed.behindBy > 0 ? "Behind pace" : "Ahead of pace"}
            tone={computed.behindBy > 0 ? "bad" : "good"}
          />
        </section>

        <section className="panel">
          <div className="panelHead">
            <div>
              <div className="panelEyebrow">Month pace</div>
              <div className="panelTitle">Income target progress</div>
            </div>
            <div className="pill">{fmtMonthLabel(viewMonth)}</div>
          </div>

          <div className="progressStack">
            <ProgressBar
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

            <ProgressBar
              label="Projected finish line"
              value={money(computed.projectedThisMonth)}
              pctValue={computed.projectedPct}
              tone={computed.shortByProjection > 0 ? "warn" : "good"}
              sub={
                computed.shortByProjection > 0
                  ? "Current schedule still leaves you short"
                  : "Current schedule clears the target"
              }
            />
          </div>

          <div className="miniStatsGrid">
            <div className="miniStat">
              <div className="miniLabel">Need per day</div>
              <div className="miniValue">{money(computed.neededPerDay)}</div>
            </div>
            <div className="miniStat">
              <div className="miniLabel">Upcoming paydays</div>
              <div className="miniValue">{computed.upcomingScheduled.length}</div>
            </div>
            <div className="miniStat">
              <div className="miniLabel">Last 7 days</div>
              <div className="miniValue">{money(computed.last7Total)}</div>
            </div>
            <div className="miniStat">
              <div className="miniLabel">Deposit streak</div>
              <div className="miniValue">
                {computed.depositStreak} day{computed.depositStreak === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </section>

        <div className="twoColGrid">
          <section className="panel">
            <div className="panelHead">
              <div>
                <div className="panelEyebrow">Planned</div>
                <div className="panelTitle">Upcoming paydays</div>
              </div>
              <div className="pill">{computed.upcomingScheduled.length} active</div>
            </div>

            <div className="cardStack">
              {computed.upcomingScheduled.length === 0 ? (
                <div className="contentCard emptyCard">
                  No scheduled paydays saved yet.
                  <div className="emptySub">
                    Use the quick add section below to schedule the next payday.
                  </div>
                </div>
              ) : (
                computed.upcomingScheduled.map((item) => (
                  <div key={item.id} className="contentCard paydayCard">
                    <div className="cardTop">
                      <div>
                        <div className="amountLine">{money(item.expected_amount)}</div>
                        <div className="metaLine">
                          {niceSourceLabel(item.source)} • {dateLabel(item.pay_date)}
                        </div>
                        {item.account_name ? (
                          <div className="smallMeta">Routes to {item.account_name}</div>
                        ) : null}
                        {item.note ? <div className="smallMeta">{item.note}</div> : null}
                      </div>

                      <div className="cardActions">
                        <TinyButton tone="good" onClick={() => markScheduledReceived(item)}>
                          Mark received
                        </TinyButton>
                        <TinyButton tone="danger" onClick={() => deleteScheduled(item.id)}>
                          Delete
                        </TinyButton>
                      </div>
                    </div>

                    <div className="pillRow">
                      <div className="softPill warn">Scheduled</div>
                      {item.calendar_event_id ? (
                        <div className="softPill blue">{timeLabel(paydayEventTime)}</div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panelHead">
              <div>
                <div className="panelEyebrow">Breakdown</div>
                <div className="panelTitle">Income sources</div>
              </div>
              <div className="pill">{computed.sourceBreakdown.length} sources</div>
            </div>

            <div className="cardStack">
              {computed.sourceBreakdown.length === 0 ? (
                <div className="contentCard emptyCard">
                  No income recorded for {fmtMonthLabel(viewMonth)}.
                </div>
              ) : (
                computed.sourceBreakdown.map((row) => {
                  const width = pct(row.total, computed.monthTotal);
                  return (
                    <div key={row.label} className="contentCard">
                      <div className="rowSpread">
                        <div className="rowTitle">{row.label}</div>
                        <div className="rowValue">{money(row.total)}</div>
                      </div>
                      <div className="progressTrack slim">
                        <div className="progressFill good" style={{ width: `${clamp(width, 0, 100)}%` }} />
                      </div>
                    </div>
                  );
                })
              )}

              <div className="contentCard">
                <div className="smallTitle">Projected payday dates</div>
                <div className="pillRow">
                  {projectedOnly.length ? (
                    projectedOnly.map((p) => (
                      <div key={p.id} className="softPill">
                        {dateLabel(p.pay_date)}
                      </div>
                    ))
                  ) : (
                    <div className="emptySub">All projected dates already have scheduled rows.</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mainWorkGrid">
          <form onSubmit={addIncome} className="panel">
            <div className="panelHead">
              <div>
                <div className="panelEyebrow">Quick add</div>
                <div className="panelTitle">Log or schedule income</div>
              </div>

              <div className="modeSwitch">
                <TinyButton
                  type="button"
                  tone={entryMode === "received" ? "good" : "default"}
                  onClick={() => setEntryMode("received")}
                >
                  Received
                </TinyButton>
                <TinyButton
                  type="button"
                  tone={entryMode === "scheduled" ? "warn" : "default"}
                  onClick={() => setEntryMode("scheduled")}
                >
                  Scheduled
                </TinyButton>
              </div>
            </div>

            <div className="actionStrip">
              <TinyButton
                type="button"
                onClick={() => {
                  if (paycheckAmt) setAmount(String(paycheckAmt));
                  if (!source) setSource("Paycheck");
                }}
              >
                Use default paycheck
              </TinyButton>

              <TinyButton
                type="button"
                onClick={() => {
                  const nextProjected = projectedOnly[0]?.pay_date;
                  if (nextProjected) setDate(nextProjected);
                }}
              >
                Use next projected date
              </TinyButton>

              {defaultAccountId ? (
                <TinyButton type="button" onClick={() => setDestinationAccountId(defaultAccountId)}>
                  Use default account
                </TinyButton>
              ) : null}
            </div>

            <div className="formGrid">
              <div className="fieldBlock">
                <label className="fieldLabel">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
              </div>

              <div className="fieldBlock">
                <label className="fieldLabel">Source</label>
                <input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="input"
                  placeholder="Paycheck"
                />
              </div>

              <div className="fieldBlock">
                <label className="fieldLabel">Amount</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input"
                  placeholder="2000"
                />
              </div>

              <div className="fieldBlock">
                <label className="fieldLabel">Destination account</label>
                <select
                  value={destinationAccountId}
                  onChange={(e) => setDestinationAccountId(e.target.value)}
                  className="input"
                >
                  <option value="">No account routing</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} • {money(a.balance)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="fieldBlock">
              <label className="fieldLabel">Note</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="textarea"
                placeholder="Optional note…"
              />
            </div>

            <div className="formFooter">
              <label className="checkboxLine">
                <input
                  type="checkbox"
                  checked={createCalendarEvent}
                  onChange={(e) => setCreateCalendarEvent(e.target.checked)}
                />
                <span>
                  {entryMode === "scheduled" ? "Create scheduled payday event" : "Create payday event"}
                </span>
              </label>

              <div className="inlineActions">
                <MainButton type="button" variant="soft" onClick={resetQuickAdd}>
                  Reset
                </MainButton>
                <MainButton type="submit">
                  {entryMode === "scheduled" ? "Schedule payday" : "Log income"}
                </MainButton>
              </div>
            </div>
          </form>

          <section className="panel">
            <div className="panelHead">
              <div>
                <div className="panelEyebrow">History</div>
                <div className="panelTitle">Recent deposits</div>
              </div>
              <div className="pill">
                {monthDeposits.length} in {fmtMonthLabel(viewMonth)}
              </div>
            </div>

            {editId ? (
              <div className="editWrap">
                <div className="smallTitle">Edit deposit</div>

                <div className="formGrid threeCol">
                  <input
                    type="date"
                    value={eDate}
                    onChange={(e) => setEDate(e.target.value)}
                    className="input"
                  />
                  <input
                    value={eSource}
                    onChange={(e) => setESource(e.target.value)}
                    className="input"
                    placeholder="Source"
                  />
                  <input
                    value={eAmount}
                    onChange={(e) => setEAmount(e.target.value)}
                    className="input"
                    placeholder="Amount"
                  />
                </div>

                <textarea
                  value={eNote}
                  onChange={(e) => setENote(e.target.value)}
                  className="textarea"
                  placeholder="Note"
                />

                <div className="inlineActions end">
                  <MainButton type="button" variant="soft" onClick={cancelEdit}>
                    Cancel
                  </MainButton>
                  <MainButton type="button" onClick={saveEdit}>
                    Save edit
                  </MainButton>
                </div>
              </div>
            ) : null}

            <div className="cardStack">
              {monthDeposits.length === 0 ? (
                <div className="contentCard emptyCard">
                  No deposits for {fmtMonthLabel(viewMonth)} yet.
                </div>
              ) : (
                monthDeposits.slice(0, 14).map((d) => (
                  <div key={d.id} className="contentCard">
                    <div className="cardTop">
                      <div>
                        <div className="amountLine">{money(d.amount)}</div>
                        <div className="metaLine">
                          {niceSourceLabel(d.source)} • {dateLabel(d.date)}
                        </div>
                        {d.accountName ? <div className="smallMeta">Posted to {d.accountName}</div> : null}
                        {d.note ? <div className="smallMeta">{d.note}</div> : null}
                      </div>

                      <div className="cardActions">
                        <TinyButton onClick={() => openEdit(d)}>Edit</TinyButton>
                        <TinyButton tone="danger" onClick={() => deleteDeposit(d.id)}>
                          Delete
                        </TinyButton>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .incomePage {
    position: relative;
    min-height: 100vh;
    color: rgba(255,255,255,.96);
    background:
      radial-gradient(circle at top right, rgba(96,165,250,.09), transparent 22%),
      radial-gradient(circle at left 35%, rgba(34,197,94,.06), transparent 24%),
      linear-gradient(180deg, #07101e 0%, #050913 100%);
    overflow: hidden;
  }

  .glow {
    position: absolute;
    border-radius: 999px;
    filter: blur(80px);
    pointer-events: none;
    opacity: .55;
  }

  .glowA {
    width: 260px;
    height: 260px;
    right: -40px;
    top: 20px;
    background: rgba(59,130,246,.18);
  }

  .glowB {
    width: 220px;
    height: 220px;
    left: -70px;
    top: 34%;
    background: rgba(34,197,94,.10);
  }

  .glowC {
    width: 280px;
    height: 280px;
    right: 18%;
    bottom: -80px;
    background: rgba(148,163,184,.08);
  }

  .incomeShell {
    position: relative;
    z-index: 1;
    max-width: 1500px;
    margin: 0 auto;
    padding: 24px;
    display: grid;
    gap: 18px;
  }

  .panel {
    background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.03));
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 24px;
    box-shadow: 0 18px 60px rgba(0,0,0,.34);
    backdrop-filter: blur(18px);
    overflow: hidden;
  }

  .panelBody,
  .topPanel,
  .panel > :global(*) {
    position: relative;
  }

  .topPanel,
  .panel {
    padding: 18px;
  }

  .headerRow,
  .panelHead,
  .rowSpread,
  .cardTop,
  .progressTop,
  .formFooter,
  .settingsFooter {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .headerCopy {
    max-width: 720px;
  }

  .eyebrow,
  .panelEyebrow,
  .fieldLabel,
  .statLabel,
  .miniLabel,
  .smallTitle,
  .sectionMiniTitle {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .02em;
    color: rgba(255,255,255,.58);
  }

  .pageTitle {
    margin: 0;
    font-size: 34px;
    line-height: 1;
    letter-spacing: -.04em;
    font-weight: 900;
    color: white;
  }

  .pageSub {
    margin: 10px 0 0;
    color: rgba(255,255,255,.76);
    max-width: 760px;
  }

  .headerActions {
    display: flex;
    gap: 10px;
    align-items: end;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .fieldBlock {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .fieldBlock.compact {
    min-width: 170px;
  }

  .input,
  .textarea,
  .mainBtn,
  .tinyBtn {
    font: inherit;
  }

  .input,
  .textarea {
    width: 100%;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.05);
    color: rgba(255,255,255,.96);
    outline: none;
    transition: border-color .16s ease, background .16s ease, transform .16s ease;
  }

  .input {
    height: 46px;
    padding: 0 14px;
  }

  .textarea {
    min-height: 104px;
    resize: vertical;
    padding: 12px 14px;
  }

  .input:focus,
  .textarea:focus {
    border-color: rgba(255,255,255,.18);
    background: rgba(255,255,255,.07);
  }

  .mainBtn {
    height: 46px;
    border-radius: 14px;
    padding: 0 16px;
    font-weight: 800;
    border: 1px solid rgba(255,255,255,.12);
    cursor: pointer;
    transition: transform .14s ease, background .14s ease, border-color .14s ease;
    white-space: nowrap;
  }

  .mainBtn:hover,
  .tinyBtn:hover {
    transform: translateY(-1px);
  }

  .mainBtn.primary {
    background: rgba(255,255,255,.10);
    color: white;
  }

  .mainBtn.primary:hover {
    background: rgba(255,255,255,.13);
    border-color: rgba(255,255,255,.18);
  }

  .mainBtn.soft {
    background: rgba(255,255,255,.05);
    color: rgba(255,255,255,.94);
  }

  .mainBtn.soft:hover {
    background: rgba(255,255,255,.075);
  }

  .tinyBtn {
    height: 34px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,.09);
    background: rgba(255,255,255,.045);
    color: rgba(255,255,255,.95);
    font-weight: 700;
    cursor: pointer;
    transition: transform .14s ease, background .14s ease, border-color .14s ease;
    white-space: nowrap;
  }

  .tinyBtn.good {
    background: rgba(34,197,94,.16);
    border-color: rgba(34,197,94,.28);
    color: #dcffe6;
  }

  .tinyBtn.warn {
    background: rgba(245,158,11,.14);
    border-color: rgba(245,158,11,.28);
    color: #fff0c8;
  }

  .tinyBtn.danger {
    background: rgba(239,68,68,.14);
    border-color: rgba(239,68,68,.28);
    color: #ffd9d9;
  }

  .messageRow {
    margin-top: 16px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .msg,
  .pill,
  .softPill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 34px;
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 800;
    border: 1px solid rgba(255,255,255,.10);
  }

  .msg.good {
    background: rgba(34,197,94,.14);
    border-color: rgba(34,197,94,.28);
    color: #dcffe6;
  }

  .msg.warn,
  .softPill.warn {
    background: rgba(245,158,11,.14);
    border-color: rgba(245,158,11,.28);
    color: #fff0c8;
  }

  .msg.bad {
    background: rgba(239,68,68,.14);
    border-color: rgba(239,68,68,.28);
    color: #ffd9d9;
  }

  .pill,
  .softPill {
    background: rgba(255,255,255,.05);
    color: rgba(255,255,255,.84);
  }

  .softPill.blue {
    background: rgba(96,165,250,.14);
    border-color: rgba(96,165,250,.26);
    color: #deebff;
  }

  .settingsWrap,
  .editWrap {
    margin-top: 16px;
    padding: 16px;
    border-radius: 20px;
    background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.035));
    border: 1px solid rgba(255,255,255,.08);
  }

  .sectionMiniTitle,
  .smallTitle {
    color: rgba(255,255,255,.94);
    font-size: 18px;
    font-weight: 900;
    margin-bottom: 14px;
  }

  .formGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .formGridSettings {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .threeCol {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .checkboxLine {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: rgba(255,255,255,.78);
    flex-wrap: wrap;
  }

  .inlineActions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .inlineActions.end {
    justify-content: flex-end;
  }

  .statsGrid,
  .miniStatsGrid {
    display: grid;
    gap: 14px;
  }

  .statsGrid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .miniStatsGrid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-top: 16px;
  }

  .statCard,
  .miniStat,
  .contentCard {
    position: relative;
    overflow: hidden;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,.08);
    background: rgba(255,255,255,.04);
    box-shadow: 0 12px 34px rgba(0,0,0,.24);
  }

  .statCard {
    padding: 18px;
    min-height: 138px;
  }

  .statCard::before {
    content: "";
    position: absolute;
    left: 16px;
    right: 16px;
    top: 0;
    height: 2px;
    border-radius: 999px;
    opacity: .95;
  }

  .statCard.good::before {
    background: #22c55e;
    box-shadow: 0 0 18px rgba(34,197,94,.35);
  }

  .statCard.warn::before {
    background: #f59e0b;
    box-shadow: 0 0 18px rgba(245,158,11,.35);
  }

  .statCard.bad::before {
    background: #ef4444;
    box-shadow: 0 0 18px rgba(239,68,68,.35);
  }

  .statCard.neutral::before {
    background: #94a3b8;
    box-shadow: 0 0 18px rgba(148,163,184,.30);
  }

  .statValue,
  .miniValue,
  .amountLine {
    color: white;
    font-weight: 900;
    letter-spacing: -.03em;
  }

  .statValue {
    font-size: 30px;
    margin-top: 10px;
  }

  .statSub,
  .progressSub,
  .metaLine,
  .emptySub {
    margin-top: 8px;
    color: rgba(255,255,255,.72);
    font-size: 13px;
  }

  .miniStat {
    padding: 14px;
  }

  .miniValue {
    font-size: 28px;
    margin-top: 8px;
  }

  .panelTitle {
    font-size: 22px;
    font-weight: 900;
    color: white;
    letter-spacing: -.02em;
  }

  .progressStack,
  .cardStack {
    display: grid;
    gap: 12px;
  }

  .progressStack {
    margin-top: 6px;
  }

  .progressBlock {
    display: grid;
    gap: 10px;
  }

  .progressLabel,
  .rowTitle {
    color: white;
    font-weight: 800;
  }

  .progressValue,
  .rowValue {
    color: rgba(255,255,255,.82);
    font-weight: 800;
  }

  .progressTrack {
    height: 14px;
    border-radius: 999px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.08);
    overflow: hidden;
  }

  .progressTrack.slim {
    height: 12px;
  }

  .progressFill {
    height: 100%;
    border-radius: 999px;
  }

  .progressFill.good {
    background: #22c55e;
    box-shadow: 0 0 18px rgba(34,197,94,.40);
  }

  .progressFill.warn {
    background: #f59e0b;
    box-shadow: 0 0 18px rgba(245,158,11,.40);
  }

  .progressFill.bad {
    background: #ef4444;
    box-shadow: 0 0 18px rgba(239,68,68,.40);
  }

  .progressFill.neutral {
    background: #94a3b8;
    box-shadow: 0 0 18px rgba(148,163,184,.30);
  }

  .twoColGrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 18px;
  }

  .mainWorkGrid {
    display: grid;
    grid-template-columns: minmax(0, .96fr) minmax(0, 1.04fr);
    gap: 18px;
  }

  .contentCard {
    padding: 14px;
  }

  .emptyCard {
    color: rgba(255,255,255,.76);
  }

  .amountLine {
    font-size: 22px;
  }

  .metaLine {
    margin-top: 4px;
  }

  .smallMeta {
    margin-top: 6px;
    color: rgba(255,255,255,.54);
    font-size: 12px;
  }

  .cardActions,
  .pillRow,
  .modeSwitch,
  .actionStrip {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .actionStrip {
    margin-bottom: 14px;
  }

  .paydayCard {
    display: grid;
    gap: 12px;
  }

  .formFooter {
    margin-top: 2px;
    align-items: center;
  }

  @media (max-width: 1280px) {
    .formGridSettings {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .statsGrid,
    .miniStatsGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 1080px) {
    .twoColGrid,
    .mainWorkGrid {
      grid-template-columns: 1fr;
    }

    .formGridSettings {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .incomeShell {
      padding: 14px;
      gap: 14px;
    }

    .pageTitle {
      font-size: 28px;
    }

    .headerActions {
      width: 100%;
      justify-content: stretch;
    }

    .fieldBlock.compact {
      min-width: 0;
      width: 100%;
    }

    .mainBtn {
      width: 100%;
      justify-content: center;
    }

    .inlineActions {
      width: 100%;
    }

    .inlineActions .mainBtn {
      flex: 1 1 0;
      min-width: 0;
    }

    .statsGrid,
    .miniStatsGrid,
    .formGrid,
    .formGridSettings,
    .threeCol {
      grid-template-columns: 1fr;
    }

    .statValue {
      font-size: 26px;
    }

    .miniValue {
      font-size: 24px;
    }

    .formFooter,
    .settingsFooter {
      align-items: stretch;
    }

    .cardActions {
      width: 100%;
    }

    .cardActions .tinyBtn {
      flex: 1 1 0;
      min-width: 0;
      justify-content: center;
    }
  }
`;