"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

const LS_DEBT = "lcc_debt_accounts_v3";
const LS_DEBT_SETTINGS = "lcc_debt_settings_v3";

/* =========================
   utils
========================= */
function safeParse(str, fallback) {
  try {
    const v = JSON.parse(str || "");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function fmtMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0.00";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function fmtPct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0.00%";
  return `${num.toFixed(2)}%`;
}

function monthLabel(months) {
  if (!Number.isFinite(months)) return "—";
  if (months <= 0) return "Paid";
  if (months < 1) return "<1 mo";
  if (months < 12) return `${Math.ceil(months)} mo`;
  const years = Math.floor(months / 12);
  const rem = Math.ceil(months % 12);
  return rem ? `${years} yr ${rem} mo` : `${years} yr`;
}

function payoffMonths(balance, apr, payment) {
  balance = safeNum(balance);
  apr = safeNum(apr);
  payment = safeNum(payment);

  if (balance <= 0) return 0;
  if (payment <= 0) return Infinity;

  const monthlyRate = apr / 100 / 12;

  if (monthlyRate <= 0) return balance / payment;
  if (payment <= balance * monthlyRate) return Infinity;

  const months = -Math.log(1 - (balance * monthlyRate) / payment) / Math.log(1 + monthlyRate);
  return Number.isFinite(months) ? months : Infinity;
}

function nextMonthDate(monthsFromNow) {
  if (!Number.isFinite(monthsFromNow)) return "—";
  const d = new Date();
  d.setMonth(d.getMonth() + Math.max(0, monthsFromNow));
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function debtTypeLabel(type) {
  const map = {
    mortgage: "Mortgage",
    auto: "Auto Loan",
    credit_card: "Credit Card",
    personal_loan: "Personal Loan",
    student_loan: "Student Loan",
    other: "Other Debt",
  };
  return map[type] || "Debt";
}

function createDebt(type = "other") {
  return {
    id: uid(),
    name:
      type === "mortgage"
        ? "Mortgage"
        : type === "auto"
        ? "Car Loan"
        : type === "credit_card"
        ? "Credit Card"
        : type === "personal_loan"
        ? "Personal Loan"
        : type === "student_loan"
        ? "Student Loan"
        : "New Debt",
    type,
    lender: "",
    balance: 0,
    originalBalance: 0,
    creditLimit: 0,
    apr: 0,
    minimumPayment: 0,
    extraPayment: 0,
    dueDay: "",
    monthlyPayment: 0,
    principalPortion: 0,
    interestPortion: 0,
    escrowPortion: 0,
    promoApr: "",
    promoEnds: "",
    notes: "",
    isActive: true,
    createdAt: Date.now(),
    termMonths: null,
    remainingMonths: null,
  };
}

const defaultSettings = {
  strategy: "avalanche",
  globalExtraPool: 0,
  showInactive: false,
};

/* =========================
   DB mappers
========================= */
function mapDebtRow(row) {
  return {
    id: row.id,
    name: row.name ?? "",
    type: row.debt_type ?? "other",
    lender: row.lender ?? "",
    balance: safeNum(row.balance, 0),
    originalBalance: safeNum(row.original_balance, 0),
    creditLimit: safeNum(row.credit_limit, 0),
    apr: safeNum(row.interest_rate, 0),
    minimumPayment: safeNum(row.minimum_payment, 0),
    extraPayment: safeNum(row.extra_payment, 0),
    dueDay: row.due_day == null ? "" : String(row.due_day),
    monthlyPayment: safeNum(row.monthly_payment, 0),
    principalPortion: safeNum(row.principal_portion, 0),
    interestPortion: safeNum(row.interest_portion, 0),
    escrowPortion: safeNum(row.escrow_portion, 0),
    promoApr: row.promo_apr ?? "",
    promoEnds: row.promo_ends ?? "",
    notes: row.notes ?? "",
    isActive: row.is_active ?? true,
    createdAt: row.created_at_ms ?? (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
    termMonths: row.term_months ?? null,
    remainingMonths: row.remaining_months ?? null,
  };
}

function mapDebtToRow(debt, userId) {
  return {
    id: debt.id,
    user_id: userId,
    name: debt.name ?? "",
    lender: debt.lender ?? "",
    debt_type: debt.type ?? "other",
    balance: safeNum(debt.balance, 0),
    original_balance: safeNum(debt.originalBalance, 0),
    credit_limit: safeNum(debt.creditLimit, 0),
    interest_rate: safeNum(debt.apr, 0),
    minimum_payment: safeNum(debt.minimumPayment, 0),
    extra_payment: safeNum(debt.extraPayment, 0),
    due_day: debt.dueDay === "" ? null : safeNum(debt.dueDay, null),
    monthly_payment: safeNum(debt.monthlyPayment, 0),
    principal_portion: safeNum(debt.principalPortion, 0),
    interest_portion: safeNum(debt.interestPortion, 0),
    escrow_portion: safeNum(debt.escrowPortion, 0),
    promo_apr: debt.promoApr ?? "",
    promo_ends: debt.promoEnds || null,
    notes: debt.notes ?? "",
    is_active: !!debt.isActive,
    created_at_ms: debt.createdAt ?? Date.now(),
    term_months: debt.termMonths ?? null,
    remaining_months: debt.remainingMonths ?? null,
    updated_at: new Date().toISOString(),
  };
}

function mapSettingsRow(row) {
  return {
    strategy: row?.strategy ?? "avalanche",
    globalExtraPool: safeNum(row?.global_extra_pool, 0),
    showInactive: !!row?.show_inactive,
  };
}

function mapSettingsToRow(settings, userId, existingId) {
  return {
    ...(existingId ? { id: existingId } : {}),
    user_id: userId,
    strategy: settings.strategy ?? "avalanche",
    global_extra_pool: safeNum(settings.globalExtraPool, 0),
    show_inactive: !!settings.showInactive,
    updated_at: new Date().toISOString(),
  };
}

/* =========================
   debt helpers
========================= */
function getDueStatus(dueDay) {
  const day = safeNum(dueDay, NaN);
  if (!Number.isFinite(day) || day < 1 || day > 31) {
    return { label: "No due day", tone: "neutral", sort: 999 };
  }

  const now = new Date();
  const today = now.getDate();

  if (day === today) return { label: "Due today", tone: "warn", sort: 0 };
  if (day > today) {
    const diff = day - today;
    return { label: `Due in ${diff}d`, tone: diff <= 3 ? "warn" : "good", sort: diff };
  }

  const late = today - day;
  return { label: `${late}d late`, tone: late >= 7 ? "bad" : "warn", sort: -late };
}

function getUtilizationPercent(debt) {
  if (debt.type !== "credit_card") return null;
  const limit = safeNum(debt.creditLimit);
  const bal = safeNum(debt.balance);
  if (limit <= 0) return null;
  return Math.max(0, Math.min(100, (bal / limit) * 100));
}

function getPaidDownPercent(debt) {
  const original = safeNum(debt.originalBalance);
  const bal = safeNum(debt.balance);
  if (original <= 0) return null;
  const paid = ((original - bal) / original) * 100;
  return Math.max(0, Math.min(100, paid));
}

function getMortgageTotal(debt) {
  return safeNum(debt.principalPortion) + safeNum(debt.interestPortion) + safeNum(debt.escrowPortion);
}

function getMonthlyShown(debt) {
  const mortgageTotal = getMortgageTotal(debt);
  if (debt.type === "mortgage" && mortgageTotal > 0) return mortgageTotal;
  return Math.max(safeNum(debt.monthlyPayment), safeNum(debt.minimumPayment));
}

function getAttackPayment(debt) {
  return safeNum(debt.minimumPayment) + safeNum(debt.extraPayment);
}

function getDebtProgressPercent(debt) {
  const util = getUtilizationPercent(debt);
  if (util !== null) return Math.max(0, Math.min(100, 100 - util));

  const paid = getPaidDownPercent(debt);
  if (paid !== null) return paid;

  const payoff = payoffMonths(debt.balance, debt.apr, getAttackPayment(debt));
  if (!Number.isFinite(payoff)) return 4;
  if (payoff <= 12) return 85;
  if (payoff <= 24) return 62;
  if (payoff <= 48) return 38;
  return 18;
}

function getDebtBarTone(debt) {
  const util = getUtilizationPercent(debt);
  const apr = safeNum(debt.apr);
  const due = getDueStatus(debt.dueDay);

  if (due.tone === "bad") return "bad";
  if (util !== null) {
    if (util >= 90) return "bad";
    if (util >= 50) return "warn";
    return "good";
  }

  if (apr >= 24) return "bad";
  if (apr >= 12) return "warn";
  return "good";
}

function getPromoStatus(debt) {
  if (!debt.promoEnds) return null;
  const end = new Date(debt.promoEnds);
  if (Number.isNaN(end.getTime())) return null;

  const now = new Date();
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / 86400000);

  if (diffDays < 0) return { label: "Promo ended", tone: "bad" };
  if (diffDays <= 30) return { label: `Promo ends in ${diffDays}d`, tone: "warn" };
  return { label: `Promo ends in ${diffDays}d`, tone: "good" };
}

function getPrincipalShare(debt) {
  if (debt.type !== "mortgage") return null;
  const principal = safeNum(debt.principalPortion);
  const total = getMortgageTotal(debt);
  if (total <= 0) return null;
  return Math.max(0, Math.min(100, (principal / total) * 100));
}

function getDebtChip(debt, priority) {
  const util = getUtilizationPercent(debt);
  const promo = getPromoStatus(debt);
  const principalShare = getPrincipalShare(debt);

  if (priority === 1) return { label: "Target #1", tone: "accent" };
  if (promo && promo.tone !== "good") return promo;
  if (util !== null) {
    if (util >= 90) return { label: "Maxed pressure", tone: "bad" };
    if (util >= 50) return { label: `${Math.round(util)}% used`, tone: "warn" };
    return { label: `${Math.round(util)}% used`, tone: "good" };
  }

  if (principalShare !== null) {
    if (principalShare < 25) return { label: "Interest heavy", tone: "warn" };
    return { label: `${Math.round(principalShare)}% principal`, tone: "good" };
  }

  const apr = safeNum(debt.apr);
  if (apr >= 24) return { label: "APR drag", tone: "bad" };
  if (apr >= 15) return { label: "Watch APR", tone: "warn" };

  const payoff = payoffMonths(debt.balance, debt.apr, getAttackPayment(debt));
  if (Number.isFinite(payoff) && payoff <= 12) return { label: "Close win", tone: "good" };

  return { label: "On plan", tone: "neutral" };
}

/* =========================
   page
========================= */
export default function DebtPage() {
  const [debts, setDebts] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [openId, setOpenId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState({});
  const [userId, setUserId] = useState(null);
  const [settingsRowId, setSettingsRowId] = useState(null);

  const didImportRef = useRef(false);
  const settingsSaveTimer = useRef(null);
  const rowSaveTimers = useRef({});

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

  async function loadDebtPage() {
    setLoading(true);

    const user = await getCurrentUser();
    if (!user) {
      setUserId(null);
      setDebts([]);
      setSettings(defaultSettings);
      setOpenId(null);
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const [debtRes, settingsRes] = await Promise.all([
      supabase.from("debt").select("*").order("created_at", { ascending: false }),
      supabase.from("debt_settings").select("*").limit(1).maybeSingle(),
    ]);

    if (debtRes.error) {
      console.error("load debt error:", debtRes.error);
    }

    if (settingsRes.error) {
      console.error("load debt settings error:", settingsRes.error);
    }

    let mappedDebts = (debtRes.data || []).map(mapDebtRow);
    let mappedSettings = settingsRes.data ? mapSettingsRow(settingsRes.data) : defaultSettings;

    if (settingsRes.data?.id) {
      setSettingsRowId(settingsRes.data.id);
    }

    if (mappedDebts.length === 0 && !didImportRef.current) {
      const localDebts = safeParse(globalThis?.localStorage?.getItem(LS_DEBT), []);
      const localSettings = safeParse(globalThis?.localStorage?.getItem(LS_DEBT_SETTINGS), defaultSettings);

      if (Array.isArray(localDebts) && localDebts.length > 0) {
        didImportRef.current = true;

        const importRows = localDebts.map((d) => mapDebtToRow(d, user.id));
        const importResult = await supabase.from("debt").upsert(importRows, { onConflict: "id" });

        if (importResult.error) {
          console.error("debt import error:", importResult.error);
        } else {
          mappedDebts = localDebts;
          try {
            localStorage.removeItem(LS_DEBT);
          } catch {}
        }
      }

      if (localSettings) {
        const upsertSettings = await supabase
          .from("debt_settings")
          .upsert(mapSettingsToRow({ ...defaultSettings, ...localSettings }, user.id, settingsRes.data?.id), {
            onConflict: "user_id",
          })
          .select()
          .single();

        if (upsertSettings.error) {
          console.error("settings import error:", upsertSettings.error);
        } else {
          mappedSettings = mapSettingsRow(upsertSettings.data);
          setSettingsRowId(upsertSettings.data.id);
          try {
            localStorage.removeItem(LS_DEBT_SETTINGS);
          } catch {}
        }
      }
    }

    setDebts(mappedDebts);
    setSettings(mappedSettings);
    setOpenId(mappedDebts[0]?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    loadDebtPage();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadDebtPage();
    });

    return () => {
      subscription?.unsubscribe?.();
      if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
      Object.values(rowSaveTimers.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  async function persistDebt(nextDebt) {
    if (!userId) return;

    setSavingIds((prev) => ({ ...prev, [nextDebt.id]: true }));

    const { error } = await supabase.from("debt").upsert(mapDebtToRow(nextDebt, userId), {
      onConflict: "id",
    });

    if (error) {
      console.error("save debt error:", error);
    }

    setSavingIds((prev) => ({ ...prev, [nextDebt.id]: false }));
  }

  function scheduleDebtSave(nextDebt) {
    if (rowSaveTimers.current[nextDebt.id]) {
      clearTimeout(rowSaveTimers.current[nextDebt.id]);
    }

    rowSaveTimers.current[nextDebt.id] = setTimeout(() => {
      persistDebt(nextDebt);
    }, 350);
  }

  async function persistSettings(nextSettings) {
    if (!userId) return;

    const res = await supabase
      .from("debt_settings")
      .upsert(mapSettingsToRow(nextSettings, userId, settingsRowId), { onConflict: "user_id" })
      .select()
      .single();

    if (res.error) {
      console.error("save settings error:", res.error);
      return;
    }

    setSettingsRowId(res.data.id);
  }

  function scheduleSettingsSave(nextSettings) {
    if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
    settingsSaveTimer.current = setTimeout(() => {
      persistSettings(nextSettings);
    }, 350);
  }

  async function addDebt(type) {
    if (!userId) return;

    const next = createDebt(type);
    setDebts((prev) => [next, ...prev]);
    setOpenId(next.id);

    const { error } = await supabase.from("debt").insert(mapDebtToRow(next, userId));
    if (error) {
      console.error("add debt error:", error);
      await loadDebtPage();
    }
  }

  function updateDebt(id, patch) {
    setDebts((prev) => {
      const nextRows = prev.map((d) => (d.id === id ? { ...d, ...patch } : d));
      const changed = nextRows.find((d) => d.id === id);
      if (changed) scheduleDebtSave(changed);
      return nextRows;
    });
  }

  async function removeDebt(id) {
    setDebts((prev) => prev.filter((d) => d.id !== id));
    setOpenId((prev) => (prev === id ? null : prev));

    const { error } = await supabase.from("debt").delete().eq("id", id);
    if (error) {
      console.error("delete debt error:", error);
      await loadDebtPage();
    }
  }

  async function duplicateDebt(debt) {
    if (!userId) return;

    const cloned = {
      ...debt,
      id: uid(),
      name: `${debt.name || "Debt"} Copy`,
      createdAt: Date.now(),
    };

    setDebts((prev) => [cloned, ...prev]);
    setOpenId(cloned.id);

    const { error } = await supabase.from("debt").insert(mapDebtToRow(cloned, userId));
    if (error) {
      console.error("duplicate debt error:", error);
      await loadDebtPage();
    }
  }

  function updateSettings(patch) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      scheduleSettingsSave(next);
      return next;
    });
  }

  const visibleDebts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return debts.filter((d) => {
      if (!settings.showInactive && !d.isActive) return false;
      if (!q) return true;

      return [d.name, d.lender, d.type, d.notes, debtTypeLabel(d.type)].join(" ").toLowerCase().includes(q);
    });
  }, [debts, search, settings.showInactive]);

  const activeDebts = useMemo(() => debts.filter((d) => d.isActive && safeNum(d.balance) > 0), [debts]);

  const totals = useMemo(() => {
    const totalBalance = activeDebts.reduce((sum, d) => sum + safeNum(d.balance), 0);
    const totalMinimum = activeDebts.reduce((sum, d) => sum + safeNum(d.minimumPayment), 0);
    const totalExtra = activeDebts.reduce((sum, d) => sum + safeNum(d.extraPayment), 0);
    const totalMonthly = activeDebts.reduce((sum, d) => sum + getMonthlyShown(d), 0);

    const weightedApr =
      totalBalance > 0
        ? activeDebts.reduce((sum, d) => sum + safeNum(d.balance) * safeNum(d.apr), 0) / totalBalance
        : 0;

    const mortgagePrincipal = activeDebts
      .filter((d) => d.type === "mortgage")
      .reduce((sum, d) => sum + safeNum(d.principalPortion), 0);

    const mortgageInterest = activeDebts
      .filter((d) => d.type === "mortgage")
      .reduce((sum, d) => sum + safeNum(d.interestPortion), 0);

    const mortgageEscrow = activeDebts
      .filter((d) => d.type === "mortgage")
      .reduce((sum, d) => sum + safeNum(d.escrowPortion), 0);

    return {
      totalBalance,
      totalMinimum,
      totalExtra,
      totalMonthly,
      weightedApr,
      mortgagePrincipal,
      mortgageInterest,
      mortgageEscrow,
    };
  }, [activeDebts]);

  const rankedDebts = useMemo(() => {
    const rows = activeDebts.map((d) => {
      const attack = getAttackPayment(d);
      return {
        ...d,
        attack,
        payoff: payoffMonths(d.balance, d.apr, attack),
      };
    });

    if (settings.strategy === "snowball") {
      rows.sort((a, b) => safeNum(a.balance) - safeNum(b.balance));
    } else {
      rows.sort((a, b) => {
        const aprDiff = safeNum(b.apr) - safeNum(a.apr);
        if (aprDiff !== 0) return aprDiff;
        return safeNum(a.balance) - safeNum(b.balance);
      });
    }

    return rows.map((d, i) => ({ ...d, priority: i + 1 }));
  }, [activeDebts, settings.strategy]);

  const topTarget = rankedDebts[0] || null;

  const quickStats = useMemo(() => {
    const creditCards = debts.filter((d) => d.isActive && d.type === "credit_card").length;
    const installment = debts.filter(
      (d) => d.isActive && ["mortgage", "auto", "personal_loan", "student_loan"].includes(d.type)
    ).length;
    const totalAccounts = debts.filter((d) => d.isActive).length;
    return { creditCards, installment, totalAccounts };
  }, [debts]);

  const topCardBars = useMemo(() => {
    const monthlyAttack = totals.totalMinimum + totals.totalExtra + safeNum(settings.globalExtraPool);
    const attackPct =
      totals.totalMinimum > 0 ? Math.max(0, Math.min(100, (monthlyAttack / totals.totalMinimum) * 55)) : 0;

    const aprPct = Math.max(0, Math.min(100, (totals.weightedApr / 30) * 100));

    const principalTotal = totals.mortgagePrincipal + totals.mortgageInterest + totals.mortgageEscrow;
    const principalPct =
      principalTotal > 0 ? Math.max(0, Math.min(100, (totals.mortgagePrincipal / principalTotal) * 100)) : 0;

    const debtCountPct = Math.max(0, Math.min(100, quickStats.totalAccounts * 14));

    return {
      attackPct,
      aprPct,
      principalPct,
      debtCountPct,
    };
  }, [totals, settings.globalExtraPool, quickStats.totalAccounts]);

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 20 }}>Loading debt page...</div>
          <div className="muted" style={{ marginTop: 8 }}>Pulling your debt data from Supabase.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <section style={{ marginBottom: 22 }}>
        <div
          className="muted"
          style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}
        >
          Debt
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 16,
            alignItems: "end",
          }}
        >
          <div>
            <h1 style={{ fontSize: "clamp(2.3rem, 4vw, 3.35rem)", lineHeight: 1.02, margin: 0, fontWeight: 950 }}>
              Debt Control Center
            </h1>
            <p className="muted" style={{ marginTop: 12, fontSize: 16, maxWidth: 880, lineHeight: 1.5 }}>
              Premium debt tracking with payoff pressure, colored progress bars, due urgency, and smarter priority targeting.
            </p>
          </div>

          <div className="card" style={{ padding: 14, minWidth: 210 }}>
            <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em" }}>
              Focus target
            </div>
            <div style={{ marginTop: 8, fontWeight: 900, fontSize: 20 }}>
              {topTarget ? topTarget.name : "Add a debt"}
            </div>
            <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
              {topTarget
                ? settings.strategy === "avalanche"
                  ? "Highest APR first"
                  : "Smallest balance first"
                : "Nothing ranked yet"}
            </div>
          </div>
        </div>
      </section>

      <section
        className="grid"
        style={{
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          marginBottom: 18,
        }}
      >
        <TopStatCard
          label="Total debt balance"
          value={fmtMoney(totals.totalBalance)}
          sub={quickStats.totalAccounts ? `${quickStats.totalAccounts} active debt account${quickStats.totalAccounts === 1 ? "" : "s"}` : "No active debts yet"}
          fill={topCardBars.debtCountPct}
          tone="accent"
        />
        <TopStatCard
          label="Monthly debt attack"
          value={fmtMoney(totals.totalMinimum + totals.totalExtra + settings.globalExtraPool)}
          sub="Minimums + extra payments"
          fill={topCardBars.attackPct}
          tone="good"
        />
        <TopStatCard
          label="APR pressure"
          value={fmtPct(totals.weightedApr)}
          sub={settings.strategy === "avalanche" ? "Avalanche strategy active" : "Snowball strategy active"}
          fill={topCardBars.aprPct}
          tone={totals.weightedApr >= 18 ? "bad" : totals.weightedApr >= 10 ? "warn" : "good"}
        />
        <TopStatCard
          label="Mortgage principal share"
          value={fmtMoney(totals.mortgagePrincipal)}
          sub={`Interest ${fmtMoney(totals.mortgageInterest)} • Escrow ${fmtMoney(totals.mortgageEscrow)}`}
          fill={topCardBars.principalPct}
          tone={topCardBars.principalPct < 25 ? "warn" : "good"}
        />
      </section>

      <section className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr 1fr auto",
            gap: 14,
            alignItems: "end",
          }}
        >
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Payoff strategy
            </div>
            <select
              className="input"
              value={settings.strategy}
              onChange={(e) => updateSettings({ strategy: e.target.value })}
            >
              <option value="avalanche">Avalanche (highest APR first)</option>
              <option value="snowball">Snowball (smallest balance first)</option>
            </select>
          </div>

          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Global extra pool / month
            </div>
            <input
              className="input"
              value={String(settings.globalExtraPool || "")}
              onChange={(e) =>
                updateSettings({
                  globalExtraPool: safeNum(parseMoneyInput(e.target.value), 0),
                })
              }
              placeholder="e.g. 300"
            />
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Planned monthly attack
            </div>
            <div style={{ marginTop: 8, fontWeight: 950, fontSize: 28 }}>
              {fmtMoney(totals.totalMinimum + totals.totalExtra + settings.globalExtraPool)}
            </div>
            <div style={{ marginTop: 10 }}>
              <ProgressBar fill={topCardBars.attackPct} tone="good" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, auto)", gap: 10 }}>
            <button className="btnGhost" onClick={() => addDebt("mortgage")}>+ Mortgage</button>
            <button className="btnGhost" onClick={() => addDebt("auto")}>+ Auto</button>
            <button className="btnGhost" onClick={() => addDebt("credit_card")}>+ Card</button>
            <button className="btnGhost" onClick={() => addDebt("other")}>+ Other</button>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.55fr 1fr",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 14,
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontWeight: 950, fontSize: 22 }}>Debt Accounts</div>
                <div className="muted" style={{ marginTop: 4, fontSize: 14 }}>
                  Payoff bars, urgency chips, and due status built in.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <input
                  className="input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search debt..."
                  style={{ minWidth: 210 }}
                />
                <button
                  className="btnGhost"
                  onClick={() => updateSettings({ showInactive: !settings.showInactive })}
                >
                  {settings.showInactive ? "Hide inactive" : "Show inactive"}
                </button>
              </div>
            </div>

            {visibleDebts.length === 0 ? (
              <EmptyState
                title="No debt accounts yet"
                sub="Start with a credit card, car loan, mortgage, or any other balance you want tracked."
              />
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {visibleDebts.map((debt) => {
                  const isOpen = openId === debt.id;
                  const monthlyShown = getMonthlyShown(debt);
                  const payoff = payoffMonths(safeNum(debt.balance), safeNum(debt.apr), getAttackPayment(debt));
                  const due = getDueStatus(debt.dueDay);
                  const progressFill = getDebtProgressPercent(debt);
                  const progressTone = getDebtBarTone(debt);

                  const rankedMatch = rankedDebts.find((r) => r.id === debt.id);
                  const priority = rankedMatch?.priority || null;
                  const chip = getDebtChip(debt, priority);
                  const promo = getPromoStatus(debt);

                  return (
                    <div key={debt.id} className="card" style={{ overflow: "hidden" }}>
                      <button
                        onClick={() => setOpenId((prev) => (prev === debt.id ? null : debt.id))}
                        style={{
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          color: "inherit",
                          textAlign: "left",
                          padding: 18,
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            gap: 14,
                            alignItems: "start",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                              <div style={{ fontWeight: 950, fontSize: 18 }}>
                                {debt.name || "Untitled debt"}
                              </div>

                              <Tag text={debtTypeLabel(debt.type)} tone="neutral" />
                              {!debt.isActive ? <Tag text="Inactive" tone="neutral" /> : null}
                              {priority ? <Tag text={`Target #${priority}`} tone={priority === 1 ? "accent" : "neutral"} /> : null}
                              <Tag text={chip.label} tone={chip.tone} />
                              {promo && promo.tone === "good" ? <Tag text={promo.label} tone="good" /> : null}
                              {savingIds[debt.id] ? <Tag text="Saving..." tone="accent" /> : null}
                            </div>

                            <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                              {debt.lender || "No lender yet"} • {due.label}
                            </div>

                            <div style={{ marginTop: 12 }}>
                              <ProgressBar fill={progressFill} tone={progressTone} />
                            </div>
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(4, minmax(92px, 1fr))",
                              gap: 10,
                              minWidth: 430,
                            }}
                          >
                            <MiniMetric label="Balance" value={fmtMoney(debt.balance)} />
                            <MiniMetric label="APR" value={fmtPct(debt.apr)} />
                            <MiniMetric label="Monthly" value={fmtMoney(monthlyShown)} />
                            <MiniMetric label="Payoff" value={payoff === Infinity ? "Never" : monthLabel(payoff)} />
                          </div>
                        </div>
                      </button>

                      {isOpen ? (
                        <div style={{ padding: "0 18px 18px", borderTop: "1px solid rgba(255,255,255,.10)" }}>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                              gap: 16,
                              marginTop: 16,
                            }}
                          >
                            <Field label="Debt name">
                              <input
                                className="input"
                                value={debt.name}
                                onChange={(e) => updateDebt(debt.id, { name: e.target.value })}
                                placeholder="Amex Gold, Mortgage, Car Loan..."
                              />
                            </Field>

                            <Field label="Debt type">
                              <select
                                className="input"
                                value={debt.type}
                                onChange={(e) => updateDebt(debt.id, { type: e.target.value })}
                              >
                                <option value="mortgage">Mortgage</option>
                                <option value="auto">Auto Loan</option>
                                <option value="credit_card">Credit Card</option>
                                <option value="personal_loan">Personal Loan</option>
                                <option value="student_loan">Student Loan</option>
                                <option value="other">Other Debt</option>
                              </select>
                            </Field>

                            <Field label="Lender">
                              <input
                                className="input"
                                value={debt.lender}
                                onChange={(e) => updateDebt(debt.id, { lender: e.target.value })}
                                placeholder="Bank / lender"
                              />
                            </Field>

                            <Field label="Current balance">
                              <input
                                className="input"
                                value={String(debt.balance || "")}
                                onChange={(e) => updateDebt(debt.id, { balance: safeNum(parseMoneyInput(e.target.value), 0) })}
                                placeholder="e.g. 8200"
                              />
                            </Field>

                            <Field label="Original balance">
                              <input
                                className="input"
                                value={String(debt.originalBalance || "")}
                                onChange={(e) =>
                                  updateDebt(debt.id, { originalBalance: safeNum(parseMoneyInput(e.target.value), 0) })
                                }
                                placeholder="Optional"
                              />
                            </Field>

                            <Field label="Credit limit">
                              <input
                                className="input"
                                value={String(debt.creditLimit || "")}
                                onChange={(e) =>
                                  updateDebt(debt.id, { creditLimit: safeNum(parseMoneyInput(e.target.value), 0) })
                                }
                                placeholder="Cards only"
                              />
                            </Field>

                            <Field label="APR %">
                              <input
                                className="input"
                                value={String(debt.apr || "")}
                                onChange={(e) => updateDebt(debt.id, { apr: safeNum(e.target.value, 0) })}
                                placeholder="e.g. 24.99"
                              />
                            </Field>

                            <Field label="Due day">
                              <input
                                className="input"
                                value={debt.dueDay}
                                onChange={(e) => updateDebt(debt.id, { dueDay: e.target.value })}
                                placeholder="1-31"
                              />
                            </Field>

                            <Field label="Minimum payment">
                              <input
                                className="input"
                                value={String(debt.minimumPayment || "")}
                                onChange={(e) =>
                                  updateDebt(debt.id, { minimumPayment: safeNum(parseMoneyInput(e.target.value), 0) })
                                }
                                placeholder="e.g. 145"
                              />
                            </Field>

                            <Field label="Extra payment">
                              <input
                                className="input"
                                value={String(debt.extraPayment || "")}
                                onChange={(e) =>
                                  updateDebt(debt.id, { extraPayment: safeNum(parseMoneyInput(e.target.value), 0) })
                                }
                                placeholder="e.g. 75"
                              />
                            </Field>

                            <Field label="Monthly payment">
                              <input
                                className="input"
                                value={String(debt.monthlyPayment || "")}
                                onChange={(e) =>
                                  updateDebt(debt.id, { monthlyPayment: safeNum(parseMoneyInput(e.target.value), 0) })
                                }
                                placeholder="For fixed/installment debt"
                              />
                            </Field>

                            <Field label="Promo APR %">
                              <input
                                className="input"
                                value={debt.promoApr}
                                onChange={(e) => updateDebt(debt.id, { promoApr: e.target.value })}
                                placeholder="Optional intro APR"
                              />
                            </Field>

                            <Field label="Promo ends">
                              <input
                                className="input"
                                type="date"
                                value={debt.promoEnds || ""}
                                onChange={(e) => updateDebt(debt.id, { promoEnds: e.target.value })}
                              />
                            </Field>
                          </div>

                          {debt.type === "mortgage" ? (
                            <div
                              className="card"
                              style={{
                                marginTop: 16,
                                padding: 16,
                                borderColor: "rgba(34,197,94,.18)",
                                background: "linear-gradient(180deg, rgba(34,197,94,.10), rgba(255,255,255,.04))",
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr auto",
                                  gap: 12,
                                  alignItems: "start",
                                  marginBottom: 14,
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 950, fontSize: 16 }}>Mortgage Payment Breakdown</div>
                                  <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                                    Principal should be going up over time. Interest-heavy payments show weaker bars.
                                  </div>
                                </div>

                                <div className="pill" style={{ fontSize: 12 }}>
                                  Total {fmtMoney(getMortgageTotal(debt))}
                                </div>
                              </div>

                              <div style={{ marginBottom: 14 }}>
                                <ProgressBar
                                  fill={getPrincipalShare(debt) ?? 0}
                                  tone={(getPrincipalShare(debt) ?? 0) < 25 ? "warn" : "good"}
                                />
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                                  gap: 16,
                                }}
                              >
                                <Field label="Principal portion">
                                  <input
                                    className="input"
                                    value={String(debt.principalPortion || "")}
                                    onChange={(e) =>
                                      updateDebt(debt.id, {
                                        principalPortion: safeNum(parseMoneyInput(e.target.value), 0),
                                      })
                                    }
                                    placeholder="e.g. 612.34"
                                  />
                                </Field>

                                <Field label="Interest portion">
                                  <input
                                    className="input"
                                    value={String(debt.interestPortion || "")}
                                    onChange={(e) =>
                                      updateDebt(debt.id, {
                                        interestPortion: safeNum(parseMoneyInput(e.target.value), 0),
                                      })
                                    }
                                    placeholder="e.g. 1542.11"
                                  />
                                </Field>

                                <Field label="Escrow / tax / insurance">
                                  <input
                                    className="input"
                                    value={String(debt.escrowPortion || "")}
                                    onChange={(e) =>
                                      updateDebt(debt.id, {
                                        escrowPortion: safeNum(parseMoneyInput(e.target.value), 0),
                                      })
                                    }
                                    placeholder="e.g. 649.45"
                                  />
                                </Field>
                              </div>
                            </div>
                          ) : null}

                          <div style={{ marginTop: 16 }}>
                            <Field label="Notes">
                              <textarea
                                className="input"
                                value={debt.notes}
                                onChange={(e) => updateDebt(debt.id, { notes: e.target.value })}
                                placeholder="Rate notes, payoff plan, balance transfer info, refinance thoughts..."
                                style={{ minHeight: 110, width: "100%", resize: "vertical" }}
                              />
                            </Field>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 12,
                              flexWrap: "wrap",
                              marginTop: 16,
                            }}
                          >
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                              <button
                                className="btnGhost"
                                onClick={() => updateDebt(debt.id, { isActive: !debt.isActive })}
                              >
                                {debt.isActive ? "Mark inactive" : "Mark active"}
                              </button>

                              <button
                                className="btnGhost"
                                onClick={() => duplicateDebt(debt)}
                              >
                                Duplicate
                              </button>
                            </div>

                            <button
                              className="btnGhost"
                              onClick={() => removeDebt(debt.id)}
                              style={{
                                borderColor: "rgba(239,68,68,.25)",
                                background: "rgba(239,68,68,.08)",
                              }}
                            >
                              Delete debt
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 22 }}>Priority Queue</div>
            <div className="muted" style={{ marginTop: 4, fontSize: 14 }}>
              {settings.strategy === "avalanche" ? "Highest APR first." : "Smallest balance first."}
            </div>

            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              {rankedDebts.length === 0 ? (
                <EmptyState title="Nothing to rank yet" sub="Add active balances and monthly payments to build a payoff order." />
              ) : (
                rankedDebts.map((d) => {
                  const chip = getDebtChip(d, d.priority);
                  const due = getDueStatus(d.dueDay);

                  return (
                    <div key={d.id} className="card" style={{ padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <Tag text={`#${d.priority}`} tone={d.priority === 1 ? "accent" : "neutral"} />
                            <span style={{ fontWeight: 900 }}>{d.name}</span>
                            <Tag text={chip.label} tone={chip.tone} />
                          </div>
                          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                            {d.lender || "No lender"} • {fmtPct(d.apr)} APR • {due.label}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div className="muted" style={{ fontSize: 11 }}>Balance</div>
                          <div style={{ fontWeight: 900 }}>{fmtMoney(d.balance)}</div>
                        </div>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <ProgressBar fill={getDebtProgressPercent(d)} tone={getDebtBarTone(d)} />
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
                          gap: 10,
                          marginTop: 12,
                        }}
                      >
                        <MiniMetric label="Min" value={fmtMoney(d.minimumPayment)} />
                        <MiniMetric label="Extra" value={fmtMoney(d.extraPayment)} />
                        <MiniMetric label="Payoff" value={d.payoff === Infinity ? "Never" : monthLabel(d.payoff)} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 22 }}>Debt Snapshot</div>
            <div className="muted" style={{ marginTop: 4, fontSize: 14 }}>
              Quick monthly picture.
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <SnapshotRow label="Total minimums" value={fmtMoney(totals.totalMinimum)} />
              <SnapshotRow label="Debt-specific extra" value={fmtMoney(totals.totalExtra)} />
              <SnapshotRow label="Global extra pool" value={fmtMoney(settings.globalExtraPool)} />
              <SnapshotRow label="Total monthly attack" value={fmtMoney(totals.totalMinimum + totals.totalExtra + settings.globalExtraPool)} strong />
              <SnapshotRow label="Credit cards" value={String(quickStats.creditCards)} />
              <SnapshotRow label="Installment debts" value={String(quickStats.installment)} />
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 22 }}>Projected First Win</div>
            <div className="muted" style={{ marginTop: 4, fontSize: 14 }}>
              Based on current payment inputs only.
            </div>

            <div style={{ marginTop: 14 }}>
              {topTarget ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <SnapshotRow label="Target" value={topTarget.name} />
                  <SnapshotRow label="Payoff estimate" value={topTarget.payoff === Infinity ? "Never" : monthLabel(topTarget.payoff)} />
                  <SnapshotRow label="Approx payoff month" value={topTarget.payoff === Infinity ? "—" : nextMonthDate(Math.ceil(topTarget.payoff))} />
                </div>
              ) : (
                <EmptyState title="No projection yet" sub="Add a debt with balance, APR, and payment info." />
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 22 }}>Mortgage Insight</div>
            <div className="muted" style={{ marginTop: 4, fontSize: 14 }}>
              Uses the same visual logic as the bills page.
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <SnapshotRow label="Principal / month" value={fmtMoney(totals.mortgagePrincipal)} />
              <SnapshotRow label="Interest / month" value={fmtMoney(totals.mortgageInterest)} />
              <SnapshotRow label="Escrow / month" value={fmtMoney(totals.mortgageEscrow)} />
            </div>

            <div style={{ marginTop: 14 }}>
              <ProgressBar
                fill={
                  totals.mortgagePrincipal + totals.mortgageInterest + totals.mortgageEscrow > 0
                    ? (totals.mortgagePrincipal /
                        (totals.mortgagePrincipal + totals.mortgageInterest + totals.mortgageEscrow)) *
                      100
                    : 0
                }
                tone={
                  totals.mortgagePrincipal + totals.mortgageInterest + totals.mortgageEscrow > 0 &&
                  totals.mortgagePrincipal /
                    (totals.mortgagePrincipal + totals.mortgageInterest + totals.mortgageEscrow) <
                    0.25
                    ? "warn"
                    : "good"
                }
              />
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 1280px) {
          section[style*="grid-template-columns: 1.55fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 1100px) {
          section[style*="grid-template-columns: repeat(4, minmax(0, 1fr))"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          div[style*="grid-template-columns: 1.1fr 1fr 1fr auto"] {
            grid-template-columns: 1fr !important;
          }

          div[style*="grid-template-columns: repeat(3, minmax(0, 1fr))"] {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 900px) {
          div[style*="grid-template-columns: 1fr auto"] {
            grid-template-columns: 1fr !important;
          }

          div[style*="min-width: 430"] {
            min-width: 100% !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          section[style*="grid-template-columns: repeat(4, minmax(0, 1fr))"] {
            grid-template-columns: 1fr !important;
          }

          div[style*="min-width: 430"] {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

/* =========================
   components
========================= */
function TopStatCard({ label, value, sub, fill, tone }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="muted" style={{ fontSize: 14 }}>{label}</div>
      <div style={{ marginTop: 10, fontWeight: 950, fontSize: 22 }}>{value}</div>
      <div style={{ marginTop: 10 }}>
        <ProgressBar fill={fill} tone={tone} />
      </div>
      <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>{sub}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{label}</div>
      {children}
    </label>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.10)",
        borderRadius: 14,
        padding: "10px 12px",
        background: "rgba(255,255,255,.03)",
      }}
    >
      <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em" }}>
        {label}
      </div>
      <div style={{ marginTop: 6, fontWeight: 900, fontSize: 16 }}>{value}</div>
    </div>
  );
}

function SnapshotRow({ label, value, strong }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.10)",
        background: "rgba(255,255,255,.03)",
      }}
    >
      <div className="muted" style={{ fontSize: 14 }}>{label}</div>
      <div style={{ fontWeight: strong ? 950 : 850 }}>{value}</div>
    </div>
  );
}

function EmptyState({ title, sub }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px dashed rgba(255,255,255,.18)",
        padding: "26px 18px",
        textAlign: "center",
        background: "rgba(255,255,255,.02)",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 17 }}>{title}</div>
      <div className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>
        {sub}
      </div>
    </div>
  );
}

function Tag({ text, tone = "neutral" }) {
  const styles = {
    neutral: {
      border: "1px solid rgba(255,255,255,.12)",
      background: "rgba(255,255,255,.05)",
      color: "rgba(255,255,255,.82)",
    },
    good: {
      border: "1px solid rgba(74,222,128,.22)",
      background: "rgba(34,197,94,.12)",
      color: "rgba(220,252,231,.95)",
    },
    warn: {
      border: "1px solid rgba(251,191,36,.24)",
      background: "rgba(245,158,11,.12)",
      color: "rgba(254,243,199,.95)",
    },
    bad: {
      border: "1px solid rgba(248,113,113,.24)",
      background: "rgba(239,68,68,.12)",
      color: "rgba(254,226,226,.95)",
    },
    accent: {
      border: "1px solid rgba(96,165,250,.24)",
      background: "rgba(59,130,246,.14)",
      color: "rgba(219,234,254,.95)",
    },
  };

  return (
    <span
      style={{
        ...styles[tone],
        borderRadius: 999,
        padding: "5px 10px",
        fontSize: 11,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function ProgressBar({ fill = 0, tone = "accent" }) {
  const normalized = Math.max(0, Math.min(100, safeNum(fill)));
  const toneMap = {
    accent: "linear-gradient(90deg, rgba(96,165,250,.95), rgba(147,197,253,.95))",
    good: "linear-gradient(90deg, rgba(74,222,128,.95), rgba(167,243,208,.95))",
    warn: "linear-gradient(90deg, rgba(251,191,36,.95), rgba(253,230,138,.95))",
    bad: "linear-gradient(90deg, rgba(248,113,113,.95), rgba(252,165,165,.95))",
  };

  return (
    <div
      style={{
        height: 10,
        width: "100%",
        borderRadius: 999,
        background: "rgba(255,255,255,.06)",
        border: "1px solid rgba(255,255,255,.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${normalized}%`,
          height: "100%",
          borderRadius: 999,
          background: toneMap[tone] || toneMap.accent,
          boxShadow: "0 0 16px rgba(255,255,255,.08)",
          transition: "width .22s ease",
        }}
      />
    </div>
  );
}
