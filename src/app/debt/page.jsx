
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CalendarClock,
  Copy,
  CreditCard,
  Landmark,
  Percent,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Wallet,
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
  const d = new Date(`${dateValue}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return "—";
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

function addDays(iso, daysToAdd) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-").map(Number);
  if (![y, m, d].every(Number.isFinite)) return "";
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Number(daysToAdd || 0));
  return isoDate(dt);
}

function addMonths(iso, monthsToAdd) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-").map(Number);
  if (![y, m, d].every(Number.isFinite)) return "";
  const dt = new Date(y, m - 1, d);
  dt.setMonth(dt.getMonth() + Number(monthsToAdd || 0));
  return isoDate(dt);
}

function nextDueDateFromFrequency(currentISO, frequency) {
  const base = currentISO || isoDate();
  switch (String(frequency || "").toLowerCase()) {
    case "weekly":
      return addDays(base, 7);
    case "biweekly":
      return addDays(base, 14);
    case "quarterly":
      return addMonths(base, 3);
    case "yearly":
      return addMonths(base, 12);
    case "one_time":
      return base;
    case "monthly":
    default:
      return addMonths(base, 1);
  }
}

function daysUntil(iso) {
  if (!iso) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const due = new Date(`${iso}T00:00:00`).getTime();
  if (!Number.isFinite(due)) return null;
  return Math.round((due - today) / 86400000);
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
  if (days === 0) return { label: "Due today", tone: "red", percent: 100 };
  if (days <= 3) return { label: `Due in ${days} day${days === 1 ? "" : "s"}`, tone: "red", percent: 92 };
  if (days <= 7) return { label: `Due in ${days} days`, tone: "amber", percent: 72 };
  if (days <= 14) return { label: `Due in ${days} days`, tone: "amber", percent: 48 };
  return { label: `Due in ${days} days`, tone: "green", percent: 18 };
}

function debtMonthlyPressure(debt) {
  const min = safeNum(debt?.minPay, 0);
  const extra = safeNum(debt?.extraPay, 0);
  const amount = safeNum(debt?.amount, 0);
  return round2(min + extra || amount);
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

function accountTypeLabel(t) {
  const v = String(t || "other").toLowerCase();
  if (v === "checking") return "Checking";
  if (v === "savings") return "Savings";
  if (v === "cash") return "Cash";
  if (v === "credit") return "Credit Card";
  if (v === "investment") return "Investment";
  return "Other";
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

function emptyDebt(defaultAccountId = "") {
  return {
    id: uid(),
    name: "",
    type: "controllable",
    frequency: "monthly",
    dueDate: isoDate(),
    amount: 0,
    active: true,
    balance: 0,
    minPay: 0,
    extraPay: 0,
    aprPct: 0,
    autopay: false,
    category: "",
    notes: "",
    accountId: defaultAccountId || "",
    lastPaidDate: "",
    createdAt: Date.now(),
    updatedAt: new Date().toISOString(),
  };
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
    lastPaidDate: row.last_paid_date || "",
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

function mapDebtToRow(debt, userId) {
  return {
    id: debt.id,
    user_id: userId,
    name: debt.name || "",
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
    last_paid_date: debt.lastPaidDate || null,
    created_at: debt.createdAt
      ? new Date(debt.createdAt).toISOString()
      : new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
    amount: safeNum(row.amount, 0),
    paymentDate: row.payment_date || "",
    accountId: row.payment_account_id || "",
    note: row.note || "",
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function DebtRosterRow({
  debt,
  selected,
  onSelect,
  onDuplicate,
  onToggle,
  onDelete,
}) {
  const due = dueMeta(daysUntil(debt.dueDate));
  const tone = due.tone;
  const meta = toneMeta(tone);
  const paymentLoad = debtMonthlyPressure(debt);

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
        <Wallet size={15} />
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
          <div className="debtCompactTitle">{debt.name || "Debt"}</div>
          <MiniPill tone={due.tone}>{due.label}</MiniPill>
          {debt.autopay ? <MiniPill tone="green">Autopay</MiniPill> : null}
          {!debt.active ? <MiniPill>Inactive</MiniPill> : null}
        </div>

        <div className="debtCompactSub">
          {debt.category || "No category"} • {debt.aprPct || 0}% APR • Min{" "}
          {moneyTight(debt.minPay || debt.amount)} • With extra {moneyTight(paymentLoad)} • Updated{" "}
          {fmtAgo(debt.updatedAt)}
        </div>

        <div style={{ marginTop: 10 }}>
          <ProgressBar fill={due.percent} tone={due.tone} />
        </div>
      </div>

      <div className="debtCompactValue">{money(debt.balance)}</div>

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
          aria-label={debt.active ? "Archive debt" : "Activate debt"}
          title={debt.active ? "Archive debt" : "Activate debt"}
        >
          {debt.active ? "↘" : "↗"}
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

function PaymentHistory({ payments, accountNameById }) {
  if (!payments.length) {
    return (
      <div className="debtEmptyState debtInlineEmpty">
        <div>
          <div className="debtEmptyTitle">No payment history yet</div>
          <div className="debtEmptyText">
            Use the payment box above to log a payment on this debt.
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
                {shortDate(payment.paymentDate)} •{" "}
                {payment.accountId
                  ? accountNameById.get(payment.accountId) || "Account"
                  : "No account linked"}
              </div>
            </div>

            <MiniPill tone="green">Paid</MiniPill>
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

function FocusDebtCard({
  debt,
  editor,
  setEditor,
  accounts,
  payments,
  saving,
  paymentDraft,
  setPaymentDraft,
  onSave,
  onDuplicate,
  onDelete,
  onToggleAutopay,
  onMakePayment,
}) {
  if (!debt) {
    return (
      <GlassPane size="card">
        <PaneHeader
          title="Selected Debt"
          subcopy="Choose one from the roster to work it here."
        />
        <div className="debtEmptyState" style={{ minHeight: 190 }}>
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

  const due = dueMeta(daysUntil(editor.dueDate));
  const meta = toneMeta(due.tone);
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const monthlyPay = round2(safeNum(editor.minPay, 0) + safeNum(editor.extraPay, 0) || safeNum(editor.amount, 0));

  return (
    <GlassPane tone={due.tone} size="card" style={{ height: "100%" }}>
      <PaneHeader
        title={debt.name || "Debt"}
        subcopy="Edit the balance, payment pressure, and log a real payment right here."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <MiniPill tone={due.tone}>{due.label}</MiniPill>
            {editor.autopay ? <MiniPill tone="green">Autopay</MiniPill> : null}
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
            color: due.tone === "neutral" ? "#fff" : meta.text,
          }}
        >
          {money(editor.balance)}
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "rgba(255,255,255,0.58)",
          }}
        >
          Updated {fmtWhen(debt.updatedAt)}
        </div>

        <div className="debtInfoGrid" style={{ marginTop: 14 }}>
          <div className="debtInfoCell">
            <div className="debtTinyLabel">APR</div>
            <div className="debtInfoValue">{safeNum(editor.aprPct, 0)}%</div>
            <div className="debtInfoSub">Current interest rate</div>
          </div>

          <div className="debtInfoCell">
            <div className="debtTinyLabel">Monthly Payment</div>
            <div className="debtInfoValue">{money(monthlyPay)}</div>
            <div className="debtInfoSub">
              Min {money(editor.minPay)} + Extra {money(editor.extraPay)}
            </div>
          </div>

          <div className="debtInfoCell">
            <div className="debtTinyLabel">Payoff Read</div>
            <div className="debtInfoValue">
              {payoffLabel(editor.balance, editor.aprPct, monthlyPay)}
            </div>
            <div className="debtInfoSub">Based on balance, APR, and payment</div>
          </div>

          <div className="debtInfoCell">
            <div className="debtTinyLabel">Linked Account</div>
            <div className="debtInfoValue">
              {accountNameById.get(editor.accountId) || "None"}
            </div>
            <div className="debtInfoSub">Default pay-from account</div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <ProgressBar fill={due.percent} tone={due.tone} />
        </div>

        <div className="debtFormStack" style={{ marginTop: 14 }}>
          <div>
            <div className="debtTinyLabel">Debt Name</div>
            <input
              className="debtField"
              value={editor.name}
              onChange={(e) =>
                setEditor((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Truck Loan"
            />
          </div>

          <div className="debtFormGrid4">
            <div>
              <div className="debtTinyLabel">Balance</div>
              <input
                className="debtField"
                inputMode="decimal"
                value={editor.balance}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, balance: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>

            <div>
              <div className="debtTinyLabel">APR %</div>
              <input
                className="debtField"
                inputMode="decimal"
                value={editor.aprPct}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, aprPct: e.target.value }))
                }
                placeholder="0"
              />
            </div>

            <div>
              <div className="debtTinyLabel">Min Payment</div>
              <input
                className="debtField"
                inputMode="decimal"
                value={editor.minPay}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, minPay: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>

            <div>
              <div className="debtTinyLabel">Extra Payment</div>
              <input
                className="debtField"
                inputMode="decimal"
                value={editor.extraPay}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, extraPay: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="debtFormGrid3">
            <div>
              <div className="debtTinyLabel">Due Date</div>
              <input
                type="date"
                className="debtField"
                value={editor.dueDate}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, dueDate: e.target.value }))
                }
              />
            </div>

            <div>
              <div className="debtTinyLabel">Frequency</div>
              <select
                className="debtField"
                value={editor.frequency}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, frequency: e.target.value }))
                }
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="debtTinyLabel">Linked Account</div>
              <select
                className="debtField"
                value={editor.accountId}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, accountId: e.target.value }))
                }
              >
                <option value="">No linked account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="debtFormGrid2">
            <div>
              <div className="debtTinyLabel">Category</div>
              <input
                className="debtField"
                value={editor.category}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, category: e.target.value }))
                }
                placeholder="Auto"
              />
            </div>

            <div>
              <div className="debtTinyLabel">Statement Amount</div>
              <input
                className="debtField"
                inputMode="decimal"
                value={editor.amount}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <div className="debtTinyLabel">Notes</div>
            <textarea
              className="debtField"
              rows={4}
              value={editor.notes}
              onChange={(e) =>
                setEditor((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Optional note..."
            />
          </div>

          <div className="debtActionGrid debtActionGridQuad">
            <ActionBtn variant="primary" onClick={onSave} full disabled={saving}>
              <BadgeDollarSign size={14} /> Save
            </ActionBtn>

            <ActionBtn onClick={onToggleAutopay} full disabled={saving}>
              <CreditCard size={14} /> {editor.autopay ? "Turn Off Autopay" : "Turn On Autopay"}
            </ActionBtn>

            <ActionBtn onClick={onDuplicate} full disabled={saving}>
              <Copy size={14} /> Duplicate
            </ActionBtn>

            <ActionBtn variant="danger" onClick={onDelete} full disabled={saving}>
              <Trash2 size={14} /> Delete
            </ActionBtn>
          </div>
        </div>

        <div className="debtPayBox">
          <div className="debtPayHeader">
            <div>
              <div className="debtTinyLabel">Make Payment</div>
              <div className="debtPaySub">
                Log a debt payment, reduce the balance, and optionally subtract it from an account.
              </div>
            </div>

            <MiniPill tone="green">
              Last paid {editor.lastPaidDate ? shortDate(editor.lastPaidDate) : "—"}
            </MiniPill>
          </div>

          <div className="debtPayGrid">
            <div>
              <div className="debtTinyLabel">Payment Amount</div>
              <input
                className="debtField"
                inputMode="decimal"
                placeholder="0.00"
                value={paymentDraft.amount}
                onChange={(e) =>
                  setPaymentDraft((prev) => ({ ...prev, amount: e.target.value }))
                }
              />
            </div>

            <div>
              <div className="debtTinyLabel">Payment Date</div>
              <input
                type="date"
                className="debtField"
                value={paymentDraft.paymentDate}
                onChange={(e) =>
                  setPaymentDraft((prev) => ({
                    ...prev,
                    paymentDate: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="debtPayGrid">
            <div>
              <div className="debtTinyLabel">Pay From Account</div>
              <select
                className="debtField"
                value={paymentDraft.accountId}
                onChange={(e) =>
                  setPaymentDraft((prev) => ({
                    ...prev,
                    accountId: e.target.value,
                  }))
                }
              >
                <option value="">No account linked</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} • {money(account.balance)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="debtTinyLabel">Advance Due Date</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ActionBtn
                  variant={paymentDraft.advanceDue ? "primary" : "ghost"}
                  onClick={() =>
                    setPaymentDraft((prev) => ({ ...prev, advanceDue: true }))
                  }
                >
                  Yes
                </ActionBtn>
                <ActionBtn
                  variant={!paymentDraft.advanceDue ? "primary" : "ghost"}
                  onClick={() =>
                    setPaymentDraft((prev) => ({ ...prev, advanceDue: false }))
                  }
                >
                  No
                </ActionBtn>
              </div>
            </div>
          </div>

          <div>
            <div className="debtTinyLabel">Payment Note</div>
            <textarea
              className="debtField"
              rows={3}
              placeholder="Optional payment note..."
              value={paymentDraft.note}
              onChange={(e) =>
                setPaymentDraft((prev) => ({ ...prev, note: e.target.value }))
              }
            />
          </div>

          <div className="debtActionGrid">
            <ActionBtn
              variant="primary"
              onClick={onMakePayment}
              full
              disabled={paymentDraft.saving}
            >
              <BadgeDollarSign size={14} />
              {paymentDraft.saving ? "Saving..." : "Make Payment"}
            </ActionBtn>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <PaneHeader
            title="Payment History"
            subcopy="Latest payments recorded for this debt."
          />
          <PaymentHistory
            payments={payments}
            accountNameById={accountNameById}
          />
        </div>
      </div>
    </GlassPane>
  );
}

function AddDebtCard({
  form,
  setForm,
  accounts,
  saving,
  onAdd,
}) {
  return (
    <GlassPane size="card" style={{ height: "100%" }}>
      <PaneHeader
        title="Add Debt"
        subcopy="Create a new controllable debt."
        right={
          <MiniPill>
            <Plus size={13} /> New
          </MiniPill>
        }
      />

      <div className="debtFormStack">
        <div>
          <div className="debtTinyLabel">Debt Name</div>
          <input
            className="debtField"
            placeholder="Truck Loan, Credit Card..."
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div className="debtFormGrid4">
          <div>
            <div className="debtTinyLabel">Balance</div>
            <input
              className="debtField"
              inputMode="decimal"
              placeholder="0.00"
              value={form.balance}
              onChange={(e) => setForm((prev) => ({ ...prev, balance: e.target.value }))}
            />
          </div>

          <div>
            <div className="debtTinyLabel">APR %</div>
            <input
              className="debtField"
              inputMode="decimal"
              placeholder="0"
              value={form.aprPct}
              onChange={(e) => setForm((prev) => ({ ...prev, aprPct: e.target.value }))}
            />
          </div>

          <div>
            <div className="debtTinyLabel">Min Payment</div>
            <input
              className="debtField"
              inputMode="decimal"
              placeholder="0.00"
              value={form.minPay}
              onChange={(e) => setForm((prev) => ({ ...prev, minPay: e.target.value }))}
            />
          </div>

          <div>
            <div className="debtTinyLabel">Extra Payment</div>
            <input
              className="debtField"
              inputMode="decimal"
              placeholder="0.00"
              value={form.extraPay}
              onChange={(e) => setForm((prev) => ({ ...prev, extraPay: e.target.value }))}
            />
          </div>
        </div>

        <div className="debtFormGrid3">
          <div>
            <div className="debtTinyLabel">Due Date</div>
            <input
              type="date"
              className="debtField"
              value={form.dueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
          </div>

          <div>
            <div className="debtTinyLabel">Frequency</div>
            <select
              className="debtField"
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
            <div className="debtTinyLabel">Linked Account</div>
            <select
              className="debtField"
              value={form.accountId}
              onChange={(e) => setForm((prev) => ({ ...prev, accountId: e.target.value }))}
            >
              <option value="">No linked account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} • {accountTypeLabel(account.type)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="debtFormGrid2">
          <div>
            <div className="debtTinyLabel">Category</div>
            <input
              className="debtField"
              placeholder="Auto, Card, Personal..."
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            />
          </div>

          <div>
            <div className="debtTinyLabel">Statement Amount</div>
            <input
              className="debtField"
              inputMode="decimal"
              placeholder="Optional"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <div className="debtTinyLabel">Notes</div>
          <textarea
            className="debtField"
            rows={4}
            placeholder="Optional note..."
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ActionBtn
            variant={form.autopay ? "primary" : "ghost"}
            onClick={() => setForm((prev) => ({ ...prev, autopay: !prev.autopay }))}
          >
            <CreditCard size={14} />
            {form.autopay ? "Autopay On" : "Autopay Off"}
          </ActionBtn>
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

export default function DebtPage() {
  const [debts, setDebts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [userId, setUserId] = useState(null);

  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("active");
  const [sortBy, setSortBy] = useState("due_asc");

  const [savingSelected, setSavingSelected] = useState(false);
  const [addingBusy, setAddingBusy] = useState(false);

  const [editor, setEditor] = useState({
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
    accountId: "",
    autopay: false,
    lastPaidDate: "",
  });

  const [addForm, setAddForm] = useState({
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
    accountId: "",
    autopay: false,
  });

  const [paymentDraft, setPaymentDraft] = useState({
    amount: "",
    paymentDate: isoDate(),
    accountId: "",
    note: "",
    advanceDue: true,
    saving: false,
  });

  async function loadPage() {
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

      const loadedDebts = (debtsRes.data || []).map(mapBillRowToClient);
      const loadedAccounts = (accountsRes.data || []).map(mapAccountRowToClient);
      const primaryAccountId =
        settingsRes.data?.primary_account_id || loadedAccounts[0]?.id || "";

      setDebts(loadedDebts);
      setAccounts(loadedAccounts);
      setDefaultAccountId(primaryAccountId);
      setPayments(paymentsRes.error ? [] : (paymentsRes.data || []).map(mapPaymentRowToClient));
      setSelectedDebtId((prev) => prev || loadedDebts[0]?.id || "");
      setAddForm((prev) => ({ ...prev, accountId: prev.accountId || primaryAccountId }));
    } catch (err) {
      setPageError(err?.message || "Failed to load debts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadPage();
    });

    return () => subscription?.unsubscribe?.();
  }, []);

  const visibleDebts = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = debts.filter((debt) => {
      if (scope === "active" && !debt.active) return false;
      if (scope === "inactive" && debt.active) return false;

      if (!q) return true;

      return [debt.name, debt.category, debt.notes]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    if (sortBy === "balance_desc") {
      list.sort((a, b) => safeNum(b.balance) - safeNum(a.balance));
      return list;
    }

    if (sortBy === "apr_desc") {
      list.sort((a, b) => safeNum(b.aprPct) - safeNum(a.aprPct));
      return list;
    }

    if (sortBy === "name_asc") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      return list;
    }

    if (sortBy === "updated_desc") {
      list.sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
      return list;
    }

    list.sort((a, b) => {
      const ad = daysUntil(a.dueDate);
      const bd = daysUntil(b.dueDate);
      return (Number.isFinite(ad) ? ad : 999999) - (Number.isFinite(bd) ? bd : 999999);
    });
    return list;
  }, [debts, scope, search, sortBy]);

  useEffect(() => {
    if (!visibleDebts.length) {
      setSelectedDebtId("");
      return;
    }

    const exists = visibleDebts.some((debt) => debt.id === selectedDebtId);
    if (!exists) setSelectedDebtId(visibleDebts[0].id);
  }, [visibleDebts, selectedDebtId]);

  const selectedDebt =
    debts.find((debt) => debt.id === selectedDebtId) || visibleDebts[0] || null;

  useEffect(() => {
    if (!selectedDebt) {
      setEditor({
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
      });
      setPaymentDraft({
        amount: "",
        paymentDate: isoDate(),
        accountId: defaultAccountId || "",
        note: "",
        advanceDue: true,
        saving: false,
      });
      return;
    }

    setEditor({
      name: selectedDebt.name || "",
      balance: String(selectedDebt.balance ?? ""),
      aprPct: String(selectedDebt.aprPct ?? ""),
      minPay: String(selectedDebt.minPay ?? ""),
      extraPay: String(selectedDebt.extraPay ?? ""),
      amount: String(selectedDebt.amount ?? ""),
      dueDate: selectedDebt.dueDate || isoDate(),
      frequency: selectedDebt.frequency || "monthly",
      category: selectedDebt.category || "",
      notes: selectedDebt.notes || "",
      accountId: selectedDebt.accountId || "",
      autopay: selectedDebt.autopay === true,
      lastPaidDate: selectedDebt.lastPaidDate || "",
    });

    setPaymentDraft({
      amount: String(selectedDebt.minPay || selectedDebt.amount || ""),
      paymentDate: isoDate(),
      accountId: selectedDebt.accountId || defaultAccountId || "",
      note: "",
      advanceDue: true,
      saving: false,
    });
  }, [selectedDebt?.id, defaultAccountId]);

  const selectedDebtPayments = useMemo(() => {
    if (!selectedDebt) return [];
    return payments
      .filter((payment) => payment.billId === selectedDebt.id)
      .sort(
        (a, b) =>
          new Date(b.paymentDate || b.createdAt || 0).getTime() -
          new Date(a.paymentDate || a.createdAt || 0).getTime()
      );
  }, [payments, selectedDebt?.id]);

  const metrics = useMemo(() => {
    const activeDebts = debts.filter((debt) => debt.active);
    const monthKey = String(isoDate()).slice(0, 7);

    const totalBalance = activeDebts.reduce(
      (sum, debt) => sum + safeNum(debt.balance, 0),
      0
    );

    const monthlyLoad = activeDebts.reduce(
      (sum, debt) => sum + debtMonthlyPressure(debt),
      0
    );

    const dueSoon = activeDebts.filter((debt) => {
      const dueIn = daysUntil(debt.dueDate);
      return Number.isFinite(dueIn) && dueIn <= 7;
    });

    const paidThisMonth = payments
      .filter((payment) => String(payment.paymentDate || "").slice(0, 7) === monthKey)
      .reduce((sum, payment) => sum + safeNum(payment.amount), 0);

    const hottestAprDebt = [...activeDebts].sort(
      (a, b) => safeNum(b.aprPct) - safeNum(a.aprPct)
    )[0];

    const nextDebt = [...activeDebts].sort((a, b) => {
      const ad = Number.isFinite(daysUntil(a.dueDate)) ? daysUntil(a.dueDate) : 999999;
      const bd = Number.isFinite(daysUntil(b.dueDate)) ? daysUntil(b.dueDate) : 999999;
      return ad - bd;
    })[0];

    return {
      activeCount: activeDebts.length,
      totalBalance,
      monthlyLoad,
      dueSoonCount: dueSoon.length,
      paidThisMonth,
      hottestAprDebt,
      nextDebt,
    };
  }, [debts, payments]);

  async function addDebt() {
    if (!supabase || !userId || addingBusy) return;

    const name = String(addForm.name || "").trim();
    const balance = parseMoneyInput(addForm.balance);
    const minPay = parseMoneyInput(addForm.minPay || "0");
    const extraPay = parseMoneyInput(addForm.extraPay || "0");
    const aprPct = parseMoneyInput(addForm.aprPct || "0");
    const statementAmount = parseMoneyInput(addForm.amount || "");

    if (!name) {
      window.alert("Debt name is required.");
      return;
    }

    if (!Number.isFinite(balance) || balance < 0) {
      window.alert("Balance must be 0 or greater.");
      return;
    }

    if (!Number.isFinite(minPay) || minPay < 0) {
      window.alert("Minimum payment must be 0 or greater.");
      return;
    }

    if (!Number.isFinite(extraPay) || extraPay < 0) {
      window.alert("Extra payment must be 0 or greater.");
      return;
    }

    setAddingBusy(true);

    const nextDebt = {
      ...emptyDebt(addForm.accountId || defaultAccountId),
      name,
      balance: round2(balance),
      minPay: round2(minPay),
      extraPay: round2(extraPay),
      aprPct: round2(Number.isFinite(aprPct) ? aprPct : 0),
      dueDate: addForm.dueDate || isoDate(),
      frequency: addForm.frequency || "monthly",
      category: addForm.category || "",
      notes: addForm.notes || "",
      accountId: addForm.accountId || "",
      autopay: addForm.autopay === true,
      amount: round2(Number.isFinite(statementAmount) ? statementAmount : minPay),
      lastPaidDate: "",
    };

    const res = await supabase
      .from("bills")
      .insert(mapDebtToRow(nextDebt, userId))
      .select()
      .single();

    if (res.error) {
      console.error("add debt error:", res.error);
      setPageError(res.error.message || "Could not add debt.");
      setAddingBusy(false);
      return;
    }

    const saved = mapBillRowToClient(res.data);
    setDebts((prev) => [saved, ...prev]);
    setSelectedDebtId(saved.id);

    setAddForm({
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
    });

    setAddingBusy(false);
  }

  async function saveSelectedDebt() {
    if (!supabase || !userId || !selectedDebt || savingSelected) return;

    const name = String(editor.name || "").trim();
    const balance = parseMoneyInput(editor.balance);
    const aprPct = parseMoneyInput(editor.aprPct || "0");
    const minPay = parseMoneyInput(editor.minPay || "0");
    const extraPay = parseMoneyInput(editor.extraPay || "0");
    const amount = parseMoneyInput(editor.amount || "");

    if (!name) {
      window.alert("Debt name is required.");
      return;
    }

    if (!Number.isFinite(balance) || balance < 0) {
      window.alert("Balance must be 0 or greater.");
      return;
    }

    if (!Number.isFinite(minPay) || minPay < 0) {
      window.alert("Minimum payment must be 0 or greater.");
      return;
    }

    if (!Number.isFinite(extraPay) || extraPay < 0) {
      window.alert("Extra payment must be 0 or greater.");
      return;
    }

    setSavingSelected(true);

    const payload = {
      ...selectedDebt,
      name,
      balance: round2(balance),
      aprPct: round2(Number.isFinite(aprPct) ? aprPct : 0),
      minPay: round2(minPay),
      extraPay: round2(extraPay),
      amount: round2(Number.isFinite(amount) ? amount : minPay),
      dueDate: editor.dueDate || isoDate(),
      frequency: editor.frequency || "monthly",
      category: editor.category || "",
      notes: editor.notes || "",
      accountId: editor.accountId || "",
      autopay: editor.autopay === true,
      lastPaidDate: editor.lastPaidDate || "",
      updatedAt: new Date().toISOString(),
    };

    const res = await supabase
      .from("bills")
      .update(mapDebtToRow(payload, userId))
      .eq("id", selectedDebt.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (res.error) {
      console.error("save debt error:", res.error);
      setPageError(res.error.message || "Could not save debt.");
      setSavingSelected(false);
      return;
    }

    const saved = mapBillRowToClient(res.data);
    setDebts((prev) => prev.map((debt) => (debt.id === saved.id ? saved : debt)));
    setSavingSelected(false);
  }

  async function duplicateDebt(debt) {
    if (!supabase || !userId) return;

    const clone = {
      ...debt,
      id: uid(),
      name: `${debt.name || "Debt"} Copy`,
      createdAt: Date.now(),
      updatedAt: new Date().toISOString(),
      lastPaidDate: "",
    };

    const res = await supabase
      .from("bills")
      .insert(mapDebtToRow(clone, userId))
      .select()
      .single();

    if (res.error) {
      console.error("duplicate debt error:", res.error);
      setPageError(res.error.message || "Could not duplicate debt.");
      return;
    }

    const saved = mapBillRowToClient(res.data);
    setDebts((prev) => [saved, ...prev]);
    setSelectedDebtId(saved.id);
  }

  async function deleteDebt() {
    if (!supabase || !userId || !selectedDebt) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this debt?")) return;

    const { error } = await supabase
      .from("bills")
      .delete()
      .eq("id", selectedDebt.id)
      .eq("user_id", userId);

    if (error) {
      console.error("delete debt error:", error);
      setPageError(error.message || "Could not delete debt.");
      return;
    }

    const nextDebts = debts.filter((debt) => debt.id !== selectedDebt.id);
    setDebts(nextDebts);
    setSelectedDebtId(nextDebts[0]?.id || "");
  }

  async function toggleDebtActive(debt) {
    if (!supabase || !userId) return;

    const nextValue = !debt.active;

    const res = await supabase
      .from("bills")
      .update({
        active: nextValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", debt.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (res.error) {
      console.error("toggle debt active error:", res.error);
      setPageError(res.error.message || "Could not update debt.");
      return;
    }

    const saved = mapBillRowToClient(res.data);
    setDebts((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
  }

  async function toggleSelectedAutopay() {
    if (!supabase || !userId || !selectedDebt || savingSelected) return;

    setSavingSelected(true);

    const res = await supabase
      .from("bills")
      .update({
        autopay: !editor.autopay,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedDebt.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (res.error) {
      console.error("toggle autopay error:", res.error);
      setPageError(res.error.message || "Could not update autopay.");
      setSavingSelected(false);
      return;
    }

    const saved = mapBillRowToClient(res.data);
    setDebts((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
    setSavingSelected(false);
  }

  async function makeDebtPayment() {
    if (!supabase || !userId || !selectedDebt || paymentDraft.saving) return;

    const amount = round2(parseMoneyInput(paymentDraft.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Enter a valid payment amount.");
      return;
    }

    const paymentDate = paymentDraft.paymentDate || isoDate();
    const payAccountId = paymentDraft.accountId || "";
    const payNote = String(paymentDraft.note || "").trim();

    setPaymentDraft((prev) => ({ ...prev, saving: true }));

    if (payAccountId) {
      const payAccount = accounts.find((account) => account.id === payAccountId);

      if (!payAccount) {
        window.alert("Selected payment account was not found.");
        setPaymentDraft((prev) => ({ ...prev, saving: false }));
        return;
      }

      const nextAccountBalance = round2(safeNum(payAccount.balance, 0) - amount);

      const { error: accountError } = await supabase
        .from("accounts")
        .update({
          balance: nextAccountBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payAccount.id)
        .eq("user_id", userId);

      if (accountError) {
        console.error("debt payment account update error:", accountError);
        setPageError(accountError.message || "Could not update payment account.");
        setPaymentDraft((prev) => ({ ...prev, saving: false }));
        return;
      }

      setAccounts((prev) =>
        prev.map((account) =>
          account.id === payAccount.id
            ? {
                ...account,
                balance: nextAccountBalance,
                updatedAt: Date.now(),
              }
            : account
        )
      );

      await supabase.from("account_transactions").insert({
        user_id: userId,
        account_id: payAccount.id,
        kind: "debt_payment",
        amount,
        delta: -amount,
        resulting_balance: nextAccountBalance,
        note: `${selectedDebt.name || "Debt"} payment${payNote ? ` • ${payNote}` : ""}`,
        related_account_id: null,
        related_account_name: null,
        source_type: "debt_payment",
        source_id: selectedDebt.id,
        created_at: new Date().toISOString(),
      });
    }

    let nextDueDate = selectedDebt.dueDate || "";
    if (paymentDraft.advanceDue && selectedDebt.frequency !== "one_time" && selectedDebt.dueDate) {
      nextDueDate = nextDueDateFromFrequency(selectedDebt.dueDate, selectedDebt.frequency);
    }

    const nextBalance = Math.max(0, round2(safeNum(selectedDebt.balance, 0) - amount));

    const { data: updatedDebtRow, error: debtError } = await supabase
      .from("bills")
      .update({
        last_paid_date: paymentDate,
        due_date: nextDueDate || null,
        balance: nextBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedDebt.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (debtError) {
      console.error("debt payment update error:", debtError);
      setPageError(debtError.message || "Could not update debt after payment.");
      setPaymentDraft((prev) => ({ ...prev, saving: false }));
      return;
    }

    let savedPayment = {
      id: uid(),
      billId: selectedDebt.id,
      amount,
      paymentDate,
      accountId: payAccountId,
      note: payNote,
      createdAt: new Date().toISOString(),
    };

    const paymentInsert = await supabase
      .from("bill_payments")
      .insert({
        user_id: userId,
        bill_id: selectedDebt.id,
        amount,
        payment_date: paymentDate,
        payment_account_id: payAccountId || null,
        note: payNote || null,
      })
      .select()
      .single();

    if (!paymentInsert.error && paymentInsert.data) {
      savedPayment = mapPaymentRowToClient(paymentInsert.data);
    }

    const updatedDebt = mapBillRowToClient(updatedDebtRow);
    setDebts((prev) =>
      prev.map((debt) => (debt.id === updatedDebt.id ? updatedDebt : debt))
    );
    setPayments((prev) => [savedPayment, ...prev]);

    setPaymentDraft({
      amount: "",
      paymentDate: isoDate(),
      accountId: editor.accountId || defaultAccountId || "",
      note: "",
      advanceDue: true,
      saving: false,
    });
  }

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
                  Real debt balances, payment pressure, payoff read, and direct debt payments in the center focus card.
                </div>

                <div className="debtPillRow">
                  <MiniPill>{metrics.activeCount} active debts</MiniPill>
                  <MiniPill>{currentMonthLabel()}</MiniPill>
                  <MiniPill tone="amber">{metrics.dueSoonCount} due soon</MiniPill>
                  <MiniPill tone="green">{money(metrics.paidThisMonth)} paid this month</MiniPill>
                </div>
              </div>

              <div className="debtHeroSide">
                <MiniPill tone="red">{money(metrics.totalBalance)} total</MiniPill>
                <MiniPill tone="amber">{money(metrics.monthlyLoad)} monthly</MiniPill>
                <MiniPill tone={metrics.hottestAprDebt ? "red" : "neutral"}>
                  {metrics.hottestAprDebt
                    ? `Highest APR: ${metrics.hottestAprDebt.name}`
                    : "No APR focus"}
                </MiniPill>
              </div>
            </div>
          </GlassPane>

          {pageError ? (
            <GlassPane tone="red" size="card">
              <div style={{ fontWeight: 800, fontSize: 15, color: "#fff" }}>
                {pageError}
              </div>
            </GlassPane>
          ) : null}

          <section className="debtMetricGrid">
            <StatCard
              icon={Landmark}
              label="Total Balance"
              value={money(metrics.totalBalance)}
              detail="Current live debt balance across active debts."
              tone="red"
            />
            <StatCard
              icon={Wallet}
              label="Monthly Load"
              value={money(metrics.monthlyLoad)}
              detail="Minimum plus extra payment pressure this month."
              tone="amber"
            />
            <StatCard
              icon={CalendarClock}
              label="Due In 7 Days"
              value={String(metrics.dueSoonCount)}
              detail="Debts with due dates in the next 7 days."
              tone={metrics.dueSoonCount > 0 ? "amber" : "green"}
            />
            <StatCard
              icon={Percent}
              label="Highest APR"
              value={metrics.hottestAprDebt ? `${safeNum(metrics.hottestAprDebt.aprPct, 0)}%` : "—"}
              detail={metrics.hottestAprDebt ? metrics.hottestAprDebt.name : "No debt on the board yet."}
              tone={metrics.hottestAprDebt ? "red" : "neutral"}
            />
            <StatCard
              icon={ShieldAlert}
              label="Next Due"
              value={metrics.nextDebt ? shortDate(metrics.nextDebt.dueDate) : "—"}
              detail={metrics.nextDebt ? metrics.nextDebt.name : "No debt due yet."}
              tone={metrics.nextDebt ? dueMeta(daysUntil(metrics.nextDebt.dueDate)).tone : "neutral"}
            />
          </section>

          <GlassPane size="card">
            <PaneHeader
              title="Debt Controls"
              subcopy="Search the roster, filter debt status, and sort how you want."
            />

            <div className="debtControlsGrid">
              <div>
                <div className="debtTinyLabel">Search</div>
                <div className="debtSearchWrap">
                  <Search size={15} />
                  <input
                    className="debtField debtSearchField"
                    placeholder="Search debt"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="debtTinyLabel">Scope</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionBtn
                    variant={scope === "active" ? "primary" : "ghost"}
                    onClick={() => setScope("active")}
                  >
                    Active
                  </ActionBtn>
                  <ActionBtn
                    variant={scope === "all" ? "primary" : "ghost"}
                    onClick={() => setScope("all")}
                  >
                    All
                  </ActionBtn>
                  <ActionBtn
                    variant={scope === "inactive" ? "primary" : "ghost"}
                    onClick={() => setScope("inactive")}
                  >
                    Inactive
                  </ActionBtn>
                </div>
              </div>

              <div>
                <div className="debtTinyLabel">Sort</div>
                <select
                  className="debtField"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="due_asc">Due first</option>
                  <option value="balance_desc">Balance high → low</option>
                  <option value="apr_desc">APR high → low</option>
                  <option value="name_asc">Name</option>
                  <option value="updated_desc">Recently updated</option>
                </select>
              </div>
            </div>
          </GlassPane>

          <section className="debtWorkspaceGrid">
            <GlassPane size="card" style={{ height: "100%" }}>
              <PaneHeader
                title="Debt Roster"
                subcopy="Main roster stays left. Work the selected debt in center."
                right={<MiniPill>{visibleDebts.length} showing</MiniPill>}
              />

              {visibleDebts.length ? (
                <div className="debtRosterListCompact">
                  {visibleDebts.map((debt) => (
                    <DebtRosterRow
                      key={debt.id}
                      debt={debt}
                      selected={debt.id === selectedDebt?.id}
                      onSelect={() => setSelectedDebtId(debt.id)}
                      onDuplicate={() => duplicateDebt(debt)}
                      onToggle={() => toggleDebtActive(debt)}
                      onDelete={() => {
                        setSelectedDebtId(debt.id);
                        setTimeout(() => {
                          if (
                            typeof window !== "undefined" &&
                            window.confirm(`Delete ${debt.name}?`)
                          ) {
                            supabase
                              .from("bills")
                              .delete()
                              .eq("id", debt.id)
                              .eq("user_id", userId)
                              .then(({ error }) => {
                                if (error) {
                                  console.error(error);
                                  setPageError(error.message || "Could not delete debt.");
                                  return;
                                }
                                const nextDebts = debts.filter((row) => row.id !== debt.id);
                                setDebts(nextDebts);
                                if (selectedDebtId === debt.id) {
                                  setSelectedDebtId(nextDebts[0]?.id || "");
                                }
                              });
                          }
                        }, 0);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="debtEmptyState">
                  <div>
                    <div className="debtEmptyTitle">No debts found</div>
                    <div className="debtEmptyText">
                      Clear filters or add a new debt.
                    </div>
                  </div>
                </div>
              )}
            </GlassPane>

            <FocusDebtCard
              debt={selectedDebt}
              editor={editor}
              setEditor={setEditor}
              accounts={accounts}
              payments={selectedDebtPayments}
              saving={savingSelected}
              paymentDraft={paymentDraft}
              setPaymentDraft={setPaymentDraft}
              onSave={saveSelectedDebt}
              onDuplicate={() => selectedDebt && duplicateDebt(selectedDebt)}
              onDelete={deleteDebt}
              onToggleAutopay={toggleSelectedAutopay}
              onMakePayment={makeDebtPayment}
            />

            <AddDebtCard
              form={addForm}
              setForm={setAddForm}
              accounts={accounts}
              saving={addingBusy}
              onAdd={addDebt}
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
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
  }

  .debtControlsGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) minmax(260px, 0.56fr);
    gap: 14px;
    align-items: end;
  }

  .debtWorkspaceGrid {
    display: grid;
    grid-template-columns: minmax(460px, 1.18fr) minmax(520px, 1.36fr) minmax(360px, 0.95fr);
    gap: 14px;
    align-items: stretch;
  }

  .debtWorkspaceGrid > * {
    min-width: 0;
    height: 100%;
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

  .debtPayBox {
    margin-top: 14px;
    border-radius: 22px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
    padding: 15px;
    display: grid;
    gap: 12px;
  }

  .debtPayHeader {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .debtPaySub {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.45;
    color: rgba(255,255,255,0.60);
  }

  .debtPayGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .debtActionGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .debtActionGridQuad {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
    min-height: 240px;
    max-height: 260px;
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

  @media (max-width: 1560px) {
    .debtWorkspaceGrid {
      grid-template-columns: minmax(420px, 1.08fr) minmax(460px, 1.18fr) minmax(320px, 0.9fr);
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
  }

  @media (max-width: 1260px) {
    .debtMetricGrid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
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
    .debtInfoGrid,
    .debtFormGrid2,
    .debtFormGrid3,
    .debtFormGrid4,
    .debtActionGrid,
    .debtActionGridQuad,
    .debtPayGrid {
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

    .debtMetricGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .debtMetricGrid,
    .debtActionGrid,
    .debtActionGridQuad {
      grid-template-columns: 1fr;
    }
  }
`;
