"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CalendarClock,
  Flame,
  Landmark,
  MoreHorizontal,
  PencilLine,
  Percent,
  Save,
  Search,
  ShieldAlert,
  Target,
  Trash2,
  TrendingDown,
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

const STRATEGY_OPTIONS = [
  { value: "avalanche", label: "Avalanche" },
  { value: "snowball", label: "Snowball" },
  { value: "urgent", label: "Urgent First" },
];

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

function parseIsoParts(iso) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const yyyy = Number(match[1]);
  const mm = Number(match[2]);
  const dd = Number(match[3]);

  if (![yyyy, mm, dd].every(Number.isFinite)) return null;
  return { yyyy, mm, dd };
}

function isoToLocalDate(iso, hour = 12) {
  const parts = parseIsoParts(iso);
  if (!parts) return null;
  return new Date(parts.yyyy, parts.mm - 1, parts.dd, hour, 0, 0, 0);
}

function isoDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isoSerial(iso) {
  const parts = parseIsoParts(iso);
  if (!parts) return null;
  return Math.floor(Date.UTC(parts.yyyy, parts.mm - 1, parts.dd) / 86400000);
}

function todaySerial() {
  const now = new Date();
  return Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000
  );
}

function compareIsoDates(a, b) {
  const aa = isoSerial(a);
  const bb = isoSerial(b);
  if (!Number.isFinite(aa) || !Number.isFinite(bb)) return 0;
  return aa - bb;
}

function monthKeyOf(dateValue) {
  const parts = parseIsoParts(dateValue);
  if (!parts) return "";
  return `${parts.yyyy}-${String(parts.mm).padStart(2, "0")}`;
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
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function shortDate(dateValue) {
  if (!dateValue) return "—";
  const d = isoToLocalDate(dateValue, 12);
  if (!d || !Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function currentMonthLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function daysUntil(iso) {
  const dueSerial = isoSerial(iso);
  if (!Number.isFinite(dueSerial)) return null;
  return dueSerial - todaySerial();
}

function dueMeta(days) {
  if (!Number.isFinite(days)) {
    return { label: "No due date", tone: "neutral", percent: 0 };
  }
  if (days < 0) {
    return {
      label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late`,
      tone: "red",
      percent: 100,
    };
  }
  if (days === 0) {
    return { label: "Due today", tone: "red", percent: 100 };
  }
  if (days <= 3) {
    return {
      label: `Due in ${days} day${days === 1 ? "" : "s"}`,
      tone: "red",
      percent: 92,
    };
  }
  if (days <= 7) {
    return { label: `Due in ${days} days`, tone: "amber", percent: 72 };
  }
  if (days <= 14) {
    return { label: `Due in ${days} days`, tone: "amber", percent: 48 };
  }
  return { label: `Due in ${days} days`, tone: "green", percent: 18 };
}

function compactDebtDueText(days) {
  if (!Number.isFinite(days)) return "No date";
  if (days < 0) return `${Math.abs(days)}d late`;
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function monthlyScheduledPayment(debt) {
  const min = safeNum(debt?.minPay, 0);
  const extra = safeNum(debt?.extraPay, 0);
  const fallback = safeNum(debt?.amount, 0);
  const base = min > 0 ? min : fallback;
  return round2(base + extra);
}

function monthlyMinimumPayment(debt) {
  const min = safeNum(debt?.minPay, 0);
  const fallback = safeNum(debt?.amount, 0);
  return round2(min > 0 ? min : fallback);
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
  if (tone === "green") {
    return {
      text: "#97efc7",
      border: "rgba(143, 240, 191, 0.18)",
      glow: "rgba(110, 229, 173, 0.10)",
      bg: "rgba(11, 22, 17, 0.66)",
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

function strategySubtitle(strategy) {
  if (strategy === "snowball") return "Smallest balance first for quick wins.";
  if (strategy === "urgent") return "Soonest due debt pushed to the top.";
  return "Highest APR first to cut interest drag.";
}

function sortDebtsForStrategy(list, strategy) {
  const clone = [...list];
  if (strategy === "snowball") {
    clone.sort((a, b) => {
      const balanceDiff = safeNum(a.balance, 0) - safeNum(b.balance, 0);
      if (balanceDiff !== 0) return balanceDiff;
      const aprDiff = safeNum(b.aprPct, 0) - safeNum(a.aprPct, 0);
      if (aprDiff !== 0) return aprDiff;
      return compareIsoDates(a.dueDate, b.dueDate);
    });
    return clone;
  }
  if (strategy === "urgent") {
    clone.sort((a, b) => {
      const dueDiff =
        (Number.isFinite(daysUntil(a.dueDate)) ? daysUntil(a.dueDate) : 999999) -
        (Number.isFinite(daysUntil(b.dueDate)) ? daysUntil(b.dueDate) : 999999);
      if (dueDiff !== 0) return dueDiff;
      const aprDiff = safeNum(b.aprPct, 0) - safeNum(a.aprPct, 0);
      if (aprDiff !== 0) return aprDiff;
      return safeNum(b.balance, 0) - safeNum(a.balance, 0);
    });
    return clone;
  }
  clone.sort((a, b) => {
    const aprDiff = safeNum(b.aprPct, 0) - safeNum(a.aprPct, 0);
    if (aprDiff !== 0) return aprDiff;
    const interestDiff =
      estimatedMonthlyInterest(b.balance, b.aprPct) -
      estimatedMonthlyInterest(a.balance, a.aprPct);
    if (interestDiff !== 0) return interestDiff;
    return safeNum(b.balance, 0) - safeNum(a.balance, 0);
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

function mapBillRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "Debt",
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

function buildDebtEditorState(debt, defaultAccountId = "") {
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

function MiniPill({ children, tone = "neutral" }) {
  const meta = toneMeta(tone);
  return (
    <div
      style={{
        minHeight: 30,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0 10px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 10px ${meta.glow}`,
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

function PaneHeader({ title, subcopy, right }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
        flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 17,
            lineHeight: 1.08,
            fontWeight: 850,
            letterSpacing: "-0.035em",
            color: "#fff",
          }}
        >
          {title}
        </div>
        {subcopy ? (
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              lineHeight: 1.45,
              color: "rgba(255,255,255,0.60)",
            }}
          >
            {subcopy}
          </div>
        ) : null}
      </div>
      {right || null}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, detail, tone = "neutral" }) {
  const meta = toneMeta(tone);
  return (
    <GlassPane tone={tone} size="card" style={{ height: "100%" }}>
      <div
        style={{
          minHeight: 112,
          display: "grid",
          gridTemplateRows: "auto auto 1fr",
          gap: 7,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            border: `1px solid ${meta.border}`,
            background: meta.bg,
            color: tone === "neutral" ? "#fff" : meta.text,
            boxShadow: `0 0 10px ${meta.glow}`,
          }}
        >
          <Icon size={15} />
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: ".2em",
              fontWeight: 800,
              color: "rgba(255,255,255,0.40)",
            }}
          >
            {label}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: "clamp(18px, 2.2vw, 28px)",
              lineHeight: 1,
              fontWeight: 850,
              letterSpacing: "-0.05em",
              color: tone === "neutral" ? "#fff" : meta.text,
            }}
          >
            {value}
          </div>
        </div>
        <div
          style={{
            fontSize: 11.5,
            lineHeight: 1.4,
            color: "rgba(255,255,255,0.60)",
          }}
        >
          {detail}
        </div>
      </div>
    </GlassPane>
  );
}

function ActionBtn({
  children,
  onClick,
  variant = "ghost",
  full = false,
  type = "button",
  disabled = false,
}) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="debtActionBtn"
      style={{
        width: full ? "100%" : undefined,
        border: isDanger
          ? "1px solid rgba(255,132,163,0.20)"
          : isPrimary
          ? "1px solid rgba(143,177,255,0.22)"
          : "1px solid rgba(214,226,255,0.10)",
        background: isDanger
          ? "linear-gradient(180deg, rgba(255,132,163,0.11), rgba(255,132,163,0.04))"
          : isPrimary
          ? "linear-gradient(180deg, rgba(143,177,255,0.18), rgba(143,177,255,0.06))"
          : "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.014))",
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
    <button
      type="button"
      className={`debtIconGhost${danger ? " debtIconGhostDanger" : ""}`}
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function ProgressBar({ fill = 0, tone = "neutral" }) {
  const normalized = Math.max(0, Math.min(100, safeNum(fill)));
  const toneMap = {
    neutral:
      "linear-gradient(90deg, rgba(96,165,250,.95), rgba(147,197,253,.95))",
    green:
      "linear-gradient(90deg, rgba(74,222,128,.95), rgba(167,243,208,.95))",
    amber:
      "linear-gradient(90deg, rgba(251,191,36,.95), rgba(253,230,138,.95))",
    red: "linear-gradient(90deg, rgba(248,113,113,.95), rgba(252,165,165,.95))",
  };
  return (
    <div className="debtProgress">
      <div
        className="debtProgressFill"
        style={{
          width: `${normalized}%`,
          background: toneMap[tone] || toneMap.neutral,
        }}
      />
    </div>
  );
}

function SectionCard({ title, subcopy, children, right }) {
  return (
    <div className="debtSectionCard">
      <PaneHeader title={title} subcopy={subcopy} right={right} />
      {children}
    </div>
  );
}

function DrawerShell({ open, title, subcopy, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="debtDrawerRoot">
      <button type="button" className="debtDrawerBackdrop" onClick={onClose} />
      <div className="debtDrawerPanel">
        <div className="debtDrawerHeader">
          <div>
            <div className="debtDrawerEyebrow">Debt Workspace</div>
            <div className="debtDrawerTitle">{title}</div>
            {subcopy ? <div className="debtDrawerSub">{subcopy}</div> : null}
          </div>
          <IconGhostBtn onClick={onClose} title="Close panel">
            <X size={16} />
          </IconGhostBtn>
        </div>
        <div className="debtDrawerBody">{children}</div>
        {footer ? <div className="debtDrawerFooter">{footer}</div> : null}
      </div>
    </div>
  );
}

function DebtMoreMenu({ debt, disabled, onEdit, onToggleActive, onDelete }) {
  return (
    <details className="debtMoreMenu">
      <summary className="debtMoreTrigger" aria-label="More debt tools">
        <MoreHorizontal size={16} />
      </summary>
      <div className="debtMorePanel">
        <button
          type="button"
          className="debtMoreItem"
          onClick={onEdit}
          disabled={disabled}
        >
          <PencilLine size={14} />
          Edit debt
        </button>
        <button
          type="button"
          className="debtMoreItem"
          onClick={onToggleActive}
          disabled={disabled}
        >
          <ShieldAlert size={14} />
          {debt?.active ? "Archive debt" : "Activate debt"}
        </button>
        <button
          type="button"
          className="debtMoreItem debtMoreDanger"
          onClick={onDelete}
          disabled={disabled}
        >
          <Trash2 size={14} />
          Delete debt
        </button>
      </div>
    </details>
  );
}

function DebtDueTile({ debt }) {
  const due = dueMeta(daysUntil(debt?.dueDate));
  const meta = toneMeta(due.tone);
  return (
    <div
      className="debtDueTile"
      style={{
        borderColor: meta.border,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 18px ${meta.glow}`,
      }}
    >
      <div
        className="debtDueTileIcon"
        style={{
          color: due.tone === "neutral" ? "#fff" : meta.text,
          background: meta.bg,
          borderColor: meta.border,
        }}
      >
        <CalendarClock size={14} />
      </div>
      <div className="debtDueTileDate">{shortDate(debt?.dueDate)}</div>
      <div
        className="debtDueTileMeta"
        style={{ color: due.tone === "neutral" ? "rgba(255,255,255,0.7)" : meta.text }}
      >
        {compactDebtDueText(daysUntil(debt?.dueDate))}
      </div>
    </div>
  );
}

function DebtStackRow({ debt, selected, onSelect, isTarget, strategy }) {
  const due = dueMeta(daysUntil(debt.dueDate));
  const monthly = monthlyScheduledPayment(debt);
  const interest = estimatedMonthlyInterest(debt.balance, debt.aprPct);
  const payoff = payoffLabel(debt.balance, debt.aprPct, monthly);

  return (
    <button
      type="button"
      className="debtStackRow"
      onClick={onSelect}
      style={{
        borderColor: selected
          ? toneMeta(due.tone).border
          : "rgba(255,255,255,0.07)",
        boxShadow: selected
          ? `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(255,255,255,0.01), 0 0 24px ${toneMeta(due.tone).glow}`
          : "inset 0 1px 0 rgba(255,255,255,0.025)",
      }}
    >
      <DebtDueTile debt={debt} />

      <div className="debtStackMain">
        <div className="debtStackTop">
          <div className="debtStackIdentity">
            <div className="debtStackNameWrap">
              <div className="debtStackName">{debt.name || "Debt"}</div>
              <div className="debtStackSub">
                {debt.category || "No category"} • {safeNum(debt.aprPct, 0)}% APR
              </div>
            </div>
            <div className="debtStackPills">
              {isTarget ? (
                <MiniPill tone="red">
                  <Target size={12} /> Target
                </MiniPill>
              ) : null}
              <MiniPill tone={due.tone}>{due.label}</MiniPill>
              {debt.autopay ? <MiniPill tone="green">Autopay</MiniPill> : null}
            </div>
          </div>
          <div className="debtStackValue">{money(debt.balance)}</div>
        </div>

        <div className="debtStackMetrics">
          <div className="debtStackMetric">
            <span>Plan</span>
            <strong>{money(monthly)}</strong>
          </div>
          <div className="debtStackMetric">
            <span>Interest</span>
            <strong>{moneyTight(interest)}/mo</strong>
          </div>
          <div className="debtStackMetric">
            <span>Payoff</span>
            <strong>{payoff}</strong>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <ProgressBar fill={due.percent} tone={due.tone} />
        </div>

        <div className="debtStackFooter">
          <span>
            {strategy === "snowball"
              ? "Ordered by smallest balance"
              : strategy === "urgent"
              ? "Ordered by due pressure"
              : "Ordered by APR pressure"}
          </span>
          <span>Updated {fmtAgo(debt.updatedAt)}</span>
        </div>
      </div>
    </button>
  );
}

function PaymentHistory({ payments, accountNameById }) {
  if (!payments.length) {
    return (
      <div className="debtEmptyState debtInlineEmpty">
        <div>
          <div className="debtEmptyTitle">No payment history yet</div>
          <div className="debtEmptyText">
            Bills linked to this debt will start showing here automatically.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="debtIntelList">
      {payments.map((payment) => (
        <div key={payment.id} className="debtIntelItem">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="debtIntelTitle">{moneyTight(payment.amount)}</div>
              <div className="debtIntelSub">
                {shortDate(payment.paymentDate)} • {" "}
                {payment.accountId
                  ? accountNameById.get(payment.accountId) || "Account"
                  : "No account linked"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <MiniPill tone="green">Synced</MiniPill>
              {payment.linkedDebtId ? <MiniPill>From bills</MiniPill> : <MiniPill>Legacy</MiniPill>}
            </div>
          </div>
          {payment.note ? (
            <div className="debtIntelSub" style={{ marginTop: -2 }}>
              {payment.note}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DebtSummaryCard({
  debt,
  strategy,
  targetDebtId,
  selectedDebtPayments,
  accounts,
  onOpenEdit,
  onToggleActive,
  onDelete,
  busy = false,
}) {
  if (!debt) {
    return (
      <GlassPane size="card">
        <PaneHeader
          title="Focused Debt"
          subcopy="Pick one from the stack to work it here."
        />
        <div className="debtEmptyState" style={{ minHeight: 260 }}>
          <div>
            <div className="debtEmptyTitle">No debt selected</div>
            <div className="debtEmptyText">
              Once you pick one, this center panel becomes the command card.
            </div>
          </div>
        </div>
      </GlassPane>
    );
  }

  const due = dueMeta(daysUntil(debt.dueDate));
  const monthlyPlan = monthlyScheduledPayment(debt);
  const interestDrag = estimatedMonthlyInterest(debt.balance, debt.aprPct);
  const payoff = payoffLabel(debt.balance, debt.aprPct, monthlyPlan);
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const linkedAccount = accounts.find((a) => a.id === debt.accountId) || null;

  const paidThisMonth = selectedDebtPayments
    .filter((payment) => monthKeyOf(payment.paymentDate) === monthKeyOf(isoDate()))
    .reduce((sum, payment) => sum + safeNum(payment.amount, 0), 0);
  const paidAllTime = selectedDebtPayments.reduce(
    (sum, payment) => sum + safeNum(payment.amount, 0),
    0
  );
  const avgPayment =
    selectedDebtPayments.length > 0
      ? round2(paidAllTime / selectedDebtPayments.length)
      : 0;

  return (
    <GlassPane tone={due.tone} size="card" style={{ height: "100%" }}>
      <PaneHeader
        title={debt.name || "Debt"}
        subcopy="Summary first. Keep the debt pulse visible without leaving the page stretched open."
        right={
          <div className="debtFocusHeaderTools">
            <ActionBtn onClick={onOpenEdit}>
              <PencilLine size={14} />
              Edit
            </ActionBtn>
            <DebtMoreMenu
              debt={debt}
              disabled={busy}
              onEdit={onOpenEdit}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
            />
          </div>
        }
      />

      <div className="debtFocusBox">
        <div className="debtSummaryHero">
          <div>
            <div className="debtTinyLabel">Current Balance</div>
            <div className="debtHeroBalance">{money(debt.balance)}</div>
            <div className="debtHeroSubline">Updated {fmtWhen(debt.updatedAt)}</div>
          </div>
          <div className="debtHeroChips">
            {targetDebtId === debt.id ? (
              <MiniPill tone="red">
                <Target size={12} /> {strategy === "snowball" ? "Snowball target" : strategy === "urgent" ? "Urgent target" : "Avalanche target"}
              </MiniPill>
            ) : null}
            <MiniPill tone={due.tone}>{due.label}</MiniPill>
            {debt.autopay ? <MiniPill tone="green">Autopay</MiniPill> : null}
            {!debt.active ? <MiniPill>Inactive</MiniPill> : null}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <ProgressBar fill={due.percent} tone={due.tone} />
        </div>

        <div className="debtInfoGrid" style={{ marginTop: 14 }}>
          <div className="debtInfoCell">
            <div className="debtTinyLabel">Monthly Interest Drag</div>
            <div className="debtInfoValue">{moneyTight(interestDrag)}</div>
            <div className="debtInfoSub">Estimated interest next month</div>
          </div>
          <div className="debtInfoCell">
            <div className="debtTinyLabel">Monthly Plan</div>
            <div className="debtInfoValue">{money(monthlyPlan)}</div>
            <div className="debtInfoSub">Minimum plus recurring extra</div>
          </div>
          <div className="debtInfoCell">
            <div className="debtTinyLabel">Payoff</div>
            <div className="debtInfoValue">{payoff}</div>
            <div className="debtInfoSub">{safeNum(debt.aprPct, 0)}% APR pressure</div>
          </div>
          <div className="debtInfoCell">
            <div className="debtTinyLabel">Due Cycle</div>
            <div className="debtInfoValue">
              {shortDate(debt.dueDate)} • {FREQUENCY_OPTIONS.find((opt) => opt.value === debt.frequency)?.label || debt.frequency}
            </div>
            <div className="debtInfoSub">Debt billing schedule</div>
          </div>
          <div className="debtInfoCell">
            <div className="debtTinyLabel">Linked Account</div>
            <div className="debtInfoValue">{accountNameById.get(debt.accountId) || "None"}</div>
            <div className="debtInfoSub">
              {linkedAccount
                ? `${accountTypeLabel(linkedAccount.type)} • ${money(linkedAccount.balance)}`
                : "No pay-from account selected"}
            </div>
          </div>
          <div className="debtInfoCell">
            <div className="debtTinyLabel">Last Paid</div>
            <div className="debtInfoValue">{shortDate(debt.lastPaidDate)}</div>
            <div className="debtInfoSub">
              {selectedDebtPayments.length} synced payment{selectedDebtPayments.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="debtSummarySplit">
          <SectionCard title="Activity Snapshot" subcopy="Fast pulse on what has actually hit this debt.">
            <div className="debtInsightList">
              <div className="debtInsightItem">
                <div className="debtInsightTitle">Paid This Month</div>
                <div className="debtInsightValue">{moneyTight(paidThisMonth)}</div>
                <div className="debtInsightSub">Recorded payments this month</div>
              </div>
              <div className="debtInsightItem">
                <div className="debtInsightTitle">All-Time Paid</div>
                <div className="debtInsightValue">{moneyTight(paidAllTime)}</div>
                <div className="debtInsightSub">Across all synced history</div>
              </div>
              <div className="debtInsightItem">
                <div className="debtInsightTitle">Average Payment</div>
                <div className="debtInsightValue">{moneyTight(avgPayment)}</div>
                <div className="debtInsightSub">Average across recorded history</div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Payoff Snapshot" subcopy="Keep the attack plan visible without opening the form.">
            <div className="debtInsightList">
              <div className="debtInsightItem">
                <div className="debtInsightTitle">Minimum</div>
                <div className="debtInsightValue">{moneyTight(monthlyMinimumPayment(debt))}</div>
                <div className="debtInsightSub">Required baseline payment</div>
              </div>
              <div className="debtInsightItem">
                <div className="debtInsightTitle">Extra</div>
                <div className="debtInsightValue">{moneyTight(safeNum(debt.extraPay, 0))}</div>
                <div className="debtInsightSub">Recurring extra attack</div>
              </div>
              <div className="debtInsightItem">
                <div className="debtInsightTitle">Payoff</div>
                <div className="debtInsightValue">{payoff}</div>
                <div className="debtInsightSub">Based on current balance, APR, and payment plan</div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div style={{ marginTop: 14 }}>
          <SectionCard
            title="Payment History"
            subcopy="Linked bill payments and legacy direct debt payments both show here."
          >
            <PaymentHistory
              payments={selectedDebtPayments}
              accountNameById={accountNameById}
            />
          </SectionCard>
        </div>
      </div>
    </GlassPane>
  );
}

function DebtDrawer({ open, form, setForm, onClose, onSave, saving, accounts }) {
  return (
    <DrawerShell
      open={open}
      title="Edit Debt"
      subcopy="Keep the page clean and do the full editing here."
      onClose={onClose}
      footer={
        <>
          <ActionBtn onClick={onClose}>Close</ActionBtn>
          <ActionBtn variant="primary" onClick={onSave} disabled={saving}>
            <Save size={14} />
            {saving ? "Saving..." : "Save Changes"}
          </ActionBtn>
        </>
      }
    >
      <div className="debtFormStack">
        <SectionCard title="Debt Core" subcopy="Main debt profile data, account, and schedule.">
          <div className="debtFormStack">
            <div>
              <div className="debtTinyLabel">Debt Name</div>
              <input
                className="debtField debtFieldStrong"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Truck Loan"
              />
            </div>

            <div className="debtFormGrid4">
              <div>
                <div className="debtTinyLabel">Balance</div>
                <input
                  className="debtField debtFieldStrong"
                  inputMode="decimal"
                  value={form.balance}
                  onChange={(e) => setForm((prev) => ({ ...prev, balance: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <div className="debtTinyLabel">APR %</div>
                <input
                  className="debtField debtFieldStrong"
                  inputMode="decimal"
                  value={form.aprPct}
                  onChange={(e) => setForm((prev) => ({ ...prev, aprPct: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <div className="debtTinyLabel">Minimum Payment</div>
                <input
                  className="debtField debtFieldStrong"
                  inputMode="decimal"
                  value={form.minPay}
                  onChange={(e) => setForm((prev) => ({ ...prev, minPay: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <div className="debtTinyLabel">Extra Payment</div>
                <input
                  className="debtField debtFieldStrong"
                  inputMode="decimal"
                  value={form.extraPay}
                  onChange={(e) => setForm((prev) => ({ ...prev, extraPay: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="debtFormGrid4">
              <div>
                <div className="debtTinyLabel">Due Date</div>
                <input
                  type="date"
                  className="debtField debtFieldStrong"
                  value={form.dueDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
              <div>
                <div className="debtTinyLabel">Frequency</div>
                <select
                  className="debtField debtFieldStrong"
                  value={form.frequency}
                  onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value }))}
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="debtTinyLabel">Statement Amount</div>
                <input
                  className="debtField debtFieldStrong"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div>
                <div className="debtTinyLabel">Linked Account</div>
                <select
                  className="debtField debtFieldStrong"
                  value={form.accountId}
                  onChange={(e) => setForm((prev) => ({ ...prev, accountId: e.target.value }))}
                >
                  <option value="">No linked account</option>
                  {accounts
                    .filter((account) => !isInvestmentAccountType(account.type))
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} • {accountTypeLabel(account.type)} • {money(account.balance)}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="debtFormGrid2">
              <div>
                <div className="debtTinyLabel">Category</div>
                <input
                  className="debtField debtFieldStrong"
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Auto, Credit Card, Personal"
                />
              </div>
              <div>
                <div className="debtTinyLabel">Autopay</div>
                <div className="debtInlineTools">
                  <ActionBtn
                    variant={form.autopay ? "primary" : "ghost"}
                    onClick={() => setForm((prev) => ({ ...prev, autopay: true }))}
                  >
                    On
                  </ActionBtn>
                  <ActionBtn
                    variant={!form.autopay ? "primary" : "ghost"}
                    onClick={() => setForm((prev) => ({ ...prev, autopay: false }))}
                  >
                    Off
                  </ActionBtn>
                </div>
              </div>
            </div>

            <div>
              <div className="debtTinyLabel">Notes</div>
              <textarea
                className="debtField debtFieldStrong"
                rows={5}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Debt-specific note, lender note, plan note..."
              />
            </div>
          </div>
        </SectionCard>
      </div>
    </DrawerShell>
  );
}

function RailCard({ title, subcopy, right, children }) {
  return (
    <GlassPane size="card">
      <PaneHeader title={title} subcopy={subcopy} right={right} />
      {children}
    </GlassPane>
  );
}

export default function DebtPage() {
  const [debts, setDebts] = useState([]);
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

  const [savingSelected, setSavingSelected] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  const [editor, setEditor] = useState(buildDebtEditorState(null, ""));

  useEffect(() => {
    if (!status) return undefined;
    const id = window.setTimeout(() => setStatus(""), 2800);
    return () => window.clearTimeout(id);
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
        setAccounts([]);
        setPayments([]);
        setSelectedDebtId("");
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const [debtsRes, accountsRes, settingsRes, paymentsRes] = await Promise.all([
        supabase
          .from("bills")
          .select("*")
          .eq("user_id", user.id)
          .eq("type", "controllable")
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
      if (accountsRes.error) throw accountsRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const loadedDebts = (debtsRes.data || []).map(mapBillRowToClient);
      const loadedAccounts = (accountsRes.data || []).map(mapAccountRowToClient);
      const primaryAccountId =
        settingsRes.data?.primary_account_id || loadedAccounts[0]?.id || "";

      setDebts(loadedDebts);
      setAccounts(loadedAccounts);
      setDefaultAccountId(primaryAccountId);
      setPayments((paymentsRes.data || []).map(mapPaymentRowToClient));

      setSelectedDebtId((prev) => {
        if (preferredDebtId && loadedDebts.some((debt) => debt.id === preferredDebtId)) {
          return preferredDebtId;
        }
        if (prev && loadedDebts.some((debt) => debt.id === prev)) {
          return prev;
        }
        return loadedDebts[0]?.id || "";
      });
    } catch (err) {
      setPageError(err?.message || "Failed to load debt.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPage();
    if (!supabase) return undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refreshPage();
    });
    return () => subscription?.unsubscribe?.();
  }, [refreshPage]);

  const visibleDebts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = debts.filter((debt) => {
      if (scope === "active" && !debt.active) return false;
      if (scope === "inactive" && debt.active) return false;
      if (!q) return true;
      return [debt.name, debt.category, debt.notes].join(" ").toLowerCase().includes(q);
    });
    return sortDebtsForStrategy(list, strategy);
  }, [debts, scope, search, strategy]);

  useEffect(() => {
    if (!visibleDebts.length) {
      setSelectedDebtId("");
      return;
    }
    const exists = visibleDebts.some((debt) => debt.id === selectedDebtId);
    if (!exists) setSelectedDebtId(visibleDebts[0].id);
  }, [visibleDebts, selectedDebtId]);

  const selectedDebt = debts.find((debt) => debt.id === selectedDebtId) || visibleDebts[0] || null;

  useEffect(() => {
    if (!selectedDebt) {
      setEditor(buildDebtEditorState(null, defaultAccountId || ""));
      return;
    }
    setEditor(buildDebtEditorState(selectedDebt, defaultAccountId));
  }, [selectedDebt, defaultAccountId]);

  const activeDebts = useMemo(() => debts.filter((debt) => debt.active), [debts]);

  const targetedDebt = useMemo(() => {
    const candidates = activeDebts.filter((debt) => safeNum(debt.balance, 0) > 0);
    return sortDebtsForStrategy(candidates, strategy)[0] || null;
  }, [activeDebts, strategy]);

  const selectedDebtPayments = useMemo(() => {
    if (!selectedDebt) return [];
    return payments
      .filter(
        (payment) => payment.billId === selectedDebt.id || payment.linkedDebtId === selectedDebt.id
      )
      .sort(
        (a, b) =>
          compareIsoDates(b.paymentDate, a.paymentDate) ||
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
  }, [payments, selectedDebt]);

  const metrics = useMemo(() => {
    const monthKey = monthKeyOf(isoDate());
    const totalBalance = activeDebts.reduce((sum, debt) => sum + safeNum(debt.balance, 0), 0);
    const totalMinimum = activeDebts.reduce((sum, debt) => sum + monthlyMinimumPayment(debt), 0);
    const totalExtra = activeDebts.reduce((sum, debt) => sum + safeNum(debt.extraPay, 0), 0);
    const totalPlan = activeDebts.reduce((sum, debt) => sum + monthlyScheduledPayment(debt), 0);
    const monthlyInterest = activeDebts.reduce(
      (sum, debt) => sum + estimatedMonthlyInterest(debt.balance, debt.aprPct),
      0
    );
    const weightedApr =
      totalBalance > 0
        ? round2(
            activeDebts.reduce(
              (sum, debt) => sum + safeNum(debt.balance, 0) * safeNum(debt.aprPct, 0),
              0
            ) / totalBalance
          )
        : 0;
    const dueSoonCount = activeDebts.filter((debt) => {
      const dueIn = daysUntil(debt.dueDate);
      return Number.isFinite(dueIn) && dueIn >= 0 && dueIn <= 7;
    }).length;
    const paidThisMonth = payments
      .filter((payment) => monthKeyOf(payment.paymentDate) === monthKey)
      .reduce((sum, payment) => sum + safeNum(payment.amount, 0), 0);
    return {
      totalBalance,
      totalMinimum,
      totalExtra,
      totalPlan,
      monthlyInterest,
      weightedApr,
      dueSoonCount,
      paidThisMonth,
    };
  }, [activeDebts, payments]);

  const selectedDebtPaymentSummary = useMemo(() => {
    const totalPaid = selectedDebtPayments.reduce((sum, payment) => sum + safeNum(payment.amount, 0), 0);
    const thisMonth = selectedDebtPayments
      .filter((payment) => monthKeyOf(payment.paymentDate) === monthKeyOf(isoDate()))
      .reduce((sum, payment) => sum + safeNum(payment.amount, 0), 0);
    const avg = selectedDebtPayments.length > 0 ? round2(totalPaid / selectedDebtPayments.length) : 0;
    const largest = selectedDebtPayments.reduce(
      (max, payment) => Math.max(max, safeNum(payment.amount, 0)),
      0
    );
    return { totalPaid, thisMonth, avg, largest };
  }, [selectedDebtPayments]);

  function openEditDrawer() {
    if (!selectedDebt) return;
    setEditor(buildDebtEditorState(selectedDebt, defaultAccountId));
    setEditDrawerOpen(true);
  }

  function closeEditDrawer() {
    setEditDrawerOpen(false);
  }

  async function saveSelectedDebt() {
    if (!supabase || !userId || !selectedDebt || savingSelected || deletingSelected) return;

    const name = String(editor.name || "").trim();
    const balance = parseMoneyInput(editor.balance);
    const aprPct = parseMoneyInput(editor.aprPct || "0");
    const minPay = parseMoneyInput(editor.minPay || "0");
    const extraPay = parseMoneyInput(editor.extraPay || "0");
    const amount = parseMoneyInput(editor.amount || "0");

    if (!name) {
      setPageError("Debt name is required.");
      return;
    }
    if (!Number.isFinite(balance) || balance < 0) {
      setPageError("Balance must be 0 or greater.");
      return;
    }
    if (!Number.isFinite(minPay) || minPay < 0) {
      setPageError("Minimum payment must be 0 or greater.");
      return;
    }
    if (!Number.isFinite(extraPay) || extraPay < 0) {
      setPageError("Extra payment must be 0 or greater.");
      return;
    }

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
    setEditDrawerOpen(false);
    setStatus("Debt profile saved.");
    await refreshPage(selectedDebt.id);
  }

  async function toggleSelectedDebtActive() {
    if (!supabase || !userId || !selectedDebt || savingSelected || deletingSelected) return;
    setSavingSelected(true);
    setPageError("");
    const res = await supabase
      .from("bills")
      .update({ active: !selectedDebt.active, updated_at: new Date().toISOString() })
      .eq("id", selectedDebt.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (res.error) {
      setPageError(res.error.message || "Could not update debt state.");
      setSavingSelected(false);
      return;
    }

    setSavingSelected(false);
    setStatus(selectedDebt.active ? "Debt archived." : "Debt activated.");
    await refreshPage(selectedDebt.id);
  }

  async function deleteSelectedDebt() {
    if (!supabase || !userId || !selectedDebt || savingSelected || deletingSelected) return;

    const debtName = selectedDebt.name || "this debt";
    const confirmDelete =
      typeof window === "undefined"
        ? true
        : window.confirm(
            `Delete ${debtName}?\n\nThis will unlink any bills attached to it and remove legacy debt-only payment history.`
          );
    if (!confirmDelete) return;

    setDeletingSelected(true);
    setPageError("");

    try {
      const { error: unlinkBillsError } = await supabase
        .from("bills")
        .update({ linked_debt_id: null, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("linked_debt_id", selectedDebt.id);
      if (unlinkBillsError) throw unlinkBillsError;

      const { error: unlinkPaymentDebtRefsError } = await supabase
        .from("bill_payments")
        .update({ linked_debt_id: null })
        .eq("user_id", userId)
        .eq("linked_debt_id", selectedDebt.id);
      if (unlinkPaymentDebtRefsError) throw unlinkPaymentDebtRefsError;

      const { error: deleteLegacyDebtPaymentsError } = await supabase
        .from("bill_payments")
        .delete()
        .eq("user_id", userId)
        .eq("bill_id", selectedDebt.id);
      if (deleteLegacyDebtPaymentsError) throw deleteLegacyDebtPaymentsError;

      const { error: deleteDebtError } = await supabase
        .from("bills")
        .delete()
        .eq("user_id", userId)
        .eq("id", selectedDebt.id)
        .eq("type", "controllable");
      if (deleteDebtError) throw deleteDebtError;

      setEditDrawerOpen(false);
      setStatus("Debt deleted.");
      await refreshPage();
    } catch (err) {
      setPageError(err?.message || "Could not delete debt.");
      await refreshPage(selectedDebt.id);
    } finally {
      setDeletingSelected(false);
    }
  }

  if (loading) {
    return (
      <main className="debtPage">
        <div className="debtPageShell">
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>Loading debt.</div>
          </GlassPane>
        </div>
        <style jsx global>{globalStyles}</style>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="debtPage">
        <div className="debtPageShell">
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>Please log in</div>
          </GlassPane>
        </div>
        <style jsx global>{globalStyles}</style>
      </main>
    );
  }

  const accountNameById = new Map(accounts.map((account) => [account.id, account.name]));
  const linkedAccount = accounts.find((account) => account.id === selectedDebt?.accountId) || null;
  const syncedFromBillsCount = selectedDebtPayments.filter(
    (payment) => payment.linkedDebtId === selectedDebt?.id
  ).length;
  const legacyDirectCount = selectedDebtPayments.filter(
    (payment) => payment.billId === selectedDebt?.id && !payment.linkedDebtId
  ).length;

  return (
    <>
      <main className="debtPage">
        <div className="debtPageShell">
          <GlassPane size="card">
            <div className="debtHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div className="debtEyebrow">Life Command Center</div>
                <div className="debtHeroTitle">Debt Command</div>
                <div className="debtHeroSub">
                  Cleaner summary-first debt workspace with payoff pressure, attack strategy, synced history, and a hidden full edit panel instead of a giant always-open form.
                </div>
                <div className="debtPillRow">
                  <MiniPill>{activeDebts.length} active debts</MiniPill>
                  <MiniPill>{currentMonthLabel()}</MiniPill>
                  <MiniPill tone="amber">{metrics.dueSoonCount} due soon</MiniPill>
                  <MiniPill tone="green">{money(metrics.paidThisMonth)} paid this month</MiniPill>
                </div>
              </div>

              <div className="debtHeroSide">
                <MiniPill tone="red">{money(metrics.totalBalance)} total</MiniPill>
                <MiniPill tone="amber">{moneyTight(metrics.monthlyInterest)}/mo interest</MiniPill>
                <MiniPill>{targetedDebt ? `Target: ${targetedDebt.name}` : "No target"}</MiniPill>
              </div>
            </div>
          </GlassPane>

          {pageError ? (
            <GlassPane tone="red" size="card">
              <div style={{ fontWeight: 800, fontSize: 15, color: "#fff" }}>{pageError}</div>
            </GlassPane>
          ) : null}

          {status ? (
            <GlassPane tone="green" size="card">
              <div style={{ fontWeight: 800, fontSize: 14, color: "#9ef0c0" }}>{status}</div>
            </GlassPane>
          ) : null}

          <section className="debtMetricGrid">
            <StatCard icon={Landmark} label="Total Balance" value={money(metrics.totalBalance)} detail="Current live debt balance across active debts." tone="red" />
            <StatCard icon={BadgeDollarSign} label="Minimum Load" value={money(metrics.totalMinimum)} detail="What you have to cover before any extra attack." tone="amber" />
            <StatCard icon={Flame} label="Extra Attack" value={money(metrics.totalExtra)} detail="Recurring extra being thrown at debt each month." tone={metrics.totalExtra > 0 ? "green" : "neutral"} />
            <StatCard icon={Percent} label="Weighted APR" value={`${metrics.weightedApr}%`} detail="Balance-weighted average rate across active debt." tone={metrics.weightedApr > 10 ? "red" : "amber"} />
            <StatCard icon={TrendingDown} label="Monthly Plan" value={money(metrics.totalPlan)} detail="Minimums plus saved recurring extra." tone="green" />
          </section>

          <GlassPane size="card">
            <PaneHeader title="Debt Controls" subcopy="Search the stack, filter status, and choose the payoff strategy." />
            <div className="debtControlsGrid">
              <div>
                <div className="debtTinyLabel">Search</div>
                <div className="debtSearchWrap">
                  <Search size={15} />
                  <input className="debtField debtSearchField" placeholder="Search debt" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div>
                <div className="debtTinyLabel">Scope</div>
                <div className="debtInlineTools">
                  <ActionBtn variant={scope === "active" ? "primary" : "ghost"} onClick={() => setScope("active")}>Active</ActionBtn>
                  <ActionBtn variant={scope === "all" ? "primary" : "ghost"} onClick={() => setScope("all")}>All</ActionBtn>
                  <ActionBtn variant={scope === "inactive" ? "primary" : "ghost"} onClick={() => setScope("inactive")}>Inactive</ActionBtn>
                </div>
              </div>
              <div>
                <div className="debtTinyLabel">Strategy</div>
                <div className="debtInlineTools">
                  {STRATEGY_OPTIONS.map((option) => (
                    <ActionBtn key={option.value} variant={strategy === option.value ? "primary" : "ghost"} onClick={() => setStrategy(option.value)}>
                      {option.label}
                    </ActionBtn>
                  ))}
                </div>
              </div>
            </div>
          </GlassPane>

          <section className="debtWorkspaceGrid">
            <GlassPane size="card" style={{ height: "100%" }}>
              <div className="debtRosterPane">
                <PaneHeader title="Debt Stack" subcopy={strategySubtitle(strategy)} right={<MiniPill>{visibleDebts.length} showing</MiniPill>} />
                {visibleDebts.length ? (
                  <div className="debtRosterListCompact">
                    {visibleDebts.map((debt) => (
                      <DebtStackRow key={debt.id} debt={debt} selected={debt.id === selectedDebt?.id} onSelect={() => setSelectedDebtId(debt.id)} isTarget={targetedDebt?.id === debt.id} strategy={strategy} />
                    ))}
                  </div>
                ) : (
                  <div className="debtEmptyState debtGrowEmpty">
                    <div>
                      <div className="debtEmptyTitle">No debt found</div>
                      <div className="debtEmptyText">This page focuses on managing payoff pressure for debt already on the board.</div>
                    </div>
                  </div>
                )}
              </div>
            </GlassPane>

            <DebtSummaryCard debt={selectedDebt} strategy={strategy} targetDebtId={targetedDebt?.id || ""} selectedDebtPayments={selectedDebtPayments} accounts={accounts} onOpenEdit={openEditDrawer} onToggleActive={toggleSelectedDebtActive} onDelete={deleteSelectedDebt} busy={savingSelected || deletingSelected} />

            <div className="debtRailStack">
              <RailCard title="Quick Tools" subcopy="Keep the page clean and open full editing only when needed.">
                <div className="debtActionGrid debtActionGridSingle">
                  <ActionBtn onClick={openEditDrawer} full disabled={!selectedDebt}>
                    <PencilLine size={14} /> Edit Selected Debt
                  </ActionBtn>
                </div>
              </RailCard>

              <RailCard title="Strategy View" subcopy="What this page thinks you should attack first.">
                <div className="debtInsightList">
                  <div className="debtInsightItem">
                    <div className="debtInsightTitle">Current target</div>
                    <div className="debtInsightValue">{targetedDebt ? targetedDebt.name : "None"}</div>
                    <div className="debtInsightSub">{strategySubtitle(strategy)}</div>
                  </div>
                  <div className="debtInsightItem">
                    <div className="debtInsightTitle">Target balance</div>
                    <div className="debtInsightValue">{targetedDebt ? money(targetedDebt.balance) : "—"}</div>
                    <div className="debtInsightSub">
                      {targetedDebt ? `${safeNum(targetedDebt.aprPct, 0)}% APR • ${payoffLabel(targetedDebt.balance, targetedDebt.aprPct, monthlyScheduledPayment(targetedDebt))}` : "No active debt target"}
                    </div>
                  </div>
                  <div className="debtInsightItem">
                    <div className="debtInsightTitle">Monthly attack budget</div>
                    <div className="debtInsightValue">{money(metrics.totalPlan)}</div>
                    <div className="debtInsightSub">Minimums plus recurring extra across active debt</div>
                  </div>
                  <div className="debtInsightItem">
                    <div className="debtInsightTitle">Monthly interest drag</div>
                    <div className="debtInsightValue">{moneyTight(metrics.monthlyInterest)}</div>
                    <div className="debtInsightSub">Estimated interest pressure at current balances</div>
                  </div>
                </div>
              </RailCard>

              <RailCard title="Selected Debt Snapshot" subcopy="The current pulse of the focused debt." right={selectedDebt ? <MiniPill tone={dueMeta(daysUntil(selectedDebt.dueDate)).tone}>{dueMeta(daysUntil(selectedDebt.dueDate)).label}</MiniPill> : null}>
                {selectedDebt ? (
                  <div className="debtInsightList">
                    <div className="debtInsightItem">
                      <div className="debtInsightTitle">Linked account</div>
                      <div className="debtInsightValue">{linkedAccount ? linkedAccount.name : "None linked"}</div>
                      <div className="debtInsightSub">{linkedAccount ? `${accountTypeLabel(linkedAccount.type)} • ${money(linkedAccount.balance)}` : "No pay-from account selected on this debt"}</div>
                    </div>
                    <div className="debtInsightItem">
                      <div className="debtInsightTitle">Payment history</div>
                      <div className="debtInsightValue">{selectedDebtPayments.length} item{selectedDebtPayments.length === 1 ? "" : "s"}</div>
                      <div className="debtInsightSub">From bills {syncedFromBillsCount} • legacy direct {legacyDirectCount}</div>
                    </div>
                    <div className="debtInsightItem">
                      <div className="debtInsightTitle">Average payment</div>
                      <div className="debtInsightValue">{moneyTight(selectedDebtPaymentSummary.avg)}</div>
                      <div className="debtInsightSub">Largest payment {moneyTight(selectedDebtPaymentSummary.largest)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="debtEmptyMini">No debt selected.</div>
                )}
              </RailCard>
            </div>
          </section>
        </div>
      </main>

      <DebtDrawer open={editDrawerOpen} form={editor} setForm={setEditor} onClose={closeEditDrawer} onSave={saveSelectedDebt} saving={savingSelected} accounts={accounts} />

      <style jsx global>{globalStyles}</style>
    </>
  );
}

const globalStyles = `
  .debtPage {
    width: 100%;
    min-width: 0;
    color: var(--lcc-text);
    font-family: var(--lcc-font-sans);
  }

  .debtPageShell {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0 0 20px;
    display: grid;
    gap: 14px;
  }

  .debtEyebrow {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .22em;
    font-weight: 800;
    color: rgba(255,255,255,0.42);
  }

  .debtHeroTitle {
    margin-top: 8px;
    font-size: clamp(24px, 3.2vw, 34px);
    line-height: 1.02;
    font-weight: 850;
    letter-spacing: -0.05em;
    color: #fff;
  }

  .debtHeroSub {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.55;
    color: rgba(255,255,255,0.62);
    max-width: 840px;
  }

  .debtHeroGrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: start;
  }

  .debtHeroSide {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-content: flex-start;
  }

  .debtPillRow {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .debtMetricGrid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
  }

  .debtControlsGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr) minmax(0, 1.12fr);
    gap: 14px;
    align-items: end;
  }

  .debtWorkspaceGrid {
    display: grid;
    grid-template-columns: minmax(340px, 0.88fr) minmax(640px, 1.34fr) minmax(320px, 0.78fr);
    gap: 14px;
    align-items: stretch;
  }

  .debtWorkspaceGrid > * {
    min-width: 0;
    height: 100%;
  }

  .debtRosterPane {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .debtRailStack {
    display: grid;
    gap: 14px;
    min-width: 0;
  }

  .debtSearchWrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 46px;
    border-radius: 16px;
    border: 1px solid rgba(214,226,255,0.11);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012)),
      rgba(8, 12, 20, 0.82);
    color: rgba(255,255,255,0.58);
    padding: 0 12px;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.03),
      0 10px 30px rgba(0,0,0,0.16);
  }

  .debtSearchField {
    min-height: 42px !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
  }

  .debtRosterListCompact {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    display: grid;
    gap: 10px;
    padding-right: 2px;
  }

  .debtStackRow {
    width: 100%;
    display: grid;
    grid-template-columns: 84px minmax(0, 1fr);
    gap: 10px;
    align-items: stretch;
    min-height: 132px;
    padding: 14px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.07);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.74));
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    text-align: left;
  }

  .debtStackRow:hover {
    transform: translateY(-1px);
  }

  .debtStackMain {
    min-width: 0;
    display: grid;
    gap: 10px;
  }

  .debtDueTile {
    min-height: 96px;
    border-radius: 18px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.014)),
      rgba(7, 12, 20, 0.88);
    padding: 10px;
    display: grid;
    gap: 6px;
    align-content: start;
    text-align: left;
  }

  .debtDueTileIcon {
    width: 28px;
    height: 28px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(214,226,255,0.12);
  }

  .debtDueTileDate {
    font-size: 11px;
    font-weight: 800;
    color: #fff;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .debtDueTileMeta {
    font-size: 11px;
    font-weight: 800;
    line-height: 1.25;
    text-transform: uppercase;
    letter-spacing: .04em;
  }

  .debtStackTop {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
  }

  .debtStackIdentity {
    min-width: 0;
    display: grid;
    gap: 8px;
  }

  .debtStackNameWrap {
    min-width: 0;
  }

  .debtStackName {
    font-size: 14px;
    font-weight: 850;
    color: #fff;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .debtStackSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.35;
  }

  .debtStackPills {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .debtStackValue {
    font-size: 16px;
    font-weight: 900;
    color: #fff;
    white-space: nowrap;
  }

  .debtStackMetrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .debtStackMetric {
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.025);
    padding: 10px;
    display: grid;
    gap: 5px;
  }

  .debtStackMetric span {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .12em;
    font-weight: 800;
    color: rgba(255,255,255,0.46);
  }

  .debtStackMetric strong {
    font-size: 12px;
    color: #fff;
    line-height: 1.3;
  }

  .debtStackFooter {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 11px;
    color: rgba(255,255,255,0.5);
  }

  .debtFocusHeaderTools {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .debtFocusBox {
    border-radius: 24px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.032), rgba(255,255,255,0.01));
    padding: 16px;
    min-height: 100%;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.03),
      0 18px 50px rgba(0,0,0,0.18);
  }

  .debtSummaryHero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: start;
  }

  .debtHeroBalance {
    margin-top: 8px;
    font-size: clamp(34px, 4vw, 50px);
    line-height: 1;
    font-weight: 850;
    letter-spacing: -0.06em;
    color: #fff;
  }

  .debtHeroSubline {
    margin-top: 10px;
    font-size: 12px;
    color: rgba(255,255,255,0.58);
  }

  .debtHeroChips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: flex-start;
  }

  .debtInfoGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .debtInfoCell {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.055);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.018));
    padding: 12px;
  }

  .debtInfoValue {
    font-size: 0.98rem;
    font-weight: 900;
    line-height: 1.15;
    color: #fff;
    overflow-wrap: anywhere;
  }

  .debtInfoSub {
    margin-top: 5px;
    color: rgba(255,255,255,0.62);
    font-size: 0.79rem;
    line-height: 1.4;
  }

  .debtSummarySplit {
    margin-top: 14px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .debtSectionCard {
    border-radius: 22px;
    border: 1px solid rgba(214,226,255,0.11);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.012));
    padding: 14px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
  }

  .debtProgress {
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255,255,255,0.1);
  }

  .debtProgressFill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.4s ease;
  }

  .debtFormStack {
    display: grid;
    gap: 12px;
  }

  .debtFormGrid2,
  .debtFormGrid4 {
    display: grid;
    gap: 10px;
  }

  .debtFormGrid2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .debtFormGrid4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .debtTinyLabel {
    display: block;
    margin-bottom: 8px;
    font-size: 10px;
    color: rgba(255,255,255,0.46);
    text-transform: uppercase;
    letter-spacing: .16em;
    font-weight: 800;
  }

  .debtField {
    width: 100%;
    min-height: 46px;
    border-radius: 16px;
    border: 1px solid rgba(214,226,255,0.11);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012)),
      rgba(8, 12, 20, 0.84);
    color: var(--lcc-text);
    padding: 0 14px;
    outline: none;
    font: inherit;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.03),
      0 8px 22px rgba(0,0,0,0.14);
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease, transform 160ms ease;
  }

  .debtFieldStrong {
    border-color: rgba(214,226,255,0.14);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.014)),
      rgba(7, 12, 21, 0.9);
  }

  .debtField:focus {
    border-color: rgba(143,177,255,0.34);
    box-shadow:
      0 0 0 4px rgba(79,114,255,0.08),
      0 14px 28px rgba(0,0,0,0.18),
      inset 0 1px 0 rgba(255,255,255,0.04);
    transform: translateY(-1px);
  }

  .debtField::placeholder {
    color: rgba(225,233,245,0.38);
  }

  .debtField option {
    background: #08111f;
    color: #f4f7ff;
  }

  textarea.debtField {
    min-height: 110px;
    resize: vertical;
    padding: 12px 14px;
  }

  .debtActionGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .debtActionGridSingle {
    grid-template-columns: 1fr;
  }

  .debtActionBtn {
    min-height: 42px;
    padding: 10px 13px;
    border-radius: 15px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 800;
    line-height: 1;
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.03),
      0 8px 20px rgba(0,0,0,0.14);
  }

  .debtActionBtn:hover {
    transform: translateY(-1px);
  }

  .debtInlineTools {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .debtIconGhost {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.10);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012));
    color: rgba(247,251,255,0.88);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .debtIconGhost:hover {
    transform: translateY(-1px);
  }

  .debtIconGhostDanger {
    border-color: rgba(255,132,163,0.18);
    color: #ffd3df;
  }

  .debtMoreMenu {
    position: relative;
  }

  .debtMoreMenu summary {
    list-style: none;
  }

  .debtMoreMenu summary::-webkit-details-marker {
    display: none;
  }

  .debtMoreTrigger {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012));
    color: rgba(247,251,255,0.88);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .debtMoreTrigger:hover {
    transform: translateY(-1px);
  }

  .debtMorePanel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 190px;
    z-index: 20;
    display: grid;
    gap: 6px;
    padding: 8px;
    border-radius: 16px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(10,15,24,0.96), rgba(6,10,18,0.96));
    box-shadow:
      0 18px 50px rgba(0,0,0,0.35),
      inset 0 1px 0 rgba(255,255,255,0.04);
  }

  .debtMoreItem {
    min-height: 40px;
    width: 100%;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.10);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012));
    color: #f7fbff;
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    padding: 0 12px;
    font-size: 12.5px;
    font-weight: 800;
    cursor: pointer;
  }

  .debtMoreDanger {
    border-color: rgba(255,132,163,0.18);
    color: #ffd3df;
  }

  .debtInsightList {
    display: grid;
    gap: 10px;
  }

  .debtInsightItem {
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.055);
    background: rgba(255,255,255,0.024);
    padding: 12px;
  }

  .debtInsightTitle {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .14em;
    font-weight: 800;
    color: rgba(255,255,255,0.46);
  }

  .debtInsightValue {
    margin-top: 6px;
    font-size: 15px;
    font-weight: 900;
    color: #fff;
    line-height: 1.25;
  }

  .debtInsightSub {
    margin-top: 5px;
    font-size: 12px;
    line-height: 1.45;
    color: rgba(255,255,255,0.62);
  }

  .debtIntelList {
    display: grid;
    gap: 10px;
    min-height: 180px;
    max-height: 320px;
    overflow: auto;
    padding-right: 2px;
  }

  .debtIntelItem {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.07);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    padding: 12px;
    display: grid;
    gap: 10px;
  }

  .debtIntelTitle {
    font-size: 13px;
    font-weight: 800;
    color: #fff;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .debtIntelSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.35;
  }

  .debtEmptyState {
    min-height: 150px;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 14px;
  }

  .debtGrowEmpty {
    flex: 1 1 auto;
    min-height: 0;
  }

  .debtInlineEmpty {
    min-height: 220px;
  }

  .debtEmptyTitle {
    font-size: 16px;
    font-weight: 850;
    color: #fff;
  }

  .debtEmptyText {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.5;
    color: rgba(255,255,255,0.60);
    max-width: 360px;
  }

  .debtEmptyMini {
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.024);
    padding: 14px;
    color: rgba(255,255,255,0.62);
    font-size: 12.5px;
    line-height: 1.5;
  }

  .debtDrawerRoot {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: flex;
    justify-content: flex-end;
  }

  .debtDrawerBackdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(3, 6, 12, 0.62);
    backdrop-filter: blur(8px);
    cursor: pointer;
  }

  .debtDrawerPanel {
    position: relative;
    width: min(760px, 100%);
    height: 100%;
    background:
      linear-gradient(180deg, rgba(7,12,21,0.96), rgba(4,8,16,0.97));
    border-left: 1px solid rgba(214,226,255,0.12);
    box-shadow:
      -24px 0 80px rgba(0,0,0,0.42),
      inset 0 1px 0 rgba(255,255,255,0.03);
    display: grid;
    grid-template-rows: auto 1fr auto;
  }

  .debtDrawerHeader {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    padding: 18px 18px 16px;
    border-bottom: 1px solid rgba(214,226,255,0.08);
  }

  .debtDrawerEyebrow {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .18em;
    font-weight: 800;
    color: rgba(255,255,255,0.42);
  }

  .debtDrawerTitle {
    margin-top: 6px;
    font-size: 26px;
    line-height: 1.02;
    font-weight: 850;
    letter-spacing: -0.04em;
    color: #fff;
  }

  .debtDrawerSub {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.55;
    color: rgba(255,255,255,0.62);
    max-width: 560px;
  }

  .debtDrawerBody {
    overflow: auto;
    padding: 18px;
    display: grid;
    gap: 14px;
    min-height: 0;
  }

  .debtDrawerFooter {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 18px 18px;
    border-top: 1px solid rgba(214,226,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.02));
  }

  @media (max-width: 1560px) {
    .debtWorkspaceGrid {
      grid-template-columns: minmax(320px, 0.84fr) minmax(560px, 1.24fr) minmax(300px, 0.74fr);
    }
  }

  @media (max-width: 1420px) {
    .debtControlsGrid {
      grid-template-columns: 1fr;
    }

    .debtWorkspaceGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .debtWorkspaceGrid > :nth-child(3) {
      grid-column: 1 / -1;
    }

    .debtSummarySplit {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 1260px) {
    .debtMetricGrid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .debtInfoGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .debtFormGrid4 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 1100px) {
    .debtHeroGrid,
    .debtWorkspaceGrid,
    .debtSummaryHero {
      grid-template-columns: 1fr;
    }

    .debtHeroSide,
    .debtHeroChips {
      justify-content: flex-start;
    }

    .debtDrawerPanel {
      width: 100%;
    }
  }

  @media (max-width: 1024px) {
    .debtStackRow,
    .debtStackMetrics,
    .debtInfoGrid,
    .debtFormGrid2,
    .debtFormGrid4,
    .debtActionGrid {
      grid-template-columns: 1fr;
    }

    .debtRosterListCompact,
    .debtIntelList {
      min-height: 0;
      max-height: none;
    }
  }

  @media (max-width: 760px) {
    .debtPageShell {
      padding: 0 0 14px;
    }

    .debtMetricGrid {
      grid-template-columns: 1fr;
    }

    .debtStackTop,
    .debtStackFooter {
      flex-direction: column;
      align-items: flex-start;
    }

    .debtDrawerHeader,
    .debtDrawerBody,
    .debtDrawerFooter {
      padding-left: 14px;
      padding-right: 14px;
    }
  }

  @media (max-width: 640px) {
    .debtFocusHeaderTools {
      width: 100%;
      justify-content: flex-start;
    }

    .debtMorePanel {
      right: auto;
      left: 0;
    }

    .debtDrawerFooter {
      flex-direction: column;
    }
  }
`;
