"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
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
  ShieldAlert,
  Target,
  Trash2,
  TrendingDown,
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

function daysUntil(iso) {
  const s = isoSerial(iso);
  if (!Number.isFinite(s)) return null;
  return s - todaySerial();
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

function dueText(days) {
  if (!Number.isFinite(days)) return "No due date";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "1 day remaining";
  return `${days} days remaining`;
}

function monthlyMinimumPayment(debt) {
  const min = safeNum(debt?.minPay, 0);
  const fallback = safeNum(debt?.amount, 0);
  return round2(min > 0 ? min : fallback);
}

function monthlyScheduledPayment(debt) {
  return round2(monthlyMinimumPayment(debt) + safeNum(debt?.extraPay, 0));
}

function monthlyInterest(balance, aprPct) {
  return round2((safeNum(balance) * safeNum(aprPct)) / 1200);
}

function amortize(balance, aprPct, payment, maxMonths = 1200) {
  let bal = safeNum(balance, 0);
  const apr = safeNum(aprPct, 0);
  const pay = safeNum(payment, 0);

  if (bal <= 0) return { months: 0, totalInterest: 0 };
  if (pay <= 0) return { months: Infinity, totalInterest: Infinity };

  const rate = apr / 100 / 12;
  let months = 0;
  let totalInterest = 0;

  while (bal > 0 && months < maxMonths) {
    const interest = rate > 0 ? bal * rate : 0;
    totalInterest += interest;
    const principal = pay - interest;

    if (principal <= 0) {
      return { months: Infinity, totalInterest: Infinity };
    }

    bal = Math.max(0, bal + interest - pay);
    months += 1;
  }

  if (months >= maxMonths) return { months: Infinity, totalInterest: Infinity };
  return { months, totalInterest: round2(totalInterest) };
}

function payoffLabel(balance, aprPct, payment) {
  const result = amortize(balance, aprPct, payment);
  if (result.months === Infinity) return "Payment too low";
  if (result.months <= 0) return "Paid off";
  if (result.months < 12) return `${result.months}mo`;
  const years = result.months / 12;
  return `${years.toFixed(years >= 2 ? 1 : 2)}yr`;
}

function strategySubtitle(strategy) {
  if (strategy === "snowball") return "Smallest balance first";
  if (strategy === "urgent") return "Soonest due first";
  return "Highest APR first";
}

function sortForStrategy(list, strategy) {
  const clone = [...list];

  if (strategy === "snowball") {
    clone.sort((a, b) => {
      const balDiff = safeNum(a.balance) - safeNum(b.balance);
      if (balDiff !== 0) return balDiff;
      const aprDiff = safeNum(b.aprPct) - safeNum(a.aprPct);
      if (aprDiff !== 0) return aprDiff;
      return compareIsoDates(a.dueDate, b.dueDate);
    });
    return clone;
  }

  if (strategy === "urgent") {
    clone.sort((a, b) => {
      const ad = Number.isFinite(daysUntil(a.dueDate)) ? daysUntil(a.dueDate) : 999999;
      const bd = Number.isFinite(daysUntil(b.dueDate)) ? daysUntil(b.dueDate) : 999999;
      const dueDiff = ad - bd;
      if (dueDiff !== 0) return dueDiff;
      const aprDiff = safeNum(b.aprPct) - safeNum(a.aprPct);
      if (aprDiff !== 0) return aprDiff;
      return safeNum(b.balance) - safeNum(a.balance);
    });
    return clone;
  }

  clone.sort((a, b) => {
    const aprDiff = safeNum(b.aprPct) - safeNum(a.aprPct);
    if (aprDiff !== 0) return aprDiff;
    const interestDiff = monthlyInterest(b.balance, b.aprPct) - monthlyInterest(a.balance, a.aprPct);
    if (interestDiff !== 0) return interestDiff;
    return safeNum(b.balance) - safeNum(a.balance);
  });

  return clone;
}

function isInvestmentAccountType(type) {
  return String(type || "").toLowerCase() === "investment";
}

function accountTypeLabel(type) {
  const v = String(type || "other").toLowerCase();
  if (v === "checking") return "Checking";
  if (v === "savings") return "Savings";
  if (v === "cash") return "Cash";
  if (v === "credit") return "Credit Card";
  if (v === "investment") return "Investment";
  return "Other";
}

function mapDebt(row) {
  return {
    id: row.id,
    name: row.name || "Debt",
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

function mapAccount(row) {
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

function buildEditor(debt, defaultAccountId = "") {
  if (!debt) {
    return {
      name: "",
      balance: "",
      aprPct: "",
      minPay: "",
      extraPay: "",
      amount: "",
      dueDate: isoDate(),
      frequency: "monthly",
      category: "",
      notes: "",
      accountId: defaultAccountId || "",
      autopay: false,
      lastPaidDate: "",
    };
  }

  return {
    name: debt.name || "",
    balance: String(debt.balance ?? ""),
    aprPct: String(debt.aprPct ?? ""),
    minPay: String(debt.minPay ?? ""),
    extraPay: String(debt.extraPay ?? ""),
    amount: String(debt.amount ?? ""),
    dueDate: debt.dueDate || isoDate(),
    frequency: debt.frequency || "monthly",
    category: debt.category || "",
    notes: debt.notes || "",
    accountId: debt.accountId || defaultAccountId || "",
    autopay: debt.autopay === true,
    lastPaidDate: debt.lastPaidDate || "",
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

const STRATEGY_OPTIONS = [
  { value: "avalanche", label: "Avalanche" },
  { value: "snowball", label: "Snowball" },
  { value: "urgent", label: "Urgent First" },
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
    <span className={`debtPill ${toneClass(tone)}`}>
      {dot ? <span className="debtPillDot" /> : null}
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
      className={`debtBtn debtBtn_${variant} debtBtn_${size} ${full ? "debtBtn_full" : ""}`}
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
      className={`debtIconBtn ${danger ? "debtIconBtn_danger" : ""}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="debtField">
      <span className="debtFieldLabel">{label}</span>
      {children}
    </label>
  );
}

function Grid({ cols = 2, children }) {
  return <div className={`debtGrid debtGrid_${cols}`}>{children}</div>;
}

function Progress({ pct, tone = "neutral", h = 5 }) {
  return (
    <div className="debtProgress" style={{ height: h }}>
      <div
        className={`debtProgressFill ${toneClass(tone)}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function MoreMenu({ debt, onEdit, onDuplicate, onToggle, onDelete, disabled = false }) {
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
    <div className="debtMore" onClick={(e) => e.stopPropagation()}>
      <IconButton onClick={() => setOpen((p) => !p)} title="More" disabled={disabled}>
        <MoreHorizontal size={14} />
      </IconButton>

      {open ? (
        <div className="debtMenu">
          <button type="button" className="debtMenuItem" onClick={() => run(onEdit)}>
            <PencilLine size={13} />
            Edit
          </button>
          <button type="button" className="debtMenuItem" onClick={() => run(onDuplicate)}>
            <Copy size={13} />
            Duplicate
          </button>
          <button type="button" className="debtMenuItem" onClick={() => run(onToggle)}>
            <ShieldAlert size={13} />
            {debt?.active ? "Archive" : "Activate"}
          </button>

          <div className="debtDivider" />

          <button type="button" className="debtMenuItem debtMenuItem_danger" onClick={() => run(onDelete)}>
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Drawer / Modal / Form Blocks
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
    <div className="debtOverlay debtOverlay_drawer">
      <button type="button" className="debtOverlayBackdrop" onClick={onClose} />
      <div className="debtDrawer">
        <div className="debtDrawerHead">
          <div>
            <div className="debtEyebrow">Debt</div>
            <div className="debtDrawerTitle">{title}</div>
            {sub ? <div className="debtDrawerSub">{sub}</div> : null}
          </div>
          <IconButton onClick={onClose} title="Close">
            <X size={14} />
          </IconButton>
        </div>

        <div className="debtDrawerBody">{children}</div>

        {footer ? <div className="debtDrawerFoot">{footer}</div> : null}
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
    <div className="debtOverlay">
      <button type="button" className="debtOverlayBackdrop" onClick={onClose} />
      <div className="debtModal">
        <div className="debtModalHead">
          <div className="debtModalTitle">{title}</div>
          <IconButton onClick={onClose} title="Close">
            <X size={14} />
          </IconButton>
        </div>

        <div className="debtModalBody">{children}</div>

        {footer ? <div className="debtModalFoot">{footer}</div> : null}
      </div>
    </div>
  );
}

function FormBlock({ title, children }) {
  return (
    <div className="debtFormBlock">
      <div className="debtFormBlockTitle">{title}</div>
      <div className="debtFormBlockBody">{children}</div>
    </div>
  );
}

function DebtDrawer({ open, mode, form, setForm, onClose, onSave, saving, accounts }) {
  const payAccounts = accounts.filter((a) => !isInvestmentAccountType(a.type));

  return (
    <Drawer
      open={open}
      title={mode === "add" ? "New Debt Profile" : "Edit Debt Profile"}
      sub={
        mode === "add"
          ? "Create a standalone payoff profile or a target that bills can link to."
          : "Update the debt profile without cluttering the main page."
      }
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            <Save size={13} />
            {saving ? "Saving…" : mode === "add" ? "Add Debt" : "Save Changes"}
          </Button>
        </>
      }
    >
      <FormBlock title="Debt Details">
        <Field label="Debt name">
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Mortgage, Capital One, Truck Loan…"
          />
        </Field>

        <Grid cols={4}>
          <Field label="Balance">
            <input
              value={form.balance}
              onChange={(e) => setForm((p) => ({ ...p, balance: e.target.value }))}
              inputMode="decimal"
              placeholder="0.00"
            />
          </Field>

          <Field label="APR %">
            <input
              value={form.aprPct}
              onChange={(e) => setForm((p) => ({ ...p, aprPct: e.target.value }))}
              inputMode="decimal"
              placeholder="0"
            />
          </Field>

          <Field label="Min pay">
            <input
              value={form.minPay}
              onChange={(e) => setForm((p) => ({ ...p, minPay: e.target.value }))}
              inputMode="decimal"
              placeholder="0.00"
            />
          </Field>

          <Field label="Extra pay">
            <input
              value={form.extraPay}
              onChange={(e) => setForm((p) => ({ ...p, extraPay: e.target.value }))}
              inputMode="decimal"
              placeholder="0.00"
            />
          </Field>
        </Grid>

        <Grid cols={4}>
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

          <Field label="Statement amount">
            <input
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              inputMode="decimal"
              placeholder="Optional"
            />
          </Field>

          <Field label="Linked account">
            <select
              value={form.accountId}
              onChange={(e) => setForm((p) => ({ ...p, accountId: e.target.value }))}
            >
              <option value="">No account</option>
              {payAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {accountTypeLabel(a.type)} · {money(a.balance)}
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
              placeholder="Housing, Auto, Credit Card…"
            />
          </Field>

          <Field label="Autopay">
            <div className="debtToggleRow">
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
        </Grid>

        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Optional notes…"
            rows={4}
          />
        </Field>
      </FormBlock>
    </Drawer>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Lists / history
   ────────────────────────────────────────────────────────────────────────── */
function DebtRow({ debt, selected, onSelect, rank, strategy, isTarget }) {
  const due = dueMeta(daysUntil(debt.dueDate));
  const plan = monthlyScheduledPayment(debt);

  return (
    <button type="button" onClick={onSelect} className={`debtRow ${selected ? "debtRow_active" : ""}`}>
      <div className={`debtRowAccent ${toneClass(due.tone)}`} />
      <div className="debtRowMain">
        <div className="debtRowTop">
          <div className="debtRowNameWrap">
            <span className="debtRowRank">#{rank}</span>
            <div className="debtRowName">{debt.name}</div>
          </div>
          <div className="debtRowAmount">{money(debt.balance)}</div>
        </div>

        <div className="debtRowMeta">
          <span className="debtRowCategory">{debt.category || "Uncategorized"}</span>
          <span className="debtRowDot">•</span>
          <span className={`debtRowStatus ${toneClass(due.tone)}`}>{due.label}</span>
          {isTarget ? (
            <>
              <span className="debtRowDot">•</span>
              <span className="debtRowAuto">Target</span>
            </>
          ) : null}
        </div>

        <div className="debtRowSubline">
          {safeNum(debt.aprPct)}% APR · {money(plan)}/mo · {strategySubtitle(strategy)}
        </div>
      </div>
    </button>
  );
}

function PaymentHistory({ payments, accountNameById, selectedDebtId }) {
  if (!payments.length) {
    return <div className="debtEmptyHistory">No synced payment history yet.</div>;
  }

  return (
    <div className="debtHistoryList">
      {payments.map((p) => {
        const sourceLabel = p.billId === selectedDebtId ? "Debt legacy" : "From bill";
        return (
          <div key={p.id} className="debtHistoryCard">
            <div className="debtHistoryLeft">
              <div className="debtHistoryAmount">{moneyTight(p.amount)}</div>
              <div className="debtHistoryMeta">
                {shortDate(p.paymentDate)}
                {p.accountId ? ` · ${accountNameById.get(p.accountId) || "Account"}` : ""}
              </div>
              {p.note ? <div className="debtHistoryNote">{p.note}</div> : null}
            </div>

            <div className="debtHistoryRight">
              <Pill tone={sourceLabel === "From bill" ? "blue" : "amber"} dot>
                {sourceLabel}
              </Pill>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LinkedBillsMini({ bills }) {
  if (!bills.length) {
    return <div className="debtMiniEmpty">No linked bills attached to this debt yet.</div>;
  }

  return (
    <div className="debtMiniList">
      {bills.map((bill) => (
        <div key={bill.id} className="debtMiniRow">
          <div className="debtMiniLeft">
            <div className="debtMiniTitle">{bill.name}</div>
            <div className="debtMiniMeta">
              {bill.category || "No category"} · {shortDate(bill.dueDate)}
            </div>
          </div>
          <div className="debtMiniAmount">{money(bill.amount)}</div>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Main content pieces
   ────────────────────────────────────────────────────────────────────────── */
function SummaryStrip({ metrics, targetDebt }) {
  return (
    <div className="debtSummaryStrip">
      <div className="debtSummaryLeft">
        <div className="debtPageTitleWrap">
          <div className="debtEyebrow">Debt</div>
          <div className="debtPageTitle">Payoff Workspace</div>
        </div>

        <div className="debtSummaryMiniList">
          <div className="debtMiniStat">
            <span className="debtMiniLabel">Active</span>
            <span className="debtMiniValue">{metrics.activeCount}</span>
          </div>
          <div className="debtMiniStat">
            <span className="debtMiniLabel">Monthly plan</span>
            <span className="debtMiniValue">{money(metrics.totalPlan)}</span>
          </div>
          <div className="debtMiniStat">
            <span className="debtMiniLabel">Paid this month</span>
            <span className="debtMiniValue textPositive">{money(metrics.paidThisMonth)}</span>
          </div>
        </div>
      </div>

      <div className="debtSummaryRight">
        <Pill tone="red" dot>
          {money(metrics.totalBalance)} total
        </Pill>
        <Pill tone="amber" dot>
          {moneyTight(metrics.monthlyBleed)}/mo interest
        </Pill>
        {targetDebt ? (
          <Pill tone="blue">
            <Target size={10} />
            {targetDebt.name}
          </Pill>
        ) : null}
      </div>
    </div>
  );
}

function Roster({
  debts,
  selectedId,
  onSelect,
  search,
  setSearch,
  scope,
  setScope,
  strategy,
  setStrategy,
  targetDebtId,
  onOpenAdd,
}) {
  return (
    <div className="debtSidebarPane">
      <div className="debtRosterHead">
        <div className="debtSearch">
          <Search size={14} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search debt…" />
          {search ? (
            <button type="button" onClick={() => setSearch("")} className="debtSearchClear" aria-label="Clear search">
              <X size={12} />
            </button>
          ) : null}
        </div>

        <div className="debtScopeTabs">
          {["active", "all", "inactive"].map((sc) => (
            <button
              key={sc}
              type="button"
              className={`debtScopeTab ${scope === sc ? "debtScopeTab_active" : ""}`}
              onClick={() => setScope(sc)}
            >
              {sc}
            </button>
          ))}
        </div>

        <div className="debtRosterMeta">
          <span>{debts.length} showing</span>
          <select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="debtRosterSort">
            {STRATEGY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="debtRosterList">
        {debts.length ? (
          debts.map((d, idx) => (
            <DebtRow
              key={d.id}
              debt={d}
              selected={d.id === selectedId}
              onSelect={() => onSelect(d.id)}
              rank={idx + 1}
              strategy={strategy}
              isTarget={targetDebtId === d.id}
            />
          ))
        ) : (
          <div className="debtEmptyState">
            <div className="debtEmptyTitle">No debt found</div>
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
  debt,
  linkedBills,
  accounts,
  payments,
  targetDebtId,
  strategy,
  simBoost,
  setSimBoost,
  onEdit,
  onDuplicate,
  onToggle,
  onDelete,
  onOpenHist,
  onCloseHist,
  histOpen,
}) {
  if (!debt) {
    return (
      <div className="debtFocusPane debtFocusPane_empty">
        <div className="debtSelectPrompt">
          <div className="debtSelectPromptIcon">
            <TrendingDown size={20} />
          </div>
          <div className="debtSelectPromptTitle">Select a debt</div>
          <div className="debtSelectPromptText">Pick one from the left to view payoff details and linked bill activity.</div>
        </div>
      </div>
    );
  }

  const due = dueMeta(daysUntil(debt.dueDate));
  const isTarget = targetDebtId === debt.id;
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const linkedAccount = accounts.find((a) => a.id === debt.accountId) || null;

  const baseMin = monthlyMinimumPayment(debt);
  const basePlan = monthlyScheduledPayment(debt);
  const interestBleed = monthlyInterest(debt.balance, debt.aprPct);

  const boost = Math.max(0, safeNum(parseMoneyInput(simBoost), 0));
  const simPayment = round2(basePlan + boost);

  const currentPlan = amortize(debt.balance, debt.aprPct, basePlan);
  const boostedPlan = amortize(debt.balance, debt.aprPct, simPayment);

  const monthsSaved =
    currentPlan.months !== Infinity && boostedPlan.months !== Infinity
      ? Math.max(0, currentPlan.months - boostedPlan.months)
      : 0;

  const interestSaved =
    currentPlan.totalInterest !== Infinity && boostedPlan.totalInterest !== Infinity
      ? Math.max(0, round2(currentPlan.totalInterest - boostedPlan.totalInterest))
      : 0;

  const paidThisMonth = payments
    .filter((payment) => monthKeyOf(payment.paymentDate) === monthKeyOf(isoDate()))
    .reduce((sum, payment) => sum + safeNum(payment.amount), 0);

  const allPaid = payments.reduce((sum, payment) => sum + safeNum(payment.amount), 0);

  return (
    <div className="debtFocusPane">
      <div className="debtFocusHeader">
        <div className="debtFocusHeaderLeft">
          <div className="debtFocusTitleRow">
            <h2 className="debtFocusTitle">{debt.name}</h2>
            <Pill tone={due.tone} dot>
              {due.label}
            </Pill>
            {isTarget ? (
              <Pill tone="blue">
                <Target size={10} />
                {STRATEGY_OPTIONS.find((s) => s.value === strategy)?.label} target
              </Pill>
            ) : null}
            {debt.autopay ? (
              <Pill tone="green">
                <Zap size={10} />
                Auto
              </Pill>
            ) : null}
            {!debt.active ? <Pill>Inactive</Pill> : null}
          </div>

          <div className="debtFocusMeta">
            {debt.category || "No category"} · {safeNum(debt.aprPct)}% APR · Updated {fmtAgo(debt.updatedAt)}
          </div>
        </div>

        <div className="debtFocusHeaderRight">
          <Button onClick={onEdit}>
            <PencilLine size={13} />
            Edit
          </Button>
          <MoreMenu debt={debt} onEdit={onEdit} onDuplicate={onDuplicate} onToggle={onToggle} onDelete={onDelete} />
        </div>
      </div>

      <div className="debtFocusScroll">
        <div className="debtHeroShell">
          <div className="debtHeroTopRow">
            <div className="debtHeroPrimary">
              <div className="debtHeroLabel">Current Balance</div>
              <div
                className={`debtHeroValue ${
                  due.tone === "red"
                    ? "textNegative"
                    : due.tone === "amber"
                    ? "textWarning"
                    : debt.balance <= 0
                    ? "textPositive"
                    : ""
                }`}
              >
                {money(debt.balance)}
              </div>

              <div className="debtHeroStatusRow">
                <Pill tone={due.tone} dot>
                  {due.label}
                </Pill>
                <span className="debtHeroSubtext">{dueText(daysUntil(debt.dueDate))}</span>
              </div>
            </div>

            <div className="debtHeroMetaStack">
              <div className="debtHeroMetaChip">
                <CalendarDays size={13} />
                {shortDate(debt.dueDate)}
              </div>
              <div className="debtHeroMetaChip">
                <TrendingDown size={13} />
                {safeNum(debt.aprPct)}% APR
              </div>
            </div>
          </div>

          <div className="debtHeroBarWrap">
            <Progress pct={due.pct} tone={due.tone} h={6} />
          </div>

          <div className="debtHeroMetaGrid">
            <div className="debtHeroMetaCard">
              <span>Plan</span>
              <strong>{money(basePlan)}/mo</strong>
            </div>
            <div className="debtHeroMetaCard">
              <span>Interest / mo</span>
              <strong>{moneyTight(interestBleed)}</strong>
            </div>
            <div className="debtHeroMetaCard">
              <span>Pay from</span>
              <strong>{accountNameById.get(debt.accountId) || "None"}</strong>
            </div>
            <div className="debtHeroMetaCard">
              <span>Payoff est.</span>
              <strong>{payoffLabel(debt.balance, debt.aprPct, basePlan)}</strong>
            </div>
          </div>
        </div>

        <div className="debtMidGrid">
          <div className="debtPanel">
            <div className="debtPanelHead">
              <div className="debtPanelTitle">Attack Simulator</div>
              <Button size="xs" onClick={onOpenHist}>
                <Receipt size={12} />
                History
              </Button>
            </div>

            <Grid cols={2}>
              <Field label="Add extra payment">
                <input
                  value={simBoost}
                  onChange={(e) => setSimBoost(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                />
              </Field>

              <Field label="Simulated payment">
                <input value={moneyTight(simPayment)} readOnly />
              </Field>
            </Grid>

            <div className="debtPresetRow">
              {[50, 100, 250, 500].map((n) => (
                <button key={n} type="button" className="debtPresetBtn" onClick={() => setSimBoost(String(n))}>
                  +{money(n)}
                </button>
              ))}
            </div>

            <div className="debtSimResultGrid">
              <div className="debtSimCard">
                <span>Minimum</span>
                <strong>{moneyTight(baseMin)}</strong>
                <small>Required baseline</small>
              </div>
              <div className="debtSimCard">
                <span>Current Plan</span>
                <strong>{moneyTight(basePlan)}</strong>
                <small>Minimum plus recurring extra</small>
              </div>
              <div className="debtSimCard">
                <span>Months Saved</span>
                <strong>{boostedPlan.months === Infinity ? "—" : monthsSaved}</strong>
                <small>Against current plan</small>
              </div>
              <div className="debtSimCard">
                <span>Interest Saved</span>
                <strong>{boostedPlan.totalInterest === Infinity ? "—" : moneyTight(interestSaved)}</strong>
                <small>Amortized estimate</small>
              </div>
            </div>
          </div>

          <div className="debtPanel debtLinkPanel">
            <div className="debtPanelHead">
              <div className="debtPanelTitle">
                <Link2 size={15} />
                Linked Bills
              </div>
              <Button
                size="xs"
                onClick={() => {
                  if (typeof window !== "undefined") window.location.href = "/bills";
                }}
              >
                Open Bills
              </Button>
            </div>

            <LinkedBillsMini bills={linkedBills} />
          </div>
        </div>

        <div className="debtDetailRow">
          <div className="debtMetricCard">
            <div className="debtMetricLabel">Paid This Month</div>
            <div className="debtMetricValue">{moneyTight(paidThisMonth)}</div>
            <div className="debtMetricSub">Synced from bill activity</div>
          </div>

          <div className="debtMetricCard">
            <div className="debtMetricLabel">All-Time Paid</div>
            <div className="debtMetricValue">{moneyTight(allPaid)}</div>
            <div className="debtMetricSub">{payments.length} payments logged</div>
          </div>

          <div className="debtMetricCard">
            <div className="debtMetricLabel">Linked Account</div>
            <div className="debtMetricValue">{linkedAccount ? linkedAccount.name : "None"}</div>
            <div className="debtMetricSub">
              {linkedAccount
                ? `${accountTypeLabel(linkedAccount.type)} · ${money(linkedAccount.balance)}`
                : "No account linked"}
            </div>
          </div>
        </div>

        <div className="debtPanel">
          <div className="debtPanelHead">
            <div className="debtPanelTitle">Debt Details</div>
          </div>

          <div className="debtDetailGrid">
            {[
              { label: "Category", value: debt.category || "—" },
              { label: "Frequency", value: FREQS.find((o) => o.value === debt.frequency)?.label || debt.frequency },
              { label: "Autopay", value: debt.autopay ? "Enabled" : "Disabled" },
              { label: "Minimum", value: moneyTight(baseMin) },
              { label: "Extra pay", value: moneyTight(safeNum(debt.extraPay)) },
              { label: "Last paid", value: shortDate(debt.lastPaidDate) },
            ].map((d) => (
              <div key={d.label} className="debtDetailCard">
                <div className="debtDetailLabel">{d.label}</div>
                <div className="debtDetailValue">{d.value}</div>
              </div>
            ))}

            {debt.notes ? (
              <div className="debtDetailCard debtDetailCard_notes">
                <div className="debtDetailLabel">Notes</div>
                <div className="debtDetailNotes">{debt.notes}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="debtPanel">
          <div className="debtPanelHead">
            <div className="debtPanelTitle">Money Flow Ownership</div>
          </div>
          <div className="debtDetailNotes">
            Bills owns payment posting. Debt reads synced history from bill activity and legacy debt-only rows,
            but this page does not post money into accounts or spending.
          </div>
        </div>
      </div>

      <Modal
        open={histOpen}
        title={`${debt.name} · History`}
        onClose={onCloseHist}
        footer={<Button onClick={onCloseHist}>Close</Button>}
      >
        <PaymentHistory payments={payments} accountNameById={accountNameById} selectedDebtId={debt.id} />
      </Modal>
    </div>
  );
}

function RightRail({ debt, targetDebtId, strategy, metrics, alerts, onOpenAdd, onOpenEdit }) {
  const due = debt ? dueMeta(daysUntil(debt.dueDate)) : null;
  const isTarget = debt && targetDebtId === debt.id;

  return (
    <div className="debtRailPane">
      <div className="debtRailSection">
        <div className="debtRailLabel">Quick Actions</div>
        <div className="debtRailActionStack">
          <Button variant="primary" size="sm" full onClick={onOpenAdd}>
            <Plus size={13} />
            New Debt
          </Button>
          <Button size="sm" full disabled={!debt} onClick={onOpenEdit}>
            <PencilLine size={13} />
            Edit Selected
          </Button>
          <Button
            size="sm"
            full
            onClick={() => {
              if (typeof window !== "undefined") window.location.href = "/bills";
            }}
          >
            <Link2 size={13} />
            Open Bills
          </Button>
        </div>
      </div>

      <div className="debtRailSection">
        <div className="debtRailLabel">Overview</div>

        <div className="debtRailStatList">
          <div className="debtRailStat">
            <span>Total balance</span>
            <strong>{money(metrics.totalBalance)}</strong>
          </div>
          <div className="debtRailStat">
            <span>Monthly plan</span>
            <strong>{money(metrics.totalPlan)}</strong>
          </div>
          <div className="debtRailStat">
            <span>Interest / mo</span>
            <strong className="textWarning">{moneyTight(metrics.monthlyBleed)}</strong>
          </div>
          <div className="debtRailStat">
            <span>Weighted APR</span>
            <strong>{metrics.weightedApr}%</strong>
          </div>
        </div>
      </div>

      {debt && due ? (
        <div className="debtRailSection">
          <div className="debtRailLabel">Selected</div>

          <div className="debtSelectedCard">
            <div className="debtSelectedTop">
              <div className="debtSelectedName">{debt.name}</div>
              <Pill tone={due.tone}>{due.label}</Pill>
            </div>

            <div className="debtSelectedAmount">{money(debt.balance)}</div>
            <Progress pct={due.pct} tone={due.tone} h={4} />

            <div className="debtSelectedMeta">
              {debt.category || "No category"} · {safeNum(debt.aprPct)}% APR
            </div>

            {isTarget ? (
              <div className="debtSelectedTarget">
                <div className="debtSelectedTargetLabel">Target</div>
                <div className="debtSelectedTargetName">
                  {STRATEGY_OPTIONS.find((s) => s.value === strategy)?.label}
                </div>
                <div className="debtSelectedTargetMeta">
                  {payoffLabel(debt.balance, debt.aprPct, monthlyScheduledPayment(debt))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="debtRailSection debtRailSection_fill">
        <div className="debtRailLabel">Pressure Alerts</div>

        <div className="debtAlertList">
          <div className="debtAlertCard">
            <div className="debtAlertTop">
              <span>Overdue</span>
              <strong>{alerts.overdue.length}</strong>
            </div>
            <small>
              {alerts.overdue.length ? alerts.overdue.slice(0, 2).map((d) => d.name).join(", ") : "No overdue debt"}
            </small>
          </div>

          <div className="debtAlertCard">
            <div className="debtAlertTop">
              <span>High APR</span>
              <strong>{alerts.highApr.length}</strong>
            </div>
            <small>
              {alerts.highApr.length ? alerts.highApr.slice(0, 2).map((d) => d.name).join(", ") : "No 20%+ APR debt"}
            </small>
          </div>

          <div className="debtAlertCard">
            <div className="debtAlertTop">
              <span>Underwater</span>
              <strong>{alerts.lowPayment.length}</strong>
            </div>
            <small>
              {alerts.lowPayment.length ? "At least one plan is not beating interest" : "All active plans beat interest"}
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toast({ error, status, onClearError }) {
  if (!error && !status) return null;

  return (
    <div className="debtToastStack">
      {status ? (
        <div className="debtToast debtToast_success">
          <CheckCircle2 size={14} />
          {status}
        </div>
      ) : null}

      {error ? (
        <div className="debtToast debtToast_error">
          <AlertCircle size={14} />
          {error}
          <button type="button" onClick={onClearError} className="debtToastClose" aria-label="Dismiss">
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
export default function DebtPage() {
  const [debts, setDebts] = useState([]);
  const [linkedBills, setLinkedBills] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [defaultAccountId, setDefaultAccountId] = useState("");

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState(null);

  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("active");
  const [strategy, setStrategy] = useState("avalanche");
  const [mobileSection, setMobileSection] = useState("focus");

  const [savingSelected, setSavingSelected] = useState(false);
  const [addingBusy, setAddingBusy] = useState(false);
  const [drawerMode, setDrawerMode] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [editor, setEditor] = useState(buildEditor(null, ""));
  const [addForm, setAddForm] = useState(buildEditor(null, ""));
  const [simBoost, setSimBoost] = useState("100");

  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(""), 3200);
    return () => clearTimeout(id);
  }, [status]);

  const refreshPage = useCallback(async (preferredDebtId = "") => {
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
        setDebts([]);
        setLinkedBills([]);
        setAccounts([]);
        setPayments([]);
        setSelectedDebtId("");
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const [debtsRes, linkedBillsRes, accountsRes, settingsRes, paymentsRes] = await Promise.all([
        supabase
          .from("bills")
          .select("*")
          .eq("user_id", user.id)
          .eq("type", "controllable")
          .order("name", { ascending: true }),
        supabase
          .from("bills")
          .select("*")
          .eq("user_id", user.id)
          .eq("type", "noncontrollable")
          .not("linked_debt_id", "is", null)
          .order("due_date", { ascending: true }),
        supabase
          .from("accounts")
          .select("*")
          .eq("user_id", user.id)
          .order("name", { ascending: true }),
        supabase
          .from("account_settings")
          .select("primary_account_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("bill_payments")
          .select("*")
          .eq("user_id", user.id)
          .order("payment_date", { ascending: false }),
      ]);

      if (debtsRes.error) throw debtsRes.error;
      if (linkedBillsRes.error) throw linkedBillsRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const loadedDebts = (debtsRes.data || []).map(mapDebt);
      const loadedLinkedBills = (linkedBillsRes.data || []).map(mapDebt);
      const loadedAccounts = (accountsRes.data || []).map(mapAccount);
      const primaryAccountId = settingsRes.data?.primary_account_id || loadedAccounts[0]?.id || "";

      setDebts(loadedDebts);
      setLinkedBills(loadedLinkedBills);
      setAccounts(loadedAccounts);
      setPayments((paymentsRes.data || []).map(mapPayment));
      setDefaultAccountId(primaryAccountId);

      setSelectedDebtId((prev) => {
        if (preferredDebtId && loadedDebts.some((d) => d.id === preferredDebtId)) return preferredDebtId;
        if (prev && loadedDebts.some((d) => d.id === prev)) return prev;
        return loadedDebts[0]?.id || "";
      });

      setAddForm((prev) => ({
        ...prev,
        accountId: prev.accountId || primaryAccountId,
      }));
    } catch (err) {
      setPageError(err?.message || "Failed to load debt.");
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

  const activeDebts = useMemo(() => debts.filter((d) => d.active), [debts]);

  const visibleDebts = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = debts.filter((debt) => {
      if (scope === "active" && !debt.active) return false;
      if (scope === "inactive" && debt.active) return false;
      if (!q) return true;
      return [debt.name, debt.category, debt.notes].join(" ").toLowerCase().includes(q);
    });

    return sortForStrategy(filtered, strategy);
  }, [debts, scope, search, strategy]);

  useEffect(() => {
    if (!visibleDebts.length) {
      setSelectedDebtId("");
      return;
    }
    if (!visibleDebts.some((d) => d.id === selectedDebtId)) {
      setSelectedDebtId(visibleDebts[0].id);
    }
  }, [visibleDebts, selectedDebtId]);

  const selectedDebt = debts.find((d) => d.id === selectedDebtId) || visibleDebts[0] || null;

  const targetDebt = useMemo(() => {
    const candidates = activeDebts.filter((d) => safeNum(d.balance) > 0);
    return sortForStrategy(candidates, strategy)[0] || null;
  }, [activeDebts, strategy]);

  const selectedLinkedBills = useMemo(() => {
    if (!selectedDebt) return [];
    return linkedBills.filter((bill) => bill.linkedDebtId === selectedDebt.id);
  }, [linkedBills, selectedDebt]);

  const selectedPayments = useMemo(() => {
    if (!selectedDebt) return [];
    return payments
      .filter((p) => p.billId === selectedDebt.id || p.linkedDebtId === selectedDebt.id)
      .sort(
        (a, b) =>
          compareIsoDates(b.paymentDate, a.paymentDate) ||
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
  }, [payments, selectedDebt]);

  useEffect(() => {
    if (!selectedDebt) {
      setEditor(buildEditor(null, defaultAccountId));
      setSimBoost("100");
      return;
    }
    setEditor(buildEditor(selectedDebt, defaultAccountId));
    setSimBoost(String(Math.max(0, safeNum(selectedDebt.extraPay, 0) || 100)));
  }, [selectedDebt, defaultAccountId]);

  useEffect(() => {
    if (selectedDebtId) setMobileSection("focus");
  }, [selectedDebtId]);

  useEffect(() => {
    setHistoryOpen(false);
  }, [selectedDebtId]);

  const metrics = useMemo(() => {
    const mk = monthKeyOf(isoDate());

    const totalBalance = activeDebts.reduce((sum, debt) => sum + safeNum(debt.balance), 0);
    const totalMinimum = activeDebts.reduce((sum, debt) => sum + monthlyMinimumPayment(debt), 0);
    const totalPlan = activeDebts.reduce((sum, debt) => sum + monthlyScheduledPayment(debt), 0);
    const monthlyBleed = activeDebts.reduce((sum, debt) => sum + monthlyInterest(debt.balance, debt.aprPct), 0);
    const weightedApr =
      totalBalance > 0
        ? round2(
            activeDebts.reduce((sum, debt) => sum + safeNum(debt.balance) * safeNum(debt.aprPct), 0) / totalBalance
          )
        : 0;
    const dueSoonCount = activeDebts.filter((debt) => {
      const d = daysUntil(debt.dueDate);
      return Number.isFinite(d) && d >= 0 && d <= 7;
    }).length;
    const paidThisMonth = payments
      .filter((payment) => monthKeyOf(payment.paymentDate) === mk)
      .reduce((sum, payment) => sum + safeNum(payment.amount), 0);

    return {
      activeCount: activeDebts.length,
      totalBalance,
      totalMinimum,
      totalPlan,
      monthlyBleed,
      weightedApr,
      dueSoonCount,
      paidThisMonth,
    };
  }, [activeDebts, payments]);

  const alerts = useMemo(() => {
    const overdue = activeDebts.filter((d) => {
      const days = daysUntil(d.dueDate);
      return Number.isFinite(days) && days < 0;
    });
    const highApr = activeDebts.filter((d) => safeNum(d.aprPct) >= 20);
    const lowPayment = activeDebts.filter((d) => {
      const plan = monthlyScheduledPayment(d);
      return amortize(d.balance, d.aprPct, plan).months === Infinity;
    });

    return { overdue, highApr, lowPayment };
  }, [activeDebts]);

  function openAdd() {
    setHistoryOpen(false);
    setAddForm(buildEditor(null, defaultAccountId));
    setDrawerMode("add");
  }

  function openEdit() {
    if (!selectedDebt) return;
    setHistoryOpen(false);
    setEditor(buildEditor(selectedDebt, defaultAccountId));
    setDrawerMode("edit");
  }

  async function addDebt() {
    if (!supabase || !userId || addingBusy) return;

    const name = String(addForm.name || "").trim();
    const balance = parseMoneyInput(addForm.balance);
    const aprPct = parseMoneyInput(addForm.aprPct || "0");
    const minPay = parseMoneyInput(addForm.minPay || "0");
    const extraPay = parseMoneyInput(addForm.extraPay || "0");
    const amount = parseMoneyInput(addForm.amount || addForm.minPay || "0");

    if (!name) return setPageError("Debt name required.");
    if (!Number.isFinite(balance) || balance < 0) return setPageError("Balance must be 0 or greater.");
    if (!Number.isFinite(minPay) || minPay < 0) return setPageError("Minimum payment must be 0 or greater.");
    if (!Number.isFinite(extraPay) || extraPay < 0) return setPageError("Extra payment must be 0 or greater.");

    setAddingBusy(true);
    setPageError("");

    const res = await supabase
      .from("bills")
      .insert({
        id: uid(),
        user_id: userId,
        name,
        type: "controllable",
        frequency: addForm.frequency || "monthly",
        due_date: addForm.dueDate || null,
        amount: round2(Number.isFinite(amount) ? amount : 0),
        active: true,
        balance: round2(balance),
        min_pay: round2(minPay),
        extra_pay: round2(extraPay),
        apr_pct: round2(Number.isFinite(aprPct) ? aprPct : 0),
        autopay: addForm.autopay === true,
        category: addForm.category || "",
        notes: addForm.notes || "",
        account_id: addForm.accountId || null,
        linked_debt_id: null,
        last_paid_date: addForm.lastPaidDate || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (res.error) {
      setPageError(res.error.message || "Could not add debt.");
      setAddingBusy(false);
      return;
    }

    const saved = mapDebt(res.data);
    setDrawerMode(null);
    setAddForm(buildEditor(null, defaultAccountId));
    setStatus("Debt profile added.");
    setAddingBusy(false);
    await refreshPage(saved.id);
  }

  async function saveDebt() {
    if (!supabase || !userId || !selectedDebt || savingSelected) return;

    const name = String(editor.name || "").trim();
    const balance = parseMoneyInput(editor.balance);
    const aprPct = parseMoneyInput(editor.aprPct || "0");
    const minPay = parseMoneyInput(editor.minPay || "0");
    const extraPay = parseMoneyInput(editor.extraPay || "0");
    const amount = parseMoneyInput(editor.amount || "0");

    if (!name) return setPageError("Debt name required.");
    if (!Number.isFinite(balance) || balance < 0) return setPageError("Balance must be 0 or greater.");
    if (!Number.isFinite(minPay) || minPay < 0) return setPageError("Minimum payment must be 0 or greater.");
    if (!Number.isFinite(extraPay) || extraPay < 0) return setPageError("Extra payment must be 0 or greater.");

    setSavingSelected(true);
    setPageError("");

    const res = await supabase
      .from("bills")
      .update({
        name,
        frequency: editor.frequency || "monthly",
        due_date: editor.dueDate || null,
        amount: round2(Number.isFinite(amount) ? amount : 0),
        balance: round2(balance),
        min_pay: round2(minPay),
        extra_pay: round2(extraPay),
        apr_pct: round2(Number.isFinite(aprPct) ? aprPct : 0),
        autopay: editor.autopay === true,
        category: editor.category || "",
        notes: editor.notes || "",
        account_id: editor.accountId || null,
        last_paid_date: editor.lastPaidDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedDebt.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (res.error) {
      setPageError(res.error.message || "Could not save debt.");
      setSavingSelected(false);
      return;
    }

    setSavingSelected(false);
    setDrawerMode(null);
    setStatus("Debt profile saved.");
    await refreshPage(selectedDebt.id);
  }

  async function duplicateDebt(debt) {
    if (!supabase || !userId) return;
    setPageError("");

    const res = await supabase
      .from("bills")
      .insert({
        id: uid(),
        user_id: userId,
        name: `${debt.name || "Debt"} Copy`,
        type: "controllable",
        frequency: debt.frequency || "monthly",
        due_date: debt.dueDate || null,
        amount: round2(debt.amount),
        active: debt.active !== false,
        balance: round2(debt.balance),
        min_pay: round2(debt.minPay),
        extra_pay: round2(debt.extraPay),
        apr_pct: round2(debt.aprPct),
        autopay: debt.autopay === true,
        category: debt.category || "",
        notes: debt.notes || "",
        account_id: debt.accountId || null,
        linked_debt_id: null,
        last_paid_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (res.error) return setPageError(res.error.message || "Could not duplicate.");

    const saved = mapDebt(res.data);
    setStatus("Debt duplicated.");
    await refreshPage(saved.id);
  }

  async function toggleActive(debt) {
    if (!supabase || !userId) return;
    setPageError("");

    const res = await supabase
      .from("bills")
      .update({
        active: !debt.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", debt.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (res.error) return setPageError(res.error.message || "Could not update.");

    setStatus(debt.active ? "Debt archived." : "Debt activated.");
    await refreshPage(debt.id);
  }

  async function deleteDebt() {
    if (!supabase || !userId || !selectedDebt || savingSelected) return;

    const ok =
      typeof window === "undefined"
        ? true
        : window.confirm(
            `Delete ${selectedDebt.name || "this debt"}?\n\nThis will unlink bills attached to it and remove debt-only history rows.`
          );

    if (!ok) return;

    setSavingSelected(true);
    setPageError("");

    try {
      const { error: unlinkBillsError } = await supabase
        .from("bills")
        .update({ linked_debt_id: null, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("linked_debt_id", selectedDebt.id);
      if (unlinkBillsError) throw unlinkBillsError;

      const { error: unlinkPaymentRefsError } = await supabase
        .from("bill_payments")
        .update({ linked_debt_id: null })
        .eq("user_id", userId)
        .eq("linked_debt_id", selectedDebt.id);
      if (unlinkPaymentRefsError) throw unlinkPaymentRefsError;

      const { error: deleteDebtPaymentsError } = await supabase
        .from("bill_payments")
        .delete()
        .eq("user_id", userId)
        .eq("bill_id", selectedDebt.id);
      if (deleteDebtPaymentsError) throw deleteDebtPaymentsError;

      const { error: deleteDebtError } = await supabase
        .from("bills")
        .delete()
        .eq("user_id", userId)
        .eq("id", selectedDebt.id)
        .eq("type", "controllable");
      if (deleteDebtError) throw deleteDebtError;

      setDrawerMode(null);
      setStatus("Debt deleted.");
      await refreshPage();
    } catch (err) {
      setPageError(err?.message || "Could not delete debt.");
      await refreshPage(selectedDebt.id);
    } finally {
      setSavingSelected(false);
    }
  }

  if (loading) {
    return <div className="debtGate">Loading debt…</div>;
  }

  if (!userId) {
    return <div className="debtGate">Sign in to view your debt.</div>;
  }

  return (
    <>
      <div className="debtsRoot">
        <SummaryStrip metrics={metrics} targetDebt={targetDebt} />

        <div className="debtMobileTabs">
          {[
            { v: "list", l: "Debt" },
            { v: "focus", l: "Detail" },
            { v: "tools", l: "Tools" },
          ].map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => setMobileSection(s.v)}
              className={`debtMobileTab ${mobileSection === s.v ? "debtMobileTab_active" : ""}`}
            >
              {s.l}
            </button>
          ))}
        </div>

        <div className="debtWorkspace">
          <section className={`debtCol debtCol_roster ${mobileSection === "list" ? "debtCol_show" : ""}`}>
            <Roster
              debts={visibleDebts}
              selectedId={selectedDebt?.id || ""}
              onSelect={(id) => {
                setSelectedDebtId(id);
                setMobileSection("focus");
              }}
              search={search}
              setSearch={setSearch}
              scope={scope}
              setScope={setScope}
              strategy={strategy}
              setStrategy={setStrategy}
              targetDebtId={targetDebt?.id || ""}
              onOpenAdd={openAdd}
            />
          </section>

          <section className={`debtCol debtCol_focus ${mobileSection === "focus" ? "debtCol_show" : ""}`}>
            <FocusPanel
              debt={selectedDebt}
              linkedBills={selectedLinkedBills}
              accounts={accounts}
              payments={selectedPayments}
              targetDebtId={targetDebt?.id || ""}
              strategy={strategy}
              simBoost={simBoost}
              setSimBoost={setSimBoost}
              onEdit={openEdit}
              onDuplicate={() => selectedDebt && duplicateDebt(selectedDebt)}
              onToggle={() => selectedDebt && toggleActive(selectedDebt)}
              onDelete={deleteDebt}
              onOpenHist={() => setHistoryOpen(true)}
              onCloseHist={() => setHistoryOpen(false)}
              histOpen={historyOpen}
            />
          </section>

          <section className={`debtCol debtCol_rail ${mobileSection === "tools" ? "debtCol_show" : ""}`}>
            <RightRail
              debt={selectedDebt}
              targetDebtId={targetDebt?.id || ""}
              strategy={strategy}
              metrics={metrics}
              alerts={alerts}
              onOpenAdd={openAdd}
              onOpenEdit={openEdit}
            />
          </section>
        </div>
      </div>

      <DebtDrawer
        open={drawerMode === "edit"}
        mode="edit"
        form={editor}
        setForm={setEditor}
        onClose={() => setDrawerMode(null)}
        onSave={saveDebt}
        saving={savingSelected}
        accounts={accounts}
      />

      <DebtDrawer
        open={drawerMode === "add"}
        mode="add"
        form={addForm}
        setForm={setAddForm}
        onClose={() => setDrawerMode(null)}
        onSave={addDebt}
        saving={addingBusy}
        accounts={accounts}
      />

      <Toast error={pageError} status={status} onClearError={() => setPageError("")} />

      <style jsx global>{`
        .debtsRoot {
          min-height: calc(100svh - 24px);
          display: grid;
          grid-template-rows: auto auto 1fr;
          gap: 12px;
          color: var(--lcc-text);
        }

        .debtGate {
          min-height: 60svh;
          display: grid;
          place-items: center;
          color: var(--lcc-text-muted);
        }

        .debtSummaryStrip {
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

        .debtSummaryLeft {
          display: flex;
          align-items: center;
          gap: 18px;
          min-width: 0;
        }

        .debtPageTitleWrap {
          min-width: 0;
        }

        .debtEyebrow {
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--lcc-text-soft);
        }

        .debtPageTitle {
          margin-top: 4px;
          font-size: clamp(24px, 2.4vw, 32px);
          line-height: 1;
          font-weight: 700;
          letter-spacing: -0.04em;
        }

        .debtSummaryMiniList {
          display: flex;
          align-items: stretch;
          gap: 10px;
          flex-wrap: wrap;
        }

        .debtMiniStat {
          min-width: 110px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
        }

        .debtMiniLabel {
          display: block;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--lcc-text-soft);
        }

        .debtMiniValue {
          display: block;
          margin-top: 5px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .debtSummaryRight {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .debtMobileTabs {
          display: none;
          border-radius: var(--lcc-radius-md);
          border: 1px solid var(--lcc-border);
          background: rgba(18, 22, 32, 0.78);
          overflow: hidden;
        }

        .debtMobileTab {
          flex: 1;
          min-height: 42px;
          border: 0;
          background: transparent;
          color: var(--lcc-text-soft);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .debtMobileTab_active {
          background: rgba(79, 142, 255, 0.10);
          color: var(--lcc-blue);
          box-shadow: inset 0 -2px 0 var(--lcc-blue);
        }

        .debtWorkspace {
          min-height: 0;
          display: grid;
          grid-template-columns: 290px minmax(0, 1fr) 240px;
          gap: 12px;
          flex: 1;
        }

        .debtCol {
          min-height: 0;
          min-width: 0;
        }

        .debtSidebarPane,
        .debtFocusPane,
        .debtRailPane {
          height: 100%;
          min-height: 0;
          border-radius: var(--lcc-radius-lg);
          border: 1px solid var(--lcc-border);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0) 48px),
            rgba(18, 22, 32, 0.88);
          box-shadow: var(--lcc-shadow-sm);
        }

        .debtSidebarPane {
          display: grid;
          grid-template-rows: auto 1fr;
          overflow: hidden;
        }

        .debtRosterHead {
          padding: 12px;
          border-bottom: 1px solid var(--lcc-border);
          display: grid;
          gap: 10px;
        }

        .debtSearch {
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

        .debtSearch input,
        .debtSearch input:focus {
          border: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          padding: 0 !important;
          min-height: auto !important;
        }

        .debtSearchClear {
          display: grid;
          place-items: center;
          padding: 0;
          color: var(--lcc-text-soft);
          cursor: pointer;
          flex-shrink: 0;
        }

        .debtScopeTabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }

        .debtScopeTab {
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

        .debtScopeTab_active {
          background: rgba(79, 142, 255, 0.10);
          border-color: rgba(79, 142, 255, 0.28);
          color: var(--lcc-blue);
        }

        .debtRosterMeta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 11px;
          color: var(--lcc-text-soft);
        }

        .debtRosterSort,
        .debtRosterSort:focus {
          width: auto;
          padding: 0;
          border: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          color: var(--lcc-text-soft);
          cursor: pointer;
        }

        .debtRosterList {
          min-height: 0;
          overflow: auto;
          padding: 4px 0;
        }

        .debtRow {
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

        .debtRow:hover {
          background: rgba(255,255,255,0.03);
        }

        .debtRow_active {
          background: rgba(79, 142, 255, 0.08);
        }

        .debtRowAccent {
          width: 2px;
          align-self: stretch;
          border-radius: 999px;
          background: transparent;
          flex-shrink: 0;
          opacity: 0;
        }

        .debtRow_active .debtRowAccent {
          opacity: 1;
        }

        .debtRowMain {
          flex: 1;
          min-width: 0;
        }

        .debtRowTop {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }

        .debtRowNameWrap {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .debtRowRank {
          font-size: 11px;
          font-weight: 700;
          color: var(--lcc-text-soft);
          flex-shrink: 0;
        }

        .debtRowName {
          min-width: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--lcc-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .debtRowAmount {
          flex-shrink: 0;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--lcc-text);
        }

        .debtRowMeta {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 4px;
          font-size: 12px;
          min-width: 0;
          flex-wrap: wrap;
        }

        .debtRowCategory {
          color: var(--lcc-text-muted);
        }

        .debtRowDot {
          color: var(--lcc-text-dim);
        }

        .debtRowStatus {
          font-weight: 600;
        }

        .debtRowAuto {
          color: var(--lcc-blue);
          font-weight: 600;
        }

        .debtRowSubline {
          margin-top: 4px;
          font-size: 11.5px;
          color: var(--lcc-text-soft);
        }

        .debtEmptyState {
          padding: 28px 18px;
          display: grid;
          gap: 12px;
          place-items: center;
          text-align: center;
        }

        .debtEmptyTitle {
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .debtFocusPane {
          display: grid;
          grid-template-rows: auto 1fr;
          min-height: 0;
          overflow: hidden;
        }

        .debtFocusPane_empty {
          display: grid;
          place-items: center;
        }

        .debtSelectPrompt {
          text-align: center;
          padding: 40px 20px;
        }

        .debtSelectPromptIcon {
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

        .debtSelectPromptTitle {
          font-size: 16px;
          font-weight: 700;
        }

        .debtSelectPromptText {
          margin-top: 6px;
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .debtFocusHeader {
          padding: 16px 18px 14px;
          border-bottom: 1px solid var(--lcc-border);
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .debtFocusTitleRow {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .debtFocusTitle {
          margin: 0;
          font-size: 21px;
          font-weight: 700;
          letter-spacing: -0.03em;
        }

        .debtFocusMeta {
          margin-top: 5px;
          font-size: 12.5px;
          color: var(--lcc-text-soft);
        }

        .debtFocusHeaderRight {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .debtFocusScroll {
          min-height: 0;
          overflow: auto;
          padding: 14px;
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .debtHeroShell {
          padding: 18px;
          border-radius: 14px;
          border: 1px solid var(--lcc-border);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)),
            rgba(255,255,255,0.025);
        }

        .debtHeroTopRow {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .debtHeroPrimary {
          min-width: 0;
        }

        .debtHeroLabel {
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--lcc-text-soft);
        }

        .debtHeroValue {
          margin-top: 8px;
          font-size: clamp(34px, 4vw, 46px);
          line-height: 1;
          font-weight: 700;
          letter-spacing: -0.05em;
        }

        .debtHeroStatusRow {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .debtHeroSubtext {
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .debtHeroMetaStack {
          display: flex;
          align-items: flex-end;
          flex-direction: column;
          gap: 8px;
          flex-shrink: 0;
        }

        .debtHeroMetaChip {
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

        .debtHeroBarWrap {
          margin-top: 16px;
        }

        .debtHeroMetaGrid {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .debtHeroMetaCard {
          min-width: 0;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.03);
        }

        .debtHeroMetaCard span {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--lcc-text-soft);
        }

        .debtHeroMetaCard strong {
          display: block;
          margin-top: 5px;
          font-size: 13px;
          font-weight: 700;
          color: var(--lcc-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .debtMidGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 280px;
          gap: 12px;
        }

        .debtPanel {
          padding: 15px 16px;
          border-radius: 14px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
        }

        .debtPanelHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 14px;
        }

        .debtPanelTitle {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .debtPresetRow {
          margin-top: 12px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .debtPresetBtn {
          min-height: 30px;
          padding: 0 10px;
          border-radius: 10px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.04);
          color: var(--lcc-text);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .debtPresetBtn:hover {
          background: rgba(255,255,255,0.07);
        }

        .debtSimResultGrid {
          margin-top: 12px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .debtSimCard {
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.03);
        }

        .debtSimCard span {
          display: block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--lcc-text-soft);
        }

        .debtSimCard strong {
          display: block;
          margin-top: 6px;
          font-size: 16px;
          font-weight: 700;
        }

        .debtSimCard small {
          display: block;
          margin-top: 4px;
          font-size: 11.5px;
          color: var(--lcc-text-muted);
          line-height: 1.45;
        }

        .debtLinkPanel {
          display: flex;
          flex-direction: column;
        }

        .debtMiniList {
          display: grid;
          gap: 8px;
        }

        .debtMiniRow {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 11px;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.04);
        }

        .debtMiniLeft {
          min-width: 0;
        }

        .debtMiniTitle {
          font-size: 13px;
          font-weight: 600;
          color: var(--lcc-text);
        }

        .debtMiniMeta {
          margin-top: 4px;
          font-size: 12px;
          color: var(--lcc-text-muted);
        }

        .debtMiniAmount {
          font-size: 13px;
          font-weight: 700;
          color: var(--lcc-text);
          white-space: nowrap;
        }

        .debtMiniEmpty {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
          font-size: 13px;
          color: var(--lcc-text-muted);
          line-height: 1.55;
        }

        .debtDetailRow {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .debtMetricCard {
          padding: 12px 13px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
        }

        .debtMetricLabel {
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--lcc-text-soft);
        }

        .debtMetricValue {
          margin-top: 6px;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .debtMetricSub {
          margin-top: 4px;
          font-size: 12px;
          color: var(--lcc-text-soft);
        }

        .debtDetailGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
        }

        .debtDetailCard {
          padding: 11px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.04);
          background: rgba(255,255,255,0.03);
        }

        .debtDetailCard_notes {
          grid-column: 1 / -1;
        }

        .debtDetailLabel {
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--lcc-text-soft);
        }

        .debtDetailValue {
          margin-top: 6px;
          font-size: 14px;
          font-weight: 600;
        }

        .debtDetailNotes {
          margin-top: 6px;
          font-size: 14px;
          line-height: 1.55;
          color: var(--lcc-text-muted);
        }

        .debtRailPane {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .debtRailSection {
          padding: 13px 12px;
          border-bottom: 1px solid var(--lcc-border);
        }

        .debtRailSection_fill {
          border-bottom: 0;
          flex: 1;
          overflow: auto;
        }

        .debtRailLabel {
          margin-bottom: 10px;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--lcc-text-soft);
        }

        .debtRailActionStack {
          display: grid;
          gap: 7px;
        }

        .debtRailStatList {
          display: grid;
          gap: 7px;
        }

        .debtRailStat {
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

        .debtRailStat strong {
          font-size: 14px;
          color: var(--lcc-text);
        }

        .debtSelectedCard {
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.03);
        }

        .debtSelectedTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }

        .debtSelectedName {
          min-width: 0;
          font-size: 13px;
          font-weight: 700;
          color: var(--lcc-text);
        }

        .debtSelectedAmount {
          margin-bottom: 8px;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.04em;
        }

        .debtSelectedMeta {
          margin-top: 8px;
          font-size: 11.5px;
          color: var(--lcc-text-soft);
        }

        .debtSelectedTarget {
          margin-top: 10px;
          padding: 10px;
          border-radius: 10px;
          background: rgba(79, 142, 255, 0.07);
          border: 1px solid rgba(79, 142, 255, 0.15);
        }

        .debtSelectedTargetLabel {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--lcc-blue);
        }

        .debtSelectedTargetName {
          margin-top: 4px;
          font-size: 12.5px;
          font-weight: 700;
        }

        .debtSelectedTargetMeta {
          margin-top: 3px;
          font-size: 11.5px;
          color: var(--lcc-text-muted);
        }

        .debtAlertList {
          display: grid;
          gap: 8px;
        }

        .debtAlertCard {
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.04);
          background: rgba(255,255,255,0.03);
        }

        .debtAlertTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .debtAlertTop span {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--lcc-text-soft);
        }

        .debtAlertTop strong {
          font-size: 15px;
          font-weight: 700;
        }

        .debtAlertCard small {
          display: block;
          margin-top: 5px;
          font-size: 11.5px;
          color: var(--lcc-text-muted);
          line-height: 1.45;
        }

        .debtHistoryList {
          display: grid;
          gap: 8px;
        }

        .debtHistoryCard {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
        }

        .debtHistoryLeft {
          min-width: 0;
        }

        .debtHistoryAmount {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .debtHistoryMeta {
          margin-top: 4px;
          font-size: 13px;
          color: var(--lcc-text-muted);
        }

        .debtHistoryNote {
          margin-top: 3px;
          font-size: 13px;
          color: var(--lcc-text-soft);
        }

        .debtHistoryRight {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .debtEmptyHistory {
          padding: 48px 18px;
          text-align: center;
          color: var(--lcc-text-muted);
          font-size: 13px;
        }

        .debtPill {
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

        .debtPillDot {
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

        .debtProgress {
          width: 100%;
          border-radius: 999px;
          background: rgba(255,255,255,0.07);
          overflow: hidden;
        }

        .debtProgressFill {
          height: 100%;
          border-radius: 999px;
          transition: width 280ms ease;
        }

        .debtBtn {
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

        .debtBtn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .debtBtn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .debtBtn_xs {
          min-height: 30px;
          padding: 0 10px;
          font-size: 12px;
        }

        .debtBtn_sm {
          min-height: 34px;
          padding: 0 12px;
          font-size: 13px;
        }

        .debtBtn_md {
          min-height: 40px;
          padding: 0 15px;
          font-size: 13.5px;
        }

        .debtBtn_full {
          width: 100%;
        }

        .debtBtn_ghost {
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.04);
          color: var(--lcc-text-muted);
        }

        .debtBtn_ghost:hover:not(:disabled) {
          color: var(--lcc-text);
          background: rgba(255,255,255,0.07);
          border-color: var(--lcc-border-strong);
        }

        .debtBtn_primary {
          border: 1px solid rgba(79, 142, 255, 0.28);
          background: linear-gradient(180deg, #4f90ff, #3a7af0);
          color: #fff;
          box-shadow: 0 2px 8px rgba(58, 122, 240, 0.26);
        }

        .debtBtn_primary:hover:not(:disabled) {
          background: linear-gradient(180deg, #5a99ff, #4588f7);
        }

        .debtBtn_success {
          border: 1px solid rgba(34, 199, 125, 0.24);
          background: linear-gradient(180deg, rgba(34, 199, 125, 0.22), rgba(34, 199, 125, 0.14));
          color: var(--lcc-green);
        }

        .debtIconBtn {
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

        .debtIconBtn:hover:not(:disabled) {
          background: rgba(255,255,255,0.07);
          border-color: var(--lcc-border-strong);
          color: var(--lcc-text);
        }

        .debtIconBtn_danger {
          color: var(--lcc-red);
          border-color: rgba(224,84,106,0.18);
          background: rgba(224,84,106,0.08);
        }

        .debtIconBtn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .debtField {
          display: grid;
          gap: 6px;
        }

        .debtFieldLabel {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--lcc-text-soft);
        }

        .debtGrid {
          display: grid;
          gap: 10px;
        }

        .debtGrid_1 {
          grid-template-columns: 1fr;
        }

        .debtGrid_2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .debtGrid_3 {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .debtGrid_4 {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .debtToggleRow {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }

        .debtFormBlock {
          padding: 16px;
          border-radius: 14px;
          border: 1px solid var(--lcc-border);
          background: rgba(255,255,255,0.03);
        }

        .debtFormBlockTitle {
          margin-bottom: 14px;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--lcc-text-soft);
        }

        .debtFormBlockBody {
          display: grid;
          gap: 12px;
        }

        .debtMore {
          position: relative;
        }

        .debtMenu {
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

        .debtMenuItem {
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

        .debtMenuItem:hover {
          background: rgba(255,255,255,0.05);
          color: var(--lcc-text);
        }

        .debtMenuItem_danger {
          color: var(--lcc-red);
        }

        .debtDivider {
          height: 1px;
          margin: 4px 0;
          background: var(--lcc-border);
        }

        .debtOverlay {
          position: fixed;
          inset: 0;
          z-index: 1300;
          display: grid;
          place-items: center;
          padding: 18px;
        }

        .debtOverlay_drawer {
          display: flex;
          justify-content: flex-end;
          padding: 0;
        }

        .debtOverlayBackdrop {
          position: absolute;
          inset: 0;
          border: 0;
          background: rgba(8, 11, 16, 0.76);
          backdrop-filter: blur(7px);
          -webkit-backdrop-filter: blur(7px);
          cursor: pointer;
        }

        .debtDrawer {
          position: relative;
          width: min(760px, 100%);
          height: 100%;
          display: grid;
          grid-template-rows: auto 1fr auto;
          background: rgba(15, 18, 27, 0.98);
          border-left: 1px solid var(--lcc-border);
          box-shadow: -24px 0 80px rgba(0,0,0,0.45);
        }

        .debtDrawerHead,
        .debtDrawerFoot {
          padding: 18px 20px;
          border-bottom: 1px solid var(--lcc-border);
        }

        .debtDrawerFoot {
          border-bottom: 0;
          border-top: 1px solid var(--lcc-border);
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .debtDrawerHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .debtDrawerTitle {
          margin-top: 4px;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.03em;
        }

        .debtDrawerSub {
          margin-top: 5px;
          font-size: 12.5px;
          color: var(--lcc-text-muted);
        }

        .debtDrawerBody {
          overflow: auto;
          padding: 18px 20px;
          display: grid;
          gap: 14px;
          align-content: start;
        }

        .debtModal {
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

        .debtModalHead,
        .debtModalFoot {
          padding: 15px 18px;
          border-bottom: 1px solid var(--lcc-border);
        }

        .debtModalFoot {
          border-bottom: 0;
          border-top: 1px solid var(--lcc-border);
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .debtModalHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .debtModalTitle {
          font-size: 15px;
          font-weight: 700;
        }

        .debtModalBody {
          min-height: 0;
          overflow: auto;
          padding: 18px;
        }

        .debtToastStack {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 1500;
          display: grid;
          gap: 8px;
        }

        .debtToast {
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

        .debtToast_success {
          color: var(--lcc-green);
          border: 1px solid rgba(34, 199, 125, 0.22);
          background: rgba(10, 24, 17, 0.96);
        }

        .debtToast_error {
          color: #ff8ea1;
          border: 1px solid rgba(224, 84, 106, 0.24);
          background: rgba(30, 11, 15, 0.96);
        }

        .debtToastClose {
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
          .debtWorkspace {
            grid-template-columns: 272px minmax(0, 1fr) 224px;
          }

          .debtMidGrid {
            grid-template-columns: minmax(0, 1fr) 240px;
          }

          .debtHeroMetaGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 1100px) {
          .debtMobileTabs {
            display: flex;
          }

          .debtWorkspace {
            grid-template-columns: 1fr;
          }

          .debtCol {
            display: none;
            min-height: 0;
          }

          .debtCol_show {
            display: block;
          }

          .debtSidebarPane,
          .debtFocusPane,
          .debtRailPane {
            min-height: calc(100svh - 210px);
          }

          .debtRailPane {
            height: auto;
          }
        }

        @media (max-width: 860px) {
          .debtSummaryStrip {
            flex-direction: column;
            align-items: flex-start;
          }

          .debtSummaryLeft,
          .debtSummaryRight {
            width: 100%;
          }

          .debtSummaryRight {
            justify-content: flex-start;
          }

          .debtMidGrid,
          .debtDetailRow {
            grid-template-columns: 1fr;
          }

          .debtGrid_4 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .debtHeroTopRow {
            flex-direction: column;
            align-items: flex-start;
          }

          .debtHeroMetaStack {
            width: 100%;
            flex-direction: row;
            flex-wrap: wrap;
            align-items: flex-start;
          }
        }

        @media (max-width: 640px) {
          .debtsRoot {
            min-height: calc(100svh - 16px);
            gap: 10px;
          }

          .debtSummaryStrip {
            padding: 14px;
          }

          .debtSummaryMiniList {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .debtFocusHeader {
            padding: 14px;
            flex-direction: column;
            align-items: stretch;
          }

          .debtFocusHeaderRight {
            justify-content: flex-end;
          }

          .debtFocusScroll {
            padding: 10px;
          }

          .debtGrid_2,
          .debtGrid_3,
          .debtGrid_4,
          .debtHeroMetaGrid,
          .debtSimResultGrid {
            grid-template-columns: 1fr;
          }

          .debtToastStack {
            left: 12px;
            right: 12px;
            bottom: 12px;
          }

          .debtOverlay {
            padding: 10px;
          }

          .debtHistoryCard {
            align-items: flex-start;
            flex-direction: column;
          }

          .debtHistoryRight {
            width: 100%;
            justify-content: flex-start;
          }
        }
      `}</style>
    </>
  );
}