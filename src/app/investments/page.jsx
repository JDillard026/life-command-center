"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

// NEW storage (ledger-based)
const LS_ASSETS = "lcc_port_assets_v1";
const LS_TXNS = "lcc_port_txns_v1";
const LS_PRICES = "lcc_port_prices_v1";
const LS_UI = "lcc_port_ui_v1";

// ✅ NEW: snapshots storage
const LS_SNAPS = "lcc_port_snaps_v1";

// OLD storage (we'll auto-migrate if present)
const LS_OLD = "lcc_investments_portfolio_v2";

const ASSET_TYPES = [
  { value: "stock", label: "Stock" },
  { value: "etf", label: "ETF" },
  { value: "crypto", label: "Crypto" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

const TXN_TYPES = [
  { value: "BUY", label: "Buy" },
  { value: "SELL", label: "Sell" },
  { value: "DIVIDEND", label: "Dividend" },
  { value: "CASH_IN", label: "Cash In" },
  { value: "CASH_OUT", label: "Cash Out" },
];

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

function isoDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normSymbol(s) {
  return String(s || "").trim().toUpperCase();
}

// ✅ NEW: tiny no-dependency chart
function LineChart({ points, height = 140 }) {
  if (!points || points.length < 2) {
    return <div className="muted" style={{ fontSize: 12 }}>Need at least 2 snapshots to chart.</div>;
  }

  const w = 700;
  const h = height;
  const pad = 10;

  const ys = points.map((p) => Number(p.value) || 0);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = maxY - minY || 1;

  const toX = (i) => pad + (i * (w - pad * 2)) / (points.length - 1);
  const toY = (v) => pad + (h - pad * 2) * (1 - (v - minY) / span);

  let d = "";
  for (let i = 0; i < points.length; i++) {
    const x = toX(i);
    const y = toY(Number(points[i].value) || 0);
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <div className="muted" style={{ fontSize: 12 }}>
          {first.date} → {last.date}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          Min {money(minY)} • Max {money(maxY)}
        </div>
      </div>

      <div style={{ height: 10 }} />

      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height }}>
        <path
          d={`M ${pad} ${h - pad} L ${w - pad} ${h - pad}`}
          fill="none"
          stroke="currentColor"
          opacity="0.15"
        />
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>

      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Latest: <span style={{ fontWeight: 900 }}>{money(last.value)}</span>
      </div>
    </div>
  );
}

export default function InvestmentsPage() {
  const [assets, setAssets] = useState([]); // metadata: {id,type,symbol,name,account,cgId,note,createdAt}
  const [txns, setTxns] = useState([]); // ledger: {id,assetId,type,date,qty,price,fee,amount,note,createdAt}
  const [prices, setPrices] = useState({}); // { "TYPE:SYMBOL": { price, ts, source } }

  // ✅ NEW: snapshots
  const [snaps, setSnaps] = useState([]); // [{date,value,cost,realized,createdAt}]
  const [snapRange, setSnapRange] = useState("30"); // 7 | 30 | 90 | 365 | all

  // UI state
  const [status, setStatus] = useState({ loading: false, msg: "" });
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [sortBy, setSortBy] = useState("value_desc"); // value_desc | gain_desc | gain_asc | name_asc

  // Add asset form
  const [aType, setAType] = useState("stock");
  const [aSymbol, setASymbol] = useState("");
  const [aName, setAName] = useState("");
  const [aAccount, setAAccount] = useState("Main");
  const [aCgId, setACgId] = useState("");
  const [aNote, setANote] = useState("");

  // Add transaction form
  const [tAssetId, setTAssetId] = useState("");
  const [tType, setTType] = useState("BUY");
  const [tDate, setTDate] = useState(isoDate());
  const [tQty, setTQty] = useState("");
  const [tPrice, setTPrice] = useState("");
  const [tFee, setTFee] = useState("");
  const [tAmount, setTAmount] = useState(""); // for DIVIDEND/CASH
  const [tNote, setTNote] = useState("");

  // Load + migrate
  useEffect(() => {
    const savedAssets = safeParse(localStorage.getItem(LS_ASSETS) || "[]", []);
    const savedTxns = safeParse(localStorage.getItem(LS_TXNS) || "[]", []);
    const savedPrices = safeParse(localStorage.getItem(LS_PRICES) || "{}", {});
    const savedUI = safeParse(localStorage.getItem(LS_UI) || "{}", {});
    const savedSnaps = safeParse(localStorage.getItem(LS_SNAPS) || "[]", []);

    setAssets(Array.isArray(savedAssets) ? savedAssets : []);
    setTxns(Array.isArray(savedTxns) ? savedTxns : []);
    setPrices(savedPrices && typeof savedPrices === "object" ? savedPrices : {});
    setSnaps(Array.isArray(savedSnaps) ? savedSnaps : []);

    if (savedUI?.q) setQ(savedUI.q);
    if (savedUI?.filterType) setFilterType(savedUI.filterType);
    if (savedUI?.filterAccount) setFilterAccount(savedUI.filterAccount);
    if (savedUI?.sortBy) setSortBy(savedUI.sortBy);

    // If new storage is empty, but old holdings exist, migrate them ONCE.
    const hasNew = Array.isArray(savedAssets) && savedAssets.length > 0;
    if (!hasNew) {
      const old = safeParse(localStorage.getItem(LS_OLD) || "[]", []);
      if (Array.isArray(old) && old.length) {
        const migratedAssets = [];
        const migratedTxns = [];
        const migratedPrices = {};

        for (const it of old) {
          const tp = String(it.type || "other").toLowerCase();
          const sym = tp === "cash" ? "CASH" : normSymbol(it.symbol);
          const acct = String(it.account || "Main").trim() || "Main";
          const nm = String(it.name || "").trim();
          const cgId = String(it.cgId || "").trim();
          const note = String(it.note || "").trim();

          const assetId = uid();
          migratedAssets.push({
            id: assetId,
            type: tp,
            symbol: sym,
            name: nm,
            account: acct,
            cgId,
            note,
            createdAt: Date.now(),
          });

          // Create a "starting position" BUY transaction so the ledger matches the old holding
          const shares = Number(it.shares) || (tp === "cash" ? 1 : 0);
          const avgCost = Number(it.avgCost) || 0;
          const pr = Number(it.price) || 0;

          if (tp === "cash") {
            migratedTxns.push({
              id: uid(),
              assetId,
              type: "CASH_IN",
              date: isoDate(),
              qty: 0,
              price: 0,
              fee: 0,
              amount: pr,
              note: "Migrated cash value",
              createdAt: Date.now(),
            });
          } else if (shares > 0 && avgCost > 0) {
            migratedTxns.push({
              id: uid(),
              assetId,
              type: "BUY",
              date: isoDate(),
              qty: shares,
              price: avgCost,
              fee: 0,
              amount: 0,
              note: "Migrated starting position",
              createdAt: Date.now(),
            });
          }

          if (Number.isFinite(pr) && pr > 0) {
            migratedPrices[`${tp}:${sym}`] = { price: pr, ts: Date.now(), source: "manual" };
          }
        }

        setAssets(migratedAssets);
        setTxns(migratedTxns);
        setPrices(migratedPrices);

        // persist immediately
        localStorage.setItem(LS_ASSETS, JSON.stringify(migratedAssets));
        localStorage.setItem(LS_TXNS, JSON.stringify(migratedTxns));
        localStorage.setItem(LS_PRICES, JSON.stringify(migratedPrices));

        setStatus({ loading: false, msg: "Migrated your old holdings into Transactions ✅" });
      }
    }
  }, []);

  // Persist
  useEffect(() => {
    try { localStorage.setItem(LS_ASSETS, JSON.stringify(assets)); } catch {}
  }, [assets]);

  useEffect(() => {
    try { localStorage.setItem(LS_TXNS, JSON.stringify(txns)); } catch {}
  }, [txns]);

  useEffect(() => {
    try { localStorage.setItem(LS_PRICES, JSON.stringify(prices)); } catch {}
  }, [prices]);

  useEffect(() => {
    try { localStorage.setItem(LS_UI, JSON.stringify({ q, filterType, filterAccount, sortBy })); } catch {}
  }, [q, filterType, filterAccount, sortBy]);

  // ✅ NEW: persist snapshots
  useEffect(() => {
    try { localStorage.setItem(LS_SNAPS, JSON.stringify(snaps)); } catch {}
  }, [snaps]);

  function addAsset(e) {
    e.preventDefault();
    setError("");

    const tp = String(aType).toLowerCase();
    const sym = tp === "cash" ? "CASH" : normSymbol(aSymbol);
    const acct = String(aAccount).trim() || "Main";
    const nm = String(aName).trim();
    const cg = String(aCgId).trim();
    const note = String(aNote).trim();

    if (!acct) return setError("Account is required.");
    if (tp !== "cash" && !sym) return setError("Symbol required (VOO, QQQ, BTC...).");
    if (tp === "crypto" && !cg) return setError("Crypto needs CoinGecko ID for live pricing (bitcoin, ethereum...).");

    // prevent duplicates (same type+symbol+account)
    const dup = assets.some((x) => x.type === tp && x.symbol === sym && x.account === acct);
    if (dup) return setError("That asset already exists for this account.");

    const id = uid();
    const next = [
      { id, type: tp, symbol: sym, name: nm, account: acct, cgId: tp === "crypto" ? cg : "", note, createdAt: Date.now() },
      ...assets,
    ];
    setAssets(next);

    // auto-select this asset for transaction entry
    setTAssetId(id);

    setAType("stock");
    setASymbol("");
    setAName("");
    setAAccount(acct);
    setACgId("");
    setANote("");
  }

  function addTxn(e) {
    e.preventDefault();
    setError("");

    const assetId = tAssetId;
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return setError("Pick an asset first.");

    const tp = String(tType);
    const date = String(tDate || isoDate()).trim();

    const fee = tFee === "" ? 0 : parseMoneyInput(tFee);
    if (!Number.isFinite(fee) || fee < 0) return setError("Fee must be 0 or more.");

    let qty = 0;
    let price = 0;
    let amount = 0;

    if (tp === "BUY" || tp === "SELL") {
      qty = parseNumberInput(tQty);
      price = parseMoneyInput(tPrice);
      if (!Number.isFinite(qty) || qty <= 0) return setError("Qty must be > 0.");
      if (!Number.isFinite(price) || price <= 0) return setError("Price must be > 0.");
      if (asset.type === "cash") return setError("Cash assets use CASH_IN / CASH_OUT, not BUY/SELL.");
    } else if (tp === "DIVIDEND") {
      amount = parseMoneyInput(tAmount);
      if (!Number.isFinite(amount) || amount <= 0) return setError("Dividend amount must be > 0.");
      if (asset.type === "cash") return setError("Dividend should be tied to a holding, not Cash.");
    } else if (tp === "CASH_IN" || tp === "CASH_OUT") {
      amount = parseMoneyInput(tAmount);
      if (!Number.isFinite(amount) || amount <= 0) return setError("Cash amount must be > 0.");
      // allowed even if not cash asset
    }

    const id = uid();
    setTxns((prev) => [
      {
        id,
        assetId,
        type: tp,
        date,
        qty,
        price,
        fee,
        amount,
        note: String(tNote || "").trim(),
        createdAt: Date.now(),
      },
      ...prev,
    ]);

    // clear txn fields (keep asset selection)
    setTQty("");
    setTPrice("");
    setTFee("");
    setTAmount("");
    setTNote("");
  }

  function deleteTxn(id) {
    setTxns((prev) => prev.filter((t) => t.id !== id));
  }

  function setManualPrice(asset, nextPrice) {
    const pr = parseMoneyInput(nextPrice);
    if (!Number.isFinite(pr) || pr < 0) {
      alert("Invalid price/value.");
      return;
    }
    const key = `${asset.type}:${asset.symbol}`;
    setPrices((p) => ({ ...p, [key]: { price: pr, ts: Date.now(), source: "manual" } }));
  }

  // Ledger -> positions (avg cost method)
  const computed = useMemo(() => {
    const assetMap = new Map(assets.map((a) => [a.id, a]));
    const txByAsset = new Map();
    for (const t of txns) {
      const arr = txByAsset.get(t.assetId) || [];
      arr.push(t);
      txByAsset.set(t.assetId, arr);
    }

    const positions = [];
    let totalValue = 0;
    let totalCost = 0;
    let totalRealized = 0;
    let totalDividends = 0;
    let totalCashNet = 0;

    for (const a of assets) {
      const list = (txByAsset.get(a.id) || [])
        .slice()
        .sort((x, y) => String(x.date).localeCompare(String(y.date)) || (x.createdAt || 0) - (y.createdAt || 0));

      let shares = 0;
      let costBasis = 0; // remaining cost basis for current shares
      let realized = 0;
      let dividends = 0;
      let cashNet = 0; // cash-in minus cash-out (if used on this asset)

      for (const t of list) {
        const fee = Number(t.fee) || 0;

        if (t.type === "BUY") {
          const qty = Number(t.qty) || 0;
          const price = Number(t.price) || 0;
          if (qty <= 0 || price <= 0) continue;
          shares += qty;
          costBasis += qty * price + fee;
        }

        if (t.type === "SELL") {
          const qty = Number(t.qty) || 0;
          const price = Number(t.price) || 0;
          if (qty <= 0 || price <= 0) continue;

          const qtyToSell = Math.min(qty, shares);
          const avgCost = shares > 0 ? costBasis / shares : 0;

          // reduce position
          shares -= qtyToSell;
          costBasis -= avgCost * qtyToSell;

          // realized gain on sold portion
          realized += (price - avgCost) * qtyToSell - fee;
        }

        if (t.type === "DIVIDEND") {
          const amt = Number(t.amount) || 0;
          if (amt > 0) {
            dividends += amt;
            realized += amt; // treat dividends as realized profit
          }
        }

        if (t.type === "CASH_IN") {
          const amt = Number(t.amount) || 0;
          if (amt > 0) cashNet += amt - fee;
        }

        if (t.type === "CASH_OUT") {
          const amt = Number(t.amount) || 0;
          if (amt > 0) cashNet -= amt + fee;
        }
      }

      const avgCostNow = shares > 0 ? costBasis / shares : 0;
      const priceKey = `${a.type}:${a.symbol}`;
      const lastPrice = Number(prices?.[priceKey]?.price) || 0;
      const value = a.type === "cash" ? Math.max(0, cashNet) : shares * lastPrice;

      const unrealized = value - costBasis;
      const unrealizedPct = costBasis > 0 ? (unrealized / costBasis) * 100 : 0;

      totalValue += value;
      totalCost += costBasis;
      totalRealized += realized;
      totalDividends += dividends;
      if (a.type === "cash") totalCashNet += cashNet;

      positions.push({
        asset: a,
        shares,
        avgCost: avgCostNow,
        costBasis,
        price: lastPrice,
        value,
        unrealized,
        unrealizedPct,
        realized,
        dividends,
        cashNet,
        priceKey,
        lastSource: prices?.[priceKey]?.source || "",
        lastTs: prices?.[priceKey]?.ts || 0,
      });
    }

    const totalUnrealized = totalValue - totalCost;
    const totalUnrealizedPct = totalCost > 0 ? (totalUnrealized / totalCost) * 100 : 0;

    const accounts = Array.from(new Set(assets.map((a) => a.account || "Main"))).sort();
    const types = Array.from(new Set(assets.map((a) => a.type || "other"))).sort();

    const byType = positions.reduce((acc, p) => {
      const k = p.asset.type || "other";
      acc[k] = (acc[k] || 0) + (Number(p.value) || 0);
      return acc;
    }, {});
    const byAccount = positions.reduce((acc, p) => {
      const k = p.asset.account || "Main";
      acc[k] = (acc[k] || 0) + (Number(p.value) || 0);
      return acc;
    }, {});

    return {
      positions,
      totalValue,
      totalCost,
      totalUnrealized,
      totalUnrealizedPct,
      totalRealized,
      totalDividends,
      totalCashNet,
      accounts,
      types,
      byType,
      byAccount,
      assetMap,
    };
  }, [assets, txns, prices]);

  // ✅ NEW: auto snapshot once/day, updates today's snapshot as values change
  useEffect(() => {
    if (!assets.length) return;

    const d = isoDate();
    const value = Number(computed.totalValue) || 0;
    const cost = Number(computed.totalCost) || 0;
    const realized = Number(computed.totalRealized) || 0;

    setSnaps((prev) => {
      const next = Array.isArray(prev) ? prev.slice() : [];
      const idx = next.findIndex((s) => s?.date === d);

      const payload = { date: d, value, cost, realized, createdAt: Date.now() };

      if (idx >= 0) next[idx] = { ...next[idx], ...payload };
      else next.unshift(payload);

      next.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return next.slice(0, 2000);
    });
  }, [
    computed.totalValue,
    computed.totalCost,
    computed.totalRealized,
    assets.length,
    txns.length,
    Object.keys(prices || {}).length,
  ]);

  const visiblePositions = useMemo(() => {
    const qq = q.trim().toLowerCase();

    let rows = computed.positions.filter((p) => {
      const a = p.asset;
      if (filterType !== "all" && a.type !== filterType) return false;
      if (filterAccount !== "all" && a.account !== filterAccount) return false;

      if (!qq) return true;
      const hay = `${a.symbol} ${a.name} ${a.account} ${a.note}`.toLowerCase();
      return hay.includes(qq);
    });

    rows.sort((a, b) => {
      if (sortBy === "value_desc") return (b.value || 0) - (a.value || 0);
      if (sortBy === "gain_desc") return (b.unrealized || 0) - (a.unrealized || 0);
      if (sortBy === "gain_asc") return (a.unrealized || 0) - (b.unrealized || 0);
      if (sortBy === "name_asc") return String(a.asset.symbol).localeCompare(String(b.asset.symbol));
      return 0;
    });

    return rows;
  }, [computed.positions, q, filterType, filterAccount, sortBy]);

  const visibleTxns = useMemo(() => {
    // show newest first, optional filter by selected asset
    const rows = txns.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return tAssetId ? rows.filter((t) => t.assetId === tAssetId) : rows;
  }, [txns, tAssetId]);

  // ✅ NEW: chart points from snapshots
  const chartPoints = useMemo(() => {
    const sorted = (snaps || [])
      .slice()
      .filter((s) => s?.date && Number.isFinite(Number(s.value)))
      .sort((a, b) => String(a.date).localeCompare(String(b.date))); // oldest -> newest

    if (snapRange === "all") return sorted;
    const days = Number(snapRange);
    if (!Number.isFinite(days) || days <= 0) return sorted;
    return sorted.slice(-days);
  }, [snaps, snapRange]);

  function saveSnapshotNow() {
    const d = isoDate();
    const value = Number(computed.totalValue) || 0;
    const cost = Number(computed.totalCost) || 0;
    const realized = Number(computed.totalRealized) || 0;

    setSnaps((prev) => {
      const next = Array.isArray(prev) ? prev.slice() : [];
      const idx = next.findIndex((s) => s?.date === d);
      const payload = { date: d, value, cost, realized, createdAt: Date.now() };
      if (idx >= 0) next[idx] = { ...next[idx], ...payload };
      else next.unshift(payload);
      next.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return next.slice(0, 2000);
    });

    setStatus({ loading: false, msg: "Snapshot saved ✅" });
  }

  async function refreshPrices() {
    setStatus({ loading: true, msg: "Refreshing prices..." });
    try {
      const symbols = assets
        .filter((a) => a.type === "crypto" || a.type === "stock" || a.type === "etf")
        .map((a) => ({ symbol: a.symbol, type: a.type, cgId: a.cgId || "" }));

      if (!symbols.length) {
        setStatus({ loading: false, msg: "No crypto/stocks/ETFs to refresh." });
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

      setPrices((prev) => {
        const next = { ...prev };
        for (const a of assets) {
          const key = `${a.type}:${a.symbol}`;
          const q = quotes[key];
          if (q?.price && Number.isFinite(Number(q.price))) {
            next[key] = { price: Number(q.price), ts: Date.now(), source: q.source || "live" };
          }
        }
        return next;
      });

      const errCount = Object.keys(errors).length;
      setStatus({
        loading: false,
        msg: errCount ? `Updated. ${errCount} symbols failed (crypto cgId / stock API key).` : "Prices updated.",
      });
    } catch (e) {
      setStatus({ loading: false, msg: `Refresh failed: ${e?.message || "unknown"}` });
    }
  }

  function removeAsset(assetId) {
    if (!confirm("Delete this asset AND all its transactions?")) return;
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    setTxns((prev) => prev.filter((t) => t.assetId !== assetId));
    if (tAssetId === assetId) setTAssetId("");
  }

  function clearSnapshots() {
    if (!confirm("Delete ALL snapshots?")) return;
    setSnaps([]);
    setStatus({ loading: false, msg: "Snapshots cleared." });
  }

  return (
    <main className="container">
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Investments</div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0 }}>Portfolio (Ledger-Based)</h1>
            <div className="muted" style={{ marginTop: 6 }}>
              Add assets once, then track everything through Transactions.
            </div>
          </div>

          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <button className="btn" type="button" onClick={refreshPrices} disabled={status.loading}>
              {status.loading ? "Refreshing..." : "Refresh Prices"}
            </button>
          </div>
        </div>

        {status.msg ? <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>{status.msg}</div> : null}
      </header>

      {/* KPIs */}
      {/* KPIs */}
<div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
  {/* TOTAL VALUE */}
  <div className="card kpi" style={{ flex: 1, minWidth: 240 }}>
    <div className="muted" style={{ fontSize: 12 }}>Total value</div>
    <div className="kpiValue">
      {money(computed.totalValue)}
    </div>
  </div>

  {/* UNREALIZED */}
  <div className="card kpi" style={{ flex: 1, minWidth: 240 }}>
    <div className="muted" style={{ fontSize: 12 }}>Unrealized G/L</div>
    <div className="kpiValue">
      {money(computed.totalUnrealized)}{" "}
      <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
        ({pct(computed.totalUnrealizedPct)})
      </span>
    </div>
  </div>

  {/* REALIZED */}
  <div className="card kpi" style={{ flex: 1, minWidth: 240 }}>
    <div className="muted" style={{ fontSize: 12 }}>
      Realized (incl dividends)
    </div>
    <div className="kpiValue">
      {money(computed.totalRealized)}
    </div>
    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
      Dividends: {money(computed.totalDividends)}
    </div>
  </div>
</div>

      <div style={{ height: 14 }} />

      {/* ✅ NEW: SNAPSHOTS + CHART */}
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950 }}>Daily Snapshots</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Auto-saves 1 snapshot per day (updates today automatically).
            </div>
          </div>

          <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select className="input" value={snapRange} onChange={(e) => setSnapRange(e.target.value)} style={{ width: 160 }}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 1 year</option>
              <option value="all">All</option>
            </select>

            <button className="btnGhost" type="button" onClick={saveSnapshotNow}>
              Save Snapshot Now
            </button>

            <button className="btnGhost" type="button" onClick={clearSnapshots} disabled={!snaps.length}>
              Clear Snapshots
            </button>
          </div>
        </div>

        <div style={{ height: 12 }} />

        {snaps.length ? (
          <LineChart points={chartPoints} />
        ) : (
          <div className="muted" style={{ fontSize: 12 }}>
            No snapshots yet. Add assets/transactions and it will start capturing daily.
          </div>
        )}

        <div style={{ height: 10 }} />

        <div className="muted" style={{ fontSize: 12 }}>
          Stored snapshots: <span style={{ fontWeight: 900 }}>{snaps.length}</span>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="row" style={{ gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* ADD ASSET */}
        <div className="card" style={{ flex: 1, minWidth: 340 }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>1) Add Asset</div>

          <form onSubmit={addAsset} className="grid" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <select className="input" value={aType} onChange={(e) => setAType(e.target.value)} style={{ width: 160 }}>
                {ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>

              <input
                className="input"
                placeholder="Account (Fidelity, Robinhood, 401k...)"
                value={aAccount}
                onChange={(e) => setAAccount(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
            </div>

            <div className="row" style={{ gap: 10 }}>
              <input
                className="input"
                placeholder={aType === "cash" ? "Symbol (auto: CASH)" : "Symbol (VOO, QQQ, BTC...)"}
                value={aSymbol}
                onChange={(e) => setASymbol(e.target.value)}
                disabled={aType === "cash"}
                style={{ flex: 1 }}
              />
              <input
                className="input"
                placeholder="Name (optional)"
                value={aName}
                onChange={(e) => setAName(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>

            {aType === "crypto" ? (
              <input
                className="input"
                placeholder="CoinGecko ID (bitcoin, ethereum, solana...)"
                value={aCgId}
                onChange={(e) => setACgId(e.target.value)}
              />
            ) : null}

            <input className="input" placeholder="Note (optional)" value={aNote} onChange={(e) => setANote(e.target.value)} />

            {error ? (
              <div className="card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 950 }}>Fix this:</div>
                <div className="muted" style={{ marginTop: 4 }}>{error}</div>
              </div>
            ) : null}

            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <button className="btn" type="submit">Add Asset</button>
              <button
                className="btnGhost"
                type="button"
                onClick={() => {
                  setAType("stock");
                  setASymbol("");
                  setAName("");
                  setACgId("");
                  setANote("");
                  setError("");
                }}
              >
                Clear
              </button>
            </div>

            <div className="muted" style={{ fontSize: 12 }}>
              Then use Transactions to build your position. (BUY/SELL/DIVIDEND/CASH)
            </div>
          </form>
        </div>

        {/* FILTERS */}
        <div className="card" style={{ flex: 1, minWidth: 340 }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Find & Filter</div>

          <div className="grid" style={{ gap: 10 }}>
            <input className="input" placeholder="Search symbol/name/account/note…" value={q} onChange={(e) => setQ(e.target.value)} />

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <select className="input" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: 180 }}>
                <option value="all">All types</option>
                {computed.types.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>

              <select className="input" value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} style={{ flex: 1, minWidth: 180 }}>
                <option value="all">All accounts</option>
                {computed.accounts.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="value_desc">Sort: Value (high → low)</option>
              <option value="gain_desc">Sort: Unrealized (high → low)</option>
              <option value="gain_asc">Sort: Unrealized (low → high)</option>
              <option value="name_asc">Sort: Symbol (A → Z)</option>
            </select>

            <div className="muted" style={{ fontSize: 12 }}>
              Prices: crypto live now. Stocks/ETFs live if you set ALPHAVANTAGE_API_KEY in Render.
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* HOLDINGS */}
      <div className="card">
        <div style={{ fontWeight: 950, marginBottom: 10 }}>
          Holdings <span className="muted" style={{ fontWeight: 700 }}>({visiblePositions.length})</span>
        </div>

        {visiblePositions.length === 0 ? (
          <div className="muted">No holdings match your filters.</div>
        ) : (
          <div className="grid">
            {visiblePositions.map((p) => {
              const a = p.asset;
              const hasPosition = a.type === "cash" ? p.cashNet !== 0 : p.shares > 0;

              return (
                <div key={a.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 950, fontSize: 16 }}>
                        {a.type === "cash" ? "Cash" : a.symbol}{" "}
                        <span className="muted" style={{ fontWeight: 800 }}>• {a.account}</span>
                      </div>

                      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                        Value {money(p.value)} • Cost {money(p.costBasis)} • Unrealized {money(p.unrealized)} ({pct(p.unrealizedPct)})
                      </div>

                      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                        Realized {money(p.realized)} • Dividends {money(p.dividends)}
                      </div>

                      {a.note ? <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>Note: {a.note}</div> : null}

                      {!hasPosition ? (
                        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                          No position yet — add a BUY (or CASH_IN).
                        </div>
                      ) : null}
                    </div>

                    <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button className="btnGhost" type="button" onClick={() => setTAssetId(a.id)}>
                        Add Txn
                      </button>

                      <button
                        className="btnGhost"
                        type="button"
                        onClick={() => {
                          const next = prompt("Set manual price/value:", String(p.price || ""));
                          if (next === null) return;
                          setManualPrice(a, next);
                        }}
                        disabled={a.type === "cash"}
                      >
                        Set Price
                      </button>

                      <button className="btnGhost" type="button" onClick={() => removeAsset(a.id)}>
                        Delete Asset
                      </button>
                    </div>
                  </div>

                  <div style={{ height: 10 }} />

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div className="pill">{String(a.type).toUpperCase()}</div>
                    <div className="pill">SHARES: {a.type === "cash" ? "—" : (p.shares || 0)}</div>
                    <div className="pill">AVG: {money(p.avgCost)}</div>
                    <div className="pill">PRICE: {money(p.price)}</div>
                    {p.lastSource ? <div className="pill">SRC: {p.lastSource}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />

      {/* TRANSACTIONS */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, marginBottom: 6 }}>Transactions</div>
            <div className="muted" style={{ fontSize: 12 }}>
              This is the source of truth. Positions update automatically.
            </div>
          </div>

          <div className="muted" style={{ fontSize: 12 }}>
            Showing: {tAssetId ? "Selected asset only" : "All assets"}
          </div>
        </div>

        <div style={{ height: 10 }} />

        <form onSubmit={addTxn} className="grid" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select className="input" value={tAssetId} onChange={(e) => setTAssetId(e.target.value)} style={{ flex: 1, minWidth: 240 }}>
              <option value="">Pick asset…</option>
              {assets
                .slice()
                .sort((a, b) => `${a.account}-${a.symbol}`.localeCompare(`${b.account}-${b.symbol}`))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.type === "cash" ? "CASH" : a.symbol} • {a.account}
                  </option>
                ))}
            </select>

            <select className="input" value={tType} onChange={(e) => setTType(e.target.value)} style={{ width: 160 }}>
              {TXN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            <input className="input" type="date" value={tDate} onChange={(e) => setTDate(e.target.value)} style={{ width: 170 }} />
          </div>

          {(tType === "BUY" || tType === "SELL") ? (
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <input
                className="input"
                inputMode="decimal"
                placeholder="Qty"
                value={tQty}
                onChange={(e) => setTQty(e.target.value)}
                style={{ width: 160 }}
              />
              <input
                className="input"
                inputMode="decimal"
                placeholder="Price"
                value={tPrice}
                onChange={(e) => setTPrice(e.target.value)}
                style={{ width: 160 }}
              />
              <input
                className="input"
                inputMode="decimal"
                placeholder="Fee (optional)"
                value={tFee}
                onChange={(e) => setTFee(e.target.value)}
                style={{ width: 160 }}
              />
            </div>
          ) : (
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <input
                className="input"
                inputMode="decimal"
                placeholder="Amount"
                value={tAmount}
                onChange={(e) => setTAmount(e.target.value)}
                style={{ width: 220 }}
              />
              <input
                className="input"
                inputMode="decimal"
                placeholder="Fee (optional)"
                value={tFee}
                onChange={(e) => setTFee(e.target.value)}
                style={{ width: 160 }}
              />
            </div>
          )}

          <input className="input" placeholder="Note (optional)" value={tNote} onChange={(e) => setTNote(e.target.value)} />

          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <button className="btn" type="submit">Add Transaction</button>
            <button
              className="btnGhost"
              type="button"
              onClick={() => {
                setTQty("");
                setTPrice("");
                setTFee("");
                setTAmount("");
                setTNote("");
                setError("");
              }}
            >
              Clear
            </button>
            <button className="btnGhost" type="button" onClick={() => setTAssetId("")}>
              Show All
            </button>
          </div>
        </form>

        <div style={{ height: 12 }} />

        {visibleTxns.length === 0 ? (
          <div className="muted">No transactions yet.</div>
        ) : (
          <div className="grid">
            {visibleTxns.map((t) => {
              const a = computed.assetMap.get(t.assetId);
              const label = a ? `${a.type === "cash" ? "CASH" : a.symbol} • ${a.account}` : "Unknown asset";

              return (
                <div key={t.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 950 }}>
                        {t.type} <span className="muted" style={{ fontWeight: 800 }}>• {label}</span>
                      </div>
                      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                        {t.date}
                        {t.type === "BUY" || t.type === "SELL"
                          ? ` • Qty ${t.qty} @ ${money(t.price)}`
                          : ` • Amount ${money(t.amount)}`}
                        {Number(t.fee) ? ` • Fee ${money(t.fee)}` : ""}
                      </div>
                      {t.note ? <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>Note: {t.note}</div> : null}
                    </div>

                    <div className="row" style={{ gap: 8 }}>
                      <button className="btnGhost" type="button" onClick={() => deleteTxn(t.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />
      <div className="muted" style={{ fontSize: 12 }}>
        Next upgrades: (1) Import CSV, (2) Snapshots + charts ✅, (3) Auto-price for stocks with your key, (4) Realized vs Unrealized breakdown by account.
      </div>
    </main>
  );
}