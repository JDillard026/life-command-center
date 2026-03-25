"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

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

function toDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0.00";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function num(v, fallback = 0) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
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

function shortDate(iso) {
  const d = toDate(iso);
  if (!d) return "No date";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

function ProgressBar({ value = 0, color = "#4ade80" }) {
  const pct = clamp(value, 0, 100);
  return (
    <div className="blProgress">
      <div
        className="blProgressFill"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color} 0%, rgba(255,255,255,.92) 220%)`,
          boxShadow: `0 0 18px ${color}44, 0 0 24px ${color}18`,
        }}
      />
    </div>
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
        return a.name.localeCompare(b.name);
      });
  }, [bills, filter, search]);

  const controllableBills = React.useMemo(
    () => bills.filter((b) => b.active && b.type === "controllable"),
    [bills]
  );

  const fixedBills = React.useMemo(
    () => bills.filter((b) => b.active && b.type === "noncontrollable"),
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

  const payoffRows = React.useMemo(() => {
    return controllableBills
      .map((bill) => {
        const monthlyPay =
          (Number(bill.minPay) || 0) + (Number(bill.extraPay) || 0) || Number(bill.amount) || 0;
        const sim = payoffSimulation(bill.balance, bill.aprPct, monthlyPay);
        const utilization =
          bill.balance > 0 && monthlyPay > 0 ? clamp((monthlyPay / bill.balance) * 100 * 12, 0, 100) : 0;

        return {
          ...bill,
          monthlyPay,
          payoff: sim,
          utilization,
        };
      })
      .sort((a, b) => {
        if (a.payoff.impossible && !b.payoff.impossible) return 1;
        if (!a.payoff.impossible && b.payoff.impossible) return -1;
        return (a.payoff.months ?? 9999) - (b.payoff.months ?? 9999);
      });
  }, [controllableBills]);

  const strongestPressure = React.useMemo(() => {
    if (!bills.length) return null;
    return [...bills]
      .filter((b) => b.active)
      .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))[0];
  }, [bills]);

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
  }

  async function addBill() {
    if (!user) return;

    const name = formName.trim();
    if (!name) {
      alert("Name is required.");
      return;
    }

    const amount = num(formAmount, NaN);
    if (!Number.isFinite(amount) || amount < 0) {
      alert("Enter a valid amount.");
      return;
    }

    if (formType === "controllable") {
      const balance = num(formBalance, NaN);
      if (!Number.isFinite(balance) || balance < 0) {
        alert("Enter a valid balance.");
        return;
      }
    }

    setSaving(true);
    setPageError("");

    try {
      const draft = {
        id: uid(),
        name,
        type: formType,
        frequency: formFrequency,
        dueDate: formDueDate,
        amount,
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
    if (!confirm("Delete this bill?")) return;

    const previous = bills;
    setBills((prev) => prev.filter((b) => b.id !== id));

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

    const next = !bill.active;
    const previous = bills;

    setBills((prev) => prev.map((b) => (b.id === bill.id ? { ...b, active: next } : b)));

    try {
      const { error } = await supabase
        .from("bills")
        .update({ active: next, updated_at: new Date().toISOString() })
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
      prev.map((b) => (b.id === bill.id ? { ...b, lastPaidDate: nextDate } : b))
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

  const styles = (
    <style jsx global>{`
      .billsPage {
        --text: #f7f8ff;
        --muted: rgba(225, 232, 255, 0.72);
        --muted2: rgba(225, 232, 255, 0.46);
        --glass: linear-gradient(180deg, rgba(6, 12, 24, 0.42), rgba(4, 8, 16, 0.18));
        --shadow: 0 22px 60px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.045);
        color: var(--text);
        color-scheme: dark;
      }

      .billsPage *,
      .billsPage *::before,
      .billsPage *::after {
        box-sizing: border-box;
      }

      .billsPage .blShell {
        width: 100%;
        max-width: none;
        margin: 0;
        padding: 22px 8px 56px 0;
      }

      .billsPage .blHero,
      .billsPage .blCard,
      .billsPage .blMetric {
        position: relative;
        overflow: hidden;
        border-radius: 30px;
        border: 1px solid rgba(255, 255, 255, 0.075);
        background: var(--glass);
        box-shadow: var(--shadow);
        backdrop-filter: blur(15px) saturate(126%);
        -webkit-backdrop-filter: blur(15px) saturate(126%);
      }

      .billsPage .blHero::before,
      .billsPage .blCard::before,
      .billsPage .blMetric::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at top left, rgba(80, 120, 255, 0.08), transparent 28%),
          radial-gradient(circle at top right, rgba(255, 255, 255, 0.022), transparent 18%),
          radial-gradient(circle at bottom center, rgba(255, 107, 127, 0.03), transparent 28%);
      }

      .billsPage .blHero {
        padding: 28px;
        margin-bottom: 22px;
      }

      .billsPage .blHeroTop {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
        flex-wrap: wrap;
      }

      .billsPage .blEyebrow {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: var(--muted2);
        margin-bottom: 12px;
      }

      .billsPage .blTitle {
        margin: 0;
        font-size: clamp(34px, 4vw, 64px);
        line-height: 0.95;
        font-weight: 950;
        letter-spacing: -0.045em;
      }

      .billsPage .blSub {
        margin-top: 12px;
        max-width: 940px;
        color: var(--muted);
        line-height: 1.6;
        font-size: 15px;
      }

      .billsPage .blChipRow,
      .billsPage .blActionRow {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .billsPage .blChip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 40px;
        padding: 10px 15px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.075);
        background: rgba(255, 255, 255, 0.038);
        color: #f5f7ff;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.04em;
      }

      .billsPage .blSegment {
        display: inline-flex;
        gap: 6px;
        padding: 4px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
      }

      .billsPage .blSegmentBtn,
      .billsPage .blTabBtn,
      .billsPage .blSolidBtn,
      .billsPage .blGhostBtn,
      .billsPage .blDangerBtn {
        min-height: 44px;
        padding: 0 16px;
        border-radius: 14px;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition:
          transform 0.18s ease,
          border-color 0.18s ease,
          background 0.18s ease,
          box-shadow 0.18s ease,
          opacity 0.18s ease;
      }

      .billsPage .blSegmentBtn:hover,
      .billsPage .blTabBtn:hover,
      .billsPage .blSolidBtn:hover,
      .billsPage .blGhostBtn:hover,
      .billsPage .blDangerBtn:hover {
        transform: translateY(-1px);
      }

      .billsPage .blSegmentBtn,
      .billsPage .blTabBtn,
      .billsPage .blGhostBtn {
        border: 1px solid rgba(255, 255, 255, 0.09);
        background: rgba(255, 255, 255, 0.03);
        color: #f5f7ff;
      }

      .billsPage .blSegmentBtn.active,
      .billsPage .blTabBtn.active {
        border-color: rgba(255, 255, 255, 0.14);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(233, 237, 246, 0.92));
        color: #08111f;
      }

      .billsPage .blSolidBtn {
        border: 1px solid rgba(130, 170, 255, 0.24);
        background: linear-gradient(180deg, rgba(77, 124, 255, 0.22), rgba(32, 74, 189, 0.12));
        color: #f7f9ff;
      }

      .billsPage .blDangerBtn {
        border: 1px solid rgba(244, 114, 182, 0.22);
        background: rgba(244, 114, 182, 0.08);
        color: #ffd5e5;
      }

      .billsPage .blMetricGrid {
        display: grid;
        grid-template-columns: repeat(4, minmax(230px, 1fr));
        gap: 18px;
        margin-bottom: 22px;
      }

      .billsPage .blMetric {
        padding: 22px;
        min-height: 166px;
      }

      .billsPage .blMetricLabel {
        position: relative;
        z-index: 1;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--muted2);
      }

      .billsPage .blMetricValue {
        position: relative;
        z-index: 1;
        margin-top: 14px;
        font-size: clamp(30px, 3vw, 48px);
        line-height: 1;
        font-weight: 950;
        letter-spacing: -0.04em;
      }

      .billsPage .blMetricSub {
        position: relative;
        z-index: 1;
        margin-top: 14px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .billsPage .blGridTop,
      .billsPage .blGridBottom,
      .billsPage .blManageGrid {
        display: grid;
        gap: 20px;
      }

      .billsPage .blGridTop {
        grid-template-columns: minmax(0, 1.58fr) minmax(520px, 1fr);
        margin-bottom: 20px;
      }

      .billsPage .blGridBottom,
      .billsPage .blManageGrid {
        grid-template-columns: minmax(0, 1.42fr) minmax(460px, 1fr);
      }

      .billsPage .blCard {
        padding: 24px;
      }

      .billsPage .blCardHead {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }

      .billsPage .blSectionTitle {
        margin: 0;
        font-size: 34px;
        line-height: 1;
        font-weight: 900;
        letter-spacing: -0.03em;
      }

      .billsPage .blSectionMini {
        margin: 0;
        font-size: 20px;
        line-height: 1.1;
        font-weight: 900;
      }

      .billsPage .blSectionText {
        margin-top: 8px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.55;
      }

      .billsPage .blTiny {
        color: var(--muted2);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 10px;
        font-weight: 700;
        margin-bottom: 8px;
      }

      .billsPage .blField,
      .billsPage .blSelect,
      .billsPage .blTextarea {
        width: 100%;
        min-height: 50px;
        border-radius: 16px;
        border: 1px solid rgba(177, 196, 255, 0.14);
        background: rgba(8, 13, 24, 0.52) !important;
        color: #f4f7ff !important;
        font-size: 14px;
        font-weight: 600;
        padding: 0 14px;
        outline: none;
        transition: border-color 0.18s ease, box-shadow 0.18s ease;
      }

      .billsPage .blTextarea {
        min-height: 102px;
        padding: 12px 14px;
        resize: vertical;
      }

      .billsPage .blField::placeholder,
      .billsPage .blTextarea::placeholder {
        color: rgba(233, 238, 255, 0.44) !important;
      }

      .billsPage .blField:focus,
      .billsPage .blSelect:focus,
      .billsPage .blTextarea:focus {
        border-color: rgba(121, 163, 255, 0.36);
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.08);
      }

      .billsPage .blSelect option {
        background: #08111f !important;
        color: #f4f7ff !important;
      }

      .billsPage .blQuickGrid4 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .billsPage .blQuickGrid2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .billsPage .blList,
      .billsPage .blColumnStack,
      .billsPage .blStack {
        display: grid;
        gap: 14px;
      }

      .billsPage .blSplit {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .billsPage .blBill {
        position: relative;
        overflow: hidden;
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.055);
        background: linear-gradient(180deg, rgba(10, 16, 28, 0.38), rgba(5, 9, 17, 0.14));
        padding: 16px;
      }

      .billsPage .blBillHead {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .billsPage .blBillTitle {
        font-size: 18px;
        font-weight: 900;
        line-height: 1.1;
      }

      .billsPage .blPill {
        display: inline-flex;
        align-items: center;
        min-height: 30px;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.04em;
      }

      .billsPage .blProgress {
        height: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
      }

      .billsPage .blProgressFill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.45s ease;
      }

      .billsPage .blMetaGrid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-top: 12px;
      }

      .billsPage .blPayoffCard {
        border-radius: 22px;
        border: 1px solid rgba(255, 255, 255, 0.055);
        background: linear-gradient(180deg, rgba(8, 13, 24, 0.34), rgba(4, 8, 16, 0.12));
        padding: 16px;
      }

      .billsPage .blError {
        padding: 14px 16px;
        margin-bottom: 18px;
        border-radius: 22px;
        border: 1px solid rgba(244, 114, 182, 0.26);
        background: linear-gradient(180deg, rgba(96, 17, 44, 0.28), rgba(36, 8, 18, 0.2));
      }

      .billsPage .blEmpty {
        border: 1px dashed rgba(255, 255, 255, 0.1);
        border-radius: 18px;
        padding: 16px;
        color: var(--muted);
        background: rgba(255, 255, 255, 0.018);
      }

      .billsPage .blGood {
        color: rgb(134 239 172);
        font-weight: 900;
      }

      .billsPage .blBad {
        color: rgb(255 176 196);
        font-weight: 900;
      }

      .billsPage .blWarn {
        color: rgb(253 224 71);
        font-weight: 900;
      }

      @media (max-width: 1380px) {
        .billsPage .blMetricGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .billsPage .blGridTop,
        .billsPage .blGridBottom,
        .billsPage .blManageGrid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 980px) {
        .billsPage .blQuickGrid4,
        .billsPage .blQuickGrid2,
        .billsPage .blSplit,
        .billsPage .blMetaGrid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 760px) {
        .billsPage .blShell {
          padding: 16px 6px 34px 0;
        }

        .billsPage .blHero,
        .billsPage .blCard,
        .billsPage .blMetric {
          border-radius: 22px;
          padding: 18px;
        }

        .billsPage .blMetricGrid {
          grid-template-columns: 1fr;
        }

        .billsPage .blTitle {
          font-size: 36px;
        }

        .billsPage .blSectionTitle {
          font-size: 26px;
        }
      }
    `}</style>
  );

  if (loading) {
    return (
      <main className="billsPage">
        {styles}
        <div className="blShell">
          <section className="blHero">
            <div className="blHeroTop">
              <div>
                <div className="blEyebrow">DEBT + BILLS CONTROL</div>
                <h1 className="blTitle">Bills Center</h1>
                <div className="blSub">Loading bills…</div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="billsPage">
        {styles}
        <div className="blShell">
          <section className="blHero">
            <div className="blHeroTop">
              <div>
                <div className="blEyebrow">DEBT + BILLS CONTROL</div>
                <h1 className="blTitle">Bills Center</h1>
                <div className="blSub">This page needs an authenticated user.</div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="billsPage">
      {styles}

      <div className="blShell">
        <header className="blHero">
          <div className="blHeroTop">
            <div>
              <div className="blEyebrow">DEBT + BILLS CONTROL</div>
              <h1 className="blTitle">Bills Center</h1>
              <div className="blSub">
                Wider layout, cleaner debt visibility, and more glass transparency so the background still breathes.
              </div>

              <div className="blChipRow" style={{ marginTop: 14 }}>
                <span className="blChip">{bills.length} TOTAL</span>
                <span className="blChip">{controllableBills.length} DEBTS</span>
                <span className="blChip">{fixedBills.length} FIXED</span>
                <span className="blChip">{dueSoon.length} DUE SOON</span>
              </div>
            </div>

            <div className="blSegment">
              <button
                type="button"
                className={`blTabBtn ${tab === "overview" ? "active" : ""}`}
                onClick={() => setTab("overview")}
              >
                Overview
              </button>
              <button
                type="button"
                className={`blTabBtn ${tab === "manage" ? "active" : ""}`}
                onClick={() => setTab("manage")}
              >
                Manage
              </button>
            </div>
          </div>
        </header>

        {pageError ? (
          <div className="blError">
            <div style={{ fontWeight: 900, fontSize: 15 }}>Database issue</div>
            <div className="blSectionText" style={{ marginTop: 6 }}>
              {pageError}
            </div>
          </div>
        ) : null}

        <section className="blMetricGrid">
          <article className="blMetric">
            <div className="blMetricLabel">Monthly Pressure</div>
            <div className="blMetricValue">{money(monthlyPressure)}</div>
            <div className="blMetricSub">Normalized monthly hit from bills and debt payments.</div>
          </article>

          <article className="blMetric">
            <div className="blMetricLabel">Total Debt</div>
            <div className="blMetricValue">{money(totalDebt)}</div>
            <div className="blMetricSub">Active controllable balance across debt accounts.</div>
          </article>

          <article className="blMetric">
            <div className="blMetricLabel">Due Soon</div>
            <div className="blMetricValue">{dueSoon.length}</div>
            <div className="blMetricSub">
              {overdueCount > 0 ? `${overdueCount} overdue right now.` : "Nothing overdue right now."}
            </div>
          </article>

          <article className="blMetric">
            <div className="blMetricLabel">Highest Pressure</div>
            <div className="blMetricValue">
              {strongestPressure ? money(monthlyEquivalent(strongestPressure)) : "$0.00"}
            </div>
            <div className="blMetricSub">
              {strongestPressure ? strongestPressure.name : "No active bills yet."}
            </div>
          </article>
        </section>

        {tab === "overview" ? (
          <>
            <section className="blGridTop">
              <article className="blCard">
                <div className="blCardHead">
                  <div>
                    <h2 className="blSectionTitle">Pressure Board</h2>
                    <div className="blSectionText">
                      Clean view of what is due first and what is hitting the hardest.
                    </div>
                  </div>
                  <span className="blChip">ACTIVE FIRST</span>
                </div>

                <div className="blList">
                  {bills.filter((b) => b.active).length === 0 ? (
                    <div className="blEmpty">No active bills yet.</div>
                  ) : (
                    [...bills]
                      .filter((b) => b.active)
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
                        const pressure =
                          monthlyPressure > 0 ? (monthlyEquivalent(bill) / monthlyPressure) * 100 : 0;
                        const tone = dueTone(due);

                        return (
                          <div key={bill.id} className="blBill">
                            <div className="blBillHead">
                              <div>
                                <div className="blBillTitle">{bill.name}</div>
                                <div className="blSectionText">
                                  {bill.type === "controllable" ? "Debt / Controllable" : "Fixed Bill"} •{" "}
                                  {bill.frequency || "monthly"} • Due {bill.dueDate ? shortDate(bill.dueDate) : "—"}
                                </div>
                              </div>

                              <span
                                className="blPill"
                                style={{
                                  color:
                                    tone === "red"
                                      ? "#ffd6df"
                                      : tone === "amber"
                                        ? "#ffe8b4"
                                        : tone === "green"
                                          ? "#cbffe1"
                                          : "#d8e1ff",
                                  background:
                                    tone === "red"
                                      ? "rgba(255,107,127,.12)"
                                      : tone === "amber"
                                        ? "rgba(245,158,11,.12)"
                                        : tone === "green"
                                          ? "rgba(74,222,128,.12)"
                                          : "rgba(148,163,184,.12)",
                                  border:
                                    tone === "red"
                                      ? "1px solid rgba(255,107,127,.22)"
                                      : tone === "amber"
                                        ? "1px solid rgba(245,158,11,.24)"
                                        : tone === "green"
                                          ? "1px solid rgba(74,222,128,.24)"
                                          : "1px solid rgba(148,163,184,.22)",
                                }}
                              >
                                {dueLabel(due)}
                              </span>
                            </div>

                            <div style={{ marginTop: 12 }}>
                              <ProgressBar
                                value={pressure}
                                color={tone === "red" ? "#ff6b7f" : tone === "amber" ? "#f59e0b" : "#4ade80"}
                              />
                            </div>

                            <div className="blMetaGrid">
                              <div>
                                <div className="blTiny">Monthly Hit</div>
                                <div style={{ fontWeight: 900 }}>{money(monthlyEquivalent(bill))}</div>
                              </div>
                              {bill.type === "controllable" ? (
                                <div>
                                  <div className="blTiny">Balance</div>
                                  <div style={{ fontWeight: 900 }}>{money(bill.balance)}</div>
                                </div>
                              ) : (
                                <div>
                                  <div className="blTiny">Amount</div>
                                  <div style={{ fontWeight: 900 }}>{money(bill.amount)}</div>
                                </div>
                              )}
                              <div>
                                <div className="blTiny">Last Paid</div>
                                <div style={{ fontWeight: 900 }}>
                                  {bill.lastPaidDate ? shortDate(bill.lastPaidDate) : "—"}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </article>

              <article className="blCard">
                <div className="blCardHead">
                  <div>
                    <h2 className="blSectionTitle">Quick Add</h2>
                    <div className="blSectionText">
                      Add a fixed bill or a debt account without the page feeling cramped.
                    </div>
                  </div>

                  <div className="blSegment">
                    {BILL_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`blSegmentBtn ${formType === option.value ? "active" : ""}`}
                        onClick={() => setFormType(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="blStack">
                  <div className="blQuickGrid2">
                    <div>
                      <div className="blTiny">Name</div>
                      <input
                        className="blField"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="Chase Card, Rent, Insurance..."
                      />
                    </div>

                    <div>
                      <div className="blTiny">Category</div>
                      <input
                        className="blField"
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        placeholder="Housing, Credit Card, Utilities..."
                      />
                    </div>
                  </div>

                  <div className="blQuickGrid4">
                    <div>
                      <div className="blTiny">{formType === "controllable" ? "Current Pay" : "Amount"}</div>
                      <input
                        className="blField"
                        inputMode="decimal"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <div className="blTiny">Frequency</div>
                      <select
                        className="blSelect"
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

                    <div>
                      <div className="blTiny">Due Date</div>
                      <input
                        className="blField"
                        type="date"
                        value={formDueDate}
                        onChange={(e) => setFormDueDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <div className="blTiny">Account</div>
                      <select
                        className="blSelect"
                        value={formAccountId}
                        onChange={(e) => setFormAccountId(e.target.value)}
                      >
                        <option value="">No account</option>
                        {accounts.map((acct) => (
                          <option key={acct.id} value={acct.id}>
                            {acct.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {formType === "controllable" ? (
                    <div className="blQuickGrid4">
                      <div>
                        <div className="blTiny">Balance</div>
                        <input
                          className="blField"
                          inputMode="decimal"
                          value={formBalance}
                          onChange={(e) => setFormBalance(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <div className="blTiny">APR %</div>
                        <input
                          className="blField"
                          inputMode="decimal"
                          value={formAprPct}
                          onChange={(e) => setFormAprPct(e.target.value)}
                          placeholder="6.25"
                        />
                      </div>

                      <div>
                        <div className="blTiny">Min Pay</div>
                        <input
                          className="blField"
                          inputMode="decimal"
                          value={formMinPay}
                          onChange={(e) => setFormMinPay(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <div className="blTiny">Extra Pay</div>
                        <input
                          className="blField"
                          inputMode="decimal"
                          value={formExtraPay}
                          onChange={(e) => setFormExtraPay(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  ) : null}

                  {formType === "controllable" ? (
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 14,
                        color: "var(--muted)",
                        fontWeight: 700,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formAutopay}
                        onChange={(e) => setFormAutopay(e.target.checked)}
                      />
                      Autopay enabled
                    </label>
                  ) : null}

                  <div>
                    <div className="blTiny">Notes</div>
                    <textarea
                      className="blTextarea"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="Optional notes"
                    />
                  </div>

                  <div className="blActionRow">
                    <button className="blSolidBtn" type="button" onClick={addBill} disabled={saving}>
                      {saving ? "Saving..." : "Save Bill"}
                    </button>
                    <button className="blGhostBtn" type="button" onClick={resetForm} disabled={saving}>
                      Reset
                    </button>
                  </div>
                </div>
              </article>
            </section>

            <section className="blGridBottom">
              <article className="blCard">
                <div className="blCardHead">
                  <div>
                    <h2 className="blSectionTitle">Bills Board</h2>
                    <div className="blSectionText">
                      Your full bill mix, spread out and easier to scan.
                    </div>
                  </div>

                  <div className="blSegment">
                    <button
                      type="button"
                      className={`blSegmentBtn ${filter === "all" ? "active" : ""}`}
                      onClick={() => setFilter("all")}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={`blSegmentBtn ${filter === "controllable" ? "active" : ""}`}
                      onClick={() => setFilter("controllable")}
                    >
                      Debt
                    </button>
                    <button
                      type="button"
                      className={`blSegmentBtn ${filter === "noncontrollable" ? "active" : ""}`}
                      onClick={() => setFilter("noncontrollable")}
                    >
                      Fixed
                    </button>
                    <button
                      type="button"
                      className={`blSegmentBtn ${filter === "due" ? "active" : ""}`}
                      onClick={() => setFilter("due")}
                    >
                      Due Soon
                    </button>
                  </div>
                </div>

                <div className="blList">
                  {filteredBills.length === 0 ? (
                    <div className="blEmpty">No bills match this filter.</div>
                  ) : (
                    filteredBills.slice(0, 10).map((bill) => {
                      const due = daysUntil(bill.dueDate);
                      const tone = dueTone(due);

                      return (
                        <div key={bill.id} className="blBill">
                          <div className="blBillHead">
                            <div>
                              <div className="blBillTitle">{bill.name}</div>
                              <div className="blSectionText">
                                {bill.type === "controllable" ? "Debt / Controllable" : "Fixed Bill"} •{" "}
                                {bill.frequency || "monthly"} • {bill.category || "No category"}
                              </div>
                            </div>

                            <div className="blActionRow">
                              <span
                                className="blPill"
                                style={{
                                  color:
                                    tone === "red"
                                      ? "#ffd6df"
                                      : tone === "amber"
                                        ? "#ffe8b4"
                                        : tone === "green"
                                          ? "#cbffe1"
                                          : "#d8e1ff",
                                  background:
                                    tone === "red"
                                      ? "rgba(255,107,127,.12)"
                                      : tone === "amber"
                                        ? "rgba(245,158,11,.12)"
                                        : tone === "green"
                                          ? "rgba(74,222,128,.12)"
                                          : "rgba(148,163,184,.12)",
                                  border:
                                    tone === "red"
                                      ? "1px solid rgba(255,107,127,.22)"
                                      : tone === "amber"
                                        ? "1px solid rgba(245,158,11,.24)"
                                        : tone === "green"
                                          ? "1px solid rgba(74,222,128,.24)"
                                          : "1px solid rgba(148,163,184,.22)",
                                }}
                              >
                                {dueLabel(due)}
                              </span>

                              <span
                                className="blPill"
                                style={{
                                  color: bill.active ? "#cbffe1" : "#d8e1ff",
                                  background: bill.active
                                    ? "rgba(74,222,128,.12)"
                                    : "rgba(148,163,184,.12)",
                                  border: bill.active
                                    ? "1px solid rgba(74,222,128,.24)"
                                    : "1px solid rgba(148,163,184,.22)",
                                }}
                              >
                                {bill.active ? "ACTIVE" : "PAUSED"}
                              </span>
                            </div>
                          </div>

                          <div className="blMetaGrid">
                            <div>
                              <div className="blTiny">
                                {bill.type === "controllable" ? "Monthly Pay" : "Amount"}
                              </div>
                              <div style={{ fontWeight: 900 }}>
                                {money(
                                  bill.type === "controllable"
                                    ? (Number(bill.minPay) || 0) + (Number(bill.extraPay) || 0) || bill.amount
                                    : bill.amount
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="blTiny">Monthly Pressure</div>
                              <div style={{ fontWeight: 900 }}>{money(monthlyEquivalent(bill))}</div>
                            </div>

                            <div>
                              <div className="blTiny">
                                {bill.type === "controllable" ? "Balance" : "Last Paid"}
                              </div>
                              <div style={{ fontWeight: 900 }}>
                                {bill.type === "controllable"
                                  ? money(bill.balance)
                                  : bill.lastPaidDate
                                    ? shortDate(bill.lastPaidDate)
                                    : "—"}
                              </div>
                            </div>
                          </div>

                          {bill.notes ? (
                            <div className="blSectionText" style={{ marginTop: 12 }}>
                              {bill.notes}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </article>

              <div className="blColumnStack">
                <article className="blCard">
                  <div className="blCardHead">
                    <div>
                      <h2 className="blSectionMini">Payoff Radar</h2>
                      <div className="blSectionText">Quick payoff pressure view for controllable balances.</div>
                    </div>
                  </div>

                  <div className="blList">
                    {payoffRows.length === 0 ? (
                      <div className="blEmpty">No controllable debt added yet.</div>
                    ) : (
                      payoffRows.slice(0, 6).map((bill) => {
                        const progress =
                          bill.balance > 0 && bill.monthlyPay > 0
                            ? clamp((bill.monthlyPay / bill.balance) * 100 * 12, 0, 100)
                            : 0;

                        return (
                          <div key={bill.id} className="blPayoffCard">
                            <div className="blBillHead">
                              <div>
                                <div className="blBillTitle">{bill.name}</div>
                                <div className="blSectionText">
                                  {money(bill.balance)} at {bill.aprPct || 0}% APR
                                </div>
                              </div>

                              <div style={{ textAlign: "right" }}>
                                <div className={bill.payoff.impossible ? "blBad" : "blGood"}>
                                  {bill.payoff.impossible ? "No payoff" : formatMonths(bill.payoff.months)}
                                </div>
                                <div className="blSectionText" style={{ marginTop: 6 }}>
                                  {money(bill.monthlyPay)}/mo
                                </div>
                              </div>
                            </div>

                            <div style={{ marginTop: 12 }}>
                              <ProgressBar value={progress} color={bill.payoff.impossible ? "#ff6b7f" : "#4ade80"} />
                            </div>

                            <div className="blMetaGrid">
                              <div>
                                <div className="blTiny">Interest Cost</div>
                                <div style={{ fontWeight: 900 }}>
                                  {bill.payoff.impossible ? "—" : money(bill.payoff.totalInterest)}
                                </div>
                              </div>
                              <div>
                                <div className="blTiny">Payoff Date</div>
                                <div style={{ fontWeight: 900 }}>
                                  {bill.payoff.impossible || !bill.payoff.payoffDate
                                    ? "—"
                                    : shortDate(bill.payoff.payoffDate)}
                                </div>
                              </div>
                              <div>
                                <div className="blTiny">Autopay</div>
                                <div style={{ fontWeight: 900 }}>{bill.autopay ? "On" : "Off"}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </article>

                <article className="blCard">
                  <div className="blCardHead">
                    <div>
                      <h2 className="blSectionMini">Next Moves</h2>
                      <div className="blSectionText">Fast actions for staying on top of payments.</div>
                    </div>
                  </div>

                  <div className="blList">
                    {dueSoon.length === 0 ? (
                      <div className="blEmpty">Nothing due in the next 7 days.</div>
                    ) : (
                      dueSoon.slice(0, 6).map((bill) => (
                        <div key={bill.id} className="blPayoffCard">
                          <div className="blBillHead">
                            <div>
                              <div className="blBillTitle">{bill.name}</div>
                              <div className="blSectionText">
                                Due {bill.dueDate ? shortDate(bill.dueDate) : "—"} •{" "}
                                {money(
                                  bill.type === "controllable"
                                    ? (Number(bill.minPay) || 0) + (Number(bill.extraPay) || 0) || bill.amount
                                    : bill.amount
                                )}
                              </div>
                            </div>

                            <span className={daysUntil(bill.dueDate) <= 3 ? "blBad" : "blWarn"}>
                              {dueLabel(daysUntil(bill.dueDate))}
                            </span>
                          </div>

                          <div className="blActionRow" style={{ marginTop: 12 }}>
                            <button className="blGhostBtn" type="button" onClick={() => toggleActive(bill)}>
                              {bill.active ? "Pause" : "Activate"}
                            </button>
                            <button className="blSolidBtn" type="button" onClick={() => markPaidToday(bill)}>
                              Mark Paid Today
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              </div>
            </section>
          </>
        ) : (
          <section className="blManageGrid">
            <article className="blCard">
              <div className="blCardHead">
                <div>
                  <h2 className="blSectionTitle">Search and Control</h2>
                  <div className="blSectionText">Filter, pause, mark paid, or delete from one place.</div>
                </div>
              </div>

              <div className="blQuickGrid2" style={{ marginBottom: 16 }}>
                <input
                  className="blField"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search bills, debt, notes, category..."
                />

                <select className="blSelect" value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">All bills</option>
                  <option value="active">Active only</option>
                  <option value="controllable">Debt only</option>
                  <option value="noncontrollable">Fixed only</option>
                  <option value="due">Due in 7 days</option>
                </select>
              </div>

              <div className="blList">
                {filteredBills.length === 0 ? (
                  <div className="blEmpty">No bills match this filter.</div>
                ) : (
                  filteredBills.map((bill) => {
                    const due = daysUntil(bill.dueDate);

                    return (
                      <div key={bill.id} className="blBill">
                        <div className="blBillHead">
                          <div>
                            <div className="blBillTitle">{bill.name}</div>
                            <div className="blSectionText">
                              {bill.type === "controllable" ? "Debt / Controllable" : "Fixed Bill"} •{" "}
                              {bill.frequency} • {bill.category || "No category"}
                            </div>
                            {bill.notes ? (
                              <div className="blSectionText" style={{ marginTop: 6 }}>
                                {bill.notes}
                              </div>
                            ) : null}
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 900 }}>
                              {money(
                                bill.type === "controllable"
                                  ? (Number(bill.minPay) || 0) + (Number(bill.extraPay) || 0) || bill.amount
                                  : bill.amount
                              )}
                            </div>
                            <div className="blSectionText" style={{ marginTop: 6 }}>
                              {dueLabel(due)}
                            </div>
                          </div>
                        </div>

                        <div className="blActionRow" style={{ marginTop: 12 }}>
                          <button className="blGhostBtn" type="button" onClick={() => toggleActive(bill)}>
                            {bill.active ? "Pause" : "Activate"}
                          </button>
                          <button className="blSolidBtn" type="button" onClick={() => markPaidToday(bill)}>
                            Mark Paid
                          </button>
                          <button className="blDangerBtn" type="button" onClick={() => deleteBill(bill.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </article>

            <div className="blColumnStack">
              <article className="blCard">
                <div className="blCardHead">
                  <div>
                    <h2 className="blSectionMini">Debt Stack</h2>
                    <div className="blSectionText">Fast read on your controllable balances.</div>
                  </div>
                </div>

                <div className="blList">
                  {payoffRows.length === 0 ? (
                    <div className="blEmpty">No controllable debt added yet.</div>
                  ) : (
                    payoffRows.map((bill) => (
                      <div key={bill.id} className="blPayoffCard">
                        <div className="blBillHead">
                          <div>
                            <div className="blBillTitle">{bill.name}</div>
                            <div className="blSectionText">
                              Balance {money(bill.balance)} • APR {bill.aprPct || 0}%
                            </div>
                          </div>

                          <div className={bill.payoff.impossible ? "blBad" : "blGood"}>
                            {bill.payoff.impossible ? "No payoff" : formatMonths(bill.payoff.months)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className="blCard">
                <div className="blCardHead">
                  <div>
                    <h2 className="blSectionMini">Fixed Bills</h2>
                    <div className="blSectionText">Recurring bills outside the debt stack.</div>
                  </div>
                </div>

                <div className="blList">
                  {fixedBills.length === 0 ? (
                    <div className="blEmpty">No fixed bills added yet.</div>
                  ) : (
                    fixedBills.map((bill) => (
                      <div key={bill.id} className="blPayoffCard">
                        <div className="blBillHead">
                          <div>
                            <div className="blBillTitle">{bill.name}</div>
                            <div className="blSectionText">
                              {money(bill.amount)} • {bill.frequency}
                            </div>
                          </div>

                          <div style={{ fontWeight: 900 }}>{money(monthlyEquivalent(bill))}/mo</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}