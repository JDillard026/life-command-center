"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "One Time" },
];

const BILL_TYPE_OPTIONS = [
  { value: "noncontrollable", label: "Fixed Bill" },
  { value: "controllable", label: "Debt / Controllable" },
];

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function shortDate(iso) {
  const d = toDate(iso);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function num(value, fallback = 0) {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function frequencyMultiplier(freq) {
  if (freq === "weekly") return 4.333;
  if (freq === "biweekly") return 2.167;
  if (freq === "monthly") return 1;
  if (freq === "quarterly") return 1 / 3;
  if (freq === "yearly") return 1 / 12;
  return 0;
}

function monthlyEquivalent(bill) {
  if (!bill?.active) return 0;

  if (bill.type === "controllable") {
    const minPay = Number(bill.minPay) || 0;
    const extraPay = Number(bill.extraPay) || 0;
    const fallback = Number(bill.amount) || 0;
    return minPay + extraPay > 0 ? minPay + extraPay : fallback;
  }

  return (Number(bill.amount) || 0) * frequencyMultiplier(bill.frequency);
}

function daysUntil(iso) {
  const d = toDate(iso);
  if (!d) return null;
  const now = toDate(todayISO());
  const ms = d.getTime() - now.getTime();
  return Math.ceil(ms / 86400000);
}

function dueTone(days) {
  if (days == null) return "neutral";
  if (days < 0) return "red";
  if (days <= 3) return "red";
  if (days <= 7) return "amber";
  return "green";
}

function dueLabel(days) {
  if (days == null) return "No due date";
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

function formatMonths(n) {
  if (n == null) return "No payoff";
  if (n <= 0) return "Paid";
  const years = Math.floor(n / 12);
  const months = n % 12;
  if (years <= 0) return `${months} mo`;
  if (months === 0) return `${years} yr`;
  return `${years} yr ${months} mo`;
}

function payoffSimulation(balance, aprPct, monthlyPay) {
  let current = Number(balance) || 0;
  const apr = Number(aprPct) || 0;
  const pay = Number(monthlyPay) || 0;

  if (current <= 0) {
    return {
      months: 0,
      totalInterest: 0,
      payoffDate: todayISO(),
      impossible: false,
    };
  }

  if (pay <= 0) {
    return {
      months: null,
      totalInterest: null,
      payoffDate: null,
      impossible: true,
    };
  }

  const monthlyRate = apr / 100 / 12;
  let months = 0;
  let totalInterest = 0;

  while (current > 0.01 && months < 600) {
    const interest = current * monthlyRate;
    totalInterest += interest;
    current = current + interest - pay;
    months += 1;

    if (monthlyRate > 0 && pay <= interest) {
      return {
        months: null,
        totalInterest: null,
        payoffDate: null,
        impossible: true,
      };
    }
  }

  if (months >= 600) {
    return {
      months: null,
      totalInterest: null,
      payoffDate: null,
      impossible: true,
    };
  }

  const d = new Date();
  d.setMonth(d.getMonth() + months);

  return {
    months,
    totalInterest,
    payoffDate: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    impossible: false,
  };
}

function mapBillRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "",
    type: row.type || "noncontrollable",
    frequency: row.frequency || "monthly",
    dueDate: row.due_date || "",
    amount: Number(row.amount) || 0,
    active: row.active !== false,
    notes: row.notes || "",
    balance: Number(row.balance) || 0,
    aprPct: Number(row.apr_pct) || 0,
    minPay: Number(row.min_pay) || 0,
    extraPay: Number(row.extra_pay) || 0,
    lastPaidDate: row.last_paid_date || "",
    autopay: row.autopay === true,
    category: row.category || "",
    accountId: row.account_id || "",
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function mapBillClientToRow(bill, userId) {
  return {
    id: bill.id,
    user_id: userId,
    name: bill.name,
    type: bill.type,
    frequency: bill.frequency,
    due_date: bill.dueDate || null,
    amount: Number(bill.amount) || 0,
    active: bill.active !== false,
    notes: bill.notes || "",
    balance: bill.type === "controllable" ? Number(bill.balance) || 0 : null,
    apr_pct: bill.type === "controllable" ? Number(bill.aprPct) || 0 : null,
    min_pay: bill.type === "controllable" ? Number(bill.minPay) || 0 : null,
    extra_pay: bill.type === "controllable" ? Number(bill.extraPay) || 0 : null,
    last_paid_date: bill.lastPaidDate || null,
    autopay: bill.type === "controllable" ? bill.autopay === true : false,
    category: bill.category || null,
    account_id: bill.accountId || null,
    updated_at: new Date().toISOString(),
  };
}

function ProgressBar({ value = 0, tone = "green" }) {
  const pct = clamp(value, 0, 100);
  const colors = {
    green: "#4ade80",
    amber: "#f59e0b",
    red: "#ff6b7f",
    neutral: "#93a9d8",
  };

  const color = colors[tone] || colors.green;

  return (
    <div className="billProgress">
      <div
        className="billProgressFill"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color} 0%, rgba(255,255,255,.92) 220%)`,
          boxShadow: `0 0 18px ${color}44, 0 0 24px ${color}18`,
        }}
      />
    </div>
  );
}

function StatCard({ label, value, sub, tone = "neutral" }) {
  return (
    <article className={`billStat billTone_${tone}`}>
      <div className="billStatLabel">{label}</div>
      <div className="billStatValue">{value}</div>
      <div className="billStatSub">{sub}</div>
    </article>
  );
}

function TonePill({ tone = "neutral", children }) {
  return <span className={`tonePill tonePill_${tone}`}>{children}</span>;
}

function SectionCard({ title, text, action, children, compact = false }) {
  return (
    <section className={`billCard ${compact ? "billCard_compact" : ""}`}>
      <div className="billCardHead">
        <div>
          <div className="billEyebrow">{compact ? "SECTION" : "BILLS"}</div>
          <h2 className={compact ? "billSectionMini" : "billSectionTitle"}>{title}</h2>
          {text ? <div className="billSectionText">{text}</div> : null}
        </div>
        {action ? <div className="billCardAction">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export default function BillsPage() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [pageError, setPageError] = React.useState("");

  const [tab, setTab] = React.useState("overview");
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");

  const [bills, setBills] = React.useState([]);
  const [accounts, setAccounts] = React.useState([]);

  const [formType, setFormType] = React.useState("noncontrollable");
  const [formName, setFormName] = React.useState("");
  const [formFrequency, setFormFrequency] = React.useState("monthly");
  const [formDueDate, setFormDueDate] = React.useState("");
  const [formAmount, setFormAmount] = React.useState("");
  const [formCategory, setFormCategory] = React.useState("");
  const [formNotes, setFormNotes] = React.useState("");
  const [formAccountId, setFormAccountId] = React.useState("");
  const [formBalance, setFormBalance] = React.useState("");
  const [formAprPct, setFormAprPct] = React.useState("");
  const [formMinPay, setFormMinPay] = React.useState("");
  const [formExtraPay, setFormExtraPay] = React.useState("");
  const [formAutopay, setFormAutopay] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    async function loadPage() {
      try {
        setPageError("");

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

        const [billsRes, accountsRes] = await Promise.all([
          supabase
            .from("bills")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("active", { ascending: false })
            .order("due_date", { ascending: true }),
          supabase
            .from("accounts")
            .select("id,name")
            .eq("user_id", currentUser.id)
            .order("name", { ascending: true }),
        ]);

        if (billsRes.error) throw billsRes.error;
        if (!mounted) return;

        setBills((billsRes.data || []).map(mapBillRowToClient));
        setAccounts(accountsRes.error ? [] : accountsRes.data || []);
      } catch (err) {
        if (!mounted) return;
        setPageError(err?.message || "Failed to load bills page.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPage();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredBills = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return bills
      .filter((bill) => {
        if (filter === "controllable") return bill.type === "controllable";
        if (filter === "noncontrollable") return bill.type === "noncontrollable";
        if (filter === "active") return bill.active;
        if (filter === "due") {
          const d = daysUntil(bill.dueDate);
          return d != null && d <= 7;
        }
        return true;
      })
      .filter((bill) => {
        if (!q) return true;
        return `${bill.name} ${bill.type} ${bill.frequency} ${bill.notes} ${bill.category}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const aDays = daysUntil(a.dueDate);
        const bDays = daysUntil(b.dueDate);

        if (a.active !== b.active) return a.active ? -1 : 1;
        if (aDays == null && bDays != null) return 1;
        if (aDays != null && bDays == null) return -1;
        if (aDays != null && bDays != null && aDays !== bDays) return aDays - bDays;
        return monthlyEquivalent(b) - monthlyEquivalent(a);
      });
  }, [bills, filter, search]);

  const activeBills = React.useMemo(() => bills.filter((bill) => bill.active), [bills]);

  const controllableBills = React.useMemo(
    () => bills.filter((bill) => bill.active && bill.type === "controllable"),
    [bills]
  );

  const fixedBills = React.useMemo(
    () => bills.filter((bill) => bill.active && bill.type === "noncontrollable"),
    [bills]
  );

  const monthlyPressure = React.useMemo(
    () => bills.reduce((sum, bill) => sum + monthlyEquivalent(bill), 0),
    [bills]
  );

  const totalDebt = React.useMemo(
    () => controllableBills.reduce((sum, bill) => sum + (Number(bill.balance) || 0), 0),
    [controllableBills]
  );

  const dueSoon = React.useMemo(
    () =>
      bills.filter((bill) => {
        if (!bill.active) return false;
        const d = daysUntil(bill.dueDate);
        return d != null && d <= 7;
      }),
    [bills]
  );

  const overdueCount = React.useMemo(
    () =>
      bills.filter((bill) => {
        if (!bill.active) return false;
        const d = daysUntil(bill.dueDate);
        return d != null && d < 0;
      }).length,
    [bills]
  );

  const strongestPressure = React.useMemo(() => {
    if (!activeBills.length) return null;
    return [...activeBills].sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))[0];
  }, [activeBills]);

  const payoffRows = React.useMemo(() => {
    return controllableBills
      .map((bill) => {
        const monthlyPay =
          (Number(bill.minPay) || 0) + (Number(bill.extraPay) || 0) || Number(bill.amount) || 0;
        const payoff = payoffSimulation(bill.balance, bill.aprPct, monthlyPay);

        return {
          ...bill,
          monthlyPay,
          payoff,
          progress:
            bill.balance > 0 && monthlyPay > 0
              ? clamp((monthlyPay / bill.balance) * 100 * 12, 0, 100)
              : 0,
        };
      })
      .sort((a, b) => {
        if (a.payoff.impossible && !b.payoff.impossible) return 1;
        if (!a.payoff.impossible && b.payoff.impossible) return -1;
        return (a.payoff.months ?? 9999) - (b.payoff.months ?? 9999);
      });
  }, [controllableBills]);

  function resetForm() {
    setFormType("noncontrollable");
    setFormName("");
    setFormFrequency("monthly");
    setFormDueDate("");
    setFormAmount("");
    setFormCategory("");
    setFormNotes("");
    setFormAccountId("");
    setFormBalance("");
    setFormAprPct("");
    setFormMinPay("");
    setFormExtraPay("");
    setFormAutopay(false);
    setPageError("");
  }

  function validateForm() {
    const name = formName.trim();
    if (!name) return "Name is required.";

    const amount = num(formAmount, NaN);
    if (!Number.isFinite(amount) || amount < 0) return "Enter a valid amount.";

    if (formType === "controllable") {
      const balance = num(formBalance, NaN);
      if (!Number.isFinite(balance) || balance < 0) return "Enter a valid balance.";
    }

    return "";
  }

  async function addBill() {
    if (!user || saving) return;

    const validationError = validateForm();
    if (validationError) {
      setPageError(validationError);
      return;
    }

    setSaving(true);
    setPageError("");

    try {
      const draft = {
        id: makeId(),
        name: formName.trim(),
        type: formType,
        frequency: formFrequency,
        dueDate: formDueDate,
        amount: num(formAmount, 0),
        active: true,
        notes: formNotes.trim(),
        balance: num(formBalance, 0),
        aprPct: num(formAprPct, 0),
        minPay: num(formMinPay, 0),
        extraPay: num(formExtraPay, 0),
        lastPaidDate: "",
        autopay: formAutopay,
        category: formCategory.trim(),
        accountId: formAccountId || "",
      };

      const { data, error } = await supabase
        .from("bills")
        .insert([mapBillClientToRow(draft, user.id)])
        .select()
        .single();

      if (error) throw error;

      setBills((prev) => [mapBillRowToClient(data), ...prev]);
      resetForm();
    } catch (err) {
      setPageError(err?.message || "Failed to save bill.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBill(id) {
    if (!user) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this bill?")) return;

    const previous = bills;
    setBills((prev) => prev.filter((bill) => bill.id !== id));

    try {
      const { error } = await supabase.from("bills").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    } catch (err) {
      setBills(previous);
      setPageError(err?.message || "Failed to delete bill.");
    }
  }

  async function toggleActive(bill) {
    if (!user) return;

    const previous = bills;
    const next = !bill.active;

    setBills((prev) => prev.map((item) => (item.id === bill.id ? { ...item, active: next } : item)));

    try {
      const { error } = await supabase
        .from("bills")
        .update({
          active: next,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bill.id)
        .eq("user_id", user.id);

      if (error) throw error;
    } catch (err) {
      setBills(previous);
      setPageError(err?.message || "Failed to update bill.");
    }
  }

  async function markPaidToday(bill) {
    if (!user) return;

    const previous = bills;
    const nextDate = todayISO();

    setBills((prev) =>
      prev.map((item) => (item.id === bill.id ? { ...item, lastPaidDate: nextDate } : item))
    );

    try {
      const { error } = await supabase
        .from("bills")
        .update({
          last_paid_date: nextDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bill.id)
        .eq("user_id", user.id);

      if (error) throw error;
    } catch (err) {
      setBills(previous);
      setPageError(err?.message || "Failed to mark bill as paid.");
    }
  }

  const pageStyles = (
    <style jsx global>{`
      .billsPage {
        --bill-text: #f5f8ff;
        --bill-muted: rgba(219, 231, 255, 0.72);
        --bill-soft: rgba(219, 231, 255, 0.52);
        --bill-line: rgba(147, 175, 255, 0.14);
        --bill-fill: rgba(7, 11, 18, 0.66);
        --bill-fill-2: rgba(10, 15, 26, 0.82);
        color: var(--bill-text);
      }

      .billsPage *,
      .billsPage *::before,
      .billsPage *::after {
        box-sizing: border-box;
      }

      .billsShell {
        width: 100%;
        padding: 14px 0 44px;
        display: grid;
        gap: 16px;
      }

      .billsHero,
      .billCard,
      .billStat {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
        border: 1px solid var(--bill-line);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
          var(--bill-fill);
        backdrop-filter: blur(18px);
        box-shadow:
          0 20px 60px rgba(0, 0, 0, 0.28),
          inset 0 1px 0 rgba(255, 255, 255, 0.05);
      }

      .billsHero::before,
      .billCard::before,
      .billStat::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at top left, rgba(80, 120, 255, 0.08), transparent 28%),
          radial-gradient(circle at 84% 12%, rgba(74, 222, 128, 0.05), transparent 24%),
          radial-gradient(circle at bottom center, rgba(255, 107, 127, 0.03), transparent 28%);
      }

      .billsHero {
        padding: 26px;
      }

      .billsHeroTop {
        position: relative;
        z-index: 1;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        flex-wrap: wrap;
      }

      .billEyebrow {
        color: var(--bill-soft);
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 10px;
      }

      .billsTitle {
        margin: 0;
        font-size: clamp(2rem, 4vw, 4rem);
        line-height: 0.95;
        letter-spacing: -0.045em;
        font-weight: 950;
      }

      .billsSub {
        margin-top: 12px;
        max-width: 880px;
        color: var(--bill-muted);
        line-height: 1.6;
        font-size: 0.95rem;
      }

      .chipRow,
      .heroActions,
      .billActionRow,
      .buttonRow {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .heroChip,
      .tonePill {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 0 12px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 800;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .heroChip {
        color: #edf3ff;
        background: rgba(255, 255, 255, 0.05);
      }

      .tonePill_neutral {
        color: #dbe7ff;
        background: rgba(147, 175, 255, 0.1);
        border-color: rgba(147, 175, 255, 0.16);
      }

      .tonePill_green {
        color: #bdf7cf;
        background: rgba(74, 222, 128, 0.11);
        border-color: rgba(74, 222, 128, 0.18);
      }

      .tonePill_amber {
        color: #ffe2a5;
        background: rgba(245, 158, 11, 0.12);
        border-color: rgba(245, 158, 11, 0.18);
      }

      .tonePill_red {
        color: #ffd0d7;
        background: rgba(255, 107, 127, 0.11);
        border-color: rgba(255, 107, 127, 0.18);
      }

      .tabGroup,
      .typeGroup {
        display: inline-flex;
        gap: 6px;
        padding: 4px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .tabBtn,
      .typeBtn,
      .ghostBtn,
      .solidBtn,
      .dangerBtn {
        min-height: 42px;
        padding: 0 15px;
        border-radius: 14px;
        font-size: 0.84rem;
        font-weight: 800;
        letter-spacing: 0.01em;
        cursor: pointer;
        transition:
          transform 0.18s ease,
          background 0.18s ease,
          border-color 0.18s ease,
          opacity 0.18s ease;
      }

      .tabBtn:hover,
      .typeBtn:hover,
      .ghostBtn:hover,
      .solidBtn:hover,
      .dangerBtn:hover {
        transform: translateY(-1px);
      }

      .tabBtn,
      .typeBtn,
      .ghostBtn {
        color: #eef4ff;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
      }

      .tabBtn.active,
      .typeBtn.active {
        color: #08111f;
        background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(233,237,246,0.92));
        border-color: rgba(255, 255, 255, 0.14);
      }

      .solidBtn {
        color: #f7f9ff;
        border: 1px solid rgba(130, 170, 255, 0.24);
        background: linear-gradient(180deg, rgba(77, 124, 255, 0.22), rgba(32, 74, 189, 0.12));
      }

      .dangerBtn {
        color: #ffd3dd;
        border: 1px solid rgba(255, 107, 127, 0.22);
        background: rgba(255, 107, 127, 0.08);
      }

      .metricGrid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
      }

      .billStat {
        padding: 20px;
        min-height: 160px;
      }

      .billStatLabel {
        position: relative;
        z-index: 1;
        color: var(--bill-soft);
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .billStatValue {
        position: relative;
        z-index: 1;
        margin-top: 14px;
        font-size: clamp(1.8rem, 3vw, 3rem);
        line-height: 1;
        letter-spacing: -0.04em;
        font-weight: 950;
      }

      .billStatSub {
        position: relative;
        z-index: 1;
        margin-top: 12px;
        color: var(--bill-muted);
        line-height: 1.55;
        font-size: 0.88rem;
      }

      .billTone_green .billStatValue {
        color: #bdf7cf;
      }

      .billTone_amber .billStatValue {
        color: #ffe2a5;
      }

      .billTone_red .billStatValue {
        color: #ffd0d7;
      }

      .overviewGridTop,
      .overviewGridBottom,
      .manageGrid {
        display: grid;
        gap: 16px;
      }

      .overviewGridTop {
        grid-template-columns: minmax(0, 1.35fr) minmax(380px, 0.95fr);
      }

      .overviewGridBottom,
      .manageGrid {
        grid-template-columns: minmax(0, 1.3fr) minmax(340px, 0.9fr);
      }

      .billCard {
        padding: 20px;
        display: grid;
        gap: 14px;
      }

      .billCard_compact {
        gap: 12px;
      }

      .billCardHead {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
      }

      .billCardAction {
        flex: 0 0 auto;
      }

      .billSectionTitle,
      .billSectionMini {
        margin: 0;
        line-height: 1;
        letter-spacing: -0.03em;
        font-weight: 900;
      }

      .billSectionTitle {
        font-size: 2rem;
      }

      .billSectionMini {
        font-size: 1.2rem;
      }

      .billSectionText {
        margin-top: 8px;
        color: var(--bill-muted);
        line-height: 1.55;
        font-size: 0.88rem;
      }

      .errorBar {
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid rgba(255, 107, 127, 0.24);
        background: rgba(83, 24, 24, 0.72);
        color: #ffd5d5;
        font-weight: 700;
      }

      .fieldGrid2,
      .fieldGrid4,
      .metaGrid,
      .sideStack,
      .cardList,
      .formStack {
        display: grid;
        gap: 12px;
      }

      .fieldGrid2 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .fieldGrid4 {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .metaGrid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .sideStack,
      .cardList,
      .formStack {
        grid-template-columns: 1fr;
      }

      .fieldWrap {
        min-width: 0;
      }

      .fieldLabel {
        color: var(--bill-soft);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.66rem;
        font-weight: 800;
        margin-bottom: 8px;
      }

      .field,
      .select,
      .textarea {
        width: 100%;
        min-height: 48px;
        border-radius: 16px;
        border: 1px solid rgba(177, 196, 255, 0.14);
        background: rgba(8, 13, 24, 0.54) !important;
        color: #f4f7ff !important;
        font-size: 0.92rem;
        font-weight: 600;
        padding: 0 14px;
        outline: none;
        transition: border-color 0.18s ease, box-shadow 0.18s ease;
      }

      .textarea {
        min-height: 108px;
        padding: 12px 14px;
        resize: vertical;
      }

      .field::placeholder,
      .textarea::placeholder {
        color: rgba(233, 238, 255, 0.44) !important;
      }

      .field:focus,
      .select:focus,
      .textarea:focus {
        border-color: rgba(121, 163, 255, 0.36);
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.08);
      }

      .select option {
        background: #08111f;
        color: #f4f7ff;
      }

      .checkRow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: var(--bill-muted);
        font-size: 0.92rem;
        font-weight: 700;
      }

      .billItem,
      .payoffItem {
        position: relative;
        overflow: hidden;
        border-radius: 22px;
        border: 1px solid rgba(255, 255, 255, 0.055);
        background: linear-gradient(180deg, rgba(10, 16, 28, 0.38), rgba(5, 9, 17, 0.14));
        padding: 16px;
      }

      .billItemHead {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        flex-wrap: wrap;
      }

      .billName {
        font-size: 1.02rem;
        font-weight: 900;
        line-height: 1.15;
      }

      .billNameSub {
        margin-top: 5px;
        color: var(--bill-muted);
        font-size: 0.86rem;
        line-height: 1.45;
      }

      .miniMeta {
        text-align: right;
      }

      .miniMetaValue {
        font-weight: 900;
      }

      .miniMetaSub {
        margin-top: 6px;
        color: var(--bill-muted);
        font-size: 0.84rem;
      }

      .billProgress {
        height: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
      }

      .billProgressFill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.45s ease;
      }

      .emptyState {
        border-radius: 18px;
        border: 1px dashed rgba(255, 255, 255, 0.1);
        padding: 16px;
        color: var(--bill-muted);
        background: rgba(255, 255, 255, 0.018);
      }

      .goodText {
        color: #bdf7cf;
        font-weight: 900;
      }

      .badText {
        color: #ffd0d7;
        font-weight: 900;
      }

      .warnText {
        color: #ffe2a5;
        font-weight: 900;
      }

      @media (max-width: 1260px) {
        .metricGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .overviewGridTop,
        .overviewGridBottom,
        .manageGrid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 900px) {
        .fieldGrid2,
        .fieldGrid4,
        .metaGrid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 680px) {
        .billsHero,
        .billCard,
        .billStat {
          border-radius: 22px;
        }

        .billsHero,
        .billCard,
        .billStat {
          padding: 16px;
        }

        .metricGrid {
          grid-template-columns: 1fr;
        }

        .billsTitle {
          font-size: 2.2rem;
        }

        .billSectionTitle {
          font-size: 1.55rem;
        }

        .billCardHead {
          flex-direction: column;
          align-items: stretch;
        }

        .tabGroup,
        .typeGroup {
          width: 100%;
          overflow-x: auto;
        }

        .tabBtn,
        .typeBtn {
          white-space: nowrap;
        }
      }
    `}</style>
  );

  if (loading) {
    return (
      <main className="billsPage">
        {pageStyles}
        <div className="billsShell">
          <header className="billsHero">
            <div className="billsHeroTop">
              <div>
                <div className="billEyebrow">Debt + Bills Control</div>
                <h1 className="billsTitle">Bills Center</h1>
                <div className="billsSub">Loading your bill pressure, debt stack, and due dates.</div>
              </div>
            </div>
          </header>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="billsPage">
        {pageStyles}
        <div className="billsShell">
          <header className="billsHero">
            <div className="billsHeroTop">
              <div>
                <div className="billEyebrow">Debt + Bills Control</div>
                <h1 className="billsTitle">Bills Center</h1>
                <div className="billsSub">This page needs an authenticated user.</div>
              </div>
            </div>
          </header>
        </div>
      </main>
    );
  }

  return (
    <main className="billsPage">
      {pageStyles}

      <div className="billsShell">
        <header className="billsHero">
          <div className="billsHeroTop">
            <div>
              <div className="billEyebrow">Debt + Bills Control</div>
              <h1 className="billsTitle">Bills Center</h1>
              <div className="billsSub">
                Premium dark glass, stronger signal colors, wider scanning lanes, and mobile-first layout that still
                feels like a real finance product.
              </div>

              <div className="chipRow" style={{ marginTop: 14 }}>
                <span className="heroChip">{bills.length} total</span>
                <span className="heroChip">{controllableBills.length} debts</span>
                <span className="heroChip">{fixedBills.length} fixed</span>
                <span className="heroChip">{dueSoon.length} due soon</span>
              </div>
            </div>

            <div className="tabGroup">
              <button
                type="button"
                className={`tabBtn ${tab === "overview" ? "active" : ""}`}
                onClick={() => setTab("overview")}
              >
                Overview
              </button>
              <button
                type="button"
                className={`tabBtn ${tab === "manage" ? "active" : ""}`}
                onClick={() => setTab("manage")}
              >
                Manage
              </button>
            </div>
          </div>
        </header>

        {pageError ? <div className="errorBar">{pageError}</div> : null}

        <section className="metricGrid">
          <StatCard
            label="Monthly Pressure"
            value={money(monthlyPressure)}
            sub="Normalized monthly hit from fixed bills and debt payments."
            tone="neutral"
          />
          <StatCard
            label="Total Debt"
            value={money(totalDebt)}
            sub="Active controllable balance across your debt accounts."
            tone="red"
          />
          <StatCard
            label="Due Soon"
            value={dueSoon.length}
            sub={overdueCount > 0 ? `${overdueCount} overdue right now.` : "Nothing overdue right now."}
            tone={overdueCount > 0 ? "red" : "amber"}
          />
          <StatCard
            label="Highest Pressure"
            value={strongestPressure ? money(monthlyEquivalent(strongestPressure)) : "$0.00"}
            sub={strongestPressure ? strongestPressure.name : "No active bills yet."}
            tone="green"
          />
        </section>

        {tab === "overview" ? (
          <>
            <section className="overviewGridTop">
              <SectionCard
                title="Pressure Board"
                text="See what is due first and what is hitting the hardest."
                action={<span className="heroChip">Active first</span>}
              >
                <div className="cardList">
                  {!activeBills.length ? (
                    <div className="emptyState">No active bills yet.</div>
                  ) : (
                    [...activeBills]
                      .sort((a, b) => {
                        const ad = daysUntil(a.dueDate);
                        const bd = daysUntil(b.dueDate);
                        if (ad == null && bd != null) return 1;
                        if (ad != null && bd == null) return -1;
                        if (ad != null && bd != null && ad !== bd) return ad - bd;
                        return monthlyEquivalent(b) - monthlyEquivalent(a);
                      })
                      .slice(0, 8)
                      .map((bill) => {
                        const due = daysUntil(bill.dueDate);
                        const tone = dueTone(due);
                        const pressure = monthlyPressure > 0 ? (monthlyEquivalent(bill) / monthlyPressure) * 100 : 0;

                        return (
                          <div key={bill.id} className="billItem">
                            <div className="billItemHead">
                              <div>
                                <div className="billName">{bill.name}</div>
                                <div className="billNameSub">
                                  {bill.type === "controllable" ? "Debt / Controllable" : "Fixed Bill"} •{" "}
                                  {bill.frequency || "monthly"} • Due {bill.dueDate ? shortDate(bill.dueDate) : "—"}
                                </div>
                              </div>

                              <TonePill tone={tone}>{dueLabel(due)}</TonePill>
                            </div>

                            <div style={{ marginTop: 12 }}>
                              <ProgressBar value={pressure} tone={tone} />
                            </div>

                            <div className="metaGrid" style={{ marginTop: 12 }}>
                              <div>
                                <div className="fieldLabel">Monthly Hit</div>
                                <div className="miniMetaValue">{money(monthlyEquivalent(bill))}</div>
                              </div>

                              <div>
                                <div className="fieldLabel">{bill.type === "controllable" ? "Balance" : "Amount"}</div>
                                <div className="miniMetaValue">
                                  {bill.type === "controllable" ? money(bill.balance) : money(bill.amount)}
                                </div>
                              </div>

                              <div>
                                <div className="fieldLabel">Last Paid</div>
                                <div className="miniMetaValue">
                                  {bill.lastPaidDate ? shortDate(bill.lastPaidDate) : "—"}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Quick Add"
                text="Add a fixed bill or debt account without making the page feel cramped."
                action={
                  <div className="typeGroup">
                    {BILL_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`typeBtn ${formType === option.value ? "active" : ""}`}
                        onClick={() => setFormType(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="formStack">
                  <div className="fieldGrid2">
                    <div className="fieldWrap">
                      <div className="fieldLabel">Name</div>
                      <input
                        className="field"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Chase Card, Rent, Insurance..."
                      />
                    </div>

                    <div className="fieldWrap">
                      <div className="fieldLabel">Category</div>
                      <input
                        className="field"
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        placeholder="Housing, Credit Card, Utilities..."
                      />
                    </div>
                  </div>

                  <div className="fieldGrid4">
                    <div className="fieldWrap">
                      <div className="fieldLabel">{formType === "controllable" ? "Current Pay" : "Amount"}</div>
                      <input
                        className="field"
                        inputMode="decimal"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="fieldWrap">
                      <div className="fieldLabel">Frequency</div>
                      <select
                        className="select"
                        value={formFrequency}
                        onChange={(e) => setFormFrequency(e.target.value)}
                      >
                        {FREQUENCY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="fieldWrap">
                      <div className="fieldLabel">Due Date</div>
                      <input
                        className="field"
                        type="date"
                        value={formDueDate}
                        onChange={(e) => setFormDueDate(e.target.value)}
                      />
                    </div>

                    <div className="fieldWrap">
                      <div className="fieldLabel">Account</div>
                      <select
                        className="select"
                        value={formAccountId}
                        onChange={(e) => setFormAccountId(e.target.value)}
                      >
                        <option value="">No account</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {formType === "controllable" ? (
                    <>
                      <div className="fieldGrid4">
                        <div className="fieldWrap">
                          <div className="fieldLabel">Balance</div>
                          <input
                            className="field"
                            inputMode="decimal"
                            value={formBalance}
                            onChange={(e) => setFormBalance(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>

                        <div className="fieldWrap">
                          <div className="fieldLabel">APR %</div>
                          <input
                            className="field"
                            inputMode="decimal"
                            value={formAprPct}
                            onChange={(e) => setFormAprPct(e.target.value)}
                            placeholder="6.25"
                          />
                        </div>

                        <div className="fieldWrap">
                          <div className="fieldLabel">Min Pay</div>
                          <input
                            className="field"
                            inputMode="decimal"
                            value={formMinPay}
                            onChange={(e) => setFormMinPay(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>

                        <div className="fieldWrap">
                          <div className="fieldLabel">Extra Pay</div>
                          <input
                            className="field"
                            inputMode="decimal"
                            value={formExtraPay}
                            onChange={(e) => setFormExtraPay(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <label className="checkRow">
                        <input
                          type="checkbox"
                          checked={formAutopay}
                          onChange={(e) => setFormAutopay(e.target.checked)}
                        />
                        Autopay enabled
                      </label>
                    </>
                  ) : null}

                  <div className="fieldWrap">
                    <div className="fieldLabel">Notes</div>
                    <textarea
                      className="textarea"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="Optional notes"
                    />
                  </div>

                  <div className="buttonRow">
                    <button className="solidBtn" type="button" onClick={addBill} disabled={saving}>
                      {saving ? "Saving..." : "Save Bill"}
                    </button>
                    <button className="ghostBtn" type="button" onClick={resetForm} disabled={saving}>
                      Reset
                    </button>
                  </div>
                </div>
              </SectionCard>
            </section>

            <section className="overviewGridBottom">
              <SectionCard
                title="Bills Board"
                text="Your full bill mix with cleaner lanes and stronger signal colors."
                action={
                  <div className="typeGroup">
                    <button
                      type="button"
                      className={`typeBtn ${filter === "all" ? "active" : ""}`}
                      onClick={() => setFilter("all")}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={`typeBtn ${filter === "controllable" ? "active" : ""}`}
                      onClick={() => setFilter("controllable")}
                    >
                      Debt
                    </button>
                    <button
                      type="button"
                      className={`typeBtn ${filter === "noncontrollable" ? "active" : ""}`}
                      onClick={() => setFilter("noncontrollable")}
                    >
                      Fixed
                    </button>
                    <button
                      type="button"
                      className={`typeBtn ${filter === "due" ? "active" : ""}`}
                      onClick={() => setFilter("due")}
                    >
                      Due Soon
                    </button>
                  </div>
                }
              >
                <div className="cardList">
                  {!filteredBills.length ? (
                    <div className="emptyState">No bills match this filter.</div>
                  ) : (
                    filteredBills.slice(0, 10).map((bill) => {
                      const due = daysUntil(bill.dueDate);
                      const tone = dueTone(due);

                      return (
                        <div key={bill.id} className="billItem">
                          <div className="billItemHead">
                            <div>
                              <div className="billName">{bill.name}</div>
                              <div className="billNameSub">
                                {bill.type === "controllable" ? "Debt / Controllable" : "Fixed Bill"} •{" "}
                                {bill.frequency || "monthly"} • {bill.category || "No category"}
                              </div>
                            </div>

                            <div className="billActionRow">
                              <TonePill tone={tone}>{dueLabel(due)}</TonePill>
                              <TonePill tone={bill.active ? "green" : "neutral"}>
                                {bill.active ? "Active" : "Paused"}
                              </TonePill>
                            </div>
                          </div>

                          <div className="metaGrid" style={{ marginTop: 12 }}>
                            <div>
                              <div className="fieldLabel">{bill.type === "controllable" ? "Monthly Pay" : "Amount"}</div>
                              <div className="miniMetaValue">
                                {money(
                                  bill.type === "controllable"
                                    ? (Number(bill.minPay) || 0) + (Number(bill.extraPay) || 0) || bill.amount
                                    : bill.amount
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="fieldLabel">Monthly Pressure</div>
                              <div className="miniMetaValue">{money(monthlyEquivalent(bill))}</div>
                            </div>

                            <div>
                              <div className="fieldLabel">{bill.type === "controllable" ? "Balance" : "Last Paid"}</div>
                              <div className="miniMetaValue">
                                {bill.type === "controllable"
                                  ? money(bill.balance)
                                  : bill.lastPaidDate
                                    ? shortDate(bill.lastPaidDate)
                                    : "—"}
                              </div>
                            </div>
                          </div>

                          {bill.notes ? <div className="billSectionText">{bill.notes}</div> : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </SectionCard>

              <div className="sideStack">
                <SectionCard
                  title="Payoff Radar"
                  text="Quick payoff pressure view for controllable balances."
                  compact
                >
                  <div className="cardList">
                    {!payoffRows.length ? (
                      <div className="emptyState">No controllable debt added yet.</div>
                    ) : (
                      payoffRows.slice(0, 6).map((bill) => (
                        <div key={bill.id} className="payoffItem">
                          <div className="billItemHead">
                            <div>
                              <div className="billName">{bill.name}</div>
                              <div className="billNameSub">
                                {money(bill.balance)} at {bill.aprPct || 0}% APR
                              </div>
                            </div>

                            <div className="miniMeta">
                              <div className={bill.payoff.impossible ? "badText" : "goodText"}>
                                {bill.payoff.impossible ? "No payoff" : formatMonths(bill.payoff.months)}
                              </div>
                              <div className="miniMetaSub">{money(bill.monthlyPay)}/mo</div>
                            </div>
                          </div>

                          <div style={{ marginTop: 12 }}>
                            <ProgressBar value={bill.progress} tone={bill.payoff.impossible ? "red" : "green"} />
                          </div>

                          <div className="metaGrid" style={{ marginTop: 12 }}>
                            <div>
                              <div className="fieldLabel">Interest Cost</div>
                              <div className="miniMetaValue">
                                {bill.payoff.impossible ? "—" : money(bill.payoff.totalInterest)}
                              </div>
                            </div>

                            <div>
                              <div className="fieldLabel">Payoff Date</div>
                              <div className="miniMetaValue">
                                {bill.payoff.impossible || !bill.payoff.payoffDate
                                  ? "—"
                                  : shortDate(bill.payoff.payoffDate)}
                              </div>
                            </div>

                            <div>
                              <div className="fieldLabel">Autopay</div>
                              <div className="miniMetaValue">{bill.autopay ? "On" : "Off"}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </SectionCard>

                <SectionCard title="Next Moves" text="Fast actions for staying on top of payments." compact>
                  <div className="cardList">
                    {!dueSoon.length ? (
                      <div className="emptyState">Nothing due in the next 7 days.</div>
                    ) : (
                      dueSoon.slice(0, 6).map((bill) => (
                        <div key={bill.id} className="payoffItem">
                          <div className="billItemHead">
                            <div>
                              <div className="billName">{bill.name}</div>
                              <div className="billNameSub">
                                Due {bill.dueDate ? shortDate(bill.dueDate) : "—"} •{" "}
                                {money(
                                  bill.type === "controllable"
                                    ? (Number(bill.minPay) || 0) + (Number(bill.extraPay) || 0) || bill.amount
                                    : bill.amount
                                )}
                              </div>
                            </div>

                            <span className={daysUntil(bill.dueDate) <= 3 ? "badText" : "warnText"}>
                              {dueLabel(daysUntil(bill.dueDate))}
                            </span>
                          </div>

                          <div className="buttonRow" style={{ marginTop: 12 }}>
                            <button className="ghostBtn" type="button" onClick={() => toggleActive(bill)}>
                              {bill.active ? "Pause" : "Activate"}
                            </button>
                            <button className="solidBtn" type="button" onClick={() => markPaidToday(bill)}>
                              Mark Paid Today
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </SectionCard>
              </div>
            </section>
          </>
        ) : (
          <section className="manageGrid">
            <SectionCard title="Search and Control" text="Filter, pause, mark paid, or delete from one place.">
              <div className="fieldGrid2">
                <div className="fieldWrap">
                  <div className="fieldLabel">Search</div>
                  <input
                    className="field"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search bills, debt, notes, category..."
                  />
                </div>

                <div className="fieldWrap">
                  <div className="fieldLabel">Filter</div>
                  <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="all">All bills</option>
                    <option value="active">Active only</option>
                    <option value="controllable">Debt only</option>
                    <option value="noncontrollable">Fixed only</option>
                    <option value="due">Due in 7 days</option>
                  </select>
                </div>
              </div>

              <div className="cardList">
                {!filteredBills.length ? (
                  <div className="emptyState">No bills match this filter.</div>
                ) : (
                  filteredBills.map((bill) => {
                    const due = daysUntil(bill.dueDate);
                    const dueToneValue = dueTone(due);

                    return (
                      <div key={bill.id} className="billItem">
                        <div className="billItemHead">
                          <div>
                            <div className="billName">{bill.name}</div>
                            <div className="billNameSub">
                              {bill.type === "controllable" ? "Debt / Controllable" : "Fixed Bill"} •{" "}
                              {bill.frequency} • {bill.category || "No category"}
                            </div>
                            {bill.notes ? <div className="billSectionText">{bill.notes}</div> : null}
                          </div>

                          <div className="miniMeta">
                            <div className="miniMetaValue">
                              {money(
                                bill.type === "controllable"
                                  ? (Number(bill.minPay) || 0) + (Number(bill.extraPay) || 0) || bill.amount
                                  : bill.amount
                              )}
                            </div>
                            <div className="miniMetaSub">{dueLabel(due)}</div>
                          </div>
                        </div>

                        <div className="buttonRow" style={{ marginTop: 12 }}>
                          <TonePill tone={dueToneValue}>{dueLabel(due)}</TonePill>
                          <TonePill tone={bill.active ? "green" : "neutral"}>
                            {bill.active ? "Active" : "Paused"}
                          </TonePill>
                          <button className="ghostBtn" type="button" onClick={() => toggleActive(bill)}>
                            {bill.active ? "Pause" : "Activate"}
                          </button>
                          <button className="solidBtn" type="button" onClick={() => markPaidToday(bill)}>
                            Mark Paid
                          </button>
                          <button className="dangerBtn" type="button" onClick={() => deleteBill(bill.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </SectionCard>

            <div className="sideStack">
              <SectionCard title="Debt Stack" text="Fast read on your controllable balances." compact>
                <div className="cardList">
                  {!payoffRows.length ? (
                    <div className="emptyState">No controllable debt added yet.</div>
                  ) : (
                    payoffRows.map((bill) => (
                      <div key={bill.id} className="payoffItem">
                        <div className="billItemHead">
                          <div>
                            <div className="billName">{bill.name}</div>
                            <div className="billNameSub">
                              Balance {money(bill.balance)} • APR {bill.aprPct || 0}%
                            </div>
                          </div>

                          <div className={bill.payoff.impossible ? "badText" : "goodText"}>
                            {bill.payoff.impossible ? "No payoff" : formatMonths(bill.payoff.months)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Fixed Bills" text="Recurring bills outside the debt stack." compact>
                <div className="cardList">
                  {!fixedBills.length ? (
                    <div className="emptyState">No fixed bills added yet.</div>
                  ) : (
                    fixedBills.map((bill) => (
                      <div key={bill.id} className="payoffItem">
                        <div className="billItemHead">
                          <div>
                            <div className="billName">{bill.name}</div>
                            <div className="billNameSub">
                              {money(bill.amount)} • {bill.frequency}
                            </div>
                          </div>

                          <div className="miniMetaValue">{money(monthlyEquivalent(bill))}/mo</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}