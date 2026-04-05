"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BadgeDollarSign,
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

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */
function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86400000);
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
  const nx = new Date(dt.getFullYear(), dt.getMonth() + Number(n || 0), 1, 12);
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
function isCredit(t) {
  return normType(t) === "credit";
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
  if (!Number.isFinite(ss) || !Number.isFinite(es)) return ps >= ds;
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

          <button type="button" className="billMenuItem billMenuItem_danger" onClick={() => run(onDelete)}>
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
          onClick={() => set((p) => ({ ...p, isDebtBill: false, debtMode: "none", linkedDebtId: "" }))}
        >
          Fixed bill
        </Button>
        <Button
          variant={value.isDebtBill ? "primary" : "ghost"}
          onClick={() =>
            set((p) => ({
              ...p,
              isDebtBill: true,
              debtMode: p.debtMode === "none" ? (debtProfiles.length ? "link_existing" : "create_new") : p.debtMode,
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
              onClick={() => set((p) => ({ ...p, debtMode: "create_new", linkedDebtId: "" }))}
            >
              Create new
            </Button>
          </div>

          {value.debtMode === "link_existing" ? (
            <Field label="Debt profile">
              <select value={value.linkedDebtId} onChange={(e) => set((p) => ({ ...p, linkedDebtId: e.target.value }))}>
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
          bills.map((b) => <BillRow key={b.id} bill={b} selected={b.id === selectedId} onSelect={() => onSelect(b.id)} />)
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
          <div className="billSelectPromptText">Pick one from the left to view details and log payments.</div>
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
    ? payoffLabel(linkedDebt.balance, linkedDebt.aprPct, safeNum(linkedDebt.minPay) + safeNum(linkedDebt.extraPay))
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
                {linkedDebt.name}
              </Pill>
            ) : null}
            {!bill.active ? <Pill>Inactive</Pill> : null}
          </div>

          <div className="billFocusMeta">
            {bill.category || "No category"} · {FREQS.find((o) => o.value === bill.frequency)?.label} · Updated{" "}
            {fmtAgo(bill.updatedAt)}
          </div>
        </div>

        <div className="billFocusHeaderRight">
          <Button onClick={onEdit}>
            <PencilLine size={13} />
            Edit
          </Button>
          <MoreMenu bill={bill} onEdit={onEdit} onDuplicate={onDuplicate} onToggle={onToggle} onDelete={onDelete} />
        </div>
      </div>

      <div className="billFocusScroll">
        <div className="billHeroShell">
          <div className="billHeroTopRow">
            <div className="billHeroPrimary">
              <div className="billHeroLabel">Amount Due</div>
              <div className={`billHeroValue ${s.tone === "red" ? "textNegative" : s.tone === "amber" ? "textWarning" : s.tone === "green" ? "textPositive" : ""}`}>
                {money(bill.amount)}
              </div>

              <div className="billHeroStatusRow">
                <Pill tone={s.tone} dot>
                  {s.label}
                </Pill>
                <span className="billHeroSubtext">
                  {s.isPaid ? `Paid ${shortDate(bill.lastPaidDate)}` : dueText(daysUntil(bill.dueDate))}
                </span>
              </div>
            </div>

            <div className="billHeroMetaStack">
              <div className="billHeroMetaChip">
                <CalendarDays size={13} />
                {shortDate(bill.dueDate)}
              </div>
              <div className="billHeroMetaChip">
                <Receipt size={13} />
                {FREQS.find((o) => o.value === bill.frequency)?.label}
              </div>
            </div>
          </div>

          <div className="billHeroBarWrap">
            <Progress pct={s.pct} tone={s.tone} h={6} />
          </div>

          <div className="billHeroMetaGrid">
            <div className="billHeroMetaCard">
              <span>Pay from</span>
              <strong>{accountNameById.get(bill.accountId) || "None"}</strong>
            </div>
            <div className="billHeroMetaCard">
              <span>Category</span>
              <strong>{bill.category || "—"}</strong>
            </div>
            <div className="billHeroMetaCard">
              <span>Autopay</span>
              <strong>{bill.autopay ? "Enabled" : "Off"}</strong>
            </div>
            <div className="billHeroMetaCard">
              <span>Cycle</span>
              <strong>{shortDate(cycleStart(bill))}</strong>
            </div>
          </div>
        </div>

        <div className="billMidGrid">
          <div className="billPanel">
            <div className="billPanelHead">
              <div className="billPanelTitle">Make Payment</div>
              <Button size="xs" onClick={onOpenHist}>
                <Receipt size={12} />
                History
              </Button>
            </div>

            <Grid cols={2}>
              <Field label="Amount">
                <input
                  value={draft.amount}
                  onChange={(e) => setDraft((p) => ({ ...p, amount: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </Field>

              <Field label="Date">
                <input
                  type="date"
                  value={draft.paymentDate}
                  onChange={(e) => setDraft((p) => ({ ...p, paymentDate: e.target.value }))}
                />
              </Field>

              <Field label="From Account">
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

              <Field label="Note">
                <input
                  value={draft.note}
                  onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Optional"
                />
              </Field>
            </Grid>

            <div className="billPayFoot">
              <div className="billAdvanceToggle">
                <span>Advance due date</span>
                <Button size="xs" variant={draft.advanceDue ? "primary" : "ghost"} onClick={() => setDraft((p) => ({ ...p, advanceDue: true }))}>
                  Yes
                </Button>
                <Button size="xs" variant={!draft.advanceDue ? "primary" : "ghost"} onClick={() => setDraft((p) => ({ ...p, advanceDue: false }))}>
                  No
                </Button>
              </div>

              <Button variant="success" size="md" onClick={onPay} disabled={payBusy}>
                <BadgeDollarSign size={14} />
                {payBusy ? "Saving…" : "Mark Paid"}
              </Button>
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
            <strong className={metrics.dueSoonCount > 0 ? "textWarning" : "textPositive"}>{metrics.dueSoonCount}</strong>
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
                  {payoffLabel(linkedDebt.balance, linkedDebt.aprPct, safeNum(linkedDebt.minPay) + safeNum(linkedDebt.extraPay))}
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
          <AlertCircle size={14} />
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

  const refreshPage = useCallback(async (preferredId = "") => {
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
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const [billsRes, debtRes, accountsRes, settingsRes, paymentsRes] = await Promise.all([
        supabase.from("bills").select("*").eq("user_id", user.id).eq("type", "noncontrollable").order("due_date", { ascending: true }),
        supabase.from("bills").select("*").eq("user_id", user.id).eq("type", "controllable").order("name", { ascending: true }),
        supabase.from("accounts").select("*").eq("user_id", user.id).order("name", { ascending: true }),
        supabase.from("account_settings").select("primary_account_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("bill_payments").select("*").eq("user_id", user.id).order("payment_date", { ascending: false }),
      ]);

      if (billsRes.error) throw billsRes.error;
      if (debtRes.error) throw debtRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const loadedBills = (billsRes.data || []).map(mapBill);
      const loadedAccounts = (accountsRes.data || []).map(mapAcct);
      const preferredAccountId = settingsRes.data?.primary_account_id || loadedAccounts[0]?.id || "";

      setBills(loadedBills);
      setDebtProfiles((debtRes.data || []).map(mapBill));
      setAccounts(loadedAccounts);
      setPayments((paymentsRes.data || []).map(mapPayment));
      setDefaultAccountId(preferredAccountId);

      setSelectedBillId((prev) => {
        if (preferredId && loadedBills.some((b) => b.id === preferredId)) return preferredId;
        if (prev && loadedBills.some((b) => b.id === prev)) return prev;
        return loadedBills[0]?.id || "";
      });

      setAddForm((prev) => ({
        ...prev,
        accountId: prev.accountId || preferredAccountId,
        newDebtAccountId: prev.newDebtAccountId || preferredAccountId,
      }));
    } catch (err) {
      setPageError(err?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPage();
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => refreshPage());

    return () => subscription?.unsubscribe?.();
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
      return [...filtered].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    }
    if (sortBy === "updated_desc") {
      return [...filtered].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    }

    return [...filtered].sort(
      (a, b) =>
        (Number.isFinite(daysUntil(a.dueDate)) ? daysUntil(a.dueDate) : 999999) -
        (Number.isFinite(daysUntil(b.dueDate)) ? daysUntil(b.dueDate) : 999999)
    );
  }, [bills, scope, search, sortBy]);

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

  const selectedLinkedDebt = useMemo(() => {
    return selectedBill?.linkedDebtId ? debtProfiles.find((d) => d.id === selectedBill.linkedDebtId) || null : null;
  }, [selectedBill, debtProfiles]);

  useEffect(() => {
    if (!selectedBill) {
      setEditor(emptyForm(defaultAccountId));
      setPaymentDraft(payDraft(null, defaultAccountId));
      return;
    }
    setEditor(editorState(selectedBill, selectedLinkedDebt, defaultAccountId));
    setPaymentDraft(payDraft(selectedBill, defaultAccountId));
  }, [selectedBill, selectedLinkedDebt, defaultAccountId]);

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
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
  }, [payments, selectedBill?.id]);

  const metrics = useMemo(() => {
    const active = bills.filter((b) => b.active);
    const mk = monthKeyOf(isoDate());
    const monthlyPressure = active.reduce((s, b) => s + moWeight(b.amount, b.frequency), 0);
    const dueSoonCount = active.filter((b) => {
      const d = daysUntil(b.dueDate);
      return Number.isFinite(d) && d >= 0 && d <= 7;
    }).length;
    const linkedDebtCount = active.filter((b) => !!b.linkedDebtId).length;
    const paidThisMonth = payments
      .filter((p) => monthKeyOf(p.paymentDate) === mk)
      .reduce((s, p) => s + safeNum(p.amount), 0);

    const nextBill = [...active].sort(
      (a, b) =>
        (Number.isFinite(daysUntil(a.dueDate)) ? daysUntil(a.dueDate) : 999999) -
        (Number.isFinite(daysUntil(b.dueDate)) ? daysUntil(b.dueDate) : 999999)
    )[0];

    return {
      activeCount: active.length,
      linkedDebtCount,
      monthlyPressure,
      dueSoonCount,
      paidThisMonth,
      nextBill,
    };
  }, [bills, payments]);

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

  async function upsertCal(pid, bill, amt, date, note = "") {
    const profileId = await getCalProfileId();
    if (!profileId) return;

    const payload = {
      user_id: userId,
      profile_id: profileId,
      title: `Expense • ${bill.name || "Bill Payment"}`,
      event_date: date,
      event_time: null,
      end_time: null,
      category: "Expense",
      flow: "expense",
      amount: round2(amt),
      note: `[Bill Payment] ${bill.name || "Bill"}${note ? ` • ${note}` : ""}`,
      status: "scheduled",
      color: "#ef4444",
      source: "spending",
      source_id: pid,
      source_table: "spending_transactions",
      auto_created: true,
      transaction_type: "expense",
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: findError } = await supabase
      .from("calendar_events")
      .select("id")
      .eq("user_id", userId)
      .eq("profile_id", profileId)
      .eq("source", "spending")
      .eq("source_id", pid)
      .maybeSingle();

    if (findError) throw findError;

    if (existing?.id) {
      const { error: updateError } = await supabase.from("calendar_events").update(payload).eq("id", existing.id);
      if (updateError) throw updateError;
      return;
    }

    const { error: insertError } = await supabase.from("calendar_events").insert([
      {
        id: uid(),
        created_at: new Date().toISOString(),
        ...payload,
      },
    ]);
    if (insertError) throw insertError;
  }

  async function delCal(pid) {
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("user_id", userId)
      .eq("source", "spending")
      .eq("source_id", pid);
    if (error) throw error;
  }

  async function applyDelta({
    accountId,
    delta,
    kind,
    note,
    sourceType,
    sourceId,
    effectiveDate,
    startingBalance,
  }) {
    if (!accountId) return { ok: true, previousBalance: null, balance: null };

    const acct = accounts.find((r) => r.id === accountId);
    if (!acct) return { ok: false, message: "Account not found." };

    const prev = Number.isFinite(startingBalance) ? safeNum(startingBalance) : safeNum(acct.balance);
    const next = round2(prev + safeNum(delta));

    const { error: accountError } = await supabase
      .from("accounts")
      .update({ balance: next, updated_at: new Date().toISOString() })
      .eq("id", acct.id)
      .eq("user_id", userId);
    if (accountError) return { ok: false, message: accountError.message };

    const { error: ledgerError } = await supabase.from("account_transactions").insert({
      user_id: userId,
      account_id: acct.id,
      kind,
      amount: round2(Math.abs(safeNum(delta))),
      delta: round2(delta),
      resulting_balance: next,
      note: note || "",
      related_account_id: null,
      related_account_name: null,
      source_type: sourceType,
      source_id: sourceId,
      created_at: ledgerTs(effectiveDate),
    });

    if (ledgerError) {
      await supabase
        .from("accounts")
        .update({ balance: prev, updated_at: new Date().toISOString() })
        .eq("id", acct.id)
        .eq("user_id", userId);
      return { ok: false, message: ledgerError.message };
    }

    return { ok: true, previousBalance: prev, balance: next };
  }

  function acctEffect(accountId, amount) {
    const a = accounts.find((r) => r.id === accountId);
    if (!a) return { delta: 0, kind: "bill_payment" };
    const abs = Math.abs(round2(amount));
    if (isCredit(a.type)) return { delta: abs, kind: "bill_charge" };
    return { delta: -abs, kind: "bill_payment" };
  }

  async function createDebt(draft) {
    const billName = String(draft.name || "").trim();
    const billAmount = parseMoneyInput(draft.amount);
    const debtName = String(draft.newDebtName || billName).trim();
    const balance = parseMoneyInput(draft.newDebtBalance);
    const apr = parseMoneyInput(draft.newDebtAprPct || "0");
    const minPayRaw = parseMoneyInput(draft.newDebtMinPay || "");
    const extraPayRaw = parseMoneyInput(draft.newDebtExtraPay || "0");

    if (!debtName) throw new Error("Debt name required.");
    if (!Number.isFinite(balance) || balance < 0) throw new Error("Balance must be ≥ 0.");

    const minPay =
      Number.isFinite(minPayRaw) && minPayRaw >= 0
        ? minPayRaw
        : Number.isFinite(billAmount) && billAmount > 0
        ? billAmount
        : 0;
    const extraPay = Number.isFinite(extraPayRaw) && extraPayRaw >= 0 ? extraPayRaw : 0;

    const id = uid();

    const res = await supabase
      .from("bills")
      .insert({
        id,
        user_id: userId,
        name: debtName,
        type: "controllable",
        frequency: draft.newDebtFrequency || draft.frequency || "monthly",
        due_date: draft.newDebtDueDate || draft.dueDate || isoDate(),
        amount: round2(Number.isFinite(billAmount) && billAmount > 0 ? billAmount : minPay),
        active: true,
        balance: round2(balance),
        min_pay: round2(minPay),
        extra_pay: round2(extraPay),
        apr_pct: round2(Number.isFinite(apr) ? apr : 0),
        autopay: draft.newDebtAutopay === true,
        category: draft.newDebtCategory || draft.category || "",
        notes: draft.newDebtNotes || "",
        account_id: draft.newDebtAccountId || draft.accountId || defaultAccountId || null,
        linked_debt_id: null,
        last_paid_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (res.error) throw new Error(res.error.message);
    return mapBill(res.data);
  }

  async function resolveDebtId(draft) {
    if (!draft.isDebtBill) return "";
    if (draft.debtMode === "link_existing") {
      if (!draft.linkedDebtId) throw new Error("Choose a debt.");
      return draft.linkedDebtId;
    }
    if (draft.debtMode === "create_new") {
      const d = await createDebt(draft);
      return d.id;
    }
    throw new Error("Select debt mode.");
  }

  async function addBill() {
    if (!supabase || !userId || addingBusy) return;

    const name = String(addForm.name || "").trim();
    const amount = parseMoneyInput(addForm.amount);

    if (!name) return setPageError("Name required.");
    if (!Number.isFinite(amount) || amount <= 0) return setPageError("Amount must be > 0.");

    setAddingBusy(true);
    setPageError("");

    let createdDebtId = "";

    try {
      const linkedDebtId = await resolveDebtId(addForm);
      createdDebtId = addForm.isDebtBill && addForm.debtMode === "create_new" ? linkedDebtId : "";

      const res = await supabase
        .from("bills")
        .insert({
          id: uid(),
          user_id: userId,
          name,
          type: "noncontrollable",
          frequency: addForm.frequency || "monthly",
          due_date: addForm.dueDate || null,
          amount: round2(amount),
          active: true,
          balance: 0,
          min_pay: 0,
          extra_pay: 0,
          apr_pct: 0,
          autopay: addForm.autopay === true,
          category: addForm.category || "",
          notes: addForm.notes || "",
          account_id: addForm.accountId || null,
          linked_debt_id: linkedDebtId || null,
          last_paid_date: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (res.error) throw new Error(res.error.message);

      const saved = mapBill(res.data);
      setAddForm(emptyForm(defaultAccountId));
      setDrawerMode(null);
      setStatus("Bill added.");
      await refreshPage(saved.id);
    } catch (err) {
      if (createdDebtId) {
        await supabase.from("bills").delete().eq("id", createdDebtId).eq("user_id", userId);
      }
      setPageError(err?.message || "Could not add.");
    } finally {
      setAddingBusy(false);
    }
  }

  async function saveBill() {
    if (!supabase || !userId || !selectedBill || savingSelected) return;

    const name = String(editor.name || "").trim();
    const amount = parseMoneyInput(editor.amount);

    if (!name) return setPageError("Name required.");
    if (!Number.isFinite(amount) || amount <= 0) return setPageError("Amount must be > 0.");

    setSavingSelected(true);
    setPageError("");
    let createdDebtId = "";

    try {
      const linkedDebtId = await resolveDebtId(editor);
      createdDebtId = editor.isDebtBill && editor.debtMode === "create_new" ? linkedDebtId : "";

      const res = await supabase
        .from("bills")
        .update({
          name,
          frequency: editor.frequency || "monthly",
          due_date: editor.dueDate || null,
          amount: round2(amount),
          autopay: editor.autopay === true,
          category: editor.category || "",
          notes: editor.notes || "",
          account_id: editor.accountId || null,
          linked_debt_id: linkedDebtId || null,
          last_paid_date: editor.lastPaidDate || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedBill.id)
        .eq("user_id", userId)
        .select()
        .single();

      if (res.error) throw new Error(res.error.message);

      setDrawerMode(null);
      setStatus("Bill saved.");
      await refreshPage(selectedBill.id);
    } catch (err) {
      if (createdDebtId) {
        await supabase.from("bills").delete().eq("id", createdDebtId).eq("user_id", userId);
      }
      setPageError(err?.message || "Could not save.");
    } finally {
      setSavingSelected(false);
    }
  }

  async function dupBill(bill) {
    if (!supabase || !userId) return;
    setPageError("");

    const res = await supabase
      .from("bills")
      .insert({
        id: uid(),
        user_id: userId,
        name: `${bill.name || "Bill"} Copy`,
        type: "noncontrollable",
        frequency: bill.frequency || "monthly",
        due_date: bill.dueDate || null,
        amount: round2(bill.amount),
        active: bill.active !== false,
        balance: round2(bill.balance),
        min_pay: round2(bill.minPay),
        extra_pay: round2(bill.extraPay),
        apr_pct: round2(bill.aprPct),
        autopay: bill.autopay === true,
        category: bill.category || "",
        notes: bill.notes || "",
        account_id: bill.accountId || null,
        linked_debt_id: bill.linkedDebtId || null,
        last_paid_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (res.error) return setPageError(res.error.message);

    const saved = mapBill(res.data);
    setStatus("Bill duplicated.");
    await refreshPage(saved.id);
  }

  async function delBillById(billId, billName = "this bill") {
    if (!supabase || !userId || !billId) return false;
    if (typeof window !== "undefined" && !window.confirm(`Delete ${billName}?`)) return false;

    setPageError("");

    const relatedPayments = payments.filter((p) => p.billId === billId);

    if (relatedPayments.length) {
      const ids = relatedPayments.map((p) => p.id);

      const { error: e1 } = await supabase.from("spending_transactions").delete().in("id", ids).eq("user_id", userId);
      if (e1) {
        setPageError(e1.message);
        return false;
      }

      const { error: e2 } = await supabase
        .from("calendar_events")
        .delete()
        .eq("user_id", userId)
        .eq("source", "spending")
        .in("source_id", ids);
      if (e2) {
        setPageError(e2.message);
        return false;
      }

      const { error: e3 } = await supabase.from("bill_payments").delete().eq("bill_id", billId).eq("user_id", userId);
      if (e3) {
        setPageError(e3.message);
        return false;
      }
    }

    const { error } = await supabase.from("bills").delete().eq("id", billId).eq("user_id", userId);
    if (error) {
      setPageError(error.message);
      return false;
    }

    setDrawerMode(null);
    setStatus("Bill deleted.");
    await refreshPage();
    return true;
  }

  async function delBill() {
    if (selectedBill) await delBillById(selectedBill.id, selectedBill.name);
  }

  async function toggleActive(bill) {
    if (!supabase || !userId) return;
    setPageError("");

    const res = await supabase
      .from("bills")
      .update({
        active: !bill.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bill.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (res.error) return setPageError(res.error.message);

    setStatus(bill.active ? "Bill archived." : "Bill activated.");
    await refreshPage(bill.id);
  }

  async function makePay() {
    if (!supabase || !userId || !selectedBill || paymentDraft.saving) return;

    const amount = round2(parseMoneyInput(paymentDraft.amount));
    if (!Number.isFinite(amount) || amount <= 0) return setPageError("Enter a valid amount.");

    const paymentDate = paymentDraft.paymentDate || isoDate();
    const paymentAccountId = paymentDraft.accountId || "";
    const paymentNote = String(paymentDraft.note || "").trim();
    const payAccount = accounts.find((a) => a.id === paymentAccountId) || null;

    const advance = selectedBill.frequency !== "one_time" && shouldAdvance(selectedBill, paymentDate, paymentDraft.advanceDue);
    const nextDue = advance
      ? nextDueFromFreq(paymentDate || selectedBill.dueDate || isoDate(), selectedBill.frequency)
      : selectedBill.dueDate || "";

    const nextLastPaid =
      !selectedBill.lastPaidDate || compareIsoDates(paymentDate, selectedBill.lastPaidDate) > 0
        ? paymentDate
        : selectedBill.lastPaidDate;

    const nextBalance =
      safeNum(selectedBill.balance) > 0
        ? Math.max(0, round2(safeNum(selectedBill.balance) - amount))
        : safeNum(selectedBill.balance);

    const linkedDebt = debtProfiles.find((r) => r.id === selectedBill.linkedDebtId) || null;
    const nextDebtBalance = linkedDebt ? Math.max(0, round2(safeNum(linkedDebt.balance) - amount)) : 0;
    const nextDebtLastPaid =
      linkedDebt && (!linkedDebt.lastPaidDate || compareIsoDates(paymentDate, linkedDebt.lastPaidDate) > 0)
        ? paymentDate
        : linkedDebt?.lastPaidDate || "";

    const advanceDebt =
      linkedDebt &&
      linkedDebt.frequency !== "one_time" &&
      shouldAdvance(linkedDebt, paymentDate, paymentDraft.advanceDue);

    const nextDebtDue =
      linkedDebt && advanceDebt
        ? nextDueFromFreq(paymentDate || linkedDebt.dueDate || isoDate(), linkedDebt.frequency)
        : linkedDebt?.dueDate || "";

    setPaymentDraft((p) => ({ ...p, saving: true }));
    setPageError("");

    const pid = uid();
    let accountEffect = null;
    let accountResult = null;
    let billUpdated = false;
    let debtUpdated = false;
    let spendingInserted = false;
    let calendarInserted = false;

    try {
      const paymentInsert = await supabase.from("bill_payments").insert({
        id: pid,
        user_id: userId,
        bill_id: selectedBill.id,
        linked_debt_id: selectedBill.linkedDebtId || null,
        amount,
        payment_date: paymentDate,
        payment_account_id: paymentAccountId || null,
        note: paymentNote || null,
      });
      if (paymentInsert.error) throw paymentInsert.error;

      if (paymentAccountId) {
        accountEffect = acctEffect(paymentAccountId, amount);
        accountResult = await applyDelta({
          accountId: paymentAccountId,
          delta: accountEffect.delta,
          kind: accountEffect.kind,
          note: `${selectedBill.name || "Bill"}${paymentNote ? ` • ${paymentNote}` : ""}`,
          sourceType: "bill_payment",
          sourceId: pid,
          effectiveDate: paymentDate,
        });
        if (!accountResult.ok) throw new Error(accountResult.message);
      }

      const { error: billError } = await supabase
        .from("bills")
        .update({
          last_paid_date: nextLastPaid || null,
          due_date: nextDue || null,
          balance: nextBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedBill.id)
        .eq("user_id", userId);
      if (billError) throw billError;
      billUpdated = true;

      if (linkedDebt) {
        const { error: debtError } = await supabase
          .from("bills")
          .update({
            balance: nextDebtBalance,
            last_paid_date: nextDebtLastPaid || null,
            due_date: nextDebtDue || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkedDebt.id)
          .eq("user_id", userId);
        if (debtError) throw debtError;
        debtUpdated = true;
      }

      const spendRow = spendingRow(pid, userId, selectedBill, amount, paymentDate, payAccount?.name || "", paymentNote);
      const { error: spendError } = await supabase.from("spending_transactions").insert([spendRow]);
      if (spendError) throw spendError;
      spendingInserted = true;

      try {
        await upsertCal(pid, selectedBill, amount, paymentDate, paymentNote);
        calendarInserted = true;
      } catch (e) {
        console.error("Calendar mirror failed", e);
      }

      setPaymentDraft(payDraft(null, selectedBill.accountId || defaultAccountId || ""));
      setStatus(linkedDebt ? "Paid · debt synced." : "Payment logged.");
      await refreshPage(selectedBill.id);
    } catch (err) {
      if (calendarInserted) await delCal(pid).catch(() => {});
      if (spendingInserted) {
        await supabase.from("spending_transactions").delete().eq("id", pid).eq("user_id", userId);
      }
      if (linkedDebt && debtUpdated) {
        await supabase
          .from("bills")
          .update({
            balance: linkedDebt.balance,
            last_paid_date: linkedDebt.lastPaidDate || null,
            due_date: linkedDebt.dueDate || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkedDebt.id)
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
      if (accountEffect && accountResult?.ok) {
        await applyDelta({
          accountId: paymentAccountId,
          delta: -accountEffect.delta,
          kind: "bill_payment_rollback",
          note: `${selectedBill.name} rollback`,
          sourceType: "bill_payment_rollback",
          sourceId: pid,
          effectiveDate: isoDate(),
          startingBalance: accountResult.balance,
        });
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

    const currentBill = bills.find((b) => b.id === payment.billId);
    const linkedDebt =
      debtProfiles.find((d) => d.id === (payment.linkedDebtId || currentBill?.linkedDebtId || "")) || null;

    const remainingBillPayments = payments
      .filter((r) => r.billId === payment.billId && r.id !== payment.id)
      .sort(
        (a, b) =>
          compareIsoDates(b.paymentDate, a.paymentDate) ||
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

    const remainingDebtPayments = linkedDebt
      ? payments
          .filter((r) => r.id !== payment.id && (r.linkedDebtId === linkedDebt.id || r.billId === linkedDebt.id))
          .sort(
            (a, b) =>
              compareIsoDates(b.paymentDate, a.paymentDate) ||
              new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
          )
      : [];

    let rollbackResult = null;
    let originalEffect = null;
    let billUpdated = false;
    let debtUpdated = false;

    try {
      if (payment.accountId) {
        originalEffect = acctEffect(payment.accountId, payment.amount);
        rollbackResult = await applyDelta({
          accountId: payment.accountId,
          delta: -originalEffect.delta,
          kind: "bill_payment_delete",
          note: `${currentBill?.name || "Bill"} payment deleted`,
          sourceType: "bill_payment_delete",
          sourceId: payment.id,
          effectiveDate: isoDate(),
        });
        if (!rollbackResult.ok) throw new Error(rollbackResult.message);
      }

      if (currentBill) {
        const nextLastPaid = remainingBillPayments[0]?.paymentDate || "";
        const billPayload = {
          last_paid_date: nextLastPaid || null,
          updated_at: new Date().toISOString(),
          balance:
            safeNum(currentBill.balance) > 0
              ? round2(safeNum(currentBill.balance) + safeNum(payment.amount))
              : safeNum(currentBill.balance),
        };

        if (
          currentBill.frequency !== "one_time" &&
          currentBill.lastPaidDate &&
          compareIsoDates(payment.paymentDate, currentBill.lastPaidDate) === 0
        ) {
          billPayload.due_date = prevDueFromFreq(currentBill.dueDate, currentBill.frequency);
        }

        const { error } = await supabase.from("bills").update(billPayload).eq("id", currentBill.id).eq("user_id", userId);
        if (error) throw error;
        billUpdated = true;
      }

      if (linkedDebt) {
        const nextDebtLastPaid = remainingDebtPayments[0]?.paymentDate || "";
        const debtPayload = {
          last_paid_date: nextDebtLastPaid || null,
          balance: round2(safeNum(linkedDebt.balance) + safeNum(payment.amount)),
          updated_at: new Date().toISOString(),
        };

        if (
          linkedDebt.frequency !== "one_time" &&
          linkedDebt.lastPaidDate &&
          compareIsoDates(payment.paymentDate, linkedDebt.lastPaidDate) === 0
        ) {
          debtPayload.due_date = prevDueFromFreq(linkedDebt.dueDate, linkedDebt.frequency);
        }

        const { error } = await supabase.from("bills").update(debtPayload).eq("id", linkedDebt.id).eq("user_id", userId);
        if (error) throw error;
        debtUpdated = true;
      }

      const { error: e1 } = await supabase.from("spending_transactions").delete().eq("id", payment.id).eq("user_id", userId);
      if (e1) throw e1;

      await delCal(payment.id).catch(() => {});

      const { error: e2 } = await supabase.from("bill_payments").delete().eq("id", payment.id).eq("user_id", userId);
      if (e2) {
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

        if (linkedDebt && debtUpdated) {
          await supabase
            .from("bills")
            .update({
              last_paid_date: linkedDebt.lastPaidDate || null,
              due_date: linkedDebt.dueDate || null,
              balance: linkedDebt.balance,
              updated_at: new Date().toISOString(),
            })
            .eq("id", linkedDebt.id)
            .eq("user_id", userId);
        }

        if (payment.accountId && originalEffect && rollbackResult?.ok) {
          await applyDelta({
            accountId: payment.accountId,
            delta: originalEffect.delta,
            kind: "bill_payment_delete_rollback",
            note: `${currentBill?.name || "Bill"} delete rollback`,
            sourceType: "bill_payment_delete_rollback",
            sourceId: payment.id,
            effectiveDate: isoDate(),
            startingBalance: rollbackResult.balance,
          });
        }

        throw e2;
      }

      setStatus(linkedDebt ? "Payment deleted · debt resynced." : "Payment deleted.");
      await refreshPage(currentBill?.id || selectedBillId);
    } catch (err) {
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
            linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0)),
            rgba(18, 22, 32, 0.86);
          box-shadow: var(--lcc-shadow-sm);
        }

        .billSummaryLeft {
          display: flex;
          align-items: center;
          gap: 18px;
          min-width: 0;
        }

        .billPageTitleWrap {
          min-width: 0;
        }

        .billEyebrow {
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--lcc-text-soft);
        }

        .billPageTitle {
          margin-top: 4px;
          font-size: clamp(24px, 2.4vw, 32px);
          line-height: 1;
          font-weight: 700;
          letter-spacing: -0.04em;
        }

        .billSummaryMiniList {
          display: flex;
          align-items: stretch;
          gap: 10px;
          flex-wrap: wrap;
        }

        .billMiniStat {
          min-width: 110px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
        }

        .billMiniLabel {
          display: block;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--lcc-text-soft);
        }

        .billMiniValue {
          display: block;
          margin-top: 5px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .billSummaryRight {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .billNextDue {
          font-size: 12.5px;
          color: var(--lcc-text-soft);
          white-space: nowrap;
        }

        .billNextDue span {
          color: var(--lcc-text);
          font-weight: 600;
        }

        .billMobileTabs {
          display: none;
          border-radius: var(--lcc-radius-md);
          border: 1px solid var(--lcc-border);
          background: rgba(18, 22, 32, 0.78);
          overflow: hidden;
        }

        .billMobileTab {
          flex: 1;
          min-height: 42px;
          border: 0;
          background: transparent;
          color: var(--lcc-text-soft);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .billMobileTab_active {
          background: rgba(79, 142, 255, 0.10);
          color: var(--lcc-blue);
          box-shadow: inset 0 -2px 0 var(--lcc-blue);
        }

        .billWorkspace {
          min-height: 0;
          display: grid;
          grid-template-columns: 290px minmax(0, 1fr) 240px;
          gap: 12px;
          flex: 1;
        }

        .billCol {
          min-height: 0;
          min-width: 0;
        }

        .billSidebarPane,
        .billFocusPane,
        .billRailPane {
          height: 100%;
          min-height: 0;
          border-radius: var(--lcc-radius-lg);
          border: 1px solid var(--lcc-border);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0) 48px),
            rgba(18, 22, 32, 0.88);
          box-shadow: var(--lcc-shadow-sm);
        }

        .billSidebarPane {
          display: grid;
          grid-template-rows: auto 1fr;
          overflow: hidden;
        }

        .billRosterHead {
          padding: 12px;
          border-bottom: 1px solid var(--lcc-border);
          display: grid;
          gap: 10px;
        }

        .billSearch {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 40px;
          padding: 0 12px;
          border-radius: var(--lcc-radius-md);
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
          color: var(--lcc-text-soft);
        }

        .billSearch input,
        .billSearch input:focus {
          border: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          padding: 0 !important;
          min-height: auto !important;
        }

        .billSearchClear {
          display: grid;
          place-items: center;
          padding: 0;
          color: var(--lcc-text-soft);
          cursor: pointer;
          flex-shrink: 0;
        }

        .billScopeTabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }

        .billScopeTab {
          min-height: 34px;
          border-radius: 9px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.02);
          color: var(--lcc-text-soft);
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
          cursor: pointer;
        }

        .billScopeTab_active {
          background: rgba(79, 142, 255, 0.10);
          border-color: rgba(79, 142, 255, 0.28);
          color: var(--lcc-blue);
        }

        .billRosterMeta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 11px;
          color: var(--lcc-text-soft);
        }

        .billRosterSort,
        .billRosterSort:focus {
          width: auto;
          padding: 0;
          border: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          color: var(--lcc-text-soft);
          cursor: pointer;
        }

        .billRosterList {
          min-height: 0;
          overflow: auto;
          padding: 4px 0;
        }

        .billRow {
          position: relative;
          width: 100%;
          padding: 12px 14px 12px 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          border: 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          background: transparent;
          text-align: left;
          cursor: pointer;
          transition: background 140ms ease;
        }

        .billRow:hover {
          background: rgba(255,255,255,0.03);
        }

        .billRow_active {
          background: rgba(79, 142, 255, 0.08);
        }

        .billRowAccent {
          width: 2px;
          align-self: stretch;
          border-radius: 999px;
          background: transparent;
          flex-shrink: 0;
          opacity: 0;
        }

        .billRow_active .billRowAccent {
          opacity: 1;
        }

        .billRowMain {
          flex: 1;
          min-width: 0;
        }

        .billRowTop {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }

        .billRowName {
          min-width: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--lcc-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .billRowAmount {
          flex-shrink: 0;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--lcc-text);
        }

        .billRowMeta {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 4px;
          font-size: 12px;
          min-width: 0;
          flex-wrap: wrap;
        }

        .billRowCategory {
          color: var(--lcc-text-muted);
        }

        .billRowDot {
          color: var(--lcc-text-dim);
        }

        .billRowStatus {
          font-weight: 600;
        }

        .billRowAuto {
          color: var(--lcc-green);
          font-weight: 600;
        }

        .billEmptyState {
          padding: 28px 18px;
          display: grid;
          gap: 12px;
          place-items: center;
          text-align: center;
        }

        .billEmptyTitle {
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .billFocusPane {
          display: grid;
          grid-template-rows: auto 1fr;
          min-height: 0;
          overflow: hidden;
        }

        .billFocusPane_empty {
          display: grid;
          place-items: center;
        }

        .billSelectPrompt {
          text-align: center;
          padding: 40px 20px;
        }

        .billSelectPromptIcon {
          width: 56px;
          height: 56px;
          margin: 0 auto 14px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
          color: var(--lcc-text-soft);
        }

        .billSelectPromptTitle {
          font-size: 16px;
          font-weight: 700;
        }

        .billSelectPromptText {
          margin-top: 6px;
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .billFocusHeader {
          padding: 16px 18px 14px;
          border-bottom: 1px solid var(--lcc-border);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .billFocusTitleRow {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .billFocusTitle {
          margin: 0;
          font-size: 21px;
          font-weight: 700;
          letter-spacing: -0.03em;
        }

        .billFocusMeta {
          margin-top: 5px;
          font-size: 12.5px;
          color: var(--lcc-text-soft);
        }

        .billFocusHeaderRight {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .billFocusScroll {
          min-height: 0;
          overflow: auto;
          padding: 14px;
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .billHeroShell {
          padding: 18px;
          border-radius: 14px;
          border: 1px solid var(--lcc-border);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)),
            rgba(255,255,255,0.025);
        }

        .billHeroTopRow {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .billHeroPrimary {
          min-width: 0;
        }

        .billHeroLabel {
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--lcc-text-soft);
        }

        .billHeroValue {
          margin-top: 8px;
          font-size: clamp(34px, 4vw, 46px);
          line-height: 1;
          font-weight: 700;
          letter-spacing: -0.05em;
        }

        .billHeroStatusRow {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .billHeroSubtext {
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .billHeroMetaStack {
          display: flex;
          align-items: flex-end;
          flex-direction: column;
          gap: 8px;
          flex-shrink: 0;
        }

        .billHeroMetaChip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 34px;
          padding: 0 11px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.04);
          color: var(--lcc-text-muted);
          font-size: 12px;
          white-space: nowrap;
        }

        .billHeroBarWrap {
          margin-top: 16px;
        }

        .billHeroMetaGrid {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .billHeroMetaCard {
          min-width: 0;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.03);
        }

        .billHeroMetaCard span {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--lcc-text-soft);
        }

        .billHeroMetaCard strong {
          display: block;
          margin-top: 5px;
          font-size: 13px;
          font-weight: 700;
          color: var(--lcc-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .billMidGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 250px;
          gap: 12px;
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
        }

        .billMetricCard {
          padding: 12px 13px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
        }

        .billMetricLabel {
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--lcc-text-soft);
        }

        .billMetricValue {
          margin-top: 6px;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .billMetricSub {
          margin-top: 4px;
          font-size: 12px;
          color: var(--lcc-text-soft);
        }

        .billDetailGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
        }

        .billDetailCard {
          padding: 11px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.04);
          background: rgba(255,255,255,0.03);
        }

        .billDetailCard_notes {
          grid-column: 1 / -1;
        }

        .billDetailLabel {
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--lcc-text-soft);
        }

        .billDetailValue {
          margin-top: 6px;
          font-size: 14px;
          font-weight: 600;
        }

        .billDetailNotes {
          margin-top: 6px;
          font-size: 14px;
          line-height: 1.55;
          color: var(--lcc-text-muted);
        }

        .billRailPane {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .billRailSection {
          padding: 13px 12px;
          border-bottom: 1px solid var(--lcc-border);
        }

        .billRailSection_fill {
          border-bottom: 0;
          flex: 1;
          overflow: auto;
        }

        .billRailLabel {
          margin-bottom: 10px;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--lcc-text-soft);
        }

        .billRailActionStack {
          display: grid;
          gap: 7px;
        }

        .billRailStatList {
          display: grid;
          gap: 7px;
        }

        .billRailStat {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 9px 10px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.04);
          background: rgba(255,255,255,0.03);
          font-size: 12px;
          color: var(--lcc-text-muted);
        }

        .billRailStat strong {
          font-size: 14px;
          color: var(--lcc-text);
        }

        .billSelectedCard {
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.03);
        }

        .billSelectedTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }

        .billSelectedName {
          min-width: 0;
          font-size: 13px;
          font-weight: 700;
          color: var(--lcc-text);
        }

        .billSelectedAmount {
          margin-bottom: 8px;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.04em;
        }

        .billSelectedMeta {
          margin-top: 8px;
          font-size: 11.5px;
          color: var(--lcc-text-soft);
        }

        .billSelectedDebt {
          margin-top: 10px;
          padding: 10px;
          border-radius: 10px;
          background: rgba(79, 142, 255, 0.07);
          border: 1px solid rgba(79, 142, 255, 0.15);
        }

        .billSelectedDebtLabel {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--lcc-blue);
        }

        .billSelectedDebtName {
          margin-top: 4px;
          font-size: 12.5px;
          font-weight: 700;
        }

        .billSelectedDebtMeta {
          margin-top: 3px;
          font-size: 11.5px;
          color: var(--lcc-text-muted);
        }

        .billHistoryList {
          display: grid;
          gap: 8px;
        }

        .billHistoryCard {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
        }

        .billHistoryLeft {
          min-width: 0;
        }

        .billHistoryAmount {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .billHistoryMeta {
          margin-top: 4px;
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .billHistoryNote {
          margin-top: 3px;
          font-size: 13px;
          color: var(--lcc-text-soft);
        }

        .billHistoryRight {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .billEmptyHistory {
          padding: 48px 18px;
          text-align: center;
          color: var(--lcc-text-muted);
          font-size: 13px;
        }

        .billPill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 24px;
          padding: 0 9px;
          border-radius: 7px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.05);
          color: var(--lcc-text-muted);
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .billPillDot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: currentColor;
          opacity: 0.95;
        }

        .toneNeutral {
          color: var(--lcc-text-muted);
          border-color: var(--lcc-border);
          background: rgba(255,255,255,0.05);
        }

        .toneBlue {
          color: var(--lcc-blue);
          border-color: rgba(79, 142, 255, 0.18);
          background: rgba(79, 142, 255, 0.10);
        }

        .toneGreen {
          color: var(--lcc-green);
          border-color: rgba(34, 199, 125, 0.18);
          background: rgba(34, 199, 125, 0.10);
        }

        .toneAmber {
          color: var(--lcc-amber);
          border-color: rgba(232, 162, 69, 0.2);
          background: rgba(232, 162, 69, 0.12);
        }

        .toneRed {
          color: var(--lcc-red);
          border-color: rgba(224, 84, 106, 0.2);
          background: rgba(224, 84, 106, 0.12);
        }

        .billProgress {
          width: 100%;
          border-radius: 999px;
          background: rgba(255,255,255,0.07);
          overflow: hidden;
        }

        .billProgressFill {
          height: 100%;
          border-radius: 999px;
          transition: width 280ms ease;
        }

        .billBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: transform 120ms ease, background 120ms ease, border-color 120ms ease, opacity 120ms ease;
        }

        .billBtn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .billBtn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .billBtn_xs {
          min-height: 30px;
          padding: 0 10px;
          font-size: 12px;
        }

        .billBtn_sm {
          min-height: 34px;
          padding: 0 12px;
          font-size: 13px;
        }

        .billBtn_md {
          min-height: 40px;
          padding: 0 15px;
          font-size: 13.5px;
        }

        .billBtn_full {
          width: 100%;
        }

        .billBtn_ghost {
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.04);
          color: var(--lcc-text-muted);
        }

        .billBtn_ghost:hover:not(:disabled) {
          color: var(--lcc-text);
          background: rgba(255,255,255,0.07);
          border-color: var(--lcc-border-strong);
        }

        .billBtn_primary {
          border: 1px solid rgba(79, 142, 255, 0.28);
          background: linear-gradient(180deg, #4f90ff, #3a7af0);
          color: #fff;
          box-shadow: 0 2px 8px rgba(58, 122, 240, 0.26);
        }

        .billBtn_primary:hover:not(:disabled) {
          background: linear-gradient(180deg, #5a99ff, #4588f7);
        }

        .billBtn_success {
          border: 1px solid rgba(34, 199, 125, 0.24);
          background: linear-gradient(180deg, rgba(34, 199, 125, 0.22), rgba(34, 199, 125, 0.14));
          color: var(--lcc-green);
        }

        .billIconBtn {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.04);
          color: var(--lcc-text-muted);
          cursor: pointer;
          transition: background 120ms ease, border-color 120ms ease;
        }

        .billIconBtn:hover:not(:disabled) {
          background: rgba(255,255,255,0.07);
          border-color: var(--lcc-border-strong);
          color: var(--lcc-text);
        }

        .billIconBtn_danger {
          color: var(--lcc-red);
          border-color: rgba(224,84,106,0.18);
          background: rgba(224,84,106,0.08);
        }

        .billIconBtn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .billField {
          display: grid;
          gap: 6px;
        }

        .billFieldLabel {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--lcc-text-soft);
        }

        .billGrid {
          display: grid;
          gap: 10px;
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

        .billStack {
          display: grid;
          gap: 12px;
        }

        .billToggleRow {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }

        .billFormBlock {
          padding: 16px;
          border-radius: 14px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
        }

        .billFormBlockTitle {
          margin-bottom: 14px;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--lcc-text-soft);
        }

        .billFormBlockBody {
          display: grid;
          gap: 12px;
        }

        .billMore {
          position: relative;
        }

        .billMenu {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          min-width: 172px;
          padding: 5px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border-strong);
          background: rgba(17, 21, 31, 0.98);
          box-shadow: var(--lcc-shadow-lg);
          z-index: 40;
        }

        .billMenuItem {
          width: 100%;
          min-height: 34px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          border-radius: 8px;
          color: var(--lcc-text-muted);
          cursor: pointer;
          font-size: 12.5px;
          font-weight: 500;
        }

        .billMenuItem:hover {
          background: rgba(255,255,255,0.05);
          color: var(--lcc-text);
        }

        .billMenuItem_danger {
          color: var(--lcc-red);
        }

        .billDivider {
          height: 1px;
          margin: 4px 0;
          background: var(--lcc-border);
        }

        .billOverlay {
          position: fixed;
          inset: 0;
          z-index: 1300;
          display: grid;
          place-items: center;
          padding: 18px;
        }

        .billOverlay_drawer {
          display: flex;
          justify-content: flex-end;
          padding: 0;
        }

        .billOverlayBackdrop {
          position: absolute;
          inset: 0;
          border: 0;
          background: rgba(8, 11, 16, 0.76);
          backdrop-filter: blur(7px);
          -webkit-backdrop-filter: blur(7px);
          cursor: pointer;
        }

        .billDrawer {
          position: relative;
          width: min(760px, 100%);
          height: 100%;
          display: grid;
          grid-template-rows: auto 1fr auto;
          background: rgba(15, 18, 27, 0.98);
          border-left: 1px solid var(--lcc-border);
          box-shadow: -24px 0 80px rgba(0,0,0,0.45);
        }

        .billDrawerHead,
        .billDrawerFoot {
          padding: 18px 20px;
          border-bottom: 1px solid var(--lcc-border);
        }

        .billDrawerFoot {
          border-bottom: 0;
          border-top: 1px solid var(--lcc-border);
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .billDrawerHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .billDrawerTitle {
          margin-top: 4px;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.03em;
        }

        .billDrawerSub {
          margin-top: 5px;
          font-size: 12.5px;
          color: var(--lcc-text-muted);
        }

        .billDrawerBody {
          overflow: auto;
          padding: 18px 20px;
          display: grid;
          gap: 14px;
          align-content: start;
        }

        .billModal {
          position: relative;
          width: min(780px, 100%);
          max-height: min(82svh, 860px);
          display: grid;
          grid-template-rows: auto 1fr auto;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid var(--lcc-border-strong);
          background: rgba(15, 18, 27, 0.98);
          box-shadow: var(--lcc-shadow-lg);
        }

        .billModalHead,
        .billModalFoot {
          padding: 15px 18px;
          border-bottom: 1px solid var(--lcc-border);
        }

        .billModalFoot {
          border-bottom: 0;
          border-top: 1px solid var(--lcc-border);
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .billModalHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .billModalTitle {
          font-size: 15px;
          font-weight: 700;
        }

        .billModalBody {
          min-height: 0;
          overflow: auto;
          padding: 18px;
        }

        .billToastStack {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 1500;
          display: grid;
          gap: 8px;
        }

        .billToast {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 12px;
          border-radius: 12px;
          font-size: 12.5px;
          font-weight: 600;
          box-shadow: var(--lcc-shadow-md);
        }

        .billToast_success {
          color: var(--lcc-green);
          border: 1px solid rgba(34, 199, 125, 0.22);
          background: rgba(10, 24, 17, 0.96);
        }

        .billToast_error {
          color: #ff8ea1;
          border: 1px solid rgba(224, 84, 106, 0.24);
          background: rgba(30, 11, 15, 0.96);
        }

        .billToastClose {
          display: grid;
          place-items: center;
          padding: 0;
          margin-left: 4px;
          color: inherit;
          cursor: pointer;
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

        @media (max-width: 1320px) {
          .billWorkspace {
            grid-template-columns: 272px minmax(0, 1fr) 224px;
          }

          .billMidGrid {
            grid-template-columns: minmax(0, 1fr) 234px;
          }

          .billHeroMetaGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 1100px) {
          .billMobileTabs {
            display: flex;
          }

          .billWorkspace {
            grid-template-columns: 1fr;
          }

          .billCol {
            display: none;
            min-height: 0;
          }

          .billCol_show {
            display: block;
          }

          .billSidebarPane,
          .billFocusPane,
          .billRailPane {
            min-height: calc(100svh - 210px);
          }

          .billRailPane {
            height: auto;
          }
        }

        @media (max-width: 860px) {
          .billSummaryStrip {
            flex-direction: column;
            align-items: flex-start;
          }

          .billSummaryLeft,
          .billSummaryRight {
            width: 100%;
          }

          .billSummaryRight {
            justify-content: flex-start;
          }

          .billMidGrid,
          .billDetailRow {
            grid-template-columns: 1fr;
          }

          .billGrid_4 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .billHeroTopRow {
            flex-direction: column;
            align-items: flex-start;
          }

          .billHeroMetaStack {
            width: 100%;
            flex-direction: row;
            flex-wrap: wrap;
            align-items: flex-start;
          }
        }

        @media (max-width: 640px) {
          .billsRoot {
            min-height: calc(100svh - 16px);
            gap: 10px;
          }

          .billSummaryStrip {
            padding: 14px;
          }

          .billSummaryMiniList {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .billFocusHeader {
            padding: 14px;
            flex-direction: column;
            align-items: stretch;
          }

          .billFocusHeaderRight {
            justify-content: flex-end;
          }

          .billFocusScroll {
            padding: 10px;
          }

          .billGrid_2,
          .billGrid_3,
          .billGrid_4,
          .billHeroMetaGrid {
            grid-template-columns: 1fr;
          }

          .billPayFoot {
            align-items: stretch;
          }

          .billAdvanceToggle {
            width: 100%;
          }

          .billHistoryCard {
            align-items: flex-start;
            flex-direction: column;
          }

          .billHistoryRight {
            width: 100%;
            justify-content: space-between;
          }

          .billToastStack {
            left: 12px;
            right: 12px;
            bottom: 12px;
          }

          .billOverlay {
            padding: 10px;
          }
        }
      `}</style>
    </>
  );
}