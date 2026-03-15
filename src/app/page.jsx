"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import InvestmentChart from "@/components/ui/InvestmentChart";

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

/* =========================
   page
========================= */
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

        const [
          accRes,
          settingsRes,
          billsRes,
          spendingRes,
          plannedRes,
          incomeRes,
        ] = await Promise.all([
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

    const liquidTotal = accounts
      .filter((a) => ["checking", "savings", "cash"].includes(String(a.type || "").toLowerCase()))
      .reduce((s, a) => s + safeNum(a.balance, 0), 0);

    const debtTotal = accounts
      .filter((a) => String(a.type || "").toLowerCase() === "credit")
      .reduce((s, a) => s + safeNum(a.balance, 0), 0);

    const investTotal = accounts
      .filter((a) => String(a.type || "").toLowerCase() === "investment")
      .reduce((s, a) => s + safeNum(a.balance, 0), 0);

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

    const dueNextSeven = dueSoon.filter((b) => Number.isFinite(b.dueIn) && b.dueIn <= 7).slice(0, 6);

    const dueSoonTotal = dueNextSeven.reduce((s, b) => s + safeNum(b.displayAmount, 0), 0);

    const netMonthCashFlow = incomeMonth - spendingActual - billsMonthlyPressure;
    const projectedMonthCashFlow = incomeMonth - spendingActual - plannedMonth - billsMonthlyPressure;

    const burnTotal = spendingActual + billsMonthlyPressure;
    const pressurePct = incomeMonth > 0 ? clamp(pct(burnTotal, incomeMonth), 0, 100) : 0;

    const attention = [];

    if (!accounts.length) {
      attention.push({
        title: "No accounts loaded",
        body: "You need at least one account so the dashboard can show where you actually stand.",
        tone: "bad",
      });
    }

    if (primary && safeNum(primary.balance, 0) < 0) {
      attention.push({
        title: "Primary account is negative",
        body: `${primary.name} is sitting at ${money(primary.balance)}.`,
        tone: "bad",
      });
    }

    if (netMonthCashFlow < 0) {
      attention.push({
        title: "This month is running negative",
        body: `Income minus spending and bill pressure is ${money(netMonthCashFlow)}.`,
        tone: "bad",
      });
    }

    if (projectedMonthCashFlow < 0) {
      attention.push({
        title: "Planned spending makes it worse",
        body: `After planned purchases, projected month cash flow drops to ${money(projectedMonthCashFlow)}.`,
        tone: "warn",
      });
    }

    const urgentBill = dueSoon.find((b) => Number.isFinite(b.dueIn) && b.dueIn <= 3);
    if (urgentBill) {
      attention.push({
        title: "Bill due now",
        body: `${urgentBill.name} is due ${
          urgentBill.dueIn < 0
            ? `${Math.abs(urgentBill.dueIn)} day(s) late`
            : urgentBill.dueIn === 0
            ? "today"
            : `in ${urgentBill.dueIn} day(s)`
        }.`,
        tone: urgentBill.dueIn <= 0 ? "bad" : "warn",
      });
    }

    if (attention.length === 0) {
      attention.push({
        title: "No immediate red flags",
        body: "Your numbers are loaded and nothing major is screaming for attention right now.",
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

    const dayMap = new Map();

    incomeDeposits.forEach((d) => {
      const key = d.date || today;
      dayMap.set(key, (dayMap.get(key) || 0) + safeNum(d.amount, 0));
    });

    spendingTx.forEach((t) => {
      const key = t.date || today;
      const amt = safeNum(t.amount, 0);
      if (String(t.type || "").toLowerCase() === "income") {
        dayMap.set(key, (dayMap.get(key) || 0) + amt);
      } else {
        dayMap.set(key, (dayMap.get(key) || 0) - amt);
      }
    });

    const cashFlowChartData = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .reduce((arr, [time, delta]) => {
        const prev = arr.length ? arr[arr.length - 1].value : 0;
        arr.push({
          time,
          value: Number((prev + safeNum(delta, 0)).toFixed(2)),
        });
        return arr;
      }, []);

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
      cashFlowChartData,
    };
  }, [accounts, primaryId, bills, spendingTx, plannedSpending, incomeDeposits]);

  const heroTone =
    !computed.primary
      ? "neutral"
      : safeNum(computed.primary.balance, 0) < 0
      ? "bad"
      : computed.netMonthCashFlow < 0
      ? "warn"
      : "good";

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
            This dashboard is now Supabase-backed, so it needs an authenticated user.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <header style={{ marginBottom: 18 }}>
        <div
          className="muted"
          style={{
            fontSize: 12,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            marginBottom: 6,
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
                fontSize: "clamp(30px, 4.5vw, 46px)",
                lineHeight: 1.02,
                letterSpacing: "-0.03em",
              }}
            >
              Financial Standing
            </h1>
            <div className="muted" style={{ marginTop: 10, maxWidth: 860 }}>
              This is your live status page. Cash. Bills. Income. Spending. Pressure. No filler.
            </div>
          </div>

          <div
            className="pill"
            style={{
              padding: "12px 14px",
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minWidth: 250,
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
          padding: 18,
          marginBottom: 16,
          borderRadius: 24,
          overflow: "hidden",
          position: "relative",
          background:
            heroTone === "bad"
              ? "linear-gradient(180deg, rgba(239,68,68,.12), rgba(255,255,255,.02))"
              : heroTone === "warn"
              ? "linear-gradient(180deg, rgba(245,158,11,.12), rgba(255,255,255,.02))"
              : "linear-gradient(180deg, rgba(59,130,246,.14), rgba(255,255,255,.02))",
          border: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr .8fr",
            gap: 16,
            alignItems: "end",
          }}
        >
          <div>
            <div
              className="muted"
              style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}
            >
              Current standing
            </div>

            <div style={{ marginTop: 8, fontSize: 16, fontWeight: 800 }}>
              {computed.primary ? `${computed.primary.name} • ${typeLabel(computed.primary.type)}` : "No primary account"}
            </div>

            <div
              style={{
                fontWeight: 950,
                fontSize: "clamp(34px, 5vw, 54px)",
                marginTop: 8,
                lineHeight: 1,
              }}
            >
              {computed.primary ? money(computed.primary.balance) : "—"}
            </div>

            <div className="muted" style={{ marginTop: 10, fontSize: 14 }}>
              Liquid total <b>{money(computed.liquidTotal)}</b>
              {" • "}
              Net worth <b>{money(computed.netWorth)}</b>
              {" • "}
              Credit debt <b>{money(computed.debtTotal)}</b>
              {" • "}
              Investments <b>{money(computed.investTotal)}</b>
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: 14,
              borderRadius: 20,
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>Bills + spending pressure</div>
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
                        ? "rgba(239,68,68,.75)"
                        : computed.pressurePct >= 80
                        ? "rgba(245,158,11,.75)"
                        : "rgba(59,130,246,.75)",
                  }}
                />
              </div>

              <div className="muted" style={{ fontSize: 12 }}>
                Actual spending {money(computed.spendingActual)} • Bill pressure {money(computed.billsMonthlyPressure)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="card"
        style={{ padding: 16, borderRadius: 24, marginBottom: 16 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "baseline",
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Cash flow trend</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Real chart from this month’s income and spending activity.
            </div>
          </div>

          <div className="muted" style={{ fontSize: 12 }}>
            Current net month cash flow <b>{money(computed.netMonthCashFlow)}</b>
          </div>
        </div>

        {computed.cashFlowChartData.length >= 2 ? (
          <InvestmentChart data={computed.cashFlowChartData} />
        ) : (
          <div
            className="card"
            style={{
              padding: 16,
              borderRadius: 18,
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,.06)",
            }}
          >
            <div style={{ fontWeight: 900 }}>Not enough chart data yet</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Add at least a couple income or spending entries this month and the chart will populate.
            </div>
          </div>
        )}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div className="card" style={{ padding: 14, borderRadius: 20 }}>
          <div className="muted" style={{ fontSize: 12 }}>Income this month</div>
          <div style={{ fontWeight: 950, fontSize: 28, marginTop: 6 }}>
            {money(computed.incomeMonth)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            From Income page deposits
          </div>
        </div>

        <div className="card" style={{ padding: 14, borderRadius: 20 }}>
          <div className="muted" style={{ fontSize: 12 }}>Bills this month</div>
          <div style={{ fontWeight: 950, fontSize: 28, marginTop: 6 }}>
            {money(computed.billsMonthlyPressure)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Frequency-adjusted monthly pressure
          </div>
        </div>

        <div className="card" style={{ padding: 14, borderRadius: 20 }}>
          <div className="muted" style={{ fontSize: 12 }}>Spending this month</div>
          <div style={{ fontWeight: 950, fontSize: 28, marginTop: 6 }}>
            {money(computed.spendingActual)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Actual expense transactions only
          </div>
        </div>

        <div className="card" style={{ padding: 14, borderRadius: 20 }}>
          <div className="muted" style={{ fontSize: 12 }}>Month cash flow</div>
          <div
            style={{
              fontWeight: 950,
              fontSize: 28,
              marginTop: 6,
              color: computed.netMonthCashFlow < 0 ? "rgb(252 165 165)" : "inherit",
            }}
          >
            {money(computed.netMonthCashFlow)}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Income − spending − bills
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr .95fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card" style={{ padding: 16, borderRadius: 24 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Needs attention</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              The dashboard should tell you what matters, not make you hunt for it.
            </div>

            <div style={{ height: 12 }} />

            <div className="grid" style={{ gap: 12 }}>
              {computed.attention.map((item, idx) => (
                <div
                  key={`${item.title}-${idx}`}
                  className="card"
                  style={{
                    padding: 12,
                    borderRadius: 18,
                    border:
                      item.tone === "bad"
                        ? "1px solid rgba(239,68,68,.28)"
                        : item.tone === "warn"
                        ? "1px solid rgba(245,158,11,.28)"
                        : "1px solid rgba(34,197,94,.22)",
                    background:
                      item.tone === "bad"
                        ? "rgba(239,68,68,.10)"
                        : item.tone === "warn"
                        ? "rgba(245,158,11,.10)"
                        : "rgba(34,197,94,.08)",
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

          <div className="card" style={{ padding: 16, borderRadius: 24 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Month breakdown</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              This pulls the major numbers together from Income, Spending, and Bills.
            </div>

            <div style={{ height: 14 }} />

            <div className="grid" style={{ gap: 12 }}>
              {[
                {
                  label: "Income",
                  value: computed.incomeMonth,
                  pct: computed.incomeMonth > 0 ? 100 : 0,
                  fill: "rgba(34,197,94,.70)",
                },
                {
                  label: "Bills pressure",
                  value: computed.billsMonthlyPressure,
                  pct: computed.incomeMonth > 0 ? pct(computed.billsMonthlyPressure, computed.incomeMonth) : 0,
                  fill: "rgba(245,158,11,.72)",
                },
                {
                  label: "Actual spending",
                  value: computed.spendingActual,
                  pct: computed.incomeMonth > 0 ? pct(computed.spendingActual, computed.incomeMonth) : 0,
                  fill: "rgba(59,130,246,.75)",
                },
                {
                  label: "Planned spending",
                  value: computed.plannedMonth,
                  pct: computed.incomeMonth > 0 ? pct(computed.plannedMonth, computed.incomeMonth) : 0,
                  fill: "rgba(168,85,247,.70)",
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
                background: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.06)",
              }}
            >
              <div className="muted" style={{ fontSize: 12 }}>Projected after planned spending</div>
              <div
                style={{
                  fontWeight: 950,
                  fontSize: 24,
                  marginTop: 6,
                  color: computed.projectedMonthCashFlow < 0 ? "rgb(252 165 165)" : "inherit",
                }}
              >
                {money(computed.projectedMonthCashFlow)}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="card" style={{ padding: 16, borderRadius: 24 }}>
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
              <div className="grid" style={{ gap: 10 }}>
                {computed.dueNextSeven.map((b) => (
                  <div
                    key={b.id}
                    className="card"
                    style={{
                      padding: 12,
                      borderRadius: 18,
                      border:
                        b.dueIn <= 0
                          ? "1px solid rgba(239,68,68,.28)"
                          : b.dueIn <= 3
                          ? "1px solid rgba(245,158,11,.28)"
                          : "1px solid rgba(255,255,255,.06)",
                      background:
                        b.dueIn <= 0
                          ? "rgba(239,68,68,.10)"
                          : b.dueIn <= 3
                          ? "rgba(245,158,11,.10)"
                          : "rgba(255,255,255,.025)",
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
            )}
          </div>

          <div className="card" style={{ padding: 16, borderRadius: 24 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>What is driving the month</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Biggest pressure points from your real data.
            </div>

            <div style={{ height: 12 }} />

            <div className="grid" style={{ gap: 10 }}>
              <div
                className="card"
                style={{
                  padding: 12,
                  borderRadius: 18,
                  background: "rgba(255,255,255,.03)",
                  border: "1px solid rgba(255,255,255,.06)",
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
                  background: "rgba(255,255,255,.03)",
                  border: "1px solid rgba(255,255,255,.06)",
                }}
              >
                <div className="muted" style={{ fontSize: 12 }}>Income sources</div>
                {computed.topIncomeSources.length === 0 ? (
                  <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>No income logged</div>
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
                  background: "rgba(255,255,255,.03)",
                  border: "1px solid rgba(255,255,255,.06)",
                }}
              >
                <div className="muted" style={{ fontSize: 12 }}>Spending page income entries</div>
                <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>
                  {money(computed.spendingIncomeLoggedOnSpendingPage)}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  This is separate from Income page deposits.
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
              <Link className="btn" href="/accounts">Go to Accounts</Link>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}