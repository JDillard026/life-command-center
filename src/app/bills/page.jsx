"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeDollarSign,
  CalendarClock,
  Copy,
  CreditCard,
  Landmark,
  Plus,
  Receipt,
  Save,
  Search,
  Trash2,
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

function monthKeyOf(dateValue) {
  return String(dateValue || "").slice(0, 7);
}

function prettyMonth(monthKey) {
  if (!monthKey) return "—";
  const [y, m] = String(monthKey).split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
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
    case "monthly":
    default:
      return 1;
  }
}

function monthlyWeight(amount, frequency) {
  return safeNum(amount, 0) * freqToMonthlyMult(frequency);
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
    return { label: `Due in ${days} day${days === 1 ? "" : "s"}`, tone: "red", percent: 92 };
  }
  if (days <= 7) {
    return { label: `Due in ${days} days`, tone: "amber", percent: 72 };
  }
  if (days <= 14) {
    return { label: `Due in ${days} days`, tone: "amber", percent: 48 };
  }
  return { label: `Due in ${days} days`, tone: "green", percent: 18 };
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
      className="billActionBtn"
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
    <div className="billProgress">
      <div
        className="billProgressFill"
        style={{
          width: `${normalized}%`,
          background: toneMap[tone] || toneMap.neutral,
        }}
      />
    </div>
  );
}

function emptyBill(defaultAccountId = "") {
  return {
    id: uid(),
    name: "",
    type: "noncontrollable",
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
    lastPaidDate: row.last_paid_date || "",
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

function mapBillToRow(bill, userId) {
  return {
    id: bill.id,
    user_id: userId,
    name: bill.name || "",
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
    last_paid_date: bill.lastPaidDate || null,
    created_at: bill.createdAt
      ? new Date(bill.createdAt).toISOString()
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

function BillRosterRow({
  bill,
  selected,
  onSelect,
  onDuplicate,
  onToggle,
  onDelete,
}) {
  const due = dueMeta(daysUntil(bill.dueDate));
  const tone = due.tone;
  const meta = toneMeta(tone);
  const monthly = monthlyWeight(bill.amount, bill.frequency);

  return (
    <div
      className="billCompactRow"
      onClick={onSelect}
      style={{
        borderColor: selected ? meta.border : "rgba(255,255,255,0.07)",
        boxShadow: selected
          ? `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(255,255,255,0.01), 0 0 24px ${meta.glow}`
          : "inset 0 1px 0 rgba(255,255,255,0.025)",
      }}
    >
      <div
        className="billCompactAvatar"
        style={{
          borderColor: meta.border,
          color: tone === "neutral" ? "#fff" : meta.text,
          boxShadow: `0 0 12px ${meta.glow}`,
        }}
      >
        <Receipt size={15} />
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
          <div className="billCompactTitle">{bill.name || "Bill"}</div>
          <MiniPill tone={due.tone}>{due.label}</MiniPill>
          {bill.autopay ? <MiniPill tone="green">Autopay</MiniPill> : null}
          {!bill.active ? <MiniPill>Inactive</MiniPill> : null}
        </div>

        <div className="billCompactSub">
          {bill.category || "No category"} • {bill.frequency} • Monthly pressure{" "}
          {money(monthly)} • Updated {fmtAgo(bill.updatedAt)}
        </div>

        <div style={{ marginTop: 10 }}>
          <ProgressBar fill={due.percent} tone={due.tone} />
        </div>
      </div>

      <div className="billCompactValue">{money(bill.amount)}</div>

      <div className="billCompactActions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="billIconBtn"
          onClick={onDuplicate}
          aria-label="Duplicate bill"
          title="Duplicate bill"
        >
          <Copy size={14} />
        </button>

        <button
          type="button"
          className="billIconBtn"
          onClick={onToggle}
          aria-label={bill.active ? "Archive bill" : "Activate bill"}
          title={bill.active ? "Archive bill" : "Activate bill"}
        >
          {bill.active ? "↘" : "↗"}
        </button>

        <button
          type="button"
          className="billIconBtn billDangerBtn"
          onClick={onDelete}
          aria-label="Delete bill"
          title="Delete bill"
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
      <div className="billEmptyState billInlineEmpty">
        <div>
          <div className="billEmptyTitle">No payment history yet</div>
          <div className="billEmptyText">
            Use the payment box above to log a payment on this bill.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="billIntelList">
      {payments.map((payment) => (
        <div key={payment.id} className="billIntelItem">
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
              <div className="billIntelTitle">{moneyTight(payment.amount)}</div>
              <div className="billIntelSub">
                {shortDate(payment.paymentDate)} •{" "}
                {payment.accountId
                  ? accountNameById.get(payment.accountId) || "Account"
                  : "No account linked"}
              </div>
            </div>

            <MiniPill tone="green">Paid</MiniPill>
          </div>

          {payment.note ? (
            <div className="billIntelSub" style={{ marginTop: -2 }}>
              {payment.note}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function FocusBillCard({
  bill,
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
  if (!bill) {
    return (
      <GlassPane size="card">
        <PaneHeader
          title="Selected Bill"
          subcopy="Choose one from the roster to work it here."
        />
        <div className="billEmptyState" style={{ minHeight: 190 }}>
          <div>
            <div className="billEmptyTitle">No bill selected</div>
            <div className="billEmptyText">
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

  return (
    <GlassPane tone={due.tone} size="card" style={{ height: "100%" }}>
      <PaneHeader
        title={bill.name || "Bill"}
        subcopy="Focus this bill, edit it, and log a payment right here in the center."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <MiniPill tone={due.tone}>{due.label}</MiniPill>
            {editor.autopay ? <MiniPill tone="green">Autopay</MiniPill> : null}
            {saving ? <MiniPill tone="amber">Saving...</MiniPill> : null}
          </div>
        }
      />

      <div className="billFocusBox">
        <div className="billTinyLabel">Current Bill Amount</div>

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
          {money(editor.amount)}
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "rgba(255,255,255,0.58)",
          }}
        >
          Updated {fmtWhen(bill.updatedAt)}
        </div>

        <div className="billInfoGrid" style={{ marginTop: 14 }}>
          <div className="billInfoCell">
            <div className="billTinyLabel">Due Date</div>
            <div className="billInfoValue">{shortDate(editor.dueDate)}</div>
            <div className="billInfoSub">{due.label}</div>
          </div>

          <div className="billInfoCell">
            <div className="billTinyLabel">Frequency</div>
            <div className="billInfoValue">
              {
                FREQUENCY_OPTIONS.find((opt) => opt.value === editor.frequency)?.label ||
                editor.frequency
              }
            </div>
            <div className="billInfoSub">
              Monthly pressure {money(monthlyWeight(editor.amount, editor.frequency))}
            </div>
          </div>

          <div className="billInfoCell">
            <div className="billTinyLabel">Linked Account</div>
            <div className="billInfoValue">
              {accountNameById.get(editor.accountId) || "None"}
            </div>
            <div className="billInfoSub">Used as default pay-from account</div>
          </div>

          <div className="billInfoCell">
            <div className="billTinyLabel">Last Paid</div>
            <div className="billInfoValue">{shortDate(editor.lastPaidDate)}</div>
            <div className="billInfoSub">
              {payments.length ? `${payments.length} logged payment${payments.length === 1 ? "" : "s"}` : "No payment history"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <ProgressBar fill={due.percent} tone={due.tone} />
        </div>

        <div className="billFormStack" style={{ marginTop: 14 }}>
          <div>
            <div className="billTinyLabel">Bill Name</div>
            <input
              className="billField"
              value={editor.name}
              onChange={(e) =>
                setEditor((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Rent"
            />
          </div>

          <div className="billFormGrid3">
            <div>
              <div className="billTinyLabel">Amount</div>
              <input
                className="billField"
                inputMode="decimal"
                value={editor.amount}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>

            <div>
              <div className="billTinyLabel">Due Date</div>
              <input
                type="date"
                className="billField"
                value={editor.dueDate}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, dueDate: e.target.value }))
                }
              />
            </div>

            <div>
              <div className="billTinyLabel">Frequency</div>
              <select
                className="billField"
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
          </div>

          <div className="billFormGrid2">
            <div>
              <div className="billTinyLabel">Category</div>
              <input
                className="billField"
                value={editor.category}
                onChange={(e) =>
                  setEditor((prev) => ({ ...prev, category: e.target.value }))
                }
                placeholder="Housing"
              />
            </div>

            <div>
              <div className="billTinyLabel">Linked Account</div>
              <select
                className="billField"
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

          <div>
            <div className="billTinyLabel">Notes</div>
            <textarea
              className="billField"
              rows={4}
              value={editor.notes}
              onChange={(e) =>
                setEditor((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Optional note..."
            />
          </div>

          <div className="billActionGrid billActionGridQuad">
            <ActionBtn variant="primary" onClick={onSave} full disabled={saving}>
              <Save size={14} /> Save
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

        <div className="billPayBox">
          <div className="billPayHeader">
            <div>
              <div className="billTinyLabel">Make Payment</div>
              <div className="billPaySub">
                Log a payment directly on this bill and optionally pull it from an account.
              </div>
            </div>

            <MiniPill tone="green">
              Last paid {editor.lastPaidDate ? shortDate(editor.lastPaidDate) : "—"}
            </MiniPill>
          </div>

          <div className="billPayGrid">
            <div>
              <div className="billTinyLabel">Payment Amount</div>
              <input
                className="billField"
                inputMode="decimal"
                placeholder="0.00"
                value={paymentDraft.amount}
                onChange={(e) =>
                  setPaymentDraft((prev) => ({ ...prev, amount: e.target.value }))
                }
              />
            </div>

            <div>
              <div className="billTinyLabel">Payment Date</div>
              <input
                type="date"
                className="billField"
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

          <div className="billPayGrid">
            <div>
              <div className="billTinyLabel">Pay From Account</div>
              <select
                className="billField"
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
              <div className="billTinyLabel">Advance Due Date</div>
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
            <div className="billTinyLabel">Payment Note</div>
            <textarea
              className="billField"
              rows={3}
              placeholder="Optional payment note..."
              value={paymentDraft.note}
              onChange={(e) =>
                setPaymentDraft((prev) => ({ ...prev, note: e.target.value }))
              }
            />
          </div>

          <div className="billActionGrid">
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
            subcopy="Latest payments recorded for this bill."
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

function AddBillCard({
  form,
  setForm,
  accounts,
  saving,
  onAdd,
}) {
  return (
    <GlassPane size="card" style={{ height: "100%" }}>
      <PaneHeader
        title="Add Bill"
        subcopy="Create a new fixed bill."
        right={
          <MiniPill>
            <Plus size={13} /> New
          </MiniPill>
        }
      />

      <div className="billFormStack">
        <div>
          <div className="billTinyLabel">Bill Name</div>
          <input
            className="billField"
            placeholder="Rent, Electric, Internet..."
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div className="billFormGrid3">
          <div>
            <div className="billTinyLabel">Amount</div>
            <input
              className="billField"
              inputMode="decimal"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </div>

          <div>
            <div className="billTinyLabel">Due Date</div>
            <input
              type="date"
              className="billField"
              value={form.dueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
          </div>

          <div>
            <div className="billTinyLabel">Frequency</div>
            <select
              className="billField"
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
        </div>

        <div className="billFormGrid2">
          <div>
            <div className="billTinyLabel">Category</div>
            <input
              className="billField"
              placeholder="Housing"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            />
          </div>

          <div>
            <div className="billTinyLabel">Linked Account</div>
            <select
              className="billField"
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

        <div>
          <div className="billTinyLabel">Notes</div>
          <textarea
            className="billField"
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

        <div className="billActionGrid">
          <ActionBtn variant="primary" onClick={onAdd} full disabled={saving}>
            <Plus size={14} /> {saving ? "Saving..." : "Add Bill"}
          </ActionBtn>
        </div>
      </div>
    </GlassPane>
  );
}

export default function BillsPage() {
  const [bills, setBills] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedBillId, setSelectedBillId] = useState("");
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
        setBills([]);
        setAccounts([]);
        setPayments([]);
        setSelectedBillId("");
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const [billsRes, accountsRes, settingsRes, paymentsRes] = await Promise.all([
        supabase
          .from("bills")
          .select("*")
          .eq("user_id", user.id)
          .eq("type", "noncontrollable")
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

      if (billsRes.error) throw billsRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (settingsRes.error) throw settingsRes.error;

      const loadedBills = (billsRes.data || []).map(mapBillRowToClient);
      const loadedAccounts = (accountsRes.data || []).map(mapAccountRowToClient);
      const primaryAccountId =
        settingsRes.data?.primary_account_id || loadedAccounts[0]?.id || "";

      setBills(loadedBills);
      setAccounts(loadedAccounts);
      setDefaultAccountId(primaryAccountId);
      setPayments(paymentsRes.error ? [] : (paymentsRes.data || []).map(mapPaymentRowToClient));
      setSelectedBillId((prev) => prev || loadedBills[0]?.id || "");
      setAddForm((prev) => ({ ...prev, accountId: prev.accountId || primaryAccountId }));
    } catch (err) {
      setPageError(err?.message || "Failed to load bills.");
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

  const visibleBills = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = bills.filter((bill) => {
      if (scope === "active" && !bill.active) return false;
      if (scope === "inactive" && bill.active) return false;

      if (!q) return true;

      return [bill.name, bill.category, bill.notes]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    if (sortBy === "amount_desc") {
      list.sort((a, b) => safeNum(b.amount) - safeNum(a.amount));
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
  }, [bills, scope, search, sortBy]);

  useEffect(() => {
    if (!visibleBills.length) {
      setSelectedBillId("");
      return;
    }

    const exists = visibleBills.some((bill) => bill.id === selectedBillId);
    if (!exists) setSelectedBillId(visibleBills[0].id);
  }, [visibleBills, selectedBillId]);

  const selectedBill =
    bills.find((bill) => bill.id === selectedBillId) || visibleBills[0] || null;

  useEffect(() => {
    if (!selectedBill) {
      setEditor({
        name: "",
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
      name: selectedBill.name || "",
      amount: String(selectedBill.amount ?? ""),
      dueDate: selectedBill.dueDate || isoDate(),
      frequency: selectedBill.frequency || "monthly",
      category: selectedBill.category || "",
      notes: selectedBill.notes || "",
      accountId: selectedBill.accountId || "",
      autopay: selectedBill.autopay === true,
      lastPaidDate: selectedBill.lastPaidDate || "",
    });

    setPaymentDraft({
      amount: String(selectedBill.amount || ""),
      paymentDate: isoDate(),
      accountId: selectedBill.accountId || defaultAccountId || "",
      note: "",
      advanceDue: true,
      saving: false,
    });
  }, [selectedBill?.id, defaultAccountId]);

  const selectedBillPayments = useMemo(() => {
    if (!selectedBill) return [];
    return payments
      .filter((payment) => payment.billId === selectedBill.id)
      .sort(
        (a, b) =>
          new Date(b.paymentDate || b.createdAt || 0).getTime() -
          new Date(a.paymentDate || a.createdAt || 0).getTime()
      );
  }, [payments, selectedBill?.id]);

  const metrics = useMemo(() => {
    const activeBills = bills.filter((bill) => bill.active);
    const monthKey = monthKeyOf(isoDate());

    const monthlyPressure = activeBills.reduce(
      (sum, bill) => sum + monthlyWeight(bill.amount, bill.frequency),
      0
    );

    const dueSoon = activeBills.filter((bill) => {
      const dueIn = daysUntil(bill.dueDate);
      return Number.isFinite(dueIn) && dueIn <= 7;
    });

    const paidThisMonth = payments
      .filter((payment) => monthKeyOf(payment.paymentDate) === monthKey)
      .reduce((sum, payment) => sum + safeNum(payment.amount), 0);

    const lastPayment = [...payments].sort(
      (a, b) =>
        new Date(b.paymentDate || b.createdAt || 0).getTime() -
        new Date(a.paymentDate || a.createdAt || 0).getTime()
    )[0];

    return {
      activeCount: activeBills.length,
      monthlyPressure,
      dueSoonCount: dueSoon.length,
      paidThisMonth,
      nextBill: [...activeBills].sort((a, b) => {
        const ad = Number.isFinite(daysUntil(a.dueDate)) ? daysUntil(a.dueDate) : 999999;
        const bd = Number.isFinite(daysUntil(b.dueDate)) ? daysUntil(b.dueDate) : 999999;
        return ad - bd;
      })[0],
      lastPayment,
    };
  }, [bills, payments]);

  async function addBill() {
    if (!supabase || !userId || addingBusy) return;

    const name = String(addForm.name || "").trim();
    const amount = parseMoneyInput(addForm.amount);

    if (!name) {
      window.alert("Bill name is required.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Amount must be greater than 0.");
      return;
    }

    setAddingBusy(true);

    const nextBill = {
      ...emptyBill(addForm.accountId || defaultAccountId),
      name,
      amount: round2(amount),
      dueDate: addForm.dueDate || isoDate(),
      frequency: addForm.frequency || "monthly",
      category: addForm.category || "",
      notes: addForm.notes || "",
      accountId: addForm.accountId || "",
      autopay: addForm.autopay === true,
      balance: 0,
      lastPaidDate: "",
    };

    const res = await supabase
      .from("bills")
      .insert(mapBillToRow(nextBill, userId))
      .select()
      .single();

    if (res.error) {
      console.error("add bill error:", res.error);
      setPageError(res.error.message || "Could not add bill.");
      setAddingBusy(false);
      return;
    }

    const saved = mapBillRowToClient(res.data);
    setBills((prev) => [saved, ...prev]);
    setSelectedBillId(saved.id);

    setAddForm({
      name: "",
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

  async function saveSelectedBill() {
    if (!supabase || !userId || !selectedBill || savingSelected) return;

    const name = String(editor.name || "").trim();
    const amount = parseMoneyInput(editor.amount);

    if (!name) {
      window.alert("Bill name is required.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Amount must be greater than 0.");
      return;
    }

    setSavingSelected(true);

    const payload = {
      ...selectedBill,
      name,
      amount: round2(amount),
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
      .update(mapBillToRow(payload, userId))
      .eq("id", selectedBill.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (res.error) {
      console.error("save bill error:", res.error);
      setPageError(res.error.message || "Could not save bill.");
      setSavingSelected(false);
      return;
    }

    const saved = mapBillRowToClient(res.data);
    setBills((prev) => prev.map((bill) => (bill.id === saved.id ? saved : bill)));
    setSavingSelected(false);
  }

  async function duplicateBill(bill) {
    if (!supabase || !userId) return;

    const clone = {
      ...bill,
      id: uid(),
      name: `${bill.name || "Bill"} Copy`,
      createdAt: Date.now(),
      updatedAt: new Date().toISOString(),
      lastPaidDate: "",
    };

    const res = await supabase
      .from("bills")
      .insert(mapBillToRow(clone, userId))
      .select()
      .single();

    if (res.error) {
      console.error("duplicate bill error:", res.error);
      setPageError(res.error.message || "Could not duplicate bill.");
      return;
    }

    const saved = mapBillRowToClient(res.data);
    setBills((prev) => [saved, ...prev]);
    setSelectedBillId(saved.id);
  }

  async function deleteBill() {
    if (!supabase || !userId || !selectedBill) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this bill?")) return;

    const { error } = await supabase
      .from("bills")
      .delete()
      .eq("id", selectedBill.id)
      .eq("user_id", userId);

    if (error) {
      console.error("delete bill error:", error);
      setPageError(error.message || "Could not delete bill.");
      return;
    }

    const nextBills = bills.filter((bill) => bill.id !== selectedBill.id);
    setBills(nextBills);
    setSelectedBillId(nextBills[0]?.id || "");
  }

  async function toggleBillActive(bill) {
    if (!supabase || !userId) return;

    const nextValue = !bill.active;

    const res = await supabase
      .from("bills")
      .update({
        active: nextValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bill.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (res.error) {
      console.error("toggle bill active error:", res.error);
      setPageError(res.error.message || "Could not update bill.");
      return;
    }

    const saved = mapBillRowToClient(res.data);
    setBills((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
  }

  async function toggleSelectedAutopay() {
    if (!supabase || !userId || !selectedBill || savingSelected) return;

    setSavingSelected(true);

    const res = await supabase
      .from("bills")
      .update({
        autopay: !editor.autopay,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedBill.id)
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
    setBills((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
    setSavingSelected(false);
  }

  async function makeBillPayment() {
    if (!supabase || !userId || !selectedBill || paymentDraft.saving) return;

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
        console.error("bill payment account update error:", accountError);
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
        kind: "bill_payment",
        amount,
        delta: -amount,
        resulting_balance: nextAccountBalance,
        note: `${selectedBill.name || "Bill"} payment${payNote ? ` • ${payNote}` : ""}`,
        related_account_id: null,
        related_account_name: null,
        source_type: "bill_payment",
        source_id: selectedBill.id,
        created_at: new Date().toISOString(),
      });
    }

    let nextDueDate = selectedBill.dueDate || "";
    if (paymentDraft.advanceDue && selectedBill.frequency !== "one_time" && selectedBill.dueDate) {
      nextDueDate = nextDueDateFromFrequency(selectedBill.dueDate, selectedBill.frequency);
    }

    const nextBalance =
      safeNum(selectedBill.balance, 0) > 0
        ? Math.max(0, round2(safeNum(selectedBill.balance, 0) - amount))
        : safeNum(selectedBill.balance, 0);

    const { data: updatedBillRow, error: billError } = await supabase
      .from("bills")
      .update({
        last_paid_date: paymentDate,
        due_date: nextDueDate || null,
        balance: nextBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedBill.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (billError) {
      console.error("bill payment update error:", billError);
      setPageError(billError.message || "Could not update bill after payment.");
      setPaymentDraft((prev) => ({ ...prev, saving: false }));
      return;
    }

    let savedPayment = {
      id: uid(),
      billId: selectedBill.id,
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
        bill_id: selectedBill.id,
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

    const updatedBill = mapBillRowToClient(updatedBillRow);
    setBills((prev) =>
      prev.map((bill) => (bill.id === updatedBill.id ? updatedBill : bill))
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
      <main className="billPage">
        <div className="billPageShell">
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
              Loading bills.
            </div>
          </GlassPane>
        </div>
        <style jsx global>{globalStyles}</style>
      </main>
    );
  }

  return (
    <>
      <main className="billPage">
        <div className="billPageShell">
          <GlassPane size="card">
            <div className="billHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div className="billEyebrow">Life Command Center</div>
                <div className="billHeroTitle">Bills Command</div>
                <div className="billHeroSub">
                  Fixed bills, due pressure, and direct bill payments in the center focus card.
                </div>

                <div className="billPillRow">
                  <MiniPill>{metrics.activeCount} active bills</MiniPill>
                  <MiniPill>{currentMonthLabel()}</MiniPill>
                  <MiniPill tone="amber">{metrics.dueSoonCount} due soon</MiniPill>
                  <MiniPill tone="green">{money(metrics.paidThisMonth)} paid this month</MiniPill>
                </div>
              </div>

              <div className="billHeroSide">
                <MiniPill>{money(metrics.monthlyPressure)} monthly</MiniPill>
                <MiniPill tone={metrics.nextBill ? dueMeta(daysUntil(metrics.nextBill.dueDate)).tone : "neutral"}>
                  {metrics.nextBill ? `Next: ${metrics.nextBill.name}` : "No next due"}
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

          <section className="billMetricGrid">
            <StatCard
              icon={Landmark}
              label="Monthly Pressure"
              value={money(metrics.monthlyPressure)}
              detail="Estimated fixed bill pressure for the month."
              tone="green"
            />
            <StatCard
              icon={CalendarClock}
              label="Due In 7 Days"
              value={String(metrics.dueSoonCount)}
              detail="Bills with due dates in the next 7 days."
              tone={metrics.dueSoonCount > 0 ? "amber" : "green"}
            />
            <StatCard
              icon={BadgeDollarSign}
              label="Paid This Month"
              value={money(metrics.paidThisMonth)}
              detail="Logged bill payments this month."
              tone="green"
            />
            <StatCard
              icon={ArrowUpRight}
              label="Next Bill"
              value={metrics.nextBill ? shortDate(metrics.nextBill.dueDate) : "—"}
              detail={metrics.nextBill ? metrics.nextBill.name : "No bill due yet."}
              tone={metrics.nextBill ? dueMeta(daysUntil(metrics.nextBill.dueDate)).tone : "neutral"}
            />
          </section>

          <GlassPane size="card">
            <PaneHeader
              title="Bill Controls"
              subcopy="Search the roster, filter bill status, and sort how you want."
            />

            <div className="billControlsGrid">
              <div>
                <div className="billTinyLabel">Search</div>
                <div className="billSearchWrap">
                  <Search size={15} />
                  <input
                    className="billField billSearchField"
                    placeholder="Search bill"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="billTinyLabel">Scope</div>
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
                <div className="billTinyLabel">Sort</div>
                <select
                  className="billField"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="due_asc">Due first</option>
                  <option value="amount_desc">Amount high → low</option>
                  <option value="name_asc">Name</option>
                  <option value="updated_desc">Recently updated</option>
                </select>
              </div>
            </div>
          </GlassPane>

          <section className="billWorkspaceGrid">
            <GlassPane size="card" style={{ height: "100%" }}>
              <PaneHeader
                title="Bills Roster"
                subcopy="Main roster stays left. Work the selected bill in center."
                right={<MiniPill>{visibleBills.length} showing</MiniPill>}
              />

              {visibleBills.length ? (
                <div className="billRosterListCompact">
                  {visibleBills.map((bill) => (
                    <BillRosterRow
                      key={bill.id}
                      bill={bill}
                      selected={bill.id === selectedBill?.id}
                      onSelect={() => setSelectedBillId(bill.id)}
                      onDuplicate={() => duplicateBill(bill)}
                      onToggle={() => toggleBillActive(bill)}
                      onDelete={() => {
                        setSelectedBillId(bill.id);
                        setTimeout(() => {
                          if (
                            typeof window !== "undefined" &&
                            window.confirm(`Delete ${bill.name}?`)
                          ) {
                            supabase
                              .from("bills")
                              .delete()
                              .eq("id", bill.id)
                              .eq("user_id", userId)
                              .then(({ error }) => {
                                if (error) {
                                  console.error(error);
                                  setPageError(error.message || "Could not delete bill.");
                                  return;
                                }
                                const nextBills = bills.filter((row) => row.id !== bill.id);
                                setBills(nextBills);
                                if (selectedBillId === bill.id) {
                                  setSelectedBillId(nextBills[0]?.id || "");
                                }
                              });
                          }
                        }, 0);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="billEmptyState">
                  <div>
                    <div className="billEmptyTitle">No bills found</div>
                    <div className="billEmptyText">
                      Clear filters or add a new bill.
                    </div>
                  </div>
                </div>
              )}
            </GlassPane>

            <FocusBillCard
              bill={selectedBill}
              editor={editor}
              setEditor={setEditor}
              accounts={accounts}
              payments={selectedBillPayments}
              saving={savingSelected}
              paymentDraft={paymentDraft}
              setPaymentDraft={setPaymentDraft}
              onSave={saveSelectedBill}
              onDuplicate={() => selectedBill && duplicateBill(selectedBill)}
              onDelete={deleteBill}
              onToggleAutopay={toggleSelectedAutopay}
              onMakePayment={makeBillPayment}
            />

            <AddBillCard
              form={addForm}
              setForm={setAddForm}
              accounts={accounts}
              saving={addingBusy}
              onAdd={addBill}
            />
          </section>
        </div>
      </main>

      <style jsx global>{globalStyles}</style>
    </>
  );
}

const globalStyles = `
  .billPage {
    width: 100%;
    min-width: 0;
    color: var(--lcc-text);
    font-family: var(--lcc-font-sans);
  }

  .billPageShell {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 12px 0 20px;
    display: grid;
    gap: 14px;
  }

  .billEyebrow {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .22em;
    font-weight: 800;
    color: rgba(255,255,255,0.42);
  }

  .billHeroTitle {
    margin-top: 8px;
    font-size: clamp(24px, 3.2vw, 34px);
    line-height: 1.02;
    font-weight: 850;
    letter-spacing: -0.05em;
    color: #fff;
  }

  .billHeroSub {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.55;
    color: rgba(255,255,255,0.62);
    max-width: 840px;
  }

  .billHeroGrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: start;
  }

  .billHeroSide {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-content: flex-start;
  }

  .billPillRow {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .billMetricGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .billControlsGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) minmax(260px, 0.56fr);
    gap: 14px;
    align-items: end;
  }

  .billWorkspaceGrid {
    display: grid;
    grid-template-columns: minmax(460px, 1.18fr) minmax(480px, 1.32fr) minmax(360px, 0.95fr);
    gap: 14px;
    align-items: stretch;
  }

  .billWorkspaceGrid > * {
    min-width: 0;
    height: 100%;
  }

  .billSearchWrap {
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

  .billSearchField {
    min-height: 42px !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
  }

  .billRosterListCompact {
    display: grid;
    gap: 10px;
    min-height: 720px;
    max-height: 720px;
    overflow: auto;
    padding-right: 2px;
  }

  .billCompactRow {
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

  .billCompactRow:hover {
    transform: translateY(-1px);
  }

  .billCompactAvatar {
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

  .billCompactTitle {
    font-size: 13.5px;
    font-weight: 800;
    color: #fff;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .billCompactSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.35;
  }

  .billCompactValue {
    font-size: 15px;
    font-weight: 850;
    color: #fff;
    white-space: nowrap;
  }

  .billCompactActions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .billIconBtn {
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

  .billDangerBtn {
    border-color: rgba(255,132,163,0.18);
    color: #ffd3df;
  }

  .billFocusBox {
    border-radius: 22px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
    padding: 15px;
    min-height: 100%;
  }

  .billInfoGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .billInfoCell {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.025);
    padding: 11px;
  }

  .billInfoValue {
    font-size: 0.96rem;
    font-weight: 900;
    line-height: 1.15;
    color: #fff;
  }

  .billInfoSub {
    margin-top: 5px;
    color: rgba(255,255,255,0.62);
    font-size: 0.79rem;
    line-height: 1.4;
  }

  .billProgress {
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255,255,255,0.1);
  }

  .billProgressFill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.4s ease;
  }

  .billPayBox {
    margin-top: 14px;
    border-radius: 22px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
    padding: 15px;
    display: grid;
    gap: 12px;
  }

  .billPayHeader {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .billPaySub {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.45;
    color: rgba(255,255,255,0.60);
  }

  .billPayGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .billActionGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .billActionGridQuad {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .billFormStack {
    display: grid;
    gap: 12px;
  }

  .billFormGrid2,
  .billFormGrid3 {
    display: grid;
    gap: 10px;
  }

  .billFormGrid2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .billFormGrid3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .billTinyLabel {
    display: block;
    margin-bottom: 8px;
    font-size: 10px;
    color: rgba(255,255,255,0.46);
    text-transform: uppercase;
    letter-spacing: .16em;
    font-weight: 800;
  }

  .billField {
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

  .billField:focus {
    border-color: rgba(143,177,255,0.30);
    box-shadow:
      0 0 0 4px rgba(79,114,255,0.08),
      inset 0 1px 0 rgba(255,255,255,0.035);
  }

  .billField::placeholder {
    color: rgba(225,233,245,0.38);
  }

  .billField option {
    background: #08111f;
    color: #f4f7ff;
  }

  textarea.billField {
    min-height: 110px;
    resize: vertical;
    padding: 12px 13px;
  }

  .billActionBtn {
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

  .billActionBtn:hover {
    transform: translateY(-1px);
  }

  .billIntelList {
    display: grid;
    gap: 10px;
    min-height: 240px;
    max-height: 260px;
    overflow: auto;
    padding-right: 2px;
  }

  .billIntelItem {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.07);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    padding: 12px;
    display: grid;
    gap: 10px;
  }

  .billIntelTitle {
    font-size: 13px;
    font-weight: 800;
    color: #fff;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .billIntelSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.35;
  }

  .billEmptyState {
    min-height: 150px;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 14px;
  }

  .billInlineEmpty {
    min-height: 220px;
  }

  .billEmptyTitle {
    font-size: 16px;
    font-weight: 850;
    color: #fff;
  }

  .billEmptyText {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.5;
    color: rgba(255,255,255,0.60);
    max-width: 360px;
  }

  @media (max-width: 1560px) {
    .billWorkspaceGrid {
      grid-template-columns: minmax(420px, 1.08fr) minmax(420px, 1.18fr) minmax(320px, 0.9fr);
    }
  }

  @media (max-width: 1420px) {
    .billControlsGrid {
      grid-template-columns: 1fr;
    }

    .billWorkspaceGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .billWorkspaceGrid > :nth-child(3) {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 1260px) {
    .billMetricGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .billRosterListCompact {
      min-height: 580px;
      max-height: 580px;
    }
  }

  @media (max-width: 1100px) {
    .billHeroGrid,
    .billWorkspaceGrid {
      grid-template-columns: 1fr;
    }

    .billHeroSide {
      justify-content: flex-start;
    }
  }

  @media (max-width: 1024px) {
    .billInfoGrid,
    .billFormGrid2,
    .billFormGrid3,
    .billActionGrid,
    .billActionGridQuad,
    .billPayGrid {
      grid-template-columns: 1fr;
    }

    .billCompactRow {
      grid-template-columns: 42px minmax(0, 1fr);
    }

    .billCompactValue {
      white-space: normal;
    }

    .billCompactActions {
      grid-column: 2;
      justify-content: flex-start;
    }

    .billRosterListCompact,
    .billIntelList {
      min-height: 0;
      max-height: none;
    }
  }

  @media (max-width: 760px) {
    .billPageShell {
      padding: 8px 0 14px;
    }

    .billMetricGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .billMetricGrid,
    .billActionGrid,
    .billActionGridQuad {
      grid-template-columns: 1fr;
    }
  }
`;