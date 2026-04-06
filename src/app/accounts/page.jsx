"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Landmark,
  PiggyBank,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { writeAccountDelta, writeAccountTransfer } from "@/lib/accountLedger";
import { projectCashFlow, todayISO } from "@/lib/projectionEngine";

const META_PREFIX = "__LCC_META__";

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */
function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAgo(value) {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  const minutes = Math.round(ms / 60000);
  if (!Number.isFinite(minutes)) return "—";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function dateInputToday() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateValue, days) {
  const d = new Date(dateValue);
  d.setDate(d.getDate() + days);
  return d;
}

function compareIso(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function isFutureDate(dateValue) {
  if (!dateValue) return false;
  const target = new Date(`${String(dateValue).slice(0, 10)}T12:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return target.getTime() > today.getTime();
}

function monthStart(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
}

function monthEnd(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
}

function dayKey(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function extractStoredNote(rawNote) {
  const text = String(rawNote ?? "");
  const idx = text.indexOf(META_PREFIX);
  if (idx === -1) {
    return { userNote: text, meta: {} };
  }
  const userNote = text.slice(0, idx).trimEnd();
  const payload = text.slice(idx + META_PREFIX.length);
  try {
    const parsed = JSON.parse(decodeURIComponent(payload));
    return { userNote, meta: parsed || {} };
  } catch {
    return { userNote, meta: {} };
  }
}

function normalizeAccountType(type = "") {
  const value = String(type || "").trim().toLowerCase();
  if (value.includes("checking")) return "Checking";
  if (value.includes("savings")) return "Savings";
  if (value.includes("credit")) return "Credit";
  if (value.includes("cash")) return "Cash";
  if (value.includes("broker")) return "Brokerage";
  if (value.includes("invest")) return "Investment";
  if (value.includes("debt")) return "Debt";
  if (!value) return "Account";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function accountTone(accountType = "") {
  const value = String(accountType || "").toLowerCase();
  if (value.includes("savings")) return "green";
  if (value.includes("credit")) return "red";
  if (value.includes("cash")) return "amber";
  return "blue";
}

function typeMatches(type, filter) {
  const value = String(type || "").toLowerCase();
  if (filter === "all") return true;
  if (filter === "checking") return value.includes("checking");
  if (filter === "savings") return value.includes("savings");
  if (filter === "credit") return value.includes("credit");
  if (filter === "cash") return value.includes("cash");
  return true;
}

function isCashLikeAccount(type = "") {
  const value = String(type || "").toLowerCase();
  if (!value) return true;
  if (value.includes("credit")) return false;
  if (value.includes("debt")) return false;
  if (value.includes("loan")) return false;
  if (value.includes("broker")) return false;
  if (value.includes("invest")) return false;
  return true;
}

function getAccountIcon(type = "") {
  const value = String(type || "").toLowerCase();
  if (value.includes("savings")) return <PiggyBank size={16} />;
  if (value.includes("credit")) return <CreditCard size={16} />;
  if (value.includes("cash")) return <Wallet size={16} />;
  return <Landmark size={16} />;
}

function toneMeta(tone = "neutral") {
  if (tone === "green") {
    return {
      text: "#97efc7",
      border: "rgba(143, 240, 191, 0.18)",
      glow: "rgba(110, 229, 173, 0.10)",
      bg: "rgba(11, 22, 17, 0.66)",
    };
  }
  if (tone === "blue") {
    return {
      text: "#bcd7ff",
      border: "rgba(143, 177, 255, 0.18)",
      glow: "rgba(110, 163, 255, 0.10)",
      bg: "rgba(10, 16, 28, 0.66)",
    };
  }
  if (tone === "amber") {
    return {
      text: "#f5cf88",
      border: "rgba(255, 204, 112, 0.18)",
      glow: "rgba(255, 194, 92, 0.10)",
      bg: "rgba(22, 17, 11, 0.66)",
    };
  }
  if (tone === "red") {
    return {
      text: "#ffb4c5",
      border: "rgba(255, 132, 163, 0.18)",
      glow: "rgba(255, 108, 145, 0.10)",
      bg: "rgba(22, 11, 15, 0.66)",
    };
  }
  return {
    text: "#f7fbff",
    border: "rgba(214, 226, 255, 0.14)",
    glow: "rgba(140, 170, 255, 0.08)",
    bg: "rgba(10, 15, 24, 0.66)",
  };
}

function getIncomeRouting(row, defaultAccountId) {
  const extracted = extractStoredNote(row.note);
  const meta = extracted.meta;
  const posted = !!meta?.posted;
  const status =
    meta?.status === "scheduled" || isFutureDate(row.deposit_date)
      ? "scheduled"
      : "received";

  let shares = [];
  if (Array.isArray(meta?.splits) && meta.splits.length) {
    shares = meta.splits
      .filter((split) => split?.accountId && safeNum(split.amount, 0) > 0)
      .map((split) => ({
        accountId: split.accountId,
        accountName: split.accountName || "",
        amount: round2(split.amount),
      }));
  } else if (defaultAccountId) {
    shares = [
      {
        accountId: defaultAccountId,
        accountName: row.account_name || "",
        amount: round2(row.amount),
      },
    ];
  }

  return {
    id: row.id,
    source: row.source || "Income",
    deposit_date: row.deposit_date || "",
    amount: round2(row.amount),
    posted,
    status,
    shares,
  };
}

function isTransferRow(tx) {
  const kind = String(tx.kind || "").toLowerCase();
  const sourceType = String(tx.source_type || "").toLowerCase();
  return kind.includes("transfer") || sourceType.includes("transfer");
}

function isBillRow(tx) {
  const kind = String(tx.kind || "").toLowerCase();
  const sourceType = String(tx.source_type || "").toLowerCase();
  return kind.includes("bill") || sourceType.includes("bill");
}

function flowBucket(tx) {
  if (isTransferRow(tx)) return "Transfers";
  if (isBillRow(tx)) return "Bills";
  if (safeNum(tx.delta, 0) > 0) return "Income";
  if (String(tx.source_type || "").toLowerCase().includes("adjust")) return "Adjustments";
  return "Spending";
}

function amountFromBill(bill) {
  const type = String(bill?.type || "").toLowerCase();
  if (type === "controllable") {
    const plan = safeNum(bill?.min_pay, 0) + safeNum(bill?.extra_pay, 0);
    return round2(plan > 0 ? plan : safeNum(bill?.amount, 0));
  }
  return round2(safeNum(bill?.amount, 0));
}

function billTitle(bill) {
  return bill?.category || bill?.notes || bill?.name || "Bill";
}

function buildBalanceBars(transactions, currentBalance, days = 14) {
  const txByDay = new Map();

  transactions.forEach((tx) => {
    const key = dayKey(tx.created_at);
    if (!key) return;
    txByDay.set(key, round2((txByDay.get(key) || 0) + safeNum(tx.delta, 0)));
  });

  let running = round2(currentBalance);
  const today = new Date();
  const values = [];

  for (let i = 0; i < days; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);

    values.unshift({
      key,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: running,
    });

    running = round2(running - safeNum(txByDay.get(key), 0));
  }

  const nums = values.map((v) => v.value);
  const min = Math.min(...nums, 0);
  const max = Math.max(...nums, 1);
  const range = Math.max(max - min, 1);

  return values.map((v) => ({
    ...v,
    height: 18 + ((v.value - min) / range) * 52,
  }));
}

function riskMeta(summary) {
  if (!summary) {
    return {
      tone: "blue",
      label: "Stable",
      detail: "This account looks stable right now.",
      chipTone: "blue",
      riskLevel: "stable",
    };
  }

  if (summary.projectedLowPoint < 0) {
    return {
      tone: "red",
      label: "Critical cash risk",
      detail: "This account is projected to dip below zero soon.",
      chipTone: "red",
      riskLevel: "critical",
    };
  }

  if (summary.projected14 < summary.safeBuffer || summary.projectedLowPoint < summary.safeBuffer) {
    return {
      tone: "amber",
      label: "Low buffer risk",
      detail: "This account is projected below its safe buffer soon.",
      chipTone: "amber",
      riskLevel: "warning",
    };
  }

  return {
    tone: "green",
    label: "Stable",
    detail: "This account looks stable right now.",
    chipTone: "green",
    riskLevel: "stable",
  };
}

function emptyCreateForm() {
  return {
    name: "",
    account_type: "checking",
    opening_balance: "",
    safe_buffer: "150",
  };
}

function emptyAdjustForm(account) {
  return {
    mode: "add",
    amount: "",
    note: "",
    safe_buffer: String(round2(safeNum(account?.safe_buffer, 150))),
  };
}

function emptyTransferForm(selectedAccountId = "", accounts = []) {
  return {
    toAccountId: accounts.find((account) => account.id !== selectedAccountId)?.id || "",
    amount: "",
    note: "",
  };
}

function buildProjectedBillsForAccount(accountBills, startISO, horizonDays = 30) {
  const horizonEnd = addDays(new Date(`${startISO}T12:00:00`), horizonDays - 1)
    .toISOString()
    .slice(0, 10);

  const out = [];

  const addMonthsISO = (iso, delta) => {
    const date = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
    const day = date.getDate();
    const next = new Date(date.getFullYear(), date.getMonth() + delta, 1, 12);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, last));
    return next.toISOString().slice(0, 10);
  };

  const nextDue = (iso, freq) => {
    const base = String(iso || startISO).slice(0, 10);
    const f = String(freq || "monthly").toLowerCase();
    if (f === "weekly") return addDays(new Date(`${base}T12:00:00`), 7).toISOString().slice(0, 10);
    if (f === "biweekly") return addDays(new Date(`${base}T12:00:00`), 14).toISOString().slice(0, 10);
    if (f === "quarterly") return addMonthsISO(base, 3);
    if (f === "yearly") return addMonthsISO(base, 12);
    if (f === "one_time") return "";
    return addMonthsISO(base, 1);
  };

  (accountBills || []).forEach((bill) => {
    if (bill.active === false) return;
    let due = String(bill.due_date || "").slice(0, 10);
    if (!due) return;
    const amount = amountFromBill(bill);
    if (!(amount > 0)) return;

    let guard = 0;
    while (due && due <= horizonEnd && guard < 36) {
      if (due >= startISO) {
        out.push({ dueDate: due, amount, name: billTitle(bill) });
      }
      if (String(bill.frequency || "").toLowerCase() === "one_time") break;
      due = nextDue(due, bill.frequency);
      guard += 1;
    }
  });

  return out.sort((a, b) => compareIso(a.dueDate, b.dueDate));
}

/* ──────────────────────────────────────────────────────────────────────────
   UI primitives
   ────────────────────────────────────────────────────────────────────────── */
function MiniPill({ children, tone = "neutral" }) {
  const meta = toneMeta(tone);
  return (
    <div
      style={{
        minHeight: 28,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0 10px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 14px ${meta.glow}`,
        color: tone === "neutral" ? "rgba(255,255,255,0.88)" : meta.text,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = "ghost",
  size = "sm",
  full = false,
  type = "button",
  disabled = false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`accCmdBtn accCmdBtn_${variant} accCmdBtn_${size} ${full ? "accCmdBtn_full" : ""}`}
    >
      {children}
    </button>
  );
}

function TabBtn({ label, active, onClick }) {
  return (
    <button type="button" className={`accCmdTab ${active ? "accCmdTab_active" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

function Toast({ error, status, onClearError }) {
  if (!error && !status) return null;
  return (
    <div className="accCmdToastStack">
      {status ? (
        <div className="accCmdToast accCmdToast_success">
          <CheckCircle2 size={14} />
          {status}
        </div>
      ) : null}
      {error ? (
        <div className="accCmdToast accCmdToast_error">
          <AlertTriangle size={14} />
          {error}
          <button type="button" onClick={onClearError} className="accCmdToastClose" aria-label="Dismiss">
            <X size={12} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ModalShell({ open, title, subcopy, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="accCmdOverlay">
      <button type="button" className="accCmdBackdrop" onClick={onClose} />
      <div className="accCmdModal">
        <div className="accCmdModalHead">
          <div>
            <div className="accCmdModalTitle">{title}</div>
            {subcopy ? <div className="accCmdModalSub">{subcopy}</div> : null}
          </div>
          <button type="button" onClick={onClose} className="accCmdCloseBtn" aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className="accCmdModalBody">{children}</div>
        {footer ? <div className="accCmdModalFoot">{footer}</div> : null}
      </div>
    </div>
  );
}

function SummaryStrip({ accounts, totalCash, checkingTotal, savingsTotal, atRiskCount, selectedAccount, selectedRisk }) {
  return (
    <div className="accCmdSummaryStrip">
      <div className="accCmdSummaryLeft">
        <div className="accCmdTitleWrap">
          <div className="accCmdEyebrow">Accounts</div>
          <div className="accCmdPageTitle">Account Command</div>
        </div>
        <div className="accCmdSummaryMiniList">
          <div className="accCmdMiniStat">
            <span className="accCmdMiniLabel">Accounts</span>
            <span className="accCmdMiniValue">{accounts.length}</span>
          </div>
          <div className="accCmdMiniStat">
            <span className="accCmdMiniLabel">Checking</span>
            <span className="accCmdMiniValue">{fmtMoney(checkingTotal)}</span>
          </div>
          <div className="accCmdMiniStat">
            <span className="accCmdMiniLabel">Savings</span>
            <span className="accCmdMiniValue">{fmtMoney(savingsTotal)}</span>
          </div>
        </div>
      </div>
      <div className="accCmdSummaryRight">
        {selectedAccount ? <MiniPill tone={selectedRisk?.chipTone || "blue"}>{selectedAccount.name}</MiniPill> : null}
        <MiniPill tone={atRiskCount > 0 ? "amber" : "green"}>{atRiskCount} at risk</MiniPill>
        <MiniPill tone="green">{fmtMoney(totalCash)} total cash</MiniPill>
      </div>
    </div>
  );
}

function AccountQueueRow({ account, summary, selected, onSelect, isPrimary }) {
  const tone = riskMeta(summary).chipTone || accountTone(account.account_type);
  const meta = toneMeta(tone);
  return (
    <button type="button" className={`accCmdQueueRow ${selected ? "accCmdQueueRow_active" : ""}`} onClick={onSelect}>
      <div className="accCmdQueueAccent" style={{ background: selected ? meta.text : "transparent" }} />
      <div
        className="accCmdQueueIcon"
        style={{ color: meta.text, borderColor: meta.border, boxShadow: `0 0 16px ${meta.glow}` }}
      >
        {getAccountIcon(account.account_type)}
      </div>
      <div className="accCmdQueueMain">
        <div className="accCmdQueueTop">
          <div className="accCmdQueueTitleWrap">
            <div className="accCmdQueueName">{account.name || "Account"}</div>
            {isPrimary ? <MiniPill tone="green">Primary</MiniPill> : null}
            {summary?.riskLevel === "warning" ? <MiniPill tone="amber">Watch</MiniPill> : null}
            {summary?.riskLevel === "critical" ? <MiniPill tone="red">Critical</MiniPill> : null}
          </div>
          <div className="accCmdQueueAmount">{fmtMoney(account.balance)}</div>
        </div>
        <div className="accCmdQueueMeta">
          <span>{normalizeAccountType(account.account_type)}</span>
          <span>•</span>
          <span style={{ color: safeNum(summary?.last30Delta, 0) >= 0 ? "#97efc7" : "#ffb4c5" }}>
            {safeNum(summary?.last30Delta, 0) >= 0 ? "+" : ""}
            {fmtMoney(summary?.last30Delta)} 30D
          </span>
          <span>•</span>
          <span>{fmtMoney(summary?.projected14)} 14D</span>
        </div>
      </div>
      <ChevronRight size={14} style={{ opacity: 0.45, flexShrink: 0 }} />
    </button>
  );
}

function QueuePane({ visibleAccounts, summaryById, selectedAccount, onSelect, accountSearch, setAccountSearch, accountFilter, setAccountFilter, defaultAccountId }) {
  return (
    <div className="accCmdLeftPane">
      <div className="accCmdLeftHead">
        <div>
          <div className="accCmdPaneTitle">Accounts</div>
          <div className="accCmdPaneSub">Open one into the workspace.</div>
        </div>
        <div className="accCmdSearch">
          <Search size={14} />
          <input value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} placeholder="Search accounts…" />
          {accountSearch ? (
            <button type="button" className="accCmdSearchClear" onClick={() => setAccountSearch("")}>
              <X size={12} />
            </button>
          ) : null}
        </div>
        <select className="accCmdField" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
          <option value="all">All accounts</option>
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
          <option value="credit">Credit</option>
          <option value="cash">Cash</option>
          <option value="at_risk">At risk</option>
        </select>
      </div>
      <div className="accCmdQueueList">
        {visibleAccounts.length ? (
          visibleAccounts.map((account) => (
            <AccountQueueRow
              key={account.id}
              account={account}
              summary={summaryById[account.id]}
              selected={account.id === selectedAccount?.id}
              isPrimary={defaultAccountId === account.id}
              onSelect={() => onSelect(account.id)}
            />
          ))
        ) : (
          <div className="accCmdEmptyBlock">No accounts found.</div>
        )}
      </div>
    </div>
  );
}

function BalanceBars({ bars = [] }) {
  if (!bars.length) return <div className="accCmdBarsEmpty">No recent balance movement yet.</div>;
  return (
    <div className="accCmdBarsWrap">
      {bars.map((bar) => (
        <div key={bar.key} className="accCmdBarCol" title={`${bar.label} • ${fmtMoney(bar.value)}`}>
          <div className="accCmdBarFill" style={{ height: bar.height }} />
        </div>
      ))}
    </div>
  );
}

function CommandStat({ label, value, sub, tone = "neutral" }) {
  const meta = toneMeta(tone);
  return (
    <div className="accCmdCommandStat">
      <span className="accCmdCommandLabel">{label}</span>
      <strong className="accCmdCommandValue" style={{ color: tone === "neutral" ? "#fff" : meta.text }}>
        {value}
      </strong>
      <small className="accCmdCommandSub">{sub}</small>
    </div>
  );
}

function TransactionRow({ tx }) {
  const delta = safeNum(tx.delta, 0);
  const positive = delta >= 0;
  const bucket = flowBucket(tx);
  return (
    <div className="accCmdDataRow">
      <div>
        <div className="accCmdDataTitle">{tx.note || bucket}</div>
        <div className="accCmdDataSub">
          {shortDate(tx.created_at)} • {bucket}
          {tx.related_account_name ? ` • ${tx.related_account_name}` : ""}
          {tx.source_type ? ` • ${String(tx.source_type).replaceAll("_", " ")}` : ""}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="accCmdDataAmount" style={{ color: positive ? "#97efc7" : "#ffb4c5" }}>
          {positive ? "+" : ""}
          {fmtMoney(delta)}
        </div>
        <div className="accCmdDataSub">Bal {fmtMoney(tx.resulting_balance)}</div>
      </div>
    </div>
  );
}

function ForecastEventRow({ event }) {
  const tone = event.kind === "income" ? "green" : "amber";
  const afterPositive = safeNum(event.afterBalance, 0) >= 0;
  return (
    <div className="accCmdDataRow">
      <div>
        <div className="accCmdDataTitle">{event.label}</div>
        <div className="accCmdDataSub">
          {shortDate(event.date)} • {event.kind === "income" ? "Incoming" : "Outgoing"}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="accCmdDataAmount" style={{ color: toneMeta(tone).text }}>
          {event.delta >= 0 ? "+" : ""}
          {fmtMoney(event.delta)}
        </div>
        <div className="accCmdDataSub" style={{ color: afterPositive ? "rgba(255,255,255,0.58)" : "#ffb4c5" }}>
          After {fmtMoney(event.afterBalance)}
        </div>
      </div>
    </div>
  );
}

function QuickInfoRow({ label, value, tone = "neutral" }) {
  const color = tone === "green" ? "#97efc7" : tone === "amber" ? "#f5cf88" : tone === "red" ? "#ffb4c5" : "#fff";
  return (
    <div className="accCmdQuickInfoRow">
      <span>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

function FocusPane({ selectedAccount, selectedSummary, selectedBars, tab, setTab, defaultAccountId }) {
  if (!selectedAccount || !selectedSummary) {
    return (
      <div className="accCmdCenterPane accCmdCenterPane_empty">
        <div className="accCmdEmptyBlock">Select an account.</div>
      </div>
    );
  }

  const risk = riskMeta(selectedSummary);

  return (
    <div className="accCmdCenterPane">
      <div className="accCmdCenterHead">
        <div>
          <div className="accCmdFocusTitle">{selectedAccount.name || "Account Focus"}</div>
          <div className="accCmdFocusMeta">
            {normalizeAccountType(selectedAccount.account_type)} • Updated {formatAgo(selectedAccount.updated_at)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {defaultAccountId === selectedAccount.id ? <MiniPill tone="green">Primary</MiniPill> : null}
          <MiniPill tone={risk.chipTone}>{risk.label}</MiniPill>
        </div>
      </div>

      <div className="accCmdCenterScroll">
        <div className="accCmdCommandCard">
          <div className="accCmdCommandTop">
            <div className="accCmdBalanceBlock">
              <div className="accCmdBalanceLabel">Live Balance</div>
              <div className="accCmdBalanceValue">{fmtMoney(selectedAccount.balance)}</div>
              <div className="accCmdBalancePills">
                <MiniPill tone={safeNum(selectedSummary.last30Delta, 0) >= 0 ? "green" : "red"}>
                  {safeNum(selectedSummary.last30Delta, 0) >= 0 ? "+" : ""}
                  {fmtMoney(selectedSummary.last30Delta)} 30D
                </MiniPill>
                <MiniPill tone={risk.chipTone}>{risk.label}</MiniPill>
              </div>
            </div>
            <div className="accCmdTrendMini">
              <div className="accCmdTrendMiniHead">
                <div>
                  <div className="accCmdBalanceLabel">Trend</div>
                  <div className="accCmdTrendMiniTitle">14 Day Balance</div>
                </div>
                <MiniPill tone="blue">live</MiniPill>
              </div>
              <BalanceBars bars={selectedBars} />
            </div>
          </div>

          <div className="accCmdCommandGrid">
            <CommandStat
              label="Projected 14D"
              value={fmtMoney(selectedSummary.projected14)}
              sub="Income minus bills over the next two weeks"
              tone={selectedSummary.projected14 < selectedSummary.safeBuffer ? "amber" : "neutral"}
            />
            <CommandStat label="Safe Buffer" value={fmtMoney(selectedSummary.safeBuffer)} sub="Local warning line for this account" />
            <CommandStat
              label="Next Bill"
              value={selectedSummary.nextBill ? shortDate(selectedSummary.nextBill.due_date) : "Clear"}
              sub={
                selectedSummary.nextBill
                  ? `${billTitle(selectedSummary.nextBill)} • ${fmtMoney(amountFromBill(selectedSummary.nextBill))}`
                  : "No linked outgoing bill"
              }
              tone={selectedSummary.nextBill ? "amber" : "neutral"}
            />
            <CommandStat
              label="Next Deposit"
              value={selectedSummary.nextIncome ? shortDate(selectedSummary.nextIncome.deposit_date) : "None"}
              sub={
                selectedSummary.nextIncome
                  ? `${selectedSummary.nextIncome.source} • ${fmtMoney(selectedSummary.nextIncome.amount)}`
                  : "No scheduled incoming deposit"
              }
              tone={selectedSummary.nextIncome ? "green" : "neutral"}
            />
          </div>
        </div>

        <div className="accCmdTabRow">
          <TabBtn label="Activity" active={tab === "activity"} onClick={() => setTab("activity")} />
          <TabBtn label="Balance Story" active={tab === "story"} onClick={() => setTab("story")} />
          <TabBtn label="Recurring Flow" active={tab === "recurring"} onClick={() => setTab("recurring")} />
          <TabBtn label="Forecast" active={tab === "forecast"} onClick={() => setTab("forecast")} />
        </div>

        {tab === "activity" ? (
          <div className="accCmdActivityLayout">
            <div className="accCmdPanel">
              <div className="accCmdPanelHead">
                <div>
                  <div className="accCmdPanelTitle">Activity Feed</div>
                  <div className="accCmdPanelSub">What actually hit this account.</div>
                </div>
                <MiniPill>{selectedSummary.recentTransactions.length} rows</MiniPill>
              </div>
              {selectedSummary.recentTransactions.length ? (
                <div className="accCmdDataList">
                  {selectedSummary.recentTransactions.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </div>
              ) : (
                <div className="accCmdEmptyInline">No account activity yet.</div>
              )}
            </div>

            <div className="accCmdAsideStack">
              <div className="accCmdPanel compact">
                <div className="accCmdPanelHead">
                  <div>
                    <div className="accCmdPanelTitle">Balance Story Snapshot</div>
                    <div className="accCmdPanelSub">Fast explanation of where the money moved.</div>
                  </div>
                </div>
                <div className="accCmdQuickInfoList">
                  <QuickInfoRow label="Start of month" value={fmtMoney(selectedSummary.startBalance)} />
                  <QuickInfoRow label="Income added" value={`+${fmtMoney(selectedSummary.monthIncome)}`} tone="green" />
                  <QuickInfoRow label="Bills paid" value={`-${fmtMoney(selectedSummary.monthBills)}`} tone="amber" />
                  <QuickInfoRow label="Spending" value={`-${fmtMoney(selectedSummary.monthSpending)}`} tone="red" />
                  <QuickInfoRow
                    label="Transfers"
                    value={`${safeNum(selectedSummary.monthTransfersNet, 0) >= 0 ? "+" : ""}${fmtMoney(selectedSummary.monthTransfersNet)}`}
                    tone={safeNum(selectedSummary.monthTransfersNet, 0) >= 0 ? "green" : "red"}
                  />
                  <QuickInfoRow label="Current balance" value={fmtMoney(selectedAccount.balance)} />
                </div>
              </div>

              <div className="accCmdPanel compact">
                <div className="accCmdPanelHead">
                  <div>
                    <div className="accCmdPanelTitle">Upcoming Hits</div>
                    <div className="accCmdPanelSub">What is next to move this account.</div>
                  </div>
                </div>
                <div className="accCmdMiniList">
                  {selectedSummary.nextIncome ? (
                    <div className="accCmdDataRow">
                      <div>
                        <div className="accCmdDataTitle">{selectedSummary.nextIncome.source}</div>
                        <div className="accCmdDataSub">{shortDate(selectedSummary.nextIncome.deposit_date)}</div>
                      </div>
                      <div className="accCmdDataAmount" style={{ color: "#97efc7" }}>
                        +{fmtMoney(selectedSummary.nextIncome.amount)}
                      </div>
                    </div>
                  ) : null}
                  {selectedSummary.nextBill ? (
                    <div className="accCmdDataRow">
                      <div>
                        <div className="accCmdDataTitle">{billTitle(selectedSummary.nextBill)}</div>
                        <div className="accCmdDataSub">{shortDate(selectedSummary.nextBill.due_date)}</div>
                      </div>
                      <div className="accCmdDataAmount" style={{ color: "#f5cf88" }}>
                        -{fmtMoney(amountFromBill(selectedSummary.nextBill))}
                      </div>
                    </div>
                  ) : null}
                  {!selectedSummary.nextIncome && !selectedSummary.nextBill ? (
                    <div className="accCmdEmptyInline">Nothing linked next.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "story" ? (
          <div className="accCmdStoryLayout">
            <div className="accCmdPanel">
              <div className="accCmdPanelHead">
                <div>
                  <div className="accCmdPanelTitle">Balance Story</div>
                  <div className="accCmdPanelSub">Why the balance is here right now.</div>
                </div>
                <MiniPill tone="green">month to date</MiniPill>
              </div>
              <div className="accCmdStoryGrid">
                <div className="accCmdStoryCell">
                  <div className="accCmdBalanceLabel">Start of Month</div>
                  <div className="accCmdStoryValue">{fmtMoney(selectedSummary.startBalance)}</div>
                  <div className="accCmdStorySub">Starting point before this month’s movement.</div>
                </div>
                <div className="accCmdStoryCell">
                  <div className="accCmdBalanceLabel">Current</div>
                  <div className="accCmdStoryValue">{fmtMoney(selectedAccount.balance)}</div>
                  <div className="accCmdStorySub">Where the account stands right now.</div>
                </div>
                <div className="accCmdStoryCell accent-green">
                  <div className="accCmdBalanceLabel">Income Added</div>
                  <div className="accCmdStoryValue text-green">+{fmtMoney(selectedSummary.monthIncome)}</div>
                  <div className="accCmdStorySub">Deposits and positive flow to this account.</div>
                </div>
                <div className="accCmdStoryCell accent-amber">
                  <div className="accCmdBalanceLabel">Bills Paid</div>
                  <div className="accCmdStoryValue text-amber">-{fmtMoney(selectedSummary.monthBills)}</div>
                  <div className="accCmdStorySub">Bill-payment activity routed through the shared ledger.</div>
                </div>
                <div className="accCmdStoryCell accent-red">
                  <div className="accCmdBalanceLabel">Spending</div>
                  <div className="accCmdStoryValue text-red">-{fmtMoney(selectedSummary.monthSpending)}</div>
                  <div className="accCmdStorySub">Expense flow outside of bill postings.</div>
                </div>
                <div className="accCmdStoryCell">
                  <div className="accCmdBalanceLabel">Transfers</div>
                  <div className="accCmdStoryValue">{`${safeNum(selectedSummary.monthTransfersNet, 0) >= 0 ? "+" : ""}${fmtMoney(selectedSummary.monthTransfersNet)}`}</div>
                  <div className="accCmdStorySub">Net moved in or out through transfers.</div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "recurring" ? (
          <div className="accCmdActivityLayout">
            <div className="accCmdPanel">
              <div className="accCmdPanelHead">
                <div>
                  <div className="accCmdPanelTitle">Scheduled Income</div>
                  <div className="accCmdPanelSub">Deposits still expected to land here.</div>
                </div>
                <MiniPill tone="green">{selectedSummary.scheduledDeposits.length} items</MiniPill>
              </div>
              {selectedSummary.scheduledDeposits.length ? (
                <div className="accCmdDataList">
                  {selectedSummary.scheduledDeposits.map((row) => (
                    <div key={row.id} className="accCmdDataRow">
                      <div>
                        <div className="accCmdDataTitle">{row.source}</div>
                        <div className="accCmdDataSub">{shortDate(row.deposit_date)} • Scheduled income</div>
                      </div>
                      <div className="accCmdDataAmount" style={{ color: "#97efc7" }}>
                        +{fmtMoney(row.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="accCmdEmptyInline">No scheduled income linked here.</div>
              )}
            </div>

            <div className="accCmdPanel">
              <div className="accCmdPanelHead">
                <div>
                  <div className="accCmdPanelTitle">Upcoming Bills</div>
                  <div className="accCmdPanelSub">Outgoing pressure assigned to this account.</div>
                </div>
                <MiniPill tone="amber">{selectedSummary.upcomingBills.length} items</MiniPill>
              </div>
              {selectedSummary.upcomingBills.length ? (
                <div className="accCmdDataList">
                  {selectedSummary.upcomingBills.map((bill) => (
                    <div key={bill.id} className="accCmdDataRow">
                      <div>
                        <div className="accCmdDataTitle">{billTitle(bill)}</div>
                        <div className="accCmdDataSub">{shortDate(bill.due_date)} • {String(bill.frequency || "monthly").replaceAll("_", " ")}</div>
                      </div>
                      <div className="accCmdDataAmount" style={{ color: "#f5cf88" }}>
                        -{fmtMoney(amountFromBill(bill))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="accCmdEmptyInline">No linked recurring outgoing items.</div>
              )}
            </div>
          </div>
        ) : null}

        {tab === "forecast" ? (
          <div className="accCmdPanel">
            <div className="accCmdPanelHead">
              <div>
                <div className="accCmdPanelTitle">30 Day Forecast</div>
                <div className="accCmdPanelSub">Projected sequence from current balance, scheduled income, and linked bills.</div>
              </div>
              <MiniPill tone={selectedSummary.projectedLowPoint < selectedSummary.safeBuffer ? "amber" : "green"}>
                Low {fmtMoney(selectedSummary.projectedLowPoint)}
              </MiniPill>
            </div>
            {selectedSummary.projectionEvents.length ? (
              <div className="accCmdDataList">
                {selectedSummary.projectionEvents.map((event) => (
                  <ForecastEventRow key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="accCmdEmptyInline">No forecast movement detected in the next 30 days.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActionRail({ selectedAccount, selectedSummary, selectedRisk, defaultAccountId, busy, onCreate, onSetPrimary, onAdjust, onTransfer }) {
  return (
    <div className="accCmdRightPane">
      <div className="accCmdPanel">
        <div className="accCmdPanelHead">
          <div>
            <div className="accCmdPanelTitle">Actions</div>
            <div className="accCmdPanelSub">Primary actions for this page.</div>
          </div>
        </div>
        <div className="accCmdActionList">
          <Button full variant="primary" onClick={onCreate} disabled={busy}>
            <Plus size={14} /> New Account
          </Button>
          <Button full onClick={onSetPrimary} disabled={!selectedAccount || busy || defaultAccountId === selectedAccount?.id}>
            <Sparkles size={14} /> Make Primary
          </Button>
          <Button full onClick={onAdjust} disabled={!selectedAccount || busy}>
            <Save size={14} /> Adjust / Buffer
          </Button>
          <Button full onClick={onTransfer} disabled={!selectedAccount || busy}>
            <ArrowRightLeft size={14} /> Transfer
          </Button>
        </div>
      </div>

      <div className="accCmdPanel">
        <div className="accCmdPanelHead">
          <div>
            <div className="accCmdPanelTitle">Selected Read</div>
            <div className="accCmdPanelSub">The account pressure readout.</div>
          </div>
        </div>
        {selectedAccount && selectedSummary ? (
          <div className="accCmdQuickInfoList">
            <QuickInfoRow label="Balance" value={fmtMoney(selectedAccount.balance)} />
            <QuickInfoRow label="Safe Buffer" value={fmtMoney(selectedSummary.safeBuffer)} tone={selectedSummary.projected14 < selectedSummary.safeBuffer ? "amber" : "neutral"} />
            <QuickInfoRow label="Projected 14D" value={fmtMoney(selectedSummary.projected14)} tone={selectedSummary.projected14 < 0 ? "red" : selectedSummary.projected14 < selectedSummary.safeBuffer ? "amber" : "green"} />
            <QuickInfoRow label="Projected Month End" value={fmtMoney(selectedSummary.projectedMonthEnd)} />
            <QuickInfoRow label="Low Point" value={fmtMoney(selectedSummary.projectedLowPoint)} tone={selectedSummary.projectedLowPoint < 0 ? "red" : "amber"} />
            <QuickInfoRow label="Risk" value={selectedRisk.label} tone={selectedRisk.chipTone} />
          </div>
        ) : (
          <div className="accCmdEmptyInline">No account selected.</div>
        )}
      </div>

      <div className="accCmdPanel">
        <div className="accCmdPanelHead">
          <div>
            <div className="accCmdPanelTitle">Rules</div>
            <div className="accCmdPanelSub">What this page is doing now.</div>
          </div>
        </div>
        <div className="accCmdMiniList">
          <div className="accCmdRuleRow">
            <ShieldAlert size={14} /> Manual balance changes route through the shared ledger helper.
          </div>
          <div className="accCmdRuleRow">
            <ShieldAlert size={14} /> Transfers route through one shared transfer path.
          </div>
          <div className="accCmdRuleRow">
            <ShieldAlert size={14} /> Safe buffer can update without inventing fake ledger math.
          </div>
          <div className="accCmdRuleRow">
            <ShieldAlert size={14} /> Forecast reads linked bills and scheduled income instead of guessing.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────────────── */
export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [bills, setBills] = useState([]);
  const [incomeRows, setIncomeRows] = useState([]);
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [tab, setTab] = useState("activity");
  const [mobileSection, setMobileSection] = useState("focus");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState(null);

  const [openModal, setOpenModal] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreateForm());
  const [adjustForm, setAdjustForm] = useState(emptyAdjustForm(null));
  const [transferForm, setTransferForm] = useState(emptyTransferForm("", []));

  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(""), 3200);
    return () => clearTimeout(id);
  }, [status]);

  const loadAccountsPage = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        setUserId(null);
        setAccounts([]);
        setTransactions([]);
        setBills([]);
        setIncomeRows([]);
        setDefaultAccountId("");
        setSelectedAccountId("");
        setLoading(false);
        return;
      }

      const uid = session.user.id;
      setUserId(uid);

      const [accountsRes, txRes, settingsRes, billsRes, incomeRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, user_id, name, account_type, balance, safe_buffer, updated_at")
          .eq("user_id", uid)
          .order("name", { ascending: true }),
        supabase
          .from("account_transactions")
          .select(
            "id, user_id, account_id, kind, amount, delta, resulting_balance, note, related_account_id, related_account_name, source_type, source_id, created_at"
          )
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        supabase.from("account_settings").select("primary_account_id").eq("user_id", uid).maybeSingle(),
        supabase
          .from("bills")
          .select("id, user_id, name, type, frequency, due_date, amount, active, balance, min_pay, extra_pay, apr_pct, category, notes, account_id, last_paid_date")
          .eq("user_id", uid)
          .order("due_date", { ascending: true }),
        supabase
          .from("income_deposits")
          .select("id, user_id, deposit_date, source, amount, note, account_id, account_name, created_at, updated_at")
          .eq("user_id", uid)
          .order("deposit_date", { ascending: true }),
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (txRes.error) throw txRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (billsRes.error) throw billsRes.error;
      if (incomeRes.error) throw incomeRes.error;

      setAccounts(accountsRes.data || []);
      setTransactions(txRes.data || []);
      setBills(billsRes.data || []);
      setIncomeRows(incomeRes.data || []);
      setDefaultAccountId(settingsRes.data?.primary_account_id || "");
    } catch (err) {
      setPageError(err?.message || "Failed to load accounts page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!mounted) return;
      await loadAccountsPage();
    }
    run();
    return () => {
      mounted = false;
    };
  }, [loadAccountsPage]);

  const summaryById = useMemo(() => {
    const now = new Date();
    const startIso = todayISO();
    const next14Iso = addDays(new Date(), 14).toISOString().slice(0, 10);
    const monthEndIso = monthEnd(now).toISOString().slice(0, 10);
    const monthStartDate = monthStart(now).getTime();
    const last30Cutoff = addDays(new Date(), -30).getTime();

    const txMap = new Map(accounts.map((account) => [account.id, []]));
    transactions.forEach((tx) => {
      if (!txMap.has(tx.account_id)) return;
      txMap.get(tx.account_id).push({
        ...tx,
        delta: round2(tx.delta),
        resulting_balance: round2(tx.resulting_balance),
      });
    });

    const billMap = new Map(accounts.map((account) => [account.id, []]));
    bills.forEach((bill) => {
      if (!bill.account_id || !billMap.has(bill.account_id)) return;
      billMap.get(bill.account_id).push(bill);
    });

    const scheduledIncomeMap = new Map(accounts.map((account) => [account.id, []]));
    incomeRows.forEach((row) => {
      const routed = getIncomeRouting(row, defaultAccountId);
      if (routed.posted || routed.status !== "scheduled") return;
      routed.shares.forEach((share) => {
        if (!scheduledIncomeMap.has(share.accountId)) return;
        scheduledIncomeMap.get(share.accountId).push({
          id: `${routed.id}-${share.accountId}`,
          income_id: routed.id,
          source: routed.source,
          deposit_date: routed.deposit_date,
          amount: round2(share.amount),
        });
      });
    });

    const result = {};

    accounts.forEach((account) => {
      const accountTxs = [...(txMap.get(account.id) || [])].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      const monthTxs = accountTxs.filter((tx) => new Date(tx.created_at || 0).getTime() >= monthStartDate);
      const last30Txs = accountTxs.filter((tx) => new Date(tx.created_at || 0).getTime() >= last30Cutoff);

      const upcomingBills = [...(billMap.get(account.id) || [])]
        .filter((bill) => bill.active !== false)
        .filter((bill) => bill.due_date && String(bill.due_date).slice(0, 10) >= startIso)
        .sort((a, b) => compareIso(a.due_date, b.due_date));

      const scheduledDeposits = [...(scheduledIncomeMap.get(account.id) || [])]
        .filter((row) => row.deposit_date && String(row.deposit_date).slice(0, 10) >= startIso)
        .sort((a, b) => compareIso(a.deposit_date, b.deposit_date));

      const nextBill = upcomingBills[0] || null;
      const nextIncome = scheduledDeposits[0] || null;

      const monthIncome = round2(
        monthTxs
          .filter((tx) => safeNum(tx.delta, 0) > 0)
          .filter((tx) => !isTransferRow(tx))
          .reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0)
      );

      const monthBills = round2(
        Math.abs(
          monthTxs
            .filter((tx) => isBillRow(tx))
            .reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0)
        )
      );

      const monthSpending = round2(
        Math.abs(
          monthTxs
            .filter((tx) => !isBillRow(tx) && !isTransferRow(tx) && safeNum(tx.delta, 0) < 0)
            .filter((tx) => !String(tx.source_type || "").toLowerCase().includes("adjust"))
            .reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0)
        )
      );

      const monthTransfersNet = round2(
        monthTxs.filter((tx) => isTransferRow(tx)).reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0)
      );

      const last30Delta = round2(last30Txs.reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0));
      const startBalance = round2(safeNum(account.balance, 0) - monthTxs.reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0));

      const projection = projectCashFlow({
        startDateISO: startIso,
        days: 30,
        startingBalance: safeNum(account.balance, 0),
        events: scheduledDeposits.map((row) => ({
          id: row.id,
          title: row.source || "Income",
          date: row.deposit_date,
          flow: "income",
          amount: round2(row.amount),
        })),
        bills: buildProjectedBillsForAccount(billMap.get(account.id) || [], startIso, 30),
      });

      const projected14 = projection.ok ? round2(projection.daily[13]?.balance ?? account.balance) : round2(account.balance);
      const projectedMonthEnd = projection.ok
        ? round2(projection.daily.find((day) => String(day.date) >= monthEndIso)?.balance ?? projection.projectedEndBalance)
        : round2(account.balance);
      const lowPoint = projection.ok ? round2(projection.lowestBalance) : round2(account.balance);

      const projectionEvents = projection.ok
        ? projection.daily.flatMap((day) =>
            (day.items || []).map((item, index) => ({
              id: `${account.id}-${day.date}-${index}`,
              date: day.date,
              kind: item.type === "income" ? "income" : "expense",
              delta: item.type === "income" ? round2(item.amount) : -round2(item.amount),
              label: item.title,
              afterBalance: round2(day.balance),
            }))
          )
        : [];

      const flowMixMap = new Map();
      monthTxs.forEach((tx) => {
        const key = flowBucket(tx);
        const existing = flowMixMap.get(key) || { label: key, total: 0 };
        existing.total = round2(existing.total + safeNum(tx.delta, 0));
        flowMixMap.set(key, existing);
      });

      const safeBuffer = round2(safeNum(account.safe_buffer, 150));
      const risk = lowPoint < 0 ? "critical" : projected14 < safeBuffer || lowPoint < safeBuffer ? "warning" : "stable";

      result[account.id] = {
        account,
        transactions: accountTxs,
        recentTransactions: accountTxs.slice(0, 50),
        last30Delta,
        startBalance,
        monthIncome,
        monthBills,
        monthSpending,
        monthTransfersNet,
        nextBill,
        nextIncome,
        upcomingBills,
        scheduledDeposits,
        safeBuffer,
        projected14,
        projectedMonthEnd,
        projectedLowPoint: lowPoint,
        projectionEvents,
        atRisk: risk !== "stable",
        riskLevel: risk,
        flowMix: [...flowMixMap.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
      };
    });

    return result;
  }, [accounts, transactions, bills, incomeRows, defaultAccountId]);

  const totalCash = useMemo(
    () =>
      round2(
        accounts
          .filter((account) => isCashLikeAccount(account.account_type))
          .reduce((sum, account) => sum + safeNum(account.balance, 0), 0)
      ),
    [accounts]
  );

  const checkingTotal = useMemo(
    () =>
      round2(
        accounts
          .filter((account) => String(account.account_type || "").toLowerCase().includes("checking"))
          .reduce((sum, account) => sum + safeNum(account.balance, 0), 0)
      ),
    [accounts]
  );

  const savingsTotal = useMemo(
    () =>
      round2(
        accounts
          .filter((account) => String(account.account_type || "").toLowerCase().includes("savings"))
          .reduce((sum, account) => sum + safeNum(account.balance, 0), 0)
      ),
    [accounts]
  );

  const atRiskCount = useMemo(() => accounts.filter((account) => summaryById[account.id]?.atRisk).length, [accounts, summaryById]);

  const visibleAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    const filtered = accounts.filter((account) => {
      const summary = summaryById[account.id];
      if (accountFilter === "at_risk" && !summary?.atRisk) return false;
      if (accountFilter !== "all" && accountFilter !== "at_risk") {
        if (!typeMatches(account.account_type, accountFilter)) return false;
      }
      if (!q) return true;
      return [account.name, normalizeAccountType(account.account_type)].join(" ").toLowerCase().includes(q);
    });

    const riskRank = { critical: 3, warning: 2, stable: 1 };
    return filtered.sort((a, b) => {
      const aPrimary = a.id === defaultAccountId ? 1 : 0;
      const bPrimary = b.id === defaultAccountId ? 1 : 0;
      if (aPrimary !== bPrimary) return bPrimary - aPrimary;
      const aRisk = riskRank[summaryById[a.id]?.riskLevel || "stable"] || 0;
      const bRisk = riskRank[summaryById[b.id]?.riskLevel || "stable"] || 0;
      if (aRisk !== bRisk) return bRisk - aRisk;
      return Math.abs(safeNum(b.balance, 0)) - Math.abs(safeNum(a.balance, 0));
    });
  }, [accounts, accountSearch, accountFilter, summaryById, defaultAccountId]);

  useEffect(() => {
    if (!visibleAccounts.length) {
      setSelectedAccountId("");
      return;
    }
    const exists = visibleAccounts.some((account) => account.id === selectedAccountId);
    if (!exists) {
      const preferred = visibleAccounts.find((account) => account.id === defaultAccountId) || visibleAccounts[0];
      setSelectedAccountId(preferred.id);
    }
  }, [visibleAccounts, selectedAccountId, defaultAccountId]);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) || visibleAccounts[0] || null;
  const selectedSummary = selectedAccount ? summaryById[selectedAccount.id] : null;
  const selectedRisk = riskMeta(selectedSummary);

  const selectedBars = useMemo(() => {
    if (!selectedSummary || !selectedAccount) return [];
    return buildBalanceBars(selectedSummary.transactions, selectedAccount.balance, 14);
  }, [selectedSummary, selectedAccount?.id, selectedAccount?.balance]);

  useEffect(() => {
    if (!selectedAccount) return;
    setTransferForm((prev) => {
      const keep = prev.toAccountId && prev.toAccountId !== selectedAccount.id && accounts.some((account) => account.id === prev.toAccountId);
      if (keep) return prev;
      return emptyTransferForm(selectedAccount.id, accounts);
    });
    setAdjustForm(emptyAdjustForm(selectedAccount));
  }, [selectedAccount?.id, selectedAccount?.safe_buffer, accounts]);

  useEffect(() => {
    if (selectedAccountId) setMobileSection("focus");
  }, [selectedAccountId]);

  async function setPrimaryAccount() {
    if (!supabase || !userId || !selectedAccount || busy) return;
    setBusy(true);
    setPageError("");
    try {
      const { error } = await supabase.from("account_settings").upsert(
        {
          user_id: userId,
          primary_account_id: selectedAccount.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      setStatus("Primary account updated.");
      await loadAccountsPage();
    } catch (err) {
      setPageError(err?.message || "Could not set primary account.");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount() {
    if (!supabase || !userId || busy) return;

    const name = String(createForm.name || "").trim();
    const safeBuffer = round2(parseMoneyInput(createForm.safe_buffer));
    const openingBalance = round2(parseMoneyInput(createForm.opening_balance));

    if (!name) {
      setPageError("Account name required.");
      return;
    }
    if (!Number.isFinite(safeBuffer) || safeBuffer < 0) {
      setPageError("Safe buffer must be 0 or greater.");
      return;
    }
    if (String(createForm.opening_balance || "").trim() !== "" && (!Number.isFinite(openingBalance) || openingBalance < 0)) {
      setPageError("Opening balance must be 0 or greater.");
      return;
    }

    setBusy(true);
    setPageError("");
    const accountId = uid();

    try {
      const { error: insertError } = await supabase.from("accounts").insert({
        id: accountId,
        user_id: userId,
        name,
        account_type: createForm.account_type || "checking",
        balance: 0,
        safe_buffer: round2(safeBuffer),
        updated_at: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      const cleanOpening = Number.isFinite(openingBalance) && openingBalance > 0 ? openingBalance : 0;
      if (cleanOpening > 0) {
        try {
          await writeAccountDelta({
            userId,
            accountId,
            delta: cleanOpening,
            kind: "opening_balance",
            amount: cleanOpening,
            note: "Opening balance",
            sourceType: "opening_balance",
            sourceId: accountId,
          });
        } catch (openingErr) {
          await supabase.from("accounts").delete().eq("id", accountId).eq("user_id", userId);
          throw openingErr;
        }
      }

      setCreateForm(emptyCreateForm());
      setOpenModal("");
      setStatus("Account created.");
      setSelectedAccountId(accountId);
      await loadAccountsPage();
    } catch (err) {
      setPageError(err?.message || "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  async function addManualAdjustment() {
    if (!supabase || !userId || !selectedAccount || busy) return;

    const rawAmount = round2(parseMoneyInput(adjustForm.amount));
    const note = String(adjustForm.note || "").trim();
    const parsedBuffer = round2(parseMoneyInput(adjustForm.safe_buffer));
    const hasBufferInput = Number.isFinite(parsedBuffer) && parsedBuffer >= 0;
    const balanceChangeValid = Number.isFinite(rawAmount) && rawAmount > 0;
    const signedDelta = balanceChangeValid ? (adjustForm.mode === "subtract" ? -Math.abs(rawAmount) : Math.abs(rawAmount)) : 0;
    const originalSafeBuffer = round2(safeNum(selectedAccount.safe_buffer, 150));
    const nextSafeBuffer = hasBufferInput ? parsedBuffer : originalSafeBuffer;
    const hasBufferChange = nextSafeBuffer !== originalSafeBuffer;
    const hasBalanceChange = signedDelta !== 0;

    if (!hasBalanceChange && !hasBufferChange) {
      setPageError("Enter an adjustment amount or change the safe buffer.");
      return;
    }
    if (!hasBufferInput) {
      setPageError("Enter a valid safe buffer.");
      return;
    }

    setBusy(true);
    setPageError("");

    try {
      if (hasBalanceChange) {
        await writeAccountDelta({
          userId,
          accountId: selectedAccount.id,
          delta: signedDelta,
          kind: adjustForm.mode === "subtract" ? "manual_debit" : "manual_credit",
          amount: Math.abs(rawAmount),
          note: note || "Manual adjustment",
          sourceType: "manual_adjustment",
          sourceId: uid(),
        });
      }

      if (hasBufferChange) {
        const { error } = await supabase
          .from("accounts")
          .update({ safe_buffer: nextSafeBuffer, updated_at: new Date().toISOString() })
          .eq("id", selectedAccount.id)
          .eq("user_id", userId);
        if (error) throw error;
      }

      setAdjustForm(emptyAdjustForm(selectedAccount));
      setOpenModal("");
      setStatus(hasBalanceChange ? "Adjustment applied." : "Safe buffer updated.");
      await loadAccountsPage();
    } catch (err) {
      setPageError(err?.message || "Could not apply changes.");
      await loadAccountsPage();
    } finally {
      setBusy(false);
    }
  }

  async function submitTransfer() {
    if (!userId || !selectedAccount || busy) return;

    const amount = round2(parseMoneyInput(transferForm.amount));
    const note = String(transferForm.note || "").trim();
    const target = accounts.find((account) => account.id === transferForm.toAccountId);

    if (!target || target.id === selectedAccount.id) {
      setPageError("Choose a different account for the transfer.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setPageError("Enter a valid transfer amount.");
      return;
    }

    setBusy(true);
    setPageError("");

    try {
      await writeAccountTransfer({
        userId,
        fromAccountId: selectedAccount.id,
        toAccountId: target.id,
        amount,
        note: note || `Transfer to ${target.name}`,
        sourceType: "manual_transfer",
        sourceId: uid(),
      });
      setTransferForm(emptyTransferForm(selectedAccount.id, accounts));
      setOpenModal("");
      setStatus("Transfer completed.");
      await loadAccountsPage();
    } catch (err) {
      setPageError(err?.message || "Could not complete transfer.");
      await loadAccountsPage();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="accCmdRoot">
          <div className="accCmdGate">Loading account command…</div>
        </div>
        <style jsx global>{styles}</style>
      </>
    );
  }

  if (!userId) {
    return (
      <>
        <div className="accCmdRoot">
          <div className="accCmdGate">Sign in to use accounts.</div>
        </div>
        <style jsx global>{styles}</style>
      </>
    );
  }

  return (
    <>
      <div className="accCmdRoot">
        <SummaryStrip
          accounts={accounts}
          totalCash={totalCash}
          checkingTotal={checkingTotal}
          savingsTotal={savingsTotal}
          atRiskCount={atRiskCount}
          selectedAccount={selectedAccount}
          selectedRisk={selectedRisk}
        />

        <div className="accCmdMobileTabs">
          {[
            { value: "list", label: "Accounts" },
            { value: "focus", label: "Detail" },
            { value: "tools", label: "Tools" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              className={`accCmdMobileTab ${mobileSection === item.value ? "accCmdMobileTab_active" : ""}`}
              onClick={() => setMobileSection(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="accCmdWorkspace">
          <section className={`accCmdCol accCmdCol_left ${mobileSection === "list" ? "accCmdCol_show" : ""}`}>
            <QueuePane
              visibleAccounts={visibleAccounts}
              summaryById={summaryById}
              selectedAccount={selectedAccount}
              onSelect={setSelectedAccountId}
              accountSearch={accountSearch}
              setAccountSearch={setAccountSearch}
              accountFilter={accountFilter}
              setAccountFilter={setAccountFilter}
              defaultAccountId={defaultAccountId}
            />
          </section>

          <section className={`accCmdCol accCmdCol_center ${mobileSection === "focus" ? "accCmdCol_show" : ""}`}>
            <FocusPane
              selectedAccount={selectedAccount}
              selectedSummary={selectedSummary}
              selectedBars={selectedBars}
              tab={tab}
              setTab={setTab}
              defaultAccountId={defaultAccountId}
            />
          </section>

          <section className={`accCmdCol accCmdCol_right ${mobileSection === "tools" ? "accCmdCol_show" : ""}`}>
            <ActionRail
              selectedAccount={selectedAccount}
              selectedSummary={selectedSummary}
              selectedRisk={selectedRisk}
              defaultAccountId={defaultAccountId}
              busy={busy}
              onCreate={() => {
                setCreateForm(emptyCreateForm());
                setOpenModal("create");
                setMobileSection("tools");
              }}
              onSetPrimary={setPrimaryAccount}
              onAdjust={() => {
                setAdjustForm(emptyAdjustForm(selectedAccount));
                setOpenModal("adjust");
                setMobileSection("tools");
              }}
              onTransfer={() => {
                setTransferForm(emptyTransferForm(selectedAccount?.id || "", accounts));
                setOpenModal("transfer");
                setMobileSection("tools");
              }}
            />
          </section>
        </div>
      </div>

      <ModalShell
        open={openModal === "create"}
        title="Create Account"
        subcopy="Add a real account shell, then route the opening balance through the shared ledger."
        onClose={() => setOpenModal("")}
        footer={
          <>
            <Button onClick={() => setOpenModal("")}>Cancel</Button>
            <Button variant="primary" onClick={createAccount} disabled={busy}>
              <Save size={13} /> {busy ? "Saving…" : "Create"}
            </Button>
          </>
        }
      >
        <div className="accCmdFormGrid">
          <label className="accCmdFieldWrap">
            <span>Account Name</span>
            <input className="accCmdField" value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Checking, Cash, Emergency Fund…" />
          </label>
          <label className="accCmdFieldWrap">
            <span>Account Type</span>
            <select className="accCmdField" value={createForm.account_type} onChange={(e) => setCreateForm((prev) => ({ ...prev, account_type: e.target.value }))}>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="cash">Cash</option>
              <option value="credit">Credit</option>
              <option value="investment">Investment</option>
            </select>
          </label>
          <label className="accCmdFieldWrap">
            <span>Opening Balance</span>
            <input className="accCmdField" value={createForm.opening_balance} onChange={(e) => setCreateForm((prev) => ({ ...prev, opening_balance: e.target.value }))} placeholder="0.00" inputMode="decimal" />
          </label>
          <label className="accCmdFieldWrap">
            <span>Safe Buffer</span>
            <input className="accCmdField" value={createForm.safe_buffer} onChange={(e) => setCreateForm((prev) => ({ ...prev, safe_buffer: e.target.value }))} placeholder="150.00" inputMode="decimal" />
          </label>
        </div>
      </ModalShell>

      <ModalShell
        open={openModal === "adjust"}
        title="Adjust Account / Safe Buffer"
        subcopy="Balance moves hit the shared ledger. Buffer changes update the account record only."
        onClose={() => setOpenModal("")}
        footer={
          <>
            <Button onClick={() => setOpenModal("")}>Cancel</Button>
            <Button variant="primary" onClick={addManualAdjustment} disabled={busy}>
              <Save size={13} /> {busy ? "Saving…" : "Apply"}
            </Button>
          </>
        }
      >
        <div className="accCmdToggleRow">
          <Button variant={adjustForm.mode === "add" ? "primary" : "ghost"} onClick={() => setAdjustForm((prev) => ({ ...prev, mode: "add" }))}>
            Add
          </Button>
          <Button variant={adjustForm.mode === "subtract" ? "primary" : "ghost"} onClick={() => setAdjustForm((prev) => ({ ...prev, mode: "subtract" }))}>
            Subtract
          </Button>
        </div>
        <div className="accCmdFormGrid">
          <label className="accCmdFieldWrap">
            <span>Adjustment Amount</span>
            <input className="accCmdField" value={adjustForm.amount} onChange={(e) => setAdjustForm((prev) => ({ ...prev, amount: e.target.value }))} placeholder="0.00" inputMode="decimal" />
          </label>
          <label className="accCmdFieldWrap">
            <span>Safe Buffer</span>
            <input className="accCmdField" value={adjustForm.safe_buffer} onChange={(e) => setAdjustForm((prev) => ({ ...prev, safe_buffer: e.target.value }))} placeholder="150.00" inputMode="decimal" />
          </label>
        </div>
        <label className="accCmdFieldWrap">
          <span>Note</span>
          <input className="accCmdField" value={adjustForm.note} onChange={(e) => setAdjustForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Optional note…" />
        </label>
      </ModalShell>

      <ModalShell
        open={openModal === "transfer"}
        title="Transfer Between Accounts"
        subcopy="Moves cash through the shared transfer writer so both balances and both ledger rows stay aligned."
        onClose={() => setOpenModal("")}
        footer={
          <>
            <Button onClick={() => setOpenModal("")}>Cancel</Button>
            <Button variant="primary" onClick={submitTransfer} disabled={busy}>
              <Save size={13} /> {busy ? "Sending…" : "Transfer"}
            </Button>
          </>
        }
      >
        <div className="accCmdFormGrid">
          <label className="accCmdFieldWrap">
            <span>From</span>
            <input className="accCmdField" value={selectedAccount?.name || ""} readOnly />
          </label>
          <label className="accCmdFieldWrap">
            <span>To</span>
            <select className="accCmdField" value={transferForm.toAccountId} onChange={(e) => setTransferForm((prev) => ({ ...prev, toAccountId: e.target.value }))}>
              <option value="">Choose account</option>
              {accounts.filter((account) => account.id !== selectedAccount?.id).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="accCmdFieldWrap">
            <span>Amount</span>
            <input className="accCmdField" value={transferForm.amount} onChange={(e) => setTransferForm((prev) => ({ ...prev, amount: e.target.value }))} placeholder="0.00" inputMode="decimal" />
          </label>
          <label className="accCmdFieldWrap">
            <span>Note</span>
            <input className="accCmdField" value={transferForm.note} onChange={(e) => setTransferForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Optional note…" />
          </label>
        </div>
      </ModalShell>

      <Toast error={pageError} status={status} onClearError={() => setPageError("")} />
      <style jsx global>{styles}</style>
    </>
  );
}

const styles = `
  .accCmdRoot {
    min-height: calc(100svh - 24px);
    display: grid;
    grid-template-rows: auto auto 1fr;
    gap: 12px;
    color: var(--lcc-text, #f7fbff);
  }

  .accCmdGate {
    min-height: 60svh;
    display: grid;
    place-items: center;
    color: rgba(255,255,255,0.62);
  }

  .accCmdSummaryStrip,
  .accCmdLeftPane,
  .accCmdCenterPane,
  .accCmdRightPane,
  .accCmdModal {
    border-radius: 18px;
    border: 1px solid rgba(214,226,255,0.12);
    background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02)), rgba(10,13,21,0.84);
    box-shadow: 0 18px 50px rgba(0,0,0,0.28);
  }

  .accCmdSummaryStrip {
    padding: 16px 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .accCmdSummaryLeft,
  .accCmdSummaryRight,
  .accCmdSummaryMiniList,
  .accCmdActionList,
  .accCmdToggleRow,
  .accCmdMobileTabs,
  .accCmdTabRow {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
  }

  .accCmdTitleWrap {
    display: grid;
    gap: 4px;
  }

  .accCmdEyebrow,
  .accCmdMiniLabel,
  .accCmdCommandLabel,
  .accCmdBalanceLabel {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    font-weight: 800;
    color: rgba(255,255,255,0.42);
  }

  .accCmdPageTitle,
  .accCmdFocusTitle,
  .accCmdModalTitle {
    font-size: clamp(24px, 2vw, 30px);
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  .accCmdMiniStat,
  .accCmdCommandStat,
  .accCmdStoryCell,
  .accCmdPanel,
  .accCmdQueueRow,
  .accCmdDataRow,
  .accCmdEmptyBlock,
  .accCmdEmptyInline {
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.1);
    background: rgba(255,255,255,0.03);
  }

  .accCmdMiniStat {
    min-width: 120px;
    padding: 10px 12px;
    display: grid;
    gap: 4px;
  }

  .accCmdMiniValue,
  .accCmdQueueAmount,
  .accCmdDataAmount,
  .accCmdCommandValue,
  .accCmdStoryValue {
    font-weight: 850;
    letter-spacing: -0.03em;
  }

  .accCmdMiniValue {
    font-size: 16px;
  }

  .accCmdWorkspace {
    display: grid;
    grid-template-columns: 0.92fr 1.4fr 0.88fr;
    gap: 12px;
    min-height: 0;
  }

  .accCmdCol {
    min-width: 0;
    min-height: 0;
  }

  .accCmdLeftPane,
  .accCmdRightPane {
    padding: 14px;
    display: grid;
    gap: 12px;
  }

  .accCmdCenterPane {
    min-height: 0;
    overflow: auto;
    padding: 14px;
  }

  .accCmdCenterPane_empty {
    display: grid;
    place-items: center;
  }

  .accCmdLeftHead,
  .accCmdCenterHead,
  .accCmdPanelHead,
  .accCmdTrendMiniHead,
  .accCmdQueueTop {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  }

  .accCmdPaneTitle,
  .accCmdPanelTitle,
  .accCmdTrendMiniTitle {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .accCmdPaneSub,
  .accCmdPanelSub,
  .accCmdFocusMeta,
  .accCmdCommandSub,
  .accCmdDataSub,
  .accCmdStorySub,
  .accCmdModalSub,
  .accCmdQuickInfoRow,
  .accCmdRuleRow,
  .accCmdBarsEmpty,
  .accCmdEmptyInline,
  .accCmdEmptyBlock {
    color: rgba(255,255,255,0.62);
    font-size: 13px;
    line-height: 1.5;
  }

  .accCmdSearch {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 12px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.12);
    background: rgba(255,255,255,0.03);
    color: rgba(255,255,255,0.62);
  }

  .accCmdSearch input,
  .accCmdField {
    font: inherit;
  }

  .accCmdSearch input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: #fff;
  }

  .accCmdSearchClear,
  .accCmdCloseBtn,
  .accCmdMobileTab,
  .accCmdTab,
  .accCmdBtn,
  .accCmdField {
    font: inherit;
  }

  .accCmdSearchClear,
  .accCmdCloseBtn {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
    color: rgba(255,255,255,0.62);
    cursor: pointer;
  }

  .accCmdField {
    width: 100%;
    min-height: 40px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.12);
    background: rgba(255,255,255,0.03);
    color: #fff;
    outline: 0;
  }

  .accCmdQueueList,
  .accCmdDataList,
  .accCmdMiniList,
  .accCmdQuickInfoList,
  .accCmdActionList {
    display: grid;
    gap: 10px;
  }

  .accCmdQueueList {
    max-height: calc(100svh - 300px);
    overflow: auto;
    padding-right: 2px;
  }

  .accCmdQueueRow {
    width: 100%;
    padding: 12px;
    display: grid;
    grid-template-columns: 4px 42px 1fr auto;
    gap: 12px;
    color: #fff;
    cursor: pointer;
    text-align: left;
  }

  .accCmdQueueRow_active {
    border-color: rgba(143,177,255,0.24);
    background: rgba(255,255,255,0.05);
  }

  .accCmdQueueAccent {
    border-radius: 999px;
    min-height: 100%;
  }

  .accCmdQueueIcon {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.12);
    background: rgba(255,255,255,0.03);
  }

  .accCmdQueueMain,
  .accCmdBalanceBlock,
  .accCmdTrendMini,
  .accCmdTitleWrap {
    min-width: 0;
  }

  .accCmdQueueTitleWrap,
  .accCmdBalancePills {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .accCmdQueueName {
    font-size: 14px;
    font-weight: 800;
  }

  .accCmdQueueMeta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
    font-size: 12px;
    color: rgba(255,255,255,0.62);
    margin-top: 6px;
  }

  .accCmdCommandCard,
  .accCmdPanel.compact {
    display: grid;
    gap: 12px;
  }

  .accCmdCommandCard,
  .accCmdPanel {
    padding: 14px;
  }

  .accCmdCommandTop {
    display: grid;
    grid-template-columns: 0.95fr 1.05fr;
    gap: 12px;
  }

  .accCmdBalanceValue {
    margin-top: 6px;
    font-size: clamp(28px, 2.4vw, 40px);
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.05em;
  }

  .accCmdCommandGrid,
  .accCmdStoryGrid,
  .accCmdFormGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .accCmdCommandStat {
    padding: 12px;
    display: grid;
    gap: 6px;
  }

  .accCmdDataRow {
    padding: 12px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .accCmdDataTitle {
    font-size: 14px;
    font-weight: 700;
    color: #fff;
  }

  .accCmdStoryCell {
    padding: 14px;
    display: grid;
    gap: 6px;
  }

  .accCmdStoryCell.accent-green {
    border-color: rgba(143,240,191,0.16);
  }

  .accCmdStoryCell.accent-amber {
    border-color: rgba(255,204,112,0.16);
  }

  .accCmdStoryCell.accent-red {
    border-color: rgba(255,132,163,0.16);
  }

  .text-green {
    color: #97efc7;
  }

  .text-amber {
    color: #f5cf88;
  }

  .text-red {
    color: #ffb4c5;
  }

  .accCmdBarCol {
    width: 100%;
    display: flex;
    align-items: flex-end;
  }

  .accCmdBarsWrap {
    height: 92px;
    display: grid;
    grid-template-columns: repeat(14, minmax(0, 1fr));
    gap: 6px;
    align-items: end;
  }

  .accCmdBarFill {
    width: 100%;
    min-height: 8px;
    border-radius: 999px 999px 6px 6px;
    background: linear-gradient(180deg, rgba(143,177,255,0.85), rgba(143,177,255,0.18));
    box-shadow: 0 0 18px rgba(143,177,255,0.16);
  }

  .accCmdActivityLayout {
    display: grid;
    grid-template-columns: 1.08fr 0.92fr;
    gap: 12px;
  }

  .accCmdAsideStack,
  .accCmdCenterScroll {
    display: grid;
    gap: 12px;
  }

  .accCmdQuickInfoRow,
  .accCmdRuleRow {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .accCmdRuleRow {
    justify-content: flex-start;
    padding: 0;
    border-bottom: 0;
  }

  .accCmdQuickInfoRow:last-child {
    border-bottom: 0;
  }

  .accCmdTabRow {
    padding: 0 2px;
  }

  .accCmdTab,
  .accCmdMobileTab,
  .accCmdBtn {
    min-height: 36px;
    padding: 0 13px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.12);
    background: rgba(255,255,255,0.03);
    color: #fff;
    cursor: pointer;
  }

  .accCmdTab_active,
  .accCmdMobileTab_active,
  .accCmdBtn_primary {
    border-color: rgba(143,177,255,0.24);
    background: linear-gradient(180deg, rgba(143,177,255,0.18), rgba(143,177,255,0.05));
  }

  .accCmdBtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .accCmdBtn_full {
    width: 100%;
  }

  .accCmdBtn:disabled,
  .accCmdTab:disabled,
  .accCmdMobileTab:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .accCmdOverlay {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: grid;
    place-items: center;
    padding: 16px;
  }

  .accCmdBackdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(0,0,0,0.62);
    backdrop-filter: blur(8px);
    cursor: pointer;
  }

  .accCmdModal {
    position: relative;
    z-index: 1;
    width: min(680px, calc(100vw - 24px));
    max-height: calc(100svh - 24px);
    display: grid;
    grid-template-rows: auto 1fr auto;
  }

  .accCmdModalHead,
  .accCmdModalFoot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 16px 0;
  }

  .accCmdModalBody {
    padding: 16px;
    overflow: auto;
    display: grid;
    gap: 12px;
  }

  .accCmdModalFoot {
    justify-content: flex-end;
    padding: 0 16px 16px;
  }

  .accCmdFieldWrap {
    display: grid;
    gap: 8px;
    color: rgba(255,255,255,0.72);
    font-size: 12px;
    font-weight: 700;
  }

  .accCmdToastStack {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 95;
    width: min(420px, calc(100vw - 32px));
    display: grid;
    gap: 8px;
  }

  .accCmdToast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.12);
    background: rgba(9,12,20,0.96);
    box-shadow: 0 18px 50px rgba(0,0,0,0.28);
  }

  .accCmdToast_success {
    color: #97efc7;
  }

  .accCmdToast_error {
    color: #ffb4c5;
  }

  .accCmdToastClose {
    margin-left: auto;
    width: 24px;
    height: 24px;
    border: 0;
    background: transparent;
    color: currentColor;
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  .accCmdEmptyBlock,
  .accCmdEmptyInline {
    padding: 14px;
  }

  .accCmdMobileTabs {
    display: none;
  }

  @media (max-width: 1180px) {
    .accCmdWorkspace {
      grid-template-columns: 1fr;
    }
    .accCmdCol {
      display: none;
    }
    .accCmdCol_show {
      display: block;
    }
    .accCmdMobileTabs {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .accCmdQueueList {
      max-height: none;
    }
  }

  @media (max-width: 860px) {
    .accCmdSummaryStrip,
    .accCmdSummaryLeft,
    .accCmdSummaryRight {
      align-items: flex-start;
    }
    .accCmdSummaryStrip {
      flex-direction: column;
    }
    .accCmdCommandTop,
    .accCmdCommandGrid,
    .accCmdActivityLayout,
    .accCmdStoryGrid,
    .accCmdFormGrid {
      grid-template-columns: 1fr;
    }
    .accCmdQueueRow {
      grid-template-columns: 4px 42px 1fr;
    }
  }
`;
