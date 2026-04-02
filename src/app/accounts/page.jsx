"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  ChevronRight,
  Landmark,
  PiggyBank,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../components/GlassPane";

const META_PREFIX = "__LCC_META__";
const SAFE_BUFFER_STORAGE_KEY = "lcc-account-safe-buffers";

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
      className="accountActionBtn"
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

function MetricCard({ icon: Icon, label, value, detail, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <GlassPane tone={tone === "blue" ? "neutral" : tone} size="card" style={{ height: "100%" }}>
      <div
        style={{
          minHeight: 110,
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

function getIncomeRouting(row, defaultAccountId) {
  const { meta } = extractStoredNote(row.note);
  const posted = !!meta?.posted;
  const status =
    meta?.status === "scheduled" || isFutureDate(row.deposit_date) ? "scheduled" : "received";

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
    height: 24 + ((v.value - min) / range) * 60,
  }));
}

function AccountRailCard({ account, summary, selected, onSelect }) {
  const tone = summary?.atRisk ? "amber" : accountTone(account.account_type);
  const meta = toneMeta(tone);

  return (
    <button
      type="button"
      className="accountRailCard"
      onClick={onSelect}
      style={{
        borderColor: selected ? meta.border : "rgba(255,255,255,0.07)",
        boxShadow: selected
          ? `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(255,255,255,0.01), 0 0 24px ${meta.glow}`
          : "inset 0 1px 0 rgba(255,255,255,0.025)",
      }}
    >
      <div className="accountRailCardTop">
        <div style={{ minWidth: 0 }}>
          <div className="accountRailCardTitle">{account.name || "Account"}</div>
          <div className="accountRailCardSub">{normalizeAccountType(account.account_type)}</div>
        </div>

        <div className="accountRailCardRight">
          {summary?.atRisk ? <MiniPill tone="amber">Watch</MiniPill> : null}
          <ChevronRight size={14} style={{ opacity: 0.55 }} />
        </div>
      </div>

      <div className="accountRailBalance">{fmtMoney(account.balance)}</div>

      <div className="accountRailGrid">
        <div className="accountRailStat">
          <div className="accountTinyLabel">30D Change</div>
          <div
            className="accountRailStatValue"
            style={{
              color: safeNum(summary?.last30Delta, 0) >= 0 ? "#97efc7" : "#ffb4c5",
            }}
          >
            {safeNum(summary?.last30Delta, 0) >= 0 ? "+" : ""}
            {fmtMoney(summary?.last30Delta)}
          </div>
        </div>

        <div className="accountRailStat">
          <div className="accountTinyLabel">Next Bill</div>
          <div className="accountRailStatValue">
            {summary?.nextBill ? shortDate(summary.nextBill.due_date) : "Clear"}
          </div>
        </div>
      </div>

      <div className="accountRailFooter">
        <div>
          <span className="accountTinyLabel">14D Projection</span>
          <div className="accountRailFooterValue">{fmtMoney(summary?.projected14)}</div>
        </div>

        {summary?.nextIncome ? (
          <MiniPill tone="green">{shortDate(summary.nextIncome.deposit_date)}</MiniPill>
        ) : (
          <MiniPill>no deposit</MiniPill>
        )}
      </div>
    </button>
  );
}

function BalanceBars({ bars = [] }) {
  if (!bars.length) {
    return (
      <div className="accountBarsEmpty">
        <div>No recent balance movement yet.</div>
      </div>
    );
  }

  return (
    <div className="accountBarsWrap">
      {bars.map((bar) => (
        <div key={bar.key} className="accountBarCol" title={`${bar.label} • ${fmtMoney(bar.value)}`}>
          <div className="accountBarFill" style={{ height: bar.height }} />
        </div>
      ))}
    </div>
  );
}

function TransactionRow({ tx }) {
  const delta = safeNum(tx.delta, 0);
  const positive = delta >= 0;
  const bucket = flowBucket(tx);

  return (
    <div className="accountTxRow">
      <div>
        <div className="accountTxTitle">{tx.note || bucket}</div>
        <div className="accountTxSub">
          {shortDate(tx.created_at)} • {bucket}
          {tx.related_account_name ? ` • ${tx.related_account_name}` : ""}
          {tx.source_type ? ` • ${String(tx.source_type).replaceAll("_", " ")}` : ""}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div
          className="accountTxAmount"
          style={{ color: positive ? "#97efc7" : "#ffb4c5" }}
        >
          {positive ? "+" : ""}
          {fmtMoney(delta)}
        </div>
        <div className="accountTxSub">Bal {fmtMoney(tx.resulting_balance)}</div>
      </div>
    </div>
  );
}

function ForecastEventRow({ event }) {
  const tone = event.kind === "income" ? "green" : "amber";
  const afterPositive = safeNum(event.afterBalance, 0) >= 0;

  return (
    <div className="accountForecastRow">
      <div>
        <div className="accountTxTitle">{event.label}</div>
        <div className="accountTxSub">
          {shortDate(event.date)} • {event.kind === "income" ? "Incoming" : "Outgoing"}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div className="accountTxAmount" style={{ color: toneMeta(tone).text }}>
          {event.delta >= 0 ? "+" : ""}
          {fmtMoney(event.delta)}
        </div>
        <div
          className="accountTxSub"
          style={{ color: afterPositive ? "rgba(255,255,255,0.58)" : "#ffb4c5" }}
        >
          After {fmtMoney(event.afterBalance)}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ label, active, onClick }) {
  return (
    <button
      type="button"
      className="accountTabBtn"
      onClick={onClick}
      style={{
        borderColor: active ? "rgba(143,177,255,0.24)" : "rgba(214,226,255,0.10)",
        background: active
          ? "linear-gradient(180deg, rgba(143,177,255,0.14), rgba(143,177,255,0.06))"
          : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
      }}
    >
      {label}
    </button>
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
    <div className="accountsQuickInfoRow">
      <span>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [bills, setBills] = useState([]);
  const [incomeRows, setIncomeRows] = useState([]);
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [defaultAccountName, setDefaultAccountName] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [tab, setTab] = useState("activity");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [safeBufferMap, setSafeBufferMap] = useState({});
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

  async function loadAccountsPage() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);

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
      setDefaultAccountName("");
      setSelectedAccountId("");
      setLoading(false);
      return;
    }

    setUserId(session.user.id);

    const [accountsRes, txRes, settingsRes, billsRes, incomeRes] = await Promise.all([
      supabase
        .from("accounts")
        .select("id, user_id, name, account_type, balance, updated_at")
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

    if (accountsRes.error) console.error("load accounts error:", accountsRes.error);
    if (txRes.error) console.error("load transactions error:", txRes.error);
    if (settingsRes.error) console.error("load account settings error:", settingsRes.error);
    if (billsRes.error) console.error("load bills error:", billsRes.error);
    if (incomeRes.error) console.error("load income routing error:", incomeRes.error);

    const loadedAccounts = accountsRes.data || [];
    const primaryAccountId = settingsRes.data?.primary_account_id || "";
    const primaryAccount =
      loadedAccounts.find((account) => account.id === primaryAccountId) || null;

    setAccounts(loadedAccounts);
    setTransactions(txRes.data || []);
    setBills((billsRes.data || []).filter((row) => row.active !== false));
    setIncomeRows(incomeRes.data || []);
    setDefaultAccountId(primaryAccountId);
    setDefaultAccountName(primaryAccount?.name || "");
    setSelectedAccountId((prev) => prev || loadedAccounts[0]?.id || "");
    setLoading(false);
  }

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
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SAFE_BUFFER_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setSafeBufferMap(parsed);
      }
    } catch {
      //
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SAFE_BUFFER_STORAGE_KEY, JSON.stringify(safeBufferMap));
    } catch {
      //
    }
  }, [safeBufferMap]);

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

      const safeBuffer = safeNum(safeBufferMap[account.id], 150);
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

      result[account.id] = {
        account,
        transactions: accountTxs,
        recentTransactions: accountTxs.slice(0, 40),
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
        atRisk: projected14 < safeBuffer || lowPoint < 0,
        flowMix: [...flowMixMap.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
      };
    });

    return result;
  }, [accounts, transactions, bills, incomeRows, defaultAccountId, safeBufferMap]);

  const totalCash = useMemo(() => {
    return round2(accounts.reduce((sum, account) => sum + safeNum(account.balance, 0), 0));
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

    return accounts.filter((account) => {
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
  }, [accounts, accountSearch, accountFilter, summaryById]);

  useEffect(() => {
    if (!visibleAccounts.length) {
      setSelectedAccountId("");
      return;
    }

    const exists = visibleAccounts.some((account) => account.id === selectedAccountId);
    if (!exists) {
      setSelectedAccountId(visibleAccounts[0].id);
    }
  }, [visibleAccounts, selectedAccountId]);

  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) || visibleAccounts[0] || null;

  const selectedSummary = selectedAccount ? summaryById[selectedAccount.id] : null;

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

  async function setPrimaryAccount() {
    if (!supabase || !userId || !selectedAccount || busy) return;

    setBusy(true);

    const { error } = await supabase.from("account_settings").upsert(
      {
        user_id: userId,
        primary_account_id: selectedAccount.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("set primary account error:", error);
      setBusy(false);
      return;
    }

    setDefaultAccountId(selectedAccount.id);
    setDefaultAccountName(selectedAccount.name || "");
    setBusy(false);
  }

  async function addManualAdjustment() {
    if (!supabase || !userId || !selectedAccount || busy) return;

    const rawAmount = round2(parseMoneyInput(adjustForm.amount));
    const note = String(adjustForm.note || "").trim();
    const signedDelta = adjustForm.mode === "subtract" ? -Math.abs(rawAmount) : Math.abs(rawAmount);

    if (!Number.isFinite(rawAmount) || rawAmount <= 0) return;

    const nextBalance = round2(safeNum(selectedAccount.balance, 0) + signedDelta);
    const nowIso = new Date().toISOString();

    setBusy(true);

    const updateRes = await supabase
      .from("accounts")
      .update({
        balance: nextBalance,
        updated_at: nowIso,
      })
      .eq("id", selectedAccount.id)
      .eq("user_id", userId);

    if (updateRes.error) {
      console.error("adjustment account update error:", updateRes.error);
      setBusy(false);
      return;
    }

    const insertRes = await supabase
      .from("account_transactions")
      .insert({
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
      })
      .select(
        "id, user_id, account_id, kind, amount, delta, resulting_balance, note, related_account_id, related_account_name, source_type, source_id, created_at"
      )
      .single();

    if (insertRes.error) {
      console.error("adjustment transaction insert error:", insertRes.error);
      await loadAccountsPage();
      setBusy(false);
      return;
    }

    setAccounts((prev) =>
      prev.map((account) =>
        account.id === selectedAccount.id
          ? { ...account, balance: nextBalance, updated_at: nowIso }
          : account
      )
    );
    setTransactions((prev) => [insertRes.data, ...prev]);
    setAdjustForm({
      mode: "add",
      amount: "",
      note: "",
    });
    setBusy(false);
  }

  async function submitTransfer() {
    if (!supabase || !userId || !selectedAccount || busy) return;

    const amount = round2(parseMoneyInput(transferForm.amount));
    const note = String(transferForm.note || "").trim();
    const target = accounts.find((account) => account.id === transferForm.toAccountId);

    if (!target || target.id === selectedAccount.id) return;
    if (!Number.isFinite(amount) || amount <= 0) return;

    const sourceNextBalance = round2(safeNum(selectedAccount.balance, 0) - amount);
    const targetNextBalance = round2(safeNum(target.balance, 0) + amount);
    const nowIso = new Date().toISOString();

    setBusy(true);

    const sourceUpdate = await supabase
      .from("accounts")
      .update({
        balance: sourceNextBalance,
        updated_at: nowIso,
      })
      .eq("id", selectedAccount.id)
      .eq("user_id", userId);

    if (sourceUpdate.error) {
      console.error("transfer source update error:", sourceUpdate.error);
      setBusy(false);
      return;
    }

    const targetUpdate = await supabase
      .from("accounts")
      .update({
        balance: targetNextBalance,
        updated_at: nowIso,
      })
      .eq("id", target.id)
      .eq("user_id", userId);

    if (targetUpdate.error) {
      console.error("transfer target update error:", targetUpdate.error);
      await loadAccountsPage();
      setBusy(false);
      return;
    }

    const txRes = await supabase
      .from("account_transactions")
      .insert([
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
          source_id: uid(),
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
          source_id: uid(),
          created_at: nowIso,
        },
      ])
      .select(
        "id, user_id, account_id, kind, amount, delta, resulting_balance, note, related_account_id, related_account_name, source_type, source_id, created_at"
      );

    if (txRes.error) {
      console.error("transfer transaction insert error:", txRes.error);
      await loadAccountsPage();
      setBusy(false);
      return;
    }

    setAccounts((prev) =>
      prev.map((account) => {
        if (account.id === selectedAccount.id) {
          return { ...account, balance: sourceNextBalance, updated_at: nowIso };
        }
        if (account.id === target.id) {
          return { ...account, balance: targetNextBalance, updated_at: nowIso };
        }
        return account;
      })
    );
    setTransactions((prev) => [...(txRes.data || []), ...prev]);
    setTransferForm({
      toAccountId: target.id,
      amount: "",
      note: "",
    });
    setBusy(false);
  }

  if (loading) {
    return (
      <main className="accountsPage">
        <div className="accountsShell">
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
              Loading account command.
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
        <div className="accountsShell">
          <GlassPane size="card">
            <div className="accountsHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div className="accountsEyebrow">Life Command Center</div>
                <div className="accountsHeroTitle">Account Command</div>
                <div className="accountsHeroSub">
                  Open an account like a bank detail view without leaving the page. The account
                  list stays on the left. The selected account opens into one continuous workspace
                  instead of a bunch of broken-up floating panels.
                </div>

                <div className="accountsPillRow">
                  <MiniPill>{accounts.length} accounts</MiniPill>
                  <MiniPill>{defaultAccountName || "No primary set"}</MiniPill>
                  <MiniPill tone="amber">{atRiskCount} at risk</MiniPill>
                  {selectedAccount ? <MiniPill tone="blue">{selectedAccount.name}</MiniPill> : null}
                </div>
              </div>

              <div className="accountsHeroSide">
                <MiniPill>{fmtWhen(new Date().toISOString())}</MiniPill>
                <MiniPill tone="green">{fmtMoney(totalCash)} total cash</MiniPill>
              </div>
            </div>
          </GlassPane>

          <section className="accountsMetricGrid">
            <MetricCard
              icon={Wallet}
              label="Total Cash"
              value={fmtMoney(totalCash)}
              detail="Combined balance across loaded accounts."
              tone="green"
            />
            <MetricCard
              icon={Landmark}
              label="Checking"
              value={fmtMoney(checkingTotal)}
              detail="Cash sitting in checking-type accounts."
              tone="blue"
            />
            <MetricCard
              icon={PiggyBank}
              label="Savings"
              value={fmtMoney(savingsTotal)}
              detail="Savings parked and ready for buffer or goals."
              tone="green"
            />
            <MetricCard
              icon={ShieldAlert}
              label="At Risk"
              value={String(atRiskCount)}
              detail="Accounts projected below the safe buffer in the next 14 days."
              tone={atRiskCount > 0 ? "amber" : "neutral"}
            />
          </section>

          <section className="accountsWorkspaceGrid">
            <GlassPane size="card" style={{ height: "100%" }}>
              <PaneHeader
                title="Accounts"
                subcopy="Click one to open it inside the command workspace."
                right={<MiniPill>{visibleAccounts.length} showing</MiniPill>}
              />

              <div className="accountsRailControls">
                <div className="accountsSearchWrap">
                  <Search size={15} />
                  <input
                    className="accountsField accountsSearchField"
                    placeholder="Search accounts"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                  />
                </div>

                <select
                  className="accountsField"
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

              {visibleAccounts.length ? (
                <div className="accountsRailList">
                  {visibleAccounts.map((account) => (
                    <AccountRailCard
                      key={account.id}
                      account={account}
                      summary={summaryById[account.id]}
                      selected={account.id === selectedAccount?.id}
                      onSelect={() => setSelectedAccountId(account.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="accountsEmptyState">
                  <div>
                    <div className="accountsEmptyTitle">No accounts found</div>
                    <div className="accountsEmptyText">
                      Clear the filter or add an account first.
                    </div>
                  </div>
                </div>
              )}
            </GlassPane>

            <GlassPane size="card" style={{ height: "100%" }}>
              <div className="accountsWorkspaceShell">
                {selectedAccount && selectedSummary ? (
                  <>
                    <section className="accountsSurfaceSection accountsSurfaceHero">
                      <PaneHeader
                        title={selectedAccount.name || "Account Focus"}
                        subcopy={`${normalizeAccountType(
                          selectedAccount.account_type
                        )} • Updated ${formatAgo(selectedAccount.updated_at)}`}
                        right={
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {defaultAccountId === selectedAccount.id ? (
                              <MiniPill tone="green">Primary</MiniPill>
                            ) : null}
                            {selectedSummary.atRisk ? (
                              <MiniPill tone="amber">Low buffer risk</MiniPill>
                            ) : (
                              <MiniPill tone="blue">Stable</MiniPill>
                            )}
                          </div>
                        }
                      />

                      <div className="accountsFocusHero">
                        <div className="accountsFocusLeft">
                          <div className="accountTinyLabel">Live Balance</div>
                          <div className="accountsFocusBalance">
                            {fmtMoney(selectedAccount.balance)}
                          </div>

                          <div className="accountsFocusGrid">
                            <div className="accountsInfoCell">
                              <div className="accountTinyLabel">30D Change</div>
                              <div
                                className="accountsInfoValue"
                                style={{
                                  color:
                                    safeNum(selectedSummary.last30Delta, 0) >= 0
                                      ? "#97efc7"
                                      : "#ffb4c5",
                                }}
                              >
                                {safeNum(selectedSummary.last30Delta, 0) >= 0 ? "+" : ""}
                                {fmtMoney(selectedSummary.last30Delta)}
                              </div>
                              <div className="accountsInfoSub">Trailing 30 day ledger movement</div>
                            </div>

                            <div className="accountsInfoCell">
                              <div className="accountTinyLabel">Projected 14D</div>
                              <div className="accountsInfoValue">
                                {fmtMoney(selectedSummary.projected14)}
                              </div>
                              <div className="accountsInfoSub">
                                Income minus bills over the next two weeks
                              </div>
                            </div>

                            <div className="accountsInfoCell">
                              <div className="accountTinyLabel">Next Bill</div>
                              <div className="accountsInfoValue">
                                {selectedSummary.nextBill
                                  ? shortDate(selectedSummary.nextBill.due_date)
                                  : "Clear"}
                              </div>
                              <div className="accountsInfoSub">
                                {selectedSummary.nextBill
                                  ? `${billTitle(selectedSummary.nextBill)} • ${fmtMoney(
                                      amountFromBill(selectedSummary.nextBill)
                                    )}`
                                  : "No linked outgoing bill"}
                              </div>
                            </div>

                            <div className="accountsInfoCell">
                              <div className="accountTinyLabel">Next Deposit</div>
                              <div className="accountsInfoValue">
                                {selectedSummary.nextIncome
                                  ? shortDate(selectedSummary.nextIncome.deposit_date)
                                  : "None"}
                              </div>
                              <div className="accountsInfoSub">
                                {selectedSummary.nextIncome
                                  ? `${selectedSummary.nextIncome.source} • ${fmtMoney(
                                      selectedSummary.nextIncome.amount
                                    )}`
                                  : "No scheduled incoming deposit"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="accountsFocusRight">
                          <div className="accountsChartCard">
                            <div className="accountsChartHead">
                              <div>
                                <div className="accountTinyLabel">Balance Trend</div>
                                <div className="accountsChartTitle">Last 14 Days</div>
                              </div>
                              <MiniPill tone="blue">live</MiniPill>
                            </div>

                            <BalanceBars bars={selectedBars} />
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="accountsSurfaceSection accountsSurfaceBody">
                      <div className="accountsBodyGrid">
                        <div className="accountsMainColumn">
                          <div className="accountsTabRow">
                            <TabBtn
                              label="Activity"
                              active={tab === "activity"}
                              onClick={() => setTab("activity")}
                            />
                            <TabBtn
                              label="Balance Story"
                              active={tab === "story"}
                              onClick={() => setTab("story")}
                            />
                            <TabBtn
                              label="Recurring Flow"
                              active={tab === "recurring"}
                              onClick={() => setTab("recurring")}
                            />
                            <TabBtn
                              label="Forecast"
                              active={tab === "forecast"}
                              onClick={() => setTab("forecast")}
                            />
                          </div>

                          {tab === "activity" ? (
                            <>
                              <div className="accountsContentSection">
                                <PaneHeader
                                  title="Activity Feed"
                                  subcopy="What actually hit this account."
                                  right={<MiniPill>{selectedSummary.recentTransactions.length} rows</MiniPill>}
                                />

                                {selectedSummary.recentTransactions.length ? (
                                  <div className="accountsTxList">
                                    {selectedSummary.recentTransactions.map((tx) => (
                                      <TransactionRow key={tx.id} tx={tx} />
                                    ))}
                                  </div>
                                ) : (
                                  <div className="accountsEmptyState accountsInlineEmpty">
                                    <div>
                                      <div className="accountsEmptyTitle">No account activity yet</div>
                                      <div className="accountsEmptyText">
                                        The ledger will fill as income, bills, transfers, and manual
                                        adjustments hit this account.
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="accountsDetailSubGrid">
                                <div className="accountsContentSection compact">
                                  <PaneHeader
                                    title="Balance Story Snapshot"
                                    subcopy="Fast explanation of why the balance is here."
                                  />

                                  <div className="accountsQuickInfoList">
                                    <QuickInfoRow
                                      label="Start of month"
                                      value={fmtMoney(selectedSummary.startBalance)}
                                    />
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
                                      value={`${safeNum(selectedSummary.monthTransfersNet, 0) >= 0 ? "+" : ""}${fmtMoney(selectedSummary.monthTransfersNet)}`}
                                      tone={
                                        safeNum(selectedSummary.monthTransfersNet, 0) >= 0
                                          ? "green"
                                          : "red"
                                      }
                                    />
                                    <QuickInfoRow
                                      label="Current balance"
                                      value={fmtMoney(selectedAccount.balance)}
                                    />
                                  </div>
                                </div>

                                <div className="accountsContentSection compact">
                                  <PaneHeader
                                    title="Upcoming Hits"
                                    subcopy="What is next to move this account."
                                  />

                                  <div className="accountsMiniList">
                                    {selectedSummary.nextIncome ? (
                                      <div className="accountMiniRow">
                                        <div>
                                          <div className="accountTxTitle">
                                            {selectedSummary.nextIncome.source}
                                          </div>
                                          <div className="accountTxSub">
                                            {shortDate(selectedSummary.nextIncome.deposit_date)}
                                          </div>
                                        </div>

                                        <div className="accountTxAmount" style={{ color: "#97efc7" }}>
                                          +{fmtMoney(selectedSummary.nextIncome.amount)}
                                        </div>
                                      </div>
                                    ) : null}

                                    {selectedSummary.nextBill ? (
                                      <div className="accountMiniRow">
                                        <div>
                                          <div className="accountTxTitle">
                                            {billTitle(selectedSummary.nextBill)}
                                          </div>
                                          <div className="accountTxSub">
                                            {shortDate(selectedSummary.nextBill.due_date)}
                                          </div>
                                        </div>

                                        <div className="accountTxAmount" style={{ color: "#f5cf88" }}>
                                          -{fmtMoney(amountFromBill(selectedSummary.nextBill))}
                                        </div>
                                      </div>
                                    ) : null}

                                    {!selectedSummary.nextIncome && !selectedSummary.nextBill ? (
                                      <div className="accountsInfoSub" style={{ marginTop: 0 }}>
                                        Nothing linked next.
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : null}

                          {tab === "story" ? (
                            <div className="accountsContentSection">
                              <PaneHeader
                                title="Balance Story"
                                subcopy="Why this balance is what it is right now."
                                right={<MiniPill tone="green">month to date</MiniPill>}
                              />

                              <div className="accountsStoryGrid">
                                <div className="accountsStoryCell">
                                  <div className="accountTinyLabel">Start of Month</div>
                                  <div className="accountsStoryValue">
                                    {fmtMoney(selectedSummary.startBalance)}
                                  </div>
                                </div>

                                <div className="accountsStoryCell">
                                  <div className="accountTinyLabel">Income Added</div>
                                  <div className="accountsStoryValue" style={{ color: "#97efc7" }}>
                                    +{fmtMoney(selectedSummary.monthIncome)}
                                  </div>
                                </div>

                                <div className="accountsStoryCell">
                                  <div className="accountTinyLabel">Bills Paid</div>
                                  <div className="accountsStoryValue" style={{ color: "#f5cf88" }}>
                                    -{fmtMoney(selectedSummary.monthBills)}
                                  </div>
                                </div>

                                <div className="accountsStoryCell">
                                  <div className="accountTinyLabel">Spending</div>
                                  <div className="accountsStoryValue" style={{ color: "#ffb4c5" }}>
                                    -{fmtMoney(selectedSummary.monthSpending)}
                                  </div>
                                </div>

                                <div className="accountsStoryCell">
                                  <div className="accountTinyLabel">Transfers</div>
                                  <div
                                    className="accountsStoryValue"
                                    style={{
                                      color:
                                        safeNum(selectedSummary.monthTransfersNet, 0) >= 0
                                          ? "#97efc7"
                                          : "#ffb4c5",
                                    }}
                                  >
                                    {safeNum(selectedSummary.monthTransfersNet, 0) >= 0 ? "+" : ""}
                                    {fmtMoney(selectedSummary.monthTransfersNet)}
                                  </div>
                                </div>

                                <div className="accountsStoryCell strong">
                                  <div className="accountTinyLabel">Current Balance</div>
                                  <div className="accountsStoryValue">
                                    {fmtMoney(selectedAccount.balance)}
                                  </div>
                                </div>
                              </div>

                              <div className="accountsStoryBottom">
                                <div className="accountsInfoCell">
                                  <div className="accountTinyLabel">Projected Month-End</div>
                                  <div className="accountsInfoValue">
                                    {fmtMoney(selectedSummary.projectedMonthEnd)}
                                  </div>
                                  <div className="accountsInfoSub">
                                    Current balance + future income - future bills this month
                                  </div>
                                </div>

                                <div className="accountsInfoCell">
                                  <div className="accountTinyLabel">Flow Mix</div>
                                  <div className="accountsFlowList">
                                    {selectedSummary.flowMix.length ? (
                                      selectedSummary.flowMix.map((item) => (
                                        <div key={item.label} className="accountsFlowRow">
                                          <span>{item.label}</span>
                                          <span>
                                            {item.total >= 0 ? "+" : ""}
                                            {fmtMoney(item.total)}
                                          </span>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="accountsInfoSub" style={{ marginTop: 0 }}>
                                        No month-to-date flow yet.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {tab === "recurring" ? (
                            <div className="accountsContentSection">
                              <PaneHeader
                                title="Recurring Flow"
                                subcopy="What this account is responsible for next."
                                right={
                                  <MiniPill tone="blue">
                                    {selectedSummary.upcomingBills.length +
                                      selectedSummary.scheduledDeposits.length}{" "}
                                    hits
                                  </MiniPill>
                                }
                              />

                              <div className="accountsDetailSubGrid">
                                <div className="accountsContentSection compact">
                                  <PaneHeader
                                    title="Scheduled Deposits"
                                    subcopy="Income routed into this account."
                                    right={<MiniPill tone="green">{selectedSummary.scheduledDeposits.length}</MiniPill>}
                                  />

                                  <div className="accountsMiniList">
                                    {selectedSummary.scheduledDeposits.length ? (
                                      selectedSummary.scheduledDeposits.map((item) => (
                                        <div key={item.id} className="accountMiniRow">
                                          <div>
                                            <div className="accountTxTitle">{item.source}</div>
                                            <div className="accountTxSub">
                                              {shortDate(item.deposit_date)} •{" "}
                                              {daysUntil(item.deposit_date) === 0
                                                ? "today"
                                                : `${daysUntil(item.deposit_date)}d`}
                                            </div>
                                          </div>

                                          <div className="accountTxAmount" style={{ color: "#97efc7" }}>
                                            +{fmtMoney(item.amount)}
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="accountsInfoSub" style={{ marginTop: 0 }}>
                                        No scheduled income routed here.
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="accountsContentSection compact">
                                  <PaneHeader
                                    title="Linked Bills"
                                    subcopy="Outgoing bills tied to this account."
                                    right={<MiniPill tone="amber">{selectedSummary.upcomingBills.length}</MiniPill>}
                                  />

                                  <div className="accountsMiniList">
                                    {selectedSummary.upcomingBills.length ? (
                                      selectedSummary.upcomingBills.map((bill) => (
                                        <div key={bill.id} className="accountMiniRow">
                                          <div>
                                            <div className="accountTxTitle">{billTitle(bill)}</div>
                                            <div className="accountTxSub">
                                              {shortDate(bill.due_date)} •{" "}
                                              {daysUntil(bill.due_date) === 0
                                                ? "today"
                                                : `${daysUntil(bill.due_date)}d`}
                                            </div>
                                          </div>

                                          <div className="accountTxAmount" style={{ color: "#f5cf88" }}>
                                            -{fmtMoney(amountFromBill(bill))}
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="accountsInfoSub" style={{ marginTop: 0 }}>
                                        No active bills linked to this account.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {tab === "forecast" ? (
                            <div className="accountsContentSection">
                              <PaneHeader
                                title="Forecast"
                                subcopy="What is about to happen to this account over the next 30 days."
                                right={<MiniPill>{selectedSummary.projectionEvents.length} events</MiniPill>}
                              />

                              <div className="accountsForecastCards">
                                <div className="accountsInfoCell">
                                  <div className="accountTinyLabel">Safe Buffer</div>
                                  <div className="accountsInfoValue">
                                    {fmtMoney(selectedSummary.safeBuffer)}
                                  </div>
                                  <div className="accountsInfoSub">
                                    Local warning threshold for this account
                                  </div>
                                </div>

                                <div className="accountsInfoCell">
                                  <div className="accountTinyLabel">Low Point</div>
                                  <div
                                    className="accountsInfoValue"
                                    style={{
                                      color:
                                        selectedSummary.projectedLowPoint < 0
                                          ? "#ffb4c5"
                                          : selectedSummary.projectedLowPoint <
                                            selectedSummary.safeBuffer
                                          ? "#f5cf88"
                                          : "#fff",
                                    }}
                                  >
                                    {fmtMoney(selectedSummary.projectedLowPoint)}
                                  </div>
                                  <div className="accountsInfoSub">
                                    Worst projected balance in the next 30 days
                                  </div>
                                </div>

                                <div className="accountsInfoCell">
                                  <div className="accountTinyLabel">30D End</div>
                                  <div className="accountsInfoValue">
                                    {selectedSummary.projectionEvents.length
                                      ? fmtMoney(
                                          selectedSummary.projectionEvents[
                                            selectedSummary.projectionEvents.length - 1
                                          ].afterBalance
                                        )
                                      : fmtMoney(selectedAccount.balance)}
                                  </div>
                                  <div className="accountsInfoSub">
                                    Balance if every scheduled hit lands
                                  </div>
                                </div>
                              </div>

                              {selectedSummary.projectionEvents.length ? (
                                <div className="accountsTxList">
                                  {selectedSummary.projectionEvents.map((event) => (
                                    <ForecastEventRow key={event.id} event={event} />
                                  ))}
                                </div>
                              ) : (
                                <div className="accountsEmptyState accountsInlineEmpty">
                                  <div>
                                    <div className="accountsEmptyTitle">Forecast is clean</div>
                                    <div className="accountsEmptyText">
                                      No upcoming linked income or bills are scheduled for this account.
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>

                        <aside className="accountsToolColumn">
                          <div className="accountsToolSection">
                            <PaneHeader
                              title="Quick Adjustment"
                              subcopy="Manual correction straight into the account ledger."
                              right={busy ? <MiniPill tone="amber">Working...</MiniPill> : null}
                            />

                            <div className="accountsFormStack">
                              <div>
                                <div className="accountTinyLabel">Mode</div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <ActionBtn
                                    variant={adjustForm.mode === "add" ? "primary" : "ghost"}
                                    onClick={() =>
                                      setAdjustForm((prev) => ({
                                        ...prev,
                                        mode: "add",
                                      }))
                                    }
                                  >
                                    + Add
                                  </ActionBtn>
                                  <ActionBtn
                                    variant={adjustForm.mode === "subtract" ? "primary" : "ghost"}
                                    onClick={() =>
                                      setAdjustForm((prev) => ({
                                        ...prev,
                                        mode: "subtract",
                                      }))
                                    }
                                  >
                                    - Subtract
                                  </ActionBtn>
                                </div>
                              </div>

                              <div>
                                <div className="accountTinyLabel">Amount</div>
                                <input
                                  className="accountsField"
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
                                <div className="accountTinyLabel">Note</div>
                                <textarea
                                  className="accountsField"
                                  rows={4}
                                  placeholder="Why this correction is being made..."
                                  value={adjustForm.note}
                                  onChange={(e) =>
                                    setAdjustForm((prev) => ({
                                      ...prev,
                                      note: e.target.value,
                                    }))
                                  }
                                />
                              </div>

                              <ActionBtn
                                variant="primary"
                                full
                                onClick={addManualAdjustment}
                                disabled={busy || !selectedAccount}
                              >
                                <Plus size={14} /> Apply Adjustment
                              </ActionBtn>
                            </div>
                          </div>

                          <div className="accountsToolSection">
                            <PaneHeader
                              title="Transfer"
                              subcopy="Move money between accounts without leaving this workspace."
                            />

                            <div className="accountsFormStack">
                              <div>
                                <div className="accountTinyLabel">To Account</div>
                                <select
                                  className="accountsField"
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
                                <div className="accountTinyLabel">Amount</div>
                                <input
                                  className="accountsField"
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
                                <div className="accountTinyLabel">Note</div>
                                <textarea
                                  className="accountsField"
                                  rows={4}
                                  placeholder="Optional transfer note..."
                                  value={transferForm.note}
                                  onChange={(e) =>
                                    setTransferForm((prev) => ({
                                      ...prev,
                                      note: e.target.value,
                                    }))
                                  }
                                />
                              </div>

                              <ActionBtn
                                variant="primary"
                                full
                                onClick={submitTransfer}
                                disabled={busy || !selectedAccount}
                              >
                                <ArrowRightLeft size={14} /> Move Money
                              </ActionBtn>
                            </div>
                          </div>

                          <div className="accountsToolSection">
                            <PaneHeader
                              title="Account Settings"
                              subcopy="Warnings and control tools tied to the selected account."
                            />

                            <div className="accountsFormStack">
                              <div className="accountsInfoCell">
                                <div className="accountTinyLabel">Safe Buffer</div>
                                <div className="accountsInfoValue">
                                  {fmtMoney(safeNum(safeBufferMap[selectedAccount.id], 150))}
                                </div>
                                <div className="accountsInfoSub">
                                  Local warning line for this account
                                </div>
                              </div>

                              <div>
                                <div className="accountTinyLabel">Set Safe Buffer</div>
                                <input
                                  className="accountsField"
                                  inputMode="decimal"
                                  placeholder="150.00"
                                  value={String(safeBufferMap[selectedAccount.id] ?? 150)}
                                  onChange={(e) =>
                                    setSafeBufferMap((prev) => ({
                                      ...prev,
                                      [selectedAccount.id]:
                                        round2(parseMoneyInput(e.target.value)) || 0,
                                    }))
                                  }
                                />
                              </div>

                              <ActionBtn
                                variant={defaultAccountId === selectedAccount.id ? "ghost" : "primary"}
                                full
                                onClick={setPrimaryAccount}
                                disabled={busy}
                              >
                                <Save size={14} />{" "}
                                {defaultAccountId === selectedAccount.id
                                  ? "Already Primary"
                                  : "Set as Primary Account"}
                              </ActionBtn>

                              <ActionBtn
                                variant="ghost"
                                full
                                onClick={loadAccountsPage}
                                disabled={busy}
                              >
                                <RefreshCw size={14} /> Refresh Data
                              </ActionBtn>

                              <div className="accountsInfoCell">
                                <div className="accountTinyLabel">Warning Engine</div>
                                <div className="accountsWarningRow">
                                  {selectedSummary.atRisk ? (
                                    <>
                                      <AlertTriangle size={14} />
                                      <span>
                                        This account is projected below its safe buffer soon.
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles size={14} />
                                      <span>This account looks stable right now.</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="accountsInfoCell">
                                <div className="accountTinyLabel">Next Hits</div>
                                <div className="accountsMiniList">
                                  {selectedSummary.nextIncome ? (
                                    <div className="accountMiniRow">
                                      <div>
                                        <div className="accountTxTitle">
                                          {selectedSummary.nextIncome.source}
                                        </div>
                                        <div className="accountTxSub">
                                          {shortDate(selectedSummary.nextIncome.deposit_date)}
                                        </div>
                                      </div>
                                      <div className="accountTxAmount" style={{ color: "#97efc7" }}>
                                        +{fmtMoney(selectedSummary.nextIncome.amount)}
                                      </div>
                                    </div>
                                  ) : null}

                                  {selectedSummary.nextBill ? (
                                    <div className="accountMiniRow">
                                      <div>
                                        <div className="accountTxTitle">
                                          {billTitle(selectedSummary.nextBill)}
                                        </div>
                                        <div className="accountTxSub">
                                          {shortDate(selectedSummary.nextBill.due_date)}
                                        </div>
                                      </div>
                                      <div className="accountTxAmount" style={{ color: "#f5cf88" }}>
                                        -{fmtMoney(amountFromBill(selectedSummary.nextBill))}
                                      </div>
                                    </div>
                                  ) : null}

                                  {!selectedSummary.nextIncome && !selectedSummary.nextBill ? (
                                    <div className="accountsInfoSub" style={{ marginTop: 0 }}>
                                      Nothing linked next.
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        </aside>
                      </div>
                    </section>
                  </>
                ) : (
                  <div className="accountsEmptyState">
                    <div>
                      <div className="accountsEmptyTitle">No account selected</div>
                      <div className="accountsEmptyText">
                        Pick one from the left rail to open the workspace.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </GlassPane>
          </section>
        </div>
      </main>

      <style jsx global>{globalStyles}</style>
    </>
  );
}

const globalStyles = `
  .accountsPage {
    width: 100%;
    min-width: 0;
    color: var(--lcc-text);
    font-family: var(--lcc-font-sans);
  }

  .accountsShell {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 12px 0 20px;
    display: grid;
    gap: 14px;
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
    max-width: 940px;
  }

  .accountsHeroGrid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: start;
  }

  .accountsHeroSide {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-content: flex-start;
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
    gap: 14px;
  }

  .accountsWorkspaceGrid {
    display: grid;
    grid-template-columns: minmax(280px, 312px) minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }

  .accountsRailControls {
    display: grid;
    grid-template-columns: 1fr;
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

  .accountsRailList {
    display: grid;
    gap: 10px;
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }

  .accountRailCard {
    width: 100%;
    text-align: left;
    display: grid;
    gap: 10px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.07);
    background:
      linear-gradient(180deg, rgba(8,13,24,0.78), rgba(4,8,16,0.72));
    padding: 13px;
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .accountRailCard:hover {
    transform: translateY(-1px);
  }

  .accountRailCardTop {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: flex-start;
  }

  .accountRailCardRight {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .accountRailCardTitle {
    font-size: 14px;
    font-weight: 850;
    line-height: 1.2;
    color: #fff;
    overflow-wrap: anywhere;
  }

  .accountRailCardSub {
    margin-top: 3px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
  }

  .accountRailBalance {
    font-size: 21px;
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.045em;
    color: #fff;
  }

  .accountRailGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .accountRailStat {
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.025);
    padding: 10px;
  }

  .accountRailStatValue {
    font-size: 13px;
    font-weight: 850;
    color: #fff;
  }

  .accountRailFooter {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .accountRailFooterValue {
    font-size: 13px;
    font-weight: 850;
    color: #fff;
    line-height: 1.2;
  }

  .accountTinyLabel {
    display: block;
    margin-bottom: 8px;
    font-size: 10px;
    color: rgba(255,255,255,0.46);
    text-transform: uppercase;
    letter-spacing: .16em;
    font-weight: 800;
  }

  .accountsWorkspaceShell {
    min-width: 0;
    display: grid;
    gap: 0;
  }

  .accountsSurfaceSection {
    position: relative;
  }

  .accountsSurfaceSection + .accountsSurfaceSection {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.07);
  }

  .accountsFocusHero {
    display: grid;
    grid-template-columns: minmax(0, 1.18fr) minmax(300px, 0.82fr);
    gap: 14px;
    align-items: stretch;
  }

  .accountsFocusLeft,
  .accountsFocusRight {
    min-width: 0;
  }

  .accountsFocusBalance {
    font-size: clamp(32px, 4vw, 48px);
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.06em;
    color: #fff;
  }

  .accountsFocusGrid {
    margin-top: 14px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .accountsInfoCell {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.025);
    padding: 11px;
  }

  .accountsInfoValue {
    font-size: 1rem;
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

  .accountsChartCard {
    border-radius: 20px;
    border: 1px solid rgba(214,226,255,0.10);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
    padding: 12px;
    min-height: 100%;
    height: 100%;
  }

  .accountsChartHead {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .accountsChartTitle {
    font-size: 14px;
    font-weight: 850;
    color: #fff;
    line-height: 1.2;
  }

  .accountBarsWrap {
    height: 136px;
    display: grid;
    grid-template-columns: repeat(14, minmax(0, 1fr));
    gap: 6px;
    align-items: end;
  }

  .accountBarCol {
    height: 100%;
    display: flex;
    align-items: end;
  }

  .accountBarFill {
    width: 100%;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(143,177,255,0.95), rgba(86,140,255,0.72));
    box-shadow: 0 0 16px rgba(86,140,255,0.16);
  }

  .accountBarsEmpty {
    min-height: 136px;
    display: grid;
    place-items: center;
    color: rgba(255,255,255,0.54);
    font-size: 12px;
    text-align: center;
  }

  .accountsBodyGrid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(300px, 340px);
    gap: 18px;
    align-items: start;
  }

  .accountsMainColumn {
    min-width: 0;
    display: grid;
    gap: 14px;
  }

  .accountsToolColumn {
    min-width: 0;
    display: grid;
    gap: 0;
    align-self: start;
    position: sticky;
    top: 12px;
    border-left: 1px solid rgba(255,255,255,0.07);
    padding-left: 16px;
  }

  .accountsToolSection + .accountsToolSection {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.07);
  }

  .accountsContentSection {
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
    padding: 14px;
    display: grid;
    gap: 12px;
  }

  .accountsContentSection.compact {
    gap: 8px;
  }

  .accountsTabRow {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .accountTabBtn {
    min-height: 38px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid rgba(214,226,255,0.10);
    color: #fff;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
  }

  .accountsTxList {
    display: grid;
    gap: 10px;
    max-height: 360px;
    overflow: auto;
    padding-right: 2px;
  }

  .accountTxRow,
  .accountForecastRow,
  .accountMiniRow {
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

  .accountTxTitle {
    font-size: 13px;
    font-weight: 850;
    line-height: 1.2;
    color: #fff;
    overflow-wrap: anywhere;
  }

  .accountTxSub {
    margin-top: 4px;
    font-size: 11.5px;
    color: rgba(255,255,255,0.54);
    line-height: 1.35;
  }

  .accountTxAmount {
    font-size: 13.5px;
    font-weight: 850;
    color: #fff;
    white-space: nowrap;
  }

  .accountsDetailSubGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .accountsQuickInfoList {
    display: grid;
    gap: 8px;
  }

  .accountsQuickInfoRow {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    color: rgba(255,255,255,0.76);
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding-bottom: 8px;
  }

  .accountsQuickInfoRow:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  .accountsStoryGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .accountsStoryCell {
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.025);
    padding: 12px;
  }

  .accountsStoryCell.strong {
    background: linear-gradient(180deg, rgba(143,177,255,0.10), rgba(143,177,255,0.04));
    border-color: rgba(143,177,255,0.18);
  }

  .accountsStoryValue {
    font-size: 18px;
    font-weight: 900;
    color: #fff;
    line-height: 1.1;
  }

  .accountsStoryBottom {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
  }

  .accountsFlowList {
    display: grid;
    gap: 8px;
  }

  .accountsFlowRow {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 12px;
    color: rgba(255,255,255,0.78);
  }

  .accountsForecastCards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .accountsMiniList {
    display: grid;
    gap: 10px;
    margin-top: 2px;
  }

  .accountsWarningRow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: rgba(255,255,255,0.84);
    font-size: 12px;
    line-height: 1.4;
  }

  .accountsFormStack {
    display: grid;
    gap: 12px;
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

  .accountActionBtn {
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

  .accountActionBtn:hover {
    transform: translateY(-1px);
  }

  .accountsEmptyState {
    min-height: 180px;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 14px;
  }

  .accountsInlineEmpty {
    min-height: 220px;
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

  @media (max-width: 1500px) {
    .accountsBodyGrid {
      grid-template-columns: minmax(0, 1fr) minmax(290px, 320px);
    }
  }

  @media (max-width: 1380px) {
    .accountsMetricGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .accountsFocusHero {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 1240px) {
    .accountsHeroGrid,
    .accountsWorkspaceGrid,
    .accountsBodyGrid,
    .accountsStoryBottom,
    .accountsForecastCards,
    .accountsDetailSubGrid {
      grid-template-columns: 1fr;
    }

    .accountsHeroSide {
      justify-content: flex-start;
    }

    .accountsFocusGrid,
    .accountsStoryGrid,
    .accountRailGrid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .accountsToolColumn {
      position: static;
      border-left: 0;
      padding-left: 0;
      border-top: 1px solid rgba(255,255,255,0.07);
      padding-top: 16px;
      margin-top: 4px;
    }

    .accountsTxList {
      max-height: none;
    }
  }

  @media (max-width: 780px) {
    .accountsShell {
      padding: 8px 0 14px;
    }

    .accountsMetricGrid,
    .accountsFocusGrid,
    .accountsStoryGrid,
    .accountRailGrid {
      grid-template-columns: 1fr;
    }

    .accountTxRow,
    .accountForecastRow,
    .accountMiniRow {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;