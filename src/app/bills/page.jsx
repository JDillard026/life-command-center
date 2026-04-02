"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeDollarSign,
  CalendarClock,
  Copy,
  Landmark,
  Link2,
  MoreHorizontal,
  PencilLine,
  Plus,
  Receipt,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../components/GlassPane";

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "One Time" },
];

const MOBILE_SECTIONS = [
  { value: "list", label: "Bills" },
  { value: "focus", label: "Focus" },
  { value: "tools", label: "Tools" },
];

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function round2(n) {
  return Math.round((safeNum(n, 0) + Number.EPSILON) * 100) / 100;
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function isoDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseIsoParts(iso) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { yyyy: Number(match[1]), mm: Number(match[2]), dd: Number(match[3]) };
}

function isoToLocalDate(iso, hour = 12) {
  const parts = parseIsoParts(iso);
  if (!parts) return null;
  return new Date(parts.yyyy, parts.mm - 1, parts.dd, hour, 0, 0, 0);
}

function isoSerial(iso) {
  const parts = parseIsoParts(iso);
  if (!parts) return null;
  return Math.floor(Date.UTC(parts.yyyy, parts.mm - 1, parts.dd) / 86400000);
}

function todaySerial() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
}

function compareIsoDates(a, b) {
  const aa = isoSerial(a);
  const bb = isoSerial(b);
  if (!Number.isFinite(aa) || !Number.isFinite(bb)) return 0;
  return aa - bb;
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function moneyTight(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0.00";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fmtWhen(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtAgo(ts) {
  if (!ts) return "—";
  const ms = Date.now() - new Date(ts).getTime();
  const mins = Math.round(ms / 60000);
  if (!Number.isFinite(mins)) return "—";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function shortDate(dateValue) {
  if (!dateValue) return "—";
  const d = isoToLocalDate(dateValue, 12);
  if (!d || !Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function monthKeyOf(dateValue) {
  const parts = parseIsoParts(dateValue);
  if (!parts) return "";
  return `${parts.yyyy}-${String(parts.mm).padStart(2, "0")}`;
}

function addDays(iso, daysToAdd) {
  const dt = isoToLocalDate(iso, 12);
  if (!dt) return "";
  dt.setDate(dt.getDate() + Number(daysToAdd || 0));
  return isoDate(dt);
}

function addMonthsClamped(iso, monthsToAdd) {
  const dt = isoToLocalDate(iso, 12);
  if (!dt) return "";
  const day = dt.getDate();
  const next = new Date(dt.getFullYear(), dt.getMonth() + Number(monthsToAdd || 0), 1, 12, 0, 0, 0);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return isoDate(next);
}

function nextDueDateFromFrequency(currentISO, frequency) {
  const base = currentISO || isoDate();
  switch (String(frequency || "").toLowerCase()) {
    case "weekly":
      return addDays(base, 7);
    case "biweekly":
      return addDays(base, 14);
    case "quarterly":
      return addMonthsClamped(base, 3);
    case "yearly":
      return addMonthsClamped(base, 12);
    case "one_time":
      return base;
    default:
      return addMonthsClamped(base, 1);
  }
}

function previousDueDateFromFrequency(currentISO, frequency) {
  const base = currentISO || isoDate();
  switch (String(frequency || "").toLowerCase()) {
    case "weekly":
      return addDays(base, -7);
    case "biweekly":
      return addDays(base, -14);
    case "quarterly":
      return addMonthsClamped(base, -3);
    case "yearly":
      return addMonthsClamped(base, -12);
    case "one_time":
      return base;
    default:
      return addMonthsClamped(base, -1);
  }
}

function daysUntil(iso) {
  const dueSerial = isoSerial(iso);
  if (!Number.isFinite(dueSerial)) return null;
  return dueSerial - todaySerial();
}

function ledgerTimestampFromIso(iso) {
  const dt = isoToLocalDate(iso, 12) || new Date();
  return dt.toISOString();
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
    default:
      return 1;
  }
}

function monthlyWeight(amount, frequency) {
  return safeNum(amount, 0) * freqToMonthlyMult(frequency);
}

function normalizeType(type) {
  return String(type || "other").toLowerCase().trim();
}

function isCreditAccountType(type) {
  return normalizeType(type) === "credit";
}

function isInvestmentAccountType(type) {
  return normalizeType(type) === "investment";
}

function accountTypeLabel(t) {
  const v = normalizeType(t);
  if (v === "checking") return "Checking";
  if (v === "savings") return "Savings";
  if (v === "cash") return "Cash";
  if (v === "credit") return "Credit Card";
  if (v === "investment") return "Investment";
  return "Other";
}

function dueMeta(days) {
  if (!Number.isFinite(days)) return { label: "No due date", tone: "neutral", percent: 0 };
  if (days < 0) return { label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late`, tone: "red", percent: 100 };
  if (days === 0) return { label: "Due today", tone: "red", percent: 100 };
  if (days <= 3) return { label: `Due in ${days} day${days === 1 ? "" : "s"}`, tone: "red", percent: 92 };
  if (days <= 7) return { label: `Due in ${days} days`, tone: "amber", percent: 72 };
  if (days <= 14) return { label: `Due in ${days} days`, tone: "amber", percent: 48 };
  return { label: `Due in ${days} days`, tone: "green", percent: 18 };
}

function cycleStartForBill(bill) {
  if (!bill?.dueDate || !bill?.frequency) return "";
  if (String(bill.frequency).toLowerCase() === "one_time") return bill.dueDate;
  return previousDueDateFromFrequency(bill.dueDate, bill.frequency);
}

function cycleEndForBill(bill) {
  if (!bill?.dueDate || !bill?.frequency) return "";
  if (String(bill.frequency).toLowerCase() === "one_time") return bill.dueDate;
  return nextDueDateFromFrequency(bill.dueDate, bill.frequency);
}

function isBillPaidThisCycle(bill) {
  if (!bill?.lastPaidDate) return false;
  if (bill.active === false) return false;
  const paidSerial = isoSerial(bill.lastPaidDate);
  const dueSerial = isoSerial(bill.dueDate);
  if (!Number.isFinite(paidSerial) || !Number.isFinite(dueSerial)) return false;
  if (String(bill.frequency || "").toLowerCase() === "one_time") return paidSerial >= dueSerial;
  const startSerial = isoSerial(cycleStartForBill(bill));
  const endSerial = isoSerial(cycleEndForBill(bill));
  if (!Number.isFinite(startSerial) || !Number.isFinite(endSerial)) return paidSerial >= dueSerial;
  return paidSerial >= startSerial && paidSerial < endSerial;
}

function billStatusMeta(bill) {
  if (!bill) return { label: "No bill", tone: "neutral", percent: 0, isPaid: false };
  if (bill.active === false) return { label: "Inactive", tone: "neutral", percent: 0, isPaid: false };
  if (isBillPaidThisCycle(bill)) return { label: "Paid", tone: "green", percent: 100, isPaid: true };
  const due = dueMeta(daysUntil(bill.dueDate));
  return { ...due, isPaid: false };
}

function compactDueText(days) {
  if (!Number.isFinite(days)) return "No date";
  if (days < 0) return `${Math.abs(days)}d late`;
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function estimatedMonthlyInterest(balance, aprPct) {
  const b = safeNum(balance, 0);
  const apr = safeNum(aprPct, 0);
  return round2((b * apr) / 1200);
}

function payoffMonths(balance, aprPct, monthlyPayment) {
  const b = safeNum(balance, 0);
  const apr = safeNum(aprPct, 0);
  const pay = safeNum(monthlyPayment, 0);
  if (b <= 0 || pay <= 0) return 0;
  const r = apr / 100 / 12;
  if (r <= 0) return Math.ceil(b / pay);
  if (pay <= b * r) return Infinity;
  const months = -Math.log(1 - (r * b) / pay) / Math.log(1 + r);
  return Number.isFinite(months) ? Math.ceil(months) : Infinity;
}

function payoffLabel(balance, aprPct, payment) {
  const months = payoffMonths(balance, aprPct, payment);
  if (months === Infinity) return "Payment too low";
  if (months <= 0) return "Paid off";
  if (months < 12) return `${months} mo payoff`;
  const years = months / 12;
  return `${years.toFixed(years >= 2 ? 1 : 2)} yr payoff`;
}

function toneMeta(tone = "neutral") {
  if (tone === "green") return { text: "#97efc7", border: "rgba(143, 240, 191, 0.18)", glow: "rgba(110, 229, 173, 0.10)", bg: "rgba(11, 22, 17, 0.66)" };
  if (tone === "amber") return { text: "#f5cf88", border: "rgba(255, 204, 112, 0.18)", glow: "rgba(255, 194, 92, 0.10)", bg: "rgba(22, 17, 11, 0.66)" };
  if (tone === "red") return { text: "#ffb4c5", border: "rgba(255, 132, 163, 0.18)", glow: "rgba(255, 108, 145, 0.10)", bg: "rgba(22, 11, 15, 0.66)" };
  return { text: "#f7fbff", border: "rgba(214, 226, 255, 0.14)", glow: "rgba(140, 170, 255, 0.08)", bg: "rgba(10, 15, 24, 0.66)" };
}

function buildEmptyBillForm(defaultAccountId = "") {
  return {
    name: "",
    amount: "",
    dueDate: isoDate(),
    frequency: "monthly",
    category: "",
    notes: "",
    accountId: defaultAccountId || "",
    autopay: false,
    lastPaidDate: "",
    isDebtBill: false,
    debtMode: "none",
    linkedDebtId: "",
    newDebtName: "",
    newDebtBalance: "",
    newDebtAprPct: "",
    newDebtMinPay: "",
    newDebtExtraPay: "",
    newDebtFrequency: "monthly",
    newDebtDueDate: isoDate(),
    newDebtCategory: "",
    newDebtNotes: "",
    newDebtAccountId: defaultAccountId || "",
    newDebtAutopay: false,
  };
}

function buildBillEditorState(bill, linkedDebt, defaultAccountId = "") {
  if (!bill) return buildEmptyBillForm(defaultAccountId);
  return {
    name: bill.name || "",
    amount: String(bill.amount ?? ""),
    dueDate: bill.dueDate || isoDate(),
    frequency: bill.frequency || "monthly",
    category: bill.category || "",
    notes: bill.notes || "",
    accountId: bill.accountId || defaultAccountId || "",
    autopay: bill.autopay === true,
    lastPaidDate: bill.lastPaidDate || "",
    isDebtBill: !!bill.linkedDebtId,
    debtMode: bill.linkedDebtId ? "link_existing" : "none",
    linkedDebtId: bill.linkedDebtId || "",
    newDebtName: linkedDebt?.name || bill.name || "",
    newDebtBalance: linkedDebt ? String(linkedDebt.balance ?? "") : "",
    newDebtAprPct: linkedDebt ? String(linkedDebt.aprPct ?? "") : "",
    newDebtMinPay: linkedDebt ? String(linkedDebt.minPay ?? "") : String(bill.amount ?? ""),
    newDebtExtraPay: linkedDebt ? String(linkedDebt.extraPay ?? "") : "",
    newDebtFrequency: linkedDebt?.frequency || bill.frequency || "monthly",
    newDebtDueDate: linkedDebt?.dueDate || bill.dueDate || isoDate(),
    newDebtCategory: linkedDebt?.category || bill.category || "",
    newDebtNotes: linkedDebt?.notes || bill.notes || "",
    newDebtAccountId: linkedDebt?.accountId || bill.accountId || defaultAccountId || "",
    newDebtAutopay: linkedDebt ? linkedDebt.autopay === true : bill.autopay === true,
  };
}

function buildPaymentDraft(bill, fallbackAccountId = "") {
  return {
    amount: bill ? String(bill.amount || "") : "",
    paymentDate: isoDate(),
    accountId: bill?.accountId || fallbackAccountId || "",
    note: "",
    advanceDue: true,
    saving: false,
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
    aprPct: safeNum(row.apr_pct, 0),
    autopay: row.autopay === true,
    category: row.category || "",
    notes: row.notes || "",
    accountId: row.account_id || "",
    linkedDebtId: row.linked_debt_id || "",
    lastPaidDate: row.last_paid_date || "",
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

function mapAccountRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "",
    type: row.account_type || "other",
    balance: safeNum(row.balance, 0),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

function mapPaymentRowToClient(row) {
  return {
    id: row.id,
    billId: row.bill_id,
    linkedDebtId: row.linked_debt_id || "",
    amount: safeNum(row.amount, 0),
    paymentDate: row.payment_date || "",
    accountId: row.payment_account_id || "",
    note: row.note || "",
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function mapSpendingTransactionRow(id, userId, bill, paymentAmount, paymentDate, accountName, note = "") {
  return {
    id,
    user_id: userId,
    type: "expense",
    amount: round2(paymentAmount),
    category_id: null,
    tx_date: paymentDate,
    tx_time: null,
    merchant: bill.name || "Bill Payment",
    note: `[Bill Payment] ${bill.name || "Bill"}${note ? ` • ${note}` : ""}`,
    payment_method: "Bill Payment",
    account_name: accountName || "",
    created_at: ledgerTimestampFromIso(paymentDate),
    updated_at: new Date().toISOString(),
  };
}

function shouldAdvanceDueDateForPayment(bill, paymentDate, advanceDue) {
  if (!advanceDue) return false;
  if (String(bill?.frequency || "").toLowerCase() === "one_time") return false;
  const dueSerial = isoSerial(bill?.dueDate);
  const paymentSerial = isoSerial(paymentDate);
  if (!Number.isFinite(dueSerial)) return false;
  if (!Number.isFinite(paymentSerial)) return true;
  return paymentSerial >= dueSerial || dueSerial <= todaySerial();
}

function ActionBtn({ children, onClick, variant = "ghost", full = false, type = "button", disabled = false }) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="billActionBtn"
      style={{
        width: full ? "100%" : undefined,
        border: isDanger ? "1px solid rgba(255,132,163,0.20)" : isPrimary ? "1px solid rgba(143,177,255,0.22)" : "1px solid rgba(214,226,255,0.10)",
        background: isDanger ? "linear-gradient(180deg, rgba(255,132,163,0.11), rgba(255,132,163,0.04))" : isPrimary ? "linear-gradient(180deg, rgba(143,177,255,0.18), rgba(143,177,255,0.06))" : "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.014))",
        color: isDanger ? "#ffd3df" : "#f7fbff",
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function IconGhostBtn({ children, onClick, title, danger = false, disabled = false }) {
  return (
    <button type="button" className={`billIconGhost${danger ? " billIconGhostDanger" : ""}`} onClick={onClick} title={title} aria-label={title} disabled={disabled}>
      {children}
    </button>
  );
}

function MiniPill({ children, tone = "neutral" }) {
  const meta = toneMeta(tone);
  return (
    <div style={{ minHeight: 30, display: "inline-flex", alignItems: "center", gap: 8, padding: "0 10px", borderRadius: 999, border: `1px solid ${meta.border}`, background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 10px ${meta.glow}`, color: tone === "neutral" ? "rgba(255,255,255,0.88)" : meta.text, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
      {children}
    </div>
  );
}

function PaneHeader({ title, subcopy, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 17, lineHeight: 1.08, fontWeight: 850, letterSpacing: "-0.035em", color: "#fff" }}>{title}</div>
        {subcopy ? <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: "rgba(255,255,255,0.60)" }}>{subcopy}</div> : null}
      </div>
      {right || null}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail, tone = "neutral" }) {
  const meta = toneMeta(tone);
  return (
    <GlassPane tone={tone} size="card" style={{ height: "100%" }}>
      <div style={{ minHeight: 112, display: "grid", gridTemplateRows: "auto auto 1fr", gap: 7 }}>
        <div style={{ width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", border: `1px solid ${meta.border}`, background: meta.bg, color: tone === "neutral" ? "#fff" : meta.text, boxShadow: `0 0 10px ${meta.glow}` }}>
          <Icon size={15} />
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".2em", fontWeight: 800, color: "rgba(255,255,255,0.40)" }}>{label}</div>
          <div style={{ marginTop: 8, fontSize: "clamp(18px, 2.2vw, 28px)", lineHeight: 1, fontWeight: 850, letterSpacing: "-0.05em", color: tone === "neutral" ? "#fff" : meta.text }}>{value}</div>
        </div>
        <div style={{ fontSize: 11.5, lineHeight: 1.4, color: "rgba(255,255,255,0.60)" }}>{detail}</div>
      </div>
    </GlassPane>
  );
}

function ProgressBar({ fill = 0, tone = "neutral" }) {
  const normalized = Math.max(0, Math.min(100, safeNum(fill)));
  const toneMap = {
    neutral: "linear-gradient(90deg, rgba(96,165,250,.95), rgba(147,197,253,.95))",
    green: "linear-gradient(90deg, rgba(74,222,128,.95), rgba(167,243,208,.95))",
    amber: "linear-gradient(90deg, rgba(251,191,36,.95), rgba(253,230,138,.95))",
    red: "linear-gradient(90deg, rgba(248,113,113,.95), rgba(252,165,165,.95))",
  };
  return <div className="billProgress"><div className="billProgressFill" style={{ width: `${normalized}%`, background: toneMap[tone] || toneMap.neutral }} /></div>;
}

function SectionCard({ title, subcopy, children, right }) {
  return <div className="billSectionCard"><PaneHeader title={title} subcopy={subcopy} right={right} />{children}</div>;
}

function DrawerShell({ open, title, subcopy, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="billDrawerRoot">
      <button type="button" className="billDrawerBackdrop" onClick={onClose} />
      <div className="billDrawerPanel">
        <div className="billDrawerHeader">
          <div>
            <div className="billDrawerEyebrow">Bills Workspace</div>
            <div className="billDrawerTitle">{title}</div>
            {subcopy ? <div className="billDrawerSub">{subcopy}</div> : null}
          </div>
          <IconGhostBtn onClick={onClose} title="Close panel"><X size={16} /></IconGhostBtn>
        </div>
        <div className="billDrawerBody">{children}</div>
        {footer ? <div className="billDrawerFooter">{footer}</div> : null}
      </div>
    </div>
  );
}

function ModalShell({ open, title, subcopy, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="billModalRoot">
      <button type="button" className="billModalBackdrop" onClick={onClose} />
      <div className="billModalPanel">
        <div className="billModalHeader">
          <div>
            <div className="billDrawerEyebrow">Bills Workspace</div>
            <div className="billDrawerTitle">{title}</div>
            {subcopy ? <div className="billDrawerSub">{subcopy}</div> : null}
          </div>
          <IconGhostBtn onClick={onClose} title="Close history"><X size={16} /></IconGhostBtn>
        </div>
        <div className="billModalBody">{children}</div>
        {footer ? <div className="billModalFooter">{footer}</div> : null}
      </div>
    </div>
  );
}

function BillMoreMenu({ bill, onEdit, onDuplicate, onToggle, onDelete, disabled = false }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    function handleWindowClick() { setOpen(false); }
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [open]);

  function run(action) {
    setOpen(false);
    action?.();
  }

  return (
    <div className="billMoreMenu" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="billMoreTrigger" aria-label="More bill tools" aria-expanded={open} onClick={() => setOpen((prev) => !prev)} disabled={disabled}>
        <MoreHorizontal size={16} />
      </button>
      {open ? (
        <div className="billMorePanel">
          <button type="button" className="billMoreItem" onClick={() => run(onEdit)}><PencilLine size={14} />Edit bill</button>
          <button type="button" className="billMoreItem" onClick={() => run(onDuplicate)}><Copy size={14} />Duplicate</button>
          <button type="button" className="billMoreItem" onClick={() => run(onToggle)}><ArrowUpRight size={14} />{bill?.active ? "Archive bill" : "Activate bill"}</button>
          <button type="button" className="billMoreItem billMoreDanger" onClick={() => run(onDelete)}><Trash2 size={14} />Delete bill</button>
        </div>
      ) : null}
    </div>
  );
}

function DueTile({ bill, status }) {
  const dueDays = daysUntil(bill?.dueDate);
  const meta = toneMeta(status?.tone || "neutral");
  const topLine = status?.isPaid ? (bill?.lastPaidDate ? `Paid ${shortDate(bill.lastPaidDate)}` : "Paid") : shortDate(bill?.dueDate);
  const bottomLine = status?.isPaid ? "Paid" : compactDueText(dueDays);
  return (
    <div className="billDueTile" style={{ borderColor: meta.border, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 18px ${meta.glow}` }}>
      <div className="billDueTileIcon" style={{ color: status?.tone === "neutral" ? "#fff" : meta.text, background: meta.bg, borderColor: meta.border }}><CalendarClock size={14} /></div>
      <div className="billDueTileDate">{topLine}</div>
      <div className="billDueTileMeta" style={{ color: status?.tone === "neutral" ? "rgba(255,255,255,0.7)" : meta.text }}>{bottomLine}</div>
    </div>
  );
}

function BillRosterRow({ bill, selected, onSelect }) {
  const status = billStatusMeta(bill);
  const meta = toneMeta(status.tone);
  const monthly = monthlyWeight(bill.amount, bill.frequency);
  return (
    <button type="button" className="billCompactRow" onClick={onSelect} style={{ borderColor: selected ? meta.border : "rgba(255,255,255,0.07)", boxShadow: selected ? `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(255,255,255,0.01), 0 0 24px ${meta.glow}` : "inset 0 1px 0 rgba(255,255,255,0.025)" }}>
      <DueTile bill={bill} status={status} />
      <div style={{ minWidth: 0 }}>
        <div className="billStatusRow">
          <div className="billCompactTitle">{bill.name || "Bill"}</div>
          <MiniPill tone={status.tone}>{status.label}</MiniPill>
          {bill.autopay ? <MiniPill tone="green">Autopay</MiniPill> : null}
          {bill.linkedDebtId ? <MiniPill><Link2 size={12} />Linked debt</MiniPill> : null}
          {!bill.active ? <MiniPill>Inactive</MiniPill> : null}
        </div>
        <div className="billCompactSub">{bill.category || "No category"} • {bill.frequency} • Monthly pressure {money(monthly)} • Updated {fmtAgo(bill.updatedAt)}</div>
      </div>
      <div className="billCompactValue">{money(bill.amount)}</div>
    </button>
  );
}

function PaymentHistory({ payments, accountNameById, deletingPaymentId, onDeletePayment }) {
  if (!payments.length) {
    return <div className="billEmptyState billInlineEmpty"><div><div className="billEmptyTitle">No payment history yet</div><div className="billEmptyText">Use the payment box to log a payment on this bill.</div></div></div>;
  }
  return (
    <div className="billIntelList">
      {payments.map((payment) => (
        <div key={payment.id} className="billIntelItem">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div className="billIntelTitle">{moneyTight(payment.amount)}</div>
              <div className="billIntelSub">{shortDate(payment.paymentDate)} • {payment.accountId ? accountNameById.get(payment.accountId) || "Account" : "No account linked"}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <MiniPill tone="green">Paid</MiniPill>
              <IconGhostBtn onClick={() => onDeletePayment?.(payment)} title="Delete payment" danger disabled={deletingPaymentId === payment.id}><Trash2 size={14} /></IconGhostBtn>
            </div>
          </div>
          {payment.note ? <div className="billIntelSub" style={{ marginTop: -2 }}>{payment.note}</div> : null}
        </div>
      ))}
    </div>
  );
}

function DebtSetupSection({ value, setValue, debtProfiles, accounts, defaultAccountId }) {
  const usableAccounts = accounts.filter((account) => !isInvestmentAccountType(account.type));
  const selectedDebt = debtProfiles.find((debt) => debt.id === value.linkedDebtId) || null;

  function turnIntoDebtBill() {
    setValue((prev) => ({ ...prev, isDebtBill: true, debtMode: prev.debtMode === "none" ? (debtProfiles.length ? "link_existing" : "create_new") : prev.debtMode }));
  }

  function turnIntoFixedBill() {
    setValue((prev) => ({ ...prev, isDebtBill: false, debtMode: "none", linkedDebtId: "" }));
  }

  return (
    <SectionCard title="Debt Setup" subcopy="Keep fixed bills simple or connect the bill to a real debt profile.">
      <div className="billInlineTools">
        <ActionBtn variant={!value.isDebtBill ? "primary" : "ghost"} onClick={turnIntoFixedBill}>Fixed bill</ActionBtn>
        <ActionBtn variant={value.isDebtBill ? "primary" : "ghost"} onClick={turnIntoDebtBill}>Debt / payoff bill</ActionBtn>
      </div>
      {value.isDebtBill ? (
        <div className="billFormStack" style={{ marginTop: 14 }}>
          <div>
            <div className="billTinyLabel">Debt setup mode</div>
            <div className="billInlineTools">
              <ActionBtn variant={value.debtMode === "link_existing" ? "primary" : "ghost"} onClick={() => setValue((prev) => ({ ...prev, debtMode: "link_existing" }))}>Link existing debt</ActionBtn>
              <ActionBtn variant={value.debtMode === "create_new" ? "primary" : "ghost"} onClick={() => setValue((prev) => ({ ...prev, debtMode: "create_new", linkedDebtId: "", newDebtName: prev.newDebtName || prev.name, newDebtMinPay: prev.newDebtMinPay || prev.amount, newDebtAccountId: prev.newDebtAccountId || prev.accountId || defaultAccountId || "", newDebtDueDate: prev.newDebtDueDate || prev.dueDate || isoDate(), newDebtCategory: prev.newDebtCategory || prev.category || "" }))}>Create new debt</ActionBtn>
            </div>
          </div>
          {value.debtMode === "link_existing" ? (
            <div>
              <div className="billTinyLabel">Choose debt profile</div>
              <select className="billField billFieldStrong" value={value.linkedDebtId} onChange={(e) => setValue((prev) => ({ ...prev, linkedDebtId: e.target.value }))}>
                <option value="">Select a debt profile</option>
                {debtProfiles.map((debt) => <option key={debt.id} value={debt.id}>{debt.name} • {money(debt.balance)} • {safeNum(debt.aprPct, 0)}% APR</option>)}
              </select>
              <div className="billInlineHint">{selectedDebt ? `Linked to ${selectedDebt.name}. Balance ${money(selectedDebt.balance)} • minimum ${moneyTight(selectedDebt.minPay)} • extra ${moneyTight(selectedDebt.extraPay)}` : "Pick the debt this bill should pay down."}</div>
            </div>
          ) : null}
          {value.debtMode === "create_new" ? (
            <>
              <div className="billFormGrid4">
                <div><div className="billTinyLabel">Debt name</div><input className="billField billFieldStrong" value={value.newDebtName} onChange={(e) => setValue((prev) => ({ ...prev, newDebtName: e.target.value }))} placeholder="Capital One" /></div>
                <div><div className="billTinyLabel">Current balance</div><input className="billField billFieldStrong" inputMode="decimal" value={value.newDebtBalance} onChange={(e) => setValue((prev) => ({ ...prev, newDebtBalance: e.target.value }))} placeholder="0.00" /></div>
                <div><div className="billTinyLabel">APR %</div><input className="billField billFieldStrong" inputMode="decimal" value={value.newDebtAprPct} onChange={(e) => setValue((prev) => ({ ...prev, newDebtAprPct: e.target.value }))} placeholder="0" /></div>
                <div><div className="billTinyLabel">Minimum payment</div><input className="billField billFieldStrong" inputMode="decimal" value={value.newDebtMinPay} onChange={(e) => setValue((prev) => ({ ...prev, newDebtMinPay: e.target.value }))} placeholder="0.00" /></div>
              </div>
              <div className="billFormGrid4">
                <div><div className="billTinyLabel">Extra payment</div><input className="billField billFieldStrong" inputMode="decimal" value={value.newDebtExtraPay} onChange={(e) => setValue((prev) => ({ ...prev, newDebtExtraPay: e.target.value }))} placeholder="0.00" /></div>
                <div><div className="billTinyLabel">Debt due date</div><input type="date" className="billField billFieldStrong" value={value.newDebtDueDate} onChange={(e) => setValue((prev) => ({ ...prev, newDebtDueDate: e.target.value }))} /></div>
                <div><div className="billTinyLabel">Debt frequency</div><select className="billField billFieldStrong" value={value.newDebtFrequency} onChange={(e) => setValue((prev) => ({ ...prev, newDebtFrequency: e.target.value }))}>{FREQUENCY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
                <div><div className="billTinyLabel">Debt account</div><select className="billField billFieldStrong" value={value.newDebtAccountId} onChange={(e) => setValue((prev) => ({ ...prev, newDebtAccountId: e.target.value }))}><option value="">No linked account</option>{usableAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} • {accountTypeLabel(account.type)}</option>)}</select></div>
              </div>
              <div className="billFormGrid2">
                <div><div className="billTinyLabel">Debt category</div><input className="billField billFieldStrong" value={value.newDebtCategory} onChange={(e) => setValue((prev) => ({ ...prev, newDebtCategory: e.target.value }))} placeholder="Auto, credit card, personal" /></div>
                <div><div className="billTinyLabel">Debt autopay</div><div className="billInlineTools"><ActionBtn variant={value.newDebtAutopay ? "primary" : "ghost"} onClick={() => setValue((prev) => ({ ...prev, newDebtAutopay: true }))}>On</ActionBtn><ActionBtn variant={!value.newDebtAutopay ? "primary" : "ghost"} onClick={() => setValue((prev) => ({ ...prev, newDebtAutopay: false }))}>Off</ActionBtn></div></div>
              </div>
              <div><div className="billTinyLabel">Debt notes</div><textarea className="billField billFieldStrong" rows={4} value={value.newDebtNotes} onChange={(e) => setValue((prev) => ({ ...prev, newDebtNotes: e.target.value }))} placeholder="Optional debt note..." /></div>
            </>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}

function BillDrawer({ open, mode, form, setForm, onClose, onSave, saving, accounts, debtProfiles, defaultAccountId }) {
  const paymentAccounts = accounts.filter((account) => !isInvestmentAccountType(account.type));
  return (
    <DrawerShell open={open} title={mode === "add" ? "New Bill" : "Edit Bill"} subcopy={mode === "add" ? "Create a clean new bill without stretching the page." : "Edit the bill here, save, and get back to the summary view."} onClose={onClose} footer={<><ActionBtn onClick={onClose}>Close</ActionBtn><ActionBtn variant="primary" onClick={onSave} disabled={saving}><Save size={14} />{saving ? "Saving..." : mode === "add" ? "Add Bill" : "Save Changes"}</ActionBtn></>}>
      <div className="billFormStack">
        <SectionCard title="Bill Core" subcopy="Primary bill info, schedule, and default account.">
          <div className="billFormStack">
            <div><div className="billTinyLabel">Bill name</div><input className="billField billFieldStrong" placeholder="Rent, Electric, Internet..." value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} /></div>
            <div className="billFormGrid3">
              <div><div className="billTinyLabel">Amount</div><input className="billField billFieldStrong" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} /></div>
              <div><div className="billTinyLabel">Due date</div><input type="date" className="billField billFieldStrong" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} /></div>
              <div><div className="billTinyLabel">Frequency</div><select className="billField billFieldStrong" value={form.frequency} onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value }))}>{FREQUENCY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
            </div>
            <div className="billFormGrid2">
              <div><div className="billTinyLabel">Category</div><input className="billField billFieldStrong" placeholder="Housing" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} /></div>
              <div><div className="billTinyLabel">Linked account</div><select className="billField billFieldStrong" value={form.accountId} onChange={(e) => setForm((prev) => ({ ...prev, accountId: e.target.value }))}><option value="">No linked account</option>{paymentAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} • {accountTypeLabel(account.type)} • {money(account.balance)}</option>)}</select></div>
            </div>
            <div><div className="billTinyLabel">Notes</div><textarea className="billField billFieldStrong" rows={5} placeholder="Optional note..." value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} /></div>
            <div><div className="billTinyLabel">Autopay</div><div className="billInlineTools"><ActionBtn variant={form.autopay ? "primary" : "ghost"} onClick={() => setForm((prev) => ({ ...prev, autopay: true }))}>On</ActionBtn><ActionBtn variant={!form.autopay ? "primary" : "ghost"} onClick={() => setForm((prev) => ({ ...prev, autopay: false }))}>Off</ActionBtn></div></div>
          </div>
        </SectionCard>
        <DebtSetupSection value={form} setValue={setForm} debtProfiles={debtProfiles} accounts={paymentAccounts} defaultAccountId={defaultAccountId} />
      </div>
    </DrawerShell>
  );
}

function RailCard({ title, subcopy, right, children }) {
  return <GlassPane size="card"><PaneHeader title={title} subcopy={subcopy} right={right} />{children}</GlassPane>;
}

function BillSummaryCard({ bill, debtProfiles, accounts, paymentAccounts, payments, paymentDraft, setPaymentDraft, onMakePayment, onDeletePayment, deletingPaymentId, onOpenEdit, onDuplicate, onToggle, onDelete, onOpenHistory, onCloseHistory, historyOpen, paymentBusy = false }) {
  if (!bill) {
    return <GlassPane size="card"><PaneHeader title="Selected Bill" subcopy="Choose one from the roster to work it here." /><div className="billEmptyState" style={{ minHeight: 260 }}><div><div className="billEmptyTitle">No bill selected</div><div className="billEmptyText">Pick one from the roster on the left.</div></div></div></GlassPane>;
  }

  const status = billStatusMeta(bill);
  const meta = toneMeta(status.tone);
  const linkedDebt = debtProfiles.find((debt) => debt.id === bill.linkedDebtId) || null;
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const monthlyPressure = monthlyWeight(bill.amount, bill.frequency);
  const debtPayoff = linkedDebt ? payoffLabel(linkedDebt.balance, linkedDebt.aprPct, safeNum(linkedDebt.minPay, 0) + safeNum(linkedDebt.extraPay, 0)) : "—";
  const debtInterest = linkedDebt ? estimatedMonthlyInterest(linkedDebt.balance, linkedDebt.aprPct) : 0;

  return (
    <GlassPane tone={status.tone} size="card" style={{ height: "100%" }}>
      <PaneHeader title={bill.name || "Bill"} subcopy="Summary first. Action in the middle. Details on demand." right={<div className="billFocusHeaderTools"><ActionBtn onClick={onOpenEdit}><PencilLine size={14} />Edit</ActionBtn><BillMoreMenu bill={bill} onEdit={onOpenEdit} onDuplicate={onDuplicate} onToggle={onToggle} onDelete={onDelete} /></div>} />
      <div className="billFocusBox">
        <div className="billSummaryHero">
          <div>
            <div className="billTinyLabel">Current Bill Amount</div>
            <div style={{ marginTop: 8, fontSize: "clamp(34px, 4vw, 50px)", lineHeight: 1, fontWeight: 850, letterSpacing: "-0.06em", color: status.tone === "neutral" ? "#fff" : meta.text }}>{money(bill.amount)}</div>
            <div className="billHeroSubline">Updated {fmtWhen(bill.updatedAt)}</div>
          </div>
          <div className="billHeroChips">
            <MiniPill tone={status.tone}>{status.label}</MiniPill>
            {bill.autopay ? <MiniPill tone="green">Autopay</MiniPill> : null}
            {linkedDebt ? <MiniPill><Link2 size={12} />{linkedDebt.name}</MiniPill> : null}
            {!bill.active ? <MiniPill>Inactive</MiniPill> : null}
          </div>
        </div>
        <div style={{ marginTop: 14 }}><ProgressBar fill={status.percent} tone={status.tone} /></div>
        <div className="billInfoGrid" style={{ marginTop: 14 }}>
          <div className="billInfoCell"><div className="billTinyLabel">Status</div><div className="billInfoValue">{status.label}</div><div className="billInfoSub">{status.isPaid ? bill.lastPaidDate ? `Paid ${shortDate(bill.lastPaidDate)}` : "Paid this cycle" : compactDueText(daysUntil(bill.dueDate))}</div></div>
          <div className="billInfoCell"><div className="billTinyLabel">Due Cycle</div><div className="billInfoValue">{shortDate(bill.dueDate)}</div><div className="billInfoSub">{FREQUENCY_OPTIONS.find((opt) => opt.value === bill.frequency)?.label || bill.frequency}</div></div>
          <div className="billInfoCell"><div className="billTinyLabel">Linked Account</div><div className="billInfoValue">{accountNameById.get(bill.accountId) || "None"}</div><div className="billInfoSub">Default pay-from account</div></div>
          <div className="billInfoCell"><div className="billTinyLabel">Linked Debt</div><div className="billInfoValue">{linkedDebt?.name || "None"}</div><div className="billInfoSub">{linkedDebt ? `Balance ${money(linkedDebt.balance)}` : "No debt profile attached"}</div></div>
          <div className="billInfoCell"><div className="billTinyLabel">Last Paid</div><div className="billInfoValue">{shortDate(bill.lastPaidDate)}</div><div className="billInfoSub">{payments.length ? `${payments.length} logged payment${payments.length === 1 ? "" : "s"}` : "No payment history"}</div></div>
          <div className="billInfoCell"><div className="billTinyLabel">Monthly Pressure</div><div className="billInfoValue">{money(monthlyPressure)}</div><div className="billInfoSub">Estimated current-cycle bill load</div></div>
        </div>
        <div className="billSummarySplit">
          <SectionCard title="Make Payment" subcopy="Pay here. It also mirrors into Spending automatically." right={<ActionBtn onClick={onOpenHistory}><Receipt size={14} />History</ActionBtn>}>
            <div className="billPaymentSectionHead">
              <div className="billHistoryMetaRow">
                <MiniPill tone={status.tone}>{status.label}</MiniPill>
                <MiniPill>{shortDate(bill.dueDate)}</MiniPill>
                <MiniPill tone="green">Logs to Spending</MiniPill>
                {linkedDebt ? <MiniPill>Syncs debt balance</MiniPill> : null}
              </div>
              <div className="billInlineHint">Log the payment here. The bill row flips to paid, the account ledger updates, and Spending gets the mirrored expense record.</div>
            </div>
            <div className="billPaymentGrid billPaymentGridBetter">
              <div><div className="billTinyLabel">Payment Amount</div><input className="billField billFieldStrong" inputMode="decimal" placeholder="0.00" value={paymentDraft.amount} onChange={(e) => setPaymentDraft((prev) => ({ ...prev, amount: e.target.value }))} /></div>
              <div><div className="billTinyLabel">Payment Date</div><input type="date" className="billField billFieldStrong" value={paymentDraft.paymentDate} onChange={(e) => setPaymentDraft((prev) => ({ ...prev, paymentDate: e.target.value }))} /></div>
              <div><div className="billTinyLabel">Pay From Account</div><select className="billField billFieldStrong" value={paymentDraft.accountId} onChange={(e) => setPaymentDraft((prev) => ({ ...prev, accountId: e.target.value }))}><option value="">No account linked</option>{paymentAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} • {money(account.balance)} • {accountTypeLabel(account.type)}</option>)}</select></div>
              <div className="billPaymentNoteSpan"><div className="billTinyLabel">Payment Note</div><textarea className="billField billFieldStrong" rows={3} placeholder="Optional payment note..." value={paymentDraft.note} onChange={(e) => setPaymentDraft((prev) => ({ ...prev, note: e.target.value }))} /></div>
            </div>
            <div className="billPaymentActionBar">
              <div><div className="billTinyLabel">Advance Due Date</div><div className="billInlineTools"><ActionBtn variant={paymentDraft.advanceDue ? "primary" : "ghost"} onClick={() => setPaymentDraft((prev) => ({ ...prev, advanceDue: true }))}>Yes</ActionBtn><ActionBtn variant={!paymentDraft.advanceDue ? "primary" : "ghost"} onClick={() => setPaymentDraft((prev) => ({ ...prev, advanceDue: false }))}>No</ActionBtn></div></div>
              <ActionBtn variant="primary" onClick={onMakePayment} disabled={paymentBusy}><BadgeDollarSign size={14} />{paymentBusy ? "Saving..." : "Make Payment"}</ActionBtn>
            </div>
          </SectionCard>
          <SectionCard title="Linked Debt Snapshot" subcopy="If this bill is tied to debt, keep the debt pulse visible here.">
            {linkedDebt ? (
              <div className="billDebtSnapshot">
                <div className="billDebtSnapshotRow"><span>Debt name</span><strong>{linkedDebt.name}</strong></div>
                <div className="billDebtSnapshotRow"><span>Balance</span><strong>{money(linkedDebt.balance)}</strong></div>
                <div className="billDebtSnapshotRow"><span>APR</span><strong>{safeNum(linkedDebt.aprPct, 0)}%</strong></div>
                <div className="billDebtSnapshotRow"><span>Interest drag</span><strong>{moneyTight(debtInterest)}/mo</strong></div>
                <div className="billDebtSnapshotRow"><span>Payoff</span><strong>{debtPayoff}</strong></div>
              </div>
            ) : <div className="billEmptyMini">This bill is not connected to a debt profile.</div>}
          </SectionCard>
        </div>
      </div>
      <ModalShell open={historyOpen} title={`${bill.name || "Bill"} Payment History`} subcopy="Payment history stays out of the main card so this page feels tight." onClose={onCloseHistory} footer={<ActionBtn onClick={onCloseHistory}>Close</ActionBtn>}>
        <PaymentHistory payments={payments} accountNameById={accountNameById} deletingPaymentId={deletingPaymentId} onDeletePayment={onDeletePayment} />
      </ModalShell>
    </GlassPane>
  );
}

export default function BillsPage() {
  const [bills, setBills] = useState([]);
  const [debtProfiles, setDebtProfiles] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedBillId, setSelectedBillId] = useState("");
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState(null);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("active");
  const [sortBy, setSortBy] = useState("due_asc");
  const [savingSelected, setSavingSelected] = useState(false);
  const [addingBusy, setAddingBusy] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState("");
  const [editor, setEditor] = useState(buildEmptyBillForm(""));
  const [addForm, setAddForm] = useState(buildEmptyBillForm(""));
  const [drawerMode, setDrawerMode] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState("focus");
  const [paymentDraft, setPaymentDraft] = useState(() => buildPaymentDraft(null, ""));

  function revealPageMessage() {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  useEffect(() => {
    if (!status) return undefined;
    const id = window.setTimeout(() => setStatus(""), 2800);
    return () => window.clearTimeout(id);
  }, [status]);

  const paymentAccounts = useMemo(() => accounts.filter((account) => !isInvestmentAccountType(account.type)), [accounts]);

  const refreshPage = useCallback(async (preferredBillId = "") => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setPageError("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setUserId(null);
        setBills([]);
        setDebtProfiles([]);
        setAccounts([]);
        setPayments([]);
        setSelectedBillId("");
        setLoading(false);
        return;
      }
      setUserId(user.id);
      const [billsRes, debtsRes, accountsRes, settingsRes, paymentsRes] = await Promise.all([
        supabase.from("bills").select("*").eq("user_id", user.id).eq("type", "noncontrollable").order("due_date", { ascending: true }),
        supabase.from("bills").select("*").eq("user_id", user.id).eq("type", "controllable").order("name", { ascending: true }),
        supabase.from("accounts").select("*").eq("user_id", user.id).order("name", { ascending: true }),
        supabase.from("account_settings").select("primary_account_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("bill_payments").select("*").eq("user_id", user.id).order("payment_date", { ascending: false }),
      ]);
      if (billsRes.error) throw billsRes.error;
      if (debtsRes.error) throw debtsRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      const loadedBills = (billsRes.data || []).map(mapBillRowToClient);
      const loadedDebtProfiles = (debtsRes.data || []).map(mapBillRowToClient);
      const loadedAccounts = (accountsRes.data || []).map(mapAccountRowToClient);
      const primaryAccountId = settingsRes.data?.primary_account_id || loadedAccounts[0]?.id || "";
      setBills(loadedBills);
      setDebtProfiles(loadedDebtProfiles);
      setAccounts(loadedAccounts);
      setDefaultAccountId(primaryAccountId);
      setPayments((paymentsRes.data || []).map(mapPaymentRowToClient));
      setSelectedBillId((prev) => {
        if (preferredBillId && loadedBills.some((bill) => bill.id === preferredBillId)) return preferredBillId;
        if (prev && loadedBills.some((bill) => bill.id === prev)) return prev;
        return loadedBills[0]?.id || "";
      });
      setAddForm((prev) => ({ ...prev, accountId: prev.accountId || primaryAccountId, newDebtAccountId: prev.newDebtAccountId || primaryAccountId }));
    } catch (err) {
      setPageError(err?.message || "Failed to load bills.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPage();
    if (!supabase) return undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => refreshPage());
    return () => subscription?.unsubscribe?.();
  }, [refreshPage]);

  const visibleBills = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = bills.filter((bill) => {
      if (scope === "active" && !bill.active) return false;
      if (scope === "inactive" && bill.active) return false;
      if (!q) return true;
      return [bill.name, bill.category, bill.notes].join(" ").toLowerCase().includes(q);
    });
    if (sortBy === "amount_desc") return [...list].sort((a, b) => safeNum(b.amount) - safeNum(a.amount));
    if (sortBy === "name_asc") return [...list].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    if (sortBy === "updated_desc") return [...list].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    return [...list].sort((a, b) => (Number.isFinite(daysUntil(a.dueDate)) ? daysUntil(a.dueDate) : 999999) - (Number.isFinite(daysUntil(b.dueDate)) ? daysUntil(b.dueDate) : 999999));
  }, [bills, scope, search, sortBy]);

  useEffect(() => {
    if (!visibleBills.length) {
      setSelectedBillId("");
      return;
    }
    const exists = visibleBills.some((bill) => bill.id === selectedBillId);
    if (!exists) setSelectedBillId(visibleBills[0].id);
  }, [visibleBills, selectedBillId]);

  const selectedBill = bills.find((bill) => bill.id === selectedBillId) || visibleBills[0] || null;
  const selectedLinkedDebt = useMemo(() => selectedBill?.linkedDebtId ? debtProfiles.find((debt) => debt.id === selectedBill.linkedDebtId) || null : null, [selectedBill, debtProfiles]);

  useEffect(() => {
    if (!selectedBill) {
      setEditor(buildEmptyBillForm(defaultAccountId || ""));
      setPaymentDraft(buildPaymentDraft(null, defaultAccountId));
      return;
    }
    setEditor(buildBillEditorState(selectedBill, selectedLinkedDebt, defaultAccountId));
    setPaymentDraft(buildPaymentDraft(selectedBill, defaultAccountId));
  }, [selectedBill, selectedLinkedDebt, defaultAccountId]);

  useEffect(() => {
    if (selectedBillId) setMobileSection("focus");
  }, [selectedBillId]);

  const selectedBillPayments = useMemo(() => {
    if (!selectedBill) return [];
    return payments.filter((payment) => payment.billId === selectedBill.id).sort((a, b) => compareIsoDates(b.paymentDate, a.paymentDate) || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [payments, selectedBill?.id]);

  useEffect(() => setHistoryOpen(false), [selectedBillId]);

  const metrics = useMemo(() => {
    const activeBills = bills.filter((bill) => bill.active);
    const monthKey = monthKeyOf(isoDate());
    const monthlyPressure = activeBills.reduce((sum, bill) => sum + monthlyWeight(bill.amount, bill.frequency), 0);
    const dueSoon = activeBills.filter((bill) => { const dueIn = daysUntil(bill.dueDate); return Number.isFinite(dueIn) && dueIn >= 0 && dueIn <= 7; });
    const linkedDebtBills = activeBills.filter((bill) => !!bill.linkedDebtId);
    const paidThisMonth = payments.filter((payment) => monthKeyOf(payment.paymentDate) === monthKey).reduce((sum, payment) => sum + safeNum(payment.amount), 0);
    const nextBill = [...activeBills].sort((a, b) => { const ad = Number.isFinite(daysUntil(a.dueDate)) ? daysUntil(a.dueDate) : 999999; const bd = Number.isFinite(daysUntil(b.dueDate)) ? daysUntil(b.dueDate) : 999999; return ad - bd; })[0];
    return { activeCount: activeBills.length, linkedDebtCount: linkedDebtBills.length, monthlyPressure, dueSoonCount: dueSoon.length, paidThisMonth, nextBill };
  }, [bills, payments]);

  function openAddDrawer() {
    setHistoryOpen(false);
    setAddForm(buildEmptyBillForm(defaultAccountId || ""));
    setDrawerMode("add");
  }

  function openEditDrawer() {
    if (!selectedBill) return;
    setHistoryOpen(false);
    setEditor(buildBillEditorState(selectedBill, selectedLinkedDebt, defaultAccountId));
    setDrawerMode("edit");
  }

  function closeDrawer() {
    setDrawerMode(null);
  }

  async function getDefaultCalendarProfileId() {
    if (!userId) return null;
    const { data, error } = await supabase.from("calendar_profiles").select("id,is_default,created_at").eq("user_id", userId).order("is_default", { ascending: false }).order("created_at", { ascending: true }).limit(1);
    if (error) throw error;
    return data?.[0]?.id ?? null;
  }

  async function upsertCalendarForSpendingMirror(paymentId, bill, amount, paymentDate, note = "") {
    const profileId = await getDefaultCalendarProfileId();
    if (!profileId) return;
    const payload = {
      user_id: userId,
      profile_id: profileId,
      title: `Expense • ${bill.name || "Bill Payment"}`,
      event_date: paymentDate,
      event_time: null,
      end_time: null,
      category: "Expense",
      flow: "expense",
      amount: round2(amount),
      note: `[Bill Payment] ${bill.name || "Bill"}${note ? ` • ${note}` : ""}`,
      status: "scheduled",
      color: "#ef4444",
      source: "spending",
      source_id: paymentId,
      source_table: "spending_transactions",
      auto_created: true,
      transaction_type: "expense",
      updated_at: new Date().toISOString(),
    };
    const { data: existing, error: findError } = await supabase.from("calendar_events").select("id").eq("user_id", userId).eq("profile_id", profileId).eq("source", "spending").eq("source_id", paymentId).maybeSingle();
    if (findError) throw findError;
    if (existing?.id) {
      const { error: updateError } = await supabase.from("calendar_events").update(payload).eq("id", existing.id);
      if (updateError) throw updateError;
      return;
    }
    const { error: insertError } = await supabase.from("calendar_events").insert([{ id: uid(), created_at: new Date().toISOString(), ...payload }]);
    if (insertError) throw insertError;
  }

  async function deleteCalendarForSpendingMirror(paymentId) {
    const { error } = await supabase.from("calendar_events").delete().eq("user_id", userId).eq("source", "spending").eq("source_id", paymentId);
    if (error) throw error;
  }

  async function applyAccountDelta({ accountId, delta, kind, note, sourceType, sourceId, effectiveDate, startingBalance }) {
    if (!accountId) return { ok: true, previousBalance: null, balance: null };
    const account = accounts.find((row) => row.id === accountId);
    if (!account) return { ok: false, message: "Selected account was not found." };
    const previousBalance = Number.isFinite(startingBalance) ? safeNum(startingBalance, 0) : safeNum(account.balance, 0);
    const nextBalance = round2(previousBalance + safeNum(delta, 0));
    const { error: accountError } = await supabase.from("accounts").update({ balance: nextBalance, updated_at: new Date().toISOString() }).eq("id", account.id).eq("user_id", userId);
    if (accountError) return { ok: false, message: accountError.message || "Could not update account balance." };
    const { error: ledgerError } = await supabase.from("account_transactions").insert({ user_id: userId, account_id: account.id, kind, amount: round2(Math.abs(safeNum(delta, 0))), delta: round2(delta), resulting_balance: nextBalance, note: note || "", related_account_id: null, related_account_name: null, source_type: sourceType, source_id: sourceId, created_at: ledgerTimestampFromIso(effectiveDate) });
    if (ledgerError) {
      await supabase.from("accounts").update({ balance: previousBalance, updated_at: new Date().toISOString() }).eq("id", account.id).eq("user_id", userId);
      return { ok: false, message: ledgerError.message || "Could not write account ledger." };
    }
    return { ok: true, previousBalance, balance: nextBalance };
  }

  function getPaymentAccountEffect(accountId, amount) {
    const account = accounts.find((row) => row.id === accountId);
    if (!account) return { delta: 0, kind: "bill_payment" };
    const absAmount = Math.abs(round2(amount));
    if (isCreditAccountType(account.type)) return { delta: absAmount, kind: "bill_charge" };
    return { delta: -absAmount, kind: "bill_payment" };
  }

  async function createDebtProfileFromDraft(draft) {
    const billName = String(draft.name || "").trim();
    const billAmount = parseMoneyInput(draft.amount);
    const debtName = String(draft.newDebtName || billName).trim();
    const balance = parseMoneyInput(draft.newDebtBalance);
    const aprPct = parseMoneyInput(draft.newDebtAprPct || "0");
    const minPayRaw = parseMoneyInput(draft.newDebtMinPay || "");
    const extraPayRaw = parseMoneyInput(draft.newDebtExtraPay || "0");
    if (!debtName) throw new Error("Debt name is required.");
    if (!Number.isFinite(balance) || balance < 0) throw new Error("Debt balance must be 0 or greater.");
    const minPay = Number.isFinite(minPayRaw) && minPayRaw >= 0 ? minPayRaw : Number.isFinite(billAmount) && billAmount > 0 ? billAmount : 0;
    const extraPay = Number.isFinite(extraPayRaw) && extraPayRaw >= 0 ? extraPayRaw : 0;
    const nextDebtId = uid();
    const res = await supabase.from("bills").insert({ id: nextDebtId, user_id: userId, name: debtName, type: "controllable", frequency: draft.newDebtFrequency || draft.frequency || "monthly", due_date: draft.newDebtDueDate || draft.dueDate || isoDate(), amount: round2(Number.isFinite(billAmount) && billAmount > 0 ? billAmount : minPay), active: true, balance: round2(balance), min_pay: round2(minPay), extra_pay: round2(extraPay), apr_pct: round2(Number.isFinite(aprPct) ? aprPct : 0), autopay: draft.newDebtAutopay === true, category: draft.newDebtCategory || draft.category || "", notes: draft.newDebtNotes || "", account_id: draft.newDebtAccountId || draft.accountId || defaultAccountId || null, linked_debt_id: null, last_paid_date: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single();
    if (res.error) throw new Error(res.error.message || "Could not create debt profile.");
    return mapBillRowToClient(res.data);
  }

  async function resolveLinkedDebtIdFromDraft(draft) {
    if (!draft.isDebtBill) return "";
    if (draft.debtMode === "link_existing") {
      if (!draft.linkedDebtId) throw new Error("Choose an existing debt profile to link.");
      return draft.linkedDebtId;
    }
    if (draft.debtMode === "create_new") {
      const createdDebt = await createDebtProfileFromDraft(draft);
      return createdDebt.id;
    }
    throw new Error("Choose how this bill should connect to debt.");
  }

  async function addBill() {
    if (!supabase || !userId || addingBusy) return;
    const name = String(addForm.name || "").trim();
    const amount = parseMoneyInput(addForm.amount);
    if (!name) return setPageError("Bill name is required.");
    if (!Number.isFinite(amount) || amount <= 0) return setPageError("Amount must be greater than 0.");
    setAddingBusy(true);
    setPageError("");
    let createdDebtId = "";
    try {
      const linkedDebtId = await resolveLinkedDebtIdFromDraft(addForm);
      createdDebtId = addForm.isDebtBill && addForm.debtMode === "create_new" ? linkedDebtId : "";
      const nextBill = { id: uid(), name, amount: round2(amount), dueDate: addForm.dueDate || isoDate(), frequency: addForm.frequency || "monthly", category: addForm.category || "", notes: addForm.notes || "", accountId: addForm.accountId || "", linkedDebtId: linkedDebtId || "", autopay: addForm.autopay === true, active: true, balance: 0 };
      const res = await supabase.from("bills").insert({ id: nextBill.id, user_id: userId, name: nextBill.name, type: "noncontrollable", frequency: nextBill.frequency, due_date: nextBill.dueDate || null, amount: round2(nextBill.amount), active: true, balance: 0, min_pay: 0, extra_pay: 0, apr_pct: 0, autopay: nextBill.autopay === true, category: nextBill.category || "", notes: nextBill.notes || "", account_id: nextBill.accountId || null, linked_debt_id: nextBill.linkedDebtId || null, last_paid_date: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single();
      if (res.error) throw new Error(res.error.message || "Could not add bill.");
      const saved = mapBillRowToClient(res.data);
      setAddForm(buildEmptyBillForm(defaultAccountId || ""));
      setDrawerMode(null);
      setStatus(saved.linkedDebtId ? "Bill added and debt linked." : "Bill added.");
      await refreshPage(saved.id);
    } catch (err) {
      if (createdDebtId) {
        await supabase.from("bills").delete().eq("id", createdDebtId).eq("user_id", userId);
      }
      setPageError(err?.message || "Could not add bill.");
    } finally {
      setAddingBusy(false);
    }
  }

  async function saveSelectedBill() {
    if (!supabase || !userId || !selectedBill || savingSelected) return;
    const name = String(editor.name || "").trim();
    const amount = parseMoneyInput(editor.amount);
    if (!name) return setPageError("Bill name is required.");
    if (!Number.isFinite(amount) || amount <= 0) return setPageError("Amount must be greater than 0.");
    setSavingSelected(true);
    setPageError("");
    let createdDebtId = "";
    try {
      const linkedDebtId = await resolveLinkedDebtIdFromDraft(editor);
      createdDebtId = editor.isDebtBill && editor.debtMode === "create_new" ? linkedDebtId : "";
      const res = await supabase.from("bills").update({ name, frequency: editor.frequency || "monthly", due_date: editor.dueDate || null, amount: round2(amount), autopay: editor.autopay === true, category: editor.category || "", notes: editor.notes || "", account_id: editor.accountId || null, linked_debt_id: linkedDebtId || null, last_paid_date: editor.lastPaidDate || null, updated_at: new Date().toISOString() }).eq("id", selectedBill.id).eq("user_id", userId).select().single();
      if (res.error) throw new Error(res.error.message || "Could not save bill.");
      setDrawerMode(null);
      setStatus(linkedDebtId ? "Bill saved and debt linked." : "Bill saved.");
      await refreshPage(selectedBill.id);
    } catch (err) {
      if (createdDebtId) {
        await supabase.from("bills").delete().eq("id", createdDebtId).eq("user_id", userId);
      }
      setPageError(err?.message || "Could not save bill.");
    } finally {
      setSavingSelected(false);
    }
  }

  async function duplicateBill(bill) {
    if (!supabase || !userId) return;
    setPageError("");
    const res = await supabase.from("bills").insert({ id: uid(), user_id: userId, name: `${bill.name || "Bill"} Copy`, type: "noncontrollable", frequency: bill.frequency || "monthly", due_date: bill.dueDate || null, amount: round2(bill.amount), active: bill.active !== false, balance: round2(bill.balance), min_pay: round2(bill.minPay), extra_pay: round2(bill.extraPay), apr_pct: round2(bill.aprPct), autopay: bill.autopay === true, category: bill.category || "", notes: bill.notes || "", account_id: bill.accountId || null, linked_debt_id: bill.linkedDebtId || null, last_paid_date: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single();
    if (res.error) return setPageError(res.error.message || "Could not duplicate bill.");
    const saved = mapBillRowToClient(res.data);
    setStatus("Bill duplicated.");
    await refreshPage(saved.id);
  }

  async function deleteBillById(billId, billName = "this bill") {
    if (!supabase || !userId || !billId) return false;
    if (typeof window !== "undefined" && !window.confirm(`Delete ${billName}?`)) return false;
    setPageError("");
    const relatedPayments = payments.filter((payment) => payment.billId === billId);
    if (relatedPayments.length) {
      const paymentIds = relatedPayments.map((payment) => payment.id);
      const { error: spendingMirrorError } = await supabase.from("spending_transactions").delete().in("id", paymentIds).eq("user_id", userId);
      if (spendingMirrorError) return setPageError(spendingMirrorError.message || "Could not delete bill payment mirrors."), false;
      const { error: calendarMirrorError } = await supabase.from("calendar_events").delete().eq("user_id", userId).eq("source", "spending").in("source_id", paymentIds);
      if (calendarMirrorError) return setPageError(calendarMirrorError.message || "Could not delete bill payment calendar mirrors."), false;
      const { error: paymentsError } = await supabase.from("bill_payments").delete().eq("bill_id", billId).eq("user_id", userId);
      if (paymentsError) return setPageError(paymentsError.message || "Could not delete related payments."), false;
    }
    const { error } = await supabase.from("bills").delete().eq("id", billId).eq("user_id", userId);
    if (error) return setPageError(error.message || "Could not delete bill."), false;
    setDrawerMode(null);
    setStatus("Bill deleted.");
    await refreshPage();
    return true;
  }

  async function deleteBill() {
    if (!selectedBill) return;
    await deleteBillById(selectedBill.id, selectedBill.name || "this bill");
  }

  async function toggleBillActive(bill) {
    if (!supabase || !userId) return;
    setPageError("");
    const nextValue = !bill.active;
    const res = await supabase.from("bills").update({ active: nextValue, updated_at: new Date().toISOString() }).eq("id", bill.id).eq("user_id", userId).select().single();
    if (res.error) return setPageError(res.error.message || "Could not update bill.");
    setStatus(nextValue ? "Bill activated." : "Bill archived.");
    await refreshPage(bill.id);
  }

  async function makeBillPayment() {
    if (!supabase || !userId || !selectedBill || paymentDraft.saving) return;
    const amount = round2(parseMoneyInput(paymentDraft.amount));
    if (!Number.isFinite(amount) || amount <= 0) { setPageError("Enter a valid payment amount."); revealPageMessage(); return; }
    const paymentDate = paymentDraft.paymentDate || isoDate();
    const payAccountId = paymentDraft.accountId || "";
    const payNote = String(paymentDraft.note || "").trim();
    const payAccount = accounts.find((account) => account.id === payAccountId) || null;
    const shouldAdvanceDue = selectedBill.frequency !== "one_time" && shouldAdvanceDueDateForPayment(selectedBill, paymentDate, paymentDraft.advanceDue);
    const nextDueDate = shouldAdvanceDue ? nextDueDateFromFrequency(paymentDate || selectedBill.dueDate || isoDate(), selectedBill.frequency) : selectedBill.dueDate || "";
    const nextLastPaidDate = !selectedBill.lastPaidDate || compareIsoDates(paymentDate, selectedBill.lastPaidDate) > 0 ? paymentDate : selectedBill.lastPaidDate;
    const nextBalance = safeNum(selectedBill.balance, 0) > 0 ? Math.max(0, round2(safeNum(selectedBill.balance, 0) - amount)) : safeNum(selectedBill.balance, 0);
    const linkedDebt = debtProfiles.find((row) => row.id === selectedBill.linkedDebtId) || null;
    const nextLinkedDebtBalance = linkedDebt ? Math.max(0, round2(safeNum(linkedDebt.balance, 0) - amount)) : 0;
    const nextLinkedDebtLastPaidDate = linkedDebt && (!linkedDebt.lastPaidDate || compareIsoDates(paymentDate, linkedDebt.lastPaidDate) > 0) ? paymentDate : linkedDebt?.lastPaidDate || "";
    const shouldAdvanceLinkedDebtDue = linkedDebt && linkedDebt.frequency !== "one_time" && shouldAdvanceDueDateForPayment(linkedDebt, paymentDate, paymentDraft.advanceDue);
    const nextLinkedDebtDueDate = linkedDebt && shouldAdvanceLinkedDebtDue ? nextDueDateFromFrequency(paymentDate || linkedDebt.dueDate || isoDate(), linkedDebt.frequency) : linkedDebt?.dueDate || "";
    setPaymentDraft((prev) => ({ ...prev, saving: true }));
    setPageError("");
    const paymentId = uid();
    let accountEffect = null;
    let accountResult = null;
    let billUpdated = false;
    let linkedDebtUpdated = false;
    let spendingMirrorInserted = false;
    let calendarMirrorInserted = false;

    try {
      const paymentInsert = await supabase.from("bill_payments").insert({ id: paymentId, user_id: userId, bill_id: selectedBill.id, linked_debt_id: selectedBill.linkedDebtId || null, amount, payment_date: paymentDate, payment_account_id: payAccountId || null, note: payNote || null });
      if (paymentInsert.error) throw paymentInsert.error;
      if (payAccountId) {
        accountEffect = getPaymentAccountEffect(payAccountId, amount);
        accountResult = await applyAccountDelta({ accountId: payAccountId, delta: accountEffect.delta, kind: accountEffect.kind, note: `${selectedBill.name || "Bill"}${payNote ? ` • ${payNote}` : ""}`, sourceType: "bill_payment", sourceId: paymentId, effectiveDate: paymentDate });
        if (!accountResult.ok) throw new Error(accountResult.message || "Could not update payment account.");
      }
      const { error: billError } = await supabase.from("bills").update({ last_paid_date: nextLastPaidDate || null, due_date: nextDueDate || null, balance: nextBalance, updated_at: new Date().toISOString() }).eq("id", selectedBill.id).eq("user_id", userId);
      if (billError) throw billError;
      billUpdated = true;
      if (linkedDebt) {
        const { error: linkedDebtError } = await supabase.from("bills").update({ balance: nextLinkedDebtBalance, last_paid_date: nextLinkedDebtLastPaidDate || null, due_date: nextLinkedDebtDueDate || null, updated_at: new Date().toISOString() }).eq("id", linkedDebt.id).eq("user_id", userId);
        if (linkedDebtError) throw linkedDebtError;
        linkedDebtUpdated = true;
      }
      const spendingMirror = mapSpendingTransactionRow(paymentId, userId, selectedBill, amount, paymentDate, payAccount?.name || "", payNote);
      const { error: spendingError } = await supabase.from("spending_transactions").insert([spendingMirror]);
      if (spendingError) throw spendingError;
      spendingMirrorInserted = true;
      try {
        await upsertCalendarForSpendingMirror(paymentId, selectedBill, amount, paymentDate, payNote);
        calendarMirrorInserted = true;
      } catch (calendarErr) {
        console.error("Bill payment calendar mirror failed", calendarErr);
      }
      setPaymentDraft(buildPaymentDraft(null, selectedBill.accountId || defaultAccountId || ""));
      setStatus(calendarMirrorInserted
        ? linkedDebt ? "Payment logged, debt synced, Spending updated, and calendar synced." : "Payment logged, Spending updated, and calendar synced."
        : linkedDebt ? "Payment logged, debt synced, and Spending updated." : "Payment logged and Spending updated.");
      revealPageMessage();
      await refreshPage(selectedBill.id);
    } catch (err) {
      if (calendarMirrorInserted) {
        await deleteCalendarForSpendingMirror(paymentId).catch(() => {});
      }
      if (spendingMirrorInserted) {
        await supabase.from("spending_transactions").delete().eq("id", paymentId).eq("user_id", userId);
      }
      if (linkedDebt && linkedDebtUpdated) {
        await supabase.from("bills").update({ balance: linkedDebt.balance, last_paid_date: linkedDebt.lastPaidDate || null, due_date: linkedDebt.dueDate || null, updated_at: new Date().toISOString() }).eq("id", linkedDebt.id).eq("user_id", userId);
      }
      if (billUpdated) {
        await supabase.from("bills").update({ last_paid_date: selectedBill.lastPaidDate || null, due_date: selectedBill.dueDate || null, balance: selectedBill.balance, updated_at: new Date().toISOString() }).eq("id", selectedBill.id).eq("user_id", userId);
      }
      if (accountEffect && accountResult?.ok) {
        await applyAccountDelta({ accountId: payAccountId, delta: -accountEffect.delta, kind: "bill_payment_rollback", note: `${selectedBill.name || "Bill"} payment rollback`, sourceType: "bill_payment_rollback", sourceId: paymentId, effectiveDate: isoDate(), startingBalance: accountResult.balance });
      }
      await supabase.from("bill_payments").delete().eq("id", paymentId).eq("user_id", userId);
      setPageError(err?.message || "Could not save payment.");
      revealPageMessage();
      setPaymentDraft((prev) => ({ ...prev, saving: false }));
      await refreshPage(selectedBill.id);
    }
  }

  async function deletePayment(payment) {
    if (!supabase || !userId || !payment || deletingPaymentId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this payment?")) return;
    setDeletingPaymentId(payment.id);
    setPageError("");
    const currentBill = bills.find((bill) => bill.id === payment.billId);
    const linkedDebt = debtProfiles.find((debt) => debt.id === (payment.linkedDebtId || currentBill?.linkedDebtId || "")) || null;
    const remainingBillPayments = payments.filter((row) => row.billId === payment.billId && row.id !== payment.id).sort((a, b) => compareIsoDates(b.paymentDate, a.paymentDate) || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const remainingLinkedDebtPayments = linkedDebt ? payments.filter((row) => row.id !== payment.id && (row.linkedDebtId === linkedDebt.id || row.billId === linkedDebt.id)).sort((a, b) => compareIsoDates(b.paymentDate, a.paymentDate) || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()) : [];
    let reversalResult = null;
    let originalEffect = null;
    let billUpdated = false;
    let linkedDebtUpdated = false;

    try {
      if (payment.accountId) {
        originalEffect = getPaymentAccountEffect(payment.accountId, payment.amount);
        reversalResult = await applyAccountDelta({ accountId: payment.accountId, delta: -originalEffect.delta, kind: "bill_payment_delete", note: `${currentBill?.name || "Bill"} payment deleted${payment.note ? ` • ${payment.note}` : ""}`, sourceType: "bill_payment_delete", sourceId: payment.id, effectiveDate: isoDate() });
        if (!reversalResult.ok) throw new Error(reversalResult.message || "Could not reverse payment account.");
      }
      if (currentBill) {
        const nextLastPaidDate = remainingBillPayments[0]?.paymentDate || "";
        const billPatch = { last_paid_date: nextLastPaidDate || null, updated_at: new Date().toISOString(), balance: safeNum(currentBill.balance, 0) > 0 ? round2(safeNum(currentBill.balance, 0) + safeNum(payment.amount, 0)) : safeNum(currentBill.balance, 0) };
        if (currentBill.frequency !== "one_time" && currentBill.lastPaidDate && compareIsoDates(payment.paymentDate, currentBill.lastPaidDate) === 0) {
          billPatch.due_date = previousDueDateFromFrequency(currentBill.dueDate, currentBill.frequency);
        }
        const { error: updateBillError } = await supabase.from("bills").update(billPatch).eq("id", currentBill.id).eq("user_id", userId);
        if (updateBillError) throw updateBillError;
        billUpdated = true;
      }
      if (linkedDebt) {
        const nextDebtLastPaidDate = remainingLinkedDebtPayments[0]?.paymentDate || "";
        const linkedDebtPatch = { last_paid_date: nextDebtLastPaidDate || null, balance: round2(safeNum(linkedDebt.balance, 0) + safeNum(payment.amount, 0)), updated_at: new Date().toISOString() };
        if (linkedDebt.frequency !== "one_time" && linkedDebt.lastPaidDate && compareIsoDates(payment.paymentDate, linkedDebt.lastPaidDate) === 0) {
          linkedDebtPatch.due_date = previousDueDateFromFrequency(linkedDebt.dueDate, linkedDebt.frequency);
        }
        const { error: updateLinkedDebtError } = await supabase.from("bills").update(linkedDebtPatch).eq("id", linkedDebt.id).eq("user_id", userId);
        if (updateLinkedDebtError) throw updateLinkedDebtError;
        linkedDebtUpdated = true;
      }
      const { error: spendingMirrorError } = await supabase.from("spending_transactions").delete().eq("id", payment.id).eq("user_id", userId);
      if (spendingMirrorError) throw spendingMirrorError;
      await deleteCalendarForSpendingMirror(payment.id).catch(() => {});
      const { error: deletePaymentError } = await supabase.from("bill_payments").delete().eq("id", payment.id).eq("user_id", userId);
      if (deletePaymentError) {
        if (currentBill && billUpdated) {
          await supabase.from("bills").update({ last_paid_date: currentBill.lastPaidDate || null, due_date: currentBill.dueDate || null, balance: currentBill.balance, updated_at: new Date().toISOString() }).eq("id", currentBill.id).eq("user_id", userId);
        }
        if (linkedDebt && linkedDebtUpdated) {
          await supabase.from("bills").update({ last_paid_date: linkedDebt.lastPaidDate || null, due_date: linkedDebt.dueDate || null, balance: linkedDebt.balance, updated_at: new Date().toISOString() }).eq("id", linkedDebt.id).eq("user_id", userId);
        }
        if (payment.accountId && originalEffect && reversalResult?.ok) {
          await applyAccountDelta({ accountId: payment.accountId, delta: originalEffect.delta, kind: "bill_payment_delete_rollback", note: `${currentBill?.name || "Bill"} delete rollback`, sourceType: "bill_payment_delete_rollback", sourceId: payment.id, effectiveDate: isoDate(), startingBalance: reversalResult.balance });
        }
        throw deletePaymentError;
      }
      setStatus(linkedDebt ? "Payment deleted, debt resynced, and Spending cleaned up." : "Payment deleted and Spending cleaned up.");
      await refreshPage(currentBill?.id || selectedBillId);
    } catch (err) {
      setPageError(err?.message || "Could not delete payment.");
      await refreshPage(currentBill?.id || selectedBillId);
    } finally {
      setDeletingPaymentId("");
    }
  }

  if (loading) {
    return <main className="billPage"><div className="billPageShell"><GlassPane size="card"><div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>Loading bills.</div></GlassPane></div><style jsx global>{globalStyles}</style></main>;
  }

  if (!userId) {
    return <main className="billPage"><div className="billPageShell"><GlassPane size="card"><div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>Please log in</div></GlassPane></div><style jsx global>{globalStyles}</style></main>;
  }

  const nextDueTone = metrics.nextBill ? dueMeta(daysUntil(metrics.nextBill.dueDate)).tone : "neutral";

  return (
    <>
      <main className="billPage">
        <div className="billPageShell">
          <GlassPane size="card">
            <div className="billHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div className="billEyebrow">Life Command Center</div>
                <div className="billHeroTitle">Bills Command</div>
                <div className="billHeroSub">A tighter bills workspace built to match Spending instead of feeling like a loose page of stacked panes.</div>
                <div className="billPillRow"><MiniPill>{metrics.activeCount} active bills</MiniPill><MiniPill tone="amber">{metrics.dueSoonCount} due soon</MiniPill><MiniPill tone="green">{money(metrics.paidThisMonth)} paid this month</MiniPill><MiniPill>{metrics.linkedDebtCount} debt-linked</MiniPill></div>
              </div>
              <div className="billHeroSide"><MiniPill>{money(metrics.monthlyPressure)} monthly</MiniPill><MiniPill tone={nextDueTone}>{metrics.nextBill ? `Next: ${metrics.nextBill.name}` : "No next due"}</MiniPill></div>
            </div>
          </GlassPane>

          {pageError ? <GlassPane tone="red" size="card"><div style={{ fontWeight: 800, fontSize: 15, color: "#fff" }}>{pageError}</div></GlassPane> : null}
          {status ? <GlassPane tone="green" size="card"><div style={{ fontWeight: 800, fontSize: 14, color: "#9ef0c0" }}>{status}</div></GlassPane> : null}

          <section className="billMetricGrid">
            <StatCard icon={Landmark} label="Monthly Pressure" value={money(metrics.monthlyPressure)} detail="Estimated fixed bill pressure for the month." tone="green" />
            <StatCard icon={CalendarClock} label="Due In 7 Days" value={String(metrics.dueSoonCount)} detail="Bills with due dates in the next 7 days." tone={metrics.dueSoonCount > 0 ? "amber" : "green"} />
            <StatCard icon={BadgeDollarSign} label="Paid This Month" value={money(metrics.paidThisMonth)} detail="Logged bill payments this month." tone="green" />
            <StatCard icon={Link2} label="Linked Debt Bills" value={String(metrics.linkedDebtCount)} detail="Bills that auto-sync into a debt profile." tone={metrics.linkedDebtCount > 0 ? "amber" : "neutral"} />
          </section>

          <GlassPane size="card">
            <PaneHeader title="Bill Controls" subcopy="Search the roster, filter bill status, and sort how you want." right={<ActionBtn variant="primary" onClick={openAddDrawer}><Plus size={14} />New Bill</ActionBtn>} />
            <div className="billControlsGrid">
              <div><div className="billTinyLabel">Search</div><div className="billSearchWrap"><Search size={15} /><input className="billField billSearchField" placeholder="Search bill" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
              <div><div className="billTinyLabel">Scope</div><div className="billInlineTools"><ActionBtn variant={scope === "active" ? "primary" : "ghost"} onClick={() => setScope("active")}>Active</ActionBtn><ActionBtn variant={scope === "all" ? "primary" : "ghost"} onClick={() => setScope("all")}>All</ActionBtn><ActionBtn variant={scope === "inactive" ? "primary" : "ghost"} onClick={() => setScope("inactive")}>Inactive</ActionBtn></div></div>
              <div><div className="billTinyLabel">Sort</div><select className="billField billFieldStrong" value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="due_asc">Due first</option><option value="amount_desc">Amount high → low</option><option value="name_asc">Name</option><option value="updated_desc">Recently updated</option></select></div>
            </div>
          </GlassPane>

          <div className="billMobileSwitch">
            {MOBILE_SECTIONS.map((item) => (
              <ActionBtn key={item.value} variant={mobileSection === item.value ? "primary" : "ghost"} onClick={() => setMobileSection(item.value)}>{item.label}</ActionBtn>
            ))}
          </div>

          <section className="billWorkspaceGrid">
            <GlassPane size="card" style={{ height: "100%" }} className={`billMobilePanel ${mobileSection === "list" ? "billMobilePanelActive" : ""}`}>
              <div className="billRosterPane">
                <PaneHeader title="Bills Roster" subcopy="Choose the bill you want to work. Focus stays clean in the center." right={<MiniPill>{visibleBills.length} showing</MiniPill>} />
                {visibleBills.length ? <div className="billRosterListCompact">{visibleBills.map((bill) => <BillRosterRow key={bill.id} bill={bill} selected={bill.id === selectedBill?.id} onSelect={() => { setSelectedBillId(bill.id); setMobileSection("focus"); }} />)}</div> : <div className="billEmptyState billGrowEmpty"><div><div className="billEmptyTitle">No bills found</div><div className="billEmptyText">Clear filters or add a new bill.</div></div></div>}
              </div>
            </GlassPane>

            <div className={`billMobilePanel ${mobileSection === "focus" ? "billMobilePanelActive" : ""}`}>
              <BillSummaryCard bill={selectedBill} debtProfiles={debtProfiles} accounts={accounts} paymentAccounts={paymentAccounts} payments={selectedBillPayments} paymentDraft={paymentDraft} setPaymentDraft={setPaymentDraft} onMakePayment={makeBillPayment} onDeletePayment={deletePayment} deletingPaymentId={deletingPaymentId} onOpenEdit={openEditDrawer} onDuplicate={() => selectedBill && duplicateBill(selectedBill)} onToggle={() => selectedBill && toggleBillActive(selectedBill)} onDelete={deleteBill} onOpenHistory={() => setHistoryOpen(true)} onCloseHistory={() => setHistoryOpen(false)} historyOpen={historyOpen} paymentBusy={paymentDraft.saving} />
            </div>

            <div className={`billRailStack billMobilePanel ${mobileSection === "tools" ? "billMobilePanelActive" : ""}`}>
              <RailCard title="Quick Tools" subcopy="Fast actions without stretching the page.">
                <div className="billActionGrid billActionGridSingle"><ActionBtn variant="primary" onClick={openAddDrawer} full><Plus size={14} />New Bill</ActionBtn><ActionBtn onClick={openEditDrawer} full disabled={!selectedBill}><PencilLine size={14} />Edit Selected Bill</ActionBtn></div>
              </RailCard>
              <RailCard title="Selected Bill Snapshot" subcopy="The fast pulse of the currently focused bill." right={selectedBill ? <MiniPill tone={billStatusMeta(selectedBill).tone}>{billStatusMeta(selectedBill).label}</MiniPill> : null}>
                {selectedBill ? <div className="billInsightList"><div className="billInsightItem"><div className="billInsightTitle">Bill</div><div className="billInsightValue">{selectedBill.name}</div><div className="billInsightSub">{money(selectedBill.amount)} • {FREQUENCY_OPTIONS.find((opt) => opt.value === selectedBill.frequency)?.label || selectedBill.frequency}</div></div><div className="billInsightItem"><div className="billInsightTitle">Linked account</div><div className="billInsightValue">{accounts.find((a) => a.id === selectedBill.accountId)?.name || "None"}</div><div className="billInsightSub">{selectedBill.autopay ? "Autopay on" : "Autopay off"}</div></div><div className="billInsightItem"><div className="billInsightTitle">Linked debt</div><div className="billInsightValue">{selectedLinkedDebt?.name || "None"}</div><div className="billInsightSub">{selectedLinkedDebt ? `${money(selectedLinkedDebt.balance)} • ${safeNum(selectedLinkedDebt.aprPct, 0)}% APR` : "No debt connection"}</div></div></div> : <div className="billEmptyMini">No bill selected.</div>}
              </RailCard>
              <RailCard title="Debt Snapshot" subcopy="If this bill pays down debt, keep the debt story visible.">
                {selectedLinkedDebt ? <div className="billInsightList"><div className="billInsightItem"><div className="billInsightTitle">Balance</div><div className="billInsightValue">{money(selectedLinkedDebt.balance)}</div><div className="billInsightSub">Estimated interest {moneyTight(estimatedMonthlyInterest(selectedLinkedDebt.balance, selectedLinkedDebt.aprPct))}/mo</div></div><div className="billInsightItem"><div className="billInsightTitle">Payoff</div><div className="billInsightValue">{payoffLabel(selectedLinkedDebt.balance, selectedLinkedDebt.aprPct, safeNum(selectedLinkedDebt.minPay, 0) + safeNum(selectedLinkedDebt.extraPay, 0))}</div><div className="billInsightSub">Plan {moneyTight(safeNum(selectedLinkedDebt.minPay, 0) + safeNum(selectedLinkedDebt.extraPay, 0))}/mo</div></div></div> : <div className="billEmptyMini">No debt attached to the selected bill.</div>}
              </RailCard>
            </div>
          </section>
        </div>
      </main>

      <BillDrawer open={drawerMode === "edit"} mode="edit" form={editor} setForm={setEditor} onClose={closeDrawer} onSave={saveSelectedBill} saving={savingSelected} accounts={accounts} debtProfiles={debtProfiles} defaultAccountId={defaultAccountId} />
      <BillDrawer open={drawerMode === "add"} mode="add" form={addForm} setForm={setAddForm} onClose={closeDrawer} onSave={addBill} saving={addingBusy} accounts={accounts} debtProfiles={debtProfiles} defaultAccountId={defaultAccountId} />

      <style jsx global>{globalStyles}</style>
    </>
  );
}

const globalStyles = `
  .billPage { width: 100%; min-width: 0; color: var(--lcc-text); font-family: var(--lcc-font-sans); }
  .billPageShell { width: 100%; max-width: none; margin: 0; padding: 0 0 20px; display: grid; gap: 14px; }
  .billEyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: .22em; font-weight: 800; color: rgba(255,255,255,0.42); }
  .billHeroTitle { margin-top: 8px; font-size: clamp(24px, 3.2vw, 34px); line-height: 1.02; font-weight: 850; letter-spacing: -0.05em; color: #fff; }
  .billHeroSub { margin-top: 8px; font-size: 13px; line-height: 1.55; color: rgba(255,255,255,0.62); max-width: 840px; }
  .billHeroGrid { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: start; }
  .billHeroSide { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; align-content: flex-start; }
  .billPillRow { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
  .billMetricGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  .billControlsGrid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr) minmax(220px, 0.58fr); gap: 14px; align-items: end; }
  .billWorkspaceGrid { display: grid; grid-template-columns: minmax(300px, 0.88fr) minmax(0, 1.42fr) minmax(270px, 0.74fr); gap: 14px; align-items: stretch; }
  .billWorkspaceGrid > * { min-width: 0; height: 100%; }
  .billRosterPane { height: 100%; min-height: 0; display: flex; flex-direction: column; }
  .billRailStack { display: grid; gap: 14px; }
  .billSearchWrap { position: relative; display: flex; align-items: center; gap: 8px; min-height: 46px; border-radius: 16px; border: 1px solid rgba(214,226,255,0.11); background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012)), rgba(8, 12, 20, 0.82); color: rgba(255,255,255,0.58); padding: 0 12px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 10px 30px rgba(0,0,0,0.16); }
  .billSearchField { min-height: 42px !important; border: 0 !important; background: transparent !important; box-shadow: none !important; padding: 0 !important; }
  .billRosterListCompact { flex: 1 1 auto; min-height: 0; overflow: auto; display: grid; gap: 10px; padding-right: 2px; }
  .billCompactRow { width: 100%; display: grid; grid-template-columns: 84px minmax(0, 1fr) auto; gap: 10px; align-items: center; min-height: 108px; padding: 12px 14px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.07); background: linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.74)); cursor: pointer; transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease; text-align: left; }
  .billCompactRow:hover { transform: translateY(-1px); }
  .billCompactTitle { font-size: 13.5px; font-weight: 800; color: #fff; line-height: 1.2; overflow-wrap: anywhere; }
  .billCompactSub { margin-top: 4px; font-size: 11.5px; color: rgba(255,255,255,0.54); line-height: 1.35; }
  .billCompactValue { font-size: 15px; font-weight: 850; color: #fff; white-space: nowrap; }
  .billFocusHeaderTools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .billFocusBox { border-radius: 24px; border: 1px solid rgba(214,226,255,0.12); background: linear-gradient(180deg, rgba(255,255,255,0.032), rgba(255,255,255,0.01)); padding: 16px; min-height: 100%; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 18px 50px rgba(0,0,0,0.18); }
  .billSummaryHero { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: start; }
  .billHeroSubline { margin-top: 10px; font-size: 12px; color: rgba(255,255,255,0.58); }
  .billHeroChips { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; align-items: flex-start; }
  .billInfoGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .billInfoCell { border-radius: 18px; border: 1px solid rgba(255,255,255,0.055); background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.018)); padding: 12px; }
  .billInfoValue { font-size: 0.98rem; font-weight: 900; line-height: 1.15; color: #fff; overflow-wrap: anywhere; }
  .billInfoSub { margin-top: 5px; color: rgba(255,255,255,0.62); font-size: 0.79rem; line-height: 1.4; }
  .billSummarySplit { margin-top: 14px; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.8fr); gap: 14px; }
  .billSectionCard { border-radius: 22px; border: 1px solid rgba(214,226,255,0.11); background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.012)); padding: 14px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03); }
  .billDebtSnapshot, .billInsightList { display: grid; gap: 10px; }
  .billDebtSnapshotRow, .billInsightItem { border-radius: 16px; border: 1px solid rgba(255,255,255,0.055); background: rgba(255,255,255,0.024); padding: 12px; }
  .billDebtSnapshotRow { display: flex; justify-content: space-between; gap: 12px; align-items: center; color: rgba(255,255,255,0.62); font-size: 12px; }
  .billDebtSnapshotRow strong { color: #fff; font-size: 13px; }
  .billInsightTitle { font-size: 10px; text-transform: uppercase; letter-spacing: .14em; font-weight: 800; color: rgba(255,255,255,0.46); }
  .billInsightValue { margin-top: 6px; font-size: 15px; font-weight: 900; color: #fff; line-height: 1.25; }
  .billInsightSub { margin-top: 5px; font-size: 12px; line-height: 1.45; color: rgba(255,255,255,0.62); }
  .billPaymentGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .billPaymentGridBetter { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .billPaymentSectionHead { display: grid; gap: 10px; margin-bottom: 12px; }
  .billHistoryMetaRow { display: flex; gap: 8px; flex-wrap: wrap; }
  .billPaymentActionBar { margin-top: 14px; display: flex; justify-content: space-between; gap: 14px; align-items: flex-end; flex-wrap: wrap; }
  .billPaymentNoteSpan { grid-column: span 2; }
  .billProgress { height: 8px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,0.10); }
  .billProgressFill { height: 100%; border-radius: 999px; transition: width 0.4s ease; }
  .billFormStack { display: grid; gap: 12px; }
  .billFormGrid2, .billFormGrid3, .billFormGrid4 { display: grid; gap: 10px; }
  .billFormGrid2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .billFormGrid3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .billFormGrid4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .billTinyLabel { display: block; margin-bottom: 8px; font-size: 10px; color: rgba(255,255,255,0.46); text-transform: uppercase; letter-spacing: .16em; font-weight: 800; }
  .billField { width: 100%; min-height: 46px; border-radius: 16px; border: 1px solid rgba(214,226,255,0.11); background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012)), rgba(8, 12, 20, 0.84); color: var(--lcc-text); padding: 0 14px; outline: none; font: inherit; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 22px rgba(0,0,0,0.14); transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease, transform 160ms ease; }
  .billFieldStrong { border-color: rgba(214,226,255,0.14); background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.014)), rgba(7, 12, 21, 0.9); }
  .billField:focus { border-color: rgba(143,177,255,0.34); box-shadow: 0 0 0 4px rgba(79,114,255,0.08), 0 14px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04); transform: translateY(-1px); }
  .billField::placeholder { color: rgba(225,233,245,0.38); }
  .billField option { background: #08111f; color: #f4f7ff; }
  textarea.billField { min-height: 110px; resize: vertical; padding: 12px 14px; }
  .billActionGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .billActionGridSingle { grid-template-columns: 1fr; }
  .billActionBtn { min-height: 42px; padding: 10px 13px; border-radius: 15px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; font-weight: 800; line-height: 1; transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 20px rgba(0,0,0,0.14); }
  .billActionBtn:hover { transform: translateY(-1px); }
  .billInlineTools { display: flex; gap: 8px; flex-wrap: wrap; }
  .billInlineHint { margin-top: 8px; font-size: 12px; line-height: 1.45; color: rgba(255,255,255,0.60); }
  .billIconGhost { width: 36px; height: 36px; border-radius: 12px; border: 1px solid rgba(214,226,255,0.10); background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012)); color: rgba(247,251,255,0.88); display: grid; place-items: center; cursor: pointer; transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
  .billIconGhost:hover { transform: translateY(-1px); }
  .billIconGhostDanger { border-color: rgba(255,132,163,0.18); color: #ffd3df; }
  .billIntelList { display: grid; gap: 10px; min-height: 160px; max-height: 300px; overflow: auto; padding-right: 2px; }
  .billIntelItem { border-radius: 18px; border: 1px solid rgba(255,255,255,0.07); background: linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72)); padding: 12px; display: grid; gap: 10px; }
  .billIntelTitle { font-size: 13px; font-weight: 800; color: #fff; line-height: 1.25; overflow-wrap: anywhere; }
  .billIntelSub { margin-top: 4px; font-size: 11.5px; color: rgba(255,255,255,0.54); line-height: 1.35; }
  .billEmptyState { min-height: 150px; display: grid; place-items: center; text-align: center; padding: 14px; }
  .billGrowEmpty { flex: 1 1 auto; min-height: 0; }
  .billInlineEmpty { min-height: 180px; }
  .billEmptyTitle { font-size: 16px; font-weight: 850; color: #fff; }
  .billEmptyText { margin-top: 6px; font-size: 13px; line-height: 1.5; color: rgba(255,255,255,0.60); max-width: 360px; }
  .billEmptyMini { border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.024); padding: 14px; color: rgba(255,255,255,0.62); font-size: 12.5px; line-height: 1.5; }
  .billMoreMenu { position: relative; }
  .billMoreTrigger { width: 36px; height: 36px; border-radius: 12px; border: 1px solid rgba(214,226,255,0.12); background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012)); color: rgba(247,251,255,0.88); display: grid; place-items: center; cursor: pointer; transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
  .billMoreTrigger:disabled { opacity: 0.55; cursor: not-allowed; }
  .billMoreTrigger:hover { transform: translateY(-1px); }
  .billMorePanel { position: absolute; top: calc(100% + 8px); right: 0; min-width: 190px; z-index: 20; display: grid; gap: 6px; padding: 8px; border-radius: 16px; border: 1px solid rgba(214,226,255,0.12); background: linear-gradient(180deg, rgba(10,15,24,0.96), rgba(6,10,18,0.96)); box-shadow: 0 18px 50px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04); }
  .billMoreItem { min-height: 40px; width: 100%; border-radius: 12px; border: 1px solid rgba(214,226,255,0.10); background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012)); color: #f7fbff; display: inline-flex; align-items: center; justify-content: flex-start; gap: 8px; padding: 0 12px; font-size: 12.5px; font-weight: 800; cursor: pointer; }
  .billMoreDanger { border-color: rgba(255,132,163,0.18); color: #ffd3df; }
  .billDrawerRoot { position: fixed; inset: 0; z-index: 1200; display: flex; justify-content: flex-end; }
  .billDrawerBackdrop { position: absolute; inset: 0; border: 0; background: rgba(3, 6, 12, 0.62); backdrop-filter: blur(8px); cursor: pointer; }
  .billDrawerPanel { position: relative; width: min(760px, 100%); height: 100%; background: linear-gradient(180deg, rgba(7,12,21,0.96), rgba(4,8,16,0.97)); border-left: 1px solid rgba(214,226,255,0.12); box-shadow: -24px 0 80px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.03); display: grid; grid-template-rows: auto 1fr auto; }
  .billDrawerHeader { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; padding: 18px 18px 16px; border-bottom: 1px solid rgba(214,226,255,0.08); }
  .billDrawerEyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: .18em; font-weight: 800; color: rgba(255,255,255,0.42); }
  .billDrawerTitle { margin-top: 6px; font-size: 26px; line-height: 1.02; font-weight: 850; letter-spacing: -0.04em; color: #fff; }
  .billDrawerSub { margin-top: 8px; font-size: 13px; line-height: 1.55; color: rgba(255,255,255,0.62); max-width: 560px; }
  .billDrawerBody { overflow: auto; overscroll-behavior: contain; padding: 18px; display: grid; gap: 14px; min-height: 0; }
  .billDrawerFooter { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 18px 18px; border-top: 1px solid rgba(214,226,255,0.08); background: linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.02)); }
  .billStatusRow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .billDueTile { min-height: 82px; border-radius: 18px; border: 1px solid rgba(214,226,255,0.12); background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.014)), rgba(7, 12, 20, 0.88); padding: 10px; display: grid; gap: 6px; align-content: start; text-align: left; }
  .billDueTileIcon { width: 28px; height: 28px; border-radius: 10px; display: grid; place-items: center; border: 1px solid rgba(214,226,255,0.12); }
  .billDueTileDate { font-size: 11px; font-weight: 800; color: #fff; line-height: 1.25; overflow-wrap: anywhere; }
  .billDueTileMeta { font-size: 11px; font-weight: 800; line-height: 1.25; text-transform: uppercase; letter-spacing: .04em; }
  .billModalRoot { position: fixed; inset: 0; z-index: 1300; display: grid; place-items: center; padding: 20px; }
  .billModalBackdrop { position: absolute; inset: 0; border: 0; background: rgba(3, 6, 12, 0.68); backdrop-filter: blur(10px); cursor: pointer; }
  .billModalPanel { position: relative; width: min(860px, 100%); max-height: min(82vh, 900px); display: grid; grid-template-rows: auto 1fr auto; border-radius: 28px; overflow: hidden; border: 1px solid rgba(214,226,255,0.12); background: linear-gradient(180deg, rgba(7,12,21,0.96), rgba(4,8,16,0.97)); box-shadow: 0 28px 100px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.03); }
  .billModalHeader, .billModalFooter { padding: 18px; border-bottom: 1px solid rgba(214,226,255,0.08); }
  .billModalFooter { border-bottom: 0; border-top: 1px solid rgba(214,226,255,0.08); display: flex; justify-content: flex-end; gap: 10px; }
  .billModalBody { min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 18px; }
  .billMobileSwitch { display: none; gap: 8px; }
  .billMobilePanel { min-width: 0; }

  @media (max-width: 1420px) {
    .billControlsGrid { grid-template-columns: 1fr; }
    .billWorkspaceGrid { grid-template-columns: minmax(280px, 0.92fr) minmax(0, 1fr); }
    .billRailStack { grid-column: 1 / -1; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .billSummarySplit { grid-template-columns: 1fr; }
  }

  @media (max-width: 1260px) {
    .billMetricGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .billInfoGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .billFormGrid4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (max-width: 980px) {
    .billHeroGrid, .billSummaryHero { grid-template-columns: 1fr; }
    .billHeroSide, .billHeroChips { justify-content: flex-start; }
    .billRailStack { grid-template-columns: 1fr; }
    .billMobileSwitch { display: flex; flex-wrap: wrap; }
    .billWorkspaceGrid { grid-template-columns: 1fr; }
    .billMobilePanel { display: none; }
    .billMobilePanel.billMobilePanelActive { display: block; }
  }

  @media (max-width: 760px) {
    .billPageShell { padding: 0 0 14px; }
    .billMetricGrid, .billInfoGrid, .billFormGrid2, .billFormGrid3, .billFormGrid4, .billActionGrid, .billPaymentGrid, .billPaymentGridBetter { grid-template-columns: 1fr; }
    .billCompactRow { grid-template-columns: 84px minmax(0, 1fr); }
    .billCompactValue { grid-column: 2; white-space: normal; font-size: 13px; color: rgba(255,255,255,0.74); }
    .billPaymentNoteSpan { grid-column: auto; }
    .billPaymentActionBar { align-items: stretch; }
    .billDrawerHeader, .billDrawerBody, .billDrawerFooter, .billModalHeader, .billModalBody, .billModalFooter { padding-left: 14px; padding-right: 14px; }
    .billMorePanel { right: auto; left: 0; }
    .billDrawerPanel { width: 100%; }
  }
`;
