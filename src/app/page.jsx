"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/* =========================
   utils
========================= */
function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function isoDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthKeyFromISO(iso) {
  const s = String(iso || "");
  return s.length >= 7 ? s.slice(0, 7) : "";
}

function fmtShort(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtMonthLabel(ym) {
  if (!ym || ym.length < 7) return "—";
  const [y, m] = ym.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function daysUntil(iso) {
  if (!iso) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const due = new Date(`${iso}T00:00:00`).getTime();
  if (!Number.isFinite(due)) return null;
  return Math.round((due - today) / 86400000);
}

function startOfMonthISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function endOfMonthISO(d = new Date()) {
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return isoDate(end);
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function pct(n, d) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
  return (n / d) * 100;
}

function freqToMonthlyMult(freq) {
  switch (String(freq || "").toLowerCase()) {
    case "weekly":
      return 4.333;
    case "biweekly":
      return 2.167;
    case "quarterly":
      return 1 / 3;
    case "yearly":
      return 1 / 12;
    case "one_time":
      return 0;
    case "monthly":
    default:
      return 1;
  }
}

function typeLabel(t) {
  const v = String(t || "other").toLowerCase();
  if (v === "checking") return "Checking";
  if (v === "savings") return "Savings";
  if (v === "cash") return "Cash";
  if (v === "credit") return "Credit Card";
  if (v === "investment") return "Investment";
  return "Other";
}

/* =========================
   db mappers
========================= */
function mapAccountRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "",
    type: row.account_type || "other",
    balance: safeNum(row.balance, 0),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

function mapBillRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "Bill",
    type: row.type === "controllable" ? "controllable" : "noncontrollable",
    frequency: row.frequency || "monthly",
    dueDate: row.due_date || "",
    amount: safeNum(row.amount, 0),
    active: row.active !== false,
    balance: safeNum(row.balance, 0),
    minPay: safeNum(row.min_pay, 0),
    extraPay: safeNum(row.extra_pay, 0),
    autopay: row.autopay === true,
    category: row.category || "",
    notes: row.notes || "",
  };
}

function mapSpendingTxRowToClient(row) {
  return {
    id: row.id,
    type: row.type || "expense",
    amount: safeNum(row.amount, 0),
    date: row.tx_date || "",
    merchant: row.merchant || "",
    note: row.note || "",
  };
}

function mapPlannedRowToClient(row) {
  return {
    id: row.id,
    amount: safeNum(row.amount, 0),
    date: row.planned_date || "",
    merchant: row.merchant || "",
    note: row.note || "",
  };
}

function mapIncomeDepositRowToClient(row) {
  return {
    id: row.id,
    date: row.deposit_date || "",
    source: row.source || "",
    amount: safeNum(row.amount, 0),
    note: row.note || "",
  };
}

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [primaryId, setPrimaryId] = useState("");
  const [bills, setBills] = useState([]);
  const [spendingTx, setSpendingTx] = useState([]);
  const [plannedSpending, setPlannedSpending] = useState([]);
  const [incomeDeposits, setIncomeDeposits] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        if (!supabase) {
          throw new Error("Supabase is not configured. Check your environment variables.");
        }

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

        const now = new Date();
        const monthStart = startOfMonthISO(now);
        const monthEnd = endOfMonthISO(now);

        const [accRes, settingsRes, billsRes, spendingRes, plannedRes, incomeRes] =
          await Promise.all([
            supabase
              .from("accounts")
              .select("*")
              .eq("user_id", currentUser.id)
              .order("updated_at", { ascending: false }),

            supabase
              .from("account_settings")
              .select("*")
              .eq("user_id", currentUser.id)
              .maybeSingle(),

            supabase
              .from("bills")
              .select("*")
              .eq("user_id", currentUser.id)
              .eq("active", true)
              .order("due_date", { ascending: true }),

            supabase
              .from("spending_transactions")
              .select("*")
              .eq("user_id", currentUser.id)
              .gte("tx_date", monthStart)
              .lte("tx_date", monthEnd)
              .order("tx_date", { ascending: true }),

            supabase
              .from("spending_planned_items")
              .select("*")
              .eq("user_id", currentUser.id)
              .gte("planned_date", monthStart)
              .lte("planned_date", monthEnd)
              .order("planned_date", { ascending: true }),

            supabase
              .from("income_deposits")
              .select("*")
              .eq("user_id", currentUser.id)
              .gte("deposit_date", monthStart)
              .lte("deposit_date", monthEnd)
              .order("deposit_date", { ascending: true }),
          ]);

        if (accRes.error) throw accRes.error;
        if (settingsRes.error) throw settingsRes.error;
        if (billsRes.error) throw billsRes.error;
        if (spendingRes.error) throw spendingRes.error;
        if (plannedRes.error) throw plannedRes.error;
        if (incomeRes.error) throw incomeRes.error;

        const loadedAccounts = (accRes.data || []).map(mapAccountRowToClient);
        const loadedBills = (billsRes.data || []).map(mapBillRowToClient);
        const loadedSpending = (spendingRes.data || []).map(mapSpendingTxRowToClient);
        const loadedPlanned = (plannedRes.data || []).map(mapPlannedRowToClient);
        const loadedIncome = (incomeRes.data || []).map(mapIncomeDepositRowToClient);

        const nextPrimary =
          settingsRes.data?.primary_account_id &&
          loadedAccounts.some((a) => a.id === settingsRes.data.primary_account_id)
            ? settingsRes.data.primary_account_id
            : loadedAccounts[0]?.id || "";

        if (!mounted) return;

        setAccounts(loadedAccounts);
        setPrimaryId(nextPrimary);
        setBills(loadedBills);
        setSpendingTx(loadedSpending);
        setPlannedSpending(loadedPlanned);
        setIncomeDeposits(loadedIncome);
        setPageError("");
      } catch (err) {
        if (!mounted) return;
        setPageError(err?.message || "Failed to load dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const computed = useMemo(() => {
    const today = isoDate();
    const thisMonth = monthKeyFromISO(today);

    const primary = accounts.find((a) => a.id === primaryId) || accounts[0] || null;

    const liquidAccounts = accounts.filter((a) =>
      ["checking", "savings", "cash"].includes(String(a.type || "").toLowerCase())
    );
    const creditAccounts = accounts.filter(
      (a) => String(a.type || "").toLowerCase() === "credit"
    );
    const investmentAccounts = accounts.filter(
      (a) => String(a.type || "").toLowerCase() === "investment"
    );

    const liquidTotal = liquidAccounts.reduce((s, a) => s + safeNum(a.balance, 0), 0);
    const debtTotal = creditAccounts.reduce((s, a) => s + safeNum(a.balance, 0), 0);
    const investTotal = investmentAccounts.reduce((s, a) => s + safeNum(a.balance, 0), 0);

    const nonDebtAssets = accounts
      .filter((a) => String(a.type || "").toLowerCase() !== "credit")
      .reduce((s, a) => s + safeNum(a.balance, 0), 0);

    const netWorth = nonDebtAssets - debtTotal;

    const incomeMonth = incomeDeposits.reduce((s, d) => s + safeNum(d.amount, 0), 0);

    const spendingActual = spendingTx
      .filter((t) => String(t.type || "").toLowerCase() === "expense")
      .reduce((s, t) => s + safeNum(t.amount, 0), 0);

    const spendingIncomeLoggedOnSpendingPage = spendingTx
      .filter((t) => String(t.type || "").toLowerCase() === "income")
      .reduce((s, t) => s + safeNum(t.amount, 0), 0);

    const plannedMonth = plannedSpending.reduce((s, p) => s + safeNum(p.amount, 0), 0);

    const activeBills = bills.filter((b) => b.active !== false);

    const billsMonthlyPressure = activeBills.reduce((sum, b) => {
      if (b.type === "controllable") {
        return sum + safeNum(b.minPay, 0) + safeNum(b.extraPay, 0);
      }
      return sum + safeNum(b.amount, 0) * freqToMonthlyMult(b.frequency);
    }, 0);

    const dueSoon = activeBills
      .filter((b) => b.dueDate)
      .map((b) => ({
        ...b,
        dueIn: daysUntil(b.dueDate),
        displayAmount:
          b.type === "controllable"
            ? Math.max(0, safeNum(b.minPay, 0) + safeNum(b.extraPay, 0) || safeNum(b.amount, 0))
            : safeNum(b.amount, 0),
      }))
      .sort((a, b) => {
        const ad = Number.isFinite(a.dueIn) ? a.dueIn : 999999;
        const bd = Number.isFinite(b.dueIn) ? b.dueIn : 999999;
        return ad - bd;
      });

    const dueNextSeven = dueSoon
      .filter((b) => Number.isFinite(b.dueIn) && b.dueIn <= 7)
      .slice(0, 10);

    const dueSoonTotal = dueNextSeven.reduce((s, b) => s + safeNum(b.displayAmount, 0), 0);

    const netMonthCashFlow = incomeMonth - spendingActual - billsMonthlyPressure;
    const projectedMonthCashFlow =
      incomeMonth - spendingActual - plannedMonth - billsMonthlyPressure;

    const burnTotal = spendingActual + billsMonthlyPressure;
    const pressurePct = incomeMonth > 0 ? clamp(pct(burnTotal, incomeMonth), 0, 100) : 0;

    const attention = [];

    if (!accounts.length) {
      attention.push({
        title: "No accounts loaded",
        body: "Add at least one account so this page can show your real position.",
        tone: "bad",
      });
    }

    if (primary && safeNum(primary.balance, 0) < 0) {
      attention.push({
        title: "Primary account is negative",
        body: `${primary.name} is at ${money(primary.balance)}.`,
        tone: "bad",
      });
    }

    if (netMonthCashFlow < 0) {
      attention.push({
        title: "Month cash flow is negative",
        body: `Income minus spending and bills is ${money(netMonthCashFlow)}.`,
        tone: "bad",
      });
    }

    if (projectedMonthCashFlow < 0) {
      attention.push({
        title: "Planned spending makes this worse",
        body: `Projected cash flow falls to ${money(projectedMonthCashFlow)}.`,
        tone: "warn",
      });
    }

    const urgentBill = dueSoon.find((b) => Number.isFinite(b.dueIn) && b.dueIn <= 3);
    if (urgentBill) {
      attention.push({
        title: "Bill due now",
        body: `${urgentBill.name} is ${
          urgentBill.dueIn < 0
            ? `${Math.abs(urgentBill.dueIn)} day(s) late`
            : urgentBill.dueIn === 0
            ? "due today"
            : `due in ${urgentBill.dueIn} day(s)`
        }.`,
        tone: urgentBill.dueIn <= 0 ? "bad" : "warn",
      });
    }

    if (attention.length === 0) {
      attention.push({
        title: "No immediate red flags",
        body: "Nothing major is screaming for attention right now.",
        tone: "good",
      });
    }

    const biggestBill =
      activeBills
        .map((b) => ({
          ...b,
          monthlyValue:
            b.type === "controllable"
              ? safeNum(b.minPay, 0) + safeNum(b.extraPay, 0)
              : safeNum(b.amount, 0) * freqToMonthlyMult(b.frequency),
        }))
        .sort((a, b) => safeNum(b.monthlyValue, 0) - safeNum(a.monthlyValue, 0))[0] || null;

    const incomeSources = [...incomeDeposits].reduce((map, row) => {
      const key = String(row.source || "Income").trim() || "Income";
      map.set(key, (map.get(key) || 0) + safeNum(row.amount, 0));
      return map;
    }, new Map());

    const topIncomeSources = Array.from(incomeSources.entries())
      .map(([source, total]) => ({ source, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);

    const accountMix = [
      {
        label: "Checking",
        value: accounts
          .filter((a) => String(a.type || "").toLowerCase() === "checking")
          .reduce((s, a) => s + safeNum(a.balance, 0), 0),
      },
      {
        label: "Savings",
        value: accounts
          .filter((a) => String(a.type || "").toLowerCase() === "savings")
          .reduce((s, a) => s + safeNum(a.balance, 0), 0),
      },
      {
        label: "Cash",
        value: accounts
          .filter((a) => String(a.type || "").toLowerCase() === "cash")
          .reduce((s, a) => s + safeNum(a.balance, 0), 0),
      },
      {
        label: "Credit",
        value: accounts
          .filter((a) => String(a.type || "").toLowerCase() === "credit")
          .reduce((s, a) => s + safeNum(a.balance, 0), 0),
      },
      {
        label: "Investments",
        value: accounts
          .filter((a) => String(a.type || "").toLowerCase() === "investment")
          .reduce((s, a) => s + safeNum(a.balance, 0), 0),
      },
    ];

    const pressureIncomeBase = Math.max(safeNum(incomeMonth, 0), 0);
    const pressureBills = Math.max(safeNum(billsMonthlyPressure, 0), 0);
    const pressureSpending = Math.max(safeNum(spendingActual, 0), 0);
    const pressureRemaining = Math.max(pressureIncomeBase - pressureBills - pressureSpending, 0);
    const pressureOverflow = Math.max(pressureBills + pressureSpending - pressureIncomeBase, 0);
    const pressureDenominator =
      pressureIncomeBase > 0
        ? pressureIncomeBase
        : Math.max(pressureBills + pressureSpending, 1);

    const pressureBillsPct = pct(pressureBills, pressureDenominator);
    const pressureSpendingPct = pct(pressureSpending, pressureDenominator);
    const pressureRemainingPct = pct(pressureRemaining, pressureDenominator);

    return {
      today,
      thisMonth,
      primary,
      liquidTotal,
      debtTotal,
      investTotal,
      netWorth,
      incomeMonth,
      spendingActual,
      spendingIncomeLoggedOnSpendingPage,
      plannedMonth,
      billsMonthlyPressure,
      netMonthCashFlow,
      projectedMonthCashFlow,
      pressurePct,
      dueSoon,
      dueNextSeven,
      dueSoonTotal,
      attention,
      biggestBill,
      topIncomeSources,
      accountMix,
      accountCount: accounts.length,
      billCount: activeBills.length,
      pressureIncomeBase,
      pressureBills,
      pressureSpending,
      pressureRemaining,
      pressureOverflow,
      pressureBillsPct,
      pressureSpendingPct,
      pressureRemainingPct,
    };
  }, [accounts, primaryId, bills, spendingTx, plannedSpending, incomeDeposits]);

  const heroTone =
    computed.netWorth < 0
      ? "bad"
      : computed.netMonthCashFlow < 0
      ? "warn"
      : "good";

  const shellCard = {
    border: "1px solid rgba(96,165,250,.12)",
    background:
      "radial-gradient(circle at top left, rgba(59,130,246,.08), transparent 42%), linear-gradient(180deg, rgba(10,16,32,.86), rgba(6,11,24,.94))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.03), 0 14px 30px rgba(2,8,23,.18)",
  };

  const actionBtn = {
    textAlign: "center",
    background: "linear-gradient(180deg, rgba(125,182,255,.95), rgba(107,165,245,.92))",
    border: "1px solid rgba(186,217,255,.32)",
    boxShadow: "0 10px 24px rgba(59,130,246,.22), inset 0 1px 0 rgba(255,255,255,.2)",
    color: "#f8fbff",
  };

  if (loading) {
    return (
      <main className="container">
        <div className="card" style={{ padding: 18 }}>
          Loading dashboard...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="container">
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Please log in</div>
          <div className="muted" style={{ marginTop: 8 }}>
            This dashboard is Supabase-backed, so it needs an authenticated user.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <header style={{ marginBottom: 16 }}>
        <div
          className="muted"
          style={{
            fontSize: 12,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            marginBottom: 6,
            color: "rgba(147,197,253,.92)",
          }}
        >
          Dashboard
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(28px, 4.5vw, 42px)",
                lineHeight: 1.02,
                letterSpacing: "-0.03em",
              }}
            >
              Financial Standing
            </h1>
            <div className="muted" style={{ marginTop: 8, maxWidth: 820 }}>
              Total life numbers first. Monthly pressure second. Fast actions only.
            </div>
          </div>

          <div
            className="pill"
            style={{
              padding: "12px 14px",
              borderRadius: 18,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minWidth: 220,
              border: "1px solid rgba(59,130,246,.18)",
              background:
                "radial-gradient(circle at top, rgba(59,130,246,.1), transparent 55%), linear-gradient(180deg, rgba(8,14,28,.94), rgba(6,11,24,.98))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
            }}
          >
            <span className="muted" style={{ fontSize: 12 }}>
              Month
            </span>
            <span style={{ fontWeight: 950, fontSize: 20 }}>
              {fmtMonthLabel(computed.thisMonth)}
            </span>
            <span className="muted" style={{ fontSize: 12 }}>
              Today <b>{computed.today}</b>
            </span>
          </div>
        </div>
      </header>

      {pageError ? (
        <div
          className="card"
          style={{
            padding: 12,
            marginBottom: 16,
            border: "1px solid rgba(239,68,68,.35)",
            background: "rgba(127,29,29,.18)",
          }}
        >
          <div style={{ fontWeight: 900 }}>Dashboard error</div>
          <div className="muted" style={{ marginTop: 6 }}>{pageError}</div>
        </div>
      ) : null}

      <section
        className="card"
        style={{
          ...shellCard,
          padding: 18,
          marginBottom: 14,
          borderRadius: 26,
          overflow: "hidden",
          position: "relative",
          background:
            heroTone === "bad"
              ? "radial-gradient(circle at top left, rgba(239,68,68,.10), transparent 28%), radial-gradient(circle at top right, rgba(59,130,246,.08), transparent 32%), linear-gradient(180deg, rgba(10,16,32,.88), rgba(6,11,24,.98))"
              : heroTone === "warn"
              ? "radial-gradient(circle at top left, rgba(245,158,11,.08), transparent 26%), radial-gradient(circle at top right, rgba(59,130,246,.10), transparent 34%), linear-gradient(180deg, rgba(10,16,32,.88), rgba(6,11,24,.98))"
              : "radial-gradient(circle at top left, rgba(59,130,246,.13), transparent 30%), radial-gradient(circle at top right, rgba(37,99,235,.09), transparent 34%), linear-gradient(180deg, rgba(10,16,32,.88), rgba(6,11,24,.98))",
          border: "1px solid rgba(96,165,250,.14)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1.18fr) minmax(320px,.82fr)",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          <div>
            <div
              className="muted"
              style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}
            >
              Whole life position
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) minmax(220px,.7fr)",
                gap: 18,
                alignItems: "end",
                marginTop: 10,
              }}
            >
              <div>
                <div className="muted" style={{ fontSize: 12 }}>Liquid cash</div>
                <div
                  style={{
                    fontWeight: 950,
                    fontSize: "clamp(34px, 5vw, 56px)",
                    lineHeight: 1,
                    marginTop: 6,
                  }}
                >
                  {money(computed.liquidTotal)}
                </div>
              </div>

              <div>
                <div className="muted" style={{ fontSize: 12 }}>Net worth</div>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: "clamp(24px, 3vw, 34px)",
                    lineHeight: 1.05,
                    marginTop: 8,
                    color: computed.netWorth < 0 ? "rgb(252 165 165)" : "inherit",
                  }}
                >
                  {money(computed.netWorth)}
                </div>
              </div>
            </div>

            <div className="muted" style={{ marginTop: 12, fontSize: 14 }}>
              {computed.primary
                ? `Primary account ${computed.primary.name} • ${typeLabel(computed.primary.type)} • ${money(computed.primary.balance)}`
                : "No primary account selected"}
            </div>

            <div className="muted" style={{ marginTop: 8, fontSize: 14 }}>
              Debt <b>{money(computed.debtTotal)}</b>
              {" • "}
              Investments <b>{money(computed.investTotal)}</b>
              {" • "}
              Accounts <b>{computed.accountCount}</b>
              {" • "}
              Active bills <b>{computed.billCount}</b>
            </div>

            <div
              className="card"
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 18,
                border: "1px solid rgba(96,165,250,.12)",
                background:
                  "radial-gradient(circle at top left, rgba(59,130,246,.08), transparent 35%), linear-gradient(180deg, rgba(8,14,28,.84), rgba(7,12,25,.96))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "baseline",
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14 }}>Financial pressure bar</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Income vs bills vs spending vs remaining
                </div>
              </div>

              <div
                style={{
                  height: 16,
                  width: "100%",
                  borderRadius: 999,
                  overflow: "hidden",
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.06)",
                  display: "flex",
                }}
              >
                {computed.pressureIncomeBase > 0 ? (
                  <>
                    <div
                      title={`Bills ${money(computed.pressureBills)}`}
                      style={{
                        width: `${clamp(computed.pressureBillsPct, 0, 100)}%`,
                        background: "linear-gradient(180deg, rgba(251,191,36,.92), rgba(245,158,11,.84))",
                      }}
                    />
                    <div
                      title={`Spending ${money(computed.pressureSpending)}`}
                      style={{
                        width: `${clamp(computed.pressureSpendingPct, 0, 100)}%`,
                        background: "linear-gradient(180deg, rgba(96,165,250,.96), rgba(59,130,246,.84))",
                      }}
                    />
                    <div
                      title={`Remaining ${money(computed.pressureRemaining)}`}
                      style={{
                        width: `${clamp(computed.pressureRemainingPct, 0, 100)}%`,
                        background: "linear-gradient(180deg, rgba(74,222,128,.92), rgba(34,197,94,.82))",
                      }}
                    />
                  </>
                ) : (
                  <div
                    title={
                      computed.pressureOverflow > 0
                        ? `No income logged / pressure ${money(computed.pressureOverflow)}`
                        : "No income logged"
                    }
                    style={{
                      width: "100%",
                      background:
                        "linear-gradient(180deg, rgba(71,85,105,.76), rgba(51,65,85,.76))",
                    }}
                  />
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <div>
                  <div className="muted" style={{ fontSize: 11 }}>Income</div>
                  <div style={{ fontWeight: 900, marginTop: 4 }}>
                    {money(computed.incomeMonth)}
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 11 }}>Bills</div>
                  <div style={{ fontWeight: 900, marginTop: 4, color: "rgb(253 186 116)" }}>
                    {money(computed.billsMonthlyPressure)}
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 11 }}>Spending</div>
                  <div style={{ fontWeight: 900, marginTop: 4, color: "rgb(147 197 253)" }}>
                    {money(computed.spendingActual)}
                  </div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {computed.netMonthCashFlow >= 0 ? "Remaining" : "Short"}
                  </div>
                  <div
                    style={{
                      fontWeight: 900,
                      marginTop: 4,
                      color:
                        computed.netMonthCashFlow >= 0
                          ? "rgb(134 239 172)"
                          : "rgb(252 165 165)",
                    }}
                  >
                    {money(Math.abs(computed.netMonthCashFlow))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: 14,
              borderRadius: 22,
              border: "1px solid rgba(96,165,250,.14)",
              background:
                "radial-gradient(circle at top left, rgba(59,130,246,.08), transparent 34%), linear-gradient(180deg, rgba(9,15,29,.9), rgba(7,12,25,.98))",
              display: "grid",
              gap: 12,
              alignContent: "start",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)",
            }}
          >
            <div>
              <div className="muted" style={{ fontSize: 12 }}>
                This month pressure
              </div>
              <div style={{ fontWeight: 900, fontSize: 20, marginTop: 4 }}>
                {computed.incomeMonth > 0
                  ? `${Math.round(computed.pressurePct)}% of income`
                  : "No income logged"}
              </div>
            </div>

            <div
              style={{
                height: 10,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.08)",
                overflow: "hidden",
                background: "rgba(255,255,255,.05)",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${clamp(computed.pressurePct, 0, 100)}%`,
                  background:
                    computed.pressurePct >= 100
                      ? "linear-gradient(180deg, rgba(239,68,68,.88), rgba(220,38,38,.82))"
                      : computed.pressurePct >= 80
                      ? "linear-gradient(180deg, rgba(251,191,36,.88), rgba(245,158,11,.82))"
                      : "linear-gradient(180deg, rgba(96,165,250,.92), rgba(59,130,246,.84))",
                }}
              />
            </div>

            <div className="muted" style={{ fontSize: 12 }}>
              Income {money(computed.incomeMonth)} • Spending {money(computed.spendingActual)} • Bills {money(computed.billsMonthlyPressure)}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div
                style={{
                  padding: 10,
                  borderRadius: 16,
                  background: "rgba(255,255,255,.03)",
                  border: "1px solid rgba(96,165,250,.08)",
                }}
              >
                <div className="muted" style={{ fontSize: 11 }}>
                  Month cash flow
                </div>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 18,
                    marginTop: 4,
                    color: computed.netMonthCashFlow < 0 ? "rgb(252 165 165)" : "rgb(134 239 172)",
                  }}
                >
                  {money(computed.netMonthCashFlow)}
                </div>
              </div>

              <div
                style={{
                  padding: 10,
                  borderRadius: 16,
                  background: "rgba(255,255,255,.03)",
                  border: "1px solid rgba(96,165,250,.08)",
                }}
              >
                <div className="muted" style={{ fontSize: 11 }}>
                  Due next 7 days
                </div>
                <div style={{ fontWeight: 900, fontSize: 18, marginTop: 4 }}>
                  {money(computed.dueSoonTotal)}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              <Link className="btn" href="/accounts" style={actionBtn}>
                Accounts
              </Link>
              <Link className="btn" href="/bills" style={actionBtn}>
                Bills
              </Link>
              <Link className="btn" href="/debt" style={actionBtn}>
                Debt
              </Link>
              <Link className="btn" href="/spending" style={actionBtn}>
                Spending
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div className="card" style={{ ...shellCard, padding: 14, borderRadius: 22 }}>
          <div className="muted" style={{ fontSize: 12 }}>Liquid cash</div>
          <div style={{ fontWeight: 950, fontSize: 26, marginTop: 6 }}>
            {money(computed.liquidTotal)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Checking, savings, and cash
          </div>
        </div>

        <div className="card" style={{ ...shellCard, padding: 14, borderRadius: 22 }}>
          <div className="muted" style={{ fontSize: 12 }}>Net worth</div>
          <div
            style={{
              fontWeight: 950,
              fontSize: 26,
              marginTop: 6,
              color: computed.netWorth < 0 ? "rgb(252 165 165)" : "inherit",
            }}
          >
            {money(computed.netWorth)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Assets minus credit debt
          </div>
        </div>

        <div
          className="card"
          style={{
            ...shellCard,
            padding: 14,
            borderRadius: 22,
            border: "1px solid rgba(239,68,68,.12)",
            background:
              "radial-gradient(circle at top left, rgba(239,68,68,.06), transparent 34%), linear-gradient(180deg, rgba(10,16,32,.86), rgba(6,11,24,.94))",
          }}
        >
          <div className="muted" style={{ fontSize: 12 }}>Credit debt</div>
          <div style={{ fontWeight: 950, fontSize: 26, marginTop: 6 }}>
            {money(computed.debtTotal)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Total credit balances
          </div>
        </div>

        <div className="card" style={{ ...shellCard, padding: 14, borderRadius: 22 }}>
          <div className="muted" style={{ fontSize: 12 }}>Investments</div>
          <div style={{ fontWeight: 950, fontSize: 26, marginTop: 6 }}>
            {money(computed.investTotal)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Investment account total
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.08fr) minmax(0,.92fr)",
          gap: 16,
          alignItems: "start",
          marginBottom: 16,
        }}
      >
        <div className="card" style={{ ...shellCard, padding: 16, borderRadius: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "baseline",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Needs attention</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Fast read only. Biggest problems first.
              </div>
            </div>

            <Link className="btn" href="/spending" style={actionBtn}>
              Open Spending
            </Link>
          </div>

          <div style={{ height: 12 }} />

          <div className="grid" style={{ gap: 10 }}>
            {computed.attention.map((item, idx) => (
              <div
                key={`${item.title}-${idx}`}
                className="card"
                style={{
                  padding: 12,
                  borderRadius: 18,
                  border:
                    item.tone === "bad"
                      ? "1px solid rgba(239,68,68,.24)"
                      : item.tone === "warn"
                      ? "1px solid rgba(245,158,11,.24)"
                      : "1px solid rgba(34,197,94,.18)",
                  background:
                    item.tone === "bad"
                      ? "linear-gradient(180deg, rgba(127,29,29,.16), rgba(36,12,18,.12))"
                      : item.tone === "warn"
                      ? "linear-gradient(180deg, rgba(120,53,15,.14), rgba(36,24,12,.1))"
                      : "linear-gradient(180deg, rgba(20,83,45,.12), rgba(10,22,18,.1))",
                }}
              >
                <div style={{ fontWeight: 900 }}>{item.title}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {item.body}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ ...shellCard, padding: 16, borderRadius: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "baseline",
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 18 }}>Bills due soon</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Next 7 days total <b>{money(computed.dueSoonTotal)}</b>
            </div>
          </div>

          <div style={{ height: 12 }} />

          {computed.dueNextSeven.length === 0 ? (
            <div className="card" style={{ padding: 12, borderRadius: 18 }}>
              <div style={{ fontWeight: 900 }}>Nothing immediate</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                No active bills are due in the next 7 days.
              </div>
            </div>
          ) : (
            <>
              <div
                className="grid"
                style={{
                  gap: 10,
                  maxHeight: 330,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                {computed.dueNextSeven.map((b) => (
                  <div
                    key={b.id}
                    className="card"
                    style={{
                      padding: 12,
                      borderRadius: 18,
                      border:
                        b.dueIn <= 0
                          ? "1px solid rgba(239,68,68,.24)"
                          : b.dueIn <= 3
                          ? "1px solid rgba(245,158,11,.24)"
                          : "1px solid rgba(96,165,250,.1)",
                      background:
                        b.dueIn <= 0
                          ? "linear-gradient(180deg, rgba(127,29,29,.14), rgba(36,12,18,.1))"
                          : b.dueIn <= 3
                          ? "linear-gradient(180deg, rgba(120,53,15,.14), rgba(36,24,12,.1))"
                          : "linear-gradient(180deg, rgba(10,16,32,.66), rgba(6,11,24,.82))",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900 }}>{b.name}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                          {fmtShort(b.dueDate)} • {b.type === "controllable" ? "Debt" : "Bill"}
                          {b.autopay ? " • Autopay" : ""}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 900 }}>{money(b.displayAmount)}</div>
                        <div
                          className="muted"
                          style={{
                            fontSize: 12,
                            marginTop: 6,
                            color:
                              b.dueIn <= 0
                                ? "rgb(252 165 165)"
                                : b.dueIn <= 3
                                ? "rgb(253 186 116)"
                                : "rgba(255,255,255,.72)",
                          }}
                        >
                          {b.dueIn < 0
                            ? `${Math.abs(b.dueIn)} day(s) late`
                            : b.dueIn === 0
                            ? "Due today"
                            : `Due in ${b.dueIn} day(s)`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12 }}>
                <Link className="btn" href="/bills" style={{ ...actionBtn, width: "100%" }}>
                  View all bills
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,.96fr) minmax(0,1.04fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card" style={{ ...shellCard, padding: 16, borderRadius: 24 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Life totals breakdown</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Real totals by account type.
            </div>

            <div style={{ height: 12 }} />

            <div className="grid" style={{ gap: 10 }}>
              {computed.accountMix.map((row) => (
                <div
                  key={row.label}
                  className="card"
                  style={{
                    padding: 12,
                    borderRadius: 18,
                    background:
                      row.label === "Credit"
                        ? "linear-gradient(180deg, rgba(127,29,29,.08), rgba(10,16,32,.88))"
                        : "linear-gradient(180deg, rgba(10,16,32,.84), rgba(6,11,24,.95))",
                    border:
                      row.label === "Credit"
                        ? "1px solid rgba(239,68,68,.12)"
                        : "1px solid rgba(96,165,250,.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{row.label}</div>
                    <div
                      style={{
                        fontWeight: 900,
                        color: row.label === "Credit" && row.value > 0 ? "rgb(252 165 165)" : "inherit",
                      }}
                    >
                      {money(row.value)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ ...shellCard, padding: 16, borderRadius: 24 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Quick links</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Jump straight to the page that owns the detail.
            </div>

            <div style={{ height: 12 }} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <Link className="btn" href="/accounts" style={actionBtn}>
                Open Accounts
              </Link>
              <Link className="btn" href="/bills" style={actionBtn}>
                Open Bills
              </Link>
              <Link className="btn" href="/debt" style={actionBtn}>
                Open Debt
              </Link>
              <Link className="btn" href="/income" style={actionBtn}>
                Open Income
              </Link>
              <Link className="btn" href="/spending" style={actionBtn}>
                Open Spending
              </Link>
              <Link className="btn" href="/investments" style={actionBtn}>
                Open Investments
              </Link>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="card" style={{ ...shellCard, padding: 16, borderRadius: 24 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Month breakdown</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Monthly pressure lives here, but it stays secondary.
            </div>

            <div style={{ height: 14 }} />

            <div className="grid" style={{ gap: 12 }}>
              {[
                {
                  label: "Bills pressure",
                  value: computed.billsMonthlyPressure,
                  pct: computed.incomeMonth > 0 ? pct(computed.billsMonthlyPressure, computed.incomeMonth) : 0,
                  fill: "linear-gradient(180deg, rgba(251,191,36,.88), rgba(245,158,11,.82))",
                },
                {
                  label: "Actual spending",
                  value: computed.spendingActual,
                  pct: computed.incomeMonth > 0 ? pct(computed.spendingActual, computed.incomeMonth) : 0,
                  fill: "linear-gradient(180deg, rgba(96,165,250,.92), rgba(59,130,246,.84))",
                },
                {
                  label: "Planned spending",
                  value: computed.plannedMonth,
                  pct: computed.incomeMonth > 0 ? pct(computed.plannedMonth, computed.incomeMonth) : 0,
                  fill: "linear-gradient(180deg, rgba(192,132,252,.88), rgba(168,85,247,.78))",
                },
              ].map((row) => (
                <div key={row.label} style={{ display: "grid", gap: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "baseline",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{row.label}</div>
                    <div className="muted" style={{ fontWeight: 900 }}>
                      {money(row.value)}
                    </div>
                  </div>

                  <div
                    style={{
                      height: 10,
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,.08)",
                      overflow: "hidden",
                      background: "rgba(255,255,255,.05)",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${clamp(row.pct, 0, 100)}%`,
                        background: row.fill,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ height: 14 }} />

            <div
              className="card"
              style={{
                padding: 12,
                borderRadius: 18,
                background:
                  computed.projectedMonthCashFlow < 0
                    ? "linear-gradient(180deg, rgba(127,29,29,.1), rgba(10,16,32,.9))"
                    : "linear-gradient(180deg, rgba(20,83,45,.1), rgba(10,16,32,.9))",
                border:
                  computed.projectedMonthCashFlow < 0
                    ? "1px solid rgba(239,68,68,.14)"
                    : "1px solid rgba(34,197,94,.14)",
              }}
            >
              <div className="muted" style={{ fontSize: 12 }}>Projected after planned spending</div>
              <div
                style={{
                  fontWeight: 950,
                  fontSize: 24,
                  marginTop: 6,
                  color: computed.projectedMonthCashFlow < 0 ? "rgb(252 165 165)" : "rgb(134 239 172)",
                }}
              >
                {money(computed.projectedMonthCashFlow)}
              </div>
            </div>
          </div>

          <div className="card" style={{ ...shellCard, padding: 16, borderRadius: 24 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>What is driving the month</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Kept lower on purpose. Useful, but not dashboard-first.
            </div>

            <div style={{ height: 12 }} />

            <div className="grid" style={{ gap: 10 }}>
              <div
                className="card"
                style={{
                  padding: 12,
                  borderRadius: 18,
                  background: "linear-gradient(180deg, rgba(10,16,32,.84), rgba(6,11,24,.95))",
                  border: "1px solid rgba(96,165,250,.08)",
                }}
              >
                <div className="muted" style={{ fontSize: 12 }}>Largest bill pressure</div>
                <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>
                  {computed.biggestBill ? computed.biggestBill.name : "—"}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {computed.biggestBill
                    ? `${money(
                        computed.biggestBill.type === "controllable"
                          ? safeNum(computed.biggestBill.minPay, 0) + safeNum(computed.biggestBill.extraPay, 0)
                          : safeNum(computed.biggestBill.amount, 0) * freqToMonthlyMult(computed.biggestBill.frequency)
                      )} monthly pressure`
                    : "No bills loaded"}
                </div>
              </div>

              <div
                className="card"
                style={{
                  padding: 12,
                  borderRadius: 18,
                  background: "linear-gradient(180deg, rgba(10,16,32,.84), rgba(6,11,24,.95))",
                  border: "1px solid rgba(96,165,250,.08)",
                }}
              >
                <div className="muted" style={{ fontSize: 12 }}>Income sources</div>
                {computed.topIncomeSources.length === 0 ? (
                  <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>
                    No income logged
                  </div>
                ) : (
                  <div className="grid" style={{ gap: 8, marginTop: 8 }}>
                    {computed.topIncomeSources.map((s) => (
                      <div
                        key={s.source}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>{s.source}</div>
                        <div className="muted" style={{ fontWeight: 900 }}>
                          {money(s.total)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                className="card"
                style={{
                  padding: 12,
                  borderRadius: 18,
                  background: "linear-gradient(180deg, rgba(10,16,32,.84), rgba(6,11,24,.95))",
                  border: "1px solid rgba(96,165,250,.08)",
                }}
              >
                <div className="muted" style={{ fontSize: 12 }}>Spending page income entries</div>
                <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>
                  {money(computed.spendingIncomeLoggedOnSpendingPage)}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Separate from Income page deposits.
                </div>
              </div>
            </div>
          </div>

          {accounts.length === 0 ? (
            <div className="card" style={{ padding: 16, borderRadius: 24 }}>
              <div style={{ fontWeight: 900 }}>Setup required</div>
              <div className="muted" style={{ marginTop: 8 }}>
                Add accounts first so this page can show your actual standing.
              </div>
              <div style={{ height: 12 }} />
              <Link className="btn" href="/accounts" style={actionBtn}>
                Go to Accounts
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}