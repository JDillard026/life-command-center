"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

export const dynamic = "force-dynamic";

// storage
const LS_ASSETS = "lcc_port_assets_v1";
const LS_TXNS = "lcc_port_txns_v1";
const LS_PRICES = "lcc_port_prices_v1";
const LS_UI = "lcc_port_ui_v4"; // bump to avoid fighting old UI state
const LS_SNAPS = "lcc_port_snaps_v1";
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

/** ---------- utils ---------- **/
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
function isoDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function normSymbol(s) {
  return String(s || "").trim().toUpperCase();
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

function clampStr(s, max = 120) {
  const t = String(s ?? "").trim();
  return t.length > max ? t.slice(0, max) : t;
}

function normalizeTxnType(raw) {
  const t = String(raw || "").trim().toUpperCase();
  if (!t) return "";
  if (t === "BUY" || t === "B") return "BUY";
  if (t === "SELL" || t === "S") return "SELL";
  if (t === "DIVIDEND" || t === "DIV" || t === "DIVIDENDS") return "DIVIDEND";
  if (t === "CASH_IN" || t === "DEPOSIT" || t === "CREDIT") return "CASH_IN";
  if (t === "CASH_OUT" || t === "WITHDRAWAL" || t === "DEBIT") return "CASH_OUT";
  // common broker words
  if (t.includes("BUY")) return "BUY";
  if (t.includes("SELL")) return "SELL";
  if (t.includes("DIV")) return "DIVIDEND";
  if (t.includes("DEPOSIT") || t.includes("CREDIT")) return "CASH_IN";
  if (t.includes("WITHDRAW") || t.includes("DEBIT")) return "CASH_OUT";
  return "";
}

function normalizeAssetType(raw) {
  const t = String(raw || "").trim().toLowerCase();
  if (!t) return "stock";
  if (["stock", "etf", "crypto", "cash", "other"].includes(t)) return t;
  if (t.includes("etf")) return "etf";
  if (t.includes("crypt")) return "crypto";
  if (t.includes("cash")) return "cash";
  return "stock";
}

// Accepts YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY
function normalizeDate(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = String(m[1]).padStart(2, "0");
    const dd = String(m[2]).padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // fallback: let Date parse (best effort)
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return isoDate(d);
  return "";
}

/** ---------- CSV parsing (no libs) ---------- **/
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // handle escaped quotes ""
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out.map((s) => String(s ?? "").trim());
}

function parseCsv(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (!lines.length) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = cols[c] ?? "";
    }
    rows.push(obj);
  }

  return { headers, rows };
}

/** ---------- portal modal ---------- **/
function Modal({ open, title, children, onClose, wide = false }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,.55)",
          backdropFilter: "blur(6px)",
        }}
      />
      <div
        className="card"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          width: wide ? "min(1040px, calc(100vw - 28px))" : "min(760px, calc(100vw - 28px))",
          maxHeight: "min(84vh, 820px)",
          overflow: "auto",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>{title}</div>
          <button className="btnGhost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div style={{ height: 12 }} />
        {children}
      </div>
    </div>,
    document.body
  );
}

/** ---------- tiny chart ---------- **/
function LineChart({ points, height = 160 }) {
  if (!points || points.length < 2) {
    return <div className="muted" style={{ fontSize: 12 }}>Need at least 2 snapshots to chart.</div>;
  }

  const w = 1000;
  const h = height;
  const pad = 14;

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
      <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <div className="muted" style={{ fontSize: 12 }}>{first.date} → {last.date}</div>
        <div className="muted" style={{ fontSize: 12 }}>Min {money(minY)} • Max {money(maxY)}</div>
      </div>

      <div style={{ height: 10 }} />

      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height }}>
        <path d={`M ${pad} ${h - pad} L ${w - pad} ${h - pad}`} fill="none" stroke="currentColor" opacity="0.12" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" />
      </svg>

      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Latest: <span style={{ fontWeight: 900 }}>{money(last.value)}</span>
      </div>
    </div>
  );
}

/** ---------- page ---------- **/
export default function InvestmentsPage() {
  const [assets, setAssets] = useState([]);
  const [txns, setTxns] = useState([]);
  const [prices, setPrices] = useState({});

  const [snaps, setSnaps] = useState([]);
  const [snapRange, setSnapRange] = useState("30");

  // UI
  const [tab, setTab] = useState("overview"); // overview | holdings | txns
  const [status, setStatus] = useState({ loading: false, msg: "" });
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [sortBy, setSortBy] = useState("value_desc");

  // modals
  const [openAssetModal, setOpenAssetModal] = useState(false);
  const [openTxnModal, setOpenTxnModal] = useState(false);
  const [openImportModal, setOpenImportModal] = useState(false);

  // Import UI
  const [importPreset, setImportPreset] = useState("generic");
  const [importAccountDefault, setImportAccountDefault] = useState("Main");
  const [importText, setImportText] = useState("");
  const [importSummary, setImportSummary] = useState("");

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
  const [tAmount, setTAmount] = useState("");
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

    if (savedUI?.tab) setTab(savedUI.tab);
    if (savedUI?.q) setQ(savedUI.q);
    if (savedUI?.filterType) setFilterType(savedUI.filterType);
    if (savedUI?.filterAccount) setFilterAccount(savedUI.filterAccount);
    if (savedUI?.sortBy) setSortBy(savedUI.sortBy);

    // migrate old if needed
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

        localStorage.setItem(LS_ASSETS, JSON.stringify(migratedAssets));
        localStorage.setItem(LS_TXNS, JSON.stringify(migratedTxns));
        localStorage.setItem(LS_PRICES, JSON.stringify(migratedPrices));

        setStatus({ loading: false, msg: "Migrated old holdings into ledger ✅" });
      }
    }
  }, []);

  // Persist
  useEffect(() => { try { localStorage.setItem(LS_ASSETS, JSON.stringify(assets)); } catch {} }, [assets]);
  useEffect(() => { try { localStorage.setItem(LS_TXNS, JSON.stringify(txns)); } catch {} }, [txns]);
  useEffect(() => { try { localStorage.setItem(LS_PRICES, JSON.stringify(prices)); } catch {} }, [prices]);
  useEffect(() => {
    try { localStorage.setItem(LS_UI, JSON.stringify({ tab, q, filterType, filterAccount, sortBy })); } catch {}
  }, [tab, q, filterType, filterAccount, sortBy]);
  useEffect(() => { try { localStorage.setItem(LS_SNAPS, JSON.stringify(snaps)); } catch {} }, [snaps]);

  // Compute positions
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

    for (const a of assets) {
      const list = (txByAsset.get(a.id) || [])
        .slice()
        .sort((x, y) => String(x.date).localeCompare(String(y.date)) || (x.createdAt || 0) - (y.createdAt || 0));

      let shares = 0;
      let costBasis = 0;
      let realized = 0;
      let dividends = 0;
      let cashNet = 0;

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

          shares -= qtyToSell;
          costBasis -= avgCost * qtyToSell;

          realized += (price - avgCost) * qtyToSell - fee;
        }

        if (t.type === "DIVIDEND") {
          const amt = Number(t.amount) || 0;
          if (amt > 0) {
            dividends += amt;
            realized += amt;
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

      const priceKey = `${a.type}:${a.symbol}`;
      const lastPrice = Number(prices?.[priceKey]?.price) || 0;
      const value = a.type === "cash" ? Math.max(0, cashNet) : shares * lastPrice;

      const unrealized = value - costBasis;
      const unrealizedPct = costBasis > 0 ? (unrealized / costBasis) * 100 : 0;
      const avgCostNow = shares > 0 ? costBasis / shares : 0;

      totalValue += value;
      totalCost += costBasis;
      totalRealized += realized;
      totalDividends += dividends;

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

    return {
      positions,
      totalValue,
      totalCost,
      totalUnrealized,
      totalUnrealizedPct,
      totalRealized,
      totalDividends,
      accounts,
      types,
      assetMap,
    };
  }, [assets, txns, prices]);

  // Snapshots: auto 1/day update
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
  }, [computed.totalValue, computed.totalCost, computed.totalRealized, assets.length, txns.length, Object.keys(prices || {}).length]);

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

  // Holdings list with filters (used in Holdings tab)
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
    const rows = txns.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return tAssetId ? rows.filter((t) => t.assetId === tAssetId) : rows;
  }, [txns, tAssetId]);

  const assetOptions = useMemo(() => {
    return assets
      .slice()
      .sort((a, b) => `${a.account}-${a.symbol}`.localeCompare(`${b.account}-${b.symbol}`))
      .map((a) => ({
        id: a.id,
        label: `${a.type === "cash" ? "CASH" : a.symbol} • ${a.account}`,
      }));
  }, [assets]);

  // Overview: show top 5 by value
  const topHoldings = useMemo(() => {
    return computed.positions
      .slice()
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5);
  }, [computed.positions]);

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
    if (tp === "crypto" && !cg) return setError("Crypto needs CoinGecko ID (bitcoin, ethereum...).");

    const dup = assets.some((x) => x.type === tp && x.symbol === sym && x.account === acct);
    if (dup) return setError("That asset already exists for this account.");

    const id = uid();
    setAssets((prev) => [
      { id, type: tp, symbol: sym, name: nm, account: acct, cgId: tp === "crypto" ? cg : "", note, createdAt: Date.now() },
      ...prev,
    ]);

    setTAssetId(id);
    setStatus({ loading: false, msg: "Asset added ✅" });

    setAType("stock");
    setASymbol("");
    setAName("");
    setAAccount(acct);
    setACgId("");
    setANote("");

    setOpenAssetModal(false);
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
    }

    const id = uid();
    setTxns((prev) => [
      { id, assetId, type: tp, date, qty, price, fee, amount, note: clampStr(tNote, 240), createdAt: Date.now() },
      ...prev,
    ]);

    setTQty("");
    setTPrice("");
    setTFee("");
    setTAmount("");
    setTNote("");

    setStatus({ loading: false, msg: "Transaction added ✅" });
    setOpenTxnModal(false);
  }

  function deleteTxn(id) {
    setTxns((prev) => prev.filter((t) => t.id !== id));
    setStatus({ loading: false, msg: "Transaction deleted." });
  }

  function removeAsset(assetId) {
    if (!confirm("Delete this asset AND all its transactions?")) return;
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    setTxns((prev) => prev.filter((t) => t.assetId !== assetId));
    if (tAssetId === assetId) setTAssetId("");
    setStatus({ loading: false, msg: "Asset deleted." });
  }

  function setManualPrice(asset, nextPrice) {
    const pr = parseMoneyInput(nextPrice);
    if (!Number.isFinite(pr) || pr < 0) {
      alert("Invalid price/value.");
      return;
    }
    const key = `${asset.type}:${asset.symbol}`;
    setPrices((p) => ({ ...p, [key]: { price: pr, ts: Date.now(), source: "manual" } }));
    setStatus({ loading: false, msg: "Price saved ✅" });
  }

  function clearSnapshots() {
    if (!confirm("Delete ALL snapshots?")) return;
    setSnaps([]);
    setStatus({ loading: false, msg: "Snapshots cleared." });
  }

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
        msg: errCount ? `Updated. ${errCount} symbols failed.` : "Prices updated ✅",
      });
    } catch (e) {
      setStatus({ loading: false, msg: `Refresh failed: ${e?.message || "unknown"}` });
    }
  }

  /** ---------- CSV Import ---------- **/
  async function onPickCsvFile(file) {
    setImportSummary("");
    if (!file) return;
    const text = await file.text();
    setImportText(text);
  }

  function runImport() {
    setError("");
    setImportSummary("");

    const raw = importText.trim();
    if (!raw) {
      setImportSummary("Paste CSV text or pick a file first.");
      return;
    }

    const { headers, rows } = parseCsv(raw);
    if (!headers.length) {
      setImportSummary("Could not read CSV headers.");
      return;
    }

    // We only implement a "Generic" format (works for exported spreadsheets too).
    // Required-ish columns:
    // date, type, symbol
    // plus:
    // qty, price for BUY/SELL
    // amount for DIVIDEND/CASH
    // fee optional
    // account optional (or we use the default account)
    // assetType optional (stock/etf/crypto/cash/other), default stock
    // name optional, note optional, cgId optional
    const get = (obj, key) => {
      // tolerant lookup (case-insensitive)
      const hit = Object.keys(obj).find((k) => k.trim().toLowerCase() === key.toLowerCase());
      return hit ? obj[hit] : "";
    };

    const existingKeyToAssetId = new Map(
      assets.map((a) => [`${a.type}:${a.symbol}:${a.account}`, a.id])
    );

    const nextAssets = assets.slice();
    const nextTxns = txns.slice();

    let addedAssets = 0;
    let addedTxns = 0;
    let skipped = 0;

    for (const r of rows) {
      const date = normalizeDate(get(r, "date"));
      const type = normalizeTxnType(get(r, "type"));
      const symbolRaw = get(r, "symbol");
      const account = clampStr(get(r, "account") || importAccountDefault || "Main", 60);
      const assetType = normalizeAssetType(get(r, "assetType") || get(r, "asset_type") || get(r, "asset"));
      const name = clampStr(get(r, "name"), 80);
      const note = clampStr(get(r, "note"), 240);
      const cgId = clampStr(get(r, "cgId") || get(r, "coingecko") || get(r, "coingeckoId"), 80);

      const symbol = assetType === "cash" ? "CASH" : normSymbol(symbolRaw);

      if (!date || !type || (assetType !== "cash" && !symbol)) {
        skipped++;
        continue;
      }

      // ensure asset exists
      const assetKey = `${assetType}:${symbol}:${account}`;
      let assetId = existingKeyToAssetId.get(assetKey);

      if (!assetId) {
        assetId = uid();
        existingKeyToAssetId.set(assetKey, assetId);
        nextAssets.unshift({
          id: assetId,
          type: assetType,
          symbol,
          name,
          account,
          cgId: assetType === "crypto" ? cgId : "",
          note,
          createdAt: Date.now(),
        });
        addedAssets++;
      }

      const fee = parseMoneyInput(get(r, "fee"));
      const feeVal = Number.isFinite(fee) && fee >= 0 ? fee : 0;

      let qty = 0;
      let price = 0;
      let amount = 0;

      if (type === "BUY" || type === "SELL") {
        const qv = parseNumberInput(get(r, "qty") || get(r, "quantity") || get(r, "shares"));
        const pv = parseMoneyInput(get(r, "price") || get(r, "fillPrice") || get(r, "avgPrice"));
        if (!Number.isFinite(qv) || qv <= 0 || !Number.isFinite(pv) || pv <= 0) {
          skipped++;
          continue;
        }
        qty = qv;
        price = pv;
        if (assetType === "cash") {
          skipped++;
          continue;
        }
      } else {
        const av = parseMoneyInput(get(r, "amount") || get(r, "value") || get(r, "cash"));
        if (!Number.isFinite(av) || av <= 0) {
          skipped++;
          continue;
        }
        amount = av;
      }

      nextTxns.unshift({
        id: uid(),
        assetId,
        type,
        date,
        qty,
        price,
        fee: feeVal,
        amount,
        note,
        createdAt: Date.now(),
      });

      addedTxns++;
    }

    // Basic dedupe protection (optional): if user imports the same CSV twice, it'll double.
    // We won't auto-dedupe without a guaranteed broker transaction id.
    setAssets(nextAssets);
    setTxns(nextTxns);

    const msg = `Import complete ✅  Added assets: ${addedAssets} • Added txns: ${addedTxns} • Skipped rows: ${skipped}`;
    setStatus({ loading: false, msg });
    setImportSummary(msg);
    setOpenImportModal(false);
  }

  return (
    <main className="container">
      {/* PROFESSIONAL WRAPPER: fixes “text hugging borders” */}
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "20px 18px 28px",
        }}
      >
        {/* HEADER */}
        <header style={{ marginBottom: 14 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Investments</div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, letterSpacing: "-0.02em" }}>Portfolio</h1>
              <div className="muted" style={{ marginTop: 6, maxWidth: 720 }}>
                Overview stays clean. Details are in tabs. Add/Import actions are up top.
              </div>
            </div>

            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn" type="button" onClick={refreshPrices} disabled={status.loading}>
                {status.loading ? "Refreshing..." : "Refresh Prices"}
              </button>

              <button className="btnGhost" type="button" onClick={() => setOpenImportModal(true)}>
                Import CSV
              </button>

              <button className="btnGhost" type="button" onClick={() => setOpenAssetModal(true)}>
                + Add Asset
              </button>

              <button
                className="btnGhost"
                type="button"
                onClick={() => {
                  setOpenTxnModal(true);
                  if (!tAssetId && assets[0]?.id) setTAssetId(assets[0].id);
                }}
                disabled={!assets.length}
                title={!assets.length ? "Add an asset first" : ""}
              >
                + Add Transaction
              </button>
            </div>
          </div>

          {(status.msg || error) ? (
            <div className="card" style={{ padding: 12, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  {error ? <div style={{ fontWeight: 950 }}>Fix this:</div> : <div style={{ fontWeight: 950 }}>Message:</div>}
                  <div className="muted" style={{ marginTop: 6 }}>{error || status.msg}</div>
                </div>
                <button
                  className="btnGhost"
                  type="button"
                  onClick={() => {
                    setStatus({ loading: false, msg: "" });
                    setError("");
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}
        </header>

        {/* KPIs */}
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <div className="card kpi" style={{ flex: 1, minWidth: 240, padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>Total value</div>
            <div className="kpiValue">{money(computed.totalValue)}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Cost basis: {money(computed.totalCost)}</div>
          </div>

          <div className="card kpi" style={{ flex: 1, minWidth: 240, padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>Unrealized G/L</div>
            <div className="kpiValue">
              {money(computed.totalUnrealized)}{" "}
              <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                ({pct(computed.totalUnrealizedPct)})
              </span>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Based on latest prices</div>
          </div>

          <div className="card kpi" style={{ flex: 1, minWidth: 240, padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>Realized (incl dividends)</div>
            <div className="kpiValue">{money(computed.totalRealized)}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Dividends: {money(computed.totalDividends)}</div>
          </div>
        </div>

        <div style={{ height: 14 }} />

        {/* Tabs */}
        <div className="card" style={{ padding: 10 }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className={tab === "overview" ? "btn" : "btnGhost"} type="button" onClick={() => setTab("overview")}>
              Overview
            </button>
            <button className={tab === "holdings" ? "btn" : "btnGhost"} type="button" onClick={() => setTab("holdings")}>
              Holdings
            </button>
            <button className={tab === "txns" ? "btn" : "btnGhost"} type="button" onClick={() => setTab("txns")}>
              Transactions
            </button>

            <div style={{ flex: 1 }} />

            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div className="pill">Assets: {assets.length}</div>
              <div className="pill">Txns: {txns.length}</div>
              <div className="pill">Snaps: {snaps.length}</div>
            </div>
          </div>
        </div>

        <div style={{ height: 12 }} />

        {/* OVERVIEW */}
        {tab === "overview" ? (
          <div className="grid" style={{ gap: 12 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 950 }}>Daily Snapshots</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Auto-saves 1 snapshot per day (updates today automatically).
                  </div>
                </div>

                <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <select className="input" value={snapRange} onChange={(e) => setSnapRange(e.target.value)} style={{ width: 160 }}>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="365">Last 1 year</option>
                    <option value="all">All</option>
                  </select>

                  <button className="btnGhost" type="button" onClick={saveSnapshotNow}>Save Snapshot</button>
                  <button className="btnGhost" type="button" onClick={clearSnapshots} disabled={!snaps.length}>Clear</button>
                </div>
              </div>

              <div style={{ height: 12 }} />

              {snaps.length ? (
                <LineChart points={chartPoints} />
              ) : (
                <div className="muted" style={{ fontSize: 12 }}>
                  No snapshots yet. Add assets + transactions and it will start capturing daily.
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 950 }}>Top Holdings</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Quick preview. Full list is in the Holdings tab.
                  </div>
                </div>
                <button className="btnGhost" type="button" onClick={() => setTab("holdings")}>
                  Go to Holdings →
                </button>
              </div>

              <div style={{ height: 10 }} />

              {!topHoldings.length ? (
                <div className="muted">No holdings yet.</div>
              ) : (
                <div className="grid" style={{ gap: 10 }}>
                  {topHoldings.map((p) => {
                    const a = p.asset;
                    return (
                      <div key={a.id} className="card" style={{ padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontWeight: 950 }}>
                              {a.type === "cash" ? "Cash" : a.symbol}{" "}
                              <span className="muted" style={{ fontWeight: 800 }}>• {a.account}</span>
                            </div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              Value <b>{money(p.value)}</b> • Unrealized {money(p.unrealized)} ({pct(p.unrealizedPct)})
                            </div>
                          </div>

                          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                            <button
                              className="btnGhost"
                              type="button"
                              onClick={() => {
                                setTAssetId(a.id);
                                setOpenTxnModal(true);
                              }}
                            >
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
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* HOLDINGS */}
        {tab === "holdings" ? (
          <div className="grid" style={{ gap: 12 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontWeight: 950 }}>Holdings</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Filter here. Keep the rest of the screen clean.
                  </div>
                </div>

                <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input className="input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />

                  <select className="input" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: 160 }}>
                    <option value="all">All types</option>
                    {computed.types.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select>

                  <select className="input" value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} style={{ width: 200 }}>
                    <option value="all">All accounts</option>
                    {computed.accounts.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>

                  <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: 220 }}>
                    <option value="value_desc">Sort: Value (high → low)</option>
                    <option value="gain_desc">Sort: Unrealized (high → low)</option>
                    <option value="gain_asc">Sort: Unrealized (low → high)</option>
                    <option value="name_asc">Sort: Symbol (A → Z)</option>
                  </select>

                  <button
                    className="btnGhost"
                    type="button"
                    onClick={() => {
                      setQ("");
                      setFilterType("all");
                      setFilterAccount("all");
                      setSortBy("value_desc");
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              {visiblePositions.length === 0 ? (
                <div className="muted">No holdings match your filters.</div>
              ) : (
                <div className="grid" style={{ gap: 10 }}>
                  {visiblePositions.map((p) => {
                    const a = p.asset;
                    return (
                      <div key={a.id} className="card" style={{ padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontWeight: 950, fontSize: 16 }}>
                              {a.type === "cash" ? "Cash" : a.symbol}{" "}
                              <span className="muted" style={{ fontWeight: 800 }}>• {a.account}</span>
                            </div>

                            <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                              Value <b>{money(p.value)}</b> • Cost {money(p.costBasis)} • Unrealized <b>{money(p.unrealized)}</b> ({pct(p.unrealizedPct)})
                            </div>

                            <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                              Shares {a.type === "cash" ? "—" : (p.shares || 0)} • Avg {money(p.avgCost)} • Price {money(p.price)} {p.lastSource ? `• SRC ${p.lastSource}` : ""}
                            </div>

                            {a.note ? <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>Note: {a.note}</div> : null}
                          </div>

                          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <button
                              className="btnGhost"
                              type="button"
                              onClick={() => {
                                setTAssetId(a.id);
                                setOpenTxnModal(true);
                              }}
                            >
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
          </div>
        ) : null}

        {/* TRANSACTIONS */}
        {tab === "txns" ? (
          <div className="grid" style={{ gap: 12 }}>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 950 }}>Transactions</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Add transactions with the button. Filter by asset using the dropdown.
                  </div>
                </div>

                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setOpenTxnModal(true)}
                    disabled={!assets.length}
                    title={!assets.length ? "Add an asset first" : ""}
                  >
                    + Add Transaction
                  </button>

                  <select className="input" value={tAssetId} onChange={(e) => setTAssetId(e.target.value)} style={{ width: 280 }}>
                    <option value="">All assets</option>
                    {assetOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              {visibleTxns.length === 0 ? (
                <div className="muted">No transactions yet.</div>
              ) : (
                <div className="grid" style={{ gap: 10 }}>
                  {visibleTxns.map((t) => {
                    const a = computed.assetMap.get(t.assetId);
                    const label = a ? `${a.type === "cash" ? "CASH" : a.symbol} • ${a.account}` : "Unknown asset";
                    return (
                      <div key={t.id} className="card" style={{ padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
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

                          <button className="btnGhost" type="button" onClick={() => deleteTxn(t.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Add Asset Modal */}
        <Modal open={openAssetModal} title="Add Asset" onClose={() => setOpenAssetModal(false)}>
          <form onSubmit={addAsset} className="grid" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <select className="input" value={aType} onChange={(e) => setAType(e.target.value)} style={{ width: 180 }}>
                {ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>

              <input
                className="input"
                placeholder="Account (Fidelity, Robinhood, 401k...)"
                value={aAccount}
                onChange={(e) => setAAccount(e.target.value)}
                style={{ flex: 1, minWidth: 220 }}
              />
            </div>

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <input
                className="input"
                placeholder={aType === "cash" ? "Symbol (auto: CASH)" : "Symbol (VOO, QQQ, BTC...)"}
                value={aSymbol}
                onChange={(e) => setASymbol(e.target.value)}
                disabled={aType === "cash"}
                style={{ flex: 1, minWidth: 220 }}
              />
              <input
                className="input"
                placeholder="Name (optional)"
                value={aName}
                onChange={(e) => setAName(e.target.value)}
                style={{ flex: 1, minWidth: 220 }}
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

            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn" type="submit">Add Asset</button>
              <button className="btnGhost" type="button" onClick={() => setOpenAssetModal(false)}>Cancel</button>
            </div>

            <div className="muted" style={{ fontSize: 12 }}>
              Crypto needs CoinGecko ID for live price. Stocks/ETFs live if you set <b>ALPHAVANTAGE_API_KEY</b>.
            </div>
          </form>
        </Modal>

        {/* Add Transaction Modal */}
        <Modal open={openTxnModal} title="Add Transaction" onClose={() => setOpenTxnModal(false)}>
          <form onSubmit={addTxn} className="grid" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <select className="input" value={tAssetId} onChange={(e) => setTAssetId(e.target.value)} style={{ flex: 1, minWidth: 260 }}>
                <option value="">Pick asset…</option>
                {assetOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>

              <select className="input" value={tType} onChange={(e) => setTType(e.target.value)} style={{ width: 160 }}>
                {TXN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>

              <input className="input" type="date" value={tDate} onChange={(e) => setTDate(e.target.value)} style={{ width: 170 }} />
            </div>

            {(tType === "BUY" || tType === "SELL") ? (
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input className="input" inputMode="decimal" placeholder="Qty" value={tQty} onChange={(e) => setTQty(e.target.value)} style={{ width: 160 }} />
                <input className="input" inputMode="decimal" placeholder="Price" value={tPrice} onChange={(e) => setTPrice(e.target.value)} style={{ width: 160 }} />
                <input className="input" inputMode="decimal" placeholder="Fee (optional)" value={tFee} onChange={(e) => setTFee(e.target.value)} style={{ width: 160 }} />
              </div>
            ) : (
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <input className="input" inputMode="decimal" placeholder="Amount" value={tAmount} onChange={(e) => setTAmount(e.target.value)} style={{ width: 220 }} />
                <input className="input" inputMode="decimal" placeholder="Fee (optional)" value={tFee} onChange={(e) => setTFee(e.target.value)} style={{ width: 160 }} />
              </div>
            )}

            <input className="input" placeholder="Note (optional)" value={tNote} onChange={(e) => setTNote(e.target.value)} />

            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn" type="submit">Add Transaction</button>
              <button className="btnGhost" type="button" onClick={() => setOpenTxnModal(false)}>Cancel</button>
            </div>
          </form>
        </Modal>

        {/* CSV Import Modal */}
        <Modal open={openImportModal} title="Import CSV" onClose={() => setOpenImportModal(false)} wide>
          <div className="grid" style={{ gap: 12 }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900 }}>What CSV Import does</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                It reads a CSV export (or your own spreadsheet), creates missing assets, and adds transactions into your ledger automatically.
                No more typing every BUY/SELL/DIV by hand.
              </div>
            </div>

            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select className="input" value={importPreset} onChange={(e) => setImportPreset(e.target.value)} style={{ width: 220 }}>
                <option value="generic">Preset: Generic CSV</option>
              </select>

              <input
                className="input"
                value={importAccountDefault}
                onChange={(e) => setImportAccountDefault(e.target.value)}
                placeholder="Default account (used if CSV has no account column)"
                style={{ flex: 1, minWidth: 260 }}
              />

              <label className="btnGhost" style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => onPickCsvFile(e.target.files?.[0])}
                />
                Choose CSV File
              </label>

              <button className="btn" type="button" onClick={runImport}>
                Import Now
              </button>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900 }}>Generic CSV format (recommended)</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Required columns: <b>date</b>, <b>type</b>, <b>symbol</b> (symbol not required for cash)
                <br />
                For BUY/SELL include: <b>qty</b>, <b>price</b>
                <br />
                For DIVIDEND/CASH include: <b>amount</b>
                <br />
                Optional: <b>fee</b>, <b>account</b>, <b>assetType</b> (stock/etf/crypto/cash), <b>name</b>, <b>note</b>, <b>cgId</b>
              </div>

              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                Example header:
                <div style={{ marginTop: 6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                  date,type,symbol,qty,price,amount,fee,account,assetType,name,note,cgId
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900 }}>Paste CSV text (optional)</div>
              <textarea
                className="input"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste your CSV here (or choose a file above)..."
                style={{ width: "100%", minHeight: 180, resize: "vertical", padding: 12, lineHeight: 1.35 }}
              />
              {importSummary ? (
                <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>{importSummary}</div>
              ) : (
                <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                  Note: importing the same CSV twice will duplicate transactions (because brokers don’t always provide a stable transaction ID in exports).
                </div>
              )}
            </div>
          </div>
        </Modal>

        <div style={{ height: 16 }} />
        <div className="muted" style={{ fontSize: 12 }}>
          Tip: If your broker export doesn’t match the “Generic CSV format”, open it in Excel/Sheets and rename columns to match.
        </div>
      </div>
    </main>
  );
}