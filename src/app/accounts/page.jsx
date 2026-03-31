"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  ChevronRight,
  CreditCard,
  Landmark,
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

export const dynamic = "force-dynamic";

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

function nowTs() {
  return Date.now();
}

function fmtMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtMoneyTight(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function fmtWhen(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

function typeEmoji(type) {
  const t = normalizeType(type);
  if (t === "checking") return "🏦";
  if (t === "savings") return "💰";
  if (t === "cash") return "💵";
  if (t === "credit") return "💳";
  if (t === "investment") return "📈";
  return "📁";
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

function mapAccountRowToClient(row) {
  return {
    id: row.id,
    name: row.name || "",
    type: row.account_type || "other",
    balance: safeNum(row.balance, 0),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : nowTs(),
  };
}

function mapAccountClientToRow(account, userId) {
  return {
    id: account.id,
    user_id: userId,
    name: account.name || "",
    account_type: account.type || "other",
    balance: safeNum(account.balance, 0),
    updated_at: new Date(account.updatedAt || nowTs()).toISOString(),
  };
}

function mapLedgerRowToClient(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    ts: row.created_at ? new Date(row.created_at).getTime() : nowTs(),
    kind: row.kind || "transaction",
    amount: safeNum(row.amount, 0),
    delta: safeNum(row.delta, 0),
    resultingBalance: safeNum(row.resulting_balance, 0),
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
    amount: safeNum(entry.amount, 0),
    delta: safeNum(entry.delta, 0),
    resulting_balance: safeNum(entry.resultingBalance, 0),
    note: entry.note || "",
    related_account_id: entry.relatedAccountId || null,
    related_account_name: entry.relatedAccountName || "",
    created_at: new Date(entry.ts || nowTs()).toISOString(),
  };
}

function getAdjustDelta(accountType, mode, absAmount) {
  const amount = Math.abs(safeNum(absAmount, 0));
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
  const absAmount = Math.abs(safeNum(amount, 0));
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

function Modal({ open, title, subtitle, onClose, children }) {
  if (!open) return null;

  return (
    <div className="accountsModalRoot">
      <div className="accountsModalBackdrop" onClick={onClose} />
      <div className="accountsModalCard">
        <GlassPane size="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 18,
                  lineHeight: 1.08,
                  fontWeight: 850,
                  letterSpacing: "-0.035em",
                  color: "#fff",
                }}
              >
                {title}
              </div>
              {subtitle ? (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.60)",
                    lineHeight: 1.45,
                  }}
                >
                  {subtitle}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 38,
                height: 38,
                borderRadius: 14,
                border: "1px solid rgba(214,226,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={16} />
            </button>
          </div>

          {children}
        </GlassPane>
      </div>
    </div>
  );
}

function CompactAccountRow({
  account,
  selected,
  primary,
  onSelect,
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

        <div className="accountsCompactSub">
          Updated {fmtWhen(account.updatedAt)}
        </div>
      </div>

      <div className="accountsCompactValue">{fmtMoney(account.balance)}</div>

      <div
        className="accountsCompactActions"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="accountsIconBtn"
          onClick={onEdit}
          aria-label="Edit account"
          title="Edit account"
        >
          <PencilLine size={14} />
        </button>
        <button
          type="button"
          className="accountsIconBtn"
          onClick={onSetPrimary}
          aria-label="Set primary"
          title="Set primary"
        >
          <Star size={14} />
        </button>
        <button
          type="button"
          className="accountsIconBtn accountsDangerBtn"
          onClick={onDelete}
          aria-label="Delete account"
          title="Delete account"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function FocusCard({
  selectedAccount,
  primaryId,
  onAdjust,
  onTransfer,
  onSetExact,
  onEdit,
}) {
  if (!selectedAccount) {
    return (
      <GlassPane size="card">
        <PaneHeader
          title="Selected Account"
          subcopy="Choose one from the roster to work it here."
        />
        <div className="accountsEmptyState" style={{ minHeight: 170 }}>
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

  return (
    <GlassPane tone={tone} size="card">
      <PaneHeader
        title={selectedAccount.name}
        subcopy="Focused controls for the account you are actively touching."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {selectedAccount.id === primaryId ? <MiniPill>Primary</MiniPill> : null}
            <MiniPill tone={tone}>
              {typeEmoji(selectedAccount.type)} {typeLabel(selectedAccount.type)}
            </MiniPill>
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

        <div className="accountsActionGrid" style={{ marginTop: 14 }}>
          <ActionBtn variant="primary" onClick={onAdjust} full>
            <Wallet size={14} /> Add Transaction
          </ActionBtn>
          <ActionBtn onClick={onTransfer} full>
            <ArrowRightLeft size={14} /> Transfer
          </ActionBtn>
          <ActionBtn onClick={onSetExact} full>
            <Landmark size={14} /> Set Exact
          </ActionBtn>
          <ActionBtn onClick={onEdit} full>
            <PencilLine size={14} /> Edit Account
          </ActionBtn>
        </div>
      </div>
    </GlassPane>
  );
}

function AddAccountCard({ adding, setAdding, addAccount }) {
  return (
    <GlassPane size="card">
      <PaneHeader
        title="Add Account"
        subcopy="Keep this fast and real."
        right={<MiniPill><Plus size={13} /> New</MiniPill>}
      />

      <form onSubmit={addAccount} className="accountsFormStack">
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
            placeholder="Starting balance"
            value={adding.balance}
            onChange={(e) => setAdding((p) => ({ ...p, balance: e.target.value }))}
          />
        </div>

        <ActionBtn variant="primary" type="submit" full>
          <Plus size={14} /> Add Account
        </ActionBtn>

        <div className="accountsFootnote">
          Credit accounts should store the amount owed as a positive number. If you ever overpay one, it can go negative.
        </div>
      </form>
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

          <div className="accountsLedgerTitle">
            {item.note || "No note"}
          </div>

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
            {item.delta > 0 ? "+" : item.delta < 0 ? "−" : ""}
            {fmtMoneyTight(Math.abs(item.delta))}
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
            {fmtMoneyTight(item.resultingBalance)}
          </div>
        </div>
      </div>
    </div>
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

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState("updated");
  const [ledgerSearch, setLedgerSearch] = useState("");

  const [adding, setAdding] = useState({
    name: "",
    type: "checking",
    balance: "",
  });

  const [selectedAccountId, setSelectedAccountId] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("adjust");
  const [modalAccountId, setModalAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [adjustMode, setAdjustMode] = useState("increase");
  const [transferToId, setTransferToId] = useState("");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("checking");

  useEffect(() => {
    if (!status) return undefined;
    const id = window.setTimeout(() => setStatus(""), 3000);
    return () => window.clearTimeout(id);
  }, [status]);

  const loadData = useCallback(
    async (userId, preferredSelectedId = "") => {
      if (!userId || !supabase) return;

      const [accRes, settingsRes, ledgerRes] = await Promise.all([
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
      ]);

      if (accRes.error) throw accRes.error;
      if (settingsRes.error) throw settingsRes.error;
      if (ledgerRes.error) throw ledgerRes.error;

      const loadedAccounts = (accRes.data || []).map(mapAccountRowToClient);
      const storedPrimary = settingsRes.data?.primary_account_id || "";

      const resolvedPrimary =
        storedPrimary && loadedAccounts.some((a) => a.id === storedPrimary)
          ? storedPrimary
          : loadedAccounts[0]?.id || "";

      if (resolvedPrimary && resolvedPrimary !== storedPrimary) {
        await supabase.from("account_settings").upsert(
          {
            user_id: userId,
            primary_account_id: resolvedPrimary,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }

      const nextSelected =
        preferredSelectedId && loadedAccounts.some((a) => a.id === preferredSelectedId)
          ? preferredSelectedId
          : selectedAccountId && loadedAccounts.some((a) => a.id === selectedAccountId)
          ? selectedAccountId
          : resolvedPrimary || loadedAccounts[0]?.id || "";

      setAccounts(loadedAccounts);
      setPrimaryId(resolvedPrimary);
      setSelectedAccountId(nextSelected);
      setLedger((ledgerRes.data || []).map(mapLedgerRowToClient));
    },
    [selectedAccountId]
  );

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

    const netWorth = assetBalances - liabilityNet;

    const updatedMax = accounts.reduce(
      (mx, a) => Math.max(mx, safeNum(a.updatedAt, 0)),
      0
    );

    return {
      liquid,
      invest,
      creditExposure,
      assetBalances,
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
      list.sort((a, b) => Math.abs(safeNum(b.balance, 0)) - Math.abs(safeNum(a.balance, 0)));
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
          fmtMoneyTight(x.amount),
          fmtMoneyTight(x.resultingBalance),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => safeNum(b.ts, 0) - safeNum(a.ts, 0));
  }, [ledger, selectedAccountId, ledgerSearch]);

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

    const { error } = await supabase
      .from("accounts")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
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
    setPrimaryId(nextId);

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
      await loadData(user.id, nextId);
      return;
    }

    setStatus("Primary account updated.");
  }

  async function addAccount(e) {
    e.preventDefault();
    setPageError("");

    if (!user || !supabase) return;

    const name = adding.name.trim();
    if (!name) {
      setPageError("Account name is required.");
      return;
    }

    const bal = adding.balance.trim() ? parseMoneyInput(adding.balance) : 0;
    if (adding.balance.trim() && !Number.isFinite(bal)) {
      setPageError("Enter a valid starting balance.");
      return;
    }

    const nextAcc = {
      id: uid(),
      name,
      type: adding.type,
      balance: Number.isFinite(bal) ? bal : 0,
      updatedAt: nowTs(),
    };

    const { data, error } = await supabase
      .from("accounts")
      .insert([mapAccountClientToRow(nextAcc, user.id)])
      .select()
      .single();

    if (error) {
      setPageError(error.message || "Failed to add account.");
      return;
    }

    const saved = mapAccountRowToClient(data);

    const ledgerRes = await insertLedgerEntries([
      {
        id: uid(),
        ts: nowTs(),
        kind: "create",
        accountId: saved.id,
        amount: Math.abs(safeNum(saved.balance, 0)),
        delta: safeNum(saved.balance, 0),
        resultingBalance: safeNum(saved.balance, 0),
        note: "Account created",
        relatedAccountId: "",
        relatedAccountName: "",
      },
    ]);

    if (!ledgerRes.ok) {
      setPageError(ledgerRes.error || "Account was added but ledger creation failed.");
    }

    if (!primaryId) {
      await savePrimary(saved.id);
    }

    await loadData(user.id, saved.id);
    setAdding({ name: "", type: "checking", balance: "" });
    setStatus("Account added.");
  }

  async function deleteAccount(id) {
    if (!user || !supabase) return;

    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;

    if (accounts.length <= 1) {
      setPageError("You need at least one account.");
      return;
    }

    const ok = window.confirm(`Delete "${acc.name}" and its ledger history?`);
    if (!ok) return;

    setPageError("");

    const nextPrimary =
      primaryId === id
        ? accounts.find((a) => a.id !== id)?.id || ""
        : primaryId;

    const deleteLedgerRes = await supabase
      .from("account_transactions")
      .delete()
      .eq("user_id", user.id)
      .eq("account_id", id);

    if (deleteLedgerRes.error) {
      setPageError(deleteLedgerRes.error.message || "Failed to remove ledger.");
      return;
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

    if (nextPrimary) {
      await savePrimary(nextPrimary);
    }

    await loadData(user.id, nextPrimary);
    setStatus("Account deleted.");
  }

  function openModal(type, accountId) {
    const acc = accounts.find((a) => a.id === accountId) || null;
    setModalType(type);
    setModalAccountId(accountId);
    setModalOpen(true);
    setAmount("");
    setNote("");
    setAdjustMode("increase");
    setTransferToId("");
    setEditName(acc?.name || "");
    setEditType(acc?.type || "checking");
  }

  async function applyModal() {
    setPageError("");
    if (!modalAccount || !user || !supabase) return;

    if (modalType === "edit") {
      const name = editName.trim();
      if (!name) {
        setPageError("Account name is required.");
        return;
      }

      const res = await updateAccountColumns(modalAccount.id, {
        name,
        account_type: editType,
      });

      if (!res.ok) {
        setPageError(res.error || "Failed to update account.");
        return;
      }

      await loadData(user.id, modalAccount.id);
      setModalOpen(false);
      setStatus("Account updated.");
      return;
    }

    if (modalType === "set") {
      const exact = parseMoneyInput(amount);

      if (!Number.isFinite(exact)) {
        setPageError("Enter a valid balance.");
        return;
      }

      const oldBalance = safeNum(modalAccount.balance, 0);

      const updateRes = await updateAccountColumns(modalAccount.id, {
        balance: exact,
      });

      if (!updateRes.ok) {
        setPageError(updateRes.error || "Failed to set balance.");
        return;
      }

      const ledgerRes = await insertLedgerEntries([
        {
          id: uid(),
          ts: nowTs(),
          kind: "set",
          accountId: modalAccount.id,
          amount: Math.abs(exact),
          delta: exact - oldBalance,
          resultingBalance: exact,
          note: note.trim() || "Manual balance set",
          relatedAccountId: "",
          relatedAccountName: "",
        },
      ]);

      if (!ledgerRes.ok) {
        await updateAccountColumns(modalAccount.id, { balance: oldBalance });
        await loadData(user.id, modalAccount.id);
        setPageError(ledgerRes.error || "Failed to save ledger. Balance rolled back.");
        return;
      }

      await loadData(user.id, modalAccount.id);
      setModalOpen(false);
      setStatus("Balance updated.");
      return;
    }

    if (modalType === "adjust") {
      const absAmount = parseMoneyInput(amount);
      if (!Number.isFinite(absAmount) || absAmount <= 0) {
        setPageError("Enter a valid amount.");
        return;
      }

      const current = safeNum(modalAccount.balance, 0);
      const delta = getAdjustDelta(modalAccount.type, adjustMode, absAmount);
      const nextBalance = current + delta;
      const kind = getAdjustKind(modalAccount.type, adjustMode);

      const updateRes = await updateAccountColumns(modalAccount.id, {
        balance: nextBalance,
      });

      if (!updateRes.ok) {
        setPageError(updateRes.error || "Failed to update balance.");
        return;
      }

      const ledgerRes = await insertLedgerEntries([
        {
          id: uid(),
          ts: nowTs(),
          kind,
          accountId: modalAccount.id,
          amount: Math.abs(absAmount),
          delta,
          resultingBalance: nextBalance,
          note: note.trim() || "",
          relatedAccountId: "",
          relatedAccountName: "",
        },
      ]);

      if (!ledgerRes.ok) {
        await updateAccountColumns(modalAccount.id, { balance: current });
        await loadData(user.id, modalAccount.id);
        setPageError(ledgerRes.error || "Failed to save ledger. Balance rolled back.");
        return;
      }

      await loadData(user.id, modalAccount.id);
      setModalOpen(false);
      setStatus("Transaction applied.");
      return;
    }

    if (modalType === "transfer") {
      const absAmount = parseMoneyInput(amount);
      const target = accounts.find((a) => a.id === transferToId);

      if (!Number.isFinite(absAmount) || absAmount <= 0) {
        setPageError("Enter a valid amount.");
        return;
      }

      if (!target) {
        setPageError("Choose the destination account.");
        return;
      }

      if (target.id === modalAccount.id) {
        setPageError("Cannot transfer to the same account.");
        return;
      }

      const plan = getTransferPlan(modalAccount, target, absAmount);
      const fromCurrent = safeNum(modalAccount.balance, 0);
      const toCurrent = safeNum(target.balance, 0);
      const fromNext = fromCurrent + plan.fromDelta;
      const toNext = toCurrent + plan.toDelta;
      const sharedNote = note.trim() || "Transfer between accounts";

      const fromRes = await updateAccountColumns(modalAccount.id, {
        balance: fromNext,
      });

      if (!fromRes.ok) {
        setPageError(fromRes.error || "Failed to update source account.");
        return;
      }

      const toRes = await updateAccountColumns(target.id, {
        balance: toNext,
      });

      if (!toRes.ok) {
        await updateAccountColumns(modalAccount.id, { balance: fromCurrent });
        await loadData(user.id, modalAccount.id);
        setPageError(toRes.error || "Failed to update destination account.");
        return;
      }

      const ledgerRes = await insertLedgerEntries([
        {
          id: uid(),
          ts: nowTs(),
          kind: plan.fromKind,
          accountId: modalAccount.id,
          amount: Math.abs(absAmount),
          delta: plan.fromDelta,
          resultingBalance: fromNext,
          note: sharedNote,
          relatedAccountId: target.id,
          relatedAccountName: target.name,
        },
        {
          id: uid(),
          ts: nowTs(),
          kind: plan.toKind,
          accountId: target.id,
          amount: Math.abs(absAmount),
          delta: plan.toDelta,
          resultingBalance: toNext,
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
        return;
      }

      await loadData(user.id, modalAccount.id);
      setModalOpen(false);
      setStatus("Transfer completed.");
    }
  }

  const currentMonth = new Date().toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const modalIsCredit = isCreditType(modalAccount?.type);
  const adjustIncreaseLabel = modalIsCredit ? "Charge" : "Deposit";
  const adjustDecreaseLabel = modalIsCredit ? "Payment" : "Withdraw";

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
      <main className="accountsPage">
        <div className="accountsPageShell">
          {pageError ? (
            <GlassPane tone="red" size="card">
              <div style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>
                Accounts error
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

          {status ? (
            <GlassPane tone="green" size="card">
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 14,
                  color: "#9ef0c0",
                }}
              >
                {status}
              </div>
            </GlassPane>
          ) : null}

          <GlassPane size="card">
            <div className="accountsHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div className="accountsEyebrow">Life Command Center</div>
                <div className="accountsHeroTitle">Accounts Command</div>
                <div className="accountsHeroSub">
                  Clean balances, faster controls, and better money math.
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
                <MiniPill>{fmtWhen(totals.updatedMax)}</MiniPill>
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
                accounts
                  .filter((a) => isCreditType(a.type))
                  .reduce((sum, a) => sum + safeNum(a.balance, 0), 0)
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
            <GlassPane size="card">
              <PaneHeader
                title="Account Roster"
                subcopy="Compact list on the left. Work the selected account on the right."
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
                      onSelect={() => setSelectedAccountId(a.id)}
                      onEdit={() => openModal("edit", a.id)}
                      onSetPrimary={() => savePrimary(a.id)}
                      onDelete={() => deleteAccount(a.id)}
                    />
                  ))}
                </div>
              ) : accounts.length === 0 ? (
                <div className="accountsEmptyState">
                  <div>
                    <div className="accountsEmptyTitle">No accounts yet</div>
                    <div className="accountsEmptyText">
                      Start by adding a real account. This page no longer seeds fake ones.
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
                  onAdjust={() => selectedAccount && openModal("adjust", selectedAccount.id)}
                  onTransfer={() => selectedAccount && openModal("transfer", selectedAccount.id)}
                  onSetExact={() => selectedAccount && openModal("set", selectedAccount.id)}
                  onEdit={() => selectedAccount && openModal("edit", selectedAccount.id)}
                />

                <AddAccountCard
                  adding={adding}
                  setAdding={setAdding}
                  addAccount={addAccount}
                />
              </div>

              <GlassPane size="card">
                <PaneHeader
                  title={
                    selectedAccount
                      ? `${selectedAccount.name} Ledger`
                      : "Transaction Ledger"
                  }
                  subcopy="Movement history for the selected account."
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
                          Transactions, transfers, and exact balance sets will land here.
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
        onClose={() => setModalOpen(false)}
        title={
          modalType === "edit"
            ? `Edit ${modalAccount?.name || "account"}`
            : modalType === "transfer"
            ? `Transfer from ${modalAccount?.name || "account"}`
            : modalType === "set"
            ? `Set exact balance for ${modalAccount?.name || "account"}`
            : `Adjust ${modalAccount?.name || "account"}`
        }
        subtitle="This writes to the account and saves matching ledger entries."
      >
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
              Cash → credit reduces debt. Credit → cash increases debt. Credit → credit works like a balance transfer.
            </div>
          </div>
        ) : null}

        {modalType === "set" ? (
          <div className="accountsFormStack">
            <div>
              <div className="accountsTinyLabel">Exact Balance</div>
              <input
                className="accountsField"
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
          <ActionBtn onClick={() => setModalOpen(false)}>Cancel</ActionBtn>
          <ActionBtn variant="primary" onClick={applyModal}>
            Apply <ChevronRight size={14} />
          </ActionBtn>
        </div>
      </Modal>

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
    max-width: 760px;
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
    grid-template-columns: minmax(360px, 0.94fr) minmax(0, 1.06fr);
    gap: 12px;
    align-items: start;
  }

  .accountsRightStack {
    display: grid;
    gap: 12px;
  }

  .accountsTopRightGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.02fr) minmax(300px, 0.82fr);
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
    max-height: 620px;
    overflow: auto;
    padding-right: 2px;
  }

  .accountsCompactRow {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto auto;
    gap: 10px;
    align-items: center;
    min-height: 78px;
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

  .accountsCompactActions {
    display: flex;
    gap: 6px;
    align-items: center;
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

  .accountsDangerBtn {
    border-color: rgba(255,132,163,0.18);
    color: #ffd3df;
  }

  .accountsFocusBox {
    border-radius: 22px;
    border: 1px solid rgba(214,226,255,0.12);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
    padding: 16px;
  }

  .accountsActionGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
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

  .accountsLedgerList {
    display: grid;
    gap: 10px;
  }

  .accountsLedgerListTight {
    max-height: 460px;
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
    max-width: 360px;
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
    width: min(100%, 720px);
    max-height: min(88vh, 920px);
    overflow: auto;
  }

  @media (max-width: 1260px) {
    .accountsMetricGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .accountsTopRightGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 1100px) {
    .accountsHeroGrid,
    .accountsMainGrid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 1024px) {
    .accountsRosterControls,
    .accountsActionGrid,
    .accountsLedgerGrid {
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

    .accountsCompactActions {
      grid-column: 2;
      justify-content: flex-start;
    }
  }

  @media (max-width: 760px) {
    .accountsPageShell {
      padding: 0 0 14px;
    }

    .accountsMetricGrid,
    .accountsTopRightGrid {
      grid-template-columns: 1fr;
    }

    .accountsModalRoot {
      padding: 10px;
    }
  }

  @media (max-width: 640px) {
    .accountsMetricGrid,
    .accountsActionGrid {
      grid-template-columns: 1fr;
    }
  }
`;