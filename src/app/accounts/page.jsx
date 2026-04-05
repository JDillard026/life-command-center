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
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const META_PREFIX = "__LCC_META__";

/* ──────────────────────────────────────────────────────────────────────────
   helpers
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

function shortDate(dateValue) {
  if (!dateValue) return "—";
  const d = new Date(dateValue);
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

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function dateInputToday() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateValue, days) {
  const d = new Date(dateValue);
  d.setDate(d.getDate() + days);
  return d;
}

function isFutureDate(dateValue) {
  if (!dateValue) return false;
  const target = new Date(`${String(dateValue).slice(0, 10)}T12:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return target.getTime() > today.getTime();
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const target = new Date(`${String(dateValue).slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(target.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function monthStart(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function monthEnd(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
}

function dayKey(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
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
        accountName: "",
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

function amountFromBill(bill) {
  return round2(safeNum(bill.amount, 0) + safeNum(bill.extra_pay, 0));
}

function billTitle(bill) {
  return bill.category || bill.notes || "Bill";
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

function riskMeta(summary) {
  if (!summary) {
    return {
      tone: "blue",
      label: "Stable",
      detail: "This account looks stable right now.",
      chipTone: "blue",
    };
  }

  if (summary.projectedLowPoint < 0) {
    return {
      tone: "red",
      label: "Critical cash risk",
      detail: "This account is projected to dip below zero soon.",
      chipTone: "red",
    };
  }

  if (
    summary.projected14 < summary.safeBuffer ||
    summary.projectedLowPoint < summary.safeBuffer
  ) {
    return {
      tone: "amber",
      label: "Low buffer risk",
      detail: "This account is projected below its safe buffer soon.",
      chipTone: "amber",
    };
  }

  return {
    tone: "green",
    label: "Stable",
    detail: "This account looks stable right now.",
    chipTone: "green",
  };
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

/* ──────────────────────────────────────────────────────────────────────────
   ui
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
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))",
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
      className={`accCmdBtn accCmdBtn_${variant} accCmdBtn_${size} ${
        full ? "accCmdBtn_full" : ""
      }`}
    >
      {children}
    </button>
  );
}

function TabBtn({ label, active, onClick }) {
  return (
    <button
      type="button"
      className={`accCmdTab ${active ? "accCmdTab_active" : ""}`}
      onClick={onClick}
    >
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
          <button
            type="button"
            onClick={onClearError}
            className="accCmdToastClose"
            aria-label="Dismiss"
          >
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

/* ──────────────────────────────────────────────────────────────────────────
   top strip
   ────────────────────────────────────────────────────────────────────────── */

function SummaryStrip({
  accounts,
  totalCash,
  checkingTotal,
  savingsTotal,
  atRiskCount,
  selectedAccount,
  selectedRisk,
}) {
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
        {selectedAccount ? (
          <MiniPill tone={selectedRisk?.chipTone || "blue"}>
            {selectedAccount.name}
          </MiniPill>
        ) : null}
        <MiniPill tone={atRiskCount > 0 ? "amber" : "green"}>
          {atRiskCount} at risk
        </MiniPill>
        <MiniPill tone="green">{fmtMoney(totalCash)} total cash</MiniPill>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   left queue
   ────────────────────────────────────────────────────────────────────────── */

function AccountQueueRow({
  account,
  summary,
  selected,
  onSelect,
  isPrimary,
}) {
  const tone = riskMeta(summary).chipTone || accountTone(account.account_type);
  const meta = toneMeta(tone);

  return (
    <button
      type="button"
      className={`accCmdQueueRow ${selected ? "accCmdQueueRow_active" : ""}`}
      onClick={onSelect}
    >
      <div
        className="accCmdQueueAccent"
        style={{ background: selected ? meta.text : "transparent" }}
      />

      <div
        className="accCmdQueueIcon"
        style={{
          color: meta.text,
          borderColor: meta.border,
          boxShadow: `0 0 16px ${meta.glow}`,
        }}
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
          <span
            style={{
              color: safeNum(summary?.last30Delta, 0) >= 0 ? "#97efc7" : "#ffb4c5",
            }}
          >
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

function QueuePane({
  visibleAccounts,
  summaryById,
  selectedAccount,
  onSelect,
  accountSearch,
  setAccountSearch,
  accountFilter,
  setAccountFilter,
  defaultAccountId,
}) {
  return (
    <div className="accCmdLeftPane">
      <div className="accCmdLeftHead">
        <div>
          <div className="accCmdPaneTitle">Accounts</div>
          <div className="accCmdPaneSub">Open one into the workspace.</div>
        </div>

        <div className="accCmdSearch">
          <Search size={14} />
          <input
            value={accountSearch}
            onChange={(e) => setAccountSearch(e.target.value)}
            placeholder="Search accounts…"
          />
          {accountSearch ? (
            <button
              type="button"
              className="accCmdSearchClear"
              onClick={() => setAccountSearch("")}
            >
              <X size={12} />
            </button>
          ) : null}
        </div>

        <select
          className="accCmdField"
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
        >
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

/* ──────────────────────────────────────────────────────────────────────────
   center focus
   ────────────────────────────────────────────────────────────────────────── */

function BalanceBars({ bars = [] }) {
  if (!bars.length) {
    return <div className="accCmdBarsEmpty">No recent balance movement yet.</div>;
  }

  return (
    <div className="accCmdBarsWrap">
      {bars.map((bar) => (
        <div
          key={bar.key}
          className="accCmdBarCol"
          title={`${bar.label} • ${fmtMoney(bar.value)}`}
        >
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
      <strong
        className="accCmdCommandValue"
        style={{ color: tone === "neutral" ? "#fff" : meta.text }}
      >
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
        <div
          className="accCmdDataSub"
          style={{ color: afterPositive ? "rgba(255,255,255,0.58)" : "#ffb4c5" }}
        >
          After {fmtMoney(event.afterBalance)}
        </div>
      </div>
    </div>
  );
}

function QuickInfoRow({ label, value, tone = "neutral" }) {
  const color =
    tone === "green"
      ? "#97efc7"
      : tone === "amber"
      ? "#f5cf88"
      : tone === "red"
      ? "#ffb4c5"
      : "#fff";

  return (
    <div className="accCmdQuickInfoRow">
      <span>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

function FocusPane({
  selectedAccount,
  selectedSummary,
  selectedBars,
  tab,
  setTab,
  defaultAccountId,
}) {
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
            {normalizeAccountType(selectedAccount.account_type)} • Updated{" "}
            {formatAgo(selectedAccount.updated_at)}
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
              tone={
                selectedSummary.projected14 < selectedSummary.safeBuffer ? "amber" : "neutral"
              }
            />
            <CommandStat
              label="Safe Buffer"
              value={fmtMoney(selectedSummary.safeBuffer)}
              sub="Local warning line for this account"
            />
            <CommandStat
              label="Next Bill"
              value={selectedSummary.nextBill ? shortDate(selectedSummary.nextBill.due_date) : "Clear"}
              sub={
                selectedSummary.nextBill
                  ? `${billTitle(selectedSummary.nextBill)} • ${fmtMoney(
                      amountFromBill(selectedSummary.nextBill)
                    )}`
                  : "No linked outgoing bill"
              }
              tone={selectedSummary.nextBill ? "amber" : "neutral"}
            />
            <CommandStat
              label="Next Deposit"
              value={
                selectedSummary.nextIncome
                  ? shortDate(selectedSummary.nextIncome.deposit_date)
                  : "None"
              }
              sub={
                selectedSummary.nextIncome
                  ? `${selectedSummary.nextIncome.source} • ${fmtMoney(
                      selectedSummary.nextIncome.amount
                    )}`
                  : "No scheduled incoming deposit"
              }
              tone={selectedSummary.nextIncome ? "green" : "neutral"}
            />
          </div>
        </div>

        <div className="accCmdTabRow">
          <TabBtn label="Activity" active={tab === "activity"} onClick={() => setTab("activity")} />
          <TabBtn label="Balance Story" active={tab === "story"} onClick={() => setTab("story")} />
          <TabBtn
            label="Recurring Flow"
            active={tab === "recurring"}
            onClick={() => setTab("recurring")}
          />
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
                  <QuickInfoRow
                    label="Income added"
                    value={`+${fmtMoney(selectedSummary.monthIncome)}`}
                    tone="green"
                  />
                  <QuickInfoRow
                    label="Bills paid"
                    value={`-${fmtMoney(selectedSummary.monthBills)}`}
                    tone="amber"
                  />
                  <QuickInfoRow
                    label="Spending"
                    value={`-${fmtMoney(selectedSummary.monthSpending)}`}
                    tone="red"
                  />
                  <QuickInfoRow
                    label="Transfers"
                    value={`${
                      safeNum(selectedSummary.monthTransfersNet, 0) >= 0 ? "+" : ""
                    }${fmtMoney(selectedSummary.monthTransfersNet)}`}
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
                        <div className="accCmdDataSub">
                          {shortDate(selectedSummary.nextIncome.deposit_date)}
                        </div>
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
                        <div className="accCmdDataSub">
                          {shortDate(selectedSummary.nextBill.due_date)}
                        </div>
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
                </div>
                <div className="accCmdStoryCell">
                  <div className="accCmdBalanceLabel">Income Added</div>
                  <div className="accCmdStoryValue" style={{ color: "#97efc7" }}>
                    +{fmtMoney(selectedSummary.monthIncome)}
                  </div>
                </div>
                <div className="accCmdStoryCell">
                  <div className="accCmdBalanceLabel">Bills Paid</div>
                  <div className="accCmdStoryValue" style={{ color: "#f5cf88" }}>
                    -{fmtMoney(selectedSummary.monthBills)}
                  </div>
                </div>
                <div className="accCmdStoryCell">
                  <div className="accCmdBalanceLabel">Spending</div>
                  <div className="accCmdStoryValue" style={{ color: "#ffb4c5" }}>
                    -{fmtMoney(selectedSummary.monthSpending)}
                  </div>
                </div>
                <div className="accCmdStoryCell">
                  <div className="accCmdBalanceLabel">Transfers</div>
                  <div
                    className="accCmdStoryValue"
                    style={{
                      color:
                        safeNum(selectedSummary.monthTransfersNet, 0) >= 0 ? "#97efc7" : "#ffb4c5",
                    }}
                  >
                    {safeNum(selectedSummary.monthTransfersNet, 0) >= 0 ? "+" : ""}
                    {fmtMoney(selectedSummary.monthTransfersNet)}
                  </div>
                </div>
                <div className="accCmdStoryCell accCmdStoryCell_strong">
                  <div className="accCmdBalanceLabel">Current Balance</div>
                  <div className="accCmdStoryValue">{fmtMoney(selectedAccount.balance)}</div>
                </div>
              </div>
            </div>

            <div className="accCmdPanel compact">
              <div className="accCmdPanelHead">
                <div>
                  <div className="accCmdPanelTitle">Projected Month-End</div>
                  <div className="accCmdPanelSub">Current balance plus remaining flow this month.</div>
                </div>
              </div>

              <div className="accCmdBigNumber">{fmtMoney(selectedSummary.projectedMonthEnd)}</div>

              <div className="accCmdFlowList">
                {selectedSummary.flowMix.length ? (
                  selectedSummary.flowMix.map((item) => (
                    <div key={item.label} className="accCmdFlowRow">
                      <span>{item.label}</span>
                      <span>
                        {item.total >= 0 ? "+" : ""}
                        {fmtMoney(item.total)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="accCmdEmptyInline">No month-to-date flow yet.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "recurring" ? (
          <div className="accCmdTwoCol">
            <div className="accCmdPanel">
              <div className="accCmdPanelHead">
                <div>
                  <div className="accCmdPanelTitle">Scheduled Deposits</div>
                  <div className="accCmdPanelSub">Income routed into this account.</div>
                </div>
                <MiniPill tone="green">{selectedSummary.scheduledDeposits.length}</MiniPill>
              </div>

              <div className="accCmdMiniList">
                {selectedSummary.scheduledDeposits.length ? (
                  selectedSummary.scheduledDeposits.map((item) => (
                    <div key={item.id} className="accCmdDataRow">
                      <div>
                        <div className="accCmdDataTitle">{item.source}</div>
                        <div className="accCmdDataSub">
                          {shortDate(item.deposit_date)} •{" "}
                          {daysUntil(item.deposit_date) === 0
                            ? "today"
                            : `${daysUntil(item.deposit_date)}d`}
                        </div>
                      </div>

                      <div className="accCmdDataAmount" style={{ color: "#97efc7" }}>
                        +{fmtMoney(item.amount)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="accCmdEmptyInline">No scheduled income routed here.</div>
                )}
              </div>
            </div>

            <div className="accCmdPanel">
              <div className="accCmdPanelHead">
                <div>
                  <div className="accCmdPanelTitle">Linked Bills</div>
                  <div className="accCmdPanelSub">Outgoing bills tied to this account.</div>
                </div>
                <MiniPill tone="amber">{selectedSummary.upcomingBills.length}</MiniPill>
              </div>

              <div className="accCmdMiniList">
                {selectedSummary.upcomingBills.length ? (
                  selectedSummary.upcomingBills.map((bill) => (
                    <div key={bill.id} className="accCmdDataRow">
                      <div>
                        <div className="accCmdDataTitle">{billTitle(bill)}</div>
                        <div className="accCmdDataSub">
                          {shortDate(bill.due_date)} •{" "}
                          {daysUntil(bill.due_date) === 0 ? "today" : `${daysUntil(bill.due_date)}d`}
                        </div>
                      </div>

                      <div className="accCmdDataAmount" style={{ color: "#f5cf88" }}>
                        -{fmtMoney(amountFromBill(bill))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="accCmdEmptyInline">No active bills linked to this account.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "forecast" ? (
          <div className="accCmdPanel">
            <div className="accCmdPanelHead">
              <div>
                <div className="accCmdPanelTitle">Forecast</div>
                <div className="accCmdPanelSub">
                  What is about to happen over the next 30 days.
                </div>
              </div>
              <MiniPill>{selectedSummary.projectionEvents.length} events</MiniPill>
            </div>

            <div className="accCmdForecastTiles">
              <CommandStat
                label="Safe Buffer"
                value={fmtMoney(selectedSummary.safeBuffer)}
                sub="Local warning threshold for this account"
              />
              <CommandStat
                label="Low Point"
                value={fmtMoney(selectedSummary.projectedLowPoint)}
                sub="Worst projected balance in the next 30 days"
                tone={
                  selectedSummary.projectedLowPoint < 0
                    ? "red"
                    : selectedSummary.projectedLowPoint < selectedSummary.safeBuffer
                    ? "amber"
                    : "neutral"
                }
              />
              <CommandStat
                label="30D End"
                value={
                  selectedSummary.projectionEvents.length
                    ? fmtMoney(
                        selectedSummary.projectionEvents[
                          selectedSummary.projectionEvents.length - 1
                        ].afterBalance
                      )
                    : fmtMoney(selectedAccount.balance)
                }
                sub="Balance if every scheduled hit lands"
              />
            </div>

            {selectedSummary.projectionEvents.length ? (
              <div className="accCmdDataList">
                {selectedSummary.projectionEvents.map((event) => (
                  <ForecastEventRow key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="accCmdEmptyInline">
                Forecast is clean. No upcoming linked income or bills are scheduled.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   right rail
   ────────────────────────────────────────────────────────────────────────── */

function ToolRail({
  selectedAccount,
  selectedSummary,
  defaultAccountId,
  busy,
  onSetPrimary,
  onOpenAdjust,
  onOpenTransfer,
  onRefresh,
}) {
  if (!selectedAccount || !selectedSummary) {
    return (
      <div className="accCmdRightPane">
        <div className="accCmdEmptyBlock">Select an account.</div>
      </div>
    );
  }

  const risk = riskMeta(selectedSummary);

  return (
    <div className="accCmdRightPane">
      <div className="accCmdRailSection">
        <div className="accCmdRailLabel">Quick Actions</div>
        <div className="accCmdRailActionStack">
          <Button
            variant={defaultAccountId === selectedAccount.id ? "ghost" : "primary"}
            full
            onClick={onSetPrimary}
            disabled={busy}
          >
            <Save size={14} />
            {defaultAccountId === selectedAccount.id ? "Already Primary" : "Set as Primary"}
          </Button>

          <Button variant="ghost" full onClick={onOpenAdjust}>
            <Plus size={14} />
            Adjust Balance
          </Button>

          <Button variant="ghost" full onClick={onOpenTransfer}>
            <ArrowRightLeft size={14} />
            Transfer Money
          </Button>

          <Button variant="ghost" full onClick={onRefresh} disabled={busy}>
            <RefreshCw size={14} />
            Refresh Data
          </Button>
        </div>
      </div>

      <div className="accCmdRailSection">
        <div className="accCmdRailLabel">Signals</div>

        <div className="accCmdSignalStack">
          <div className="accCmdSignalCard">
            <span>Safe Buffer</span>
            <strong>{fmtMoney(selectedSummary.safeBuffer)}</strong>
            <small>Local warning line</small>
          </div>

          <div className="accCmdSignalCard">
            <span>Projected 14D</span>
            <strong
              style={{
                color:
                  selectedSummary.projected14 < selectedSummary.safeBuffer
                    ? "#f5cf88"
                    : "#fff",
              }}
            >
              {fmtMoney(selectedSummary.projected14)}
            </strong>
            <small>Two week balance view</small>
          </div>

          <div className="accCmdSignalCard">
            <span>Low Point</span>
            <strong
              style={{
                color:
                  selectedSummary.projectedLowPoint < 0
                    ? "#ffb4c5"
                    : selectedSummary.projectedLowPoint < selectedSummary.safeBuffer
                    ? "#f5cf88"
                    : "#fff",
              }}
            >
              {fmtMoney(selectedSummary.projectedLowPoint)}
            </strong>
            <small>Worst projected 30D balance</small>
          </div>
        </div>
      </div>

      <div className="accCmdRailSection accCmdRailSection_fill">
        <div className="accCmdRailLabel">Next Hits</div>

        <div className="accCmdMiniList">
          {selectedSummary.nextIncome ? (
            <div className="accCmdDataRow">
              <div>
                <div className="accCmdDataTitle">{selectedSummary.nextIncome.source}</div>
                <div className="accCmdDataSub">
                  {shortDate(selectedSummary.nextIncome.deposit_date)}
                </div>
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

        <div className="accCmdRailSpacer" />

        <div className="accCmdInfoCard">
          <div className="accCmdTinyLabel">Warning Engine</div>
          <div className="accCmdWarningRow">
            {risk.tone === "red" || risk.tone === "amber" ? (
              <>
                <ShieldAlert size={14} />
                <span>{risk.detail}</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>{risk.detail}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   modals
   ────────────────────────────────────────────────────────────────────────── */

function AdjustModal({
  open,
  onClose,
  selectedAccount,
  adjustForm,
  setAdjustForm,
  onSubmit,
  busy,
  safeBufferValue,
  setSafeBufferValue,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Adjust Balance"
      subcopy={
        selectedAccount
          ? `Manual correction for ${selectedAccount.name}`
          : "Manual balance correction"
      }
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} disabled={busy}>
            <Save size={14} />
            {busy ? "Saving…" : "Apply Changes"}
          </Button>
        </>
      }
    >
      <div className="accCmdModalGrid">
        <div className="accCmdInfoCard">
          <div className="accCmdTinyLabel">Mode</div>
          <div className="accCmdModeRow">
            <Button
              variant={adjustForm.mode === "add" ? "primary" : "ghost"}
              onClick={() => setAdjustForm((prev) => ({ ...prev, mode: "add" }))}
            >
              + Add
            </Button>
            <Button
              variant={adjustForm.mode === "subtract" ? "primary" : "ghost"}
              onClick={() => setAdjustForm((prev) => ({ ...prev, mode: "subtract" }))}
            >
              - Subtract
            </Button>
          </div>
        </div>

        <div>
          <div className="accCmdTinyLabel">Amount</div>
          <input
            className="accCmdField"
            inputMode="decimal"
            placeholder="0.00"
            value={adjustForm.amount}
            onChange={(e) =>
              setAdjustForm((prev) => ({
                ...prev,
                amount: e.target.value,
              }))
            }
          />
        </div>

        <div>
          <div className="accCmdTinyLabel">Note</div>
          <textarea
            className="accCmdField"
            rows={5}
            placeholder="Why this correction is being made…"
            value={adjustForm.note}
            onChange={(e) =>
              setAdjustForm((prev) => ({
                ...prev,
                note: e.target.value,
              }))
            }
          />
        </div>

        <div>
          <div className="accCmdTinyLabel">Safe Buffer</div>
          <input
            className="accCmdField"
            inputMode="decimal"
            placeholder="150.00"
            value={safeBufferValue}
            onChange={(e) => setSafeBufferValue(e.target.value)}
          />
        </div>
      </div>
    </ModalShell>
  );
}

function TransferModal({
  open,
  onClose,
  selectedAccount,
  accounts,
  transferForm,
  setTransferForm,
  onSubmit,
  busy,
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Transfer Money"
      subcopy={
        selectedAccount
          ? `Move money out of ${selectedAccount.name}`
          : "Move money between accounts"
      }
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} disabled={busy}>
            <ArrowRightLeft size={14} />
            {busy ? "Moving…" : "Move Money"}
          </Button>
        </>
      }
    >
      <div className="accCmdModalGrid">
        <div>
          <div className="accCmdTinyLabel">From Account</div>
          <div className="accCmdInfoCard">
            <div className="accCmdInfoValue">{selectedAccount?.name || "Account"}</div>
            <div className="accCmdInfoSub">Current transfer source</div>
          </div>
        </div>

        <div>
          <div className="accCmdTinyLabel">To Account</div>
          <select
            className="accCmdField"
            value={transferForm.toAccountId}
            onChange={(e) =>
              setTransferForm((prev) => ({
                ...prev,
                toAccountId: e.target.value,
              }))
            }
          >
            <option value="">Select account</option>
            {accounts
              .filter((account) => account.id !== selectedAccount?.id)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <div className="accCmdTinyLabel">Amount</div>
          <input
            className="accCmdField"
            inputMode="decimal"
            placeholder="0.00"
            value={transferForm.amount}
            onChange={(e) =>
              setTransferForm((prev) => ({
                ...prev,
                amount: e.target.value,
              }))
            }
          />
        </div>

        <div>
          <div className="accCmdTinyLabel">Note</div>
          <textarea
            className="accCmdField"
            rows={5}
            placeholder="Optional transfer note…"
            value={transferForm.note}
            onChange={(e) =>
              setTransferForm((prev) => ({
                ...prev,
                note: e.target.value,
              }))
            }
          />
        </div>
      </div>
    </ModalShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   page
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
  const [userId, setUserId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState("");
  const [status, setStatus] = useState("");

  const [adjustForm, setAdjustForm] = useState({
    mode: "add",
    amount: "",
    note: "",
  });
  const [transferForm, setTransferForm] = useState({
    toAccountId: "",
    amount: "",
    note: "",
  });
  const [openModal, setOpenModal] = useState(null);
  const [bufferDraft, setBufferDraft] = useState("150");

  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(""), 3200);
    return () => clearTimeout(id);
  }, [status]);

  const loadAccountsPage = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setPageError("Supabase client is not available.");
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

      setUserId(session.user.id);

      const [accountsRes, txRes, settingsRes, billsRes, incomeRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, user_id, name, account_type, balance, safe_buffer, updated_at")
          .eq("user_id", session.user.id)
          .order("name", { ascending: true }),
        supabase
          .from("account_transactions")
          .select(
            "id, user_id, account_id, kind, amount, delta, resulting_balance, note, related_account_id, related_account_name, source_type, source_id, created_at"
          )
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("account_settings")
          .select("primary_account_id")
          .eq("user_id", session.user.id)
          .maybeSingle(),
        supabase
          .from("bills")
          .select(
            "id, user_id, account_id, amount, due_date, active, category, notes, frequency, min_pay, extra_pay, balance"
          )
          .eq("user_id", session.user.id)
          .order("due_date", { ascending: true }),
        supabase
          .from("income_deposits")
          .select("id, user_id, source, amount, note, deposit_date, created_at, updated_at")
          .eq("user_id", session.user.id)
          .order("deposit_date", { ascending: true }),
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (txRes.error) throw txRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (billsRes.error) throw billsRes.error;
      if (incomeRes.error) throw incomeRes.error;

      const loadedAccounts = accountsRes.data || [];
      const primaryAccountId = settingsRes.data?.primary_account_id || "";

      setAccounts(loadedAccounts);
      setTransactions(txRes.data || []);
      setBills((billsRes.data || []).filter((row) => row.active !== false));
      setIncomeRows(incomeRes.data || []);
      setDefaultAccountId(primaryAccountId);

      setSelectedAccountId((prev) => {
        if (prev && loadedAccounts.some((account) => account.id === prev)) return prev;
        if (primaryAccountId && loadedAccounts.some((account) => account.id === primaryAccountId)) {
          return primaryAccountId;
        }
        return loadedAccounts[0]?.id || "";
      });
    } catch (err) {
      setPageError(err?.message || "Failed to load accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccountsPage();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadAccountsPage();
    });

    return () => {
      subscription?.unsubscribe?.();
    };
  }, [loadAccountsPage]);

  const summaryById = useMemo(() => {
    const now = new Date();
    const todayIso = dateInputToday();
    const next14Iso = addDays(new Date(), 14).toISOString().slice(0, 10);
    const next30Iso = addDays(new Date(), 30).toISOString().slice(0, 10);
    const monthStartIso = monthStart(now).toISOString();
    const monthEndIso = monthEnd(now).toISOString().slice(0, 10);

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

    const upcomingIncomeMap = new Map(accounts.map((account) => [account.id, []]));
    incomeRows.forEach((row) => {
      const routed = getIncomeRouting(row, defaultAccountId);
      if (routed.posted || routed.status !== "scheduled") return;

      routed.shares.forEach((share) => {
        if (!upcomingIncomeMap.has(share.accountId)) return;
        upcomingIncomeMap.get(share.accountId).push({
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
      const accountTxs = (txMap.get(account.id) || []).sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      const monthTxs = accountTxs.filter(
        (tx) => new Date(tx.created_at || 0).getTime() >= new Date(monthStartIso).getTime()
      );

      const last30Cutoff = addDays(new Date(), -30).getTime();
      const last30Delta = round2(
        accountTxs
          .filter((tx) => new Date(tx.created_at || 0).getTime() >= last30Cutoff)
          .reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0)
      );

      const monthIncome = round2(
        monthTxs
          .filter((tx) => safeNum(tx.delta, 0) > 0 && !isTransferRow(tx))
          .reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0)
      );

      const monthBills = round2(
        monthTxs
          .filter((tx) => safeNum(tx.delta, 0) < 0 && isBillRow(tx))
          .reduce((sum, tx) => sum + Math.abs(safeNum(tx.delta, 0)), 0)
      );

      const monthSpending = round2(
        monthTxs
          .filter((tx) => safeNum(tx.delta, 0) < 0 && !isBillRow(tx) && !isTransferRow(tx))
          .reduce((sum, tx) => sum + Math.abs(safeNum(tx.delta, 0)), 0)
      );

      const monthTransfersNet = round2(
        monthTxs
          .filter((tx) => isTransferRow(tx))
          .reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0)
      );

      const monthNet = round2(monthTxs.reduce((sum, tx) => sum + safeNum(tx.delta, 0), 0));
      const startBalance = round2(safeNum(account.balance, 0) - monthNet);

      const upcomingBills = (billMap.get(account.id) || [])
        .filter((bill) => bill.due_date && String(bill.due_date).slice(0, 10) >= todayIso)
        .sort(
          (a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime()
        );

      const scheduledDeposits = (upcomingIncomeMap.get(account.id) || [])
        .filter((item) => item.deposit_date && String(item.deposit_date).slice(0, 10) >= todayIso)
        .sort(
          (a, b) =>
            new Date(a.deposit_date || 0).getTime() - new Date(b.deposit_date || 0).getTime()
        );

      const nextBill = upcomingBills[0] || null;
      const nextIncome = scheduledDeposits[0] || null;

      const bill14 = round2(
        upcomingBills
          .filter((bill) => String(bill.due_date).slice(0, 10) <= next14Iso)
          .reduce((sum, bill) => sum + amountFromBill(bill), 0)
      );

      const income14 = round2(
        scheduledDeposits
          .filter((item) => String(item.deposit_date).slice(0, 10) <= next14Iso)
          .reduce((sum, item) => sum + safeNum(item.amount, 0), 0)
      );

      const futureBillsMonth = round2(
        upcomingBills
          .filter((bill) => String(bill.due_date).slice(0, 10) <= monthEndIso)
          .reduce((sum, bill) => sum + amountFromBill(bill), 0)
      );

      const futureIncomeMonth = round2(
        scheduledDeposits
          .filter((item) => String(item.deposit_date).slice(0, 10) <= monthEndIso)
          .reduce((sum, item) => sum + safeNum(item.amount, 0), 0)
      );

      const safeBuffer = safeNum(account.safe_buffer, 150);
      const projected14 = round2(safeNum(account.balance, 0) + income14 - bill14);
      const projectedMonthEnd = round2(
        safeNum(account.balance, 0) + futureIncomeMonth - futureBillsMonth
      );

      const projectionEvents = [
        ...scheduledDeposits
          .filter((item) => String(item.deposit_date).slice(0, 10) <= next30Iso)
          .map((item) => ({
            id: `income-${item.id}`,
            kind: "income",
            date: item.deposit_date,
            label: item.source || "Scheduled income",
            delta: round2(item.amount),
          })),
        ...upcomingBills
          .filter((bill) => String(bill.due_date).slice(0, 10) <= next30Iso)
          .map((bill) => ({
            id: `bill-${bill.id}`,
            kind: "bill",
            date: bill.due_date,
            label: billTitle(bill),
            delta: round2(-amountFromBill(bill)),
          })),
      ].sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

      let running = round2(account.balance);
      let lowPoint = running;

      const projectionEventsWithAfter = projectionEvents.map((event) => {
        running = round2(running + safeNum(event.delta, 0));
        if (running < lowPoint) lowPoint = running;

        return {
          ...event,
          afterBalance: running,
        };
      });

      const flowMixMap = new Map();
      monthTxs.forEach((tx) => {
        const key = flowBucket(tx);
        const existing = flowMixMap.get(key) || { label: key, total: 0 };
        existing.total = round2(existing.total + safeNum(tx.delta, 0));
        flowMixMap.set(key, existing);
      });

      const risk =
        lowPoint < 0
          ? "critical"
          : projected14 < safeBuffer || lowPoint < safeBuffer
          ? "warning"
          : "stable";

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
        projectedLowPoint: round2(lowPoint),
        projectionEvents: projectionEventsWithAfter,
        atRisk: risk !== "stable",
        riskLevel: risk,
        flowMix: [...flowMixMap.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
      };
    });

    return result;
  }, [accounts, transactions, bills, incomeRows, defaultAccountId]);

  const totalCash = useMemo(() => {
    return round2(
      accounts
        .filter((account) => isCashLikeAccount(account.account_type))
        .reduce((sum, account) => sum + safeNum(account.balance, 0), 0)
    );
  }, [accounts]);

  const checkingTotal = useMemo(() => {
    return round2(
      accounts
        .filter((account) => String(account.account_type || "").toLowerCase().includes("checking"))
        .reduce((sum, account) => sum + safeNum(account.balance, 0), 0)
    );
  }, [accounts]);

  const savingsTotal = useMemo(() => {
    return round2(
      accounts
        .filter((account) => String(account.account_type || "").toLowerCase().includes("savings"))
        .reduce((sum, account) => sum + safeNum(account.balance, 0), 0)
    );
  }, [accounts]);

  const atRiskCount = useMemo(() => {
    return accounts.filter((account) => summaryById[account.id]?.atRisk).length;
  }, [accounts, summaryById]);

  const visibleAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();

    const filtered = accounts.filter((account) => {
      const summary = summaryById[account.id];
      if (accountFilter === "at_risk" && !summary?.atRisk) return false;
      if (accountFilter !== "all" && accountFilter !== "at_risk") {
        if (!typeMatches(account.account_type, accountFilter)) return false;
      }

      if (!q) return true;

      return [account.name, normalizeAccountType(account.account_type)]
        .join(" ")
        .toLowerCase()
        .includes(q);
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
      const preferred =
        visibleAccounts.find((account) => account.id === defaultAccountId) || visibleAccounts[0];
      setSelectedAccountId(preferred.id);
    }
  }, [visibleAccounts, selectedAccountId, defaultAccountId]);

  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) || visibleAccounts[0] || null;

  const selectedSummary = selectedAccount ? summaryById[selectedAccount.id] : null;
  const selectedRisk = riskMeta(selectedSummary);

  const selectedBars = useMemo(() => {
    if (!selectedSummary || !selectedAccount) return [];
    return buildBalanceBars(selectedSummary.transactions, selectedAccount.balance, 14);
  }, [selectedSummary, selectedAccount?.id, selectedAccount?.balance]);

  useEffect(() => {
    if (!selectedAccount) return;

    setTransferForm((prev) => {
      if (prev.toAccountId && prev.toAccountId !== selectedAccount.id) return prev;
      const fallback = accounts.find((account) => account.id !== selectedAccount.id)?.id || "";
      return {
        ...prev,
        toAccountId: fallback,
      };
    });
  }, [selectedAccount?.id, accounts]);

  useEffect(() => {
    if (!selectedAccount) return;
    setBufferDraft(String(safeNum(selectedAccount.safe_buffer, 150)));
  }, [selectedAccount?.id, selectedAccount?.safe_buffer]);

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

  async function addManualAdjustment() {
    if (!supabase || !userId || !selectedAccount || busy) return;

    const rawAmount = round2(parseMoneyInput(adjustForm.amount));
    const note = String(adjustForm.note || "").trim();
    const parsedBuffer = round2(parseMoneyInput(bufferDraft));
    const hasBufferInput = Number.isFinite(parsedBuffer) && parsedBuffer >= 0;

    const balanceChangeValid = Number.isFinite(rawAmount) && rawAmount > 0;
    const signedDelta = balanceChangeValid
      ? adjustForm.mode === "subtract"
        ? -Math.abs(rawAmount)
        : Math.abs(rawAmount)
      : 0;

    const originalBalance = round2(safeNum(selectedAccount.balance, 0));
    const originalSafeBuffer = round2(safeNum(selectedAccount.safe_buffer, 150));
    const nextBalance = round2(originalBalance + signedDelta);
    const nextSafeBuffer = hasBufferInput ? parsedBuffer : originalSafeBuffer;

    const hasBufferChange = nextSafeBuffer !== originalSafeBuffer;
    const hasBalanceChange = signedDelta !== 0;

    if (!hasBalanceChange && !hasBufferChange) {
      setPageError("Enter an adjustment amount or change the safe buffer.");
      return;
    }

    if (!hasBufferInput && bufferDraft.trim() !== "") {
      setPageError("Enter a valid safe buffer.");
      return;
    }

    const nowIso = new Date().toISOString();

    setBusy(true);
    setPageError("");

    try {
      const updateRes = await supabase
        .from("accounts")
        .update({
          balance: nextBalance,
          safe_buffer: nextSafeBuffer,
          updated_at: nowIso,
        })
        .eq("id", selectedAccount.id)
        .eq("user_id", userId);

      if (updateRes.error) throw updateRes.error;

      if (hasBalanceChange) {
        const insertRes = await supabase.from("account_transactions").insert({
          user_id: userId,
          account_id: selectedAccount.id,
          kind: adjustForm.mode === "subtract" ? "manual_debit" : "manual_credit",
          amount: Math.abs(rawAmount),
          delta: signedDelta,
          resulting_balance: nextBalance,
          note: note || "Manual adjustment",
          related_account_id: null,
          related_account_name: null,
          source_type: "manual_adjustment",
          source_id: uid(),
          created_at: nowIso,
        });

        if (insertRes.error) {
          await supabase
            .from("accounts")
            .update({
              balance: originalBalance,
              safe_buffer: originalSafeBuffer,
              updated_at: new Date().toISOString(),
            })
            .eq("id", selectedAccount.id)
            .eq("user_id", userId);

          throw insertRes.error;
        }
      }

      setAdjustForm({
        mode: "add",
        amount: "",
        note: "",
      });
      setOpenModal(null);
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
    if (!supabase || !userId || !selectedAccount || busy) return;

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

    const sourceOriginalBalance = round2(safeNum(selectedAccount.balance, 0));
    const targetOriginalBalance = round2(safeNum(target.balance, 0));
    const sourceNextBalance = round2(sourceOriginalBalance - amount);
    const targetNextBalance = round2(targetOriginalBalance + amount);
    const nowIso = new Date().toISOString();
    const transferId = uid();

    setBusy(true);
    setPageError("");

    try {
      const sourceUpdate = await supabase
        .from("accounts")
        .update({
          balance: sourceNextBalance,
          updated_at: nowIso,
        })
        .eq("id", selectedAccount.id)
        .eq("user_id", userId);

      if (sourceUpdate.error) throw sourceUpdate.error;

      const targetUpdate = await supabase
        .from("accounts")
        .update({
          balance: targetNextBalance,
          updated_at: nowIso,
        })
        .eq("id", target.id)
        .eq("user_id", userId);

      if (targetUpdate.error) {
        await supabase
          .from("accounts")
          .update({
            balance: sourceOriginalBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedAccount.id)
          .eq("user_id", userId);

        throw targetUpdate.error;
      }

      const txRes = await supabase.from("account_transactions").insert([
        {
          user_id: userId,
          account_id: selectedAccount.id,
          kind: "transfer_out",
          amount,
          delta: -amount,
          resulting_balance: sourceNextBalance,
          note: note || `Transfer to ${target.name}`,
          related_account_id: target.id,
          related_account_name: target.name || "",
          source_type: "manual_transfer",
          source_id: transferId,
          created_at: nowIso,
        },
        {
          user_id: userId,
          account_id: target.id,
          kind: "transfer_in",
          amount,
          delta: amount,
          resulting_balance: targetNextBalance,
          note: note || `Transfer from ${selectedAccount.name}`,
          related_account_id: selectedAccount.id,
          related_account_name: selectedAccount.name || "",
          source_type: "manual_transfer",
          source_id: transferId,
          created_at: nowIso,
        },
      ]);

      if (txRes.error) {
        await supabase
          .from("accounts")
          .update({
            balance: sourceOriginalBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedAccount.id)
          .eq("user_id", userId);

        await supabase
          .from("accounts")
          .update({
            balance: targetOriginalBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", target.id)
          .eq("user_id", userId);

        throw txRes.error;
      }

      setTransferForm({
        toAccountId: target.id,
        amount: "",
        note: "",
      });
      setOpenModal(null);
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
            { v: "list", l: "Accounts" },
            { v: "focus", l: "Detail" },
            { v: "tools", l: "Tools" },
          ].map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => setMobileSection(s.v)}
              className={`accCmdMobileTab ${
                mobileSection === s.v ? "accCmdMobileTab_active" : ""
              }`}
            >
              {s.l}
            </button>
          ))}
        </div>

        <div className="accCmdWorkspace">
          <section className={`accCmdCol ${mobileSection === "list" ? "accCmdCol_show" : ""}`}>
            <QueuePane
              visibleAccounts={visibleAccounts}
              summaryById={summaryById}
              selectedAccount={selectedAccount}
              onSelect={(accountId) => {
                setSelectedAccountId(accountId);
                setMobileSection("focus");
              }}
              accountSearch={accountSearch}
              setAccountSearch={setAccountSearch}
              accountFilter={accountFilter}
              setAccountFilter={setAccountFilter}
              defaultAccountId={defaultAccountId}
            />
          </section>

          <section className={`accCmdCol ${mobileSection === "focus" ? "accCmdCol_show" : ""}`}>
            <FocusPane
              selectedAccount={selectedAccount}
              selectedSummary={selectedSummary}
              selectedBars={selectedBars}
              tab={tab}
              setTab={setTab}
              defaultAccountId={defaultAccountId}
            />
          </section>

          <section className={`accCmdCol ${mobileSection === "tools" ? "accCmdCol_show" : ""}`}>
            <ToolRail
              selectedAccount={selectedAccount}
              selectedSummary={selectedSummary}
              defaultAccountId={defaultAccountId}
              busy={busy}
              onSetPrimary={setPrimaryAccount}
              onOpenAdjust={() => setOpenModal("adjust")}
              onOpenTransfer={() => setOpenModal("transfer")}
              onRefresh={loadAccountsPage}
            />
          </section>
        </div>
      </div>

      <AdjustModal
        open={openModal === "adjust"}
        onClose={() => setOpenModal(null)}
        selectedAccount={selectedAccount}
        adjustForm={adjustForm}
        setAdjustForm={setAdjustForm}
        onSubmit={addManualAdjustment}
        busy={busy}
        safeBufferValue={bufferDraft}
        setSafeBufferValue={setBufferDraft}
      />

      <TransferModal
        open={openModal === "transfer"}
        onClose={() => setOpenModal(null)}
        selectedAccount={selectedAccount}
        accounts={accounts}
        transferForm={transferForm}
        setTransferForm={setTransferForm}
        onSubmit={submitTransfer}
        busy={busy}
      />

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
    color: var(--lcc-text);
  }

  .accCmdGate {
    min-height: 60svh;
    display: grid;
    place-items: center;
    color: var(--lcc-text-muted);
  }

  .accCmdSummaryStrip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 86px;
    padding: 16px 18px;
    border-radius: var(--lcc-radius-lg);
    border: 1px solid rgba(143, 177, 255, 0.12);
    background:
      radial-gradient(circle at top right, rgba(79, 142, 255, 0.10), transparent 28%),
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0)),
      rgba(18, 22, 32, 0.86);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.035),
      var(--lcc-shadow-sm);
  }

  .accCmdSummaryLeft {
    display: flex;
    align-items: center;
    gap: 18px;
    min-width: 0;
  }

  .accCmdTitleWrap {
    min-width: 0;
  }

  .accCmdEyebrow {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--lcc-text-soft);
  }

  .accCmdPageTitle {
    margin-top: 4px;
    font-size: clamp(24px, 2.4vw, 32px);
    line-height: 1;
    font-weight: 800;
    letter-spacing: -0.05em;
  }

  .accCmdSummaryMiniList {
    display: flex;
    align-items: stretch;
    gap: 10px;
    flex-wrap: wrap;
  }

  .accCmdMiniStat {
    min-width: 110px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.08);
    background: rgba(255,255,255,0.028);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.025);
  }

  .accCmdMiniLabel {
    display: block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--lcc-text-soft);
  }

  .accCmdMiniValue {
    display: block;
    margin-top: 5px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .accCmdSummaryRight {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .accCmdMobileTabs {
    display: none;
    border-radius: var(--lcc-radius-md);
    border: 1px solid var(--lcc-border);
    background: rgba(18, 22, 32, 0.78);
    overflow: hidden;
  }

  .accCmdMobileTab {
    flex: 1;
    min-height: 42px;
    border: 0;
    background: transparent;
    color: var(--lcc-text-soft);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .accCmdMobileTab_active {
    background: rgba(79, 142, 255, 0.10);
    color: var(--lcc-blue);
    box-shadow: inset 0 -2px 0 var(--lcc-blue);
  }

  .accCmdWorkspace {
    min-height: 0;
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr) 280px;
    gap: 12px;
    flex: 1;
  }

  .accCmdCol {
    min-height: 0;
    min-width: 0;
  }

  .accCmdLeftPane,
  .accCmdCenterPane,
  .accCmdRightPane {
    height: 100%;
    min-height: 0;
    border-radius: var(--lcc-radius-lg);
    border: 1px solid rgba(143, 177, 255, 0.10);
    background:
      radial-gradient(circle at top, rgba(79,142,255,0.07), transparent 24%),
      linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0) 48px),
      rgba(18, 22, 32, 0.88);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.03),
      var(--lcc-shadow-sm);
  }

  .accCmdLeftPane {
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
  }

  .accCmdLeftHead {
    padding: 12px;
    border-bottom: 1px solid rgba(214,226,255,0.08);
    display: grid;
    gap: 10px;
  }

  .accCmdPaneTitle {
    font-size: 17px;
    line-height: 1.08;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #fff;
  }

  .accCmdPaneSub {
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.45;
    color: rgba(255,255,255,0.60);
  }

  .accCmdSearch {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 42px;
    padding: 0 12px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.08);
    background: rgba(255,255,255,0.03);
    color: var(--lcc-text-soft);
  }

  .accCmdSearch input,
  .accCmdSearch input:focus {
    border: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
    padding: 0 !important;
    min-height: auto !important;
    color: var(--lcc-text);
    width: 100%;
  }

  .accCmdSearchClear {
    display: grid;
    place-items: center;
    padding: 0;
    color: var(--lcc-text-soft);
    cursor: pointer;
    flex-shrink: 0;
  }

  .accCmdField {
    width: 100%;
    min-height: 42px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.10);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012)),
      rgba(8, 12, 20, 0.76);
    color: var(--lcc-text);
    padding: 0 12px;
    outline: none;
    font: inherit;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
  }

  .accCmdField:focus {
    border-color: rgba(143,177,255,0.30);
    box-shadow:
      0 0 0 4px rgba(79,114,255,0.08),
      inset 0 1px 0 rgba(255,255,255,0.035);
  }

  .accCmdField option {
    background: #08111f;
    color: #f4f7ff;
  }

  textarea.accCmdField {
    min-height: 110px;
    resize: vertical;
    padding: 12px;
  }

  .accCmdQueueList {
    min-height: 0;
    overflow: auto;
    padding: 6px;
    display: grid;
    gap: 8px;
  }

  .accCmdQueueRow {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 14px 14px 14px;
    border: 1px solid rgba(214,226,255,0.06);
    border-radius: 18px;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.008)),
      rgba(10, 14, 22, 0.55);
    text-align: left;
    cursor: pointer;
    transition:
      background 140ms ease,
      border-color 140ms ease,
      transform 140ms ease,
      box-shadow 140ms ease;
  }

  .accCmdQueueRow:hover {
    transform: translateY(-1px);
    background: rgba(255,255,255,0.038);
    border-color: rgba(143,177,255,0.12);
  }

  .accCmdQueueRow_active {
    background:
      linear-gradient(180deg, rgba(79, 142, 255, 0.10), rgba(79,142,255,0.03)),
      rgba(10, 14, 22, 0.58);
    border-color: rgba(143,177,255,0.18);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.025),
      0 10px 24px rgba(9, 20, 48, 0.22);
  }

  .accCmdQueueAccent {
    width: 2px;
    align-self: stretch;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .accCmdQueueIcon {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.10);
    background: rgba(255,255,255,0.03);
  }

  .accCmdQueueMain {
    flex: 1;
    min-width: 0;
  }

  .accCmdQueueTop {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .accCmdQueueTitleWrap {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex-wrap: wrap;
  }

  .accCmdQueueName {
    font-size: 14px;
    font-weight: 800;
    color: #fff;
    min-width: 0;
    overflow-wrap: anywhere;
    letter-spacing: -0.02em;
  }

  .accCmdQueueAmount {
    font-size: 14px;
    font-weight: 900;
    color: #fff;
    white-space: nowrap;
    flex-shrink: 0;
    letter-spacing: -0.02em;
  }

  .accCmdQueueMeta {
    margin-top: 6px;
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    font-size: 11.5px;
    color: rgba(255,255,255,0.56);
  }

  .accCmdCenterPane {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 0;
    overflow: hidden;
  }

  .accCmdCenterPane_empty {
    display: grid;
    place-items: center;
  }

  .accCmdCenterHead {
    padding: 16px 18px 14px;
    border-bottom: 1px solid rgba(214,226,255,0.08);
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .accCmdFocusTitle {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: #fff;
  }

  .accCmdFocusMeta {
    margin-top: 5px;
    font-size: 12.5px;
    color: var(--lcc-text-soft);
  }

  .accCmdCenterScroll {
    min-height: 0;
    overflow: auto;
    padding: 14px;
    display: grid;
    gap: 12px;
    align-content: start;
  }

  .accCmdCommandCard,
  .accCmdPanel {
    padding: 15px 16px;
    border-radius: 18px;
    border: 1px solid rgba(214,226,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.012)),
      rgba(255,255,255,0.01);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
  }

  .accCmdPanel.compact {
    padding: 14px;
  }

  .accCmdCommandTop {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 290px;
    gap: 12px;
    align-items: stretch;
  }

  .accCmdBalanceBlock {
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .accCmdBalanceLabel,
  .accCmdTinyLabel,
  .accCmdCommandLabel {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .16em;
    font-weight: 800;
    color: rgba(255,255,255,0.42);
  }

  .accCmdBalanceValue {
    margin-top: 10px;
    font-size: clamp(36px, 4vw, 50px);
    line-height: 0.95;
    font-weight: 900;
    letter-spacing: -0.07em;
    color: #fff;
  }

  .accCmdBalancePills {
    margin-top: 14px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .accCmdTrendMini {
    border-radius: 16px;
    border: 1px solid rgba(214,226,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
    padding: 12px;
  }

  .accCmdTrendMiniHead {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 10px;
  }

  .accCmdTrendMiniTitle {
    font-size: 14px;
    font-weight: 800;
    color: #fff;
  }

  .accCmdBarsWrap {
    height: 96px;
    display: grid;
    grid-template-columns: repeat(14, minmax(0, 1fr));
    gap: 6px;
    align-items: end;
  }

  .accCmdBarCol {
    height: 100%;
    display: flex;
    align-items: end;
  }

  .accCmdBarFill {
    width: 100%;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(143,177,255,0.98), rgba(86,140,255,0.74));
    box-shadow: 0 0 18px rgba(86,140,255,0.18);
  }

  .accCmdBarsEmpty {
    min-height: 96px;
    display: grid;
    place-items: center;
    color: rgba(255,255,255,0.54);
    font-size: 12px;
    text-align: center;
  }

  .accCmdCommandGrid {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .accCmdCommandStat,
  .accCmdInfoCard,
  .accCmdSignalCard {
    padding: 12px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.03);
  }

  .accCmdCommandValue,
  .accCmdInfoValue,
  .accCmdStoryValue,
  .accCmdBigNumber,
  .accCmdSignalCard strong {
    display: block;
    margin-top: 6px;
    font-size: 16px;
    font-weight: 800;
    color: #fff;
  }

  .accCmdCommandSub,
  .accCmdInfoSub,
  .accCmdSignalCard small {
    display: block;
    margin-top: 5px;
    font-size: 11.5px;
    line-height: 1.45;
    color: rgba(255,255,255,0.58);
  }

  .accCmdSignalCard span {
    display: block;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .07em;
    color: rgba(255,255,255,0.42);
  }

  .accCmdTabRow {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .accCmdTab {
    min-height: 36px;
    padding: 0 13px;
    border-radius: 999px;
    border: 1px solid rgba(214,226,255,0.10);
    background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012));
    color: #fff;
    cursor: pointer;
    font-size: 12px;
    font-weight: 800;
  }

  .accCmdTab_active {
    border-color: rgba(143,177,255,0.24);
    background: linear-gradient(180deg, rgba(143,177,255,0.14), rgba(143,177,255,0.06));
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
  }

  .accCmdPanelHead {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .accCmdPanelTitle {
    font-size: 17px;
    line-height: 1.08;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #fff;
  }

  .accCmdPanelSub {
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.45;
    color: rgba(255,255,255,0.60);
  }

  .accCmdActivityLayout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 12px;
  }

  .accCmdAsideStack,
  .accCmdMiniList,
  .accCmdDataList {
    display: grid;
    gap: 10px;
  }

  .accCmdAsideStack {
    align-content: start;
  }

  .accCmdDataList {
    max-height: 540px;
    overflow: auto;
    padding-right: 2px;
  }

  .accCmdDataRow {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.06);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    padding: 12px;
  }

  .accCmdDataTitle {
    font-size: 13px;
    font-weight: 800;
    line-height: 1.2;
    color: #fff;
    overflow-wrap: anywhere;
  }

  .accCmdDataSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.35;
  }

  .accCmdDataAmount {
    font-size: 13.5px;
    font-weight: 800;
    color: #fff;
    white-space: nowrap;
  }

  .accCmdStoryLayout,
  .accCmdTwoCol {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .accCmdStoryGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .accCmdStoryCell {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.025);
    padding: 12px;
  }

  .accCmdStoryCell_strong {
    background: linear-gradient(180deg, rgba(143,177,255,0.10), rgba(143,177,255,0.04));
    border-color: rgba(143,177,255,0.18);
  }

  .accCmdBigNumber {
    font-size: 28px;
    letter-spacing: -0.04em;
    margin-bottom: 14px;
  }

  .accCmdQuickInfoList,
  .accCmdFlowList,
  .accCmdSignalStack {
    display: grid;
    gap: 8px;
  }

  .accCmdQuickInfoRow {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    color: rgba(255,255,255,0.76);
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding-bottom: 8px;
  }

  .accCmdQuickInfoRow:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  .accCmdFlowRow {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 12px;
    color: rgba(255,255,255,0.78);
  }

  .accCmdForecastTiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }

  .accCmdRightPane {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .accCmdRailSection {
    padding: 13px 12px;
    border-bottom: 1px solid rgba(214,226,255,0.08);
  }

  .accCmdRailSection_fill {
    border-bottom: 0;
    flex: 1;
    overflow: auto;
  }

  .accCmdRailLabel {
    margin-bottom: 10px;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--lcc-text-soft);
  }

  .accCmdRailActionStack,
  .accCmdFormStack {
    display: grid;
    gap: 8px;
  }

  .accCmdModeRow {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .accCmdWarningRow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: rgba(255,255,255,0.84);
    font-size: 12px;
    line-height: 1.4;
  }

  .accCmdRailSpacer {
    height: 10px;
  }

  .accCmdBtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 14px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
    transition:
      transform 120ms ease,
      background 120ms ease,
      border-color 120ms ease,
      opacity 120ms ease,
      box-shadow 120ms ease;
  }

  .accCmdBtn:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .accCmdBtn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .accCmdBtn_sm {
    min-height: 38px;
    padding: 0 12px;
    font-size: 13px;
  }

  .accCmdBtn_full {
    width: 100%;
  }

  .accCmdBtn_ghost {
    border: 1px solid rgba(214,226,255,0.08);
    background: rgba(255,255,255,0.04);
    color: var(--lcc-text-muted);
  }

  .accCmdBtn_ghost:hover:not(:disabled) {
    color: var(--lcc-text);
    background: rgba(255,255,255,0.07);
    border-color: rgba(143,177,255,0.18);
  }

  .accCmdBtn_primary {
    border: 1px solid rgba(79, 142, 255, 0.28);
    background: linear-gradient(180deg, #4f90ff, #3a7af0);
    color: #fff;
    box-shadow: 0 6px 18px rgba(58, 122, 240, 0.26);
  }

  .accCmdBtn_primary:hover:not(:disabled) {
    background: linear-gradient(180deg, #5a99ff, #4588f7);
  }

  .accCmdEmptyBlock,
  .accCmdEmptyInline {
    min-height: 160px;
    display: grid;
    place-items: center;
    color: rgba(255,255,255,0.58);
    font-size: 13px;
    text-align: center;
    padding: 16px;
  }

  .accCmdToastStack {
    position: fixed;
    right: 22px;
    bottom: 22px;
    z-index: 1500;
    display: grid;
    gap: 8px;
  }

  .accCmdToast {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 42px;
    padding: 0 12px;
    border-radius: 12px;
    font-size: 12.5px;
    font-weight: 700;
    box-shadow: var(--lcc-shadow-md);
  }

  .accCmdToast_success {
    color: var(--lcc-green);
    border: 1px solid rgba(34, 199, 125, 0.22);
    background: rgba(10, 24, 17, 0.96);
  }

  .accCmdToast_error {
    color: #ff8ea1;
    border: 1px solid rgba(224, 84, 106, 0.24);
    background: rgba(30, 11, 15, 0.96);
  }

  .accCmdToastClose {
    display: grid;
    place-items: center;
    padding: 0;
    margin-left: 4px;
    color: inherit;
    cursor: pointer;
  }

  .accCmdOverlay {
    position: fixed;
    inset: 0;
    z-index: 1400;
    display: grid;
    place-items: center;
    padding: 18px;
  }

  .accCmdBackdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(8, 11, 16, 0.76);
    backdrop-filter: blur(7px);
    -webkit-backdrop-filter: blur(7px);
    cursor: pointer;
  }

  .accCmdModal {
    position: relative;
    width: min(720px, 100%);
    max-height: min(84svh, 860px);
    display: grid;
    grid-template-rows: auto 1fr auto;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid rgba(143,177,255,0.16);
    background: rgba(15, 18, 27, 0.98);
    box-shadow: var(--lcc-shadow-lg);
  }

  .accCmdModalHead,
  .accCmdModalFoot {
    padding: 16px 18px;
    border-bottom: 1px solid rgba(214,226,255,0.08);
  }

  .accCmdModalFoot {
    border-bottom: 0;
    border-top: 1px solid rgba(214,226,255,0.08);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .accCmdModalHead {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .accCmdModalTitle {
    font-size: 19px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.03em;
  }

  .accCmdModalSub {
    margin-top: 4px;
    font-size: 12.5px;
    color: rgba(255,255,255,0.60);
  }

  .accCmdModalBody {
    min-height: 0;
    overflow: auto;
    padding: 18px;
  }

  .accCmdCloseBtn {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    border: 1px solid rgba(214,226,255,0.08);
    background: rgba(255,255,255,0.04);
    color: var(--lcc-text-muted);
    cursor: pointer;
  }

  .accCmdModalGrid {
    display: grid;
    gap: 14px;
  }

  @media (max-width: 1320px) {
    .accCmdWorkspace {
      grid-template-columns: 280px minmax(0, 1fr) 266px;
    }

    .accCmdCommandTop {
      grid-template-columns: 1fr;
    }

    .accCmdCommandGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .accCmdActivityLayout {
      grid-template-columns: 1fr;
    }

    .accCmdStoryGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 1180px) {
    .accCmdMobileTabs {
      display: flex;
    }

    .accCmdWorkspace {
      grid-template-columns: 1fr;
    }

    .accCmdCol {
      display: none;
    }

    .accCmdCol_show {
      display: block;
    }

    .accCmdLeftPane,
    .accCmdCenterPane,
    .accCmdRightPane {
      min-height: calc(100svh - 220px);
    }
  }

  @media (max-width: 860px) {
    .accCmdSummaryStrip {
      flex-direction: column;
      align-items: flex-start;
    }

    .accCmdSummaryLeft,
    .accCmdSummaryRight {
      width: 100%;
    }

    .accCmdSummaryRight {
      justify-content: flex-start;
    }

    .accCmdStoryLayout,
    .accCmdTwoCol,
    .accCmdForecastTiles,
    .accCmdStoryGrid,
    .accCmdCommandGrid {
      grid-template-columns: 1fr;
    }

    .accCmdCenterHead {
      flex-direction: column;
      align-items: stretch;
    }

    .accCmdDataRow {
      align-items: flex-start;
      flex-direction: column;
    }

    .accCmdModal {
      width: 100%;
    }
  }

  @media (max-width: 640px) {
    .accCmdRoot {
      min-height: calc(100svh - 16px);
      gap: 10px;
    }

    .accCmdSummaryStrip {
      padding: 14px;
    }

    .accCmdSummaryMiniList {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .accCmdCenterScroll {
      padding: 10px;
    }

    .accCmdToastStack {
      left: 12px;
      right: 12px;
      bottom: 12px;
    }

    .accCmdOverlay {
      padding: 10px;
    }
  }
`;