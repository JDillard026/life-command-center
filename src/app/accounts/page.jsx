"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/* =========================
   utils
========================= */
function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function fmtMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function nowTs() {
  return Date.now();
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

function typeLabel(t) {
  const v = String(t || "other").toLowerCase();
  if (v === "checking") return "Checking";
  if (v === "savings") return "Savings";
  if (v === "cash") return "Cash";
  if (v === "credit") return "Credit Card";
  if (v === "investment") return "Investment";
  return "Other";
}

function badgeText(type) {
  const t = String(type || "other").toLowerCase();
  if (t === "checking") return "Daily";
  if (t === "savings") return "Reserve";
  if (t === "credit") return "Debt";
  if (t === "investment") return "Growth";
  if (t === "cash") return "Cash";
  return "Account";
}

function typeIcon(type) {
  const t = String(type || "other").toLowerCase();
  if (t === "checking") return "🏦";
  if (t === "savings") return "💰";
  if (t === "cash") return "💵";
  if (t === "credit") return "💳";
  if (t === "investment") return "📈";
  return "📁";
}

function typeAccent(type) {
  const t = String(type || "other").toLowerCase();
  if (t === "checking")
    return "linear-gradient(135deg, rgba(59,130,246,.18), rgba(37,99,235,.05))";
  if (t === "savings")
    return "linear-gradient(135deg, rgba(34,197,94,.18), rgba(21,128,61,.05))";
  if (t === "cash")
    return "linear-gradient(135deg, rgba(245,158,11,.18), rgba(217,119,6,.05))";
  if (t === "credit")
    return "linear-gradient(135deg, rgba(244,114,182,.18), rgba(190,24,93,.05))";
  if (t === "investment")
    return "linear-gradient(135deg, rgba(168,85,247,.18), rgba(126,34,206,.05))";
  return "linear-gradient(135deg, rgba(148,163,184,.15), rgba(100,116,139,.05))";
}

function transactionLabel(kind) {
  const k = String(kind || "").toLowerCase();
  if (k === "deposit") return "Deposit";
  if (k === "withdraw") return "Withdraw";
  if (k === "transfer_in") return "Transfer In";
  if (k === "transfer_out") return "Transfer Out";
  if (k === "set") return "Set Balance";
  if (k === "bill_payment") return "Bill Payment";
  if (k === "create") return "Account Created";
  if (k === "delete") return "Account Deleted";
  return "Transaction";
}

function transactionTone(kind) {
  const k = String(kind || "").toLowerCase();
  if (["deposit", "transfer_in"].includes(k)) return "good";
  if (["withdraw", "transfer_out", "bill_payment"].includes(k)) return "bad";
  return "neutral";
}

function transactionChipStyle(kind) {
  const tone = transactionTone(kind);

  if (tone === "good") {
    return {
      background: "rgba(34,197,94,.13)",
      border: "1px solid rgba(34,197,94,.24)",
      color: "rgb(134 239 172)",
    };
  }

  if (tone === "bad") {
    return {
      background: "rgba(244,114,182,.12)",
      border: "1px solid rgba(244,114,182,.24)",
      color: "rgb(251 207 232)",
    };
  }

  return {
    background: "rgba(148,163,184,.12)",
    border: "1px solid rgba(148,163,184,.22)",
    color: "rgb(226 232 240)",
  };
}

function signedDelta(kind, amount) {
  const amt = Math.abs(safeNum(amount, 0));
  const k = String(kind || "").toLowerCase();
  if (["withdraw", "transfer_out", "bill_payment"].includes(k)) return -amt;
  if (["deposit", "transfer_in"].includes(k)) return amt;
  return safeNum(amount, 0);
}

function fmtDelta(n) {
  const num = safeNum(n, 0);
  if (num === 0) return fmtMoney(0);
  return `${num > 0 ? "+" : "−"}${fmtMoney(Math.abs(num))}`;
}

function defaultAccounts() {
  return [
    {
      id: uid(),
      name: "Checking",
      type: "checking",
      balance: 0,
      updatedAt: nowTs(),
    },
    {
      id: uid(),
      name: "Savings",
      type: "savings",
      balance: 0,
      updatedAt: nowTs(),
    },
  ];
}

/* =========================
   db mappers
========================= */
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
    delta: safeNum(row.delta, signedDelta(row.kind, row.amount)),
    resultingBalance: safeNum(row.resulting_balance, 0),
    note: row.note || "",
    relatedAccountId: row.related_account_id || "",
    relatedAccountName: row.related_account_name || "",
    sourceType: row.source_type || "",
    sourceId: row.source_id || "",
  };
}

function mapLedgerClientToRow(entry, userId) {
  return {
    id: entry.id,
    user_id: userId,
    account_id: entry.accountId,
    kind: entry.kind || "transaction",
    amount: safeNum(entry.amount, 0),
    delta: safeNum(entry.delta, signedDelta(entry.kind, entry.amount)),
    resulting_balance: safeNum(entry.resultingBalance, 0),
    note: entry.note || "",
    related_account_id: entry.relatedAccountId || null,
    related_account_name: entry.relatedAccountName || "",
    source_type: entry.sourceType || "",
    source_id: entry.sourceId || "",
    created_at: new Date(entry.ts || nowTs()).toISOString(),
  };
}

/* =========================
   modal
========================= */
function Modal({ open, title, subtitle, onClose, children }) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(2,6,23,.78)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,.09)",
          background:
            "linear-gradient(180deg, rgba(13,19,34,.96), rgba(4,8,16,.94))",
          boxShadow:
            "0 30px 100px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 18,
            borderBottom: "1px solid rgba(255,255,255,.06)",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>{title}</div>
            {subtitle ? (
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(220,228,255,.64)",
                  marginTop: 6,
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>

          <button className="ghostBtn" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}

/* =========================
   page
========================= */
export default function AccountsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [primaryId, setPrimaryId] = useState("");
  const [ledger, setLedger] = useState([]);

  const [adding, setAdding] = useState({
    name: "",
    type: "checking",
    balance: "",
  });

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated");
  const [typeFilter, setTypeFilter] = useState("all");

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalAccountId, setModalAccountId] = useState("");
  const [mode, setMode] = useState("adjust"); // adjust | set | transfer
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [adjustSign, setAdjustSign] = useState("deposit");
  const [transferToId, setTransferToId] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadAll() {
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

        const [accRes, settingsRes, ledgerRes] = await Promise.all([
          supabase
            .from("accounts")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("updated_at", { ascending: false }),

          supabase
            .from("account_settings")
            .select("*")
            .eq("user_id", currentUser.id)
            .maybeSingle(),

          supabase
            .from("account_transactions")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("created_at", { ascending: false }),
        ]);

        if (accRes.error) throw accRes.error;
        if (settingsRes.error) throw settingsRes.error;
        if (ledgerRes.error) throw ledgerRes.error;

        let loadedAccounts = (accRes.data || []).map(mapAccountRowToClient);

        if (loadedAccounts.length === 0) {
          const seeded = defaultAccounts();
          const insertRows = seeded.map((a) =>
            mapAccountClientToRow(a, currentUser.id)
          );
          const insertRes = await supabase
            .from("accounts")
            .insert(insertRows)
            .select("*");

          if (insertRes.error) throw insertRes.error;
          loadedAccounts = (insertRes.data || []).map(mapAccountRowToClient);
        }

        const primary =
          settingsRes.data?.primary_account_id &&
          loadedAccounts.some((a) => a.id === settingsRes.data.primary_account_id)
            ? settingsRes.data.primary_account_id
            : loadedAccounts[0]?.id || "";

        if (!settingsRes.data && primary) {
          await supabase.from("account_settings").upsert(
            {
              user_id: currentUser.id,
              primary_account_id: primary,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
        }

        if (!mounted) return;

        setAccounts(loadedAccounts);
        setPrimaryId(primary);
        setSelectedAccountId(primary || loadedAccounts[0]?.id || "");
        setLedger((ledgerRes.data || []).map(mapLedgerRowToClient));
      } catch (err) {
        if (!mounted) return;
        setPageError(err?.message || "Failed to load accounts.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAll();
    return () => {
      mounted = false;
    };
  }, []);

  const primary = useMemo(
    () => accounts.find((a) => a.id === primaryId) || null,
    [accounts, primaryId]
  );

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) || null,
    [accounts, selectedAccountId]
  );

  const totals = useMemo(() => {
    const checking = accounts
      .filter((a) => String(a.type || "").toLowerCase() === "checking")
      .reduce((s, a) => s + safeNum(a.balance, 0), 0);

    const savings = accounts
      .filter((a) => String(a.type || "").toLowerCase() === "savings")
      .reduce((s, a) => s + safeNum(a.balance, 0), 0);

    const cash = accounts
      .filter((a) => String(a.type || "").toLowerCase() === "cash")
      .reduce((s, a) => s + safeNum(a.balance, 0), 0);

    const invest = accounts
      .filter((a) => String(a.type || "").toLowerCase() === "investment")
      .reduce((s, a) => s + safeNum(a.balance, 0), 0);

    const debts = accounts
      .filter((a) => String(a.type || "").toLowerCase() === "credit")
      .reduce((s, a) => s + safeNum(a.balance, 0), 0);

    const assets = accounts
      .filter((a) => String(a.type || "").toLowerCase() !== "credit")
      .reduce((s, a) => s + safeNum(a.balance, 0), 0);

    const liquid = checking + savings + cash;
    const netWorth = assets - debts;
    const updatedMax = accounts.reduce(
      (mx, a) => Math.max(mx, safeNum(a.updatedAt, 0)),
      0
    );

    return {
      checking,
      savings,
      cash,
      invest,
      debts,
      assets,
      liquid,
      netWorth,
      updatedMax,
    };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    let list = [...accounts];
    const q = query.trim().toLowerCase();

    if (q) {
      list = list.filter((a) => {
        const hay = `${a.name} ${typeLabel(a.type)} ${badgeText(a.type)}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (typeFilter !== "all") {
      list = list.filter(
        (a) => String(a.type || "other").toLowerCase() === typeFilter
      );
    }

    if (sort === "name") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    } else if (sort === "balance") {
      list.sort((a, b) => safeNum(b.balance, 0) - safeNum(a.balance, 0));
    } else {
      list.sort((a, b) => safeNum(b.updatedAt, 0) - safeNum(a.updatedAt, 0));
    }

    if (primaryId) {
      list.sort((a, b) => (a.id === primaryId ? -1 : b.id === primaryId ? 1 : 0));
    }

    return list;
  }, [accounts, query, sort, typeFilter, primaryId]);

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
          x.sourceType,
          x.sourceId,
          fmtMoney(x.amount),
          fmtMoney(x.resultingBalance),
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(q);
      })
      .sort((a, b) => safeNum(b.ts, 0) - safeNum(a.ts, 0));
  }, [ledger, selectedAccountId, ledgerSearch]);

  async function savePrimary(nextId) {
    if (!user || !supabase || !nextId) return;

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
    }
  }

  async function createLedgerEntry(entry) {
    if (!user || !supabase) return { ok: false, error: "Missing user." };

    const { data, error } = await supabase
      .from("account_transactions")
      .insert([mapLedgerClientToRow(entry, user.id)])
      .select()
      .single();

    if (error) {
      return { ok: false, error: error.message || "Failed to save transaction." };
    }

    setLedger((prev) => [mapLedgerRowToClient(data), ...prev]);
    return { ok: true, entry: mapLedgerRowToClient(data) };
  }

  async function saveAccountPatch(accountId, patch) {
    if (!user || !supabase) return { ok: false, error: "Missing user." };

    const payload = {
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("accounts")
      .update(payload)
      .eq("id", accountId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return { ok: false, error: error.message || "Failed to save account." };

    const saved = mapAccountRowToClient(data);
    setAccounts((prev) => prev.map((a) => (a.id === accountId ? saved : a)));
    return { ok: true, account: saved };
  }

  async function saveAccountBalance(accountId, nextBalance) {
    return saveAccountPatch(accountId, {
      balance: safeNum(nextBalance, 0),
    });
  }

  async function addAccount(e) {
    e.preventDefault();
    setPageError("");

    if (!user || !supabase) return;

    const name = adding.name.trim();
    if (!name) return;

    const bal = adding.balance.trim() ? parseMoneyInput(adding.balance) : 0;

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
    setAccounts((prev) => [...prev, saved]);

    await createLedgerEntry({
      id: uid(),
      ts: nowTs(),
      kind: "create",
      accountId: saved.id,
      amount: 0,
      delta: 0,
      resultingBalance: saved.balance,
      note: "Account created",
      relatedAccountId: "",
      relatedAccountName: "",
      sourceType: "accounts_page",
      sourceId: "",
    });

    if (!primaryId) {
      await savePrimary(saved.id);
    }

    setSelectedAccountId(saved.id);
    setAdding({ name: "", type: "checking", balance: "" });
  }

  async function renameAccount(id, nextName) {
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, name: nextName, updatedAt: nowTs() } : a))
    );

    const { error } = await supabase
      .from("accounts")
      .update({
        name: nextName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) setPageError(error.message || "Failed to rename account.");
  }

  async function retypeAccount(id, nextType) {
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, type: nextType, updatedAt: nowTs() } : a))
    );

    const { error } = await supabase
      .from("accounts")
      .update({
        account_type: nextType,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) setPageError(error.message || "Failed to update account type.");
  }

  async function deleteAccount(id) {
    if (!user || !supabase) return;

    if (accounts.length <= 1) {
      alert("You need at least 1 account.");
      return;
    }

    const acc = accounts.find((a) => a.id === id);
    const ok = confirm(`Delete "${acc?.name || "account"}"?`);
    if (!ok) return;

    const next = accounts.filter((a) => a.id !== id);
    setAccounts(next);

    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setPageError(error.message || "Failed to delete account.");
      return;
    }

    await createLedgerEntry({
      id: uid(),
      ts: nowTs(),
      kind: "delete",
      accountId: id,
      amount: 0,
      delta: 0,
      resultingBalance: 0,
      note: `${acc?.name || "Account"} deleted`,
      relatedAccountId: "",
      relatedAccountName: "",
      sourceType: "accounts_page",
      sourceId: "",
    });

    if (primaryId === id) {
      const newPrimary = next[0]?.id || "";
      if (newPrimary) await savePrimary(newPrimary);
    }

    if (selectedAccountId === id) {
      setSelectedAccountId(next[0]?.id || "");
    }
  }

  function openModalFor(id, nextMode = "adjust") {
    setModalAccountId(id);
    setModalOpen(true);
    setMode(nextMode);
    setAmount("");
    setNote("");
    setAdjustSign("deposit");
    setTransferToId("");
  }

  const modalAccount = useMemo(
    () => accounts.find((a) => a.id === modalAccountId) || null,
    [accounts, modalAccountId]
  );

  async function applyModal() {
    setPageError("");
    if (!modalAccount) return;

    const amt = parseMoneyInput(amount);
    const cur = safeNum(modalAccount.balance, 0);

    if (mode === "set") {
      if (!Number.isFinite(amt) || amt < 0) return;

      const saveRes = await saveAccountBalance(modalAccount.id, amt);
      if (!saveRes.ok) {
        setPageError(saveRes.error || "Failed to set balance.");
        return;
      }

      await createLedgerEntry({
        id: uid(),
        ts: nowTs(),
        kind: "set",
        accountId: modalAccount.id,
        amount: amt,
        delta: amt - cur,
        resultingBalance: amt,
        note: note?.trim() || "Manual balance set",
        relatedAccountId: "",
        relatedAccountName: "",
        sourceType: "accounts_page",
        sourceId: "",
      });

      setModalOpen(false);
      return;
    }

    if (!Number.isFinite(amt) || amt <= 0) return;

    if (mode === "transfer") {
      const target = accounts.find((a) => a.id === transferToId);
      if (!target) {
        alert("Choose the account receiving the transfer.");
        return;
      }
      if (target.id === modalAccount.id) {
        alert("Cannot transfer to the same account.");
        return;
      }

      const fromCur = safeNum(modalAccount.balance, 0);
      const toCur = safeNum(target.balance, 0);
      const fromNext = fromCur - Math.abs(amt);
      const toNext = toCur + Math.abs(amt);

      const [fromRes, toRes] = await Promise.all([
        saveAccountBalance(modalAccount.id, fromNext),
        saveAccountBalance(target.id, toNext),
      ]);

      if (!fromRes.ok || !toRes.ok) {
        setPageError(fromRes.error || toRes.error || "Transfer failed.");
        return;
      }

      const commonNote = note?.trim() || "Transfer between accounts";

      await Promise.all([
        createLedgerEntry({
          id: uid(),
          ts: nowTs(),
          kind: "transfer_out",
          accountId: modalAccount.id,
          amount: Math.abs(amt),
          delta: -Math.abs(amt),
          resultingBalance: fromNext,
          note: commonNote,
          relatedAccountId: target.id,
          relatedAccountName: target.name,
          sourceType: "accounts_page",
          sourceId: "",
        }),
        createLedgerEntry({
          id: uid(),
          ts: nowTs(),
          kind: "transfer_in",
          accountId: target.id,
          amount: Math.abs(amt),
          delta: Math.abs(amt),
          resultingBalance: toNext,
          note: commonNote,
          relatedAccountId: modalAccount.id,
          relatedAccountName: modalAccount.name,
          sourceType: "accounts_page",
          sourceId: "",
        }),
      ]);

      setModalOpen(false);
      return;
    }

    const delta = adjustSign === "withdraw" ? -Math.abs(amt) : Math.abs(amt);
    const nextBal = cur + delta;

    const saveRes = await saveAccountBalance(modalAccount.id, nextBal);
    if (!saveRes.ok) {
      setPageError(saveRes.error || "Failed to update balance.");
      return;
    }

    await createLedgerEntry({
      id: uid(),
      ts: nowTs(),
      kind: adjustSign === "withdraw" ? "withdraw" : "deposit",
      accountId: modalAccount.id,
      amount: Math.abs(amt),
      delta,
      resultingBalance: nextBal,
      note: note?.trim() || "",
      relatedAccountId: "",
      relatedAccountName: "",
      sourceType: "accounts_page",
      sourceId: "",
    });

    setModalOpen(false);
  }

  function quickChip(v) {
    setAmount(String(v));
  }

  async function addDemoBillPayment() {
    if (!selectedAccount) return;

    const amt = 125;
    const cur = safeNum(selectedAccount.balance, 0);
    const nextBal = cur - amt;

    const saveRes = await saveAccountBalance(selectedAccount.id, nextBal);
    if (!saveRes.ok) {
      setPageError(saveRes.error || "Failed to create demo bill payment.");
      return;
    }

    await createLedgerEntry({
      id: uid(),
      ts: nowTs(),
      kind: "bill_payment",
      accountId: selectedAccount.id,
      amount: amt,
      delta: -amt,
      resultingBalance: nextBal,
      note: "Example bill payment",
      relatedAccountId: "",
      relatedAccountName: "",
      sourceType: "bill",
      sourceId: "demo-bill-id",
    });
  }

  const currentMonth = new Date().toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  const pageStyles = (
    <style jsx global>{`
      .accountsPage {
        --page-text: #f5f7ff;
        --muted: rgba(220, 228, 255, 0.68);
        --muted-2: rgba(220, 228, 255, 0.48);
        --line: rgba(255, 255, 255, 0.1);
        --line-strong: rgba(255, 255, 255, 0.16);
        --card-bg: linear-gradient(
          180deg,
          rgba(9, 14, 28, 0.88),
          rgba(4, 8, 16, 0.78)
        );
        --card-bg-2: linear-gradient(
          180deg,
          rgba(8, 13, 24, 0.82),
          rgba(3, 7, 14, 0.76)
        );
        --shadow: 0 24px 80px rgba(0, 0, 0, 0.34),
          inset 0 1px 0 rgba(255, 255, 255, 0.05);

        color: var(--page-text);
        color-scheme: dark;
      }

      .accountsPage *,
      .accountsPage *::before,
      .accountsPage *::after {
        box-sizing: border-box;
      }

      .accountsPage .pageShell {
        max-width: 1680px;
        margin: 0 auto;
        padding: 22px 18px 48px;
      }

      .accountsPage .heroCard,
      .accountsPage .glassCard,
      .accountsPage .metricCard,
      .accountsPage .emptyState,
      .accountsPage .errorCard {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: var(--card-bg);
        box-shadow: var(--shadow);
        backdrop-filter: blur(16px);
      }

      .accountsPage .heroCard::before,
      .accountsPage .glassCard::before,
      .accountsPage .metricCard::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at top left, rgba(80, 120, 255, 0.14), transparent 28%),
          radial-gradient(circle at top right, rgba(255, 255, 255, 0.07), transparent 22%),
          radial-gradient(circle at bottom center, rgba(56, 189, 248, 0.08), transparent 24%);
      }

      .accountsPage .heroCard {
        padding: 22px 22px 20px;
        margin-bottom: 16px;
      }

      .accountsPage .heroTop {
        position: relative;
        z-index: 1;
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: flex-start;
        flex-wrap: wrap;
      }

      .accountsPage .eyebrow {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--muted-2);
        margin-bottom: 10px;
      }

      .accountsPage .heroTitle {
        margin: 0;
        font-size: clamp(32px, 4.4vw, 56px);
        line-height: 0.98;
        font-weight: 950;
        letter-spacing: -0.04em;
      }

      .accountsPage .heroSub {
        margin: 10px 0 0;
        max-width: 900px;
        color: var(--muted);
        line-height: 1.55;
        font-size: 14px;
      }

      .accountsPage .heroMeta {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .accountsPage .metaPill,
      .accountsPage .softChip,
      .accountsPage .toneChip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 38px;
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        color: #f5f7ff;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
      }

      .accountsPage .chipRow {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 14px;
      }

      .accountsPage .metricGrid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 16px;
      }

      .accountsPage .metricCard {
        padding: 16px 18px;
        min-height: 150px;
      }

      .accountsPage .metricLabel {
        position: relative;
        z-index: 1;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--muted-2);
      }

      .accountsPage .metricValue {
        position: relative;
        z-index: 1;
        margin-top: 12px;
        font-size: clamp(28px, 3vw, 46px);
        line-height: 1;
        font-weight: 950;
        letter-spacing: -0.04em;
      }

      .accountsPage .metricSub {
        position: relative;
        z-index: 1;
        margin-top: 14px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }

      .accountsPage .metricAccentPink {
        color: #f7a9c4;
      }

      .accountsPage .mainGrid {
        display: grid;
        grid-template-columns: minmax(360px, 0.95fr) minmax(520px, 1.35fr);
        gap: 16px;
        align-items: start;
      }

      .accountsPage .glassCard {
        padding: 18px;
      }

      .accountsPage .focusGrid {
        display: grid;
        grid-template-columns: 1.25fr 0.85fr;
        gap: 16px;
        margin-bottom: 16px;
      }

      .accountsPage .sectionTop {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        align-items: flex-start;
        flex-wrap: wrap;
        margin-bottom: 14px;
        position: relative;
        z-index: 1;
      }

      .accountsPage .sectionTitle {
        margin: 0;
        font-size: 28px;
        line-height: 1;
        font-weight: 900;
        letter-spacing: -0.03em;
      }

      .accountsPage .sectionMini {
        margin: 0;
        font-size: 18px;
        line-height: 1.1;
        font-weight: 900;
      }

      .accountsPage .sectionText {
        margin-top: 8px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .accountsPage .tinyLabel {
        color: var(--muted-2);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 10px;
        margin-bottom: 8px;
        font-weight: 700;
      }

      .accountsPage .mutedText {
        color: var(--muted);
      }

      .accountsPage .mutedTiny {
        color: var(--muted-2);
        font-size: 12px;
      }

      .accountsPage .focusCardInner {
        position: relative;
        z-index: 1;
        border-radius: 22px;
        padding: 16px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background:
          linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01));
      }

      .accountsPage .focusValue {
        margin-top: 10px;
        font-size: clamp(32px, 4vw, 54px);
        line-height: 1;
        font-weight: 950;
        letter-spacing: -0.04em;
      }

      .accountsPage .valueBlock {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .accountsPage .actionRow {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .accountsPage .stack {
        display: grid;
        gap: 12px;
      }

      .accountsPage .field {
        width: 100%;
        min-height: 48px;
        border-radius: 16px;
        border: 1px solid rgba(177, 196, 255, 0.16);
        background: rgba(8, 13, 24, 0.84) !important;
        color: #f4f7ff !important;
        font-size: 14px;
        font-weight: 600;
        padding: 0 14px;
        outline: none;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.03),
          0 0 0 rgba(0, 0, 0, 0);
        transition: border-color 0.18s ease, box-shadow 0.18s ease,
          background 0.18s ease;
      }

      .accountsPage textarea.field {
        min-height: 96px;
        padding: 12px 14px;
        resize: vertical;
      }

      .accountsPage .field::placeholder {
        color: rgba(233, 238, 255, 0.44) !important;
      }

      .accountsPage .field:focus {
        border-color: rgba(121, 163, 255, 0.48);
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
      }

      .accountsPage select.field {
        cursor: pointer;
      }

      .accountsPage select.field option {
        background: #08111f !important;
        color: #f4f7ff !important;
      }

      .accountsPage input:-webkit-autofill,
      .accountsPage input:-webkit-autofill:hover,
      .accountsPage input:-webkit-autofill:focus,
      .accountsPage textarea:-webkit-autofill,
      .accountsPage select:-webkit-autofill {
        -webkit-text-fill-color: #f4f7ff !important;
        -webkit-box-shadow: 0 0 0px 1000px #0a1321 inset !important;
        box-shadow: 0 0 0px 1000px #0a1321 inset !important;
        transition: background-color 9999s ease-in-out 0s;
      }

      .accountsPage .controlGrid {
        display: grid;
        grid-template-columns: 1.2fr 0.9fr 0.9fr;
        gap: 10px;
        margin-bottom: 14px;
      }

      .accountsPage .accountList {
        display: grid;
        gap: 12px;
      }

      .accountsPage .accountItem {
        position: relative;
        overflow: hidden;
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background: var(--card-bg-2);
        padding: 16px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        cursor: pointer;
        transition: transform 0.18s ease, border-color 0.18s ease,
          box-shadow 0.18s ease;
      }

      .accountsPage .accountItem:hover {
        transform: translateY(-1px);
        border-color: rgba(255, 255, 255, 0.12);
      }

      .accountsPage .accountItem.selected {
        border-color: rgba(109, 169, 255, 0.34);
        box-shadow: 0 12px 34px rgba(6, 12, 24, 0.34),
          inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }

      .accountsPage .accountHeader {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }

      .accountsPage .accountActions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .accountsPage .accountEditGrid {
        display: grid;
        grid-template-columns: 1fr 220px;
        gap: 10px;
        margin-bottom: 14px;
      }

      .accountsPage .balanceValue {
        font-size: clamp(28px, 3vw, 40px);
        line-height: 1;
        font-weight: 950;
        letter-spacing: -0.04em;
      }

      .accountsPage .ledgerList {
        display: grid;
        gap: 12px;
      }

      .accountsPage .ledgerItem {
        position: relative;
        overflow: hidden;
        border-radius: 22px;
        padding: 14px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background: linear-gradient(
          180deg,
          rgba(8, 13, 24, 0.78),
          rgba(4, 8, 16, 0.72)
        );
      }

      .accountsPage .ledgerGrid {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) auto auto;
        gap: 14px;
        align-items: center;
      }

      .accountsPage .ledgerRight {
        text-align: right;
      }

      .accountsPage .emptyState {
        padding: 16px;
      }

      .accountsPage .emptyStateTitle {
        font-size: 18px;
        line-height: 1.1;
        font-weight: 900;
        margin: 0;
      }

      .accountsPage .emptyStateText {
        margin-top: 8px;
        color: var(--muted);
        line-height: 1.5;
        font-size: 13px;
      }

      .accountsPage .errorCard {
        padding: 14px 16px;
        margin-bottom: 16px;
        border-color: rgba(244, 114, 182, 0.26);
        background:
          linear-gradient(180deg, rgba(96, 17, 44, 0.38), rgba(36, 8, 18, 0.32));
      }

      .accountsPage .errorTitle {
        font-weight: 900;
        font-size: 15px;
      }

      .accountsPage .solidBtn,
      .accountsPage .ghostBtn,
      .accountsPage .dangerBtn {
        min-height: 42px;
        padding: 0 14px;
        border-radius: 14px;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition: transform 0.18s ease, border-color 0.18s ease,
          background 0.18s ease, box-shadow 0.18s ease;
      }

      .accountsPage .solidBtn:hover,
      .accountsPage .ghostBtn:hover,
      .accountsPage .dangerBtn:hover {
        transform: translateY(-1px);
      }

      .accountsPage .solidBtn {
        border: 1px solid rgba(130, 170, 255, 0.28);
        background:
          linear-gradient(180deg, rgba(77, 124, 255, 0.28), rgba(32, 74, 189, 0.16));
        color: #f7f9ff;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }

      .accountsPage .ghostBtn {
        border: 1px solid rgba(255, 255, 255, 0.09);
        background: rgba(255, 255, 255, 0.04);
        color: #f4f7ff;
      }

      .accountsPage .dangerBtn {
        border: 1px solid rgba(244, 114, 182, 0.22);
        background: rgba(244, 114, 182, 0.09);
        color: #ffd5e5;
      }

      .accountsPage .modalTabs {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }

      .accountsPage .divider {
        height: 1px;
        margin: 14px 0;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.08),
          transparent
        );
      }

      @media (max-width: 1380px) {
        .accountsPage .metricGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .accountsPage .focusGrid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 1180px) {
        .accountsPage .mainGrid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 860px) {
        .accountsPage .pageShell {
          padding: 16px 12px 34px;
        }

        .accountsPage .heroCard,
        .accountsPage .glassCard,
        .accountsPage .metricCard {
          border-radius: 22px;
        }

        .accountsPage .metricGrid {
          grid-template-columns: 1fr;
        }

        .accountsPage .controlGrid {
          grid-template-columns: 1fr;
        }

        .accountsPage .accountEditGrid {
          grid-template-columns: 1fr;
        }

        .accountsPage .ledgerGrid {
          grid-template-columns: 1fr;
        }

        .accountsPage .ledgerRight {
          text-align: left;
        }

        .accountsPage .sectionTitle {
          font-size: 24px;
        }

        .accountsPage .heroTitle {
          font-size: 34px;
        }

        .accountsPage .actionRow,
        .accountsPage .accountActions,
        .accountsPage .heroMeta {
          width: 100%;
          justify-content: flex-start;
        }
      }
    `}</style>
  );

  if (loading) {
    return (
      <main className="accountsPage">
        {pageStyles}
        <div className="pageShell">
          <section className="heroCard">
            <div className="heroTop">
              <div>
                <div className="eyebrow">LIVE FINANCE BOARD</div>
                <h1 className="heroTitle">Accounts Command</h1>
                <p className="heroSub">Loading accounts...</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="accountsPage">
        {pageStyles}
        <div className="pageShell">
          <section className="heroCard">
            <div className="heroTop">
              <div>
                <div className="eyebrow">LIVE FINANCE BOARD</div>
                <h1 className="heroTitle">Accounts Command</h1>
                <p className="heroSub">
                  This page is now Supabase-backed, so it needs an authenticated
                  user.
                </p>
              </div>
            </div>
          </section>

          <section className="emptyState">
            <h2 className="emptyStateTitle">Please log in</h2>
            <div className="emptyStateText">
              Once you sign in, this page will load your synced accounts and
              transactions.
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="accountsPage">
      {pageStyles}

      <div className="pageShell">
        <header className="heroCard">
          <div className="heroTop">
            <div>
              <div className="eyebrow">LIVE FINANCE BOARD</div>
              <h1 className="heroTitle">Accounts Command</h1>
              <p className="heroSub">
                Clean balances, transfer-ready account control, and a real
                ledger view. This version fixes the ugly white input and
                dropdown bars so everything stays dark, readable, and on theme.
              </p>

              <div className="chipRow">
                <span className="softChip">{accounts.length} ACCOUNTS</span>
                <span className="softChip">
                  LAST UPDATE {fmtWhen(totals.updatedMax)}
                </span>
                {primary ? (
                  <span className="softChip">PRIMARY • {primary.name}</span>
                ) : null}
              </div>
            </div>

            <div className="heroMeta">
              <span className="metaPill">{currentMonth}</span>
              <span className="metaPill">
                {primary ? primary.name.toUpperCase() : "NO PRIMARY ACCOUNT"}
              </span>
            </div>
          </div>
        </header>

        {pageError ? (
          <div className="errorCard">
            <div className="errorTitle">Error</div>
            <div className="sectionText" style={{ marginTop: 6 }}>
              {pageError}
            </div>
          </div>
        ) : null}

        <section className="metricGrid">
          <article className="metricCard">
            <div className="metricLabel">Net Worth</div>
            <div className="metricValue">{fmtMoney(totals.netWorth)}</div>
            <div className="metricSub">
              Assets {fmtMoney(totals.assets)} minus credit debt{" "}
              {fmtMoney(totals.debts)}.
            </div>
          </article>

          <article className="metricCard">
            <div className="metricLabel">Liquid Balances</div>
            <div className="metricValue">{fmtMoney(totals.liquid)}</div>
            <div className="metricSub">
              Checking, savings, and cash only. Investments excluded.
            </div>
          </article>

          <article className="metricCard">
            <div className="metricLabel">Investment Accounts</div>
            <div className="metricValue">{fmtMoney(totals.invest)}</div>
            <div className="metricSub">
              Tracked investment account balances currently on the board.
            </div>
          </article>

          <article className="metricCard">
            <div className="metricLabel">Credit Exposure</div>
            <div className="metricValue metricAccentPink">
              {fmtMoney(totals.debts)}
            </div>
            <div className="metricSub">
              Credit accounts should store the amount owed, not negative cash.
            </div>
          </article>
        </section>

        <section className="mainGrid">
          <div>
            <article className="glassCard">
              <div className="sectionTop">
                <div>
                  <h2 className="sectionTitle">Account Roster</h2>
                  <div className="sectionText">
                    Pick an account on the left, then work it on the right.
                  </div>
                </div>

                <div className="softChip">{filteredAccounts.length} SHOWING</div>
              </div>

              <div className="controlGrid">
                <input
                  className="field"
                  placeholder="Search accounts..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />

                <select
                  className="field"
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
                  className="field"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="updated">Recently updated</option>
                  <option value="name">Name</option>
                  <option value="balance">Balance high → low</option>
                </select>
              </div>

              <div className="accountList">
                {filteredAccounts.length === 0 ? (
                  <div className="emptyState">
                    <h3 className="emptyStateTitle">No accounts found</h3>
                    <div className="emptyStateText">
                      Clear filters or add another account.
                    </div>
                  </div>
                ) : (
                  filteredAccounts.map((a) => {
                    const isPrimary = a.id === primaryId;
                    const isSelected = a.id === selectedAccountId;
                    const isCredit =
                      String(a.type || "").toLowerCase() === "credit";

                    return (
                      <div
                        key={a.id}
                        className={`accountItem ${isSelected ? "selected" : ""}`}
                        style={{
                          background: isSelected
                            ? `${typeAccent(a.type)}, linear-gradient(180deg, rgba(8,13,24,.86), rgba(4,8,16,.78))`
                            : "linear-gradient(180deg, rgba(8,13,24,.78), rgba(4,8,16,.74))",
                        }}
                        onClick={() => setSelectedAccountId(a.id)}
                      >
                        <div className="accountHeader">
                          <div className="chipRow" style={{ marginTop: 0 }}>
                            <span className="softChip">
                              {typeIcon(a.type)} {badgeText(a.type)}
                            </span>

                            {isPrimary ? (
                              <span
                                className="softChip"
                                style={{
                                  background: "rgba(77,124,255,.16)",
                                  border: "1px solid rgba(77,124,255,.28)",
                                }}
                              >
                                Primary
                              </span>
                            ) : null}
                          </div>

                          <div className="accountActions">
                            <button
                              className="ghostBtn"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openModalFor(a.id, "adjust");
                              }}
                            >
                              Adjust
                            </button>

                            <button
                              className="ghostBtn"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openModalFor(a.id, "transfer");
                              }}
                            >
                              Transfer
                            </button>

                            <button
                              className={isPrimary ? "solidBtn" : "ghostBtn"}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                savePrimary(a.id);
                              }}
                            >
                              {isPrimary ? "Primary" : "Set Primary"}
                            </button>

                            <button
                              className="dangerBtn"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteAccount(a.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="accountEditGrid">
                          <div>
                            <div className="tinyLabel">Account Name</div>
                            <input
                              className="field"
                              value={a.name}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => renameAccount(a.id, e.target.value)}
                            />
                          </div>

                          <div>
                            <div className="tinyLabel">Account Type</div>
                            <select
                              className="field"
                              value={a.type || "other"}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => retypeAccount(a.id, e.target.value)}
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

                        <div className="tinyLabel">
                          {isCredit ? "Amount Owed" : "Balance"}
                        </div>
                        <div className="balanceValue">{fmtMoney(a.balance)}</div>
                        <div className="sectionText" style={{ marginTop: 10 }}>
                          Updated {fmtWhen(a.updatedAt)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </article>
          </div>

          <div>
            <div className="focusGrid">
              <article className="glassCard">
                <div className="sectionTop">
                  <div>
                    <h2 className="sectionTitle">
                      {selectedAccount ? selectedAccount.name : "Selected Account"}
                    </h2>
                    <div className="sectionText">
                      Focus card for the account you are actively working.
                    </div>
                  </div>

                  {selectedAccount ? (
                    <span className="softChip">
                      {typeIcon(selectedAccount.type)} {typeLabel(selectedAccount.type)}
                    </span>
                  ) : null}
                </div>

                {selectedAccount ? (
                  <div
                    className="focusCardInner"
                    style={{
                      background: `${typeAccent(
                        selectedAccount.type
                      )}, linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01))`,
                    }}
                  >
                    <div className="stack">
                      <div className="valueBlock">
                        <div className="tinyLabel">
                          {String(selectedAccount.type || "").toLowerCase() === "credit"
                            ? "Amount Owed"
                            : "Current Balance"}
                        </div>
                        <div className="focusValue">
                          {fmtMoney(selectedAccount.balance)}
                        </div>
                      </div>

                      <div className="chipRow" style={{ marginTop: 0 }}>
                        <span className="softChip">
                          {selectedAccount.id === primaryId ? "PRIMARY" : "STANDARD"}
                        </span>
                        <span className="softChip">
                          UPDATED {fmtWhen(selectedAccount.updatedAt)}
                        </span>
                      </div>

                      <div className="actionRow">
                        <button
                          className="solidBtn"
                          type="button"
                          onClick={() => openModalFor(selectedAccount.id, "adjust")}
                        >
                          Add Transaction
                        </button>

                        <button
                          className="ghostBtn"
                          type="button"
                          onClick={() => openModalFor(selectedAccount.id, "transfer")}
                        >
                          Transfer
                        </button>

                        <button
                          className="ghostBtn"
                          type="button"
                          onClick={() => openModalFor(selectedAccount.id, "set")}
                        >
                          Set Exact
                        </button>

                        <button
                          className="ghostBtn"
                          type="button"
                          onClick={addDemoBillPayment}
                        >
                          Demo Bill Payment
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="emptyState">
                    <h3 className="emptyStateTitle">No account selected</h3>
                    <div className="emptyStateText">
                      Choose one from the roster to view and manage it here.
                    </div>
                  </div>
                )}
              </article>

              <article className="glassCard">
                <div className="sectionTop">
                  <div>
                    <h3 className="sectionMini">Add Account</h3>
                    <div className="sectionText">
                      Keep this clean. Real financial buckets only.
                    </div>
                  </div>
                </div>

                <form onSubmit={addAccount} className="stack">
                  <div>
                    <div className="tinyLabel">Account Name</div>
                    <input
                      className="field"
                      placeholder="Account name"
                      value={adding.name}
                      onChange={(e) =>
                        setAdding((p) => ({ ...p, name: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <div className="tinyLabel">Type</div>
                    <select
                      className="field"
                      value={adding.type}
                      onChange={(e) =>
                        setAdding((p) => ({ ...p, type: e.target.value }))
                      }
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
                    <div className="tinyLabel">Starting Balance</div>
                    <input
                      className="field"
                      placeholder="Starting balance"
                      value={adding.balance}
                      onChange={(e) =>
                        setAdding((p) => ({ ...p, balance: e.target.value }))
                      }
                    />
                  </div>

                  <button className="solidBtn" type="submit">
                    Add Account
                  </button>
                </form>

                <div className="divider" />

                <div className="mutedTiny">
                  Credit accounts should hold the amount owed as a positive
                  number.
                </div>
              </article>
            </div>

            <article className="glassCard">
              <div className="sectionTop">
                <div>
                  <h2 className="sectionTitle">
                    {selectedAccount
                      ? `${selectedAccount.name} Ledger`
                      : "Transaction Ledger"}
                  </h2>
                  <div className="sectionText">
                    Real movement history for the account you selected.
                  </div>
                </div>

                {selectedAccount ? (
                  <div className="actionRow">
                    <button
                      className="solidBtn"
                      type="button"
                      onClick={() => openModalFor(selectedAccount.id, "adjust")}
                    >
                      Add Transaction
                    </button>

                    <button
                      className="ghostBtn"
                      type="button"
                      onClick={() => openModalFor(selectedAccount.id, "transfer")}
                    >
                      Transfer
                    </button>
                  </div>
                ) : null}
              </div>

              {selectedAccount ? (
                <div
                  className="focusCardInner"
                  style={{
                    marginBottom: 14,
                    background: `${typeAccent(
                      selectedAccount.type
                    )}, linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01))`,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div className="tinyLabel">Account</div>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>
                        {typeIcon(selectedAccount.type)} {selectedAccount.name}
                      </div>
                      <div className="sectionText" style={{ marginTop: 6 }}>
                        {typeLabel(selectedAccount.type)}
                      </div>
                    </div>

                    <div>
                      <div className="tinyLabel">Current Balance</div>
                      <div style={{ fontWeight: 950, fontSize: 30 }}>
                        {fmtMoney(selectedAccount.balance)}
                      </div>
                    </div>

                    <div>
                      <div className="tinyLabel">Status</div>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>
                        {selectedAccount.id === primaryId ? "Primary" : "Standard"}
                      </div>
                      <div className="sectionText" style={{ marginTop: 6 }}>
                        Updated {fmtWhen(selectedAccount.updatedAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <input
                className="field"
                placeholder="Search this account's transactions..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
              />

              <div style={{ height: 14 }} />

              {!selectedAccount ? (
                <div className="emptyState">
                  <h3 className="emptyStateTitle">No account selected</h3>
                  <div className="emptyStateText">
                    Choose an account on the left to view the ledger.
                  </div>
                </div>
              ) : selectedLedger.length === 0 ? (
                <div className="emptyState">
                  <h3 className="emptyStateTitle">No transactions yet</h3>
                  <div className="emptyStateText">
                    Use Adjust, Transfer, or bill-linked entries to build the
                    history.
                  </div>
                </div>
              ) : (
                <div className="ledgerList">
                  {selectedLedger.map((entry) => {
                    const tone = transactionTone(entry.kind);

                    return (
                      <div
                        key={entry.id}
                        className="ledgerItem"
                        style={{
                          border:
                            tone === "good"
                              ? "1px solid rgba(34,197,94,.18)"
                              : tone === "bad"
                                ? "1px solid rgba(244,114,182,.18)"
                                : "1px solid rgba(255,255,255,.07)",
                          background:
                            tone === "good"
                              ? "linear-gradient(180deg, rgba(34,197,94,.08), rgba(6,12,24,.75))"
                              : tone === "bad"
                                ? "linear-gradient(180deg, rgba(244,114,182,.08), rgba(6,12,24,.75))"
                                : "linear-gradient(180deg, rgba(8,13,24,.78), rgba(4,8,16,.72))",
                        }}
                      >
                        <div className="ledgerGrid">
                          <div>
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                className="toneChip"
                                style={{
                                  minHeight: 34,
                                  padding: "8px 10px",
                                  ...transactionChipStyle(entry.kind),
                                }}
                              >
                                {transactionLabel(entry.kind)}
                              </span>

                              {entry.relatedAccountName ? (
                                <span className="mutedTiny">
                                  {String(entry.kind).includes("transfer")
                                    ? `with ${entry.relatedAccountName}`
                                    : entry.relatedAccountName}
                                </span>
                              ) : null}

                              {entry.sourceType === "bill" ? (
                                <span
                                  className="softChip"
                                  style={{
                                    minHeight: 34,
                                    padding: "8px 10px",
                                    background: "rgba(77,124,255,.14)",
                                    border: "1px solid rgba(77,124,255,.22)",
                                  }}
                                >
                                  Bill-linked
                                </span>
                              ) : null}
                            </div>

                            <div className="sectionText" style={{ marginTop: 8 }}>
                              {fmtWhen(entry.ts)}
                            </div>

                            {entry.note ? (
                              <div
                                style={{
                                  marginTop: 8,
                                  lineHeight: 1.5,
                                  color: "#eef4ff",
                                  fontSize: 14,
                                }}
                              >
                                {entry.note}
                              </div>
                            ) : null}
                          </div>

                          <div className="ledgerRight">
                            <div className="tinyLabel">Change</div>
                            <div
                              style={{
                                fontWeight: 950,
                                fontSize: 20,
                                color:
                                  tone === "good"
                                    ? "rgb(134 239 172)"
                                    : tone === "bad"
                                      ? "rgb(251 207 232)"
                                      : "#f5f7ff",
                              }}
                            >
                              {fmtDelta(entry.delta)}
                            </div>
                          </div>

                          <div className="ledgerRight">
                            <div className="tinyLabel">Balance After</div>
                            <div style={{ fontWeight: 900, fontSize: 20 }}>
                              {fmtMoney(entry.resultingBalance)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          </div>
        </section>
      </div>

      <Modal
        open={modalOpen}
        title={modalAccount ? `${modalAccount.name} transaction` : "Transaction"}
        subtitle={
          modalAccount
            ? `${typeIcon(modalAccount.type)} ${typeLabel(
                modalAccount.type
              )} • Current balance ${fmtMoney(modalAccount.balance)}`
            : ""
        }
        onClose={() => setModalOpen(false)}
      >
        {!modalAccount ? (
          <div className="mutedText">No account selected.</div>
        ) : (
          <>
            <div className="modalTabs">
              <button
                className={mode === "adjust" ? "solidBtn" : "ghostBtn"}
                type="button"
                onClick={() => setMode("adjust")}
              >
                Deposit / Withdraw
              </button>

              <button
                className={mode === "transfer" ? "solidBtn" : "ghostBtn"}
                type="button"
                onClick={() => setMode("transfer")}
              >
                Transfer
              </button>

              <button
                className={mode === "set" ? "solidBtn" : "ghostBtn"}
                type="button"
                onClick={() => setMode("set")}
              >
                Set Exact Balance
              </button>

              <span className="softChip" style={{ marginLeft: "auto" }}>
                PRIMARY: {modalAccount.id === primaryId ? "YES" : "NO"}
              </span>
            </div>

            {mode === "adjust" ? (
              <div className="stack">
                <div className="actionRow">
                  <button
                    className={adjustSign === "deposit" ? "solidBtn" : "ghostBtn"}
                    type="button"
                    onClick={() => setAdjustSign("deposit")}
                  >
                    Deposit
                  </button>

                  <button
                    className={adjustSign === "withdraw" ? "solidBtn" : "ghostBtn"}
                    type="button"
                    onClick={() => setAdjustSign("withdraw")}
                  >
                    Withdraw
                  </button>
                </div>

                <div>
                  <div className="tinyLabel">Amount</div>
                  <input
                    className="field"
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div className="actionRow">
                  {[10, 20, 50, 100, 200, 500, 1000].map((v) => (
                    <button
                      key={v}
                      className="ghostBtn"
                      type="button"
                      onClick={() => quickChip(v)}
                    >
                      {fmtMoney(v)}
                    </button>
                  ))}
                </div>

                <div>
                  <div className="tinyLabel">Note</div>
                  <input
                    className="field"
                    placeholder="Note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                <button className="solidBtn" type="button" onClick={applyModal}>
                  Apply Transaction
                </button>
              </div>
            ) : null}

            {mode === "transfer" ? (
              <div className="stack">
                <div>
                  <div className="tinyLabel">Destination Account</div>
                  <select
                    className="field"
                    value={transferToId}
                    onChange={(e) => setTransferToId(e.target.value)}
                  >
                    <option value="">Choose destination account</option>
                    {accounts
                      .filter((a) => a.id !== modalAccount.id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} — {typeLabel(a.type)}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <div className="tinyLabel">Transfer Amount</div>
                  <input
                    className="field"
                    placeholder="Transfer amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div>
                  <div className="tinyLabel">Note</div>
                  <input
                    className="field"
                    placeholder="Note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                <button className="solidBtn" type="button" onClick={applyModal}>
                  Complete Transfer
                </button>
              </div>
            ) : null}

            {mode === "set" ? (
              <div className="stack">
                <div>
                  <div className="tinyLabel">New Exact Balance</div>
                  <input
                    className="field"
                    placeholder="New exact balance"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div>
                  <div className="tinyLabel">Note</div>
                  <input
                    className="field"
                    placeholder="Note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                <button className="solidBtn" type="button" onClick={applyModal}>
                  Set Balance
                </button>
              </div>
            ) : null}
          </>
        )}
      </Modal>
    </main>
  );
}