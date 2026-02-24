"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

const LS_KEY = "lcc_investments_portfolio_v2";

const ASSET_TYPES = [
  { value: "stock", label: "Stock" },
  { value: "etf", label: "ETF" },
  { value: "crypto", label: "Crypto" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

function safeParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function parseNumberInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function pct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now());
}

export default function InvestmentsPage() {
  const [items, setItems] = useState([]);

  // UI state
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [sortBy, setSortBy] = useState("value_desc"); // value_desc | gain_desc | gain_asc | name_asc
  const [status, setStatus] = useState({ loading: false, msg: "" });

  // Add form
  const [type, setType] = useState("stock");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [account, setAccount] = useState("Main");
  const [shares, setShares] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [price, setPrice] = useState("");
  const [cgId, setCgId] = useState(""); // CoinGecko id for crypto (ex: bitcoin, ethereum)
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  // load
  useEffect(() => {
    const saved = safeParse(localStorage.getItem(LS_KEY) || "[]", []);
    setItems(Array.isArray(saved) ? saved : []);
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  function addItem(e) {
    e.preventDefault();
    setError("");

    const tp = String(type).toLowerCase();
    const sym = String(symbol).trim().toUpperCase();
    const nm = String(name).trim();
    const acct = String(account).trim() || "Main";

    const pr = price === "" ? NaN : parseMoneyInput(price);

    if (!acct) return setError("Account is required.");
    if (tp !== "cash" && tp !== "other" && !sym) return setError("Symbol required (VOO, QQQ, BTC...).");
    if (!Number.isFinite(pr) || pr < 0) return setError("Price/value must be a valid number (0 or more).");

    let sh = tp === "cash" ? 1 : parseNumberInput(shares);
    let ac = parseMoneyInput(avgCost);

    if (tp !== "cash") {
      if (!Number.isFinite(sh) || sh <= 0) return setError("Shares/units must be > 0.");
      if (!Number.isFinite(ac) || ac <= 0) return setError("Avg cost must be > 0.");
    } else {
      // cash: store as 1 unit, avgCost==price==value
      sh = 1;
      ac = pr;
    }

    if (tp === "crypto") {
      const id = String(cgId).trim();
      if (!id) return setError("For crypto live pricing, fill CoinGecko ID (ex: bitcoin, ethereum).");
    }

    setItems((prev) => [
      {
        id: uid(),
        type: tp,
        symbol: tp === "cash" ? "CASH" : sym,
        name: nm,
        account: acct,
        shares: sh,
        avgCost: ac,
        price: pr,
        cgId: tp === "crypto" ? String(cgId).trim() : "",
        note: String(note).trim(),
        updatedAt: Date.now(),
        createdAt: Date.now(),
      },
      ...prev,
    ]);

    setType("stock");
    setSymbol("");
    setName("");
    setShares("");
    setAvgCost("");
    setPrice("");
    setCgId("");
    setNote("");
  }

  function updateItem(id, patch) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch, updatedAt: Date.now() } : it))
    );
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }

  const computed = useMemo(() => {
    const rows = items.map((it) => {
      const sh = Number(it.shares) || 0;
      const ac = Number(it.avgCost) || 0;
      const pr = Number(it.price) || 0;
      const cost = sh * ac;
      const value = sh * pr;
      const gain = value - cost;
      const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
      return { ...it, cost, value, gain, gainPct };
    });

    const totalValue = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
    const totalCost = rows.reduce((s, r) => s + (Number(r.cost) || 0), 0);
    const totalGain = totalValue - totalCost;
    const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    const accounts = Array.from(new Set(rows.map((r) => r.account || "Main"))).sort();
    const types = Array.from(new Set(rows.map((r) => r.type || "other"))).sort();

    const byType = rows.reduce((acc, r) => {
      const k = r.type || "other";
      acc[k] = (acc[k] || 0) + (Number(r.value) || 0);
      return acc;
    }, {});
    const byAccount = rows.reduce((acc, r) => {
      const k = r.account || "Main";
      acc[k] = (acc[k] || 0) + (Number(r.value) || 0);
      return acc;
    }, {});

    return { rows, totalValue, totalCost, totalGain, totalGainPct, accounts, types, byType, byAccount };
  }, [items]);

  const visibleRows = useMemo(() => {
    const qq = q.trim().toLowerCase();

    let rows = computed.rows.filter((r) => {
      if (filterType !== "all" && r.type !== filterType) return false;
      if (filterAccount !== "all" && r.account !== filterAccount) return false;
      if (!qq) return true;
      const hay = `${r.symbol} ${r.name} ${r.account} ${r.note}`.toLowerCase();
      return hay.includes(qq);
    });

    rows.sort((a, b) => {
      if (sortBy === "value_desc") return (b.value || 0) - (a.value || 0);
      if (sortBy === "gain_desc") return (b.gain || 0) - (a.gain || 0);
      if (sortBy === "gain_asc") return (a.gain || 0) - (b.gain || 0);
      if (sortBy === "name_asc") return String(a.symbol).localeCompare(String(b.symbol));
      return 0;
    });

    return rows;
  }, [computed.rows, q, filterType, filterAccount, sortBy]);

  async function refreshPrices() {
    setStatus({ loading: true, msg: "Refreshing prices..." });
    try {
      const symbols = items
        .filter((it) => it.type === "crypto" || it.type === "stock" || it.type === "etf")
        .map((it) => ({ symbol: it.symbol, type: it.type, cgId: it.cgId || "" }));

      if (!symbols.length) {
        setStatus({ loading: false, msg: "No crypto/stocks to refresh." });
        return;
      }

      const r = await fetch("/api/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbols }),
      });

      const data = await r.json();
      const quotes = data?.quotes || {};
      const errors = data?.errors || {};

      // Apply quotes
      setItems((prev) =>
        prev.map((it) => {
          const key = `${it.type}:${String(it.symbol || "").toUpperCase()}`;
          const q = quotes[key];
          if (q?.price && Number.isFinite(Number(q.price))) {
            return { ...it, price: Number(q.price), updatedAt: Date.now(), lastQuoteSource: q.source };
          }
          return it;
        })
      );

      // Show a short message if any failed
      const errCount = Object.keys(errors).length;
      setStatus({
        loading: false,
        msg: errCount ? `Updated. ${errCount} symbols failed (check crypto cgId / stock API key).` : "Prices updated.",
      });
    } catch (e) {
      setStatus({ loading: false, msg: `Refresh failed: ${e?.message || "unknown"}` });
    }
  }

  return (
    <main className="container">
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Investments</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0 }}>Portfolio Dashboard</h1>
            <div className="muted" style={{ marginTop: 6 }}>
              Holdings + cost basis + live price refresh (crypto now, stocks optional).
            </div>
          </div>

          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <button className="btn" type="button" onClick={refreshPrices} disabled={status.loading}>
              {status.loading ? "Refreshing..." : "Refresh Prices"}
            </button>
          </div>
        </div>

        {status.msg ? (
          <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>{status.msg}</div>
        ) : null}
      </header>

      {/* TOP KPIs */}
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="card" style={{ padding: 12, flex: 1, minWidth: 240 }}>
          <div className="muted" style={{ fontSize: 12 }}>Total value</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{money(computed.totalValue)}</div>
        </div>
        <div className="card" style={{ padding: 12, flex: 1, minWidth: 240 }}>
          <div className="muted" style={{ fontSize: 12 }}>Total cost</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{money(computed.totalCost)}</div>
        </div>
        <div className="card" style={{ padding: 12, flex: 1, minWidth: 240 }}>
          <div className="muted" style={{ fontSize: 12 }}>Gain / Loss</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>
            {money(computed.totalGain)}{" "}
            <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
              ({pct(computed.totalGainPct)})
            </span>
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="row" style={{ gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* ADD / IMPORT */}
        <div className="card" style={{ flex: 1, minWidth: 340 }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Add Holding</div>

          <form onSubmit={addItem} className="grid" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <select className="input" value={type} onChange={(e) => setType(e.target.value)} style={{ width: 160 }}>
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              <input
                className="input"
                placeholder="Account (Fidelity, Robinhood, 401k...)"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
            </div>

            <div className="row" style={{ gap: 10 }}>
              <input
                className="input"
                placeholder={type === "cash" ? "Symbol (auto: CASH)" : "Symbol (VOO, QQQ, BTC...)"}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                disabled={type === "cash"}
                style={{ flex: 1 }}
              />
              <input
                className="input"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <input
                className="input"
                inputMode="decimal"
                placeholder={type === "cash" ? "Units (auto)" : "Shares / units"}
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                disabled={type === "cash"}
                style={{ width: 170 }}
              />
              <input
                className="input"
                inputMode="decimal"
                placeholder={type === "cash" ? "Avg cost (auto)" : "Avg cost"}
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                disabled={type === "cash"}
                style={{ width: 170 }}
              />
              <input
                className="input"
                inputMode="decimal"
                placeholder={type === "cash" ? "Cash value" : "Current price"}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                style={{ width: 170 }}
              />
            </div>

            {type === "crypto" ? (
              <input
                className="input"
                placeholder="CoinGecko ID (bitcoin, ethereum, solana...)"
                value={cgId}
                onChange={(e) => setCgId(e.target.value)}
              />
            ) : null}

            <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

            {error ? (
              <div className="card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 950 }}>Fix this:</div>
                <div className="muted" style={{ marginTop: 4 }}>{error}</div>
              </div>
            ) : null}

            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <button className="btn" type="submit">Add</button>
              <button
                className="btnGhost"
                type="button"
                onClick={() => {
                  setType("stock");
                  setSymbol("");
                  setName("");
                  setShares("");
                  setAvgCost("");
                  setPrice("");
                  setCgId("");
                  setNote("");
                  setError("");
                }}
              >
                Clear
              </button>
            </div>

            <div className="muted" style={{ fontSize: 12 }}>
              Crypto live pricing uses CoinGecko “simple price” endpoint. Stocks/ETFs can be live with Alpha Vantage key.
            </div>
          </form>
        </div>

        {/* CONTROLS */}
        <div className="card" style={{ flex: 1, minWidth: 340 }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Find & Filter</div>

          <div className="grid" style={{ gap: 10 }}>
            <input className="input" placeholder="Search symbol/name/account/note…" value={q} onChange={(e) => setQ(e.target.value)} />

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <select className="input" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: 180 }}>
                <option value="all">All types</option>
                {computed.types.map((t) => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>

              <select className="input" value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} style={{ flex: 1, minWidth: 180 }}>
                <option value="all">All accounts</option>
                {computed.accounts.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="value_desc">Sort: Value (high → low)</option>
              <option value="gain_desc">Sort: Gain (high → low)</option>
              <option value="gain_asc">Sort: Gain (low → high)</option>
              <option value="name_asc">Sort: Symbol (A → Z)</option>
            </select>

            <div className="muted" style={{ fontSize: 12 }}>
              Next upgrade: transactions ledger (buys/sells) so shares + cost basis auto-update.
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* HOLDINGS */}
      <div className="card">
        <div style={{ fontWeight: 950, marginBottom: 10 }}>
          Holdings <span className="muted" style={{ fontWeight: 700 }}>({visibleRows.length})</span>
        </div>

        {visibleRows.length === 0 ? (
          <div className="muted">No holdings match your filters.</div>
        ) : (
          <div className="grid">
            {visibleRows.map((it) => {
              const isLive = it.type === "crypto" || it.type === "stock" || it.type === "etf";
              return (
                <div key={it.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 950, fontSize: 16 }}>
                        {it.type === "cash" ? "Cash" : it.symbol}{" "}
                        <span className="muted" style={{ fontWeight: 800 }}>• {it.account}</span>
                      </div>
                      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                        Value {money(it.value)} • Cost {money(it.cost)} • G/L {money(it.gain)} ({pct(it.gainPct)})
                      </div>
                      {it.note ? <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>Note: {it.note}</div> : null}
                      {it.type === "crypto" ? (
                        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                          CoinGecko ID: <span style={{ fontWeight: 900 }}>{it.cgId || "—"}</span>
                        </div>
                      ) : null}
                      {isLive ? (
                        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                          Live-ready: {it.type === "crypto" ? "Yes (CoinGecko)" : "Yes (Alpha Vantage key needed for stocks/ETFs)"}
                        </div>
                      ) : null}
                    </div>

                    <div className="row" style={{ gap: 8, alignItems: "center" }}>
                      <button
                        className="btnGhost"
                        type="button"
                        onClick={() => {
                          const next = prompt("Update current price/value:", String(it.price ?? ""));
                          if (next === null) return;
                          const pr = parseMoneyInput(next);
                          if (!Number.isFinite(pr) || pr < 0) return alert("Invalid price/value.");
                          updateItem(it.id, { price: pr });
                        }}
                      >
                        Set Price
                      </button>

                      <button
                        className="btnGhost"
                        type="button"
                        onClick={() => {
                          const next = prompt("Update shares/units:", String(it.shares ?? ""));
                          if (next === null) return;
                          const sh = parseNumberInput(next);
                          if (!Number.isFinite(sh) || sh <= 0) return alert("Invalid shares/units.");
                          updateItem(it.id, { shares: sh });
                        }}
                        disabled={it.type === "cash"}
                      >
                        Set Shares
                      </button>

                      <button className="btnGhost" type="button" onClick={() => removeItem(it.id)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div style={{ height: 10 }} />

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div className="pill">{String(it.type).toUpperCase()}</div>
                    <div className="pill">SHARES: {it.type === "cash" ? "—" : (Number(it.shares) || 0)}</div>
                    <div className="pill">AVG: {money(it.avgCost)}</div>
                    <div className="pill">PRICE: {money(it.price)}</div>
                    {it.lastQuoteSource ? <div className="pill">SRC: {it.lastQuoteSource}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}