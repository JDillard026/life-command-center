"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Copy,
  Link2,
  MoreHorizontal,
  PencilLine,
  Plus,
  Receipt,
  Save,
  Search,
  Trash2,
  TrendingDown,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { writeAccountDelta } from "@/lib/accountLedger";

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */
function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function round2(n) {
  return Math.round((safeNum(n) + Number.EPSILON) * 100) / 100;
}

function parseMoneyInput(v) {
  const c = String(v ?? "").replace(/[^0-9.-]/g, "");
  const n = Number(c);
  return Number.isFinite(n) ? n : NaN;
}

function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function parseIsoParts(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { yyyy: +m[1], mm: +m[2], dd: +m[3] };
}

function isoToLocalDate(iso, h = 12) {
  const p = parseIsoParts(iso);
  if (!p) return null;
  return new Date(p.yyyy, p.mm - 1, p.dd, h, 0, 0, 0);
}

function isoSerial(iso) {
  const p = parseIsoParts(iso);
  if (!p) return null;
  return Math.floor(Date.UTC(p.yyyy, p.mm - 1, p.dd) / 86400000);
}

function todaySerial() {
  const n = new Date();
  return Math.floor(
    Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86400000
  );
}

function compareIsoDates(a, b) {
  const aa = isoSerial(a);
  const bb = isoSerial(b);
  if (!Number.isFinite(aa) || !Number.isFinite(bb)) return 0;
  return aa - bb;
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0";
  return x.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function moneyTight(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0.00";
  return x.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function shortDate(v) {
  if (!v) return "—";
  const d = isoToLocalDate(v, 12);
  if (!d || !Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
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
  return `${Math.round(hrs / 24)}d ago`;
}

function monthKeyOf(v) {
  const p = parseIsoParts(v);
  if (!p) return "";
  return `${p.yyyy}-${String(p.mm).padStart(2, "0")}`;
}

function addDays(iso, n) {
  const dt = isoToLocalDate(iso, 12);
  if (!dt) return "";
  dt.setDate(dt.getDate() + Number(n || 0));
  return isoDate(dt);
}

function addMonthsClamped(iso, n) {
  const dt = isoToLocalDate(iso, 12);
  if (!dt) return "";
  const day = dt.getDate();
  const nx = new Date(
    dt.getFullYear(),
    dt.getMonth() + Number(n || 0),
    1,
    12
  );
  const last = new Date(nx.getFullYear(), nx.getMonth() + 1, 0).getDate();
  nx.setDate(Math.min(day, last));
  return isoDate(nx);
}

function nextDueFromFreq(iso, freq) {
  const b = iso || isoDate();
  switch (String(freq || "").toLowerCase()) {
    case "weekly":
      return addDays(b, 7);
    case "biweekly":
      return addDays(b, 14);
    case "quarterly":
      return addMonthsClamped(b, 3);
    case "yearly":
      return addMonthsClamped(b, 12);
    case "one_time":
      return b;
    default:
      return addMonthsClamped(b, 1);
  }
}

function prevDueFromFreq(iso, freq) {
  const b = iso || isoDate();
  switch (String(freq || "").toLowerCase()) {
    case "weekly":
      return addDays(b, -7);
    case "biweekly":
      return addDays(b, -14);
    case "quarterly":
      return addMonthsClamped(b, -3);
    case "yearly":
      return addMonthsClamped(b, -12);
    case "one_time":
      return b;
    default:
      return addMonthsClamped(b, -1);
  }
}

function daysUntil(iso) {
  const s = isoSerial(iso);
  if (!Number.isFinite(s)) return null;
  return s - todaySerial();
}

function ledgerTs(iso) {
  const dt = isoToLocalDate(iso, 12) || new Date();
  return dt.toISOString();
}

function freqMult(freq) {
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

function moWeight(amt, freq) {
  return safeNum(amt) * freqMult(freq);
}

function normType(t) {
  return String(t || "other").toLowerCase().trim();
}

function isInvestment(t) {
  return normType(t) === "investment";
}

function dueMeta(days) {
  if (!Number.isFinite(days)) return { label: "No date", tone: "neutral", pct: 0 };
  if (days < 0) return { label: `${Math.abs(days)}d late`, tone: "red", pct: 100 };
  if (days === 0) return { label: "Due today", tone: "red", pct: 100 };
  if (days <= 3) return { label: `${days}d left`, tone: "red", pct: 90 };
  if (days <= 7) return { label: `${days}d left`, tone: "amber", pct: 68 };
  if (days <= 14) return { label: `${days}d left`, tone: "amber", pct: 44 };
  return { label: `${days}d left`, tone: "green", pct: 16 };
}

function cycleStart(bill) {
  if (!bill?.dueDate || !bill?.frequency) return "";
  if (String(bill.frequency).toLowerCase() === "one_time") return bill.dueDate;
  return prevDueFromFreq(bill.dueDate, bill.frequency);
}

function cycleEnd(bill) {
  if (!bill?.dueDate || !bill?.frequency) return "";
  if (String(bill.frequency).toLowerCase() === "one_time") return bill.dueDate;
  return nextDueFromFreq(bill.dueDate, bill.frequency);
}

function isPaidThisCycle(bill) {
  if (!bill?.lastPaidDate || bill.active === false) return false;
  const ps = isoSerial(bill.lastPaidDate);
  const ds = isoSerial(bill.dueDate);
  if (!Number.isFinite(ps) || !Number.isFinite(ds)) return false;
  if (String(bill.frequency || "").toLowerCase() === "one_time") return ps >= ds;

  const ss = isoSerial(cycleStart(bill));
  const es = isoSerial(cycleEnd(bill));
  if (!Number.isFinite(ss) || !Number.isFinite(es)) return false;
  return ps >= ss && ps < es;
}

function billStatus(bill) {
  if (!bill) return { label: "—", tone: "neutral", pct: 0, isPaid: false };
  if (bill.active === false) return { label: "Inactive", tone: "neutral", pct: 0, isPaid: false };
  if (isPaidThisCycle(bill)) return { label: "Paid", tone: "green", pct: 100, isPaid: true };
  return { ...dueMeta(daysUntil(bill.dueDate)), isPaid: false };
}

function dueText(days) {
  if (!Number.isFinite(days)) return "—";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  return `${days} days remaining`;
}

function moInterest(bal, apr) {
  return round2((safeNum(bal) * safeNum(apr)) / 1200);
}

function payoffMo(bal, apr, pay) {
  const b = safeNum(bal);
  const r = safeNum(apr) / 100 / 12;
  const p = safeNum(pay);
  if (b <= 0 || p <= 0) return 0;
  if (r <= 0) return Math.ceil(b / p);
  if (p <= b * r) return Infinity;
  const m = -Math.log(1 - (r * b) / p) / Math.log(1 + r);
  return Number.isFinite(m) ? Math.ceil(m) : Infinity;
}

function payoffLabel(bal, apr, pay) {
  const m = payoffMo(bal, apr, pay);
  if (m === Infinity) return "Payment too low";
  if (m <= 0) return "Paid off";
  if (m < 12) return `${m}mo`;
  return `${(m / 12).toFixed(m / 12 >= 2 ? 1 : 2)}yr`;
}

function shouldAdvance(bill, payDate, advance) {
  if (!advance) return false;
  if (String(bill?.frequency || "").toLowerCase() === "one_time") return false;
  const ds = isoSerial(bill?.dueDate);
  const ps = isoSerial(payDate);
  if (!Number.isFinite(ds)) return false;
  if (!Number.isFinite(ps)) return true;
  return ps >= ds || ds <= todaySerial();
}

function emptyForm(aid = "") {
  return {
    name: "",
    amount: "",
    dueDate: isoDate(),
    frequency: "monthly",
    category: "",
    notes: "",
    accountId: aid,
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
    newDebtAccountId: aid,
    newDebtAutopay: false,
  };
}

function editorState(bill, debt, aid = "") {
  if (!bill) return emptyForm(aid);
  return {
    name: bill.name || "",
    amount: String(bill.amount ?? ""),
    dueDate: bill.dueDate || isoDate(),
    frequency: bill.frequency || "monthly",
    category: bill.category || "",
    notes: bill.notes || "",
    accountId: bill.accountId || aid,
    autopay: bill.autopay === true,
    lastPaidDate: bill.lastPaidDate || "",
    isDebtBill: !!bill.linkedDebtId,
    debtMode: bill.linkedDebtId ? "link_existing" : "none",
    linkedDebtId: bill.linkedDebtId || "",
    newDebtName: debt?.name || bill.name || "",
    newDebtBalance: debt ? String(debt.balance ?? "") : "",
    newDebtAprPct: debt ? String(debt.aprPct ?? "") : "",
    newDebtMinPay: debt ? String(debt.minPay ?? "") : String(bill.amount ?? ""),
    newDebtExtraPay: debt ? String(debt.extraPay ?? "") : "",
    newDebtFrequency: debt?.frequency || bill.frequency || "monthly",
    newDebtDueDate: debt?.dueDate || bill.dueDate || isoDate(),
    newDebtCategory: debt?.category || bill.category || "",
    newDebtNotes: debt?.notes || bill.notes || "",
    newDebtAccountId: debt?.accountId || bill.accountId || aid,
    newDebtAutopay: debt ? debt.autopay === true : bill.autopay === true,
  };
}

function payDraft(bill, aid = "") {
  return {
    amount: bill ? String(bill.amount || "") : "",
    paymentDate: isoDate(),
    accountId: bill?.accountId || aid,
    note: "",
    advanceDue: true,
    saving: false,
  };
}

function mapBill(row) {
  return {
    id: row.id,
    name: row.name || "Bill",
    type: row.type === "controllable" ? "controllable" : "noncontrollable",
    frequency: row.frequency || "monthly",
    dueDate: row.due_date || "",
    amount: safeNum(row.amount),
    active: row.active !== false,
    balance: safeNum(row.balance),
    minPay: safeNum(row.min_pay),
    extraPay: safeNum(row.extra_pay),
    aprPct: safeNum(row.apr_pct),
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

function mapAcct(row) {
  return {
    id: row.id,
    name: row.name || "",
    type: row.account_type || "other",
    balance: safeNum(row.balance),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

function mapPayment(row) {
  return {
    id: row.id,
    billId: row.bill_id,
    linkedDebtId: row.linked_debt_id || "",
    amount: safeNum(row.amount),
    paymentDate: row.payment_date || "",
    accountId: row.payment_account_id || "",
    note: row.note || "",
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function spendingRow(id, userId, bill, amt, date, acctName, note = "") {
  return {
    id,
    user_id: userId,
    type: "expense",
    amount: round2(amt),
    category_id: null,
    tx_date: date,
    tx_time: null,
    merchant: bill.name || "Bill Payment",
    note: `[Bill Payment] ${bill.name || "Bill"}${note ? ` • ${note}` : ""}`,
    payment_method: "Bill Payment",
    account_name: acctName || "",
    created_at: ledgerTs(date),
    updated_at: new Date().toISOString(),
  };
}

function calendarMirrorRow(id, userId, profileId, bill, amt, date, note = "") {
  return {
    id,
    user_id: userId,
    profile_id: profileId || null,
    title: bill.name || "Bill Payment",
    event_date: date,
    event_time: null,
    end_time: null,
    category: bill.category || "Bill",
    flow: "expense",
    amount: round2(amt),
    note: note || "",
    status: "done",
    color: "#ef4444",
    source: "spending",
    source_id: id,
    source_table: "spending_transactions",
    auto_created: true,
    transaction_type: "expense",
    created_at: ledgerTs(date),
    updated_at: new Date().toISOString(),
  };
}

const FREQS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "one_time", label: "One Time" },
];

function toneClass(tone) {
  if (tone === "green") return "toneGreen";
  if (tone === "amber") return "toneAmber";
  if (tone === "red") return "toneRed";
  if (tone === "blue") return "toneBlue";
  return "toneNeutral";
}

/* ──────────────────────────────────────────────────────────────────────────
   Small UI
   ────────────────────────────────────────────────────────────────────────── */
function Pill({ children, tone = "neutral", dot = false }) {
  return (
    <span className={`billPill ${toneClass(tone)}`}>
      {dot ? <span className="billPillDot" /> : null}
      {children}
    </span>
  );
}

function Button({
  children,
  onClick,
  variant = "ghost",
  size = "sm",
  full = false,
  disabled = false,
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`billBtn billBtn_${variant} billBtn_${size} ${full ? "billBtn_full" : ""}`}
    >
      {children}
    </button>
  );
}

function IconButton({ children, onClick, title, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`billIconBtn ${danger ? "billIconBtn_danger" : ""}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="billField">
      <span className="billFieldLabel">{label}</span>
      {children}
    </label>
  );
}

function Grid({ cols = 2, children }) {
  return <div className={`billGrid billGrid_${cols}`}>{children}</div>;
}

function Progress({ pct, tone = "neutral", h = 5 }) {
  return (
    <div className="billProgress" style={{ height: h }}>
      <div
        className={`billProgressFill ${toneClass(tone)}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function MoreMenu({ bill, onEdit, onDuplicate, onToggle, onDelete, disabled = false }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fn = () => setOpen(false);
    window.addEventListener("click", fn);
    return () => window.removeEventListener("click", fn);
  }, [open]);

  const run = (fn) => {
    setOpen(false);
    fn?.();
  };

  return (
    <div className="billMore" onClick={(e) => e.stopPropagation()}>
      <IconButton onClick={() => setOpen((p) => !p)} title="More" disabled={disabled}>
        <MoreHorizontal size={14} />
      </IconButton>

      {open ? (
        <div className="billMenu">
          <button type="button" className="billMenuItem" onClick={() => run(onEdit)}>
            <PencilLine size={13} />
            Edit
          </button>
          <button type="button" className="billMenuItem" onClick={() => run(onDuplicate)}>
            <Copy size={13} />
            Duplicate
          </button>
          <button type="button" className="billMenuItem" onClick={() => run(onToggle)}>
            <ArrowUpRight size={13} />
            {bill?.active ? "Archive" : "Activate"}
          </button>

          <div className="billDivider" />

          <button
            type="button"
            className="billMenuItem billMenuItem_danger"
            onClick={() => run(onDelete)}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Drawer / Modal
   ────────────────────────────────────────────────────────────────────────── */
function Drawer({ open, title, sub, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const fn = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", fn);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", fn);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="billOverlay billOverlay_drawer">
      <button type="button" className="billOverlayBackdrop" onClick={onClose} />
      <div className="billDrawer">
        <div className="billDrawerHead">
          <div>
            <div className="billEyebrow">Bills</div>
            <div className="billDrawerTitle">{title}</div>
            {sub ? <div className="billDrawerSub">{sub}</div> : null}
          </div>
          <IconButton onClick={onClose} title="Close">
            <X size={14} />
          </IconButton>
        </div>

        <div className="billDrawerBody">{children}</div>

        {footer ? <div className="billDrawerFoot">{footer}</div> : null}
      </div>
    </div>
  );
}

function Modal({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const fn = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", fn);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", fn);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="billOverlay">
      <button type="button" className="billOverlayBackdrop" onClick={onClose} />
      <div className="billModal">
        <div className="billModalHead">
          <div className="billModalTitle">{title}</div>
          <IconButton onClick={onClose} title="Close">
            <X size={14} />
          </IconButton>
        </div>

        <div className="billModalBody">{children}</div>

        {footer ? <div className="billModalFoot">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Form Blocks
   ────────────────────────────────────────────────────────────────────────── */
function FormBlock({ title, children }) {
  return (
    <div className="billFormBlock">
      <div className="billFormBlockTitle">{title}</div>
      <div className="billFormBlockBody">{children}</div>
    </div>
  );
}

function DebtSection({ value, set, debtProfiles, accounts }) {
  const usable = accounts.filter((a) => !isInvestment(a.type));

  return (
    <FormBlock title="Debt Setup">
      <div className="billToggleRow">
        <Button
          variant={!value.isDebtBill ? "primary" : "ghost"}
          onClick={() =>
            set((p) => ({
              ...p,
              isDebtBill: false,
              debtMode: "none",
              linkedDebtId: "",
            }))
          }
        >
          Fixed bill
        </Button>

        <Button
          variant={value.isDebtBill ? "primary" : "ghost"}
          onClick={() =>
            set((p) => ({
              ...p,
              isDebtBill: true,
              debtMode:
                p.debtMode === "none"
                  ? debtProfiles.length
                    ? "link_existing"
                    : "create_new"
                  : p.debtMode,
            }))
          }
        >
          Debt payoff
        </Button>
      </div>

      {value.isDebtBill ? (
        <div className="billStack">
          <div className="billToggleRow">
            <Button
              variant={value.debtMode === "link_existing" ? "primary" : "ghost"}
              onClick={() => set((p) => ({ ...p, debtMode: "link_existing" }))}
            >
              Link existing
            </Button>

            <Button
              variant={value.debtMode === "create_new" ? "primary" : "ghost"}
              onClick={() =>
                set((p) => ({
                  ...p,
                  debtMode: "create_new",
                  linkedDebtId: "",
                }))
              }
            >
              Create new
            </Button>
          </div>

          {value.debtMode === "link_existing" ? (
            <Field label="Debt profile">
              <select
                value={value.linkedDebtId}
                onChange={(e) => set((p) => ({ ...p, linkedDebtId: e.target.value }))}
              >
                <option value="">Select debt</option>
                {debtProfiles.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {money(d.balance)} · {safeNum(d.aprPct)}% APR
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {value.debtMode === "create_new" ? (
            <>
              <Grid cols={4}>
                <Field label="Name">
                  <input
                    value={value.newDebtName}
                    onChange={(e) => set((p) => ({ ...p, newDebtName: e.target.value }))}
                    placeholder="Capital One"
                  />
                </Field>

                <Field label="Balance">
                  <input
                    value={value.newDebtBalance}
                    onChange={(e) => set((p) => ({ ...p, newDebtBalance: e.target.value }))}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </Field>

                <Field label="APR %">
                  <input
                    value={value.newDebtAprPct}
                    onChange={(e) => set((p) => ({ ...p, newDebtAprPct: e.target.value }))}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </Field>

                <Field label="Min pay">
                  <input
                    value={value.newDebtMinPay}
                    onChange={(e) => set((p) => ({ ...p, newDebtMinPay: e.target.value }))}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </Field>
              </Grid>

              <Grid cols={4}>
                <Field label="Extra pay">
                  <input
                    value={value.newDebtExtraPay}
                    onChange={(e) => set((p) => ({ ...p, newDebtExtraPay: e.target.value }))}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </Field>

                <Field label="Due date">
                  <input
                    type="date"
                    value={value.newDebtDueDate}
                    onChange={(e) => set((p) => ({ ...p, newDebtDueDate: e.target.value }))}
                  />
                </Field>

                <Field label="Frequency">
                  <select
                    value={value.newDebtFrequency}
                    onChange={(e) => set((p) => ({ ...p, newDebtFrequency: e.target.value }))}
                  >
                    {FREQS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Account">
                  <select
                    value={value.newDebtAccountId}
                    onChange={(e) => set((p) => ({ ...p, newDebtAccountId: e.target.value }))}
                  >
                    <option value="">None</option>
                    {usable.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </Grid>

              <Field label="Notes">
                <textarea
                  value={value.newDebtNotes}
                  onChange={(e) => set((p) => ({ ...p, newDebtNotes: e.target.value }))}
                  placeholder="Optional…"
                  rows={3}
                />
              </Field>
            </>
          ) : null}
        </div>
      ) : null}
    </FormBlock>
  );
}

function BillDrawer({
  open,
  mode,
  form,
  setForm,
  onClose,
  onSave,
  saving,
  accounts,
  debtProfiles,
}) {
  const payAccounts = accounts.filter((a) => !isInvestment(a.type));

  return (
    <Drawer
      open={open}
      title={mode === "add" ? "New Bill" : "Edit Bill"}
      sub={mode === "add" ? "Add a recurring or one-time bill." : "Update and save changes."}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            <Save size={13} />
            {saving ? "Saving…" : mode === "add" ? "Add Bill" : "Save Changes"}
          </Button>
        </>
      }
    >
      <FormBlock title="Bill Details">
        <Field label="Bill name">
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Rent, Netflix, Insurance…"
          />
        </Field>

        <Grid cols={3}>
          <Field label="Amount">
            <input
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              inputMode="decimal"
              placeholder="0.00"
            />
          </Field>

          <Field label="Due date">
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
            />
          </Field>

          <Field label="Frequency">
            <select
              value={form.frequency}
              onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}
            >
              {FREQS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </Grid>

        <Grid cols={2}>
          <Field label="Category">
            <input
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              placeholder="Housing, Utilities…"
            />
          </Field>

          <Field label="Account">
            <select
              value={form.accountId}
              onChange={(e) => setForm((p) => ({ ...p, accountId: e.target.value }))}
            >
              <option value="">No account</option>
              {payAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {money(a.balance)}
                </option>
              ))}
            </select>
          </Field>
        </Grid>

        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Optional notes…"
            rows={3}
          />
        </Field>

        <Field label="Autopay">
          <div className="billToggleRow">
            <Button
              variant={form.autopay ? "success" : "ghost"}
              onClick={() => setForm((p) => ({ ...p, autopay: true }))}
            >
              On
            </Button>
            <Button
              variant={!form.autopay ? "primary" : "ghost"}
              onClick={() => setForm((p) => ({ ...p, autopay: false }))}
            >
              Off
            </Button>
          </div>
        </Field>
      </FormBlock>

      <DebtSection value={form} set={setForm} debtProfiles={debtProfiles} accounts={payAccounts} />
    </Drawer>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Lists / history
   ────────────────────────────────────────────────────────────────────────── */
function BillRow({ bill, selected, onSelect }) {
  const s = billStatus(bill);

  return (
    <button type="button" onClick={onSelect} className={`billRow ${selected ? "billRow_active" : ""}`}>
      <div className={`billRowAccent ${toneClass(s.tone)}`} />
      <div className="billRowMain">
        <div className="billRowTop">
          <div className="billRowName">{bill.name}</div>
          <div className="billRowAmount">{money(bill.amount)}</div>
        </div>

        <div className="billRowMeta">
          <span className="billRowCategory">{bill.category || "Uncategorized"}</span>
          <span className="billRowDot">•</span>
          <span className={`billRowStatus ${toneClass(s.tone)}`}>{s.label}</span>
          {bill.autopay ? (
            <>
              <span className="billRowDot">•</span>
              <span className="billRowAuto">Auto</span>
            </>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function PaymentHistory({ payments, accountNameById, deletingId, onDelete }) {
  if (!payments.length) {
    return <div className="billEmptyHistory">No payment history yet.</div>;
  }

  return (
    <div className="billHistoryList">
      {payments.map((p) => (
        <div key={p.id} className="billHistoryCard">
          <div className="billHistoryLeft">
            <div className="billHistoryAmount">{moneyTight(p.amount)}</div>
            <div className="billHistoryMeta">
              {shortDate(p.paymentDate)}
              {p.accountId ? ` · ${accountNameById.get(p.accountId) || "Account"}` : ""}
            </div>
            {p.note ? <div className="billHistoryNote">{p.note}</div> : null}
          </div>

          <div className="billHistoryRight">
            <Pill tone="green" dot>
              Paid
            </Pill>
            <IconButton
              onClick={() => onDelete?.(p)}
              title="Delete"
              danger
              disabled={deletingId === p.id}
            >
              <Trash2 size={13} />
            </IconButton>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Main content pieces
   ────────────────────────────────────────────────────────────────────────── */
function SummaryStrip({ metrics, nextBill }) {
  return (
    <div className="billSummaryStrip">
      <div className="billSummaryLeft">
        <div className="billPageTitleWrap">
          <div className="billEyebrow">Payments</div>
          <div className="billPageTitle">Bills</div>
        </div>

        <div className="billSummaryMiniList">
          <div className="billMiniStat">
            <span className="billMiniLabel">Active</span>
            <span className="billMiniValue">{metrics.activeCount}</span>
          </div>
          <div className="billMiniStat">
            <span className="billMiniLabel">Monthly load</span>
            <span className="billMiniValue">{money(metrics.monthlyPressure)}</span>
          </div>
          <div className="billMiniStat">
            <span className="billMiniLabel">Paid this month</span>
            <span className="billMiniValue textPositive">{money(metrics.paidThisMonth)}</span>
          </div>
        </div>
      </div>

      <div className="billSummaryRight">
        <Pill tone={metrics.dueSoonCount > 0 ? "amber" : "green"} dot>
          {metrics.dueSoonCount} due soon
        </Pill>
        {nextBill ? (
          <div className="billNextDue">
            Next up <span>{nextBill.name}</span> · {shortDate(nextBill.dueDate)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Roster({
  bills,
  selectedId,
  onSelect,
  search,
  setSearch,
  scope,
  setScope,
  sortBy,
  setSortBy,
  onOpenAdd,
}) {
  return (
    <div className="billSidebarPane">
      <div className="billRosterHead">
        <div className="billSearch">
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bills…"
          />
          {search ? (
            <button type="button" onClick={() => setSearch("")} className="billSearchClear" aria-label="Clear search">
              <X size={12} />
            </button>
          ) : null}
        </div>

        <div className="billScopeTabs">
          {["active", "all", "inactive"].map((sc) => (
            <button
              key={sc}
              type="button"
              className={`billScopeTab ${scope === sc ? "billScopeTab_active" : ""}`}
              onClick={() => setScope(sc)}
            >
              {sc}
            </button>
          ))}
        </div>

        <div className="billRosterMeta">
          <span>{bills.length} showing</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="billRosterSort">
            <option value="due_asc">By due date</option>
            <option value="amount_desc">By amount</option>
            <option value="name_asc">By name</option>
            <option value="updated_desc">Recently updated</option>
          </select>
        </div>
      </div>

      <div className="billRosterList">
        {bills.length ? (
          bills.map((b) => (
            <BillRow key={b.id} bill={b} selected={b.id === selectedId} onSelect={() => onSelect(b.id)} />
          ))
        ) : (
          <div className="billEmptyState">
            <div className="billEmptyTitle">No bills found</div>
            <Button size="xs" variant="primary" onClick={onOpenAdd}>
              <Plus size={12} />
              Add one
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function FocusPanel({
  bill,
  debtProfiles,
  accounts,
  payAccts,
  payments,
  draft,
  setDraft,
  onPay,
  onDeletePayment,
  deletingId,
  onEdit,
  onDuplicate,
  onToggle,
  onDelete,
  onOpenHist,
  onCloseHist,
  histOpen,
  payBusy,
}) {
  if (!bill) {
    return (
      <div className="billFocusPane billFocusPane_empty">
        <div className="billSelectPrompt">
          <div className="billSelectPromptIcon">
            <Receipt size={20} />
          </div>
          <div className="billSelectPromptTitle">Select a bill</div>
          <div className="billSelectPromptText">
            Pick one from the left to view details and log payments.
          </div>
        </div>
      </div>
    );
  }

  const s = billStatus(bill);
  const linkedDebt = debtProfiles.find((d) => d.id === bill.linkedDebtId) || null;
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const monthlyImpact = moWeight(bill.amount, bill.frequency);
  const monthlyInterest = linkedDebt ? moInterest(linkedDebt.balance, linkedDebt.aprPct) : 0;
  const payoff = linkedDebt
    ? payoffLabel(
        linkedDebt.balance,
        linkedDebt.aprPct,
        safeNum(linkedDebt.minPay) + safeNum(linkedDebt.extraPay)
      )
    : "—";

  return (
    <div className="billFocusPane">
      <div className="billFocusHeader">
        <div className="billFocusHeaderLeft">
          <div className="billFocusTitleRow">
            <h2 className="billFocusTitle">{bill.name}</h2>
            <Pill tone={s.tone} dot>
              {s.label}
            </Pill>
            {bill.autopay ? (
              <Pill tone="green">
                <Zap size={10} />
                Auto
              </Pill>
            ) : null}
            {linkedDebt ? (
              <Pill tone="blue">
                <Link2 size={10} />
                Debt linked
              </Pill>
            ) : null}
          </div>

          <div className="billFocusMeta">
            <CalendarDays size={13} />
            {dueText(daysUntil(bill.dueDate))}
          </div>
        </div>

        <div className="billFocusActions">
          <Button size="xs" onClick={onOpenHist}>
            <Receipt size={12} />
            History
          </Button>

          <MoreMenu
            bill={bill}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        </div>
      </div>

      <div className="billActionGrid">
        <div className="billPanel">
          <div className="billPanelHead">
            <div className="billPanelTitle">
              <Wallet size={15} />
              Log Payment
            </div>
          </div>

          <Grid cols={3}>
            <Field label="Amount">
              <input
                value={draft.amount}
                onChange={(e) => setDraft((p) => ({ ...p, amount: e.target.value }))}
                inputMode="decimal"
                placeholder="0.00"
              />
            </Field>

            <Field label="Payment date">
              <input
                type="date"
                value={draft.paymentDate}
                onChange={(e) => setDraft((p) => ({ ...p, paymentDate: e.target.value }))}
              />
            </Field>

            <Field label="Pay from">
              <select
                value={draft.accountId}
                onChange={(e) => setDraft((p) => ({ ...p, accountId: e.target.value }))}
              >
                <option value="">No account</option>
                {payAccts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {money(a.balance)}
                  </option>
                ))}
              </select>
            </Field>
          </Grid>

          <Field label="Note">
            <input
              value={draft.note}
              onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))}
              placeholder="Optional note…"
            />
          </Field>

          <div className="billPayFoot">
            <label className="billAdvanceToggle">
              <input
                type="checkbox"
                checked={draft.advanceDue}
                onChange={(e) => setDraft((p) => ({ ...p, advanceDue: e.target.checked }))}
              />
              Advance next due date after payment
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button size="sm" onClick={onOpenHist}>
                View history
              </Button>
              <Button variant="primary" size="sm" onClick={onPay} disabled={payBusy}>
                <Save size={13} />
                {payBusy ? "Saving…" : "Mark Paid"}
              </Button>
            </div>
          </div>
        </div>

        <div className="billPanel billDebtPanel">
          <div className="billPanelHead">
            <div className="billPanelTitle">
              <TrendingDown size={15} />
              Linked Debt
            </div>
          </div>

          {linkedDebt ? (
            <div className="billDebtStack">
              <div className="billDebtStat">
                <span>Balance</span>
                <strong className="textNegative">{money(linkedDebt.balance)}</strong>
              </div>
              <div className="billDebtStat">
                <span>APR</span>
                <strong>{safeNum(linkedDebt.aprPct)}%</strong>
              </div>
              <div className="billDebtStat">
                <span>Interest / mo</span>
                <strong className="textWarning">{moneyTight(monthlyInterest)}</strong>
              </div>
              <div className="billDebtStat">
                <span>Payoff est.</span>
                <strong className="textPositive">{payoff}</strong>
              </div>

              <div className="billDebtPlan">
                <div className="billDebtPlanLabel">Plan</div>
                <div className="billDebtPlanValue">
                  {moneyTight(safeNum(linkedDebt.minPay) + safeNum(linkedDebt.extraPay))}/mo · {payoff}
                </div>
              </div>
            </div>
          ) : (
            <div className="billDebtEmpty">
              <div>No debt profile linked.</div>
              <div>Connect this bill if you want payoff tracking in the debt system.</div>
              <Button size="xs" variant="primary" onClick={onEdit}>
                <Link2 size={12} />
                Link debt
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="billDetailRow">
        <div className="billMetricCard">
          <div className="billMetricLabel">Linked Account</div>
          <div className="billMetricValue">{accountNameById.get(bill.accountId) || "None"}</div>
          <div className="billMetricSub">Pay-from account</div>
        </div>

        <div className="billMetricCard">
          <div className="billMetricLabel">Last Paid</div>
          <div className="billMetricValue">{shortDate(bill.lastPaidDate)}</div>
          <div className="billMetricSub">{payments.length} payments logged</div>
        </div>

        <div className="billMetricCard">
          <div className="billMetricLabel">Monthly Impact</div>
          <div className="billMetricValue">{money(monthlyImpact)}</div>
          <div className="billMetricSub">Normalized monthly view</div>
        </div>
      </div>

      <div className="billPanel">
        <div className="billPanelHead">
          <div className="billPanelTitle">Bill Details</div>
        </div>

        <div className="billDetailGrid">
          {[
            { label: "Category", value: bill.category || "—" },
            { label: "Frequency", value: FREQS.find((o) => o.value === bill.frequency)?.label || bill.frequency },
            { label: "Autopay", value: bill.autopay ? "Enabled" : "Disabled" },
            { label: "Cycle start", value: shortDate(cycleStart(bill)) },
            { label: "Cycle end", value: shortDate(cycleEnd(bill)) },
            { label: "Last updated", value: fmtAgo(bill.updatedAt) },
          ].map((d) => (
            <div key={d.label} className="billDetailCard">
              <div className="billDetailLabel">{d.label}</div>
              <div className="billDetailValue">{d.value}</div>
            </div>
          ))}

          {bill.notes ? (
            <div className="billDetailCard billDetailCard_notes">
              <div className="billDetailLabel">Notes</div>
              <div className="billDetailNotes">{bill.notes}</div>
            </div>
          ) : null}
        </div>
      </div>

      <Modal
        open={histOpen}
        title={`${bill.name} · History`}
        onClose={onCloseHist}
        footer={<Button onClick={onCloseHist}>Close</Button>}
      >
        <PaymentHistory
          payments={payments}
          accountNameById={accountNameById}
          deletingId={deletingId}
          onDelete={onDeletePayment}
        />
      </Modal>
    </div>
  );
}

function RightRail({ bill, linkedDebt, metrics, onOpenAdd, onOpenEdit }) {
  const s = bill ? billStatus(bill) : null;

  return (
    <div className="billRailPane">
      <div className="billRailSection">
        <div className="billRailLabel">Quick Actions</div>
        <div className="billRailActionStack">
          <Button variant="primary" size="sm" full onClick={onOpenAdd}>
            <Plus size={13} />
            New Bill
          </Button>
          <Button size="sm" full disabled={!bill} onClick={onOpenEdit}>
            <PencilLine size={13} />
            Edit Selected
          </Button>
        </div>
      </div>

      <div className="billRailSection">
        <div className="billRailLabel">Overview</div>

        <div className="billRailStatList">
          <div className="billRailStat">
            <span>Monthly load</span>
            <strong>{money(metrics.monthlyPressure)}</strong>
          </div>
          <div className="billRailStat">
            <span>Due ≤7 days</span>
            <strong className={metrics.dueSoonCount > 0 ? "textWarning" : "textPositive"}>
              {metrics.dueSoonCount}
            </strong>
          </div>
          <div className="billRailStat">
            <span>Paid this month</span>
            <strong className="textPositive">{money(metrics.paidThisMonth)}</strong>
          </div>
          <div className="billRailStat">
            <span>Debt-linked</span>
            <strong>{metrics.linkedDebtCount}</strong>
          </div>
        </div>
      </div>

      {bill && s ? (
        <div className="billRailSection billRailSection_fill">
          <div className="billRailLabel">Selected</div>

          <div className="billSelectedCard">
            <div className="billSelectedTop">
              <div className="billSelectedName">{bill.name}</div>
              <Pill tone={s.tone}>{s.label}</Pill>
            </div>

            <div className="billSelectedAmount">{money(bill.amount)}</div>
            <Progress pct={s.pct} tone={s.tone} h={4} />

            <div className="billSelectedMeta">
              {bill.category || "No category"} · {bill.autopay ? "Autopay" : "Manual"}
            </div>

            {linkedDebt ? (
              <div className="billSelectedDebt">
                <div className="billSelectedDebtLabel">Debt</div>
                <div className="billSelectedDebtName">{linkedDebt.name}</div>
                <div className="billSelectedDebtMeta">
                  {money(linkedDebt.balance)} ·{" "}
                  {payoffLabel(
                    linkedDebt.balance,
                    linkedDebt.aprPct,
                    safeNum(linkedDebt.minPay) + safeNum(linkedDebt.extraPay)
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Toast({ error, status, onClearError }) {
  if (!error && !status) return null;

  return (
    <div className="billToastStack">
      {status ? (
        <div className="billToast billToast_success">
          <CheckCircle2 size={14} />
          {status}
        </div>
      ) : null}

      {error ? (
        <div className="billToast billToast_error">
          <X size={14} />
          {error}
          <button type="button" onClick={onClearError} className="billToastClose" aria-label="Dismiss">
            <X size={12} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────────────── */
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

  const [editor, setEditor] = useState(emptyForm(""));
  const [addForm, setAddForm] = useState(emptyForm(""));
  const [drawerMode, setDrawerMode] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState("focus");
  const [paymentDraft, setPaymentDraft] = useState(() => payDraft(null, ""));

  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(""), 3200);
    return () => clearTimeout(id);
  }, [status]);

  const payAccts = useMemo(() => accounts.filter((a) => !isInvestment(a.type)), [accounts]);

  const refreshPage = useCallback(
    async (preferredId = "") => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setPageError("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          setUserId(null);
          setBills([]);
          setDebtProfiles([]);
          setAccounts([]);
          setPayments([]);
          setSelectedBillId("");
          setDefaultAccountId("");
          setLoading(false);
          return;
        }

        setUserId(user.id);

        const [billsRes, debtRes, accountsRes, settingsRes, paymentsRes] = await Promise.all([
          supabase
            .from("bills")
            .select("*")
            .eq("user_id", user.id)
            .eq("type", "noncontrollable")
            .order("due_date", { ascending: true }),
          supabase
            .from("bills")
            .select("*")
            .eq("user_id", user.id)
            .eq("type", "controllable")
            .order("name", { ascending: true }),
          supabase.from("accounts").select("*").eq("user_id", user.id).order("name", { ascending: true }),
          supabase.from("account_settings").select("primary_account_id").eq("user_id", user.id).maybeSingle(),
          supabase
            .from("bill_payments")
            .select("*")
            .eq("user_id", user.id)
            .order("payment_date", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);

        if (billsRes.error) throw billsRes.error;
        if (debtRes.error) throw debtRes.error;
        if (accountsRes.error) throw accountsRes.error;
        if (settingsRes.error) throw settingsRes.error;
        if (paymentsRes.error) throw paymentsRes.error;

        const nextBills = (billsRes.data || []).map(mapBill);
        const nextDebt = (debtRes.data || []).map(mapBill);
        const nextAccounts = (accountsRes.data || []).map(mapAcct);
        const nextPayments = (paymentsRes.data || []).map(mapPayment);
        const nextDefaultAccountId = settingsRes.data?.primary_account_id || "";

        setBills(nextBills);
        setDebtProfiles(nextDebt);
        setAccounts(nextAccounts);
        setPayments(nextPayments);
        setDefaultAccountId(nextDefaultAccountId);

        setSelectedBillId((prev) => {
          const nextId =
            preferredId && nextBills.some((b) => b.id === preferredId)
              ? preferredId
              : prev && nextBills.some((b) => b.id === prev)
              ? prev
              : nextBills[0]?.id || "";
          return nextId;
        });
      } catch (err) {
        setPageError(err?.message || "Failed to load bills.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    refreshPage();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshPage();
    });

    return () => {
      subscription?.unsubscribe?.();
    };
  }, [refreshPage]);

  const visibleBills = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = bills.filter((b) => {
      if (scope === "active" && !b.active) return false;
      if (scope === "inactive" && b.active) return false;
      if (!q) return true;
      return [b.name, b.category, b.notes].join(" ").toLowerCase().includes(q);
    });

    if (sortBy === "amount_desc") {
      return [...filtered].sort((a, b) => safeNum(b.amount) - safeNum(a.amount));
    }

    if (sortBy === "name_asc") {
      return [...filtered].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }

    if (sortBy === "updated_desc") {
      return [...filtered].sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
    }

    return [...filtered].sort((a, b) => compareIsoDates(a.dueDate, b.dueDate));
  }, [bills, search, scope, sortBy]);

  useEffect(() => {
    if (!visibleBills.length) {
      setSelectedBillId("");
      return;
    }
    if (!visibleBills.some((b) => b.id === selectedBillId)) {
      setSelectedBillId(visibleBills[0].id);
    }
  }, [visibleBills, selectedBillId]);

  const selectedBill = bills.find((b) => b.id === selectedBillId) || visibleBills[0] || null;
  const selectedLinkedDebt = selectedBill
    ? debtProfiles.find((d) => d.id === selectedBill.linkedDebtId) || null
    : null;

  useEffect(() => {
    if (!selectedBill) {
      setEditor(emptyForm(defaultAccountId));
      setPaymentDraft(payDraft(null, defaultAccountId));
      return;
    }

    setEditor(editorState(selectedBill, selectedLinkedDebt, defaultAccountId));
    setPaymentDraft(payDraft(selectedBill, selectedBill.accountId || defaultAccountId || ""));
  }, [selectedBill?.id, selectedLinkedDebt?.id, defaultAccountId]);

  useEffect(() => {
    if (selectedBillId) setMobileSection("focus");
  }, [selectedBillId]);

  useEffect(() => {
    setHistoryOpen(false);
  }, [selectedBillId]);

  const selectedPayments = useMemo(() => {
    if (!selectedBill) return [];
    return payments
      .filter((p) => p.billId === selectedBill.id)
      .sort(
        (a, b) =>
          compareIsoDates(b.paymentDate, a.paymentDate) ||
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
  }, [payments, selectedBill]);

  const metrics = useMemo(() => {
    const active = bills.filter((b) => b.active);
    const mk = monthKeyOf(isoDate());
    const dueSoonCount = active.filter((b) => {
      const d = daysUntil(b.dueDate);
      return Number.isFinite(d) && d >= 0 && d <= 7 && !isPaidThisCycle(b);
    }).length;

    const nextBill =
      [...active]
        .filter((b) => !isPaidThisCycle(b))
        .sort((a, b) => {
          const ad = Number.isFinite(daysUntil(a.dueDate)) ? daysUntil(a.dueDate) : 999999;
          const bd = Number.isFinite(daysUntil(b.dueDate)) ? daysUntil(b.dueDate) : 999999;
          return ad - bd;
        })[0] || null;

    return {
      activeCount: active.length,
      linkedDebtCount: active.filter((b) => !!b.linkedDebtId).length,
      monthlyPressure: round2(active.reduce((sum, b) => sum + moWeight(b.amount, b.frequency), 0)),
      paidThisMonth: round2(
        payments
          .filter((p) => monthKeyOf(p.paymentDate) === mk)
          .reduce((sum, p) => sum + safeNum(p.amount), 0)
      ),
      dueSoonCount,
      nextBill,
    };
  }, [bills, payments]);

  async function getCalProfileId() {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("calendar_profiles")
      .select("id,is_default,created_at")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) throw error;
    return data?.[0]?.id ?? null;
  }

  async function upsertCalendarMirror(paymentId, bill, amount, paymentDate, paymentNote) {
    if (!userId) return;

    const profileId = await getCalProfileId();
    const payload = calendarMirrorRow(
      paymentId,
      userId,
      profileId,
      bill,
      amount,
      paymentDate,
      paymentNote
    );

    const { data: existing, error: findError } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "spending")
      .eq("source_id", paymentId)
      .maybeSingle();

    if (findError) throw findError;

    if (existing?.id) {
      const { error } = await supabase
        .from("calendar_events")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", userId);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("calendar_events").insert([payload]);
    if (error) throw error;
  }

  async function deleteCalendarMirror(paymentId) {
    if (!userId) return;
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("user_id", userId)
      .eq("source", "spending")
      .eq("source_id", paymentId);
    if (error) throw error;
  }

  function openAdd() {
    setHistoryOpen(false);
    setAddForm(emptyForm(defaultAccountId));
    setDrawerMode("add");
  }

  function openEdit() {
    if (!selectedBill) return;
    setHistoryOpen(false);
    setEditor(editorState(selectedBill, selectedLinkedDebt, defaultAccountId));
    setDrawerMode("edit");
  }

  async function createLinkedDebtIfNeeded(form) {
    if (!form.isDebtBill) return { debtId: null, createdDebt: null };
    if (form.debtMode === "link_existing") {
      return { debtId: form.linkedDebtId || null, createdDebt: null };
    }

    const name = String(form.newDebtName || "").trim();
    const balance = parseMoneyInput(form.newDebtBalance);
    const aprPct = parseMoneyInput(form.newDebtAprPct || "0");
    const minPay = parseMoneyInput(form.newDebtMinPay || "0");
    const extraPay = parseMoneyInput(form.newDebtExtraPay || "0");

    if (!name) throw new Error("Debt name required.");
    if (!Number.isFinite(balance) || balance < 0) {
      throw new Error("Debt balance must be 0 or greater.");
    }
    if (!Number.isFinite(minPay) || minPay < 0) {
      throw new Error("Minimum payment must be 0 or greater.");
    }
    if (!Number.isFinite(extraPay) || extraPay < 0) {
      throw new Error("Extra payment must be 0 or greater.");
    }

    const debtId = uid();

    const insertRes = await supabase.from("bills").insert({
      id: debtId,
      user_id: userId,
      name,
      type: "controllable",
      frequency: form.newDebtFrequency || "monthly",
      due_date: form.newDebtDueDate || null,
      amount: round2(Number.isFinite(minPay) ? minPay : 0),
      active: true,
      notes: form.newDebtNotes || "",
      balance: round2(balance),
      apr_pct: round2(Number.isFinite(aprPct) ? aprPct : 0),
      min_pay: round2(minPay),
      extra_pay: round2(extraPay),
      autopay: form.newDebtAutopay === true,
      category: form.newDebtCategory || "",
      account_id: form.newDebtAccountId || null,
      linked_debt_id: null,
      last_paid_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertRes.error) throw insertRes.error;
    return { debtId, createdDebt: debtId };
  }

  async function addBill() {
    if (!supabase || !userId || addingBusy) return;

    const name = String(addForm.name || "").trim();
    const amount = parseMoneyInput(addForm.amount || "0");

    if (!name) return setPageError("Bill name required.");
    if (!Number.isFinite(amount) || amount < 0) {
      return setPageError("Amount must be 0 or greater.");
    }
    if (addForm.isDebtBill && addForm.debtMode === "link_existing" && !addForm.linkedDebtId) {
      return setPageError("Select a debt profile or create a new one.");
    }

    setAddingBusy(true);
    setPageError("");

    let createdDebtId = null;

    try {
      const debtInfo = await createLinkedDebtIfNeeded(addForm);
      createdDebtId = debtInfo.createdDebt;

      const billId = uid();
      const res = await supabase.from("bills").insert({
        id: billId,
        user_id: userId,
        name,
        type: "noncontrollable",
        frequency: addForm.frequency || "monthly",
        due_date: addForm.dueDate || null,
        amount: round2(amount),
        active: true,
        notes: addForm.notes || "",
        balance: round2(amount),
        apr_pct: 0,
        min_pay: 0,
        extra_pay: 0,
        autopay: addForm.autopay === true,
        category: addForm.category || "",
        account_id: addForm.accountId || null,
        linked_debt_id: debtInfo.debtId || null,
        last_paid_date: addForm.lastPaidDate || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (res.error) throw res.error;

      setDrawerMode(null);
      setAddForm(emptyForm(defaultAccountId));
      setStatus("Bill added.");
      await refreshPage(billId);
    } catch (err) {
      if (createdDebtId) {
        await supabase.from("bills").delete().eq("id", createdDebtId).eq("user_id", userId);
      }
      setPageError(err?.message || "Could not add bill.");
    } finally {
      setAddingBusy(false);
    }
  }

  async function saveBill() {
    if (!supabase || !userId || !selectedBill || savingSelected) return;

    const name = String(editor.name || "").trim();
    const amount = parseMoneyInput(editor.amount || "0");

    if (!name) return setPageError("Bill name required.");
    if (!Number.isFinite(amount) || amount < 0) {
      return setPageError("Amount must be 0 or greater.");
    }
    if (editor.isDebtBill && editor.debtMode === "link_existing" && !editor.linkedDebtId) {
      return setPageError("Select a debt profile or create a new one.");
    }

    setSavingSelected(true);
    setPageError("");

    let createdDebtId = null;

    try {
      let nextLinkedDebtId = null;

      if (editor.isDebtBill) {
        if (editor.debtMode === "link_existing") {
          nextLinkedDebtId = editor.linkedDebtId || null;
        } else {
          const debtInfo = await createLinkedDebtIfNeeded(editor);
          nextLinkedDebtId = debtInfo.debtId;
          createdDebtId = debtInfo.createdDebt;
        }
      }

      const res = await supabase
        .from("bills")
        .update({
          name,
          frequency: editor.frequency || "monthly",
          due_date: editor.dueDate || null,
          amount: round2(amount),
          notes: editor.notes || "",
          category: editor.category || "",
          account_id: editor.accountId || null,
          autopay: editor.autopay === true,
          linked_debt_id: nextLinkedDebtId,
          last_paid_date: editor.lastPaidDate || null,
          balance: round2(
            selectedBill.linkedDebtId
              ? safeNum(selectedBill.balance)
              : Math.max(0, Math.min(safeNum(selectedBill.balance, selectedBill.amount), round2(amount)))
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedBill.id)
        .eq("user_id", userId);

      if (res.error) throw res.error;

      setDrawerMode(null);
      setStatus("Bill saved.");
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

  async function dupBill(bill) {
    if (!supabase || !userId || !bill) return;

    try {
      const cloneId = uid();
      const { error } = await supabase.from("bills").insert({
        id: cloneId,
        user_id: userId,
        name: `${bill.name} Copy`,
        type: "noncontrollable",
        frequency: bill.frequency || "monthly",
        due_date: bill.dueDate || null,
        amount: round2(bill.amount),
        active: bill.active !== false,
        notes: bill.notes || "",
        balance: round2(bill.amount),
        apr_pct: 0,
        min_pay: 0,
        extra_pay: 0,
        autopay: bill.autopay === true,
        category: bill.category || "",
        account_id: bill.accountId || null,
        linked_debt_id: null,
        last_paid_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      setStatus("Bill duplicated.");
      await refreshPage(cloneId);
    } catch (err) {
      setPageError(err?.message || "Could not duplicate bill.");
    }
  }

  async function toggleActive(bill) {
    if (!supabase || !userId || !bill || savingSelected) return;

    try {
      const { error } = await supabase
        .from("bills")
        .update({
          active: !bill.active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bill.id)
        .eq("user_id", userId);

      if (error) throw error;
      setStatus(bill.active ? "Bill archived." : "Bill activated.");
      await refreshPage(bill.id);
    } catch (err) {
      setPageError(err?.message || "Could not update bill.");
    }
  }

  async function delBill() {
    if (!supabase || !userId || !selectedBill || savingSelected) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete ${selectedBill.name}?`)) return;

    setSavingSelected(true);
    setPageError("");

    try {
      const relatedPayments = payments.filter((p) => p.billId === selectedBill.id);

      for (const payment of relatedPayments) {
        await supabase
          .from("spending_transactions")
          .delete()
          .eq("id", payment.id)
          .eq("user_id", userId);

        await deleteCalendarMirror(payment.id).catch(() => {});
      }

      const { error: paymentsError } = await supabase
        .from("bill_payments")
        .delete()
        .eq("user_id", userId)
        .eq("bill_id", selectedBill.id);

      if (paymentsError) throw paymentsError;

      const { error: billError } = await supabase
        .from("bills")
        .delete()
        .eq("user_id", userId)
        .eq("id", selectedBill.id)
        .eq("type", "noncontrollable");

      if (billError) throw billError;

      setDrawerMode(null);
      setHistoryOpen(false);
      setStatus("Bill deleted.");
      await refreshPage();
    } catch (err) {
      setPageError(err?.message || "Could not delete bill.");
      await refreshPage(selectedBill.id);
    } finally {
      setSavingSelected(false);
    }
  }

  async function makePay() {
    if (!supabase || !userId || !selectedBill || paymentDraft.saving) return;

    const amount = parseMoneyInput(paymentDraft.amount);
    const paymentDate = paymentDraft.paymentDate || isoDate();
    const paymentAccountId = paymentDraft.accountId || "";
    const paymentNote = String(paymentDraft.note || "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return setPageError("Payment amount must be greater than 0.");
    }

    const pid = uid();
    const linkedDebtNow =
      debtProfiles.find((d) => d.id === (selectedBill.linkedDebtId || "")) || null;

    const nextLastPaid = paymentDate || selectedBill.lastPaidDate || null;
    const nextDue = shouldAdvance(selectedBill, paymentDate, paymentDraft.advanceDue)
      ? nextDueFromFreq(paymentDate || selectedBill.dueDate || isoDate(), selectedBill.frequency)
      : selectedBill.dueDate || "";

    const currentBillBalance = safeNum(selectedBill.balance, selectedBill.amount);
    const nextBalance = round2(
      selectedBill.linkedDebtId
        ? Math.max(0, currentBillBalance - amount)
        : Math.max(0, Math.min(safeNum(selectedBill.amount), currentBillBalance - amount))
    );

    const nextDebtBalance = linkedDebtNow
      ? round2(Math.max(0, safeNum(linkedDebtNow.balance) - amount))
      : 0;

    const nextDebtLastPaid = linkedDebtNow ? paymentDate : null;
    const nextDebtDue = linkedDebtNow
      ? shouldAdvance(linkedDebtNow, paymentDate, paymentDraft.advanceDue)
        ? nextDueFromFreq(paymentDate || linkedDebtNow.dueDate || isoDate(), linkedDebtNow.frequency)
        : linkedDebtNow.dueDate || ""
      : "";

    setPaymentDraft((p) => ({ ...p, saving: true }));
    setPageError("");

    let ledgerPosted = false;
    let spendingInserted = false;
    let calendarInserted = false;
    let billUpdated = false;
    let debtUpdated = false;

    try {
      const paymentInsert = await supabase.from("bill_payments").insert({
        id: pid,
        user_id: userId,
        bill_id: selectedBill.id,
        linked_debt_id: selectedBill.linkedDebtId || null,
        amount: round2(amount),
        payment_date: paymentDate,
        payment_account_id: paymentAccountId || null,
        note: paymentNote || null,
      });

      if (paymentInsert.error) throw paymentInsert.error;

      if (paymentAccountId) {
        await writeAccountDelta({
          userId,
          accountId: paymentAccountId,
          delta: -round2(amount),
          kind: "bill_payment",
          amount: round2(amount),
          note: `${selectedBill.name || "Bill"}${paymentNote ? ` • ${paymentNote}` : ""}`,
          sourceType: "bill_payment",
          sourceId: pid,
          createdAt: ledgerTs(paymentDate),
        });
        ledgerPosted = true;
      }

      const billRes = await supabase
        .from("bills")
        .update({
          last_paid_date: nextLastPaid || null,
          due_date: nextDue || null,
          balance: nextBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedBill.id)
        .eq("user_id", userId);

      if (billRes.error) throw billRes.error;
      billUpdated = true;

      if (linkedDebtNow) {
        const debtRes = await supabase
          .from("bills")
          .update({
            balance: nextDebtBalance,
            last_paid_date: nextDebtLastPaid || null,
            due_date: nextDebtDue || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkedDebtNow.id)
          .eq("user_id", userId);

        if (debtRes.error) throw debtRes.error;
        debtUpdated = true;
      }

      const payAccount = accounts.find((a) => a.id === paymentAccountId) || null;
      const spendRow = spendingRow(
        pid,
        userId,
        selectedBill,
        amount,
        paymentDate,
        payAccount?.name || "",
        paymentNote
      );

      const spendRes = await supabase.from("spending_transactions").insert([spendRow]);
      if (spendRes.error) throw spendRes.error;
      spendingInserted = true;

      try {
        await upsertCalendarMirror(pid, selectedBill, amount, paymentDate, paymentNote);
        calendarInserted = true;
      } catch (e) {
        console.error("Calendar mirror failed", e);
      }

      setPaymentDraft(payDraft(null, selectedBill.accountId || defaultAccountId || ""));
      setStatus(linkedDebtNow ? "Paid · debt synced." : "Payment logged.");
      await refreshPage(selectedBill.id);
    } catch (err) {
      if (calendarInserted) await deleteCalendarMirror(pid).catch(() => {});
      if (spendingInserted) {
        await supabase.from("spending_transactions").delete().eq("id", pid).eq("user_id", userId);
      }

      if (linkedDebtNow && debtUpdated) {
        await supabase
          .from("bills")
          .update({
            balance: linkedDebtNow.balance,
            last_paid_date: linkedDebtNow.lastPaidDate || null,
            due_date: linkedDebtNow.dueDate || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkedDebtNow.id)
          .eq("user_id", userId);
      }

      if (billUpdated) {
        await supabase
          .from("bills")
          .update({
            last_paid_date: selectedBill.lastPaidDate || null,
            due_date: selectedBill.dueDate || null,
            balance: selectedBill.balance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedBill.id)
          .eq("user_id", userId);
      }

      if (ledgerPosted && paymentAccountId) {
        try {
          await writeAccountDelta({
            userId,
            accountId: paymentAccountId,
            delta: round2(amount),
            kind: "bill_payment_rollback",
            amount: round2(amount),
            note: `${selectedBill.name || "Bill"} rollback`,
            sourceType: "bill_payment_rollback",
            sourceId: pid,
            createdAt: new Date().toISOString(),
          });
        } catch {}
      }

      await supabase.from("bill_payments").delete().eq("id", pid).eq("user_id", userId);
      setPageError(err?.message || "Could not save payment.");
      setPaymentDraft((p) => ({ ...p, saving: false }));
      await refreshPage(selectedBill.id);
    }
  }

  async function deletePayment(payment) {
    if (!supabase || !userId || !payment || deletingPaymentId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this payment?")) return;

    setDeletingPaymentId(payment.id);
    setPageError("");

    const currentBill = bills.find((b) => b.id === payment.billId) || null;
    const linkedDebtNow =
      debtProfiles.find((d) => d.id === (payment.linkedDebtId || currentBill?.linkedDebtId || "")) ||
      null;

    const remainingBillPayments = payments
      .filter((r) => r.billId === payment.billId && r.id !== payment.id)
      .sort(
        (a, b) =>
          compareIsoDates(b.paymentDate, a.paymentDate) ||
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

    const remainingDebtPayments = linkedDebtNow
      ? payments
          .filter(
            (r) =>
              r.id !== payment.id &&
              (r.linkedDebtId === linkedDebtNow.id || r.billId === linkedDebtNow.id)
          )
          .sort(
            (a, b) =>
              compareIsoDates(b.paymentDate, a.paymentDate) ||
              new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
          )
      : [];

    let ledgerRollbackPosted = false;
    let billUpdated = false;
    let debtUpdated = false;

    try {
      if (payment.accountId) {
        await writeAccountDelta({
          userId,
          accountId: payment.accountId,
          delta: round2(payment.amount),
          kind: "bill_payment_delete",
          amount: round2(payment.amount),
          note: `${currentBill?.name || "Bill"} payment deleted`,
          sourceType: "bill_payment_delete",
          sourceId: payment.id,
          createdAt: new Date().toISOString(),
        });
        ledgerRollbackPosted = true;
      }

      if (currentBill) {
        const latestRemaining = remainingBillPayments[0] || null;
        const wasLatest = currentBill.lastPaidDate === payment.paymentDate;
        const restoredBalance = round2(
          Math.min(
            safeNum(currentBill.amount),
            Math.max(0, safeNum(currentBill.balance, currentBill.amount) + safeNum(payment.amount))
          )
        );

        let nextDue = currentBill.dueDate || "";
        if (latestRemaining?.paymentDate) {
          nextDue =
            String(currentBill.frequency || "").toLowerCase() === "one_time"
              ? currentBill.dueDate || ""
              : nextDueFromFreq(latestRemaining.paymentDate, currentBill.frequency);
        } else if (
          wasLatest &&
          String(currentBill.frequency || "").toLowerCase() !== "one_time" &&
          currentBill.dueDate
        ) {
          nextDue = prevDueFromFreq(currentBill.dueDate, currentBill.frequency);
        }

        const billRes = await supabase
          .from("bills")
          .update({
            balance: restoredBalance,
            last_paid_date: latestRemaining?.paymentDate || null,
            due_date: nextDue || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentBill.id)
          .eq("user_id", userId);

        if (billRes.error) throw billRes.error;
        billUpdated = true;
      }

      if (linkedDebtNow) {
        const latestRemainingDebt = remainingDebtPayments[0] || null;
        const wasLatestDebt = linkedDebtNow.lastPaidDate === payment.paymentDate;

        let nextDebtDue = linkedDebtNow.dueDate || "";
        if (latestRemainingDebt?.paymentDate) {
          nextDebtDue =
            String(linkedDebtNow.frequency || "").toLowerCase() === "one_time"
              ? linkedDebtNow.dueDate || ""
              : nextDueFromFreq(latestRemainingDebt.paymentDate, linkedDebtNow.frequency);
        } else if (
          wasLatestDebt &&
          String(linkedDebtNow.frequency || "").toLowerCase() !== "one_time" &&
          linkedDebtNow.dueDate
        ) {
          nextDebtDue = prevDueFromFreq(linkedDebtNow.dueDate, linkedDebtNow.frequency);
        }

        const debtRes = await supabase
          .from("bills")
          .update({
            balance: round2(Math.max(0, safeNum(linkedDebtNow.balance) + safeNum(payment.amount))),
            last_paid_date: latestRemainingDebt?.paymentDate || null,
            due_date: nextDebtDue || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkedDebtNow.id)
          .eq("user_id", userId);

        if (debtRes.error) throw debtRes.error;
        debtUpdated = true;
      }

      const spendDelete = await supabase
        .from("spending_transactions")
        .delete()
        .eq("id", payment.id)
        .eq("user_id", userId);

      if (spendDelete.error) throw spendDelete.error;

      await deleteCalendarMirror(payment.id).catch(() => {});

      const paymentDelete = await supabase
        .from("bill_payments")
        .delete()
        .eq("id", payment.id)
        .eq("user_id", userId);

      if (paymentDelete.error) throw paymentDelete.error;

      setStatus(linkedDebtNow ? "Payment deleted · debt resynced." : "Payment deleted.");
      await refreshPage(currentBill?.id || selectedBillId);
    } catch (err) {
      if (currentBill && billUpdated) {
        await supabase
          .from("bills")
          .update({
            last_paid_date: currentBill.lastPaidDate || null,
            due_date: currentBill.dueDate || null,
            balance: currentBill.balance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentBill.id)
          .eq("user_id", userId);
      }

      if (linkedDebtNow && debtUpdated) {
        await supabase
          .from("bills")
          .update({
            last_paid_date: linkedDebtNow.lastPaidDate || null,
            due_date: linkedDebtNow.dueDate || null,
            balance: linkedDebtNow.balance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkedDebtNow.id)
          .eq("user_id", userId);
      }

      if (payment.accountId && ledgerRollbackPosted) {
        try {
          await writeAccountDelta({
            userId,
            accountId: payment.accountId,
            delta: -round2(payment.amount),
            kind: "bill_payment_delete_rollback",
            amount: round2(payment.amount),
            note: `${currentBill?.name || "Bill"} delete rollback`,
            sourceType: "bill_payment_delete_rollback",
            sourceId: payment.id,
            createdAt: new Date().toISOString(),
          });
        } catch {}
      }

      setPageError(err?.message || "Could not delete.");
      await refreshPage(currentBill?.id || selectedBillId);
    } finally {
      setDeletingPaymentId("");
    }
  }

  if (loading) {
    return <div className="billGate">Loading bills…</div>;
  }

  if (!userId) {
    return <div className="billGate">Sign in to view your bills.</div>;
  }

  return (
    <>
      <div className="billsRoot">
        <SummaryStrip metrics={metrics} nextBill={metrics.nextBill} />

        <div className="billMobileTabs">
          {[
            { v: "list", l: "Bills" },
            { v: "focus", l: "Detail" },
            { v: "tools", l: "Tools" },
          ].map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => setMobileSection(s.v)}
              className={`billMobileTab ${mobileSection === s.v ? "billMobileTab_active" : ""}`}
            >
              {s.l}
            </button>
          ))}
        </div>

        <div className="billWorkspace">
          <section className={`billCol billCol_roster ${mobileSection === "list" ? "billCol_show" : ""}`}>
            <Roster
              bills={visibleBills}
              selectedId={selectedBill?.id || ""}
              onSelect={(id) => {
                setSelectedBillId(id);
                setMobileSection("focus");
              }}
              search={search}
              setSearch={setSearch}
              scope={scope}
              setScope={setScope}
              sortBy={sortBy}
              setSortBy={setSortBy}
              onOpenAdd={openAdd}
            />
          </section>

          <section className={`billCol billCol_focus ${mobileSection === "focus" ? "billCol_show" : ""}`}>
            <FocusPanel
              bill={selectedBill}
              debtProfiles={debtProfiles}
              accounts={accounts}
              payAccts={payAccts}
              payments={selectedPayments}
              draft={paymentDraft}
              setDraft={setPaymentDraft}
              onPay={makePay}
              onDeletePayment={deletePayment}
              deletingId={deletingPaymentId}
              onEdit={openEdit}
              onDuplicate={() => selectedBill && dupBill(selectedBill)}
              onToggle={() => selectedBill && toggleActive(selectedBill)}
              onDelete={delBill}
              onOpenHist={() => setHistoryOpen(true)}
              onCloseHist={() => setHistoryOpen(false)}
              histOpen={historyOpen}
              payBusy={paymentDraft.saving}
            />
          </section>

          <section className={`billCol billCol_rail ${mobileSection === "tools" ? "billCol_show" : ""}`}>
            <RightRail
              bill={selectedBill}
              linkedDebt={selectedLinkedDebt}
              metrics={metrics}
              onOpenAdd={openAdd}
              onOpenEdit={openEdit}
            />
          </section>
        </div>
      </div>

      <BillDrawer
        open={drawerMode === "edit"}
        mode="edit"
        form={editor}
        setForm={setEditor}
        onClose={() => setDrawerMode(null)}
        onSave={saveBill}
        saving={savingSelected}
        accounts={accounts}
        debtProfiles={debtProfiles}
      />

      <BillDrawer
        open={drawerMode === "add"}
        mode="add"
        form={addForm}
        setForm={setAddForm}
        onClose={() => setDrawerMode(null)}
        onSave={addBill}
        saving={addingBusy}
        accounts={accounts}
        debtProfiles={debtProfiles}
      />

      <Toast error={pageError} status={status} onClearError={() => setPageError("")} />

      <style jsx global>{`
        .billsRoot {
          min-height: calc(100svh - 24px);
          display: grid;
          grid-template-rows: auto auto 1fr;
          gap: 12px;
          color: var(--lcc-text);
        }

        .billGate {
          min-height: 60svh;
          display: grid;
          place-items: center;
          color: var(--lcc-text-muted);
        }

        .billSummaryStrip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          min-height: 82px;
          padding: 16px 18px;
          border-radius: var(--lcc-radius-lg);
          border: 1px solid var(--lcc-border);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02)),
            rgba(9, 12, 20, 0.82);
          box-shadow: var(--lcc-shadow-md);
        }

        .billSummaryLeft,
        .billSummaryRight {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .billPageTitleWrap {
          display: grid;
          gap: 4px;
        }

        .billEyebrow {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--lcc-text-soft);
        }

        .billPageTitle,
        .billDrawerTitle {
          font-size: clamp(24px, 2vw, 30px);
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .billSummaryMiniList {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .billMiniStat {
          min-width: 118px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
          display: grid;
          gap: 4px;
        }

        .billMiniLabel {
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--lcc-text-soft);
          font-weight: 800;
        }

        .billMiniValue {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .billNextDue {
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .billNextDue span {
          color: var(--lcc-text);
          font-weight: 700;
        }

        .billPill {
          min-height: 26px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }

        .billPillDot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: currentColor;
          box-shadow: 0 0 10px currentColor;
        }

        .toneGreen {
          color: var(--lcc-green);
        }

        .toneAmber {
          color: var(--lcc-amber);
        }

        .toneRed {
          color: var(--lcc-red);
        }

        .toneBlue {
          color: var(--lcc-blue);
        }

        .toneNeutral {
          color: var(--lcc-text-muted);
        }

        .textPositive {
          color: var(--lcc-green);
        }

        .textWarning {
          color: var(--lcc-amber);
        }

        .textNegative {
          color: var(--lcc-red);
        }

        .billBtn,
        .billScopeTab,
        .billMobileTab,
        .billMenuItem,
        .billSearchClear,
        .billRosterSort,
        .billField input,
        .billField select,
        .billField textarea {
          font: inherit;
        }

        .billBtn {
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 13px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
          color: var(--lcc-text);
          cursor: pointer;
          transition: 180ms ease;
        }

        .billBtn:hover {
          background: rgba(255,255,255,0.06);
        }

        .billBtn:disabled {
          opacity: 0.52;
          cursor: not-allowed;
        }

        .billBtn_primary {
          border-color: rgba(102, 159, 255, 0.34);
          background: linear-gradient(180deg, rgba(63,127,255,0.24), rgba(63,127,255,0.09));
        }

        .billBtn_success {
          border-color: rgba(74, 222, 128, 0.28);
          background: linear-gradient(180deg, rgba(74,222,128,0.22), rgba(74,222,128,0.07));
        }

        .billBtn_xs {
          min-height: 30px;
          padding: 0 10px;
          font-size: 12px;
        }

        .billBtn_sm {
          min-height: 36px;
          padding: 0 13px;
          font-size: 13px;
        }

        .billBtn_full {
          width: 100%;
        }

        .billIconBtn {
          width: 34px;
          height: 34px;
          display: inline-grid;
          place-items: center;
          border-radius: 10px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
          color: var(--lcc-text);
          cursor: pointer;
        }

        .billIconBtn_danger {
          color: var(--lcc-red);
          border-color: rgba(239, 68, 68, 0.18);
          background: rgba(239, 68, 68, 0.08);
        }

        .billWorkspace {
          display: grid;
          grid-template-columns: 0.96fr 1.4fr 0.84fr;
          gap: 12px;
          min-height: 0;
        }

        .billCol {
          min-width: 0;
          min-height: 0;
        }

        .billSidebarPane,
        .billFocusPane,
        .billRailPane {
          height: 100%;
          border-radius: var(--lcc-radius-lg);
          border: 1px solid var(--lcc-border);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)),
            rgba(10, 13, 21, 0.82);
          box-shadow: var(--lcc-shadow-md);
        }

        .billSidebarPane,
        .billRailPane {
          padding: 14px;
        }

        .billFocusPane {
          padding: 14px;
          overflow: auto;
        }

        .billFocusPane_empty {
          display: grid;
          place-items: center;
        }

        .billSelectPrompt {
          max-width: 360px;
          display: grid;
          justify-items: center;
          gap: 10px;
          text-align: center;
          color: var(--lcc-text-muted);
        }

        .billSelectPromptIcon {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.04);
        }

        .billSelectPromptTitle {
          font-size: 18px;
          font-weight: 800;
          color: var(--lcc-text);
        }

        .billMobileTabs {
          display: none;
          gap: 8px;
        }

        .billMobileTab {
          flex: 1;
          min-height: 38px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
          color: var(--lcc-text-muted);
          cursor: pointer;
        }

        .billMobileTab_active {
          color: var(--lcc-text);
          border-color: rgba(102, 159, 255, 0.34);
          background: linear-gradient(180deg, rgba(63,127,255,0.22), rgba(63,127,255,0.08));
        }

        .billRosterHead {
          display: grid;
          gap: 10px;
          margin-bottom: 12px;
        }

        .billSearch {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 40px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
          color: var(--lcc-text-muted);
        }

        .billSearch input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: 0;
          outline: 0;
          color: var(--lcc-text);
        }

        .billSearchClear {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          border: 0;
          background: transparent;
          color: var(--lcc-text-muted);
          cursor: pointer;
        }

        .billScopeTabs {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .billScopeTab {
          min-height: 34px;
          border-radius: 10px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
          color: var(--lcc-text-muted);
          cursor: pointer;
          text-transform: capitalize;
        }

        .billScopeTab_active {
          color: var(--lcc-text);
          border-color: rgba(102, 159, 255, 0.34);
          background: linear-gradient(180deg, rgba(63,127,255,0.22), rgba(63,127,255,0.08));
        }

        .billRosterMeta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 12px;
          color: var(--lcc-text-soft);
        }

        .billRosterSort,
        .billField input,
        .billField select,
        .billField textarea {
          width: 100%;
          min-height: 40px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
          color: var(--lcc-text);
          outline: none;
        }

        .billField textarea {
          min-height: 92px;
          resize: vertical;
        }

        .billField {
          display: grid;
          gap: 7px;
        }

        .billFieldLabel {
          font-size: 12px;
          font-weight: 700;
          color: var(--lcc-text-soft);
        }

        .billGrid {
          display: grid;
          gap: 12px;
        }

        .billGrid_2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .billGrid_3 {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .billGrid_4 {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .billRosterList {
          display: grid;
          gap: 8px;
          max-height: calc(100svh - 280px);
          overflow: auto;
          padding-right: 2px;
        }

        .billRow {
          width: 100%;
          display: grid;
          grid-template-columns: 4px 1fr;
          gap: 10px;
          text-align: left;
          padding: 0;
          border: 1px solid var(--lcc-border);
          border-radius: 14px;
          background: rgba(255,255,255,0.03);
          color: var(--lcc-text);
          cursor: pointer;
          overflow: hidden;
        }

        .billRow:hover,
        .billRow_active {
          border-color: rgba(102, 159, 255, 0.28);
          background: rgba(255,255,255,0.055);
        }

        .billRowAccent {
          min-height: 100%;
          background: rgba(255,255,255,0.06);
        }

        .billRowMain {
          padding: 12px 12px 12px 0;
          display: grid;
          gap: 7px;
        }

        .billRowTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .billRowName {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .billRowAmount {
          font-size: 14px;
          font-weight: 800;
        }

        .billRowMeta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          font-size: 12px;
          color: var(--lcc-text-muted);
        }

        .billRowDot {
          opacity: 0.45;
        }

        .billRowStatus.toneGreen,
        .billRowStatus.toneAmber,
        .billRowStatus.toneRed {
          font-weight: 700;
        }

        .billFocusHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .billFocusHeaderLeft {
          display: grid;
          gap: 8px;
        }

        .billFocusTitleRow {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .billFocusTitle {
          margin: 0;
          font-size: clamp(22px, 2.1vw, 28px);
          line-height: 1;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .billFocusMeta {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .billFocusActions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .billActionGrid {
          display: grid;
          grid-template-columns: 1.12fr 0.88fr;
          gap: 12px;
          margin-bottom: 12px;
        }

        .billPanel {
          padding: 15px 16px;
          border-radius: 14px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
        }

        .billPanelHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 14px;
        }

        .billPanelTitle {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .billPayFoot {
          margin-top: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .billAdvanceToggle {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          color: var(--lcc-text-muted);
          font-size: 13px;
        }

        .billDebtPanel {
          display: flex;
          flex-direction: column;
        }

        .billDebtStack {
          display: grid;
          gap: 8px;
        }

        .billDebtStat {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 11px;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.04);
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .billDebtStat strong {
          color: var(--lcc-text);
          font-size: 14px;
        }

        .billDebtPlan {
          margin-top: 4px;
          padding: 10px 11px;
          border-radius: 10px;
          background: rgba(79, 142, 255, 0.08);
          border: 1px solid rgba(79, 142, 255, 0.16);
        }

        .billDebtPlanLabel {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--lcc-blue);
        }

        .billDebtPlanValue {
          margin-top: 4px;
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .billDebtEmpty {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
          font-size: 13px;
          color: var(--lcc-text-muted);
          line-height: 1.55;
        }

        .billDetailRow {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }

        .billMetricCard {
          padding: 12px 13px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
          display: grid;
          gap: 5px;
        }

        .billMetricLabel,
        .billDetailLabel {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.11em;
          text-transform: uppercase;
          color: var(--lcc-text-soft);
        }

        .billMetricValue,
        .billDetailValue {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .billMetricSub {
          font-size: 12px;
          color: var(--lcc-text-muted);
        }

        .billDetailGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .billDetailCard {
          padding: 12px 13px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.02);
          display: grid;
          gap: 5px;
          min-height: 88px;
          align-content: start;
        }

        .billDetailCard_notes {
          grid-column: 1 / -1;
        }

        .billDetailNotes {
          font-size: 13px;
          color: var(--lcc-text-muted);
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .billRailPane {
          display: grid;
          gap: 12px;
        }

        .billRailSection {
          padding: 14px;
          border-radius: 14px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
        }

        .billRailSection_fill {
          min-height: 0;
        }

        .billRailLabel {
          margin-bottom: 10px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--lcc-text-soft);
        }

        .billRailActionStack,
        .billRailStatList {
          display: grid;
          gap: 9px;
        }

        .billRailStat {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .billRailStat strong {
          color: var(--lcc-text);
        }

        .billSelectedCard {
          display: grid;
          gap: 10px;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.02);
        }

        .billSelectedTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .billSelectedName {
          font-size: 15px;
          font-weight: 800;
        }

        .billSelectedAmount {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: -0.04em;
        }

        .billSelectedMeta {
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .billSelectedDebt {
          padding-top: 10px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: grid;
          gap: 4px;
        }

        .billSelectedDebtLabel {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--lcc-text-soft);
        }

        .billSelectedDebtName {
          font-size: 14px;
          font-weight: 700;
        }

        .billSelectedDebtMeta {
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .billProgress {
          position: relative;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
        }

        .billProgressFill {
          height: 100%;
          border-radius: 999px;
          background: currentColor;
          box-shadow: 0 0 18px currentColor;
        }

        .billOverlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: grid;
          place-items: center;
          padding: 20px;
        }

        .billOverlay_drawer {
          justify-items: end;
        }

        .billOverlayBackdrop {
          position: absolute;
          inset: 0;
          border: 0;
          background: rgba(0,0,0,0.64);
          backdrop-filter: blur(8px);
          cursor: pointer;
        }

        .billDrawer,
        .billModal {
          position: relative;
          z-index: 1;
          border-radius: 22px;
          border: 1px solid var(--lcc-border);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)),
            rgba(9, 12, 20, 0.96);
          box-shadow: var(--lcc-shadow-lg);
        }

        .billDrawer {
          width: min(760px, calc(100vw - 24px));
          height: min(100svh - 24px, 920px);
          display: grid;
          grid-template-rows: auto 1fr auto;
        }

        .billModal {
          width: min(680px, calc(100vw - 24px));
          max-height: min(100svh - 24px, 720px);
          display: grid;
          grid-template-rows: auto 1fr auto;
        }

        .billDrawerHead,
        .billModalHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 18px 0;
        }

        .billDrawerSub {
          margin-top: 6px;
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .billModalTitle {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .billDrawerBody,
        .billModalBody {
          min-height: 0;
          overflow: auto;
          padding: 18px;
        }

        .billDrawerFoot,
        .billModalFoot {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          padding: 0 18px 18px;
          flex-wrap: wrap;
        }

        .billFormBlock {
          padding: 14px;
          border-radius: 14px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
        }

        .billFormBlock + .billFormBlock {
          margin-top: 12px;
        }

        .billFormBlockTitle {
          margin-bottom: 12px;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .billFormBlockBody {
          display: grid;
          gap: 12px;
        }

        .billToggleRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .billStack {
          display: grid;
          gap: 12px;
        }

        .billMore {
          position: relative;
        }

        .billMenu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 180px;
          padding: 8px;
          border-radius: 14px;
          border: 1px solid var(--lcc-border);
          background: rgba(10, 13, 21, 0.98);
          box-shadow: var(--lcc-shadow-md);
          display: grid;
          gap: 4px;
          z-index: 5;
        }

        .billMenuItem {
          min-height: 34px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          border-radius: 10px;
          border: 0;
          background: transparent;
          color: var(--lcc-text);
          cursor: pointer;
          text-align: left;
        }

        .billMenuItem:hover {
          background: rgba(255,255,255,0.05);
        }

        .billMenuItem_danger {
          color: var(--lcc-red);
        }

        .billDivider {
          height: 1px;
          margin: 4px 0;
          background: rgba(255,255,255,0.06);
        }

        .billHistoryList {
          display: grid;
          gap: 10px;
        }

        .billHistoryCard {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
        }

        .billHistoryLeft {
          display: grid;
          gap: 5px;
        }

        .billHistoryAmount {
          font-size: 16px;
          font-weight: 800;
        }

        .billHistoryMeta,
        .billHistoryNote,
        .billEmptyHistory {
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .billHistoryRight {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .billEmptyState,
        .billEmptyHistory {
          padding: 14px;
          border-radius: 12px;
          border: 1px dashed rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.02);
        }

        .billEmptyTitle {
          font-size: 14px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .billToastStack {
          position: fixed;
          right: 16px;
          bottom: 16px;
          z-index: 90;
          display: grid;
          gap: 8px;
          width: min(420px, calc(100vw - 32px));
        }

        .billToast {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid var(--lcc-border);
          box-shadow: var(--lcc-shadow-md);
          background: rgba(9, 12, 20, 0.96);
        }

        .billToast_success {
          color: var(--lcc-green);
        }

        .billToast_error {
          color: var(--lcc-red);
        }

        .billToastClose {
          margin-left: auto;
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: currentColor;
          cursor: pointer;
        }

        @media (max-width: 1180px) {
          .billWorkspace {
            grid-template-columns: 1fr;
          }

          .billCol {
            display: none;
          }

          .billCol_show {
            display: block;
          }

          .billMobileTabs {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .billRosterList {
            max-height: none;
          }

          .billActionGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 860px) {
          .billSummaryStrip {
            padding: 14px;
          }

          .billSummaryLeft,
          .billSummaryRight {
            align-items: flex-start;
            justify-content: flex-start;
          }

          .billSummaryStrip {
            flex-direction: column;
            align-items: flex-start;
          }

          .billGrid_2,
          .billGrid_3,
          .billGrid_4,
          .billDetailRow,
          .billDetailGrid {
            grid-template-columns: 1fr;
          }

          .billDrawer {
            width: calc(100vw - 16px);
            height: calc(100svh - 16px);
          }

          .billModal {
            width: calc(100vw - 16px);
          }
        }
      `}</style>
    </>
  );
}