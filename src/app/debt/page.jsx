"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeDollarSign,
  CalendarClock,
  Copy,
  CreditCard,
  Flame,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../components/GlassPane";

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

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function fmtMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtMoneyTight(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0.00";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function fmtPct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0.00%";
  return `${num.toFixed(2)}%`;
}

function monthLabel(months) {
  if (!Number.isFinite(months)) return "No payoff";
  if (months <= 0) return "Paid";
  if (months < 1) return "<1 mo";
  if (months < 12) return `${Math.ceil(months)} mo`;
  const years = Math.floor(months / 12);
  const rem = Math.ceil(months % 12);
  return rem ? `${years} yr ${rem} mo` : `${years} yr`;
}

function nextMonthDate(monthsFromNow) {
  if (!Number.isFinite(monthsFromNow)) return "—";
  const d = new Date();
  d.setMonth(d.getMonth() + Math.max(0, monthsFromNow));
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
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

function currentMonthLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function payoffMonths(balance, apr, payment) {
  balance = safeNum(balance);
  apr = safeNum(apr);
  payment = safeNum(payment);

  if (balance <= 0) return 0;
  if (payment <= 0) return Infinity;

  const monthlyRate = apr / 100 / 12;

  if (monthlyRate <= 0) return balance / payment;
  if (payment <= balance * monthlyRate) return Infinity;

  const months =
    -Math.log(1 - (balance * monthlyRate) / payment) /
    Math.log(1 + monthlyRate);

  return Number.isFinite(months) ? months : Infinity;
}

function debtTypeLabel(type) {
  const map = {
    mortgage: "Mortgage",
    auto: "Auto Loan",
    credit_card: "Credit Card",
    personal_loan: "Personal Loan",
    student_loan: "Student Loan",
    other: "Other Debt",
  };
  return map[type] || "Debt";
}

function debtInitials(name = "") {
  const clean = String(name).trim();
  if (!clean) return "DT";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function createDebt(type = "other") {
  return {
    id: uid(),
    name:
      type === "mortgage"
        ? "Mortgage"
        : type === "auto"
        ? "Car Loan"
        : type === "credit_card"
        ? "Credit Card"
        : type === "personal_loan"
        ? "Personal Loan"
        : type === "student_loan"
        ? "Student Loan"
        : "New Debt",
    type,
    lender: "",
    balance: 0,
    originalBalance: 0,
    creditLimit: 0,
    apr: 0,
    minimumPayment: 0,
    extraPayment: 0,
    dueDay: "",
    monthlyPayment: 0,
    principalPortion: 0,
    interestPortion: 0,
    escrowPortion: 0,
    promoApr: "",
    promoEnds: "",
    notes: "",
    isActive: true,
    createdAt: Date.now(),
    updatedAt: new Date().toISOString(),
    termMonths: null,
    remainingMonths: null,
  };
}

const defaultSettings = {
  strategy: "avalanche",
  globalExtraPool: 0,
  showInactive: false,
};

function mapDebtRow(row) {
  return {
    id: row.id,
    name: row.name ?? "",
    type: row.debt_type ?? "other",
    lender: row.lender ?? "",
    balance: safeNum(row.balance, 0),
    originalBalance: safeNum(row.original_balance, 0),
    creditLimit: safeNum(row.credit_limit, 0),
    apr: safeNum(row.interest_rate, 0),
    minimumPayment: safeNum(row.minimum_payment, 0),
    extraPayment: safeNum(row.extra_payment, 0),
    dueDay: row.due_day == null ? "" : String(row.due_day),
    monthlyPayment: safeNum(row.monthly_payment, 0),
    principalPortion: safeNum(row.principal_portion, 0),
    interestPortion: safeNum(row.interest_portion, 0),
    escrowPortion: safeNum(row.escrow_portion, 0),
    promoApr: row.promo_apr ?? "",
    promoEnds: row.promo_ends ?? "",
    notes: row.notes ?? "",
    isActive: row.is_active ?? true,
    createdAt:
      row.created_at_ms ??
      (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
    updatedAt: row.updated_at || row.created_at || null,
    termMonths: row.term_months ?? null,
    remainingMonths: row.remaining_months ?? null,
  };
}

function mapDebtToRow(debt, userId) {
  return {
    id: debt.id,
    user_id: userId,
    name: debt.name ?? "",
    lender: debt.lender ?? "",
    debt_type: debt.type ?? "other",
    balance: safeNum(debt.balance, 0),
    original_balance: safeNum(debt.originalBalance, 0),
    credit_limit: safeNum(debt.creditLimit, 0),
    interest_rate: safeNum(debt.apr, 0),
    minimum_payment: safeNum(debt.minimumPayment, 0),
    extra_payment: safeNum(debt.extraPayment, 0),
    due_day:
      debt.dueDay === "" || debt.dueDay == null
        ? null
        : safeNum(debt.dueDay, null),
    monthly_payment: safeNum(debt.monthlyPayment, 0),
    principal_portion: safeNum(debt.principalPortion, 0),
    interest_portion: safeNum(debt.interestPortion, 0),
    escrow_portion: safeNum(debt.escrowPortion, 0),
    promo_apr: debt.promoApr ?? "",
    promo_ends: debt.promoEnds || null,
    notes: debt.notes ?? "",
    is_active: !!debt.isActive,
    created_at_ms: debt.createdAt ?? Date.now(),
    term_months: debt.termMonths ?? null,
    remaining_months: debt.remainingMonths ?? null,
    updated_at: new Date().toISOString(),
  };
}

function mapSettingsRow(row) {
  return {
    strategy: row?.strategy ?? "avalanche",
    globalExtraPool: safeNum(row?.global_extra_pool, 0),
    showInactive: !!row?.show_inactive,
  };
}

function mapSettingsToRow(settings, userId, existingId) {
  return {
    ...(existingId ? { id: existingId } : {}),
    user_id: userId,
    strategy: settings.strategy ?? "avalanche",
    global_extra_pool: safeNum(settings.globalExtraPool, 0),
    show_inactive: !!settings.showInactive,
    updated_at: new Date().toISOString(),
  };
}

function getDueStatus(dueDay) {
  const day = Number(dueDay);
  if (!Number.isFinite(day) || day < 1 || day > 31) {
    return { label: "No due day", tone: "neutral", sort: 999 };
  }

  const now = new Date();
  const today = now.getDate();

  if (day === today) return { label: "Due today", tone: "amber", sort: 0 };

  if (day > today) {
    const diff = day - today;
    return {
      label: diff === 1 ? "Due tomorrow" : `Due in ${diff}d`,
      tone: diff <= 3 ? "amber" : "green",
      sort: diff,
    };
  }

  const late = today - day;
  return {
    label: `${late}d late`,
    tone: late >= 7 ? "red" : "amber",
    sort: -late,
  };
}

function getUtilizationPercent(debt) {
  if (debt.type !== "credit_card") return null;
  const limit = safeNum(debt.creditLimit);
  const bal = safeNum(debt.balance);
  if (limit <= 0) return null;
  return Math.max(0, Math.min(100, (bal / limit) * 100));
}

function getPaidDownPercent(debt) {
  const original = safeNum(debt.originalBalance);
  const bal = safeNum(debt.balance);
  if (original <= 0) return null;
  const paid = ((original - bal) / original) * 100;
  return Math.max(0, Math.min(100, paid));
}

function getMortgageTotal(debt) {
  return (
    safeNum(debt.principalPortion) +
    safeNum(debt.interestPortion) +
    safeNum(debt.escrowPortion)
  );
}

function getMonthlyShown(debt) {
  const mortgageTotal = getMortgageTotal(debt);
  if (debt.type === "mortgage" && mortgageTotal > 0) return mortgageTotal;
  return Math.max(safeNum(debt.monthlyPayment), safeNum(debt.minimumPayment));
}

function getAttackPayment(debt) {
  return safeNum(debt.minimumPayment) + safeNum(debt.extraPayment);
}

function getDebtProgressPercent(debt) {
  const util = getUtilizationPercent(debt);
  if (util !== null) return Math.max(0, Math.min(100, 100 - util));

  const paid = getPaidDownPercent(debt);
  if (paid !== null) return paid;

  const payoff = payoffMonths(debt.balance, debt.apr, getAttackPayment(debt));
  if (!Number.isFinite(payoff)) return 4;
  if (payoff <= 12) return 85;
  if (payoff <= 24) return 62;
  if (payoff <= 48) return 38;
  return 18;
}

function getDebtBarTone(debt) {
  const util = getUtilizationPercent(debt);
  const apr = safeNum(debt.apr);
  const due = getDueStatus(debt.dueDay);

  if (due.tone === "red") return "red";
  if (util !== null) {
    if (util >= 90) return "red";
    if (util >= 50) return "amber";
    return "green";
  }

  if (apr >= 24) return "red";
  if (apr >= 12) return "amber";
  return "green";
}

function getPromoStatus(debt) {
  if (!debt.promoEnds) return null;
  const end = new Date(debt.promoEnds);
  if (Number.isNaN(end.getTime())) return null;

  const now = new Date();
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / 86400000);

  if (diffDays < 0) return { label: "Promo ended", tone: "red" };
  if (diffDays <= 30) return { label: `Promo ends in ${diffDays}d`, tone: "amber" };
  return { label: `Promo ends in ${diffDays}d`, tone: "green" };
}

function getPrincipalShare(debt) {
  if (debt.type !== "mortgage") return null;
  const principal = safeNum(debt.principalPortion);
  const total = getMortgageTotal(debt);
  if (total <= 0) return null;
  return Math.max(0, Math.min(100, (principal / total) * 100));
}

function getDebtChip(debt, priority) {
  const util = getUtilizationPercent(debt);
  const promo = getPromoStatus(debt);
  const principalShare = getPrincipalShare(debt);

  if (priority === 1) return { label: "Target #1", tone: "amber" };
  if (promo && promo.tone !== "green") return promo;

  if (util !== null) {
    if (util >= 90) return { label: "Maxed pressure", tone: "red" };
    if (util >= 50) return { label: `${Math.round(util)}% used`, tone: "amber" };
    return { label: `${Math.round(util)}% used`, tone: "green" };
  }

  if (principalShare !== null) {
    if (principalShare < 25) return { label: "Interest heavy", tone: "amber" };
    return { label: `${Math.round(principalShare)}% principal`, tone: "green" };
  }

  const apr = safeNum(debt.apr);
  if (apr >= 24) return { label: "APR drag", tone: "red" };
  if (apr >= 15) return { label: "Watch APR", tone: "amber" };

  const payoff = payoffMonths(debt.balance, debt.apr, getAttackPayment(debt));
  if (Number.isFinite(payoff) && payoff <= 12) return { label: "Close win", tone: "green" };

  return { label: "On plan", tone: "neutral" };
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
        marginBottom: 10,
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
              marginTop: 3,
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
          ? "1px solid rgba(255,132,163,0.18)"
          : isPrimary
          ? "1px solid rgba(143,177,255,0.18)"
          : "1px solid rgba(214,226,255,0.10)",
        background: isDanger
          ? "linear-gradient(180deg, rgba(255,132,163,0.10), rgba(255,132,163,0.05))"
          : isPrimary
          ? "linear-gradient(180deg, rgba(143,177,255,0.14), rgba(143,177,255,0.06))"
          : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        color: isDanger ? "#ffd3df" : "#f7fbff",
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
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

function CompactDebtRow({
  debt,
  selected,
  priority,
  onSelect,
  onDuplicate,
  onToggle,
  onDelete,
}) {
  const due = getDueStatus(debt.dueDay);
  const tone = getDebtBarTone(debt);
  const meta = toneMeta(tone);
  const chip = getDebtChip(debt, priority);
  const monthlyShown = getMonthlyShown(debt);

  return (
    <div
      className="debtCompactRow"
      onClick={onSelect}
      style={{
        borderColor: selected ? meta.border : "rgba(255,255,255,0.07)",
        boxShadow: selected
          ? `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(255,255,255,0.01), 0 0 24px ${meta.glow}`
          : "inset 0 1px 0 rgba(255,255,255,0.025)",
      }}
    >
      <div
        className="debtCompactAvatar"
        style={{
          borderColor: meta.border,
          color: tone === "neutral" ? "#fff" : meta.text,
          boxShadow: `0 0 12px ${meta.glow}`,
        }}
      >
        {debtInitials(debt.name)}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div className="debtCompactTitle">{debt.name || "Untitled debt"}</div>
          <MiniPill>{debtTypeLabel(debt.type)}</MiniPill>
          <MiniPill tone={due.tone}>{due.label}</MiniPill>
          <MiniPill tone={chip.tone}>{chip.label}</MiniPill>
          {!debt.isActive ? <MiniPill>Inactive</MiniPill> : null}
        </div>

        <div className="debtCompactSub">
          {debt.lender || "No lender"} • {fmtPct(debt.apr)} APR • Monthly{" "}
          {fmtMoney(monthlyShown)} • Updated {formatAgo(debt.updatedAt)}
        </div>

        <div style={{ marginTop: 10 }}>
          <ProgressBar fill={getDebtProgressPercent(debt)} tone={tone} />
        </div>
      </div>

      <div className="debtCompactValue">{fmtMoney(debt.balance)}</div>

      <div className="debtCompactActions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="debtIconBtn"
          onClick={onDuplicate}
          aria-label="Duplicate debt"
          title="Duplicate debt"
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          className="debtIconBtn"
          onClick={onToggle}
          aria-label={debt.isActive ? "Mark inactive" : "Mark active"}
          title={debt.isActive ? "Mark inactive" : "Mark active"}
        >
          {debt.isActive ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
        </button>
        <button
          type="button"
          className="debtIconBtn debtDangerBtn"
          onClick={onDelete}
          aria-label="Delete debt"
          title="Delete debt"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function FocusDebtCard({
  debt,
  priority,
  globalExtraPool,
  saving,
  onDuplicate,
  onToggle,
  onDelete,
}) {
  if (!debt) {
    return (
      <GlassPane size="card">
        <PaneHeader
          title="Selected Debt"
          subcopy="Choose one from the roster to work it here."
        />
        <div className="debtEmptyState" style={{ minHeight: 170 }}>
          <div>
            <div className="debtEmptyTitle">No debt selected</div>
            <div className="debtEmptyText">
              Pick one from the roster on the left.
            </div>
          </div>
        </div>
      </GlassPane>
    );
  }

  const due = getDueStatus(debt.dueDay);
  const tone = getDebtBarTone(debt);
  const meta = toneMeta(tone);
  const util = getUtilizationPercent(debt);
  const paidDown = getPaidDownPercent(debt);
  const principalShare = getPrincipalShare(debt);
  const plannedAttack =
    getAttackPayment(debt) + (priority === 1 ? safeNum(globalExtraPool) : 0);
  const payoff = payoffMonths(debt.balance, debt.apr, plannedAttack);
  const chip = getDebtChip(debt, priority);
  const promo = getPromoStatus(debt);

  return (
    <GlassPane tone={tone} size="card" style={{ height: "100%" }}>
      <PaneHeader
        title={debt.name || "Untitled debt"}
        subcopy="Focused controls for the debt you are actively touching."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <MiniPill>{debtTypeLabel(debt.type)}</MiniPill>
            <MiniPill tone={due.tone}>{due.label}</MiniPill>
            <MiniPill tone={chip.tone}>{chip.label}</MiniPill>
            {!debt.isActive ? <MiniPill>Inactive</MiniPill> : null}
            {saving ? <MiniPill tone="amber">Saving...</MiniPill> : null}
          </div>
        }
      />

      <div className="debtFocusBox">
        <div className="debtTinyLabel">Current Balance</div>

        <div
          style={{
            marginTop: 8,
            fontSize: "clamp(30px, 4vw, 46px)",
            lineHeight: 1,
            fontWeight: 850,
            letterSpacing: "-0.05em",
            color: tone === "neutral" ? "#fff" : meta.text,
          }}
        >
          {fmtMoney(debt.balance)}
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "rgba(255,255,255,0.58)",
          }}
        >
          {debt.lender || "No lender"} • Updated {fmtWhen(debt.updatedAt)}
        </div>

        <div className="debtInfoGrid" style={{ marginTop: 14 }}>
          <div className="debtInfoCell">
            <div className="debtTinyLabel">APR</div>
            <div className="debtInfoValue">{fmtPct(debt.apr)}</div>
            <div className="debtInfoSub">
              {promo ? promo.label : "Standard interest rate"}
            </div>
          </div>

          <div className="debtInfoCell">
            <div className="debtTinyLabel">Monthly Attack</div>
            <div className="debtInfoValue">{fmtMoney(plannedAttack)}</div>
            <div className="debtInfoSub">
              Min + extra
              {priority === 1 && safeNum(globalExtraPool) > 0 ? " + pool" : ""}
            </div>
          </div>

          <div className="debtInfoCell">
            <div className="debtTinyLabel">Payoff</div>
            <div className="debtInfoValue">{monthLabel(payoff)}</div>
            <div className="debtInfoSub">
              {Number.isFinite(payoff)
                ? nextMonthDate(Math.ceil(payoff))
                : "Payment too low"}
            </div>
          </div>

          <div className="debtInfoCell">
            <div className="debtTinyLabel">
              {util !== null
                ? "Utilization"
                : paidDown !== null
                ? "Paid Down"
                : principalShare !== null
                ? "Principal Share"
                : "Monthly"}
            </div>
            <div className="debtInfoValue">
              {util !== null
                ? `${Math.round(util)}%`
                : paidDown !== null
                ? `${Math.round(paidDown)}%`
                : principalShare !== null
                ? `${Math.round(principalShare)}%`
                : fmtMoney(getMonthlyShown(debt))}
            </div>
            <div className="debtInfoSub">
              {util !== null
                ? "Of total credit limit"
                : paidDown !== null
                ? "Of original balance"
                : principalShare !== null
                ? "Principal in payment"
                : "Displayed monthly payment"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <ProgressBar fill={getDebtProgressPercent(debt)} tone={tone} />
        </div>

        {debt.type === "mortgage" ? (
          <div className="debtMortgageGrid" style={{ marginTop: 12 }}>
            <div className="debtInfoCell">
              <div className="debtTinyLabel">Principal</div>
              <div className="debtInfoValue">{fmtMoney(debt.principalPortion)}</div>
            </div>
            <div className="debtInfoCell">
              <div className="debtTinyLabel">Interest</div>
              <div className="debtInfoValue">{fmtMoney(debt.interestPortion)}</div>
            </div>
            <div className="debtInfoCell">
              <div className="debtTinyLabel">Escrow</div>
              <div className="debtInfoValue">{fmtMoney(debt.escrowPortion)}</div>
            </div>
          </div>
        ) : null}

        {debt.notes ? (
          <div className="debtInfoCell" style={{ marginTop: 12 }}>
            <div className="debtTinyLabel">Notes</div>
            <div className="debtInfoSub" style={{ color: "#fff" }}>
              {debt.notes}
            </div>
          </div>
        ) : null}

        <div className="debtActionGrid debtActionGridTight" style={{ marginTop: 14 }}>
          <ActionBtn onClick={onDuplicate} full>
            <Copy size={14} /> Duplicate
          </ActionBtn>
          <ActionBtn onClick={onToggle} full>
            {debt.isActive ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
            {debt.isActive ? "Mark Inactive" : "Mark Active"}
          </ActionBtn>
          <ActionBtn variant="danger" onClick={onDelete} full>
            <Trash2 size={14} /> Delete
          </ActionBtn>
        </div>
      </div>
    </GlassPane>
  );
}

function AddDebtCard({ adding, setAdding, onAdd, saving }) {
  return (
    <GlassPane size="card" style={{ height: "100%" }}>
      <PaneHeader
        title="Add Debt"
        subcopy="Keep this fast and simple."
        right={
          <MiniPill>
            <Plus size={13} /> New
          </MiniPill>
        }
      />

      <div className="debtFormStack">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["credit_card", "Credit Card"],
            ["auto", "Auto Loan"],
            ["mortgage", "Mortgage"],
            ["other", "Other"],
          ].map(([value, label]) => (
            <ActionBtn
              key={value}
              variant={adding.type === value ? "primary" : "ghost"}
              onClick={() => setAdding((p) => ({ ...p, type: value }))}
            >
              {label}
            </ActionBtn>
          ))}
        </div>

        <div>
          <div className="debtTinyLabel">Debt Name</div>
          <input
            className="debtField"
            placeholder="Amex Gold, Mortgage, Car Loan..."
            value={adding.name}
            onChange={(e) => setAdding((p) => ({ ...p, name: e.target.value }))}
          />
        </div>

        <div className="debtFormGrid2">
          <div>
            <div className="debtTinyLabel">Type</div>
            <select
              className="debtField"
              value={adding.type}
              onChange={(e) => setAdding((p) => ({ ...p, type: e.target.value }))}
            >
              <option value="mortgage">Mortgage</option>
              <option value="auto">Auto Loan</option>
              <option value="credit_card">Credit Card</option>
              <option value="personal_loan">Personal Loan</option>
              <option value="student_loan">Student Loan</option>
              <option value="other">Other Debt</option>
            </select>
          </div>

          <div>
            <div className="debtTinyLabel">Lender</div>
            <input
              className="debtField"
              placeholder="Bank / lender"
              value={adding.lender}
              onChange={(e) => setAdding((p) => ({ ...p, lender: e.target.value }))}
            />
          </div>
        </div>

        <div className="debtFormGrid3">
          <div>
            <div className="debtTinyLabel">Balance</div>
            <input
              className="debtField"
              inputMode="decimal"
              placeholder="0.00"
              value={adding.balance}
              onChange={(e) => setAdding((p) => ({ ...p, balance: e.target.value }))}
            />
          </div>

          <div>
            <div className="debtTinyLabel">APR %</div>
            <input
              className="debtField"
              inputMode="decimal"
              placeholder="24.99"
              value={adding.apr}
              onChange={(e) => setAdding((p) => ({ ...p, apr: e.target.value }))}
            />
          </div>

          <div>
            <div className="debtTinyLabel">Due Day</div>
            <input
              className="debtField"
              placeholder="1-31"
              value={adding.dueDay}
              onChange={(e) => setAdding((p) => ({ ...p, dueDay: e.target.value }))}
            />
          </div>
        </div>

        <div className="debtFormGrid2">
          <div>
            <div className="debtTinyLabel">Minimum Payment</div>
            <input
              className="debtField"
              inputMode="decimal"
              placeholder="0.00"
              value={adding.minimumPayment}
              onChange={(e) =>
                setAdding((p) => ({ ...p, minimumPayment: e.target.value }))
              }
            />
          </div>

          <div>
            <div className="debtTinyLabel">Extra Payment</div>
            <input
              className="debtField"
              inputMode="decimal"
              placeholder="0.00"
              value={adding.extraPayment}
              onChange={(e) =>
                setAdding((p) => ({ ...p, extraPayment: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="debtActionGrid">
          <ActionBtn variant="primary" onClick={onAdd} full disabled={saving}>
            <Plus size={14} /> {saving ? "Saving..." : "Add Debt"}
          </ActionBtn>
        </div>
      </div>
    </GlassPane>
  );
}

function QueueItem({ debt, onFocus }) {
  const due = getDueStatus(debt.dueDay);
  const chip = getDebtChip(debt, debt.priority);

  return (
    <div className="debtIntelItem">
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
          <div className="debtIntelTitle">{debt.name}</div>
          <div className="debtIntelSub">
            {debt.lender || "No lender"} • {fmtPct(debt.apr)} APR •{" "}
            {fmtMoneyTight(debt.balance)}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <MiniPill tone={chip.tone}>{chip.label}</MiniPill>
          <MiniPill tone={due.tone}>{due.label}</MiniPill>
        </div>
      </div>

      <div style={{ marginTop: 2 }}>
        <ProgressBar
          fill={getDebtProgressPercent(debt)}
          tone={getDebtBarTone(debt)}
        />
      </div>

      <div className="debtIntelMiniGrid">
        <div className="debtIntelMini">
          <div className="debtTinyLabel">Attack</div>
          <div className="debtIntelValue">{fmtMoneyTight(debt.plannedAttack)}</div>
        </div>
        <div className="debtIntelMini">
          <div className="debtTinyLabel">Payoff</div>
          <div className="debtIntelValue">{monthLabel(debt.payoff)}</div>
        </div>
        <div className="debtIntelMini">
          <div className="debtTinyLabel">Rank</div>
          <div className="debtIntelValue">#{debt.priority}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ActionBtn onClick={onFocus}>Focus</ActionBtn>
      </div>
    </div>
  );
}

function DueItem({ debt, onFocus }) {
  const due = getDueStatus(debt.dueDay);

  return (
    <div className="debtIntelItem">
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
          <div className="debtIntelTitle">{debt.name}</div>
          <div className="debtIntelSub">
            Due day {debt.dueDay || "—"} • {fmtMoneyTight(debt.minimumPayment)}
          </div>
        </div>

        <MiniPill tone={due.tone}>{due.label}</MiniPill>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ActionBtn onClick={onFocus}>Focus</ActionBtn>
      </div>
    </div>
  );
}

function DebtEditorCard({ debt, saving, onPatch }) {
  if (!debt) {
    return (
      <GlassPane size="card">
        <PaneHeader
          title="Debt Details"
          subcopy="Select a debt to edit the deeper fields."
        />
        <div className="debtEmptyState" style={{ minHeight: 150 }}>
          <div>
            <div className="debtEmptyTitle">No debt selected</div>
            <div className="debtEmptyText">
              Choose one from the roster to edit it here.
            </div>
          </div>
        </div>
      </GlassPane>
    );
  }

  return (
    <GlassPane size="card">
      <PaneHeader
        title="Debt Details"
        subcopy="This section autosaves as you type."
        right={saving ? <MiniPill tone="amber">Saving...</MiniPill> : null}
      />

      <div className="debtFormStack">
        <div className="debtFormGrid3">
          <div>
            <div className="debtTinyLabel">Debt Name</div>
            <input
              className="debtField"
              value={debt.name}
              onChange={(e) => onPatch({ name: e.target.value })}
            />
          </div>

          <div>
            <div className="debtTinyLabel">Debt Type</div>
            <select
              className="debtField"
              value={debt.type}
              onChange={(e) => onPatch({ type: e.target.value })}
            >
              <option value="mortgage">Mortgage</option>
              <option value="auto">Auto Loan</option>
              <option value="credit_card">Credit Card</option>
              <option value="personal_loan">Personal Loan</option>
              <option value="student_loan">Student Loan</option>
              <option value="other">Other Debt</option>
            </select>
          </div>

          <div>
            <div className="debtTinyLabel">Lender</div>
            <input
              className="debtField"
              value={debt.lender}
              onChange={(e) => onPatch({ lender: e.target.value })}
            />
          </div>
        </div>

        <div className="debtFormGrid4">
          <div>
            <div className="debtTinyLabel">Current Balance</div>
            <input
              className="debtField"
              value={String(debt.balance || "")}
              onChange={(e) =>
                onPatch({ balance: safeNum(parseMoneyInput(e.target.value), 0) })
              }
            />
          </div>

          <div>
            <div className="debtTinyLabel">Original Balance</div>
            <input
              className="debtField"
              value={String(debt.originalBalance || "")}
              onChange={(e) =>
                onPatch({
                  originalBalance: safeNum(parseMoneyInput(e.target.value), 0),
                })
              }
            />
          </div>

          <div>
            <div className="debtTinyLabel">Credit Limit</div>
            <input
              className="debtField"
              value={String(debt.creditLimit || "")}
              onChange={(e) =>
                onPatch({
                  creditLimit: safeNum(parseMoneyInput(e.target.value), 0),
                })
              }
            />
          </div>

          <div>
            <div className="debtTinyLabel">APR %</div>
            <input
              className="debtField"
              value={String(debt.apr || "")}
              onChange={(e) => onPatch({ apr: safeNum(e.target.value, 0) })}
            />
          </div>

          <div>
            <div className="debtTinyLabel">Minimum Payment</div>
            <input
              className="debtField"
              value={String(debt.minimumPayment || "")}
              onChange={(e) =>
                onPatch({
                  minimumPayment: safeNum(parseMoneyInput(e.target.value), 0),
                })
              }
            />
          </div>

          <div>
            <div className="debtTinyLabel">Extra Payment</div>
            <input
              className="debtField"
              value={String(debt.extraPayment || "")}
              onChange={(e) =>
                onPatch({
                  extraPayment: safeNum(parseMoneyInput(e.target.value), 0),
                })
              }
            />
          </div>

          <div>
            <div className="debtTinyLabel">Monthly Payment</div>
            <input
              className="debtField"
              value={String(debt.monthlyPayment || "")}
              onChange={(e) =>
                onPatch({
                  monthlyPayment: safeNum(parseMoneyInput(e.target.value), 0),
                })
              }
            />
          </div>

          <div>
            <div className="debtTinyLabel">Due Day</div>
            <input
              className="debtField"
              value={debt.dueDay}
              onChange={(e) => onPatch({ dueDay: e.target.value })}
            />
          </div>

          <div>
            <div className="debtTinyLabel">Promo APR %</div>
            <input
              className="debtField"
              value={debt.promoApr}
              onChange={(e) => onPatch({ promoApr: e.target.value })}
            />
          </div>

          <div>
            <div className="debtTinyLabel">Promo Ends</div>
            <input
              className="debtField"
              type="date"
              value={debt.promoEnds || ""}
              onChange={(e) => onPatch({ promoEnds: e.target.value })}
            />
          </div>

          <div>
            <div className="debtTinyLabel">Term Months</div>
            <input
              className="debtField"
              value={debt.termMonths ?? ""}
              onChange={(e) =>
                onPatch({
                  termMonths:
                    e.target.value === "" ? null : safeNum(e.target.value, null),
                })
              }
            />
          </div>

          <div>
            <div className="debtTinyLabel">Remaining Months</div>
            <input
              className="debtField"
              value={debt.remainingMonths ?? ""}
              onChange={(e) =>
                onPatch({
                  remainingMonths:
                    e.target.value === "" ? null : safeNum(e.target.value, null),
                })
              }
            />
          </div>
        </div>

        {debt.type === "mortgage" ? (
          <div className="debtMortgageGrid">
            <div>
              <div className="debtTinyLabel">Principal Portion</div>
              <input
                className="debtField"
                value={String(debt.principalPortion || "")}
                onChange={(e) =>
                  onPatch({
                    principalPortion: safeNum(parseMoneyInput(e.target.value), 0),
                  })
                }
              />
            </div>

            <div>
              <div className="debtTinyLabel">Interest Portion</div>
              <input
                className="debtField"
                value={String(debt.interestPortion || "")}
                onChange={(e) =>
                  onPatch({
                    interestPortion: safeNum(parseMoneyInput(e.target.value), 0),
                  })
                }
              />
            </div>

            <div>
              <div className="debtTinyLabel">Escrow Portion</div>
              <input
                className="debtField"
                value={String(debt.escrowPortion || "")}
                onChange={(e) =>
                  onPatch({
                    escrowPortion: safeNum(parseMoneyInput(e.target.value), 0),
                  })
                }
              />
            </div>
          </div>
        ) : null}

        <div>
          <div className="debtTinyLabel">Notes</div>
          <textarea
            className="debtField"
            rows={5}
            value={debt.notes}
            onChange={(e) => onPatch({ notes: e.target.value })}
            placeholder="Rate notes, balance transfer info, refinance thoughts..."
          />
        </div>
      </div>
    </GlassPane>
  );
}

export default function DebtPage() {
  const [debts, setDebts] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const [sort, setSort] = useState("priority");
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState({});
  const [userId, setUserId] = useState(null);
  const [settingsRowId, setSettingsRowId] = useState(null);
  const [adding, setAdding] = useState({
    type: "credit_card",
    name: "",
    lender: "",
    balance: "",
    apr: "",
    minimumPayment: "",
    extraPayment: "",
    dueDay: "",
  });
  const [addingBusy, setAddingBusy] = useState(false);

  const settingsSaveTimer = useRef(null);
  const rowSaveTimers = useRef({});

  async function getCurrentUser() {
    if (!supabase) return null;

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("getUser error:", error);
      return null;
    }

    return user ?? null;
  }

  async function loadDebtPage() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const user = await getCurrentUser();
    if (!user) {
      setUserId(null);
      setDebts([]);
      setSettings(defaultSettings);
      setSelectedDebtId("");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const [debtRes, settingsRes] = await Promise.all([
      supabase
        .from("debt")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("debt_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (debtRes.error) console.error("load debt error:", debtRes.error);
    if (settingsRes.error) console.error("load debt settings error:", settingsRes.error);

    const mappedDebts = (debtRes.data || []).map(mapDebtRow);
    const mappedSettings = settingsRes.data
      ? mapSettingsRow(settingsRes.data)
      : defaultSettings;

    setDebts(mappedDebts);
    setSettings(mappedSettings);
    setSettingsRowId(settingsRes.data?.id || null);
    setSelectedDebtId((prev) => prev || mappedDebts[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    loadDebtPage();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadDebtPage();
    });

    return () => {
      subscription?.unsubscribe?.();
      if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
      Object.values(rowSaveTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (!debts.length) {
      setSelectedDebtId("");
      return;
    }

    const exists = debts.some((d) => d.id === selectedDebtId);
    if (!exists) {
      setSelectedDebtId(debts[0]?.id || "");
    }
  }, [debts, selectedDebtId]);

  async function persistDebt(nextDebt) {
    if (!supabase || !userId) return;

    setSavingIds((prev) => ({ ...prev, [nextDebt.id]: true }));

    const { error } = await supabase
      .from("debt")
      .upsert(mapDebtToRow(nextDebt, userId), { onConflict: "id" });

    if (error) console.error("save debt error:", error);

    setSavingIds((prev) => ({ ...prev, [nextDebt.id]: false }));
  }

  function scheduleDebtSave(nextDebt) {
    if (rowSaveTimers.current[nextDebt.id]) {
      clearTimeout(rowSaveTimers.current[nextDebt.id]);
    }

    rowSaveTimers.current[nextDebt.id] = setTimeout(() => {
      persistDebt(nextDebt);
    }, 350);
  }

  async function persistSettings(nextSettings) {
    if (!supabase || !userId) return;

    const res = await supabase
      .from("debt_settings")
      .upsert(mapSettingsToRow(nextSettings, userId, settingsRowId), {
        onConflict: "user_id",
      })
      .select()
      .single();

    if (res.error) {
      console.error("save settings error:", res.error);
      return;
    }

    setSettingsRowId(res.data.id);
  }

  function scheduleSettingsSave(nextSettings) {
    if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
    settingsSaveTimer.current = setTimeout(() => {
      persistSettings(nextSettings);
    }, 350);
  }

  function updateSettings(patch) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      scheduleSettingsSave(next);
      return next;
    });
  }

  function updateDebt(id, patch) {
    setDebts((prev) => {
      const nextRows = prev.map((d) =>
        d.id === id
          ? { ...d, ...patch, updatedAt: new Date().toISOString() }
          : d
      );
      const changed = nextRows.find((d) => d.id === id);
      if (changed) scheduleDebtSave(changed);
      return nextRows;
    });
  }

  async function addDebtFromForm() {
    if (!supabase || !userId || addingBusy) return;

    const base = createDebt(adding.type);
    const name = adding.name.trim() || base.name;

    const next = {
      ...base,
      name,
      lender: adding.lender.trim(),
      balance: safeNum(parseMoneyInput(adding.balance), 0),
      apr: safeNum(adding.apr, 0),
      minimumPayment: safeNum(parseMoneyInput(adding.minimumPayment), 0),
      extraPayment: safeNum(parseMoneyInput(adding.extraPayment), 0),
      dueDay: adding.dueDay.trim(),
    };

    setAddingBusy(true);
    setDebts((prev) => [next, ...prev]);
    setSelectedDebtId(next.id);

    const { error } = await supabase.from("debt").insert(mapDebtToRow(next, userId));

    if (error) {
      console.error("add debt error:", error);
      await loadDebtPage();
    } else {
      setAdding({
        type: "credit_card",
        name: "",
        lender: "",
        balance: "",
        apr: "",
        minimumPayment: "",
        extraPayment: "",
        dueDay: "",
      });
    }

    setAddingBusy(false);
  }

  async function removeDebt(id) {
    if (!supabase || !userId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this debt?")) return;

    const nextDebts = debts.filter((d) => d.id !== id);
    setDebts(nextDebts);
    if (selectedDebtId === id) {
      setSelectedDebtId(nextDebts[0]?.id || "");
    }

    const { error } = await supabase
      .from("debt")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("delete debt error:", error);
      await loadDebtPage();
    }
  }

  async function duplicateDebt(debt) {
    if (!supabase || !userId) return;

    const cloned = {
      ...debt,
      id: uid(),
      name: `${debt.name || "Debt"} Copy`,
      createdAt: Date.now(),
      updatedAt: new Date().toISOString(),
    };

    setDebts((prev) => [cloned, ...prev]);
    setSelectedDebtId(cloned.id);

    const { error } = await supabase.from("debt").insert(mapDebtToRow(cloned, userId));
    if (error) {
      console.error("duplicate debt error:", error);
      await loadDebtPage();
    }
  }

  const activeDebts = useMemo(
    () => debts.filter((d) => d.isActive && safeNum(d.balance) > 0),
    [debts]
  );

  const totals = useMemo(() => {
    const totalBalance = activeDebts.reduce((sum, d) => sum + safeNum(d.balance), 0);
    const totalMinimum = activeDebts.reduce(
      (sum, d) => sum + safeNum(d.minimumPayment),
      0
    );
    const totalExtra = activeDebts.reduce(
      (sum, d) => sum + safeNum(d.extraPayment),
      0
    );

    const weightedApr =
      totalBalance > 0
        ? activeDebts.reduce(
            (sum, d) => sum + safeNum(d.balance) * safeNum(d.apr),
            0
          ) / totalBalance
        : 0;

    const mortgagePrincipal = activeDebts
      .filter((d) => d.type === "mortgage")
      .reduce((sum, d) => sum + safeNum(d.principalPortion), 0);

    const mortgageInterest = activeDebts
      .filter((d) => d.type === "mortgage")
      .reduce((sum, d) => sum + safeNum(d.interestPortion), 0);

    return {
      totalBalance,
      totalMinimum,
      totalExtra,
      weightedApr,
      mortgagePrincipal,
      mortgageInterest,
    };
  }, [activeDebts]);

  const rankedDebts = useMemo(() => {
    const rows = [...activeDebts];

    if (settings.strategy === "snowball") {
      rows.sort((a, b) => safeNum(a.balance) - safeNum(b.balance));
    } else {
      rows.sort((a, b) => {
        const aprDiff = safeNum(b.apr) - safeNum(a.apr);
        if (aprDiff !== 0) return aprDiff;
        return safeNum(a.balance) - safeNum(b.balance);
      });
    }

    return rows.map((d, i) => {
      const plannedAttack =
        getAttackPayment(d) + (i === 0 ? safeNum(settings.globalExtraPool) : 0);

      return {
        ...d,
        priority: i + 1,
        plannedAttack,
        payoff: payoffMonths(d.balance, d.apr, plannedAttack),
      };
    });
  }, [activeDebts, settings.strategy, settings.globalExtraPool]);

  const priorityMap = useMemo(() => {
    const map = new Map();
    rankedDebts.forEach((d) => map.set(d.id, d.priority));
    return map;
  }, [rankedDebts]);

  const topTarget = rankedDebts[0] || null;

  const quickStats = useMemo(() => {
    const creditCards = debts.filter(
      (d) => d.isActive && d.type === "credit_card"
    ).length;

    const installment = debts.filter(
      (d) =>
        d.isActive &&
        ["mortgage", "auto", "personal_loan", "student_loan"].includes(d.type)
    ).length;

    const totalAccounts = debts.filter((d) => d.isActive).length;

    return { creditCards, installment, totalAccounts };
  }, [debts]);

  const dueSoon = useMemo(() => {
    return activeDebts
      .map((d) => ({ ...d, due: getDueStatus(d.dueDay) }))
      .filter((d) => d.due.sort <= 7)
      .sort((a, b) => a.due.sort - b.due.sort)
      .slice(0, 6);
  }, [activeDebts]);

  const monthlyAttackTotal =
    totals.totalMinimum + totals.totalExtra + safeNum(settings.globalExtraPool);

  const visibleDebts = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = debts.filter((d) => {
      if (filter === "active" && !d.isActive) return false;
      if (filter === "inactive" && d.isActive) return false;
      if (filter === "cards" && d.type !== "credit_card") return false;

      if (filter === "installment") {
        if (!["mortgage", "auto", "personal_loan", "student_loan"].includes(d.type)) {
          return false;
        }
      }

      if (filter === "due") {
        const due = getDueStatus(d.dueDay);
        if (!(d.isActive && due.sort <= 7)) return false;
      }

      if (
        !settings.showInactive &&
        filter !== "inactive" &&
        filter !== "all" &&
        !d.isActive
      ) {
        return false;
      }

      if (!q) return true;

      return [d.name, d.lender, d.type, d.notes, debtTypeLabel(d.type)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    if (sort === "priority") {
      list.sort((a, b) => {
        const ar = priorityMap.get(a.id) ?? 999;
        const br = priorityMap.get(b.id) ?? 999;
        if (ar !== br) return ar - br;
        return safeNum(b.balance) - safeNum(a.balance);
      });
      return list;
    }

    if (sort === "balance") {
      list.sort((a, b) => safeNum(b.balance) - safeNum(a.balance));
      return list;
    }

    if (sort === "apr") {
      list.sort((a, b) => safeNum(b.apr) - safeNum(a.apr));
      return list;
    }

    if (sort === "name") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      return list;
    }

    if (sort === "updated") {
      list.sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
      return list;
    }

    list.sort((a, b) => getDueStatus(a.dueDay).sort - getDueStatus(b.dueDay).sort);
    return list;
  }, [debts, settings.showInactive, filter, search, sort, priorityMap]);

  const selectedDebt =
    debts.find((d) => d.id === selectedDebtId) || visibleDebts[0] || null;

  const selectedPriority = selectedDebt
    ? priorityMap.get(selectedDebt.id) ?? null
    : null;

  const weightedAprTone =
    totals.weightedApr >= 18 ? "red" : totals.weightedApr >= 10 ? "amber" : "green";

  if (loading) {
    return (
      <main className="debtPage">
        <div className="debtPageShell">
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
              Loading debt.
            </div>
          </GlassPane>
        </div>
        <style jsx global>{globalStyles}</style>
      </main>
    );
  }

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
                  Cleaner payoff pressure, tighter controls, stronger priority logic,
                  and a layout that actually fills the page instead of leaving dead space.
                </div>

                <div className="debtPillRow">
                  <MiniPill>{quickStats.totalAccounts} active debts</MiniPill>
                  <MiniPill>{currentMonthLabel()}</MiniPill>
                  <MiniPill>{quickStats.creditCards} cards</MiniPill>
                  <MiniPill>{quickStats.installment} installment</MiniPill>
                </div>
              </div>

              <div className="debtHeroSide">
                <MiniPill>{settings.strategy}</MiniPill>
                <MiniPill tone="green">{fmtMoney(monthlyAttackTotal)} attack</MiniPill>
                <MiniPill tone={dueSoon.length > 0 ? "amber" : "green"}>
                  {dueSoon.length} due soon
                </MiniPill>
              </div>
            </div>
          </GlassPane>

          <section className="debtMetricGrid">
            <StatCard
              icon={CreditCard}
              label="Total Debt Balance"
              value={fmtMoney(totals.totalBalance)}
              detail={`${quickStats.totalAccounts} active debt account${
                quickStats.totalAccounts === 1 ? "" : "s"
              }.`}
              tone="red"
            />
            <StatCard
              icon={BadgeDollarSign}
              label="Monthly Attack"
              value={fmtMoney(monthlyAttackTotal)}
              detail="Minimums + debt-specific extra + global pool."
              tone="green"
            />
            <StatCard
              icon={Flame}
              label="APR Pressure"
              value={fmtPct(totals.weightedApr)}
              detail={
                settings.strategy === "avalanche"
                  ? "Avalanche strategy active."
                  : "Snowball strategy active."
              }
              tone={weightedAprTone}
            />
            <StatCard
              icon={CalendarClock}
              label="Due Soon"
              value={String(dueSoon.length)}
              detail={topTarget ? `Top target: ${topTarget.name}` : "No target ranked yet."}
              tone={dueSoon.length > 0 ? "amber" : "green"}
            />
          </section>

          <GlassPane size="card">
            <PaneHeader
              title="Debt Controls"
              subcopy="Tune strategy, search the roster, and steer what the queue attacks first."
            />

            <div className="debtControlsGrid">
              <div>
                <div className="debtTinyLabel">Payoff Strategy</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionBtn
                    variant={settings.strategy === "avalanche" ? "primary" : "ghost"}
                    onClick={() => updateSettings({ strategy: "avalanche" })}
                  >
                    Avalanche
                  </ActionBtn>
                  <ActionBtn
                    variant={settings.strategy === "snowball" ? "primary" : "ghost"}
                    onClick={() => updateSettings({ strategy: "snowball" })}
                  >
                    Snowball
                  </ActionBtn>
                </div>
              </div>

              <div>
                <div className="debtTinyLabel">Global Extra Pool / Month</div>
                <input
                  className="debtField"
                  value={String(settings.globalExtraPool || "")}
                  onChange={(e) =>
                    updateSettings({
                      globalExtraPool: safeNum(parseMoneyInput(e.target.value), 0),
                    })
                  }
                  placeholder="e.g. 300"
                />
              </div>

              <div>
                <div className="debtTinyLabel">Show Inactive</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionBtn
                    variant={!settings.showInactive ? "primary" : "ghost"}
                    onClick={() => updateSettings({ showInactive: false })}
                  >
                    Hide
                  </ActionBtn>
                  <ActionBtn
                    variant={settings.showInactive ? "primary" : "ghost"}
                    onClick={() => updateSettings({ showInactive: true })}
                  >
                    Show
                  </ActionBtn>
                </div>
              </div>
            </div>
          </GlassPane>

          <section className="debtWorkspaceGrid">
            <GlassPane size="card" style={{ height: "100%" }}>
              <PaneHeader
                title="Debt Roster"
                subcopy="Main roster fills the page now instead of shrinking into the left and leaving dead space."
                right={<MiniPill>{visibleDebts.length} showing</MiniPill>}
              />

              <div className="debtRosterControls">
                <div className="debtSearchWrap">
                  <Search size={15} />
                  <input
                    className="debtField debtSearchField"
                    placeholder="Search debt"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="debtField"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="active">Active only</option>
                  <option value="all">All debts</option>
                  <option value="inactive">Inactive</option>
                  <option value="cards">Credit cards</option>
                  <option value="installment">Installment</option>
                  <option value="due">Due soon</option>
                </select>

                <select
                  className="debtField"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="priority">Priority</option>
                  <option value="due">Due first</option>
                  <option value="balance">Balance high → low</option>
                  <option value="apr">APR high → low</option>
                  <option value="updated">Recently updated</option>
                  <option value="name">Name</option>
                </select>
              </div>

              {visibleDebts.length ? (
                <div className="debtRosterListCompact">
                  {visibleDebts.map((debt) => (
                    <CompactDebtRow
                      key={debt.id}
                      debt={debt}
                      selected={debt.id === selectedDebt?.id}
                      priority={priorityMap.get(debt.id) ?? null}
                      onSelect={() => setSelectedDebtId(debt.id)}
                      onDuplicate={() => duplicateDebt(debt)}
                      onToggle={() => updateDebt(debt.id, { isActive: !debt.isActive })}
                      onDelete={() => removeDebt(debt.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="debtEmptyState">
                  <div>
                    <div className="debtEmptyTitle">No debts found</div>
                    <div className="debtEmptyText">
                      Clear filters or add a new debt account.
                    </div>
                  </div>
                </div>
              )}
            </GlassPane>

            <FocusDebtCard
              debt={selectedDebt}
              priority={selectedPriority}
              globalExtraPool={settings.globalExtraPool}
              saving={selectedDebt ? !!savingIds[selectedDebt.id] : false}
              onDuplicate={() => selectedDebt && duplicateDebt(selectedDebt)}
              onToggle={() =>
                selectedDebt &&
                updateDebt(selectedDebt.id, { isActive: !selectedDebt.isActive })
              }
              onDelete={() => selectedDebt && removeDebt(selectedDebt.id)}
            />

            <AddDebtCard
              adding={adding}
              setAdding={setAdding}
              onAdd={addDebtFromForm}
              saving={addingBusy}
            />
          </section>

          <section className="debtSectionGrid">
            <GlassPane size="card" style={{ height: "100%" }}>
              <PaneHeader
                title="Priority Queue"
                subcopy={
                  settings.strategy === "avalanche"
                    ? "Highest APR first."
                    : "Smallest balance first."
                }
                right={
                  <MiniPill>
                    {rankedDebts.length} item{rankedDebts.length === 1 ? "" : "s"}
                  </MiniPill>
                }
              />

              {rankedDebts.length ? (
                <div className="debtIntelList">
                  {rankedDebts.slice(0, 5).map((debt) => (
                    <QueueItem
                      key={debt.id}
                      debt={debt}
                      onFocus={() => setSelectedDebtId(debt.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="debtEmptyState debtInlineEmpty">
                  <div>
                    <div className="debtEmptyTitle">Nothing to rank yet</div>
                    <div className="debtEmptyText">
                      Add active balances and payment info to build a payoff order.
                    </div>
                  </div>
                </div>
              )}
            </GlassPane>

            <GlassPane size="card" style={{ height: "100%" }}>
              <PaneHeader
                title="Due Soon"
                subcopy="Fast action view for urgent payments."
                right={
                  <MiniPill>
                    {dueSoon.length} item{dueSoon.length === 1 ? "" : "s"}
                  </MiniPill>
                }
              />

              {dueSoon.length ? (
                <div className="debtIntelList">
                  {dueSoon.map((debt) => (
                    <DueItem
                      key={debt.id}
                      debt={debt}
                      onFocus={() => setSelectedDebtId(debt.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="debtEmptyState debtInlineEmpty">
                  <div>
                    <div className="debtEmptyTitle">Nothing urgent right now</div>
                    <div className="debtEmptyText">
                      No active debt has immediate due pressure.
                    </div>
                  </div>
                </div>
              )}
            </GlassPane>
          </section>

          <section className="debtLowerGrid">
            <GlassPane size="card" style={{ height: "100%" }}>
              <PaneHeader
                title="Debt Snapshot"
                subcopy="Quick monthly view of the whole debt stack."
              />

              <div className="debtSnapshotGrid">
                <div className="debtSnapshotRow">
                  <span>Total minimums</span>
                  <strong>{fmtMoney(totals.totalMinimum)}</strong>
                </div>
                <div className="debtSnapshotRow">
                  <span>Debt-specific extra</span>
                  <strong>{fmtMoney(totals.totalExtra)}</strong>
                </div>
                <div className="debtSnapshotRow">
                  <span>Global extra pool</span>
                  <strong>{fmtMoney(settings.globalExtraPool)}</strong>
                </div>
                <div className="debtSnapshotRow">
                  <span>Total monthly attack</span>
                  <strong>{fmtMoney(monthlyAttackTotal)}</strong>
                </div>
                <div className="debtSnapshotRow">
                  <span>Mortgage principal / month</span>
                  <strong>{fmtMoney(totals.mortgagePrincipal)}</strong>
                </div>
                <div className="debtSnapshotRow">
                  <span>Mortgage interest / month</span>
                  <strong>{fmtMoney(totals.mortgageInterest)}</strong>
                </div>
              </div>

              {topTarget ? (
                <div className="debtInfoCell" style={{ marginTop: 12 }}>
                  <div className="debtTinyLabel">Projected First Win</div>
                  <div className="debtInfoValue">{topTarget.name}</div>
                  <div className="debtInfoSub" style={{ marginTop: 6 }}>
                    {topTarget.payoff === Infinity
                      ? "Current payment path does not pay this off."
                      : `Estimated payoff ${monthLabel(
                          topTarget.payoff
                        )} • around ${nextMonthDate(Math.ceil(topTarget.payoff))}.`}
                  </div>
                </div>
              ) : null}
            </GlassPane>

            <DebtEditorCard
              debt={selectedDebt}
              saving={selectedDebt ? !!savingIds[selectedDebt.id] : false}
              onPatch={(patch) => selectedDebt && updateDebt(selectedDebt.id, patch)}
            />
          </section>
        </div>
      </main>

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
    padding: 12px 0 20px;
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
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .debtControlsGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.02fr) minmax(0, 1.1fr) minmax(250px, 0.42fr);
    gap: 14px;
    align-items: end;
  }

  .debtWorkspaceGrid {
    display: grid;
    grid-template-columns: minmax(500px, 1.45fr) minmax(420px, 1.18fr) minmax(360px, 1fr);
    gap: 14px;
    align-items: stretch;
  }

  .debtWorkspaceGrid > * {
    min-width: 0;
    height: 100%;
  }

  .debtSectionGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 14px;
    align-items: stretch;
  }

  .debtSectionGrid > * {
    min-width: 0;
    height: 100%;
  }

  .debtLowerGrid {
    display: grid;
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
    gap: 14px;
    align-items: start;
  }

  .debtLowerGrid > * {
    min-width: 0;
  }

  .debtRosterControls {
    display: grid;
    grid-template-columns: 1.32fr 0.84fr 0.88fr;
    gap: 10px;
    margin-bottom: 10px;
  }

  .debtSearchWrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.10);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012)),
      rgba(8, 12, 20, 0.76);
    color: rgba(255,255,255,0.58);
    padding: 0 12px;
  }

  .debtSearchField {
    min-height: 42px !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
  }

  .debtRosterListCompact {
    display: grid;
    gap: 10px;
    min-height: 720px;
    max-height: 720px;
    overflow: auto;
    padding-right: 2px;
  }

  .debtCompactRow {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto auto;
    gap: 10px;
    align-items: center;
    min-height: 118px;
    padding: 12px 14px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.07);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .debtCompactRow:hover {
    transform: translateY(-1px);
  }

  .debtCompactAvatar {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255,255,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012)),
      rgba(9, 14, 23, 0.68);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: .05em;
  }

  .debtCompactTitle {
    font-size: 13.5px;
    font-weight: 800;
    color: #fff;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .debtCompactSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.35;
  }

  .debtCompactValue {
    font-size: 15px;
    font-weight: 850;
    color: #fff;
    white-space: nowrap;
  }

  .debtCompactActions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .debtIconBtn {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.10);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012));
    color: rgba(247,251,255,0.88);
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  .debtDangerBtn {
    border-color: rgba(255,132,163,0.18);
    color: #ffd3df;
  }

  .debtFocusBox {
    border-radius: 22px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
    padding: 15px;
    min-height: 100%;
  }

  .debtInfoGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .debtMortgageGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .debtInfoCell {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.025);
    padding: 11px;
  }

  .debtInfoValue {
    font-size: 0.96rem;
    font-weight: 900;
    line-height: 1.15;
    color: #fff;
  }

  .debtInfoSub {
    margin-top: 5px;
    color: rgba(255,255,255,0.62);
    font-size: 0.79rem;
    line-height: 1.4;
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

  .debtActionGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .debtActionGridTight {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .debtFormStack {
    display: grid;
    gap: 12px;
  }

  .debtFormGrid2,
  .debtFormGrid3,
  .debtFormGrid4 {
    display: grid;
    gap: 10px;
  }

  .debtFormGrid2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .debtFormGrid3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
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
    min-height: 44px;
    border-radius: 14px;
    border: 1px solid rgba(214,226,255,0.10);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012)),
      rgba(8, 12, 20, 0.76);
    color: var(--lcc-text);
    padding: 0 13px;
    outline: none;
    font: inherit;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }

  .debtField:focus {
    border-color: rgba(143,177,255,0.30);
    box-shadow:
      0 0 0 4px rgba(79,114,255,0.08),
      inset 0 1px 0 rgba(255,255,255,0.035);
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
    padding: 12px 13px;
  }

  .debtActionBtn {
    min-height: 40px;
    padding: 10px 13px;
    border-radius: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 800;
    line-height: 1;
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
  }

  .debtActionBtn:hover {
    transform: translateY(-1px);
  }

  .debtIntelList {
    display: grid;
    gap: 10px;
    min-height: 360px;
    max-height: 360px;
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

  .debtIntelValue {
    font-size: 14px;
    font-weight: 850;
    color: #fff;
  }

  .debtIntelMiniGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .debtIntelMini {
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.022);
    padding: 10px;
  }

  .debtSnapshotGrid {
    display: grid;
    gap: 8px;
  }

  .debtSnapshotRow {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    color: rgba(255,255,255,0.78);
  }

  .debtEmptyState {
    min-height: 150px;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 14px;
  }

  .debtInlineEmpty {
    min-height: 360px;
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

  @media (max-width: 1560px) {
    .debtWorkspaceGrid {
      grid-template-columns: minmax(440px, 1.22fr) minmax(390px, 1fr) minmax(320px, 0.9fr);
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

    .debtLowerGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 1260px) {
    .debtMetricGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .debtSectionGrid {
      grid-template-columns: 1fr;
    }

    .debtFormGrid4 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .debtRosterListCompact {
      min-height: 580px;
      max-height: 580px;
    }
  }

  @media (max-width: 1100px) {
    .debtHeroGrid,
    .debtWorkspaceGrid {
      grid-template-columns: 1fr;
    }

    .debtHeroSide {
      justify-content: flex-start;
    }
  }

  @media (max-width: 1024px) {
    .debtRosterControls,
    .debtInfoGrid,
    .debtMortgageGrid,
    .debtFormGrid2,
    .debtFormGrid3,
    .debtFormGrid4,
    .debtActionGrid,
    .debtActionGridTight,
    .debtIntelMiniGrid {
      grid-template-columns: 1fr;
    }

    .debtCompactRow {
      grid-template-columns: 42px minmax(0, 1fr);
    }

    .debtCompactValue {
      white-space: normal;
    }

    .debtCompactActions {
      grid-column: 2;
      justify-content: flex-start;
    }

    .debtRosterListCompact,
    .debtIntelList {
      min-height: 0;
      max-height: none;
    }
  }

  @media (max-width: 760px) {
    .debtPageShell {
      padding: 8px 0 14px;
    }

    .debtMetricGrid,
    .debtSectionGrid,
    .debtLowerGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .debtMetricGrid,
    .debtActionGrid,
    .debtActionGridTight {
      grid-template-columns: 1fr;
    }
  }
`;