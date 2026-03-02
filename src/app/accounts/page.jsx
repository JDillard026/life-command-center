"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

const LS_ACCOUNTS = "lcc_accounts_v1";
const LS_PRIMARY = "lcc_accounts_primary_v1";
const LS_ACTIVITY = "lcc_accounts_activity_v1";

/** ---------- utils ---------- */
function safeParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now());
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function fmtMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
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

function nowTs() {
  return Date.now();
}

function fmtWhen(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** ---------- default seed ---------- */
function defaultAccounts() {
  return [
    { id: uid(), name: "Checking", type: "checking", balance: 0, updatedAt: nowTs() },
    { id: uid(), name: "Savings", type: "savings", balance: 0, updatedAt: nowTs() },
  ];
}

/** ---------- Modal (no libs) ---------- */
function Modal({ open, title, subtitle, children, onClose }) {
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
        zIndex: 50,
        background: "rgba(0,0,0,.55)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div className="card" style={{ width: "min(720px, 100%)", padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 16 }}>{title}</div>
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

        <div style={{ height: 12 }} />
        {children}
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [primaryId, setPrimaryId] = useState("");

  // Add form
  const [adding, setAdding] = useState({ name: "", type: "checking", balance: "" });

  // Search/sort/filter
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated"); // updated | name | balance
  const [typeFilter, setTypeFilter] = useState("all");

  // Activity (last 20)
  const [activity, setActivity] = useState([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAccountId, setModalAccountId] = useState("");
  const [mode, setMode] = useState("adjust"); // adjust | set
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState(""); // future-ready
  const [adjustSign, setAdjustSign] = useState("deposit"); // deposit | withdraw

  // Load
  useEffect(() => {
    const saved = safeParse(localStorage.getItem(LS_ACCOUNTS) || "[]", []);
    let list = Array.isArray(saved) ? saved : [];
    if (list.length === 0) {
      list = defaultAccounts();
      localStorage.setItem(LS_ACCOUNTS, JSON.stringify(list));
    } else {
      // backfill updatedAt if older data
      list = list.map((a) => ({ ...a, updatedAt: a.updatedAt ?? nowTs() }));
    }
    setAccounts(list);

    const savedPrimary = localStorage.getItem(LS_PRIMARY);
    const valid = savedPrimary && list.some((a) => a.id === savedPrimary) ? savedPrimary : list[0]?.id || "";
    setPrimaryId(valid);
    if (valid) localStorage.setItem(LS_PRIMARY, valid);

    const savedAct = safeParse(localStorage.getItem(LS_ACTIVITY) || "[]", []);
    setActivity(Array.isArray(savedAct) ? savedAct.slice(0, 20) : []);
  }, []);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(LS_ACCOUNTS, JSON.stringify(accounts));
    } catch {}
  }, [accounts]);

  useEffect(() => {
    try {
      if (primaryId) localStorage.setItem(LS_PRIMARY, primaryId);
    } catch {}
  }, [primaryId]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_ACTIVITY, JSON.stringify(activity.slice(0, 20)));
    } catch {}
  }, [activity]);

  const primary = useMemo(() => accounts.find((a) => a.id === primaryId) || null, [accounts, primaryId]);

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

    // IMPORTANT: credit stored as positive "owed"
    const debts = accounts
      .filter((a) => String(a.type || "").toLowerCase() === "credit")
      .reduce((s, a) => s + safeNum(a.balance, 0), 0);

    const assets = accounts
      .filter((a) => String(a.type || "").toLowerCase() !== "credit")
      .reduce((s, a) => s + safeNum(a.balance, 0), 0);

    const netWorth = assets - debts;

    const updatedMax = accounts.reduce((mx, a) => Math.max(mx, safeNum(a.updatedAt, 0)), 0);

    return { checking, savings, cash, invest, assets, debts, netWorth, updatedMax };
  }, [accounts]);

  const filtered = useMemo(() => {
    let list = [...accounts];

    const q = query.trim().toLowerCase();
    if (q) list = list.filter((a) => String(a.name || "").toLowerCase().includes(q));
    if (typeFilter !== "all") list = list.filter((a) => String(a.type || "other").toLowerCase() === typeFilter);

    if (sort === "name") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    } else if (sort === "balance") {
      list.sort((a, b) => safeNum(b.balance, 0) - safeNum(a.balance, 0));
    } else {
      list.sort((a, b) => safeNum(b.updatedAt, 0) - safeNum(a.updatedAt, 0));
    }

    // Keep primary at top always
    if (primaryId) {
      list.sort((a, b) => (a.id === primaryId ? -1 : b.id === primaryId ? 1 : 0));
    }
    return list;
  }, [accounts, query, sort, typeFilter, primaryId]);

  function pushActivity(entry) {
    setActivity((prev) => [entry, ...prev].slice(0, 20));
  }

  function addAccount(e) {
    e.preventDefault();
    const name = adding.name.trim();
    if (!name) return;

    const balRaw = adding.balance.trim();
    const bal = balRaw ? parseMoneyInput(balRaw) : 0;

    const nextAcc = {
      id: uid(),
      name,
      type: adding.type,
      balance: Number.isFinite(bal) ? bal : 0,
      updatedAt: nowTs(),
    };

    const next = [...accounts, nextAcc];
    setAccounts(next);
    if (!primaryId) setPrimaryId(nextAcc.id);

    pushActivity({
      id: uid(),
      ts: nowTs(),
      kind: "create",
      accountId: nextAcc.id,
      accountName: nextAcc.name,
      accountType: nextAcc.type,
      delta: 0,
      newBalance: nextAcc.balance,
    });

    setAdding({ name: "", type: "checking", balance: "" });
  }

  function updateAccount(id, patch) {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: nowTs() } : a)));
  }

  function deleteAccount(id) {
    if (accounts.length <= 1) {
      alert("You need at least 1 account.");
      return;
    }
    const acc = accounts.find((a) => a.id === id);
    const ok = confirm(`Delete "${acc?.name || "account"}"?`);
    if (!ok) return;

    const next = accounts.filter((a) => a.id !== id);
    setAccounts(next);

    pushActivity({
      id: uid(),
      ts: nowTs(),
      kind: "delete",
      accountId: id,
      accountName: acc?.name || "Account",
      accountType: acc?.type || "other",
      delta: 0,
      newBalance: null,
    });

    if (primaryId === id) {
      const newPrimary = next[0]?.id || "";
      setPrimaryId(newPrimary);
    }
  }

  function openModalFor(id) {
    setModalAccountId(id);
    setModalOpen(true);
    setMode("adjust");
    setAdjustSign("deposit");
    setAmount("");
    setNote("");
  }

  const modalAccount = useMemo(() => accounts.find((a) => a.id === modalAccountId) || null, [accounts, modalAccountId]);

  function applyModal() {
    if (!modalAccount) return;

    const amt = parseMoneyInput(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;

    const cur = safeNum(modalAccount.balance, 0);

    if (mode === "set") {
      updateAccount(modalAccount.id, { balance: amt });

      pushActivity({
        id: uid(),
        ts: nowTs(),
        kind: "set",
        accountId: modalAccount.id,
        accountName: modalAccount.name,
        accountType: modalAccount.type,
        delta: amt - cur,
        newBalance: amt,
        note: note?.trim() || "",
      });

      setModalOpen(false);
      return;
    }

    const delta = adjustSign === "withdraw" ? -amt : amt;
    const nextBal = cur + delta;

    updateAccount(modalAccount.id, { balance: nextBal });

    pushActivity({
      id: uid(),
      ts: nowTs(),
      kind: adjustSign === "withdraw" ? "withdraw" : "deposit",
      accountId: modalAccount.id,
      accountName: modalAccount.name,
      accountType: modalAccount.type,
      delta,
      newBalance: nextBal,
      note: note?.trim() || "",
    });

    setModalOpen(false);
  }

  function quickChip(v) {
    setAmount(String(v));
  }

  function activityLabel(a) {
    const kind = String(a.kind || "").toLowerCase();
    if (kind === "deposit") return "Deposit";
    if (kind === "withdraw") return "Withdraw";
    if (kind === "set") return "Set";
    if (kind === "create") return "Added";
    if (kind === "delete") return "Deleted";
    return "Update";
  }

  function fmtDelta(delta) {
    const n = safeNum(delta, 0);
    if (n === 0) return "—";
    const sign = n > 0 ? "+" : "−";
    return `${sign}${fmtMoney(Math.abs(n))}`;
  }

  return (
    <main className="container">
      <header style={{ marginBottom: 16 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Accounts
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <div>
            <h1 style={{ margin: 0 }}>Accounts & Balances</h1>
            <div className="muted" style={{ marginTop: 8 }}>
              Primary powers forecast • last update: <b>{fmtWhen(totals.updatedMax)}</b>
            </div>
          </div>

          <span className="pill" style={{ padding: "8px 10px" }}>
            Net Worth: <b>{fmtMoney(totals.netWorth)}</b>
            <span className="muted" style={{ marginLeft: 10 }}>
              Assets <b>{fmtMoney(totals.assets)}</b> • Debts <b>{fmtMoney(totals.debts)}</b>
            </span>
          </span>
        </div>
      </header>

      {/* TOP: Primary + Snapshot */}
      <div className="row" style={{ gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        <div className="card" style={{ padding: 14, flex: 2, minWidth: 360 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Primary account</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Forecast starts from this balance.
              </div>
            </div>
            <span className="pill" style={{ padding: "7px 10px" }}>Used for 30-day forecast</span>
          </div>

          <div style={{ height: 12 }} />

          {!primary ? (
            <div className="muted">No primary account set yet.</div>
          ) : (
            <div className="row" style={{ gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
              <div className="card" style={{ padding: 12, flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="pill" style={{ padding: "6px 10px" }}>
                    {typeIcon(primary.type)} {badgeText(primary.type)}
                  </span>
                  <div style={{ fontWeight: 950, fontSize: 18 }}>{primary.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>({typeLabel(primary.type)})</div>
                </div>

                <div style={{ height: 10 }} />

                <div className="muted" style={{ fontSize: 12 }}>Balance</div>
                <div style={{ fontWeight: 950, fontSize: 24, marginTop: 4 }}>
                  {fmtMoney(primary.balance)}
                </div>

                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Updated: <b>{fmtWhen(primary.updatedAt)}</b>
                </div>
              </div>

              <div className="card" style={{ padding: 12, minWidth: 300 }}>
                <div style={{ fontWeight: 950 }}>Actions</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Clean changes only. No random typing.
                </div>

                <div style={{ height: 10 }} />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn" type="button" onClick={() => openModalFor(primary.id)}>
                    Adjust balance
                  </button>
                  <button
                    className="btnGhost"
                    type="button"
                    onClick={() => {
                      setPrimaryId(primary.id);
                      openModalFor(primary.id);
                      setMode("set");
                    }}
                  >
                    Set exact balance
                  </button>
                </div>

                <div style={{ height: 10 }} />
                <div className="muted" style={{ fontSize: 12 }}>
                  Tip: credit cards stored as <b>positive</b> “amount owed”.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 14, flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Snapshot</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Clean totals by type.
          </div>

          <div style={{ height: 10 }} />

          <div className="grid" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <div className="card" style={{ padding: 12, flex: 1, minWidth: 140 }}>
                <div className="muted" style={{ fontSize: 12 }}>🏦 Checking</div>
                <div style={{ fontWeight: 950, marginTop: 4 }}>{fmtMoney(totals.checking)}</div>
              </div>
              <div className="card" style={{ padding: 12, flex: 1, minWidth: 140 }}>
                <div className="muted" style={{ fontSize: 12 }}>💰 Savings</div>
                <div style={{ fontWeight: 950, marginTop: 4 }}>{fmtMoney(totals.savings)}</div>
              </div>
            </div>

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <div className="card" style={{ padding: 12, flex: 1, minWidth: 140 }}>
                <div className="muted" style={{ fontSize: 12 }}>💵 Cash</div>
                <div style={{ fontWeight: 950, marginTop: 4 }}>{fmtMoney(totals.cash)}</div>
              </div>
              <div className="card" style={{ padding: 12, flex: 1, minWidth: 140 }}>
                <div className="muted" style={{ fontSize: 12 }}>📈 Investment</div>
                <div style={{ fontWeight: 950, marginTop: 4 }}>{fmtMoney(totals.invest)}</div>
              </div>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>💳 Debt (credit accounts)</div>
              <div style={{ fontWeight: 950, marginTop: 4 }}>{fmtMoney(totals.debts)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* CONTROLS + LIST */}
      <div className="row" style={{ gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* LEFT: Add + Filters + Activity */}
        <div style={{ display: "grid", gap: 16, flex: 1, minWidth: 320 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Add account</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Keep it clean. Don’t add junk accounts.
            </div>

            <div style={{ height: 10 }} />

            <form onSubmit={addAccount} className="grid" style={{ gap: 10 }}>
              <input
                className="input"
                placeholder="Account name (Checking, Savings, Credit Card...)"
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
                placeholder="Starting balance (optional)"
                value={adding.balance}
                onChange={(e) => setAdding((p) => ({ ...p, balance: e.target.value }))}
              />

              <button className="btn" type="submit">
                Add account
              </button>
            </form>

            <div style={{ height: 14 }} />

            <div style={{ fontWeight: 950, fontSize: 14 }}>Find & sort</div>
            <div style={{ height: 8 }} />

            <input
              className="input"
              placeholder="Search accounts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <div style={{ height: 10 }} />

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <select
                className="input"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ flex: 1, minWidth: 160 }}
              >
                <option value="all">All types</option>
                <option value="checking">🏦 Checking</option>
                <option value="savings">💰 Savings</option>
                <option value="cash">💵 Cash</option>
                <option value="credit">💳 Credit Card</option>
                <option value="investment">📈 Investment</option>
                <option value="other">📁 Other</option>
              </select>

              <select
                className="input"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                style={{ flex: 1, minWidth: 160 }}
              >
                <option value="updated">Sort: Recently updated</option>
                <option value="name">Sort: Name</option>
                <option value="balance">Sort: Balance (high→low)</option>
              </select>
            </div>

            <div style={{ height: 10 }} />
            <div className="muted" style={{ fontSize: 12 }}>
              Forecast v1 uses your <b>Primary</b> account balance as starting balance.
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Recent activity</div>
              <div className="muted" style={{ fontSize: 12 }}>Last 20</div>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Only logs clean modal changes + add/delete.
            </div>

            <div style={{ height: 10 }} />

            {activity.length === 0 ? (
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 950 }}>No activity yet</div>
                <div className="muted" style={{ marginTop: 6 }}>Use “Adjust” to create clean history.</div>
              </div>
            ) : (
              <div className="grid" style={{ gap: 10 }}>
                {activity.slice(0, 6).map((a) => (
                  <div key={a.id} className="card" style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 950, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span className="pill" style={{ padding: "6px 10px" }}>
                            {typeIcon(a.accountType)} {activityLabel(a)}
                          </span>
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {a.accountName || "Account"}
                          </span>
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                          {fmtWhen(a.ts)} • Δ <b>{fmtDelta(a.delta)}</b>{" "}
                          {a.newBalance === null || a.newBalance === undefined ? "" : (
                            <>
                              • New <b>{fmtMoney(a.newBalance)}</b>
                            </>
                          )}
                        </div>
                        {a.note ? (
                          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                            Note: {a.note}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}

                {activity.length > 6 ? (
                  <div className="muted" style={{ fontSize: 12 }}>
                    Showing 6 most recent (still saving last 20).
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Accounts list */}
        <div className="card" style={{ padding: 14, flex: 2, minWidth: 360 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Your accounts</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Click <b>Adjust</b> for clean changes.
            </div>
          </div>

          <div style={{ height: 10 }} />

          {filtered.length === 0 ? (
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 950 }}>No matches</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Clear filters or add a new account.
              </div>
            </div>
          ) : (
            <div className="grid" style={{ gap: 12 }}>
              {filtered.map((a) => {
                const isPrimary = a.id === primaryId;
                const balance = safeNum(a.balance, 0);

                return (
                  <div key={a.id} className="card" style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 260 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span className="pill" style={{ padding: "6px 10px" }}>
                            {typeIcon(a.type)} {badgeText(a.type)}
                          </span>

                          <input
                            className="input"
                            value={a.name}
                            onChange={(e) => updateAccount(a.id, { name: e.target.value })}
                            style={{ minWidth: 220, flex: 1 }}
                          />

                          <select
                            className="input"
                            value={a.type || "other"}
                            onChange={(e) => updateAccount(a.id, { type: e.target.value })}
                            style={{ minWidth: 170 }}
                          >
                            <option value="checking">🏦 Checking</option>
                            <option value="savings">💰 Savings</option>
                            <option value="cash">💵 Cash</option>
                            <option value="credit">💳 Credit Card</option>
                            <option value="investment">📈 Investment</option>
                            <option value="other">📁 Other</option>
                          </select>
                        </div>

                        <div style={{ height: 8 }} />
                        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <div>
                            <div className="muted" style={{ fontSize: 12 }}>Balance</div>
                            <div style={{ fontWeight: 950, fontSize: 18, marginTop: 3 }}>{fmtMoney(balance)}</div>
                          </div>

                          <span className="pill" style={{ padding: "7px 10px" }}>
                            Updated: <b>{fmtWhen(a.updatedAt)}</b>
                          </span>

                          {isPrimary ? (
                            <span className="pill" style={{ padding: "7px 10px" }}>
                              Primary
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <button className="btnGhost" type="button" onClick={() => openModalFor(a.id)}>
                          Adjust
                        </button>
                        <button className={isPrimary ? "btn" : "btnGhost"} type="button" onClick={() => setPrimaryId(a.id)}>
                          {isPrimary ? "Primary" : "Set primary"}
                        </button>
                        <button className="btnGhost" type="button" onClick={() => deleteAccount(a.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ height: 10 }} />
          <div className="muted" style={{ fontSize: 12 }}>
            Credit cards: store balance as <b>amount owed</b> (positive). Net Worth = Assets − Debts.
          </div>
        </div>
      </div>

      {/* MODAL */}
      <Modal
        open={modalOpen}
        title={modalAccount ? `Adjust: ${modalAccount.name}` : "Adjust account"}
        subtitle={
          modalAccount
            ? `Current balance: ${fmtMoney(modalAccount.balance)} • Type: ${typeLabel(modalAccount.type)}`
            : ""
        }
        onClose={() => setModalOpen(false)}
      >
        {!modalAccount ? (
          <div className="muted">No account selected.</div>
        ) : (
          <>
            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button className={mode === "adjust" ? "btn" : "btnGhost"} type="button" onClick={() => setMode("adjust")}>
                Deposit / Withdraw
              </button>
              <button className={mode === "set" ? "btn" : "btnGhost"} type="button" onClick={() => setMode("set")}>
                Set exact balance
              </button>

              <span className="pill" style={{ padding: "7px 10px", marginLeft: "auto" }}>
                Primary: <b>{modalAccount.id === primaryId ? "Yes" : "No"}</b>
              </span>
            </div>

            <div style={{ height: 12 }} />

            {mode === "adjust" ? (
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 950 }}>Transaction</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Use this for clean updates. No more random typing.
                </div>

                <div style={{ height: 10 }} />

                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <button className={adjustSign === "deposit" ? "btn" : "btnGhost"} type="button" onClick={() => setAdjustSign("deposit")}>
                    Deposit
                  </button>
                  <button className={adjustSign === "withdraw" ? "btn" : "btnGhost"} type="button" onClick={() => setAdjustSign("withdraw")}>
                    Withdraw
                  </button>
                </div>

                <div style={{ height: 10 }} />

                <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    className="input"
                    placeholder="Amount (e.g. 125.50)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ flex: 1, minWidth: 220 }}
                  />
                  <button className="btn" type="button" onClick={applyModal}>
                    Apply
                  </button>
                </div>

                <div style={{ height: 10 }} />
                <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  Quick amounts
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[10, 20, 50, 100, 200, 500].map((v) => (
                    <button key={v} className="btnGhost" type="button" onClick={() => quickChip(v)}>
                      {v}
                    </button>
                  ))}
                </div>

                <div style={{ height: 10 }} />
                <input
                  className="input"
                  placeholder="Optional note (saved in activity)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            ) : (
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 950 }}>Set exact balance</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Use this when you’re syncing to your bank app.
                </div>

                <div style={{ height: 10 }} />
                <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    className="input"
                    placeholder="New balance (e.g. 3420.00)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ flex: 1, minWidth: 220 }}
                  />
                  <button className="btn" type="button" onClick={applyModal}>
                    Set
                  </button>
                </div>

                <div style={{ height: 10 }} />
                <div className="muted" style={{ fontSize: 12 }}>
                  This overwrites the balance. No math.
                </div>

                <div style={{ height: 10 }} />
                <input
                  className="input"
                  placeholder="Optional note (saved in activity)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            )}
          </>
        )}
      </Modal>
    </main>
  );
}