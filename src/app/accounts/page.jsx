"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  ChevronRight,
  CreditCard,
  History,
  Landmark,
  MoreHorizontal,
  PencilLine,
  PiggyBank,
  Plus,
  Search,
  Star,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../components/GlassPane";

function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function nowTs() {
  return Date.now();
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function round2(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function normalizeLooseText(value = "") {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function fmtMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return round2(num).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtMoneyTight(n) {
  return fmtMoney(n);
}

function fmtMoneySigned(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";

  const abs = Math.abs(round2(num)).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (num > 0) return `+${abs}`;
  if (num < 0) return `−${abs}`;
  return abs;
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

function shortDate(dateValue) {
  if (!dateValue) return "—";
  const d = String(dateValue).includes("T")
    ? new Date(dateValue)
    : new Date(`${String(dateValue).slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeType(type) {
  return String(type || "other").toLowerCase().trim();
}

function isCreditType(type) {
  return normalizeType(type) === "credit";
}

function isLiquidType(type) {
  const t = normalizeType(type);
  return t === "checking" || t === "savings" || t === "cash";
}

function isInvestmentType(type) {
  return normalizeType(type) === "investment";
}

function typeLabel(t) {
  const v = normalizeType(t);
  if (v === "checking") return "Checking";
  if (v === "savings") return "Savings";
  if (v === "cash") return "Cash";
  if (v === "credit") return "Credit Card";
  if (v === "investment") return "Investment";
  return "Other";
}

function typeTone(type) {
  const t = normalizeType(type);
  if (t === "savings") return "green";
  if (t === "cash") return "amber";
  if (t === "credit") return "red";
  return "neutral";
}

function typeEmoji(type) {
  const t = normalizeType(type);
  if (t === "checking") return "🏦";
  if (t === "savings") return "💰";
  if (t === "cash") return "💵";
  if (t === "credit") return "💳";
  if (t === "investment") return "📈";
  return "📁";
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

function initialsFromLabel(label = "") {
  const clean = String(label).trim();
  if (!clean) return "—";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function transactionLabel(kind) {
  const k = String(kind || "").toLowerCase();

  if (k === "deposit") return "Deposit";
  if (k === "withdraw") return "Withdraw";
  if (k === "payment") return "Payment";
  if (k === "charge") return "Charge";
  if (k === "transfer_in") return "Transfer In";
  if (k === "transfer_out") return "Transfer Out";
  if (k === "payment_in") return "Payment Applied";
  if (k === "advance_out") return "Credit Advance";
  if (k === "balance_transfer_out") return "Balance Transfer Out";
  if (k === "balance_transfer_in") return "Balance Transfer In";
  if (k === "set") return "Set Balance";
  if (k === "create") return "Account Created";
  return "Transaction";
}

function transactionTone(kind) {
  const k = String(kind || "").toLowerCase();

  if (
    ["deposit", "transfer_in", "payment", "payment_in", "balance_transfer_out"].includes(k)
  ) {
    return "green";
  }

  if (
    ["withdraw", "charge", "transfer_out", "advance_out", "balance_transfer_in"].includes(k)
  ) {
    return "red";
  }

  if (["set", "create"].includes(k)) return "amber";
  return "neutral";
}

function resolveSpendingCategoryLabel(row) {
  return (
    row.category_name ||
    row.category_label ||
    row.category ||
    (row.category_id ? `Category ${row.category_id}` : "") ||
    row.merchant ||
    row.payment_method ||
    "Uncategorized"
  );
}

function isExpenseLikeSpending(row) {
  const t = String(row.type || "expense").toLowerCase().trim();
  if (t === "income") return false;
  if (t === "transfer") return false;
  return safeNum(row.amount, 0) > 0;
}

function mapAccountRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "",
    type: row.account_type || "other",
    balance: round2(safeNum(row.balance, 0)),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : nowTs(),
  };
}

function mapAccountClientToRow(account, userId) {
  return {
    id: account.id,
    user_id: userId,
    name: account.name || "",
    account_type: account.type || "other",
    balance: round2(safeNum(account.balance, 0)),
    updated_at: new Date(account.updatedAt || nowTs()).toISOString(),
  };
}

function mapLedgerRowToClient(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    ts: row.created_at ? new Date(row.created_at).getTime() : nowTs(),
    kind: row.kind || "transaction",
    amount: round2(safeNum(row.amount, 0)),
    delta: round2(safeNum(row.delta, 0)),
    resultingBalance: round2(safeNum(row.resulting_balance, 0)),
    note: row.note || "",
    relatedAccountId: row.related_account_id || "",
    relatedAccountName: row.related_account_name || "",
  };
}

function mapLedgerClientToRow(entry, userId) {
  return {
    id: entry.id,
    user_id: userId,
    account_id: entry.accountId,
    kind: entry.kind || "transaction",
    amount: round2(safeNum(entry.amount, 0)),
    delta: round2(safeNum(entry.delta, 0)),
    resulting_balance: round2(safeNum(entry.resultingBalance, 0)),
    note: entry.note || "",
    related_account_id: entry.relatedAccountId || null,
    related_account_name: entry.relatedAccountName || "",
    created_at: new Date(entry.ts || nowTs()).toISOString(),
  };
}

function mapSpendingRowToClient(row) {
  const rawDate = row.tx_date || row.date || row.created_at || null;
  const ts = rawDate
    ? String(rawDate).includes("T")
      ? new Date(rawDate).getTime()
      : new Date(`${rawDate}T12:00:00`).getTime()
    : nowTs();

  return {
    id: row.id,
    ts: Number.isFinite(ts) ? ts : nowTs(),
    txDate: row.tx_date || row.date || row.created_at || "",
    type: row.type || "expense",
    amount: round2(Math.abs(safeNum(row.amount, 0))),
    merchant: row.merchant || row.payee || row.description || "Spending",
    note: row.note || "",
    accountId: row.account_id || row.accountId || "",
    accountName: row.account_name || row.accountName || "",
    categoryLabel: resolveSpendingCategoryLabel(row),
    categoryKey: String(
      row.category_id ||
        row.category_name ||
        row.category_label ||
        row.category ||
        "uncategorized"
    ),
    paymentMethod: row.payment_method || "",
  };
}

function mapBillRowToClient(row) {
  return {
    id: row.id,
    name: row.name || row.title || row.label || row.source || "Bill",
    amount: round2(safeNum(row.amount, 0)),
    dueDate: row.due_date || row.next_due_date || "",
    lastPaidDate: row.last_paid_date || "",
    category: row.category || "",
    accountId: row.account_id || row.accountId || "",
    accountName: row.account_name || row.accountName || "",
    autopay: !!row.autopay,
    active: row.active !== false,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : nowTs(),
  };
}

function spendingMatchesAccount(tx, account) {
  if (!tx || !account) return false;

  if (tx.accountId && account.id) {
    return String(tx.accountId) === String(account.id);
  }

  if (tx.accountName && account.name) {
    return normalizeLooseText(tx.accountName) === normalizeLooseText(account.name);
  }

  return false;
}

function billMatchesAccount(bill, account) {
  if (!bill || !account) return false;

  if (bill.accountId && account.id) {
    return String(bill.accountId) === String(account.id);
  }

  if (bill.accountName && account.name) {
    return normalizeLooseText(bill.accountName) === normalizeLooseText(account.name);
  }

  return false;
}

function getAdjustDelta(accountType, mode, absAmount) {
  const amount = Math.abs(round2(safeNum(absAmount, 0)));
  if (isCreditType(accountType)) {
    return mode === "decrease" ? -amount : amount;
  }
  return mode === "decrease" ? -amount : amount;
}

function getAdjustKind(accountType, mode) {
  if (isCreditType(accountType)) {
    return mode === "decrease" ? "payment" : "charge";
  }
  return mode === "decrease" ? "withdraw" : "deposit";
}

function getTransferPlan(fromAccount, toAccount, amount) {
  const absAmount = Math.abs(round2(safeNum(amount, 0)));
  const fromIsCredit = isCreditType(fromAccount?.type);
  const toIsCredit = isCreditType(toAccount?.type);

  if (!fromIsCredit && !toIsCredit) {
    return {
      fromDelta: -absAmount,
      toDelta: absAmount,
      fromKind: "transfer_out",
      toKind: "transfer_in",
    };
  }

  if (!fromIsCredit && toIsCredit) {
    return {
      fromDelta: -absAmount,
      toDelta: -absAmount,
      fromKind: "transfer_out",
      toKind: "payment_in",
    };
  }

  if (fromIsCredit && !toIsCredit) {
    return {
      fromDelta: absAmount,
      toDelta: absAmount,
      fromKind: "advance_out",
      toKind: "transfer_in",
    };
  }

  return {
    fromDelta: -absAmount,
    toDelta: absAmount,
    fromKind: "balance_transfer_out",
    toKind: "balance_transfer_in",
  };
}

function daysUntilDate(dateValue) {
  if (!dateValue) return null;
  const target = new Date(`${String(dateValue).slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function rangeMatches(ts, range) {
  const time = safeNum(ts, 0);
  if (!time) return false;

  const now = new Date();
  const nowMs = now.getTime();

  if (range === "all") return true;
  if (range === "30") return time >= nowMs - 30 * 86400000;
  if (range === "90") return time >= nowMs - 90 * 86400000;

  const d = new Date(time);
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
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
      className="accountsActionBtn"
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

function MenuItem({ icon: Icon, children, onClick, danger = false }) {
  return (
    <button
      type="button"
      className={`accountsMenuItem ${danger ? "danger" : ""}`}
      onClick={onClick}
    >
      <Icon size={14} />
      {children}
    </button>
  );
}

function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  width = 760,
  tone = "neutral",
  chrome = "default",
}) {
  if (!open) return null;

  const meta = toneMeta(tone);

  return (
    <div className="accountsModalRoot">
      <div
        className={`accountsModalBackdrop ${chrome === "command" ? "command" : ""}`}
        onClick={onClose}
      />
      <div
        className={`accountsModalCard ${chrome === "command" ? "accountsModalCardCommand" : ""}`}
        style={{ width: `min(100%, ${width}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <GlassPane tone={tone} size="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className={`accountsModalInner ${chrome === "command" ? "command" : ""}`}>
            <div className="accountsModalTopGlow" />
            <div className="accountsModalHeader">
              <div className="accountsModalHeaderText">
                <div className="accountsModalTitle">{title}</div>
                {subtitle ? <div className="accountsModalSubtitle">{subtitle}</div> : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="accountsIconBtn accountsIconBtnSoft"
                style={{ flexShrink: 0 }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              className="accountsModalDivider"
              style={{
                background: `linear-gradient(90deg, transparent, ${meta.border}, transparent)`,
              }}
            />

            <div className="accountsModalBody">{children}</div>
          </div>
        </GlassPane>
      </div>
    </div>
  );
}

function CompactAccountRow({
  account,
  selected,
  primary,
  menuOpen,
  onSelect,
  onToggleMenu,
  onViewSpending,
  onEdit,
  onSetPrimary,
  onDelete,
}) {
  const tone = typeTone(account.type);
  const meta = toneMeta(tone);

  return (
    <div
      className="accountsCompactRow"
      onClick={onSelect}
      style={{
        borderColor: selected ? meta.border : "rgba(255,255,255,0.07)",
        boxShadow: selected
          ? `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(255,255,255,0.01), 0 0 24px ${meta.glow}`
          : "inset 0 1px 0 rgba(255,255,255,0.025)",
      }}
    >
      <div
        className="accountsCompactAvatar"
        style={{
          borderColor: meta.border,
          color: tone === "neutral" ? "#fff" : meta.text,
          boxShadow: `0 0 12px ${meta.glow}`,
        }}
      >
        {initialsFromLabel(account.name)}
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
          <div className="accountsCompactTitle">{account.name}</div>
          {primary ? <MiniPill>Primary</MiniPill> : null}
          <MiniPill tone={tone}>
            {typeEmoji(account.type)} {typeLabel(account.type)}
          </MiniPill>
        </div>

        <div className="accountsCompactSub">Updated {fmtWhen(account.updatedAt)}</div>
      </div>

      <div className="accountsCompactValue">{fmtMoney(account.balance)}</div>

      <div
        className="accountsMenuWrap"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <button
          type="button"
          className="accountsIconBtn"
          onClick={onToggleMenu}
          aria-label="More actions"
          title="More actions"
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen ? (
          <div className="accountsMenuPanel">
            <MenuItem icon={History} onClick={onViewSpending}>
              Spending History
            </MenuItem>
            <MenuItem icon={PencilLine} onClick={onEdit}>
              Edit Account
            </MenuItem>
            <MenuItem icon={Star} onClick={onSetPrimary}>
              Set Primary
            </MenuItem>
            <MenuItem icon={Trash2} danger onClick={onDelete}>
              Delete
            </MenuItem>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FocusCard({
  selectedAccount,
  primaryId,
  linkedBills,
  spendMonth,
  spend30,
  ledgerHealth,
  focusMenuOpen,
  setFocusMenuOpen,
  onAdjust,
  onTransfer,
  onOpenSpend,
  onSetExact,
  onEdit,
  onSetPrimary,
  onDelete,
}) {
  if (!selectedAccount) {
    return (
      <GlassPane size="card">
        <PaneHeader
          title="Selected Account"
          subcopy="Choose one from the roster to work it here."
        />
        <div className="accountsEmptyState" style={{ minHeight: 260 }}>
          <div>
            <div className="accountsEmptyTitle">No account selected</div>
            <div className="accountsEmptyText">
              Pick one from the roster on the left.
            </div>
          </div>
        </div>
      </GlassPane>
    );
  }

  const tone = typeTone(selectedAccount.type);
  const meta = toneMeta(tone);
  const isCredit = isCreditType(selectedAccount.type);

  const activeBills = linkedBills.filter((bill) => bill.active);
  const autopayBills = activeBills.filter((bill) => bill.autopay);
  const autopayTotal = autopayBills.reduce((sum, bill) => sum + safeNum(bill.amount, 0), 0);

  const nextBill = [...activeBills]
    .filter((bill) => bill.dueDate)
    .sort(
      (a, b) =>
        new Date(`${String(a.dueDate).slice(0, 10)}T12:00:00`).getTime() -
        new Date(`${String(b.dueDate).slice(0, 10)}T12:00:00`).getTime()
    )[0];

  return (
    <GlassPane tone={tone} size="card" style={{ height: "100%" }}>
      <PaneHeader
        title={selectedAccount.name}
        subcopy="Focused controls and account-specific money intel."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {selectedAccount.id === primaryId ? <MiniPill>Primary</MiniPill> : null}
            <MiniPill tone={tone}>
              {typeEmoji(selectedAccount.type)} {typeLabel(selectedAccount.type)}
            </MiniPill>

            <div
              className="accountsMenuWrap"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <button
                type="button"
                className="accountsIconBtn"
                onClick={() => setFocusMenuOpen((prev) => !prev)}
                aria-label="More actions"
                title="More actions"
              >
                <MoreHorizontal size={14} />
              </button>

              {focusMenuOpen ? (
                <div className="accountsMenuPanel accountsMenuPanelRight">
                  <MenuItem
                    icon={Landmark}
                    onClick={() => {
                      setFocusMenuOpen(false);
                      onSetExact();
                    }}
                  >
                    Set Exact Balance
                  </MenuItem>
                  <MenuItem
                    icon={PencilLine}
                    onClick={() => {
                      setFocusMenuOpen(false);
                      onEdit();
                    }}
                  >
                    Edit Account
                  </MenuItem>
                  <MenuItem
                    icon={Star}
                    onClick={() => {
                      setFocusMenuOpen(false);
                      onSetPrimary();
                    }}
                  >
                    Set Primary
                  </MenuItem>
                  <MenuItem
                    icon={Trash2}
                    danger
                    onClick={() => {
                      setFocusMenuOpen(false);
                      onDelete();
                    }}
                  >
                    Delete
                  </MenuItem>
                </div>
              ) : null}
            </div>
          </div>
        }
      />

      <div className="accountsFocusBox">
        <div className="accountsTinyLabel">
          {isCredit ? "Amount Owed" : "Current Balance"}
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
          {fmtMoney(selectedAccount.balance)}
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "rgba(255,255,255,0.58)",
          }}
        >
          Updated {fmtWhen(selectedAccount.updatedAt)}
        </div>

        <div className="accountsInfoGrid" style={{ marginTop: 14 }}>
          <div className="accountsInfoCell">
            <div className="accountsTinyLabel">Spent This Month</div>
            <div className="accountsInfoValue">{fmtMoney(spendMonth)}</div>
            <div className="accountsInfoSub">Account-specific spending only</div>
          </div>

          <div className="accountsInfoCell">
            <div className="accountsTinyLabel">Spent Last 30 Days</div>
            <div className="accountsInfoValue">{fmtMoney(spend30)}</div>
            <div className="accountsInfoSub">Rolling outflow view</div>
          </div>

          <div className="accountsInfoCell">
            <div className="accountsTinyLabel">Autopay Load</div>
            <div className="accountsInfoValue">
              {autopayBills.length} bill{autopayBills.length === 1 ? "" : "s"} •{" "}
              {fmtMoney(autopayTotal)}
            </div>
            <div className="accountsInfoSub">
              {nextBill ? `Next due ${shortDate(nextBill.dueDate)}` : "No due bill found"}
            </div>
          </div>

          <div className="accountsInfoCell">
            <div className="accountsTinyLabel">Ledger Math</div>
            <div className="accountsInfoValue">
              {ledgerHealth.hasLedger
                ? ledgerHealth.aligned
                  ? "Aligned"
                  : `${fmtMoney(Math.abs(ledgerHealth.diff))} off`
                : "No ledger yet"}
            </div>
            <div className="accountsInfoSub">
              {ledgerHealth.hasLedger
                ? `Ledger says ${fmtMoney(ledgerHealth.latestBalance)}`
                : "Create, transfer, spend, and income writes should land in the ledger"}
            </div>
          </div>
        </div>

        <div className="accountsActionGridTriplet" style={{ marginTop: 14 }}>
          <ActionBtn variant="primary" onClick={onAdjust} full>
            <Wallet size={14} /> Add Transaction
          </ActionBtn>
          <ActionBtn onClick={onTransfer} full>
            <ArrowRightLeft size={14} /> Transfer
          </ActionBtn>
          <ActionBtn onClick={onOpenSpend} full>
            <History size={14} /> Spending History
          </ActionBtn>
        </div>
      </div>
    </GlassPane>
  );
}

function AddAccountLauncherCard({
  onOpen,
  totalAccounts,
  primaryName,
  liquidTotal,
  creditExposure,
}) {
  return (
    <GlassPane size="card" style={{ alignSelf: "start" }}>
      <div className="accountsLauncherCard">
        <div className="accountsLauncherTop">
          <div className="accountsLauncherIcon">
            <Plus size={16} />
          </div>
          <MiniPill>Quick create</MiniPill>
        </div>

        <div className="accountsLauncherTitle">Add Account</div>
        <div className="accountsLauncherSub">
          Keep creation tucked away until you need it. Open a tighter modal instead of
          letting a form permanently take over the page.
        </div>

        <div className="accountsLauncherStatGrid">
          <div className="accountsLauncherStat">
            <div className="accountsTinyLabel">Accounts</div>
            <div className="accountsLauncherStatValue">{totalAccounts}</div>
          </div>

          <div className="accountsLauncherStat">
            <div className="accountsTinyLabel">Primary</div>
            <div className="accountsLauncherStatValue accountsLauncherStatValueSmall">
              {primaryName || "Not set"}
            </div>
          </div>

          <div className="accountsLauncherStat">
            <div className="accountsTinyLabel">Liquid</div>
            <div className="accountsLauncherStatValue accountsLauncherStatValueSmall">
              {fmtMoney(liquidTotal)}
            </div>
          </div>

          <div className="accountsLauncherStat">
            <div className="accountsTinyLabel">Credit</div>
            <div className="accountsLauncherStatValue accountsLauncherStatValueSmall">
              {fmtMoney(creditExposure)}
            </div>
          </div>
        </div>

        <ActionBtn variant="primary" onClick={onOpen} full>
          <Plus size={14} /> Add Account
        </ActionBtn>

        <div className="accountsFootnote">
          New accounts write a starting ledger entry automatically so the math stays clean.
        </div>
      </div>
    </GlassPane>
  );
}

function LedgerItem({ item }) {
  const tone = transactionTone(item.kind);
  const meta = toneMeta(tone);

  return (
    <div
      className="accountsLedgerItem"
      style={{
        borderColor: meta.border,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 12px ${meta.glow}`,
      }}
    >
      <div className="accountsLedgerGrid">
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <MiniPill tone={tone}>{transactionLabel(item.kind)}</MiniPill>
            {item.relatedAccountName ? <MiniPill>{item.relatedAccountName}</MiniPill> : null}
          </div>

          <div className="accountsLedgerTitle">{item.note || "No note"}</div>
          <div className="accountsLedgerSub">{fmtWhen(item.ts)}</div>
        </div>

        <div className="accountsLedgerRight">
          <div className="accountsLedgerLabel">Delta</div>
          <div
            style={{
              marginTop: 6,
              fontSize: 14,
              fontWeight: 850,
              color: tone === "neutral" ? "#fff" : meta.text,
            }}
          >
            {fmtMoneySigned(item.delta)}
          </div>
        </div>

        <div className="accountsLedgerRight">
          <div className="accountsLedgerLabel">Balance</div>
          <div
            style={{
              marginTop: 6,
              fontSize: 14,
              fontWeight: 850,
              color: "#fff",
            }}
          >
            {fmtMoney(item.resultingBalance)}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpendingGroupCard({ group }) {
  const largest = group.items.reduce(
    (max, item) => Math.max(max, safeNum(item.amount, 0)),
    0
  );

  return (
    <div className="accountsSpendGroup">
      <div className="accountsSpendGroupHeader">
        <div style={{ minWidth: 0 }}>
          <div className="accountsSpendGroupTitle">{group.label}</div>
          <div className="accountsSpendGroupSub">
            {group.count} transaction{group.count === 1 ? "" : "s"} • largest{" "}
            {fmtMoney(largest)}
          </div>
        </div>

        <MiniPill tone="green">{fmtMoney(group.total)}</MiniPill>
      </div>

      <div className="accountsSpendLineList">
        {group.items.map((item) => (
          <div key={item.id} className="accountsSpendLine">
            <div style={{ minWidth: 0 }}>
              <div className="accountsSpendLineTitle">{item.merchant || "Spending"}</div>
              <div className="accountsSpendLineSub">
                {shortDate(item.txDate)} •{" "}
                {item.note || item.paymentMethod || item.categoryLabel || "No detail"}
              </div>
            </div>

            <div className="accountsSpendLineAmount">{fmtMoney(item.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpendingHistoryModal({
  open,
  onClose,
  account,
  spendingItems,
  linkedBills,
  ledgerHealth,
  range,
  setRange,
  groupBy,
  setGroupBy,
  spendSearch,
  setSpendSearch,
  spendSort,
  setSpendSort,
}) {
  const filteredItems = useMemo(() => {
    const q = spendSearch.trim().toLowerCase();

    let list = spendingItems.filter((item) => rangeMatches(item.ts, range));

    if (q) {
      list = list.filter((item) =>
        [
          item.merchant,
          item.note,
          item.categoryLabel,
          item.paymentMethod,
          fmtMoney(item.amount),
          shortDate(item.txDate),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    if (spendSort === "amount") {
      list.sort((a, b) => safeNum(b.amount, 0) - safeNum(a.amount, 0));
      return list;
    }

    list.sort((a, b) => safeNum(b.ts, 0) - safeNum(a.ts, 0));
    return list;
  }, [spendingItems, range, spendSearch, spendSort]);

  const activeBills = useMemo(() => linkedBills.filter((bill) => bill.active), [linkedBills]);

  const autopayBills = useMemo(
    () => activeBills.filter((bill) => bill.autopay),
    [activeBills]
  );

  const autopayTotal = useMemo(
    () => autopayBills.reduce((sum, bill) => sum + safeNum(bill.amount, 0), 0),
    [autopayBills]
  );

  const nextAutopay = useMemo(() => {
    return [...autopayBills]
      .filter((bill) => bill.dueDate)
      .sort(
        (a, b) =>
          new Date(`${String(a.dueDate).slice(0, 10)}T12:00:00`).getTime() -
          new Date(`${String(b.dueDate).slice(0, 10)}T12:00:00`).getTime()
      )[0];
  }, [autopayBills]);

  const topBills = useMemo(() => {
    return [...activeBills]
      .sort(
        (a, b) =>
          new Date(`${String(a.dueDate || "9999-12-31").slice(0, 10)}T12:00:00`).getTime() -
          new Date(`${String(b.dueDate || "9999-12-31").slice(0, 10)}T12:00:00`).getTime()
      )
      .slice(0, 6);
  }, [activeBills]);

  const totals = useMemo(() => {
    const total = filteredItems.reduce((sum, item) => sum + safeNum(item.amount, 0), 0);
    const count = filteredItems.length;
    const avg = count ? round2(total / count) : 0;

    const merchants = new Set(
      filteredItems.map((item) => normalizeLooseText(item.merchant || "Spending"))
    );

    const grouped = new Map();
    filteredItems.forEach((item) => {
      const key = groupBy === "merchant" ? item.merchant || "Spending" : item.categoryLabel;
      grouped.set(key, round2((grouped.get(key) || 0) + safeNum(item.amount, 0)));
    });

    const topGroup = [...grouped.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      total,
      count,
      avg,
      merchants: merchants.size,
      topLabel: topGroup?.[0] || "—",
      topAmount: topGroup?.[1] || 0,
    };
  }, [filteredItems, groupBy]);

  const groupedItems = useMemo(() => {
    const map = new Map();

    filteredItems.forEach((item) => {
      const key = groupBy === "merchant" ? item.merchant || "Spending" : item.categoryLabel;
      const existing = map.get(key);

      if (existing) {
        existing.total = round2(existing.total + safeNum(item.amount, 0));
        existing.count += 1;
        existing.items.push(item);
      } else {
        map.set(key, {
          key,
          label: key,
          total: round2(safeNum(item.amount, 0)),
          count: 1,
          items: [item],
        });
      }
    });

    return [...map.values()]
      .map((group) => ({
        ...group,
        items:
          spendSort === "amount"
            ? [...group.items].sort((a, b) => safeNum(b.amount, 0) - safeNum(a.amount, 0))
            : [...group.items].sort((a, b) => safeNum(b.ts, 0) - safeNum(a.ts, 0)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredItems, groupBy, spendSort]);

  const accountTone = account ? typeTone(account.type) : "neutral";
  const balanceLabel = account && isCreditType(account.type) ? "Balance Owed" : "Current Balance";

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={1320}
      tone={accountTone}
      chrome="command"
      title={account ? `${account.name} Spending History` : "Spending History"}
      subtitle="A tighter command overlay for account-linked spending, grouped to the account you clicked."
    >
      <div className="accountsSpendModalStack">
        <div className="accountsSpendHeroShell">
          <div className="accountsSpendHeroHeader">
            <div style={{ minWidth: 0 }}>
              <div className="accountsEyebrow">Account spending lens</div>
              <div className="accountsSpendHeroTitle">
                {account ? account.name : "Spending History"}
              </div>
              <div className="accountsSpendHeroSub">
                Focused to one account so you can sanity-check real spending, linked bills,
                and ledger drift without leaving the page.
              </div>
            </div>

            <div className="accountsSpendHeroPills">
              {account ? (
                <MiniPill tone={accountTone}>
                  {typeEmoji(account.type)} {typeLabel(account.type)}
                </MiniPill>
              ) : null}
              {account ? (
                <MiniPill>
                  {balanceLabel} • {fmtMoney(account.balance)}
                </MiniPill>
              ) : null}
              <MiniPill tone={ledgerHealth.aligned ? "green" : "red"}>
                {ledgerHealth.hasLedger
                  ? ledgerHealth.aligned
                    ? "Ledger aligned"
                    : `${fmtMoney(Math.abs(ledgerHealth.diff))} drift`
                  : "No ledger yet"}
              </MiniPill>
            </div>
          </div>

          <div className="accountsSpendSummaryGrid accountsSpendSummaryGridCommand">
            <div className="accountsSpendHeroStat">
              <div className="accountsTinyLabel">Total Spent</div>
              <div className="accountsSpendHeroStatValue">{fmtMoney(totals.total)}</div>
              <div className="accountsInfoSub">
                {totals.count} transaction{totals.count === 1 ? "" : "s"} in this filtered view
              </div>
            </div>

            <div className="accountsSpendHeroStat">
              <div className="accountsTinyLabel">Top Group</div>
              <div className="accountsSpendHeroStatValue accountsSpendHeroStatValueText">
                {totals.topLabel}
              </div>
              <div className="accountsInfoSub">{fmtMoney(totals.topAmount)}</div>
            </div>

            <div className="accountsSpendHeroStat">
              <div className="accountsTinyLabel">Merchants</div>
              <div className="accountsSpendHeroStatValue">{totals.merchants}</div>
              <div className="accountsInfoSub">Unique merchants in the current filter</div>
            </div>

            <div className="accountsSpendHeroStat">
              <div className="accountsTinyLabel">Autopay Load</div>
              <div className="accountsSpendHeroStatValue">{fmtMoney(autopayTotal)}</div>
              <div className="accountsInfoSub">
                {autopayBills.length} autopay bill{autopayBills.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </div>

        <div className="accountsSpendControlShell">
          <div className="accountsSpendControls">
            <div className="accountsSearchWrap">
              <Search size={15} />
              <input
                className="accountsField accountsSearchField"
                placeholder="Search merchant, note, category"
                value={spendSearch}
                onChange={(e) => setSpendSearch(e.target.value)}
              />
            </div>

            <select
              className="accountsField"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              <option value="month">This month</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All history</option>
            </select>

            <select
              className="accountsField"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <option value="category">Group by category</option>
              <option value="merchant">Group by merchant</option>
            </select>

            <select
              className="accountsField"
              value={spendSort}
              onChange={(e) => setSpendSort(e.target.value)}
            >
              <option value="recent">Recent first</option>
              <option value="amount">Largest first</option>
            </select>
          </div>
        </div>

        <div className="accountsSpendContentGrid accountsSpendContentGridCommand">
          <div className="accountsSpendPrimaryPane">
            <div className="accountsSpendSectionHead">
              <div style={{ minWidth: 0 }}>
                <div className="accountsSpendSectionTitle">Grouped activity</div>
                <div className="accountsSpendSectionSub">
                  {groupedItems.length
                    ? `Grouped by ${groupBy === "category" ? "category" : "merchant"} so the biggest buckets rise first.`
                    : "Nothing hit this account and filter combination yet."}
                </div>
              </div>

              <MiniPill>
                {groupedItems.length} group{groupedItems.length === 1 ? "" : "s"}
              </MiniPill>
            </div>

            {groupedItems.length ? (
              <div className="accountsSpendGroupList accountsSpendGroupListCommand">
                {groupedItems.map((group) => (
                  <SpendingGroupCard key={group.key} group={group} />
                ))}
              </div>
            ) : (
              <div className="accountsSpendEmptyCard">
                <div className="accountsSpendEmptyIcon">
                  <History size={18} />
                </div>
                <div className="accountsEmptyTitle">No spending linked to this account yet</div>
                <div className="accountsEmptyText">
                  Nothing matched the selected range and account link. That usually means the
                  filter window is too tight, the spending rows are tied to another account,
                  or this account simply has no posted spending yet.
                </div>

                <div className="accountsSpendEmptyList">
                  <div>• Try Last 30 Days or All History.</div>
                  <div>• Check that spending rows carry this account ID or account name.</div>
                  <div>• Compare against the ledger on the main Accounts page if the math feels off.</div>
                </div>

                <div className="accountsSpendEmptyActions">
                  <ActionBtn onClick={() => setRange("all")}>Show All History</ActionBtn>
                  <ActionBtn
                    onClick={() =>
                      setGroupBy(groupBy === "category" ? "merchant" : "category")
                    }
                  >
                    {groupBy === "category" ? "Group by Merchant" : "Group by Category"}
                  </ActionBtn>
                </div>
              </div>
            )}
          </div>

          <div className="accountsSpendRail">
            <div className="accountsSpendRailCard accountsSpendRailCardStrong">
              <div className="accountsTinyLabel">{balanceLabel}</div>
              <div className="accountsSpendRailValue">
                {account ? fmtMoney(account.balance) : "—"}
              </div>
              <div className="accountsInfoSub">
                {account ? `${typeLabel(account.type)} account` : "No account selected"}
              </div>

              <div className="accountsSpendRailMetricGrid">
                <div className="accountsSpendRailMetric">
                  <div className="accountsTinyLabel">Average Ticket</div>
                  <div className="accountsSpendRailMetricValue">{fmtMoney(totals.avg)}</div>
                </div>

                <div className="accountsSpendRailMetric">
                  <div className="accountsTinyLabel">Ledger Math</div>
                  <div className="accountsSpendRailMetricValue">
                    {ledgerHealth.hasLedger
                      ? ledgerHealth.aligned
                        ? "Aligned"
                        : `${fmtMoney(Math.abs(ledgerHealth.diff))} off`
                      : "No ledger yet"}
                  </div>
                </div>

                <div className="accountsSpendRailMetric">
                  <div className="accountsTinyLabel">Linked Bills</div>
                  <div className="accountsSpendRailMetricValue">
                    {activeBills.length} active
                  </div>
                </div>

                <div className="accountsSpendRailMetric">
                  <div className="accountsTinyLabel">Next Autopay</div>
                  <div className="accountsSpendRailMetricValue">
                    {nextAutopay ? shortDate(nextAutopay.dueDate) : "None"}
                  </div>
                </div>
              </div>
            </div>

            <div className="accountsSpendRailCard">
              <div className="accountsSpendSectionHead accountsSpendSectionHeadTight">
                <div style={{ minWidth: 0 }}>
                  <div className="accountsSpendSectionTitle">Bills & Autopay</div>
                  <div className="accountsSpendSectionSub">
                    Bills tied to this account so you can check the money path fast.
                  </div>
                </div>

                <MiniPill>
                  {activeBills.length} linked
                </MiniPill>
              </div>

              {topBills.length ? (
                <div className="accountsMiniBillList accountsMiniBillListCommand">
                  {topBills.map((bill) => {
                    const days = daysUntilDate(bill.dueDate);

                    return (
                      <div key={bill.id} className="accountsMiniBillRow">
                        <div style={{ minWidth: 0 }}>
                          <div className="accountsMiniBillTitle">{bill.name}</div>
                          <div className="accountsMiniBillSub">
                            {shortDate(bill.dueDate)} • {bill.category || "No category"}
                          </div>
                        </div>

                        <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                          <MiniPill tone={bill.autopay ? "green" : "amber"}>
                            {bill.autopay ? "Autopay" : "Manual"}
                          </MiniPill>
                          <div className="accountsMiniBillAmount">{fmtMoney(bill.amount)}</div>
                          {days !== null ? (
                            <div className="accountsMiniBillDays">
                              {days === 0
                                ? "Due today"
                                : days > 0
                                ? `${days}d left`
                                : `${Math.abs(days)}d late`}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="accountsSpendRailEmpty">
                  <div className="accountsEmptyTitle" style={{ fontSize: 15 }}>
                    No linked bills
                  </div>
                  <div className="accountsEmptyText" style={{ maxWidth: "none" }}>
                    Bills need a matching account ID or account name to show here.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function AccountsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [status, setStatus] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [primaryId, setPrimaryId] = useState("");
  const [ledger, setLedger] = useState([]);
  const [spendingRows, setSpendingRows] = useState([]);
  const [bills, setBills] = useState([]);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState("updated");
  const [ledgerSearch, setLedgerSearch] = useState("");

  const [adding, setAdding] = useState({
    name: "",
    type: "checking",
    balance: "",
  });
  const [addingBusy, setAddingBusy] = useState(false);

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const selectedAccountIdRef = useRef("");

  const [rowMenuId, setRowMenuId] = useState("");
  const [focusMenuOpen, setFocusMenuOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("adjust");
  const [modalAccountId, setModalAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [adjustMode, setAdjustMode] = useState("increase");
  const [transferToId, setTransferToId] = useState("");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("checking");
  const [modalBusy, setModalBusy] = useState(false);

  const [spendModalOpen, setSpendModalOpen] = useState(false);
  const [spendModalAccountId, setSpendModalAccountId] = useState("");
  const [spendRange, setSpendRange] = useState("month");
  const [spendGroupBy, setSpendGroupBy] = useState("category");
  const [spendSearch, setSpendSearch] = useState("");
  const [spendSort, setSpendSort] = useState("recent");

  useEffect(() => {
    selectedAccountIdRef.current = selectedAccountId;
  }, [selectedAccountId]);

  useEffect(() => {
    if (!status) return undefined;
    const id = window.setTimeout(() => setStatus(""), 3200);
    return () => window.clearTimeout(id);
  }, [status]);

  const loadData = useCallback(async (userId, preferredSelectedId = "") => {
    if (!userId || !supabase) return;

    const [accRes, settingsRes, ledgerRes, spendingRes, billsRes] = await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),

      supabase
        .from("account_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),

      supabase
        .from("account_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),

      supabase
        .from("spending_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("tx_date", { ascending: false }),

      supabase
        .from("bills")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
    ]);

    if (accRes.error) throw accRes.error;
    if (settingsRes.error) throw settingsRes.error;
    if (ledgerRes.error) throw ledgerRes.error;
    if (spendingRes.error) throw spendingRes.error;
    if (billsRes.error) throw billsRes.error;

    const loadedAccounts = (accRes.data || []).map(mapAccountRowToClient);
    const loadedLedger = (ledgerRes.data || []).map(mapLedgerRowToClient);
    const loadedSpending = (spendingRes.data || [])
      .map(mapSpendingRowToClient)
      .filter(isExpenseLikeSpending);
    const loadedBills = (billsRes.data || []).map(mapBillRowToClient);

    const storedPrimary = settingsRes.data?.primary_account_id || "";

    const resolvedPrimary =
      storedPrimary && loadedAccounts.some((a) => a.id === storedPrimary)
        ? storedPrimary
        : loadedAccounts[0]?.id || "";

    if (resolvedPrimary && resolvedPrimary !== storedPrimary) {
      const healPrimary = await supabase.from("account_settings").upsert(
        {
          user_id: userId,
          primary_account_id: resolvedPrimary,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (healPrimary.error) {
        throw healPrimary.error;
      }
    }

    const fallbackSelected =
      preferredSelectedId ||
      selectedAccountIdRef.current ||
      resolvedPrimary ||
      loadedAccounts[0]?.id ||
      "";

    const resolvedSelected = loadedAccounts.some((a) => a.id === fallbackSelected)
      ? fallbackSelected
      : resolvedPrimary || loadedAccounts[0]?.id || "";

    setAccounts(loadedAccounts);
    setPrimaryId(resolvedPrimary);
    setSelectedAccountId(resolvedSelected);
    setLedger(loadedLedger);
    setSpendingRows(loadedSpending);
    setBills(loadedBills);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        setPageError("");
        setLoading(true);

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

        await loadData(currentUser.id);
      } catch (err) {
        if (!mounted) return;
        setPageError(err?.message || "Failed to load accounts.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [loadData]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) || null,
    [accounts, selectedAccountId]
  );

  const modalAccount = useMemo(
    () => accounts.find((a) => a.id === modalAccountId) || null,
    [accounts, modalAccountId]
  );

  const spendModalAccount = useMemo(
    () => accounts.find((a) => a.id === spendModalAccountId) || null,
    [accounts, spendModalAccountId]
  );

  const totals = useMemo(() => {
    const liquid = accounts
      .filter((a) => isLiquidType(a.type))
      .reduce((sum, a) => sum + safeNum(a.balance, 0), 0);

    const invest = accounts
      .filter((a) => isInvestmentType(a.type))
      .reduce((sum, a) => sum + safeNum(a.balance, 0), 0);

    const creditExposure = accounts
      .filter((a) => isCreditType(a.type))
      .reduce((sum, a) => sum + Math.max(safeNum(a.balance, 0), 0), 0);

    const assetBalances = accounts
      .filter((a) => !isCreditType(a.type))
      .reduce((sum, a) => sum + safeNum(a.balance, 0), 0);

    const liabilityNet = accounts
      .filter((a) => isCreditType(a.type))
      .reduce((sum, a) => sum + safeNum(a.balance, 0), 0);

    const netWorth = round2(assetBalances - liabilityNet);

    const updatedMax = accounts.reduce((mx, a) => Math.max(mx, safeNum(a.updatedAt, 0)), 0);

    return {
      liquid: round2(liquid),
      invest: round2(invest),
      creditExposure: round2(creditExposure),
      assetBalances: round2(assetBalances),
      liabilityNet: round2(liabilityNet),
      netWorth,
      updatedMax,
    };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    let list = [...accounts];
    const q = query.trim().toLowerCase();

    if (q) {
      list = list.filter((a) => {
        const hay = `${a.name} ${typeLabel(a.type)}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (typeFilter !== "all") {
      list = list.filter((a) => normalizeType(a.type) === typeFilter);
    }

    if (sort === "name") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    } else if (sort === "balance") {
      list.sort(
        (a, b) => Math.abs(safeNum(b.balance, 0)) - Math.abs(safeNum(a.balance, 0))
      );
    } else {
      list.sort((a, b) => safeNum(b.updatedAt, 0) - safeNum(a.updatedAt, 0));
    }

    if (primaryId) {
      list.sort((a, b) => (a.id === primaryId ? -1 : b.id === primaryId ? 1 : 0));
    }

    return list;
  }, [accounts, query, typeFilter, sort, primaryId]);

  const selectedLedger = useMemo(() => {
    if (!selectedAccountId) return [];
    const q = ledgerSearch.trim().toLowerCase();

    return ledger
      .filter((x) => x.accountId === selectedAccountId)
      .filter((x) => {
        if (!q) return true;
        const hay = [
          transactionLabel(x.kind),
          x.note,
          x.relatedAccountName,
          fmtMoney(x.amount),
          fmtMoney(x.resultingBalance),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => safeNum(b.ts, 0) - safeNum(a.ts, 0));
  }, [ledger, selectedAccountId, ledgerSearch]);

  const selectedAccountBills = useMemo(() => {
    if (!selectedAccount) return [];
    return bills.filter((bill) => billMatchesAccount(bill, selectedAccount));
  }, [bills, selectedAccount]);

  const selectedAccountSpendRows = useMemo(() => {
    if (!selectedAccount) return [];
    return spendingRows.filter((row) => spendingMatchesAccount(row, selectedAccount));
  }, [spendingRows, selectedAccount]);

  const selectedSpendMonth = useMemo(() => {
    return round2(
      selectedAccountSpendRows
        .filter((item) => rangeMatches(item.ts, "month"))
        .reduce((sum, item) => sum + safeNum(item.amount, 0), 0)
    );
  }, [selectedAccountSpendRows]);

  const selectedSpend30 = useMemo(() => {
    return round2(
      selectedAccountSpendRows
        .filter((item) => rangeMatches(item.ts, "30"))
        .reduce((sum, item) => sum + safeNum(item.amount, 0), 0)
    );
  }, [selectedAccountSpendRows]);

  const selectedLedgerHealth = useMemo(() => {
    if (!selectedAccount) {
      return {
        hasLedger: false,
        aligned: true,
        diff: 0,
        latestBalance: 0,
      };
    }

    const related = ledger
      .filter((item) => item.accountId === selectedAccount.id)
      .sort((a, b) => safeNum(b.ts, 0) - safeNum(a.ts, 0));

    if (!related.length) {
      return {
        hasLedger: false,
        aligned: true,
        diff: 0,
        latestBalance: 0,
      };
    }

    const latestBalance = round2(safeNum(related[0].resultingBalance, 0));
    const diff = round2(safeNum(selectedAccount.balance, 0) - latestBalance);

    return {
      hasLedger: true,
      aligned: Math.abs(diff) <= 0.009,
      diff,
      latestBalance,
    };
  }, [ledger, selectedAccount]);

  const spendModalSpendRows = useMemo(() => {
    if (!spendModalAccount) return [];
    return spendingRows.filter((row) => spendingMatchesAccount(row, spendModalAccount));
  }, [spendingRows, spendModalAccount]);

  const spendModalBills = useMemo(() => {
    if (!spendModalAccount) return [];
    return bills.filter((bill) => billMatchesAccount(bill, spendModalAccount));
  }, [bills, spendModalAccount]);

  const spendModalLedgerHealth = useMemo(() => {
    if (!spendModalAccount) {
      return {
        hasLedger: false,
        aligned: true,
        diff: 0,
        latestBalance: 0,
      };
    }

    const related = ledger
      .filter((item) => item.accountId === spendModalAccount.id)
      .sort((a, b) => safeNum(b.ts, 0) - safeNum(a.ts, 0));

    if (!related.length) {
      return {
        hasLedger: false,
        aligned: true,
        diff: 0,
        latestBalance: 0,
      };
    }

    const latestBalance = round2(safeNum(related[0].resultingBalance, 0));
    const diff = round2(safeNum(spendModalAccount.balance, 0) - latestBalance);

    return {
      hasLedger: true,
      aligned: Math.abs(diff) <= 0.009,
      diff,
      latestBalance,
    };
  }, [ledger, spendModalAccount]);

  async function insertLedgerEntries(entries) {
    if (!user || !supabase || !entries.length) {
      return { ok: false, error: "Missing ledger data." };
    }

    const rows = entries.map((entry) => mapLedgerClientToRow(entry, user.id));
    const { error } = await supabase.from("account_transactions").insert(rows);

    if (error) {
      return { ok: false, error: error.message || "Failed to save ledger." };
    }

    return { ok: true };
  }

  async function updateAccountColumns(accountId, patch) {
    if (!user || !supabase) {
      return { ok: false, error: "Missing user." };
    }

    const payload = {
      ...patch,
      updated_at: new Date().toISOString(),
    };

    if (payload.balance !== undefined) {
      payload.balance = round2(safeNum(payload.balance, 0));
    }

    const { error } = await supabase
      .from("accounts")
      .update(payload)
      .eq("id", accountId)
      .eq("user_id", user.id);

    if (error) {
      return { ok: false, error: error.message || "Failed to save account." };
    }

    return { ok: true };
  }

  async function savePrimary(nextId) {
    if (!user || !supabase || !nextId) return;

    setPageError("");

    const { error } = await supabase.from("account_settings").upsert(
      {
        user_id: user.id,
        primary_account_id: nextId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      setPageError(error.message || "Failed to save primary account.");
      return;
    }

    setPrimaryId(nextId);
    setStatus("Primary account updated.");
  }

  function openSpendingModal(accountId) {
    setSpendModalAccountId(accountId);
    setSpendRange("month");
    setSpendGroupBy("category");
    setSpendSearch("");
    setSpendSort("recent");
    setSpendModalOpen(true);
  }


  function openModal(type, accountId = "") {
    const acc = accounts.find((a) => a.id === accountId) || null;

    if (type === "create") {
      setAdding({ name: "", type: "checking", balance: "" });
    }

    setModalType(type);
    setModalAccountId(accountId || "");
    setModalOpen(true);
    setAmount("");
    setNote("");
    setAdjustMode("increase");
    setTransferToId("");
    setEditName(acc?.name || "");
    setEditType(acc?.type || "checking");
  }

  function meaningfulLedgerEntriesForAccount(accountId) {
    return ledger.filter(
      (item) =>
        item.accountId === accountId &&
        !["create"].includes(String(item.kind || "").toLowerCase())
    );
  }

  function linkedSpendingForAccount(account) {
    return spendingRows.filter((row) => spendingMatchesAccount(row, account));
  }

  function linkedBillsForAccount(account) {
    return bills.filter((bill) => billMatchesAccount(bill, account));
  }

  function canDeleteAccount(accountId) {
    const account = accounts.find((row) => row.id === accountId);
    if (!account) {
      return { ok: false, reason: "Account not found." };
    }

    if (accounts.length <= 1) {
      return { ok: false, reason: "You need at least one account." };
    }

    if (Math.abs(safeNum(account.balance, 0)) > 0.009) {
      return { ok: false, reason: "Only zero-balance accounts can be deleted." };
    }

    const meaningfulLedger = meaningfulLedgerEntriesForAccount(accountId);
    if (meaningfulLedger.length) {
      return {
        ok: false,
        reason:
          "This account already has real ledger history. Keep it for math integrity or rename it instead.",
      };
    }

    const spendLinks = linkedSpendingForAccount(account);
    if (spendLinks.length) {
      return {
        ok: false,
        reason:
          "This account is linked to spending history. Deleting it would break that trail.",
      };
    }

    const billLinks = linkedBillsForAccount(account);
    if (billLinks.length) {
      return {
        ok: false,
        reason:
          "This account is linked to one or more bills. Move those bills first.",
      };
    }

    return { ok: true, reason: "" };
  }


  async function addAccount() {
    setPageError("");

    if (!user || !supabase || addingBusy) return false;

    const name = adding.name.trim();
    if (!name) {
      setPageError("Account name is required.");
      return false;
    }

    const bal = adding.balance.trim() ? parseMoneyInput(adding.balance) : 0;
    if (adding.balance.trim() && !Number.isFinite(bal)) {
      setPageError("Enter a valid starting balance.");
      return false;
    }

    setAddingBusy(true);

    try {
      const nextAcc = {
        id: uid(),
        name,
        type: adding.type,
        balance: round2(Number.isFinite(bal) ? bal : 0),
        updatedAt: nowTs(),
      };

      const { data, error } = await supabase
        .from("accounts")
        .insert([mapAccountClientToRow(nextAcc, user.id)])
        .select()
        .single();

      if (error) {
        setPageError(error.message || "Failed to add account.");
        return false;
      }

      const saved = mapAccountRowToClient(data);

      const ledgerRes = await insertLedgerEntries([
        {
          id: uid(),
          ts: nowTs(),
          kind: "create",
          accountId: saved.id,
          amount: round2(Math.abs(safeNum(saved.balance, 0))),
          delta: round2(safeNum(saved.balance, 0)),
          resultingBalance: round2(safeNum(saved.balance, 0)),
          note: "Account created",
          relatedAccountId: "",
          relatedAccountName: "",
        },
      ]);

      if (!ledgerRes.ok) {
        setPageError(ledgerRes.error || "Account added but ledger creation failed.");
        return false;
      }

      if (!primaryId) {
        await savePrimary(saved.id);
      }

      await loadData(user.id, saved.id);
      setAdding({ name: "", type: "checking", balance: "" });
      setStatus("Account added.");
      return true;
    } finally {
      setAddingBusy(false);
    }
  }

  async function deleteAccount(id) {
    if (!user || !supabase) return;

    const account = accounts.find((a) => a.id === id);
    if (!account) return;

    const guard = canDeleteAccount(id);
    if (!guard.ok) {
      setPageError(guard.reason);
      return;
    }

    const ok = window.confirm(
      `Delete "${account.name}"? This is only allowed because it is empty and unlinked.`
    );
    if (!ok) return;

    setPageError("");

    const createOnlyLedger = ledger.filter((item) => item.accountId === id);

    if (createOnlyLedger.length) {
      const deleteLedgerRes = await supabase
        .from("account_transactions")
        .delete()
        .eq("user_id", user.id)
        .eq("account_id", id);

      if (deleteLedgerRes.error) {
        setPageError(deleteLedgerRes.error.message || "Failed to remove ledger.");
        return;
      }
    }

    const deleteAccountRes = await supabase
      .from("accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteAccountRes.error) {
      setPageError(deleteAccountRes.error.message || "Failed to delete account.");
      return;
    }

    const nextPrimary =
      primaryId === id ? accounts.find((a) => a.id !== id)?.id || "" : primaryId;

    if (nextPrimary) {
      await savePrimary(nextPrimary);
    }

    await loadData(user.id, nextPrimary);
    setStatus("Account deleted.");
  }


  async function applyModal() {
    setPageError("");
    if (!user || !supabase || modalBusy) return;

    if (modalType === "create") {
      const created = await addAccount();
      if (created) {
        setModalOpen(false);
      }
      return;
    }

    if (!modalAccount) return;

    setModalBusy(true);

    if (modalType === "edit") {
      const name = editName.trim();
      if (!name) {
        setPageError("Account name is required.");
        setModalBusy(false);
        return;
      }

      const typeChanged = normalizeType(editType) !== normalizeType(modalAccount.type);
      if (typeChanged) {
        const hasMeaningfulHistory =
          meaningfulLedgerEntriesForAccount(modalAccount.id).length > 0 ||
          linkedSpendingForAccount(modalAccount).length > 0 ||
          linkedBillsForAccount(modalAccount).length > 0;

        if (hasMeaningfulHistory) {
          setPageError(
            "Do not change account type after real history exists. Rename it or create a new account instead."
          );
          setModalBusy(false);
          return;
        }
      }

      const res = await updateAccountColumns(modalAccount.id, {
        name,
        account_type: editType,
      });

      if (!res.ok) {
        setPageError(res.error || "Failed to update account.");
        setModalBusy(false);
        return;
      }

      await loadData(user.id, modalAccount.id);
      setModalOpen(false);
      setStatus("Account updated.");
      setModalBusy(false);
      return;
    }

    if (modalType === "set") {
      const exactRaw = parseMoneyInput(amount);
      const exact = round2(exactRaw);

      if (!Number.isFinite(exact)) {
        setPageError("Enter a valid balance.");
        setModalBusy(false);
        return;
      }

      const oldBalance = round2(safeNum(modalAccount.balance, 0));

      const updateRes = await updateAccountColumns(modalAccount.id, {
        balance: exact,
      });

      if (!updateRes.ok) {
        setPageError(updateRes.error || "Failed to set balance.");
        setModalBusy(false);
        return;
      }

      const ledgerRes = await insertLedgerEntries([
        {
          id: uid(),
          ts: nowTs(),
          kind: "set",
          accountId: modalAccount.id,
          amount: round2(Math.abs(exact)),
          delta: round2(exact - oldBalance),
          resultingBalance: round2(exact),
          note: note.trim() || "Manual balance set",
          relatedAccountId: "",
          relatedAccountName: "",
        },
      ]);

      if (!ledgerRes.ok) {
        await updateAccountColumns(modalAccount.id, { balance: oldBalance });
        await loadData(user.id, modalAccount.id);
        setPageError(ledgerRes.error || "Failed to save ledger. Balance rolled back.");
        setModalBusy(false);
        return;
      }

      await loadData(user.id, modalAccount.id);
      setModalOpen(false);
      setStatus("Balance updated.");
      setModalBusy(false);
      return;
    }

    if (modalType === "adjust") {
      const absAmountRaw = parseMoneyInput(amount);
      const absAmount = round2(absAmountRaw);

      if (!Number.isFinite(absAmount) || absAmount <= 0) {
        setPageError("Enter a valid amount.");
        setModalBusy(false);
        return;
      }

      const current = round2(safeNum(modalAccount.balance, 0));
      const delta = round2(getAdjustDelta(modalAccount.type, adjustMode, absAmount));
      const nextBalance = round2(current + delta);
      const kind = getAdjustKind(modalAccount.type, adjustMode);

      const updateRes = await updateAccountColumns(modalAccount.id, {
        balance: nextBalance,
      });

      if (!updateRes.ok) {
        setPageError(updateRes.error || "Failed to update balance.");
        setModalBusy(false);
        return;
      }

      const ledgerRes = await insertLedgerEntries([
        {
          id: uid(),
          ts: nowTs(),
          kind,
          accountId: modalAccount.id,
          amount: round2(Math.abs(absAmount)),
          delta: round2(delta),
          resultingBalance: round2(nextBalance),
          note: note.trim() || "",
          relatedAccountId: "",
          relatedAccountName: "",
        },
      ]);

      if (!ledgerRes.ok) {
        await updateAccountColumns(modalAccount.id, { balance: current });
        await loadData(user.id, modalAccount.id);
        setPageError(ledgerRes.error || "Failed to save ledger. Balance rolled back.");
        setModalBusy(false);
        return;
      }

      await loadData(user.id, modalAccount.id);
      setModalOpen(false);
      setStatus("Transaction applied.");
      setModalBusy(false);
      return;
    }

    if (modalType === "transfer") {
      const absAmountRaw = parseMoneyInput(amount);
      const absAmount = round2(absAmountRaw);
      const target = accounts.find((a) => a.id === transferToId);

      if (!Number.isFinite(absAmount) || absAmount <= 0) {
        setPageError("Enter a valid amount.");
        setModalBusy(false);
        return;
      }

      if (!target) {
        setPageError("Choose the destination account.");
        setModalBusy(false);
        return;
      }

      if (target.id === modalAccount.id) {
        setPageError("Cannot transfer to the same account.");
        setModalBusy(false);
        return;
      }

      const plan = getTransferPlan(modalAccount, target, absAmount);
      const fromCurrent = round2(safeNum(modalAccount.balance, 0));
      const toCurrent = round2(safeNum(target.balance, 0));
      const fromNext = round2(fromCurrent + plan.fromDelta);
      const toNext = round2(toCurrent + plan.toDelta);
      const sharedNote = note.trim() || "Transfer between accounts";

      const fromRes = await updateAccountColumns(modalAccount.id, {
        balance: fromNext,
      });

      if (!fromRes.ok) {
        setPageError(fromRes.error || "Failed to update source account.");
        setModalBusy(false);
        return;
      }

      const toRes = await updateAccountColumns(target.id, {
        balance: toNext,
      });

      if (!toRes.ok) {
        await updateAccountColumns(modalAccount.id, { balance: fromCurrent });
        await loadData(user.id, modalAccount.id);
        setPageError(toRes.error || "Failed to update destination account.");
        setModalBusy(false);
        return;
      }

      const ledgerRes = await insertLedgerEntries([
        {
          id: uid(),
          ts: nowTs(),
          kind: plan.fromKind,
          accountId: modalAccount.id,
          amount: round2(Math.abs(absAmount)),
          delta: round2(plan.fromDelta),
          resultingBalance: round2(fromNext),
          note: sharedNote,
          relatedAccountId: target.id,
          relatedAccountName: target.name,
        },
        {
          id: uid(),
          ts: nowTs(),
          kind: plan.toKind,
          accountId: target.id,
          amount: round2(Math.abs(absAmount)),
          delta: round2(plan.toDelta),
          resultingBalance: round2(toNext),
          note: sharedNote,
          relatedAccountId: modalAccount.id,
          relatedAccountName: modalAccount.name,
        },
      ]);

      if (!ledgerRes.ok) {
        await updateAccountColumns(modalAccount.id, { balance: fromCurrent });
        await updateAccountColumns(target.id, { balance: toCurrent });
        await loadData(user.id, modalAccount.id);
        setPageError(ledgerRes.error || "Failed to save ledger. Transfer rolled back.");
        setModalBusy(false);
        return;
      }

      await loadData(user.id, modalAccount.id);
      setModalOpen(false);
      setStatus("Transfer completed.");
      setModalBusy(false);
      return;
    }

    setModalBusy(false);
  }

  const currentMonth = new Date().toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const modalIsCredit = isCreditType(modalAccount?.type);
  const adjustIncreaseLabel = modalIsCredit ? "Charge" : "Deposit";
  const adjustDecreaseLabel = modalIsCredit ? "Payment" : "Withdraw";
  const modalTone =
    modalType === "create" ? "neutral" : modalAccount ? typeTone(modalAccount.type) : "neutral";
  const modalActionBusy = modalType === "create" ? addingBusy : modalBusy;
  const modalActionLabel = modalType === "create" ? "Add Account" : "Apply";

  if (loading) {
    return (
      <main className="accountsPage">
        <div className="accountsPageShell">
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
              Loading accounts.
            </div>
          </GlassPane>
        </div>
        <style jsx global>{globalStyles}</style>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="accountsPage">
        <div className="accountsPageShell">
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
      <main
        className="accountsPage"
        onClick={() => {
          if (rowMenuId) setRowMenuId("");
          if (focusMenuOpen) setFocusMenuOpen(false);
        }}
      >
        <div className="accountsPageShell">
          {pageError ? <div className="accountsBanner accountsBannerError">{pageError}</div> : null}
          {status ? <div className="accountsBanner accountsBannerOk">{status}</div> : null}

          <GlassPane size="card">
            <div className="accountsHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div className="accountsEyebrow">Life Command Center</div>
                <div className="accountsHeroTitle">Accounts Command</div>
                <div className="accountsHeroSub">
                  Cleaner controls, safer math, tighter tools, and account-specific spending
                  history with linked bill visibility.
                </div>

                <div className="accountsPillRow">
                  <MiniPill>{accounts.length} accounts</MiniPill>
                  <MiniPill>{currentMonth}</MiniPill>
                  {primaryId ? (
                    <MiniPill>
                      Primary • {accounts.find((a) => a.id === primaryId)?.name || "—"}
                    </MiniPill>
                  ) : null}
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
                <MiniPill>{fmtWhen(totals.updatedMax || nowTs())}</MiniPill>
                <MiniPill tone="green">{fmtMoney(totals.liquid)} liquid</MiniPill>
                <MiniPill tone={totals.creditExposure > 0 ? "red" : "green"}>
                  {fmtMoney(totals.creditExposure)} credit
                </MiniPill>
              </div>
            </div>
          </GlassPane>

          <section className="accountsMetricGrid">
            <StatCard
              icon={Landmark}
              label="Net Worth"
              value={fmtMoney(totals.netWorth)}
              detail={`Assets ${fmtMoney(totals.assetBalances)} minus credit net ${fmtMoney(
                totals.liabilityNet
              )}.`}
              tone={totals.netWorth >= 0 ? "green" : "red"}
            />
            <StatCard
              icon={Wallet}
              label="Liquid Balances"
              value={fmtMoney(totals.liquid)}
              detail="Checking, savings, and cash only."
              tone="neutral"
            />
            <StatCard
              icon={PiggyBank}
              label="Investment Accounts"
              value={fmtMoney(totals.invest)}
              detail="Tracked investment account balances."
              tone="neutral"
            />
            <StatCard
              icon={CreditCard}
              label="Credit Exposure"
              value={fmtMoney(totals.creditExposure)}
              detail="Only positive credit balances count as debt exposure."
              tone={totals.creditExposure > 0 ? "red" : "green"}
            />
          </section>

          <section className="accountsMainGrid">
            <GlassPane size="card" style={{ height: "100%" }}>
              <PaneHeader
                title="Account Roster"
                subcopy="Click any account to open its spending history popup and keep the math focused."
                right={<MiniPill>{filteredAccounts.length} showing</MiniPill>}
              />

              <div className="accountsRosterControls">
                <div className="accountsSearchWrap">
                  <Search size={15} />
                  <input
                    className="accountsField accountsSearchField"
                    placeholder="Search accounts"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                <select
                  className="accountsField"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">All types</option>
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="cash">Cash</option>
                  <option value="credit">Credit Card</option>
                  <option value="investment">Investment</option>
                  <option value="other">Other</option>
                </select>

                <select
                  className="accountsField"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="updated">Recently updated</option>
                  <option value="name">Name</option>
                  <option value="balance">Largest impact</option>
                </select>
              </div>

              {filteredAccounts.length ? (
                <div className="accountsRosterListCompact">
                  {filteredAccounts.map((a) => (
                    <CompactAccountRow
                      key={a.id}
                      account={a}
                      selected={a.id === selectedAccountId}
                      primary={a.id === primaryId}
                      menuOpen={rowMenuId === a.id}
                      onSelect={() => {
                        setSelectedAccountId(a.id);
                        openSpendingModal(a.id);
                      }}
                      onToggleMenu={() => {
                        setRowMenuId((prev) => (prev === a.id ? "" : a.id));
                      }}
                      onViewSpending={() => {
                        setSelectedAccountId(a.id);
                        setRowMenuId("");
                        openSpendingModal(a.id);
                      }}
                      onEdit={() => {
                        setRowMenuId("");
                        openModal("edit", a.id);
                      }}
                      onSetPrimary={() => {
                        setRowMenuId("");
                        savePrimary(a.id);
                      }}
                      onDelete={() => {
                        setRowMenuId("");
                        deleteAccount(a.id);
                      }}
                    />
                  ))}
                </div>
              ) : accounts.length === 0 ? (
                <div className="accountsEmptyState">
                  <div>
                    <div className="accountsEmptyTitle">No accounts yet</div>
                    <div className="accountsEmptyText">
                      Start by adding a real account. This page no longer hides fake filler.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="accountsEmptyState">
                  <div>
                    <div className="accountsEmptyTitle">No accounts found</div>
                    <div className="accountsEmptyText">
                      Clear filters or add another account.
                    </div>
                  </div>
                </div>
              )}
            </GlassPane>

            <div className="accountsRightStack">
              <div className="accountsTopRightGrid">
                <FocusCard
                  selectedAccount={selectedAccount}
                  primaryId={primaryId}
                  linkedBills={selectedAccountBills}
                  spendMonth={selectedSpendMonth}
                  spend30={selectedSpend30}
                  ledgerHealth={selectedLedgerHealth}
                  focusMenuOpen={focusMenuOpen}
                  setFocusMenuOpen={setFocusMenuOpen}
                  onAdjust={() => selectedAccount && openModal("adjust", selectedAccount.id)}
                  onTransfer={() => selectedAccount && openModal("transfer", selectedAccount.id)}
                  onOpenSpend={() => selectedAccount && openSpendingModal(selectedAccount.id)}
                  onSetExact={() => selectedAccount && openModal("set", selectedAccount.id)}
                  onEdit={() => selectedAccount && openModal("edit", selectedAccount.id)}
                  onSetPrimary={() => selectedAccount && savePrimary(selectedAccount.id)}
                  onDelete={() => selectedAccount && deleteAccount(selectedAccount.id)}
                />

                <AddAccountLauncherCard
                  onOpen={() => openModal("create")}
                  totalAccounts={accounts.length}
                  primaryName={accounts.find((a) => a.id === primaryId)?.name || ""}
                  liquidTotal={totals.liquid}
                  creditExposure={totals.creditExposure}
                />
              </div>

              <GlassPane size="card">
                <PaneHeader
                  title={
                    selectedAccount ? `${selectedAccount.name} Ledger` : "Transaction Ledger"
                  }
                  subcopy="Full movement history for the selected account."
                  right={
                    <MiniPill>
                      {selectedLedger.length} item{selectedLedger.length === 1 ? "" : "s"}
                    </MiniPill>
                  }
                />

                <div className="accountsSearchWrap" style={{ marginBottom: 10 }}>
                  <Search size={15} />
                  <input
                    className="accountsField accountsSearchField"
                    placeholder="Search ledger"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                  />
                </div>

                {selectedAccount ? (
                  selectedLedger.length ? (
                    <div className="accountsLedgerList accountsLedgerListTight">
                      {selectedLedger.map((item) => (
                        <LedgerItem key={item.id} item={item} />
                      ))}
                    </div>
                  ) : (
                    <div className="accountsEmptyState" style={{ minHeight: 140 }}>
                      <div>
                        <div className="accountsEmptyTitle">No ledger entries yet</div>
                        <div className="accountsEmptyText">
                          Transactions, transfers, exact balance sets, income posting, and
                          spending-linked writes should land here.
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="accountsEmptyState" style={{ minHeight: 140 }}>
                    <div>
                      <div className="accountsEmptyTitle">No account selected</div>
                      <div className="accountsEmptyText">
                        Choose one from the roster to view its ledger.
                      </div>
                    </div>
                  </div>
                )}
              </GlassPane>
            </div>
          </section>
        </div>
      </main>

      <Modal
        open={modalOpen}
        onClose={() => {
          if (modalActionBusy) return;
          setModalOpen(false);
        }}
        tone={modalTone}
        title={
          modalType === "create"
            ? "Add Account"
            : modalType === "edit"
            ? `Edit ${modalAccount?.name || "account"}`
            : modalType === "transfer"
            ? `Transfer from ${modalAccount?.name || "account"}`
            : modalType === "set"
            ? `Set exact balance for ${modalAccount?.name || "account"}`
            : `Adjust ${modalAccount?.name || "account"}`
        }
        subtitle={
          modalType === "create"
            ? "Fast create without letting the form permanently take over the page."
            : "Writes hit the account and the matching ledger history."
        }
      >
        {modalType === "create" ? (
          <div className="accountsFormStack">
            <div>
              <div className="accountsTinyLabel">Account Name</div>
              <input
                className="accountsField"
                placeholder="Account name"
                value={adding.name}
                onChange={(e) => setAdding((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div>
              <div className="accountsTinyLabel">Type</div>
              <select
                className="accountsField"
                value={adding.type}
                onChange={(e) => setAdding((p) => ({ ...p, type: e.target.value }))}
              >
                <option value="checking">🏦 Checking</option>
                <option value="savings">💰 Savings</option>
                <option value="cash">💵 Cash</option>
                <option value="credit">💳 Credit Card</option>
                <option value="investment">📈 Investment</option>
                <option value="other">📁 Other</option>
              </select>
            </div>

            <div>
              <div className="accountsTinyLabel">Starting Balance</div>
              <input
                className="accountsField"
                inputMode="decimal"
                placeholder="0.00"
                value={adding.balance}
                onChange={(e) => setAdding((p) => ({ ...p, balance: e.target.value }))}
              />
            </div>

            <div className="accountsFootnote">
              Credit accounts store what you owe. Liquid accounts go up and down the normal
              way. A create entry is written to the ledger automatically.
            </div>
          </div>
        ) : null}

        {modalType === "edit" ? (
          <div className="accountsFormStack">
            <div>
              <div className="accountsTinyLabel">Account Name</div>
              <input
                className="accountsField"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div>
              <div className="accountsTinyLabel">Account Type</div>
              <select
                className="accountsField"
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
              >
                <option value="checking">🏦 Checking</option>
                <option value="savings">💰 Savings</option>
                <option value="cash">💵 Cash</option>
                <option value="credit">💳 Credit Card</option>
                <option value="investment">📈 Investment</option>
                <option value="other">📁 Other</option>
              </select>
            </div>

            <div className="accountsFootnote">
              Type changes are blocked once real history exists. That protects the math.
            </div>
          </div>
        ) : null}

        {modalType === "adjust" ? (
          <div className="accountsFormStack">
            <div>
              <div className="accountsTinyLabel">Direction</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ActionBtn
                  variant={adjustMode === "increase" ? "primary" : "ghost"}
                  onClick={() => setAdjustMode("increase")}
                >
                  {adjustIncreaseLabel}
                </ActionBtn>
                <ActionBtn
                  variant={adjustMode === "decrease" ? "primary" : "ghost"}
                  onClick={() => setAdjustMode("decrease")}
                >
                  {adjustDecreaseLabel}
                </ActionBtn>
              </div>
            </div>

            <div>
              <div className="accountsTinyLabel">Amount</div>
              <input
                className="accountsField"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div>
              <div className="accountsTinyLabel">Note</div>
              <textarea
                className="accountsField"
                placeholder="Optional note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        ) : null}

        {modalType === "transfer" ? (
          <div className="accountsFormStack">
            <div>
              <div className="accountsTinyLabel">Amount</div>
              <input
                className="accountsField"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div>
              <div className="accountsTinyLabel">Transfer To</div>
              <select
                className="accountsField"
                value={transferToId}
                onChange={(e) => setTransferToId(e.target.value)}
              >
                <option value="">Choose account</option>
                {accounts
                  .filter((a) => a.id !== modalAccountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} • {typeLabel(a.type)}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <div className="accountsTinyLabel">Note</div>
              <textarea
                className="accountsField"
                placeholder="Optional note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
              />
            </div>

            <div className="accountsFootnote">
              Cash → credit reduces debt. Credit → cash increases debt. Credit → credit works
              like a balance transfer.
            </div>
          </div>
        ) : null}

        {modalType === "set" ? (
          <div className="accountsFormStack">
            <div>
              <div className="accountsTinyLabel">Exact Balance</div>
              <input
                className="accountsField"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div>
              <div className="accountsTinyLabel">Note</div>
              <textarea
                className="accountsField"
                placeholder="Optional note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        ) : null}

        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <ActionBtn onClick={() => setModalOpen(false)} disabled={modalActionBusy}>
            Cancel
          </ActionBtn>
          <ActionBtn variant="primary" onClick={applyModal} disabled={modalActionBusy}>
            {modalActionBusy
              ? modalType === "create"
                ? "Adding..."
                : "Applying..."
              : modalActionLabel}{" "}
            <ChevronRight size={14} />
          </ActionBtn>
        </div>
      </Modal>

      <SpendingHistoryModal
        open={spendModalOpen}
        onClose={() => setSpendModalOpen(false)}
        account={spendModalAccount}
        spendingItems={spendModalSpendRows}
        linkedBills={spendModalBills}
        ledgerHealth={spendModalLedgerHealth}
        range={spendRange}
        setRange={setSpendRange}
        groupBy={spendGroupBy}
        setGroupBy={setSpendGroupBy}
        spendSearch={spendSearch}
        setSpendSearch={setSpendSearch}
        spendSort={spendSort}
        setSpendSort={setSpendSort}
      />

      <style jsx global>{globalStyles}</style>
    </>
  );
}

const globalStyles = `
  .accountsPage {
    width: 100%;
    color: var(--lcc-text);
    font-family: var(--lcc-font-sans);
    box-sizing: border-box;
  }

  .accountsPageShell {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0 0 20px;
    display: grid;
    gap: 12px;
    box-sizing: border-box;
  }

  .accountsBanner {
    min-height: 44px;
    border-radius: 16px;
    border: 1px solid rgba(214,226,255,0.12);
    display: flex;
    align-items: center;
    padding: 0 14px;
    font-size: 13px;
    font-weight: 800;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
  }

  .accountsBannerOk {
    background: linear-gradient(180deg, rgba(74,222,128,0.12), rgba(74,222,128,0.05));
    color: #a7f3d0;
    border-color: rgba(74,222,128,0.18);
  }

  .accountsBannerError {
    background: linear-gradient(180deg, rgba(255,132,163,0.12), rgba(255,132,163,0.05));
    color: #ffd3df;
    border-color: rgba(255,132,163,0.18);
  }

  .accountsEyebrow {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: .22em;
    font-weight: 800;
    color: rgba(255,255,255,0.42);
  }

  .accountsHeroTitle {
    margin-top: 8px;
    font-size: clamp(24px, 3.2vw, 34px);
    line-height: 1.02;
    font-weight: 850;
    letter-spacing: -0.05em;
    color: #fff;
  }

  .accountsHeroSub {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.55;
    color: rgba(255,255,255,0.62);
    max-width: 840px;
  }

  .accountsHeroGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) auto;
    gap: 12px;
    align-items: start;
  }

  .accountsPillRow {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .accountsMetricGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .accountsMainGrid {
    display: grid;
    grid-template-columns: minmax(460px, 0.98fr) minmax(0, 1.02fr);
    gap: 12px;
    align-items: start;
  }

  .accountsRightStack {
    display: grid;
    gap: 12px;
  }

  .accountsTopRightGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.64fr);
    gap: 12px;
    align-items: start;
  }

  .accountsRosterControls {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr 0.9fr;
    gap: 10px;
    margin-bottom: 10px;
  }

  .accountsSearchWrap {
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

  .accountsSearchField {
    min-height: 42px !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
  }

  .accountsRosterListCompact {
    display: grid;
    gap: 8px;
    max-height: 660px;
    overflow: auto;
    padding-right: 2px;
  }

  .accountsCompactRow {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto auto;
    gap: 10px;
    align-items: center;
    min-height: 82px;
    padding: 10px 12px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.07);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .accountsCompactRow:hover {
    transform: translateY(-1px);
  }

  .accountsCompactAvatar {
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

  .accountsCompactTitle {
    font-size: 13.5px;
    font-weight: 800;
    color: #fff;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .accountsCompactSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.3;
  }

  .accountsCompactValue {
    font-size: 15px;
    font-weight: 850;
    color: #fff;
    white-space: nowrap;
  }

  .accountsFocusBox {
    border-radius: 22px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
    padding: 16px;
    min-height: 100%;
  }

  .accountsInfoGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .accountsInfoGridSingle {
    grid-template-columns: 1fr;
  }

  .accountsInfoCell {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.025);
    padding: 11px;
  }

  .accountsInfoValue {
    font-size: 0.96rem;
    font-weight: 900;
    line-height: 1.15;
    color: #fff;
  }

  .accountsInfoSub {
    margin-top: 5px;
    color: rgba(255,255,255,0.62);
    font-size: 0.79rem;
    line-height: 1.4;
  }

  .accountsActionGridTriplet {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .accountsFormStack {
    display: grid;
    gap: 12px;
  }

  .accountsTinyLabel {
    display: block;
    margin-bottom: 8px;
    font-size: 10px;
    color: rgba(255,255,255,0.46);
    text-transform: uppercase;
    letter-spacing: .16em;
    font-weight: 800;
  }

  .accountsField {
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

  .accountsField:focus {
    border-color: rgba(143,177,255,0.30);
    box-shadow:
      0 0 0 4px rgba(79,114,255,0.08),
      inset 0 1px 0 rgba(255,255,255,0.035);
  }

  .accountsField::placeholder {
    color: rgba(225,233,245,0.38);
  }

  .accountsField option {
    background: #08111f;
    color: #f4f7ff;
  }

  textarea.accountsField {
    min-height: 96px;
    resize: vertical;
    padding: 12px 13px;
  }

  .accountsActionBtn {
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

  .accountsActionBtn:hover {
    transform: translateY(-1px);
  }

  .accountsMenuWrap {
    position: relative;
  }

  .accountsMenuPanel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 50;
    min-width: 196px;
    border-radius: 16px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(12,18,30,0.96), rgba(7,11,20,0.94));
    box-shadow:
      0 18px 45px rgba(0,0,0,0.42),
      inset 0 1px 0 rgba(255,255,255,0.03);
    padding: 8px;
    display: grid;
    gap: 6px;
  }

  .accountsMenuPanelRight {
    right: 0;
  }

  .accountsMenuItem {
    width: 100%;
    min-height: 38px;
    border-radius: 12px;
    border: 1px solid rgba(214,226,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012));
    color: rgba(247,251,255,0.9);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
  }

  .accountsMenuItem.danger {
    border-color: rgba(255,132,163,0.18);
    color: #ffd3df;
  }

  .accountsIconBtn {
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

  .accountsLedgerList {
    display: grid;
    gap: 10px;
  }

  .accountsLedgerListTight {
    max-height: 500px;
    overflow: auto;
    padding-right: 2px;
  }

  .accountsLedgerItem {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.07);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    padding: 12px;
  }

  .accountsLedgerGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) auto auto;
    gap: 14px;
    align-items: center;
  }

  .accountsLedgerTitle {
    margin-top: 10px;
    font-size: 13px;
    font-weight: 800;
    color: #fff;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .accountsLedgerSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.35;
  }

  .accountsLedgerLabel {
    font-size: 11px;
    color: rgba(255,255,255,0.50);
    text-transform: uppercase;
    letter-spacing: .14em;
    font-weight: 700;
  }

  .accountsLedgerRight {
    text-align: right;
  }

  .accountsFootnote {
    font-size: 12px;
    color: rgba(255,255,255,0.48);
    line-height: 1.45;
  }

  .accountsEmptyState {
    min-height: 150px;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 14px;
  }

  .accountsEmptyTitle {
    font-size: 16px;
    font-weight: 850;
    color: #fff;
  }

  .accountsEmptyText {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.5;
    color: rgba(255,255,255,0.60);
    max-width: 460px;
  }

  .accountsModalRoot {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: grid;
    place-items: center;
    padding: 18px;
  }

  .accountsModalBackdrop {
    position: absolute;
    inset: 0;
    background: rgba(2,5,10,0.68);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .accountsModalCard {
    position: relative;
    z-index: 1;
    max-height: min(90vh, 980px);
    overflow: auto;
  }

  .accountsSpendSummaryGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }

  .accountsSpendControls {
    display: grid;
    grid-template-columns: 1.25fr 0.72fr 0.72fr 0.72fr;
    gap: 10px;
    margin-bottom: 12px;
  }

  .accountsSpendContentGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(310px, 0.9fr);
    gap: 12px;
    align-items: start;
  }

  .accountsSpendSideStack {
    display: grid;
    gap: 12px;
  }

  .accountsSpendGroupList {
    display: grid;
    gap: 10px;
    max-height: 540px;
    overflow: auto;
    padding-right: 2px;
  }

  .accountsSpendGroup {
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.07);
    background:
      radial-gradient(circle at top, rgba(124,148,255,0.05), transparent 34%),
      linear-gradient(180deg, rgba(8,13,24,0.84), rgba(4,8,16,0.76));
    padding: 14px;
    display: grid;
    gap: 12px;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.03),
      0 14px 30px rgba(0,0,0,0.14);
  }

  .accountsSpendGroupHeader {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  }

  .accountsSpendGroupTitle {
    font-size: 14px;
    font-weight: 850;
    color: #fff;
    line-height: 1.2;
  }

  .accountsSpendGroupSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
  }

  .accountsSpendLineList {
    display: grid;
    gap: 8px;
  }

  .accountsSpendLine {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.06);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.014));
    padding: 11px 12px;
  }

  .accountsSpendLineTitle {
    font-size: 12.5px;
    font-weight: 800;
    color: #fff;
    line-height: 1.2;
  }

  .accountsSpendLineSub {
    margin-top: 4px;
    font-size: 11px;
    color: rgba(255,255,255,0.56);
    line-height: 1.35;
  }

  .accountsSpendLineAmount {
    font-size: 13px;
    font-weight: 850;
    color: #fff;
    white-space: nowrap;
  }

  .accountsSpendEmptyCard {
    min-height: 300px;
    border-radius: 22px;
    border: 1px solid rgba(255,255,255,0.06);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    display: grid;
    place-items: center;
    text-align: center;
    padding: 24px;
  }

  .accountsSpendEmptyIcon {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    margin: 0 auto 12px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(214,226,255,0.10);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012));
    color: rgba(247,251,255,0.86);
  }

  .accountsEmptyHints {
    margin-top: 14px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .accountsMiniBillList {
    display: grid;
    gap: 8px;
    max-height: 340px;
    overflow: auto;
    padding-right: 2px;
  }

  .accountsMiniBillRow {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: start;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
    padding: 10px 12px;
  }

  .accountsMiniBillTitle {
    font-size: 12.5px;
    font-weight: 800;
    color: #fff;
    line-height: 1.2;
  }

  .accountsMiniBillSub {
    margin-top: 4px;
    font-size: 11px;
    color: rgba(255,255,255,0.56);
    line-height: 1.35;
  }

  .accountsMiniBillAmount {
    font-size: 12px;
    font-weight: 850;
    color: #fff;
    text-align: right;
  }

  .accountsMiniBillDays {
    font-size: 10.5px;
    color: rgba(255,255,255,0.52);
    text-align: right;
  }

.accountsLauncherCard {
    display: grid;
    gap: 12px;
  }

  .accountsLauncherTop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .accountsLauncherIcon {
    width: 38px;
    height: 38px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(143,177,255,0.14);
    color: #f7fbff;
    background:
      linear-gradient(180deg, rgba(143,177,255,0.10), rgba(143,177,255,0.04)),
      rgba(8, 12, 20, 0.76);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.035),
      0 0 18px rgba(79,114,255,0.12);
  }

  .accountsLauncherTitle {
    font-size: 20px;
    line-height: 1.02;
    font-weight: 850;
    letter-spacing: -0.04em;
    color: #fff;
  }

  .accountsLauncherSub {
    font-size: 13px;
    line-height: 1.55;
    color: rgba(255,255,255,0.62);
  }

  .accountsLauncherStatGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .accountsLauncherStat {
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.024);
    padding: 11px 12px;
    min-width: 0;
  }

  .accountsLauncherStatValue {
    font-size: 19px;
    line-height: 1.05;
    font-weight: 850;
    color: #fff;
    overflow-wrap: anywhere;
  }

  .accountsLauncherStatValueSmall {
    font-size: 13px;
    line-height: 1.35;
    letter-spacing: -0.02em;
  }

  .accountsModalBackdrop {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 50% 18%, rgba(91,120,255,0.16), transparent 34%),
      radial-gradient(circle at 78% 60%, rgba(50,206,153,0.10), transparent 30%),
      rgba(2,5,10,0.80);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }

  .accountsModalBackdrop.command {
    background:
      radial-gradient(circle at 50% 10%, rgba(91,120,255,0.22), transparent 32%),
      radial-gradient(circle at 80% 22%, rgba(50,206,153,0.10), transparent 24%),
      radial-gradient(circle at 18% 70%, rgba(255,132,163,0.08), transparent 24%),
      rgba(2,5,10,0.86);
  }

  .accountsModalCard {
    position: relative;
    z-index: 1;
    max-height: min(90vh, 980px);
    overflow: auto;
    border-radius: 28px;
  }

  .accountsModalCardCommand {
    max-height: min(92vh, 1040px);
  }

  .accountsModalInner {
    position: relative;
    padding: 18px;
  }

  .accountsModalInner.command {
    padding: 22px;
  }

  .accountsModalTopGlow {
    position: absolute;
    inset: 0 0 auto 0;
    height: 180px;
    pointer-events: none;
    background:
      radial-gradient(circle at 50% 0%, rgba(109,136,255,0.14), transparent 62%);
    opacity: 0.95;
  }

  .accountsModalHeader {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 14px;
  }

  .accountsModalHeaderText {
    min-width: 0;
  }

  .accountsModalTitle {
    font-size: 21px;
    line-height: 1.04;
    font-weight: 850;
    letter-spacing: -0.04em;
    color: #fff;
  }

  .accountsModalSubtitle {
    margin-top: 6px;
    font-size: 12.5px;
    color: rgba(255,255,255,0.62);
    line-height: 1.5;
    max-width: 900px;
  }

  .accountsModalDivider {
    height: 1px;
    margin-bottom: 16px;
  }

  .accountsModalBody {
    position: relative;
    z-index: 1;
  }

  .accountsIconBtnSoft {
    background:
      linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.018));
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.03),
      0 10px 28px rgba(0,0,0,0.18);
  }

  .accountsSpendModalStack {
    display: grid;
    gap: 14px;
  }

  .accountsSpendHeroShell {
    border-radius: 24px;
    border: 1px solid rgba(214,226,255,0.10);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.018)),
      rgba(8, 12, 20, 0.58);
    padding: 14px;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.035),
      0 0 0 1px rgba(255,255,255,0.01),
      0 24px 70px rgba(0,0,0,0.18);
  }

  .accountsSpendHeroHeader {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }

  .accountsSpendHeroTitle {
    margin-top: 8px;
    font-size: clamp(26px, 3.2vw, 38px);
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.055em;
    color: #fff;
  }

  .accountsSpendHeroSub {
    margin-top: 8px;
    max-width: 860px;
    font-size: 13px;
    line-height: 1.55;
    color: rgba(255,255,255,0.62);
  }

  .accountsSpendHeroPills {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .accountsSpendSummaryGridCommand {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-bottom: 0;
  }

  .accountsSpendHeroStat {
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.06);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
    padding: 14px;
    min-width: 0;
  }

  .accountsSpendHeroStatValue {
    font-size: clamp(23px, 2vw, 30px);
    line-height: 1.02;
    font-weight: 900;
    letter-spacing: -0.05em;
    color: #fff;
    overflow-wrap: anywhere;
  }

  .accountsSpendHeroStatValueText {
    font-size: clamp(19px, 1.6vw, 25px);
    line-height: 1.12;
  }

  .accountsSpendControlShell {
    border-radius: 22px;
    border: 1px solid rgba(214,226,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.012));
    padding: 12px;
  }

  .accountsSpendContentGridCommand {
    grid-template-columns: minmax(0, 1.12fr) minmax(310px, 0.88fr);
    gap: 14px;
  }

  .accountsSpendPrimaryPane {
    border-radius: 24px;
    border: 1px solid rgba(214,226,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.012));
    padding: 14px;
    min-height: 420px;
  }

  .accountsSpendSectionHead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .accountsSpendSectionHeadTight {
    margin-bottom: 10px;
  }

  .accountsSpendSectionTitle {
    font-size: 18px;
    line-height: 1.06;
    font-weight: 850;
    letter-spacing: -0.035em;
    color: #fff;
  }

  .accountsSpendSectionSub {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: rgba(255,255,255,0.58);
  }

  .accountsSpendRail {
    display: grid;
    gap: 12px;
    align-content: start;
  }

  .accountsSpendRailCard {
    border-radius: 22px;
    border: 1px solid rgba(214,226,255,0.08);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.012));
    padding: 14px;
  }

  .accountsSpendRailCardStrong {
    background:
      linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.016)),
      rgba(6, 12, 20, 0.44);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.03),
      0 18px 44px rgba(0,0,0,0.15);
  }

  .accountsSpendRailValue {
    font-size: clamp(26px, 2.4vw, 38px);
    line-height: 1.02;
    font-weight: 900;
    letter-spacing: -0.055em;
    color: #fff;
  }

  .accountsSpendRailMetricGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
  }

  .accountsSpendRailMetric {
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.022);
    padding: 10px 11px;
    min-width: 0;
  }

  .accountsSpendRailMetricValue {
    font-size: 13px;
    line-height: 1.32;
    font-weight: 850;
    color: #fff;
    overflow-wrap: anywhere;
  }

  .accountsSpendRailEmpty {
    min-height: 180px;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 12px;
  }

  .accountsSpendGroupListCommand {
    max-height: 540px;
  }

  .accountsSpendEmptyCard {
    min-height: 340px;
    border-radius: 22px;
    border: 1px solid rgba(255,255,255,0.06);
    background:
      radial-gradient(circle at top, rgba(120,142,255,0.07), transparent 38%),
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    display: grid;
    place-items: center;
    text-align: center;
    padding: 28px 24px;
  }

  .accountsSpendEmptyList {
    margin-top: 14px;
    display: grid;
    gap: 6px;
    font-size: 12px;
    line-height: 1.5;
    color: rgba(255,255,255,0.58);
    text-align: left;
    max-width: 560px;
  }

  .accountsSpendEmptyActions {
    margin-top: 16px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .accountsMiniBillListCommand {
    max-height: none;
  }

  @media (max-width: 1520px) {
    .accountsTopRightGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 1320px) {
    .accountsMetricGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .accountsMainGrid {
      grid-template-columns: 1fr;
    }

    .accountsSpendSummaryGrid,
    .accountsSpendSummaryGridCommand {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .accountsSpendControls {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .accountsSpendContentGrid,
    .accountsSpendContentGridCommand {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 1100px) {
    .accountsHeroGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 1024px) {
    .accountsRosterControls,
    .accountsActionGridTriplet,
    .accountsLedgerGrid,
    .accountsInfoGrid,
    .accountsSpendControls,
    .accountsLauncherStatGrid,
    .accountsSpendRailMetricGrid {
      grid-template-columns: 1fr;
    }

    .accountsLedgerRight {
      text-align: left;
    }

    .accountsCompactRow {
      grid-template-columns: 42px minmax(0, 1fr);
    }

    .accountsCompactValue {
      white-space: normal;
    }

    .accountsRosterListCompact,
    .accountsLedgerListTight,
    .accountsSpendGroupList,
    .accountsMiniBillList {
      max-height: none;
    }

    .accountsSpendLine,
    .accountsMiniBillRow {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .accountsPageShell {
      padding: 0 0 14px;
    }

    .accountsMetricGrid,
    .accountsSpendSummaryGrid {
      grid-template-columns: 1fr;
    }

    .accountsModalRoot {
      padding: 10px;
    }
  }
`;