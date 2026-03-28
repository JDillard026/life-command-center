"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  CreditCard,
  PauseCircle,
  PiggyBank,
  PlayCircle,
  Plus,
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

const BILL_TYPE_OPTIONS = [
  { value: "noncontrollable", label: "Fixed Bill" },
  { value: "controllable", label: "Debt / Controllable" },
];

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function shortDate(iso) {
  const d = toDate(iso);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatStamp(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
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

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function moneyTight(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function num(value, fallback = 0) {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function frequencyMultiplier(freq) {
  if (freq === "weekly") return 4.333;
  if (freq === "biweekly") return 2.167;
  if (freq === "monthly") return 1;
  if (freq === "quarterly") return 1 / 3;
  if (freq === "yearly") return 1 / 12;
  return 0;
}

function paymentAmount(bill) {
  if (!bill) return 0;
  if (bill.type === "controllable") {
    const minPay = Number(bill.minPay) || 0;
    const extraPay = Number(bill.extraPay) || 0;
    const fallback = Number(bill.amount) || 0;
    return minPay + extraPay > 0 ? minPay + extraPay : fallback;
  }
  return Number(bill.amount) || 0;
}

function monthlyEquivalent(bill) {
  if (!bill?.active) return 0;
  if (bill.type === "controllable") return paymentAmount(bill);
  return (Number(bill.amount) || 0) * frequencyMultiplier(bill.frequency);
}

function daysUntil(iso) {
  const due = toDate(iso);
  const today = toDate(todayISO());
  if (!due || !today) return null;
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function dueTone(days) {
  if (days == null) return "neutral";
  if (days < 0) return "red";
  if (days <= 3) return "red";
  if (days <= 7) return "amber";
  return "green";
}

function dueLabel(days) {
  if (days == null) return "No due date";
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

function payoffSimulation(balance, aprPct, monthlyPay) {
  let current = Number(balance) || 0;
  const apr = Number(aprPct) || 0;
  const pay = Number(monthlyPay) || 0;

  if (current <= 0) {
    return {
      months: 0,
      totalInterest: 0,
      payoffDate: todayISO(),
      impossible: false,
    };
  }

  if (pay <= 0) {
    return {
      months: null,
      totalInterest: null,
      payoffDate: null,
      impossible: true,
    };
  }

  const monthlyRate = apr / 100 / 12;
  let months = 0;
  let totalInterest = 0;

  while (current > 0.01 && months < 600) {
    const interest = current * monthlyRate;
    totalInterest += interest;
    current = current + interest - pay;
    months += 1;

    if (monthlyRate > 0 && pay <= interest) {
      return {
        months: null,
        totalInterest: null,
        payoffDate: null,
        impossible: true,
      };
    }
  }

  if (months >= 600) {
    return {
      months: null,
      totalInterest: null,
      payoffDate: null,
      impossible: true,
    };
  }

  const d = new Date();
  d.setMonth(d.getMonth() + months);

  return {
    months,
    totalInterest,
    payoffDate: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    impossible: false,
  };
}

function formatMonths(n) {
  if (n == null) return "No payoff";
  if (n <= 0) return "Paid";
  const years = Math.floor(n / 12);
  const months = n % 12;
  if (years <= 0) return `${months} mo`;
  if (months === 0) return `${years} yr`;
  return `${years} yr ${months} mo`;
}

function billInitials(name) {
  const text = String(name || "").trim();
  if (!text) return "BL";
  const words = text.split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() || "").join("").slice(0, 2);
}

function typeLabel(type) {
  return type === "controllable" ? "Debt / Controllable" : "Fixed Bill";
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

function mapBillRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "",
    type: row.type || "noncontrollable",
    frequency: row.frequency || "monthly",
    dueDate: row.due_date || "",
    amount: Number(row.amount) || 0,
    active: row.active !== false,
    notes: row.notes || "",
    balance: Number(row.balance) || 0,
    aprPct: Number(row.apr_pct) || 0,
    minPay: Number(row.min_pay) || 0,
    extraPay: Number(row.extra_pay) || 0,
    lastPaidDate: row.last_paid_date || "",
    autopay: row.autopay === true,
    category: row.category || "",
    accountId: row.account_id || "",
    updatedAt: row.updated_at || row.created_at || null,
    createdAt: row.created_at || null,
  };
}

function mapBillClientToRow(bill, userId) {
  return {
    id: bill.id,
    user_id: userId,
    name: bill.name,
    type: bill.type,
    frequency: bill.frequency,
    due_date: bill.dueDate || null,
    amount: Number(bill.amount) || 0,
    active: bill.active !== false,
    notes: bill.notes || "",
    balance: bill.type === "controllable" ? Number(bill.balance) || 0 : null,
    apr_pct: bill.type === "controllable" ? Number(bill.aprPct) || 0 : null,
    min_pay: bill.type === "controllable" ? Number(bill.minPay) || 0 : null,
    extra_pay: bill.type === "controllable" ? Number(bill.extraPay) || 0 : null,
    last_paid_date: bill.lastPaidDate || null,
    autopay: bill.type === "controllable" ? bill.autopay === true : false,
    category: bill.category || null,
    account_id: bill.accountId || null,
    updated_at: new Date().toISOString(),
  };
}

function sortBills(list, sort = "due") {
  const next = [...list];

  next.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;

    if (sort === "name") {
      return String(a.name || "").localeCompare(String(b.name || ""));
    }

    if (sort === "pressure") {
      return monthlyEquivalent(b) - monthlyEquivalent(a);
    }

    if (sort === "updated") {
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    }

    const ad = daysUntil(a.dueDate);
    const bd = daysUntil(b.dueDate);

    if (ad == null && bd != null) return 1;
    if (ad != null && bd == null) return -1;
    if (ad != null && bd != null && ad !== bd) return ad - bd;

    return monthlyEquivalent(b) - monthlyEquivalent(a);
  });

  return next;
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
      className="billsActionBtn"
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

function CompactBillRow({ bill, selected, onSelect, onMarkPaid, onToggle, onDelete }) {
  const due = daysUntil(bill.dueDate);
  const tone = dueTone(due);
  const meta = toneMeta(tone);

  return (
    <div
      className="billsCompactRow"
      onClick={onSelect}
      style={{
        borderColor: selected ? meta.border : "rgba(255,255,255,0.07)",
        boxShadow: selected
          ? `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(255,255,255,0.01), 0 0 24px ${meta.glow}`
          : "inset 0 1px 0 rgba(255,255,255,0.025)",
      }}
    >
      <div
        className="billsCompactAvatar"
        style={{
          borderColor: meta.border,
          color: tone === "neutral" ? "#fff" : meta.text,
          boxShadow: `0 0 12px ${meta.glow}`,
        }}
      >
        {billInitials(bill.name)}
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
          <div className="billsCompactTitle">{bill.name}</div>
          <MiniPill tone={bill.type === "controllable" ? "red" : "neutral"}>
            {typeLabel(bill.type)}
          </MiniPill>
          <MiniPill tone={tone}>{dueLabel(due)}</MiniPill>
          <MiniPill tone={bill.active ? "green" : "neutral"}>
            {bill.active ? "Active" : "Paused"}
          </MiniPill>
        </div>

        <div className="billsCompactSub">
          {bill.category || "No category"} • {bill.frequency || "monthly"} • Updated{" "}
          {formatAgo(bill.updatedAt)}
        </div>
      </div>

      <div className="billsCompactValue">{money(paymentAmount(bill))}</div>

      <div
        className="billsCompactActions"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="billsIconBtn"
          onClick={onMarkPaid}
          aria-label="Mark paid"
          title="Mark paid"
        >
          <CheckCircle2 size={14} />
        </button>
        <button
          type="button"
          className="billsIconBtn"
          onClick={onToggle}
          aria-label={bill.active ? "Pause bill" : "Activate bill"}
          title={bill.active ? "Pause bill" : "Activate bill"}
        >
          {bill.active ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
        </button>
        <button
          type="button"
          className="billsIconBtn billsDangerBtn"
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

function FocusBillCard({
  bill,
  linkedAccount,
  payoffData,
  onMarkPaid,
  onToggle,
  onDelete,
}) {
  if (!bill) {
    return (
      <GlassPane size="card">
        <PaneHeader
          title="Selected Bill"
          subcopy="Choose one from the roster to work it here."
        />
        <div className="billsEmptyState" style={{ minHeight: 170 }}>
          <div>
            <div className="billsEmptyTitle">No bill selected</div>
            <div className="billsEmptyText">
              Pick one from the roster on the left.
            </div>
          </div>
        </div>
      </GlassPane>
    );
  }

  const due = daysUntil(bill.dueDate);
  const tone = dueTone(due);
  const meta = toneMeta(tone);

  return (
    <GlassPane tone={tone} size="card">
      <PaneHeader
        title={bill.name}
        subcopy="Focused controls for the bill you are actively touching."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <MiniPill tone={bill.type === "controllable" ? "red" : "neutral"}>
              {typeLabel(bill.type)}
            </MiniPill>
            <MiniPill tone={bill.active ? "green" : "neutral"}>
              {bill.active ? "Active" : "Paused"}
            </MiniPill>
            <MiniPill tone={tone}>{dueLabel(due)}</MiniPill>
          </div>
        }
      />

      <div className="billsFocusBox">
        <div className="billsTinyLabel">
          {bill.type === "controllable" ? "Current Payment" : "Current Amount"}
        </div>

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
          {money(paymentAmount(bill))}
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "rgba(255,255,255,0.58)",
          }}
        >
          Updated {formatStamp(bill.updatedAt)}
        </div>

        <div className="billsInfoGrid" style={{ marginTop: 14 }}>
          <div className="billsInfoCell">
            <div className="billsTinyLabel">Due</div>
            <div className="billsInfoValue">
              {bill.dueDate ? shortDate(bill.dueDate) : "—"}
            </div>
            <div className="billsInfoSub">{dueLabel(due)}</div>
          </div>

          <div className="billsInfoCell">
            <div className="billsTinyLabel">Monthly Pressure</div>
            <div className="billsInfoValue">{money(monthlyEquivalent(bill))}</div>
            <div className="billsInfoSub">Normalized monthly hit.</div>
          </div>

          <div className="billsInfoCell">
            <div className="billsTinyLabel">
              {bill.type === "controllable" ? "Balance" : "Amount"}
            </div>
            <div className="billsInfoValue">
              {bill.type === "controllable" ? money(bill.balance) : money(bill.amount)}
            </div>
            <div className="billsInfoSub">
              {bill.type === "controllable"
                ? `${Number(bill.aprPct) || 0}% APR`
                : linkedAccount
                ? `Linked: ${linkedAccount.name}`
                : "No linked account"}
            </div>
          </div>

          <div className="billsInfoCell">
            <div className="billsTinyLabel">Last Paid</div>
            <div className="billsInfoValue">
              {bill.lastPaidDate ? shortDate(bill.lastPaidDate) : "—"}
            </div>
            <div className="billsInfoSub">
              {bill.autopay ? "Autopay enabled" : "Manual payment flow"}
            </div>
          </div>
        </div>

        {bill.type === "controllable" && payoffData ? (
          <div className="billsInfoCell" style={{ marginTop: 12 }}>
            <div className="billsTinyLabel">Payoff Forecast</div>

            <div className="billsProgress" style={{ marginTop: 8 }}>
              <div
                className="billsProgressFill"
                style={{
                  width: `${payoffData.progress}%`,
                  background: payoffData.payoff.impossible
                    ? "linear-gradient(90deg, #ff6b7f 0%, rgba(255,255,255,.92) 220%)"
                    : "linear-gradient(90deg, #4ade80 0%, rgba(255,255,255,.92) 220%)",
                }}
              />
            </div>

            <div className="billsInfoGrid" style={{ marginTop: 10 }}>
              <div>
                <div className="billsInfoValue">
                  {payoffData.payoff.impossible
                    ? "No payoff"
                    : formatMonths(payoffData.payoff.months)}
                </div>
                <div className="billsInfoSub">{money(payoffData.monthlyPay)}/mo</div>
              </div>
              <div>
                <div className="billsInfoValue">
                  {payoffData.payoff.impossible
                    ? "—"
                    : money(payoffData.payoff.totalInterest)}
                </div>
                <div className="billsInfoSub">
                  {payoffData.payoff.payoffDate
                    ? `Payoff ${shortDate(payoffData.payoff.payoffDate)}`
                    : "No payoff date"}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {bill.notes ? (
          <div className="billsInfoCell" style={{ marginTop: 12 }}>
            <div className="billsTinyLabel">Notes</div>
            <div className="billsInfoSub" style={{ color: "#fff" }}>
              {bill.notes}
            </div>
          </div>
        ) : null}

        <div className="billsActionGrid billsActionGridTight" style={{ marginTop: 14 }}>
          <ActionBtn variant="primary" onClick={onMarkPaid} full>
            <CheckCircle2 size={14} /> Mark Paid
          </ActionBtn>
          <ActionBtn onClick={onToggle} full>
            {bill.active ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
            {bill.active ? "Pause" : "Activate"}
          </ActionBtn>
          <ActionBtn variant="danger" onClick={onDelete} full>
            <Trash2 size={14} /> Delete
          </ActionBtn>
        </div>
      </div>
    </GlassPane>
  );
}

function AddBillCard({
  saving,
  accounts,
  formType,
  setFormType,
  formName,
  setFormName,
  formFrequency,
  setFormFrequency,
  formDueDate,
  setFormDueDate,
  formAmount,
  setFormAmount,
  formCategory,
  setFormCategory,
  formNotes,
  setFormNotes,
  formAccountId,
  setFormAccountId,
  formBalance,
  setFormBalance,
  formAprPct,
  setFormAprPct,
  formMinPay,
  setFormMinPay,
  formExtraPay,
  setFormExtraPay,
  formAutopay,
  setFormAutopay,
  addBill,
  resetForm,
}) {
  return (
    <GlassPane size="card">
      <PaneHeader
        title="Add Bill"
        subcopy="Keep this fast and clean."
        right={
          <MiniPill>
            <Plus size={13} /> New
          </MiniPill>
        }
      />

      <div className="billsFormStack">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {BILL_TYPE_OPTIONS.map((option) => (
            <ActionBtn
              key={option.value}
              variant={formType === option.value ? "primary" : "ghost"}
              onClick={() => setFormType(option.value)}
            >
              {option.label}
            </ActionBtn>
          ))}
        </div>

        <div>
          <div className="billsTinyLabel">Bill Name</div>
          <input
            className="billsField"
            placeholder="Mortgage, Insurance, Chase Card..."
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
        </div>

        <div className="billsFormGrid2">
          <div>
            <div className="billsTinyLabel">Type</div>
            <select
              className="billsField"
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
            >
              {BILL_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="billsTinyLabel">Category</div>
            <input
              className="billsField"
              placeholder="Housing, Utilities..."
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
            />
          </div>
        </div>

        <div className="billsFormGrid3">
          <div>
            <div className="billsTinyLabel">
              {formType === "controllable" ? "Current Pay" : "Amount"}
            </div>
            <input
              className="billsField"
              inputMode="decimal"
              placeholder="0.00"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
            />
          </div>

          <div>
            <div className="billsTinyLabel">Due Date</div>
            <input
              className="billsField"
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
            />
          </div>

          <div>
            <div className="billsTinyLabel">Frequency</div>
            <select
              className="billsField"
              value={formFrequency}
              onChange={(e) => setFormFrequency(e.target.value)}
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {formType === "controllable" ? (
          <div className="billsFormGrid4">
            <div>
              <div className="billsTinyLabel">Balance</div>
              <input
                className="billsField"
                inputMode="decimal"
                placeholder="0.00"
                value={formBalance}
                onChange={(e) => setFormBalance(e.target.value)}
              />
            </div>

            <div>
              <div className="billsTinyLabel">APR %</div>
              <input
                className="billsField"
                inputMode="decimal"
                placeholder="6.25"
                value={formAprPct}
                onChange={(e) => setFormAprPct(e.target.value)}
              />
            </div>

            <div>
              <div className="billsTinyLabel">Min Pay</div>
              <input
                className="billsField"
                inputMode="decimal"
                placeholder="0.00"
                value={formMinPay}
                onChange={(e) => setFormMinPay(e.target.value)}
              />
            </div>

            <div>
              <div className="billsTinyLabel">Extra Pay</div>
              <input
                className="billsField"
                inputMode="decimal"
                placeholder="0.00"
                value={formExtraPay}
                onChange={(e) => setFormExtraPay(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div className="billsFormGrid2">
          <div>
            <div className="billsTinyLabel">Linked Account</div>
            <select
              className="billsField"
              value={formAccountId}
              onChange={(e) => setFormAccountId(e.target.value)}
            >
              <option value="">No account</option>
              {accounts.map((acct) => (
                <option key={acct.id} value={acct.id}>
                  {acct.name}
                </option>
              ))}
            </select>
          </div>

          {formType === "controllable" ? (
            <label className="billsCheck" style={{ alignSelf: "end", minHeight: 44 }}>
              <input
                type="checkbox"
                checked={formAutopay}
                onChange={(e) => setFormAutopay(e.target.checked)}
              />
              Autopay enabled
            </label>
          ) : (
            <div />
          )}
        </div>

        <div>
          <div className="billsTinyLabel">Notes</div>
          <textarea
            className="billsField"
            rows={4}
            placeholder="Optional notes"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />
        </div>

        <div className="billsActionGrid">
          <ActionBtn variant="primary" onClick={addBill} full disabled={saving}>
            <Plus size={14} /> {saving ? "Saving..." : "Add Bill"}
          </ActionBtn>
          <ActionBtn onClick={resetForm} full disabled={saving}>
            Reset
          </ActionBtn>
        </div>
      </div>
    </GlassPane>
  );
}

function QueueItem({ bill, onFocus, onMarkPaid }) {
  const due = daysUntil(bill.dueDate);
  const tone = dueTone(due);

  return (
    <div className="billsIntelItem">
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
          <div className="billsIntelTitle">{bill.name}</div>
          <div className="billsIntelSub">
            Due {bill.dueDate ? shortDate(bill.dueDate) : "—"} • {moneyTight(paymentAmount(bill))}
          </div>
        </div>

        <MiniPill tone={tone}>{dueLabel(due)}</MiniPill>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ActionBtn onClick={onFocus}>Focus</ActionBtn>
        <ActionBtn onClick={onMarkPaid}>Mark Paid</ActionBtn>
      </div>
    </div>
  );
}

function PayoffItem({ row, onFocus }) {
  return (
    <div className="billsIntelItem">
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
          <div className="billsIntelTitle">{row.name}</div>
          <div className="billsIntelSub">
            {moneyTight(row.balance)} at {Number(row.aprPct) || 0}% APR
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="billsIntelValue">
            {row.payoff.impossible ? "No payoff" : formatMonths(row.payoff.months)}
          </div>
          <div className="billsIntelSub">{moneyTight(row.monthlyPay)}/mo</div>
        </div>
      </div>

      <div className="billsProgress">
        <div
          className="billsProgressFill"
          style={{
            width: `${row.payoffProgress}%`,
            background: row.payoff.impossible
              ? "linear-gradient(90deg, #ff6b7f 0%, rgba(255,255,255,.92) 220%)"
              : "linear-gradient(90deg, #4ade80 0%, rgba(255,255,255,.92) 220%)",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <ActionBtn onClick={onFocus}>Focus</ActionBtn>
      </div>
    </div>
  );
}

export default function BillsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  const [bills, setBills] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedBillId, setSelectedBillId] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("due");

  const [formType, setFormType] = useState("noncontrollable");
  const [formName, setFormName] = useState("");
  const [formFrequency, setFormFrequency] = useState("monthly");
  const [formDueDate, setFormDueDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formAccountId, setFormAccountId] = useState("");
  const [formBalance, setFormBalance] = useState("");
  const [formAprPct, setFormAprPct] = useState("");
  const [formMinPay, setFormMinPay] = useState("");
  const [formExtraPay, setFormExtraPay] = useState("");
  const [formAutopay, setFormAutopay] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadPage() {
      try {
        setPageError("");

        if (!supabase) throw new Error("Supabase is not configured.");

        const {
          data: { user: currentUser },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;
        if (!mounted) return;

        setUser(currentUser || null);

        if (!currentUser) {
          setLoading(false);
          return;
        }

        const [billsRes, accountsRes] = await Promise.all([
          supabase
            .from("bills")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("active", { ascending: false })
            .order("due_date", { ascending: true }),
          supabase
            .from("accounts")
            .select("id,name")
            .eq("user_id", currentUser.id)
            .order("name", { ascending: true }),
        ]);

        if (billsRes.error) throw billsRes.error;
        if (!mounted) return;

        const loadedBills = (billsRes.data || []).map(mapBillRowToClient);
        const sorted = sortBills(loadedBills, "due");

        setBills(loadedBills);
        setAccounts(accountsRes.error ? [] : accountsRes.data || []);
        setSelectedBillId(sorted[0]?.id || "");
      } catch (err) {
        if (!mounted) return;
        setPageError(err?.message || "Failed to load bills page.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPage();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredBills = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = bills.filter((bill) => {
      const due = daysUntil(bill.dueDate);

      const filterPass =
        filter === "all" ||
        (filter === "active" && bill.active) ||
        (filter === "paused" && !bill.active) ||
        (filter === "controllable" && bill.type === "controllable") ||
        (filter === "noncontrollable" && bill.type === "noncontrollable") ||
        (filter === "due" && due != null && due <= 7);

      if (!filterPass) return false;
      if (!q) return true;

      return `${bill.name} ${bill.type} ${bill.frequency} ${bill.notes} ${bill.category}`
        .toLowerCase()
        .includes(q);
    });

    return sortBills(filtered, sort);
  }, [bills, filter, search, sort]);

  useEffect(() => {
    if (!bills.length) {
      setSelectedBillId("");
      return;
    }

    const exists = bills.some((bill) => bill.id === selectedBillId);
    if (!exists) {
      setSelectedBillId(sortBills(bills, sort)[0]?.id || "");
    }
  }, [bills, selectedBillId, sort]);

  const selectedBill =
    bills.find((bill) => bill.id === selectedBillId) ||
    filteredBills[0] ||
    sortBills(bills, sort)[0] ||
    null;

  const linkedAccount = selectedBill
    ? accounts.find((acct) => acct.id === selectedBill.accountId) || null
    : null;

  const activeBills = useMemo(() => bills.filter((bill) => bill.active), [bills]);

  const controllableBills = useMemo(
    () => bills.filter((bill) => bill.active && bill.type === "controllable"),
    [bills]
  );

  const fixedBills = useMemo(
    () => bills.filter((bill) => bill.active && bill.type === "noncontrollable"),
    [bills]
  );

  const monthlyPressure = useMemo(
    () => bills.reduce((sum, bill) => sum + monthlyEquivalent(bill), 0),
    [bills]
  );

  const totalDebt = useMemo(
    () => controllableBills.reduce((sum, bill) => sum + (Number(bill.balance) || 0), 0),
    [controllableBills]
  );

  const dueSoonBills = useMemo(
    () =>
      sortBills(
        bills.filter((bill) => {
          if (!bill.active) return false;
          const d = daysUntil(bill.dueDate);
          return d != null && d <= 14;
        }),
        "due"
      ),
    [bills]
  );

  const overdueCount = useMemo(
    () =>
      bills.filter((bill) => {
        if (!bill.active) return false;
        const d = daysUntil(bill.dueDate);
        return d != null && d < 0;
      }).length,
    [bills]
  );

  const strongestPressure = useMemo(() => {
    if (!activeBills.length) return null;
    return [...activeBills].sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))[0];
  }, [activeBills]);

  const payoffRows = useMemo(() => {
    return controllableBills
      .map((bill) => {
        const monthlyPay = paymentAmount(bill);
        const payoff = payoffSimulation(bill.balance, bill.aprPct, monthlyPay);

        return {
          ...bill,
          monthlyPay,
          payoff,
          payoffProgress:
            bill.balance > 0 && monthlyPay > 0
              ? clamp((monthlyPay / bill.balance) * 100 * 12, 0, 100)
              : 0,
        };
      })
      .sort((a, b) => {
        if (a.payoff.impossible && !b.payoff.impossible) return 1;
        if (!a.payoff.impossible && b.payoff.impossible) return -1;
        return (a.payoff.months ?? 9999) - (b.payoff.months ?? 9999);
      });
  }, [controllableBills]);

  const selectedPayoff = useMemo(() => {
    if (!selectedBill || selectedBill.type !== "controllable") return null;

    const monthlyPay = paymentAmount(selectedBill);
    const payoff = payoffSimulation(selectedBill.balance, selectedBill.aprPct, monthlyPay);

    return {
      monthlyPay,
      payoff,
      progress:
        selectedBill.balance > 0 && monthlyPay > 0
          ? clamp((monthlyPay / selectedBill.balance) * 100 * 12, 0, 100)
          : 0,
    };
  }, [selectedBill]);

  function resetForm() {
    setFormType("noncontrollable");
    setFormName("");
    setFormFrequency("monthly");
    setFormDueDate("");
    setFormAmount("");
    setFormCategory("");
    setFormNotes("");
    setFormAccountId("");
    setFormBalance("");
    setFormAprPct("");
    setFormMinPay("");
    setFormExtraPay("");
    setFormAutopay(false);
    setPageError("");
  }

  async function addBill() {
    if (!user || saving) return;

    const name = formName.trim();
    if (!name) {
      setPageError("Name is required.");
      return;
    }

    const amount = num(formAmount, NaN);
    if (!Number.isFinite(amount) || amount < 0) {
      setPageError("Enter a valid amount.");
      return;
    }

    if (formType === "controllable") {
      const balance = num(formBalance, NaN);
      if (!Number.isFinite(balance) || balance < 0) {
        setPageError("Enter a valid balance.");
        return;
      }
    }

    setSaving(true);
    setPageError("");

    try {
      const draft = {
        id: makeId(),
        name,
        type: formType,
        frequency: formFrequency,
        dueDate: formDueDate,
        amount,
        active: true,
        notes: formNotes.trim(),
        balance: num(formBalance, 0),
        aprPct: num(formAprPct, 0),
        minPay: num(formMinPay, 0),
        extraPay: num(formExtraPay, 0),
        lastPaidDate: "",
        autopay: formAutopay,
        category: formCategory.trim(),
        accountId: formAccountId || "",
      };

      const { data, error } = await supabase
        .from("bills")
        .insert([mapBillClientToRow(draft, user.id)])
        .select()
        .single();

      if (error) throw error;

      const mapped = mapBillRowToClient(data);
      setBills((prev) => [mapped, ...prev]);
      setSelectedBillId(mapped.id);
      resetForm();
    } catch (err) {
      setPageError(err?.message || "Failed to save bill.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(bill) {
    if (!user) return;

    const previous = bills;
    const nextActive = !bill.active;

    setBills((prev) =>
      prev.map((item) =>
        item.id === bill.id
          ? { ...item, active: nextActive, updatedAt: new Date().toISOString() }
          : item
      )
    );

    try {
      const { error } = await supabase
        .from("bills")
        .update({
          active: nextActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bill.id)
        .eq("user_id", user.id);

      if (error) throw error;
    } catch (err) {
      setBills(previous);
      setPageError(err?.message || "Failed to update bill.");
    }
  }

  async function markPaidToday(bill) {
    if (!user) return;

    const previous = bills;
    const nextDate = todayISO();

    setBills((prev) =>
      prev.map((item) =>
        item.id === bill.id
          ? { ...item, lastPaidDate: nextDate, updatedAt: new Date().toISOString() }
          : item
      )
    );

    try {
      const { error } = await supabase
        .from("bills")
        .update({
          last_paid_date: nextDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bill.id)
        .eq("user_id", user.id);

      if (error) throw error;
    } catch (err) {
      setBills(previous);
      setPageError(err?.message || "Failed to mark bill as paid.");
    }
  }

  async function deleteBill(id) {
    if (!user) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this bill?")) return;

    const previous = bills;
    setBills((prev) => prev.filter((bill) => bill.id !== id));

    try {
      const { error } = await supabase
        .from("bills")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    } catch (err) {
      setBills(previous);
      setPageError(err?.message || "Failed to delete bill.");
    }
  }

  if (loading) {
    return (
      <main className="billsPage">
        <div className="billsPageShell">
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

  if (!user) {
    return (
      <main className="billsPage">
        <div className="billsPageShell">
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
              Please log in
            </div>
          </GlassPane>
        </div>
        <style jsx global>{globalStyles}</style>
      </main>
    );
  }

  return (
    <>
      <main className="billsPage">
        <div className="billsPageShell">
          {pageError ? (
            <GlassPane tone="red" size="card">
              <div style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>
                Bills error
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: "rgba(255,255,255,0.74)",
                }}
              >
                {pageError}
              </div>
            </GlassPane>
          ) : null}

          <GlassPane size="card">
            <div className="billsHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div className="billsEyebrow">Life Command Center</div>
                <div className="billsHeroTitle">Bills Command</div>
                <div className="billsHeroSub">
                  Cleaner bill pressure, tighter controls, and a roster layout that runs
                  much closer to the accounts page.
                </div>

                <div className="billsPillRow">
                  <MiniPill>{bills.length} bills</MiniPill>
                  <MiniPill>{currentMonthLabel()}</MiniPill>
                  <MiniPill>{controllableBills.length} debt accounts</MiniPill>
                  <MiniPill>{fixedBills.length} fixed bills</MiniPill>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                <MiniPill>{todayISO()}</MiniPill>
                <MiniPill tone="green">{money(monthlyPressure)} monthly</MiniPill>
                <MiniPill tone={overdueCount > 0 ? "red" : "amber"}>
                  {dueSoonBills.length} due soon
                </MiniPill>
              </div>
            </div>
          </GlassPane>

          <section className="billsMetricGrid">
            <StatCard
              icon={BadgeDollarSign}
              label="Monthly Pressure"
              value={money(monthlyPressure)}
              detail="Normalized monthly hit from active bills and debt payments."
              tone="neutral"
            />
            <StatCard
              icon={CreditCard}
              label="Total Debt"
              value={money(totalDebt)}
              detail="Active controllable balances only."
              tone={totalDebt > 0 ? "red" : "green"}
            />
            <StatCard
              icon={AlertTriangle}
              label="Due Soon"
              value={String(dueSoonBills.length)}
              detail={
                overdueCount > 0
                  ? `${overdueCount} overdue right now.`
                  : "Nothing overdue right now."
              }
              tone={overdueCount > 0 ? "red" : "amber"}
            />
            <StatCard
              icon={PiggyBank}
              label="Highest Pressure"
              value={strongestPressure ? money(monthlyEquivalent(strongestPressure)) : "$0"}
              detail={strongestPressure ? strongestPressure.name : "No active bills yet."}
              tone="green"
            />
          </section>

          <section className="billsMainGrid">
            <GlassPane size="card">
              <PaneHeader
                title="Bill Roster"
                subcopy="Compact list on the left. Work the selected bill on the right."
                right={<MiniPill>{filteredBills.length} showing</MiniPill>}
              />

              <div className="billsRosterControls">
                <div className="billsSearchWrap">
                  <Search size={15} />
                  <input
                    className="billsField billsSearchField"
                    placeholder="Search bills"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="billsField"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All bills</option>
                  <option value="active">Active only</option>
                  <option value="paused">Paused</option>
                  <option value="controllable">Debt only</option>
                  <option value="noncontrollable">Fixed only</option>
                  <option value="due">Due in 7 days</option>
                </select>

                <select
                  className="billsField"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="due">Due first</option>
                  <option value="pressure">Highest pressure</option>
                  <option value="updated">Recently updated</option>
                  <option value="name">Name</option>
                </select>
              </div>

              {filteredBills.length ? (
                <div className="billsRosterListCompact">
                  {filteredBills.map((bill) => (
                    <CompactBillRow
                      key={bill.id}
                      bill={bill}
                      selected={bill.id === selectedBill?.id}
                      onSelect={() => setSelectedBillId(bill.id)}
                      onMarkPaid={() => markPaidToday(bill)}
                      onToggle={() => toggleActive(bill)}
                      onDelete={() => deleteBill(bill.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="billsEmptyState">
                  <div>
                    <div className="billsEmptyTitle">No bills found</div>
                    <div className="billsEmptyText">
                      Clear filters or add another bill.
                    </div>
                  </div>
                </div>
              )}
            </GlassPane>

            <div className="billsRightStack">
              <div className="billsTopRightGrid">
                <FocusBillCard
                  bill={selectedBill}
                  linkedAccount={linkedAccount}
                  payoffData={selectedPayoff}
                  onMarkPaid={() => selectedBill && markPaidToday(selectedBill)}
                  onToggle={() => selectedBill && toggleActive(selectedBill)}
                  onDelete={() => selectedBill && deleteBill(selectedBill.id)}
                />

                <AddBillCard
                  saving={saving}
                  accounts={accounts}
                  formType={formType}
                  setFormType={setFormType}
                  formName={formName}
                  setFormName={setFormName}
                  formFrequency={formFrequency}
                  setFormFrequency={setFormFrequency}
                  formDueDate={formDueDate}
                  setFormDueDate={setFormDueDate}
                  formAmount={formAmount}
                  setFormAmount={setFormAmount}
                  formCategory={formCategory}
                  setFormCategory={setFormCategory}
                  formNotes={formNotes}
                  setFormNotes={setFormNotes}
                  formAccountId={formAccountId}
                  setFormAccountId={setFormAccountId}
                  formBalance={formBalance}
                  setFormBalance={setFormBalance}
                  formAprPct={formAprPct}
                  setFormAprPct={setFormAprPct}
                  formMinPay={formMinPay}
                  setFormMinPay={setFormMinPay}
                  formExtraPay={formExtraPay}
                  setFormExtraPay={setFormExtraPay}
                  formAutopay={formAutopay}
                  setFormAutopay={setFormAutopay}
                  addBill={addBill}
                  resetForm={resetForm}
                />
              </div>

              <GlassPane size="card">
                <PaneHeader
                  title="Bills Intel"
                  subcopy="Upcoming actions and controllable payoff view in one tighter block."
                />

                <div className="billsIntelGrid">
                  <div className="billsIntelPanel">
                    <PaneHeader
                      title="Action Queue"
                      subcopy="What needs touching next."
                      right={
                        <MiniPill>
                          {dueSoonBills.length} item{dueSoonBills.length === 1 ? "" : "s"}
                        </MiniPill>
                      }
                    />

                    {dueSoonBills.length ? (
                      <div className="billsIntelList">
                        {dueSoonBills.slice(0, 5).map((bill) => (
                          <QueueItem
                            key={bill.id}
                            bill={bill}
                            onFocus={() => setSelectedBillId(bill.id)}
                            onMarkPaid={() => markPaidToday(bill)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="billsEmptyState billsInlineEmpty">
                        <div>
                          <div className="billsEmptyTitle">Nothing due soon</div>
                          <div className="billsEmptyText">
                            No active bills are due in the next 14 days.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="billsIntelPanel">
                    <PaneHeader
                      title="Debt Forecast"
                      subcopy="Compact payoff stack for controllable balances."
                      right={
                        <MiniPill>
                          {payoffRows.length} item{payoffRows.length === 1 ? "" : "s"}
                        </MiniPill>
                      }
                    />

                    {payoffRows.length ? (
                      <div className="billsIntelList">
                        {payoffRows.slice(0, 5).map((row) => (
                          <PayoffItem
                            key={row.id}
                            row={row}
                            onFocus={() => setSelectedBillId(row.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="billsEmptyState billsInlineEmpty billsForecastEmpty">
                        <div>
                          <div className="billsEmptyTitle">No debt forecast yet</div>
                          <div className="billsEmptyText">
                            Add a controllable bill on the right and payoff timing will show here.
                          </div>
                          <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                            <MiniPill>0 controllable bills</MiniPill>
                            <MiniPill tone="amber">Waiting on debt data</MiniPill>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </GlassPane>
            </div>
          </section>
        </div>
      </main>

      <style jsx global>{globalStyles}</style>
    </>
  );
}

const globalStyles = `
  .billsPage {
    color: var(--lcc-text);
    font-family: var(--lcc-font-sans);
  }

  .billsPageShell {
    width: min(100%, 1320px);
    margin: 0 auto;
    padding: 12px 0 20px;
    display: grid;
    gap: 12px;
  }

  .billsEyebrow {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .22em;
    font-weight: 800;
    color: rgba(255,255,255,0.42);
  }

  .billsHeroTitle {
    margin-top: 8px;
    font-size: clamp(24px, 3.2vw, 34px);
    line-height: 1.02;
    font-weight: 850;
    letter-spacing: -0.05em;
    color: #fff;
  }

  .billsHeroSub {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.55;
    color: rgba(255,255,255,0.62);
    max-width: 760px;
  }

  .billsHeroGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) auto;
    gap: 12px;
    align-items: start;
  }

  .billsPillRow {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .billsMetricGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .billsMainGrid {
    display: grid;
    grid-template-columns: minmax(390px, 0.94fr) minmax(0, 1.06fr);
    gap: 12px;
    align-items: start;
  }

  .billsRightStack {
    display: grid;
    gap: 12px;
  }

  .billsTopRightGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.04fr) minmax(320px, 0.8fr);
    gap: 12px;
    align-items: start;
  }

  .billsRosterControls {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr 0.9fr;
    gap: 10px;
    margin-bottom: 10px;
  }

  .billsSearchWrap {
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

  .billsSearchField {
    min-height: 42px !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
  }

  .billsRosterListCompact {
    display: grid;
    gap: 8px;
    max-height: 650px;
    overflow: auto;
    padding-right: 2px;
  }

  .billsCompactRow {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto auto;
    gap: 10px;
    align-items: center;
    min-height: 84px;
    padding: 10px 12px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.07);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .billsCompactRow:hover {
    transform: translateY(-1px);
  }

  .billsCompactAvatar {
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

  .billsCompactTitle {
    font-size: 13.5px;
    font-weight: 800;
    color: #fff;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .billsCompactSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.3;
  }

  .billsCompactValue {
    font-size: 15px;
    font-weight: 850;
    color: #fff;
    white-space: nowrap;
  }

  .billsCompactActions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .billsIconBtn {
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

  .billsDangerBtn {
    border-color: rgba(255,132,163,0.18);
    color: #ffd3df;
  }

  .billsFocusBox {
    border-radius: 22px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
    padding: 15px;
  }

  .billsInfoGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .billsInfoCell {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.025);
    padding: 11px;
  }

  .billsInfoValue {
    font-size: 0.96rem;
    font-weight: 900;
    line-height: 1.15;
    color: #fff;
  }

  .billsInfoSub {
    margin-top: 5px;
    color: rgba(255,255,255,0.62);
    font-size: 0.79rem;
    line-height: 1.4;
  }

  .billsProgress {
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255,255,255,0.1);
  }

  .billsProgressFill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.4s ease;
  }

  .billsActionGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .billsActionGridTight {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .billsFormStack {
    display: grid;
    gap: 12px;
  }

  .billsFormGrid2,
  .billsFormGrid3,
  .billsFormGrid4 {
    display: grid;
    gap: 10px;
  }

  .billsFormGrid2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .billsFormGrid3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .billsFormGrid4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .billsTinyLabel {
    display: block;
    margin-bottom: 8px;
    font-size: 10px;
    color: rgba(255,255,255,0.46);
    text-transform: uppercase;
    letter-spacing: .16em;
    font-weight: 800;
  }

  .billsField {
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

  .billsField:focus {
    border-color: rgba(143,177,255,0.30);
    box-shadow:
      0 0 0 4px rgba(79,114,255,0.08),
      inset 0 1px 0 rgba(255,255,255,0.035);
  }

  .billsField::placeholder {
    color: rgba(225,233,245,0.38);
  }

  .billsField option {
    background: #08111f;
    color: #f4f7ff;
  }

  textarea.billsField {
    min-height: 96px;
    resize: vertical;
    padding: 12px 13px;
  }

  .billsCheck {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: rgba(255,255,255,0.72);
    font-size: 0.86rem;
    font-weight: 700;
  }

  .billsActionBtn {
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

  .billsActionBtn:hover {
    transform: translateY(-1px);
  }

  .billsIntelGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .billsIntelPanel {
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.06);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.58), rgba(4,8,16,0.42));
    padding: 12px;
    min-height: 100%;
  }

  .billsIntelList {
    display: grid;
    gap: 10px;
    max-height: 360px;
    overflow: auto;
    padding-right: 2px;
  }

  .billsIntelItem {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.07);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    padding: 12px;
    display: grid;
    gap: 10px;
  }

  .billsIntelTitle {
    font-size: 13px;
    font-weight: 800;
    color: #fff;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .billsIntelSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.35;
  }

  .billsIntelValue {
    font-size: 14px;
    font-weight: 850;
    color: #fff;
  }

  .billsEmptyState {
    min-height: 150px;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 14px;
  }

  .billsInlineEmpty {
    min-height: 260px;
  }

  .billsForecastEmpty {
    border-radius: 18px;
    border: 1px dashed rgba(214,226,255,0.12);
    background: rgba(255,255,255,0.02);
  }

  .billsEmptyTitle {
    font-size: 16px;
    font-weight: 850;
    color: #fff;
  }

  .billsEmptyText {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.5;
    color: rgba(255,255,255,0.60);
    max-width: 360px;
  }

  @media (max-width: 1260px) {
    .billsMetricGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .billsTopRightGrid,
    .billsIntelGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 1100px) {
    .billsHeroGrid,
    .billsMainGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 1024px) {
    .billsRosterControls,
    .billsInfoGrid,
    .billsFormGrid2,
    .billsFormGrid3,
    .billsFormGrid4,
    .billsActionGrid,
    .billsActionGridTight {
      grid-template-columns: 1fr;
    }

    .billsCompactRow {
      grid-template-columns: 42px minmax(0, 1fr);
    }

    .billsCompactValue {
      white-space: normal;
    }

    .billsCompactActions {
      grid-column: 2;
      justify-content: flex-start;
    }
  }

  @media (max-width: 760px) {
    .billsPageShell {
      padding: 8px 0 14px;
    }

    .billsMetricGrid,
    .billsTopRightGrid,
    .billsIntelGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .billsMetricGrid,
    .billsActionGrid,
    .billsActionGridTight {
      grid-template-columns: 1fr;
    }
  }
`;