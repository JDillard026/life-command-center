"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/* =========================
   utils
========================= */
function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  if (t === "checking") return "linear-gradient(135deg, rgba(59,130,246,.22), rgba(37,99,235,.08))";
  if (t === "savings") return "linear-gradient(135deg, rgba(34,197,94,.22), rgba(21,128,61,.08))";
  if (t === "cash") return "linear-gradient(135deg, rgba(245,158,11,.22), rgba(217,119,6,.08))";
  if (t === "credit") return "linear-gradient(135deg, rgba(239,68,68,.22), rgba(185,28,28,.08))";
  if (t === "investment") return "linear-gradient(135deg, rgba(168,85,247,.22), rgba(126,34,206,.08))";
  return "linear-gradient(135deg, rgba(148,163,184,.18), rgba(100,116,139,.08))";
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
  if (k === "set") return "neutral";
  return "neutral";
}

function transactionChipStyle(kind) {
  const tone = transactionTone(kind);
  if (tone === "good") {
    return {
      background: "rgba(34,197,94,.15)",
      border: "1px solid rgba(34,197,94,.28)",
      color: "rgb(134 239 172)",
    };
  }
  if (tone === "bad") {
    return {
      background: "rgba(239,68,68,.15)",
      border: "1px solid rgba(239,68,68,.28)",
      color: "rgb(252 165 165)",
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
    { id: uid(), name: "Checking", type: "checking", balance: 0, updatedAt: nowTs() },
    { id: uid(), name: "Savings", type: "savings", balance: 0, updatedAt: nowTs() },
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
        background: "rgba(2,6,23,.72)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: "min(760px, 100%)",
          padding: 16,
          borderRadius: 22,
          border: "1px solid rgba(255,255,255,.08)",
          boxShadow: "0 20px 80px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
            {subtitle ? (
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {subtitle}
              </div>
            ) : null}
          </div>

          <button className="btnGhost" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ height: 14 }} />
        {children}
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
          supabase.from("accounts").select("*").eq("user_id", currentUser.id).order("updated_at", { ascending: false }),
          supabase.from("account_settings").select("*").eq("user_id", currentUser.id).maybeSingle(),
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
          const insertRows = seeded.map((a) => mapAccountClientToRow(a, currentUser.id));
          const insertRes = await supabase.from("accounts").insert(insertRows).select("*");
          if (insertRes.error) throw insertRes.error;
          loadedAccounts = (insertRes.data || []).map(mapAccountRowToClient);
        }

        const primary =
          settingsRes.data?.primary_account_id && loadedAccounts.some((a) => a.id === settingsRes.data.primary_account_id)
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

  const primary = useMemo(() => accounts.find((a) => a.id === primaryId) || null, [accounts, primaryId]);
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

    const netWorth = assets - debts;
    const updatedMax = accounts.reduce((mx, a) => Math.max(mx, safeNum(a.updatedAt, 0)), 0);

    return { checking, savings, cash, invest, debts, assets, netWorth, updatedMax };
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
      list = list.filter((a) => String(a.type || "other").toLowerCase() === typeFilter);
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

    if (error) return { ok: false, error: error.message || "Failed to save transaction." };

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
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, name: nextName, updatedAt: nowTs() } : a)));

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
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, type: nextType, updatedAt: nowTs() } : a)));

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

    const { error } = await supabase.from("accounts").delete().eq("id", id).eq("user_id", user.id);

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
    if (!Number.isFinite(amt) || amt <= 0) return;

    const cur = safeNum(modalAccount.balance, 0);

    if (mode === "set") {
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

  if (loading) {
    return (
      <main className="container">
        <div className="card" style={{ padding: 18 }}>
          Loading accounts...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="container">
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Please log in</div>
          <div className="muted" style={{ marginTop: 8 }}>
            This page is now Supabase-backed, so it needs an authenticated user.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <header style={{ marginBottom: 18 }}>
        <div className="muted" style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>
          Accounts
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 1.03 }}>
              Account Command Center
            </h1>
            <div className="muted" style={{ marginTop: 10, maxWidth: 900 }}>
              Banking-style account view. Clean balances. Transfer-ready. Bill-payment-ready. Primary account feeds your future forecast.
            </div>
          </div>

          <div
            className="pill"
            style={{
              padding: "12px 14px",
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minWidth: 260,
            }}
          >
            <span className="muted" style={{ fontSize: 12 }}>Net Worth</span>
            <span style={{ fontWeight: 950, fontSize: 22 }}>{fmtMoney(totals.netWorth)}</span>
            <span className="muted" style={{ fontSize: 12 }}>
              Assets <b>{fmtMoney(totals.assets)}</b> • Debts <b>{fmtMoney(totals.debts)}</b>
            </span>
          </div>
        </div>
      </header>

      {pageError ? (
        <div
          className="card"
          style={{
            padding: 12,
            marginBottom: 16,
            border: "1px solid rgba(239,68,68,.35)",
            background: "rgba(127,29,29,.18)",
          }}
        >
          <div style={{ fontWeight: 900 }}>Error</div>
          <div className="muted" style={{ marginTop: 6 }}>
            {pageError}
          </div>
        </div>
      ) : null}

      {/* summary strip */}
      <section
        className="card"
        style={{
          padding: 14,
          marginBottom: 16,
          borderRadius: 22,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top left, rgba(59,130,246,.12), transparent 28%), radial-gradient(circle at top right, rgba(168,85,247,.10), transparent 24%), radial-gradient(circle at bottom center, rgba(34,197,94,.08), transparent 28%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          {[
            { label: "Checking", value: totals.checking, icon: "🏦" },
            { label: "Savings", value: totals.savings, icon: "💰" },
            { label: "Cash", value: totals.cash, icon: "💵" },
            { label: "Investments", value: totals.invest, icon: "📈" },
            { label: "Credit Debt", value: totals.debts, icon: "💳" },
          ].map((item) => (
            <div
              key={item.label}
              className="card"
              style={{
                padding: 12,
                borderRadius: 18,
                background: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.06)",
              }}
            >
              <div className="muted" style={{ fontSize: 12 }}>
                {item.icon} {item.label}
              </div>
              <div style={{ fontWeight: 900, fontSize: 22, marginTop: 6 }}>{fmtMoney(item.value)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* top grid */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.35fr .9fr",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        <div
          className="card"
          style={{
            padding: 16,
            borderRadius: 24,
            background:
              primary
                ? `${typeAccent(primary.type)}, linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01))`
                : "linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01))",
            border: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div className="muted" style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>
                Primary Account
              </div>
              <div style={{ fontSize: 28, fontWeight: 950, marginTop: 6 }}>
                {primary ? primary.name : "No primary account"}
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                {primary ? `${typeIcon(primary.type)} ${typeLabel(primary.type)} • Updated ${fmtWhen(primary.updatedAt)}` : "Set one below."}
              </div>
            </div>

            <span
              className="pill"
              style={{
                padding: "9px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,.08)",
              }}
            >
              Used for forecast baseline
            </span>
          </div>

          <div style={{ height: 18 }} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 16,
              alignItems: "end",
            }}
          >
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Available view</div>
              <div style={{ fontWeight: 950, fontSize: "clamp(32px, 5vw, 48px)", marginTop: 6 }}>
                {primary ? fmtMoney(primary.balance) : "—"}
              </div>
            </div>

            {primary ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button className="btn" type="button" onClick={() => openModalFor(primary.id, "adjust")}>
                  Adjust
                </button>
                <button className="btnGhost" type="button" onClick={() => openModalFor(primary.id, "transfer")}>
                  Transfer
                </button>
                <button className="btnGhost" type="button" onClick={() => openModalFor(primary.id, "set")}>
                  Set exact
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="card" style={{ padding: 16, borderRadius: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Add account</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Keep it clean. Add real financial buckets only.
          </div>

          <div style={{ height: 12 }} />

          <form onSubmit={addAccount} className="grid" style={{ gap: 10 }}>
            <input
              className="input"
              placeholder="Account name"
              value={adding.name}
              onChange={(e) => setAdding((p) => ({ ...p, name: e.target.value }))}
            />

            <select
              className="input"
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

            <input
              className="input"
              placeholder="Starting balance"
              value={adding.balance}
              onChange={(e) => setAdding((p) => ({ ...p, balance: e.target.value }))}
            />

            <button className="btn" type="submit">
              Add account
            </button>
          </form>

          <div style={{ height: 12 }} />
          <div className="muted" style={{ fontSize: 12 }}>
            Credit accounts should store the balance as the <b>amount owed</b>, not negative cash.
          </div>
        </div>
      </section>

      <div style={{ height: 16 }} />

      {/* main body */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 1.35fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* left */}
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card" style={{ padding: 16, borderRadius: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Account list</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {accounts.length} total
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="grid" style={{ gap: 10 }}>
              <input
                className="input"
                placeholder="Search accounts..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="all">All types</option>
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="cash">Cash</option>
                  <option value="credit">Credit Card</option>
                  <option value="investment">Investment</option>
                  <option value="other">Other</option>
                </select>

                <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="updated">Recently updated</option>
                  <option value="name">Name</option>
                  <option value="balance">Balance high → low</option>
                </select>
              </div>
            </div>

            <div style={{ height: 14 }} />

            <div className="grid" style={{ gap: 12 }}>
              {filteredAccounts.length === 0 ? (
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 900 }}>No accounts found</div>
                  <div className="muted" style={{ marginTop: 6 }}>Clear filters or add another account.</div>
                </div>
              ) : (
                filteredAccounts.map((a) => {
                  const isPrimary = a.id === primaryId;
                  const isSelected = a.id === selectedAccountId;

                  return (
                    <div
                      key={a.id}
                      className="card"
                      style={{
                        padding: 14,
                        borderRadius: 20,
                        border: isSelected ? "1px solid rgba(96,165,250,.45)" : "1px solid rgba(255,255,255,.06)",
                        background: isSelected
                          ? `${typeAccent(a.type)}, rgba(255,255,255,.02)`
                          : "rgba(255,255,255,.02)",
                        boxShadow: isSelected ? "0 10px 30px rgba(15,23,42,.28)" : "none",
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedAccountId(a.id)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                            <span className="pill" style={{ padding: "7px 10px" }}>
                              {typeIcon(a.type)} {badgeText(a.type)}
                            </span>
                            {isPrimary ? (
                              <span
                                className="pill"
                                style={{
                                  padding: "7px 10px",
                                  background: "rgba(59,130,246,.16)",
                                  border: "1px solid rgba(59,130,246,.32)",
                                }}
                              >
                                Primary
                              </span>
                            ) : null}
                          </div>

                          <input
                            className="input"
                            value={a.name}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => renameAccount(a.id, e.target.value)}
                            style={{ marginBottom: 10 }}
                          />

                          <select
                            className="input"
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

                          <div style={{ height: 10 }} />
                          <div className="muted" style={{ fontSize: 12 }}>Balance</div>
                          <div style={{ fontSize: 26, fontWeight: 950, marginTop: 4 }}>{fmtMoney(a.balance)}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                            Updated {fmtWhen(a.updatedAt)}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <button
                            className="btnGhost"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openModalFor(a.id, "adjust");
                            }}
                          >
                            Adjust
                          </button>
                          <button
                            className="btnGhost"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openModalFor(a.id, "transfer");
                            }}
                          >
                            Transfer
                          </button>
                          <button
                            className={isPrimary ? "btn" : "btnGhost"}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              savePrimary(a.id);
                            }}
                          >
                            {isPrimary ? "Primary" : "Set primary"}
                          </button>
                          <button
                            className="btnGhost"
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
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* right */}
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card" style={{ padding: 16, borderRadius: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>
                  {selectedAccount ? `${selectedAccount.name} ledger` : "Transaction ledger"}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  This is where the page starts feeling like a real bank account.
                </div>
              </div>

              {selectedAccount ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn" type="button" onClick={() => openModalFor(selectedAccount.id, "adjust")}>
                    Add transaction
                  </button>
                  <button className="btnGhost" type="button" onClick={() => openModalFor(selectedAccount.id, "transfer")}>
                    Transfer
                  </button>
                  <button className="btnGhost" type="button" onClick={addDemoBillPayment}>
                    Demo bill payment
                  </button>
                </div>
              ) : null}
            </div>

            <div style={{ height: 12 }} />

            {selectedAccount ? (
              <div
                className="card"
                style={{
                  padding: 14,
                  borderRadius: 20,
                  background: `${typeAccent(selectedAccount.type)}, rgba(255,255,255,.02)`,
                  border: "1px solid rgba(255,255,255,.08)",
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Account</div>
                    <div style={{ fontWeight: 900, fontSize: 18, marginTop: 4 }}>
                      {typeIcon(selectedAccount.type)} {selectedAccount.name}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {typeLabel(selectedAccount.type)}
                    </div>
                  </div>

                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Current balance</div>
                    <div style={{ fontWeight: 950, fontSize: 28, marginTop: 4 }}>
                      {fmtMoney(selectedAccount.balance)}
                    </div>
                  </div>

                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Status</div>
                    <div style={{ fontWeight: 900, marginTop: 4 }}>{selectedAccount.id === primaryId ? "Primary" : "Standard"}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Updated {fmtWhen(selectedAccount.updatedAt)}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <input
              className="input"
              placeholder="Search this account's transactions..."
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
            />

            <div style={{ height: 14 }} />

            {!selectedAccount ? (
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 900 }}>No account selected</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  Choose an account on the left to view the ledger.
                </div>
              </div>
            ) : selectedLedger.length === 0 ? (
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 900 }}>No transactions yet</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  Use Adjust, Transfer, or future Bill Payments to build clean history.
                </div>
              </div>
            ) : (
              <div className="grid" style={{ gap: 12 }}>
                {selectedLedger.map((entry) => {
                  const tone = transactionTone(entry.kind);
                  return (
                    <div
                      key={entry.id}
                      className="card"
                      style={{
                        padding: 14,
                        borderRadius: 20,
                        border:
                          tone === "good"
                            ? "1px solid rgba(34,197,94,.18)"
                            : tone === "bad"
                              ? "1px solid rgba(239,68,68,.18)"
                              : "1px solid rgba(255,255,255,.06)",
                        background:
                          tone === "good"
                            ? "linear-gradient(180deg, rgba(34,197,94,.08), rgba(255,255,255,.02))"
                            : tone === "bad"
                              ? "linear-gradient(180deg, rgba(239,68,68,.08), rgba(255,255,255,.02))"
                              : "rgba(255,255,255,.02)",
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "1.35fr auto auto", gap: 12, alignItems: "center" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span className="pill" style={{ padding: "7px 10px", ...transactionChipStyle(entry.kind) }}>
                              {transactionLabel(entry.kind)}
                            </span>

                            {entry.relatedAccountName ? (
                              <span className="muted" style={{ fontSize: 12 }}>
                                {String(entry.kind).includes("transfer") ? `with ${entry.relatedAccountName}` : entry.relatedAccountName}
                              </span>
                            ) : null}

                            {entry.sourceType === "bill" ? (
                              <span
                                className="pill"
                                style={{
                                  padding: "7px 10px",
                                  background: "rgba(59,130,246,.12)",
                                  border: "1px solid rgba(59,130,246,.24)",
                                }}
                              >
                                Bill-linked
                              </span>
                            ) : null}
                          </div>

                          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                            {fmtWhen(entry.ts)}
                          </div>

                          {entry.note ? (
                            <div style={{ marginTop: 8, lineHeight: 1.4 }}>
                              {entry.note}
                            </div>
                          ) : null}
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div className="muted" style={{ fontSize: 12 }}>Change</div>
                          <div
                            style={{
                              fontWeight: 950,
                              fontSize: 18,
                              marginTop: 4,
                              color:
                                tone === "good"
                                  ? "rgb(134 239 172)"
                                  : tone === "bad"
                                    ? "rgb(252 165 165)"
                                    : "inherit",
                            }}
                          >
                            {fmtDelta(entry.delta)}
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div className="muted" style={{ fontSize: 12 }}>Balance after</div>
                          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 4 }}>
                            {fmtMoney(entry.resultingBalance)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <Modal
        open={modalOpen}
        title={modalAccount ? `${modalAccount.name} transaction` : "Transaction"}
        subtitle={
          modalAccount
            ? `${typeIcon(modalAccount.type)} ${typeLabel(modalAccount.type)} • Current balance ${fmtMoney(modalAccount.balance)}`
            : ""
        }
        onClose={() => setModalOpen(false)}
      >
        {!modalAccount ? (
          <div className="muted">No account selected.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <button className={mode === "adjust" ? "btn" : "btnGhost"} type="button" onClick={() => setMode("adjust")}>
                Deposit / Withdraw
              </button>
              <button className={mode === "transfer" ? "btn" : "btnGhost"} type="button" onClick={() => setMode("transfer")}>
                Transfer
              </button>
              <button className={mode === "set" ? "btn" : "btnGhost"} type="button" onClick={() => setMode("set")}>
                Set exact balance
              </button>

              <span className="pill" style={{ padding: "8px 10px", marginLeft: "auto" }}>
                Primary: <b>{modalAccount.id === primaryId ? "Yes" : "No"}</b>
              </span>
            </div>

            {mode === "adjust" ? (
              <div className="grid" style={{ gap: 12 }}>
                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <button className={adjustSign === "deposit" ? "btn" : "btnGhost"} type="button" onClick={() => setAdjustSign("deposit")}>
                    Deposit
                  </button>
                  <button className={adjustSign === "withdraw" ? "btn" : "btnGhost"} type="button" onClick={() => setAdjustSign("withdraw")}>
                    Withdraw
                  </button>
                </div>

                <input
                  className="input"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[10, 20, 50, 100, 200, 500, 1000].map((v) => (
                    <button key={v} className="btnGhost" type="button" onClick={() => quickChip(v)}>
                      {fmtMoney(v)}
                    </button>
                  ))}
                </div>

                <input
                  className="input"
                  placeholder="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />

                <button className="btn" type="button" onClick={applyModal}>
                  Apply transaction
                </button>
              </div>
            ) : null}

            {mode === "transfer" ? (
              <div className="grid" style={{ gap: 12 }}>
                <select className="input" value={transferToId} onChange={(e) => setTransferToId(e.target.value)}>
                  <option value="">Choose destination account</option>
                  {accounts
                    .filter((a) => a.id !== modalAccount.id)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {typeLabel(a.type)}
                      </option>
                    ))}
                </select>

                <input
                  className="input"
                  placeholder="Transfer amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />

                <input
                  className="input"
                  placeholder="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />

                <button className="btn" type="button" onClick={applyModal}>
                  Complete transfer
                </button>
              </div>
            ) : null}

            {mode === "set" ? (
              <div className="grid" style={{ gap: 12 }}>
                <input
                  className="input"
                  placeholder="New exact balance"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />

                <input
                  className="input"
                  placeholder="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />

                <button className="btn" type="button" onClick={applyModal}>
                  Set balance
                </button>
              </div>
            ) : null}
          </>
        )}
      </Modal>
    </main>
  );
}