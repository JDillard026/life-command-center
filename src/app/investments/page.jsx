"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Clock3,
  Plus,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../components/GlassPane";

export const dynamic = "force-dynamic";

const FONT_STACK =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function signedMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  const abs = Math.abs(num).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  if (num > 0) return `+${abs}`;
  if (num < 0) return `-${abs}`;
  return abs;
}

function pct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
}

function shortDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function monthLabel() {
  return new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function initials(label = "") {
  const clean = String(label || "").trim();
  if (!clean) return "—";
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
}

function overlineStyle() {
  return {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: ".22em",
    fontWeight: 800,
    color: "rgba(255,255,255,0.42)",
  };
}

function mutedStyle() {
  return {
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.64)",
  };
}

function toneMeta(tone = "neutral") {
  if (tone === "green") {
    return {
      text: "#97efc7",
      border: "rgba(143,240,191,0.16)",
      glow: "rgba(110,229,173,0.10)",
      dot: "#8ef4bb",
      pillBg: "rgba(8,18,12,0.42)",
      iconBg: "rgba(12,22,17,0.72)",
    };
  }

  if (tone === "red") {
    return {
      text: "#ffb4c5",
      border: "rgba(255,132,163,0.16)",
      glow: "rgba(255,108,145,0.10)",
      dot: "#ff96ae",
      pillBg: "rgba(18,8,11,0.42)",
      iconBg: "rgba(24,11,15,0.72)",
    };
  }

  if (tone === "amber") {
    return {
      text: "#f5cf88",
      border: "rgba(255,204,112,0.16)",
      glow: "rgba(255,194,92,0.10)",
      dot: "#ffd089",
      pillBg: "rgba(18,14,8,0.42)",
      iconBg: "rgba(24,18,11,0.72)",
    };
  }

  return {
    text: "#f7fbff",
    border: "rgba(214,226,255,0.13)",
    glow: "rgba(140,170,255,0.08)",
    dot: "#f7fbff",
    pillBg: "rgba(10,14,21,0.40)",
    iconBg: "rgba(12,16,24,0.72)",
  };
}

function toneByValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "neutral";
  return n > 0 ? "green" : "red";
}

function MiniPill({ children, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 32,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "0 11px",
        borderRadius: 999,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.035), 0 0 10px ${meta.glow}`,
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
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 18,
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#fff",
          }}
        >
          {title}
        </div>

        {subcopy ? <div style={{ ...mutedStyle(), marginTop: 4 }}>{subcopy}</div> : null}
      </div>

      {right || null}
    </div>
  );
}

function ActionLink({ href, children, full = false }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: full ? "100%" : undefined,
        minHeight: 40,
        padding: "10px 13px",
        borderRadius: 14,
        border: "1px solid rgba(214,226,255,0.10)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
        color: "#f7fbff",
        textDecoration: "none",
        fontWeight: 800,
        fontSize: 13,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 18px rgba(0,0,0,0.12)",
      }}
    >
      {children}
    </Link>
  );
}

function StatusDot({ tone = "neutral", size = 8 }) {
  const meta = toneMeta(tone);

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: meta.dot,
        boxShadow: `0 0 10px ${meta.glow}`,
        flexShrink: 0,
      }}
    />
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = "neutral", badge = "" }) {
  const meta = toneMeta(tone);

  return (
    <GlassPane tone={tone} size="card" style={{ height: "100%" }}>
      <div
        style={{
          minHeight: 138,
          display: "grid",
          gridTemplateRows: "auto auto auto 1fr",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 13,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${meta.border}`,
              background: meta.iconBg,
              color: tone === "neutral" ? "#fff" : meta.text,
              boxShadow: `0 0 12px ${meta.glow}`,
            }}
          >
            <Icon size={16} />
          </div>

          <StatusDot tone={tone} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={overlineStyle()}>{label}</div>

          {badge ? (
            <div style={{ marginTop: 7 }}>
              <div
                style={{
                  minHeight: 22,
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0 8px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  border: `1px solid ${meta.border}`,
                  color: tone === "neutral" ? "rgba(255,255,255,0.82)" : meta.text,
                  background: meta.pillBg,
                  whiteSpace: "normal",
                  lineHeight: 1.2,
                }}
              >
                {badge}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            fontSize: "clamp(22px, 2.8vw, 34px)",
            lineHeight: 1,
            fontWeight: 850,
            letterSpacing: "-0.05em",
            color: tone === "neutral" ? "#fff" : meta.text,
            overflowWrap: "anywhere",
          }}
        >
          {value}
        </div>

        <div style={{ ...mutedStyle(), overflowWrap: "anywhere" }}>{detail}</div>
      </div>
    </GlassPane>
  );
}

function EmptyState({ title, detail, linkHref, linkLabel }) {
  return (
    <div
      style={{
        minHeight: 140,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: "#fff",
            textAlign: "center",
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.64)",
            textAlign: "center",
          }}
        >
          {detail}
        </div>

        {linkHref && linkLabel ? (
          <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
            <ActionLink href={linkHref}>
              {linkLabel} <ArrowRight size={14} />
            </ActionLink>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HoldingRow({ item }) {
  const tone = item.hasLivePrice ? toneByValue(item.pnl) : "amber";
  const meta = toneMeta(tone);

  return (
    <Link
      href={`/investments/${item.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "48px minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
        minHeight: 74,
        padding: "12px 14px",
        borderRadius: 18,
        textDecoration: "none",
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.035), 0 0 12px ${meta.glow}`,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${meta.border}`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))",
          color: tone === "neutral" ? "#fff" : meta.text,
          fontWeight: 800,
          fontSize: 13,
          letterSpacing: ".06em",
        }}
      >
        {initials(item.symbol)}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.25,
            overflowWrap: "anywhere",
          }}
        >
          {item.symbol}
        </div>

        <div
          style={{
            marginTop: 3,
            fontSize: 12,
            color: "rgba(255,255,255,0.58)",
            lineHeight: 1.35,
            overflowWrap: "anywhere",
          }}
        >
          {item.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares •{" "}
          {item.hasLivePrice ? money(item.livePrice) : "No live price"}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#fff",
            whiteSpace: "nowrap",
          }}
        >
          {money(item.value)}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 12,
            fontWeight: 700,
            color: item.hasLivePrice ? meta.text : "rgba(255,255,255,0.58)",
            whiteSpace: "nowrap",
          }}
        >
          {item.hasLivePrice ? signedMoney(item.pnl) : "Pending"}
        </div>
      </div>
    </Link>
  );
}

function TradeRow({ txn, assetMap }) {
  const type = String(txn.txn_type || "").toUpperCase();
  const tone = type === "SELL" ? "green" : "neutral";
  const meta = toneMeta(tone);
  const sym = assetMap.get(txn.asset_id)?.symbol || "—";

  return (
    <div
      style={{
        minHeight: 68,
        display: "grid",
        gridTemplateColumns: "42px minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 16,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          display: "grid",
          placeItems: "center",
          border: `1px solid ${meta.border}`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))",
          color: type === "SELL" ? "#8ef4bb" : "#f7fbff",
          fontWeight: 900,
          fontSize: 12,
        }}
      >
        {type === "SELL" ? "S" : "B"}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.25,
          }}
        >
          {sym} {type}
        </div>
        <div style={{ marginTop: 3, ...mutedStyle() }}>
          {toNum(txn.qty).toLocaleString(undefined, { maximumFractionDigits: 4 })} @{" "}
          {money(txn.price)} • {shortDate(txn.txn_date)}
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: type === "SELL" ? "#97efc7" : "#fff",
          whiteSpace: "nowrap",
        }}
      >
        {money(toNum(txn.qty) * toNum(txn.price))}
      </div>
    </div>
  );
}

function buildFlowPoints(txns) {
  const sorted = [...txns].sort((a, b) => {
    const ad = new Date(a.txn_date || 0).getTime();
    const bd = new Date(b.txn_date || 0).getTime();
    return ad - bd;
  });

  const grouped = {};
  let running = 0;

  for (const t of sorted) {
    const qty = toNum(t.qty);
    const price = toNum(t.price);
    const type = String(t.txn_type || "").toUpperCase();
    const notional = qty * price;
    const signed = type === "SELL" ? -notional : notional;
    const key = t.txn_date || "Start";
    running += signed;
    grouped[key] = running;
  }

  let points = Object.entries(grouped).map(([date, value]) => ({
    label: date === "Start" ? "Start" : shortDate(date),
    value,
  }));

  if (!points.length) {
    points = [
      { label: "Start", value: 0 },
      { label: "W1", value: 0 },
      { label: "W2", value: 0 },
      { label: "W3", value: 0 },
      { label: "W4", value: 0 },
      { label: "Now", value: 0 },
    ];
  }

  if (points.length > 6) points = points.slice(-6);

  while (points.length < 6) {
    points.unshift({
      label: points[0]?.label || "Start",
      value: points[0]?.value || 0,
    });
  }

  return points;
}

function buildPath(points, width, height, padX, padY) {
  if (!points.length) return "";
  const values = points.map((p) => toNum(p.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = padX + (index * (width - padX * 2)) / Math.max(1, points.length - 1);
      const y = height - padY - (toNum(point.value) - min) * ((height - padY * 2) / range);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function pointCoords(points, width, height, padX, padY) {
  const values = points.map((p) => toNum(p.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return points.map((point, index) => {
    const x = padX + (index * (width - padX * 2)) / Math.max(1, points.length - 1);
    const y = height - padY - (toNum(point.value) - min) * ((height - padY * 2) / range);
    return { ...point, x, y };
  });
}

function parseBatchPrices(json) {
  const out = {};

  function assign(symbol, raw) {
    const sym = String(symbol || "").trim().toUpperCase();
    if (!sym) return;

    if (typeof raw === "number") {
      out[sym] = {
        price: toNum(raw, null),
        change: null,
        changesPercentage: null,
      };
      return;
    }

    if (raw && typeof raw === "object") {
      out[sym] = {
        price: toNum(raw.price, null),
        change: toNum(raw.change, null),
        changesPercentage: toNum(
          raw.changesPercentage ?? raw.changePercent ?? raw.percent_change,
          null
        ),
      };
    }
  }

  if (Array.isArray(json)) {
    json.forEach((row) => {
      assign(row?.symbol ?? row?.ticker, row);
    });
  }

  if (Array.isArray(json?.quotes)) {
    json.quotes.forEach((row) => assign(row?.symbol ?? row?.ticker, row));
  }

  if (Array.isArray(json?.data)) {
    json.data.forEach((row) => assign(row?.symbol ?? row?.ticker, row));
  }

  if (json?.prices && typeof json.prices === "object") {
    Object.entries(json.prices).forEach(([symbol, raw]) => assign(symbol, raw));
  }

  if (json && typeof json === "object" && !Array.isArray(json)) {
    Object.entries(json).forEach(([symbol, raw]) => {
      if (!out[String(symbol).toUpperCase()]) assign(symbol, raw);
    });
  }

  return out;
}

export default function InvestmentsPage() {
  const [assets, setAssets] = useState([]);
  const [txns, setTxns] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [symbol, setSymbol] = useState("");
  const [tradeAssetId, setTradeAssetId] = useState("");
  const [tradeType, setTradeType] = useState("BUY");
  const [tradeQty, setTradeQty] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        setError("You must be logged in.");
        return;
      }

      const [assetRes, txnRes, favoriteRes] = await Promise.all([
        supabase
          .from("investment_assets")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("investment_transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("txn_date", { ascending: false }),

        supabase
          .from("investment_favorites")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (assetRes.error || txnRes.error || favoriteRes.error) {
        console.error(assetRes.error || txnRes.error || favoriteRes.error);
        setError("Failed loading investment data.");
        setLoading(false);
        return;
      }

      setAssets(assetRes.data || []);
      setTxns(txnRes.data || []);
      setFavorites(favoriteRes.data || []);
      setLoading(false);
    }

    load();
  }, []);

  useEffect(() => {
    async function loadPrices() {
      const symbolsToLoad = [
        ...new Set(
          [
            ...assets.map((a) => String(a.symbol || "").toUpperCase().trim()),
            ...favorites.map((f) => String(f.symbol || "").toUpperCase().trim()),
          ].filter(Boolean)
        ),
      ];

      if (!symbolsToLoad.length) {
        setPrices({});
        return;
      }

      const nextPrices = {};

      try {
        const batchRes = await fetch(
          `/api/prices-batch?symbols=${encodeURIComponent(symbolsToLoad.join(","))}`,
          { cache: "no-store" }
        );
        const batchData = await batchRes.json();

        if (batchRes.ok) {
          Object.assign(nextPrices, parseBatchPrices(batchData));
        }
      } catch (err) {
        console.error("batch price fetch failed", err);
      }

      const missing = symbolsToLoad.filter((sym) => {
        const row = nextPrices[sym];
        return !row || !Number.isFinite(Number(row.price)) || Number(row.price) <= 0;
      });

      if (missing.length) {
        await Promise.all(
          missing.map(async (sym) => {
            try {
              const res = await fetch(`/api/prices?symbol=${encodeURIComponent(sym)}`, {
                cache: "no-store",
              });
              const data = await res.json();

              if (res.ok) {
                nextPrices[sym] = {
                  price: toNum(data?.price, null),
                  change: toNum(data?.change, null),
                  changesPercentage: toNum(
                    data?.changesPercentage ?? data?.changePercent ?? data?.percent_change,
                    null
                  ),
                };
              }
            } catch (err) {
              console.error(`single price fetch failed for ${sym}`, err);
            }
          })
        );
      }

      setPrices(nextPrices);
    }

    loadPrices();
  }, [assets, favorites]);

  const portfolio = useMemo(() => {
    const txnsByAsset = {};
    for (const txn of txns) {
      const key = txn.asset_id;
      txnsByAsset[key] = txnsByAsset[key] || [];
      txnsByAsset[key].push(txn);
    }

    let totalValue = 0;
    let totalCost = 0;
    let totalRealizedPnl = 0;

    const holdings = assets.map((asset) => {
      const ledger = [...(txnsByAsset[asset.id] || [])].sort((a, b) => {
        const ad = new Date(a.txn_date || 0).getTime();
        const bd = new Date(b.txn_date || 0).getTime();
        return ad - bd;
      });

      let shares = 0;
      let remainingBasis = 0;
      let realizedPnl = 0;

      for (const txn of ledger) {
        const qty = toNum(txn.qty);
        const price = toNum(txn.price);
        const type = String(txn.txn_type || "").toUpperCase();

        if (type === "BUY") {
          shares += qty;
          remainingBasis += qty * price;
          continue;
        }

        if (type === "SELL" && qty > 0) {
          const avgCost = shares > 0 ? remainingBasis / shares : 0;
          const qtySold = Math.min(shares, qty);
          shares -= qtySold;
          remainingBasis -= avgCost * qtySold;
          realizedPnl += qtySold * price - avgCost * qtySold;
        }
      }

      const symbol = String(asset.symbol || "").toUpperCase().trim();
      const quote = prices[symbol] || null;
      const livePrice = toNum(quote?.price, null);
      const hasLivePrice = Number.isFinite(livePrice) && livePrice > 0;
      const value = hasLivePrice ? shares * livePrice : 0;
      const pnl = hasLivePrice ? value - remainingBasis : null;
      const pnlPct =
        hasLivePrice && remainingBasis > 0 ? ((value - remainingBasis) / remainingBasis) * 100 : null;

      if (hasLivePrice) totalValue += value;
      totalCost += remainingBasis;
      totalRealizedPnl += realizedPnl;

      return {
        ...asset,
        shares,
        remainingBasis,
        livePrice,
        hasLivePrice,
        value,
        pnl,
        pnlPct,
        txCount: ledger.length,
      };
    });

    const sorted = [...holdings].sort((a, b) => toNum(b.value) - toNum(a.value));

    return {
      holdings: sorted,
      totalValue,
      totalCost,
      totalRealizedPnl,
      totalPnl: totalValue - totalCost,
    };
  }, [assets, txns, prices]);

  const openPositions = portfolio.holdings.filter((h) => toNum(h.shares) > 0);
  const alerts = openPositions.filter((h) => !h.hasLivePrice || toNum(h.pnl) < 0);
  const heroTone = toneByValue(portfolio.totalPnl);

  const flowPoints = useMemo(() => buildFlowPoints(txns), [txns]);
  const chartWidth = 960;
  const chartHeight = 320;
  const chartPadX = 30;
  const chartPadY = 34;
  const path = buildPath(flowPoints, chartWidth, chartHeight, chartPadX, chartPadY);
  const coords = pointCoords(flowPoints, chartWidth, chartHeight, chartPadX, chartPadY);

  const recentTxns = [...txns]
    .sort((a, b) => {
      const ad = new Date(a.txn_date || 0).getTime();
      const bd = new Date(b.txn_date || 0).getTime();
      return bd - ad;
    })
    .slice(0, 6);

  const assetMap = useMemo(() => {
    const map = new Map();
    assets.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [assets]);

  async function addAsset() {
    const clean = String(symbol || "").toUpperCase().trim();
    if (!clean) return;

    setStatus("");
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in.");
        return;
      }

      const exists = assets.some((a) => String(a.symbol || "").toUpperCase() === clean);
      if (exists) {
        setError(`${clean} is already in your portfolio.`);
        return;
      }

      const { data, error: insertError } = await supabase
        .from("investment_assets")
        .insert({
          user_id: user.id,
          symbol: clean,
          asset_type: "stock",
          account: "Main",
        })
        .select()
        .single();

      if (insertError) {
        console.error(insertError);
        setError(`Could not add ${clean}.`);
        return;
      }

      setAssets((prev) => [data, ...prev]);
      setTradeAssetId((prev) => prev || data.id);
      setSymbol("");
      setStatus(`${clean} added to investments.`);
    } catch (err) {
      console.error(err);
      setError("Failed adding the asset.");
    }
  }

  async function logTrade() {
    setStatus("");
    setError("");

    const qty = toNum(tradeQty, NaN);
    const price = toNum(tradePrice, NaN);

    if (!tradeAssetId) {
      setError("Pick an asset first.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a valid quantity.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid price.");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in.");
        return;
      }

      const { data, error: insertError } = await supabase
        .from("investment_transactions")
        .insert({
          user_id: user.id,
          asset_id: tradeAssetId,
          txn_type: tradeType,
          qty,
          price,
          txn_date: tradeDate,
        })
        .select()
        .single();

      if (insertError) {
        console.error(insertError);
        setError("Could not save trade.");
        return;
      }

      setTxns((prev) => [data, ...prev]);
      setTradeQty("");
      setTradePrice("");
      setStatus(`${tradeType} saved.`);
    } catch (err) {
      console.error(err);
      setError("Failed saving trade.");
    }
  }

  if (loading) {
    return (
      <main style={{ padding: "18px 0 28px", fontFamily: FONT_STACK }}>
        <div style={{ width: "min(100%, 1320px)", margin: "0 auto" }}>
          <GlassPane size="card">
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>
              Loading investments.
            </div>
          </GlassPane>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="investRoot">
        <div className="investInner">
          <GlassPane size="card">
            <div className="investHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div style={overlineStyle()}>Investments Board</div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: "clamp(24px, 3.2vw, 34px)",
                    lineHeight: 1.02,
                    fontWeight: 850,
                    letterSpacing: "-0.05em",
                    color: "#fff",
                  }}
                >
                  Investments Command
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                  <StatusDot tone={heroTone} />
                  <div style={{ ...mutedStyle(), whiteSpace: "normal", overflowWrap: "anywhere" }}>
                    {alerts.length
                      ? `${alerts.length} holding${alerts.length === 1 ? "" : "s"} need review right now.`
                      : "No immediate investment alerts."}
                  </div>
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
                <MiniPill>{monthLabel()}</MiniPill>
                <MiniPill tone={heroTone}>{openPositions.length} open positions</MiniPill>
                <ActionLink href="/investments/discover">
                  Discover <ArrowRight size={14} />
                </ActionLink>
              </div>
            </div>
          </GlassPane>

          {(status || error) && (
            <GlassPane tone={error ? "red" : "green"} size="card">
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 14,
                  color: "#fff",
                }}
              >
                {error || status}
              </div>
            </GlassPane>
          )}

          <section className="investMetrics">
            <MetricCard
              icon={Wallet}
              label="Portfolio Value"
              value={money(portfolio.totalValue)}
              detail="Live-priced current value across open positions."
              tone="neutral"
            />
            <MetricCard
              icon={TrendingUp}
              label="Unrealized P/L"
              value={signedMoney(portfolio.totalPnl)}
              detail="Current value minus remaining cost basis."
              tone={toneByValue(portfolio.totalPnl)}
            />
            <MetricCard
              icon={BadgeDollarSign}
              label="Remaining Basis"
              value={money(portfolio.totalCost)}
              detail="Unrealized capital still sitting in open positions."
              tone="neutral"
            />
            <MetricCard
              icon={BarChart3}
              label="Realized P/L"
              value={signedMoney(portfolio.totalRealizedPnl)}
              detail="Closed-result math from completed sells."
              tone={toneByValue(portfolio.totalRealizedPnl)}
            />
          </section>

          <section className="investMain">
            <div className="investLeftCol">
              <GlassPane size="card">
                <PaneHeader
                  title="Trade Flow"
                  subcopy="Capital flow across your recent buy and sell history."
                  right={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <MiniPill>{flowPoints.length} points</MiniPill>
                    </div>
                  }
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <SummaryMini title="Open Positions" value={String(openPositions.length)} />
                  <SummaryMini title="Favorites" value={String(favorites.length)} />
                  <SummaryMini title="Alerts" value={String(alerts.length)} tone={alerts.length ? "amber" : "green"} />
                  <SummaryMini title="Trades" value={String(txns.length)} />
                </div>

                <div
                  style={{
                    position: "relative",
                    minHeight: "clamp(220px, 28vw, 320px)",
                  }}
                >
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    style={{ width: "100%", display: "block" }}
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="invest-flow-area" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(136,170,255,0.10)" />
                        <stop offset="55%" stopColor="rgba(117,122,255,0.03)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                      </linearGradient>

                      <linearGradient id="invest-flow-line" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="rgba(196,220,255,0.9)" />
                        <stop offset="60%" stopColor="rgba(181,198,255,0.92)" />
                        <stop offset="100%" stopColor="rgba(196,177,255,0.92)" />
                      </linearGradient>

                      <filter id="invest-flow-glow">
                        <feGaussianBlur stdDeviation="3.25" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    <path
                      d={`${path} L ${chartWidth - chartPadX} ${chartHeight - chartPadY} L ${chartPadX} ${
                        chartHeight - chartPadY
                      } Z`}
                      fill="url(#invest-flow-area)"
                    />

                    <path
                      d={path}
                      fill="none"
                      stroke="url(#invest-flow-line)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#invest-flow-glow)"
                    />

                    {coords.map((point, idx) => (
                      <g key={`${point.label}-${idx}`}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="5.4"
                          fill="rgba(8,10,14,0.9)"
                          stroke="rgba(245,248,255,0.92)"
                          strokeWidth="2"
                        />
                        <circle cx={point.x} cy={point.y} r="1.8" fill="rgba(255,255,255,0.98)" />
                      </g>
                    ))}

                    {coords.map((point, idx) => (
                      <text
                        key={`label-${idx}`}
                        x={point.x}
                        y={chartHeight - 10}
                        fill="rgba(255,255,255,0.42)"
                        fontSize="11"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {point.label}
                      </text>
                    ))}
                  </svg>

                  <div
                    style={{
                      position: "absolute",
                      right: 14,
                      top: 20,
                    }}
                  >
                    <MiniPill tone={toneByValue(flowPoints[flowPoints.length - 1]?.value || 0)}>
                      {money(flowPoints[flowPoints.length - 1]?.value || 0)}
                    </MiniPill>
                  </div>
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Top Holdings"
                  subcopy="Largest live positions sitting on the board right now."
                  right={<MiniPill>{openPositions.length} active</MiniPill>}
                />

                <div style={{ display: "grid", gap: 8 }}>
                  {openPositions.length === 0 ? (
                    <EmptyState
                      title="No open positions"
                      detail="Add assets and log buys to start seeing live holdings here."
                      linkHref="/investments/discover"
                      linkLabel="Open Discover"
                    />
                  ) : (
                    portfolio.holdings
                      .filter((h) => toNum(h.shares) > 0)
                      .slice(0, 6)
                      .map((item) => <HoldingRow key={item.id} item={item} />)
                  )}
                </div>
              </GlassPane>
            </div>

            <div className="investRightCol">
              <GlassPane tone={alerts.length ? "amber" : "green"} size="card">
                <PaneHeader
                  title="Portfolio Signals"
                  subcopy="Fast pressure checks without turning this into an alert board."
                  right={<MiniPill tone={alerts.length ? "amber" : "green"}>{alerts.length} signals</MiniPill>}
                />

                <div style={{ display: "grid", gap: 8 }}>
                  {alerts.length === 0 ? (
                    <GlassPane tone="green" size="compact">
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
                        Portfolio looks clean
                      </div>
                      <div style={{ marginTop: 5, ...mutedStyle() }}>
                        All open positions are live priced and none are sitting negative right now.
                      </div>
                    </GlassPane>
                  ) : (
                    alerts.slice(0, 4).map((item) => (
                      <SignalRow
                        key={item.id}
                        title={item.symbol}
                        detail={
                          !item.hasLivePrice
                            ? "No live quote returned for this holding."
                            : `${signedMoney(item.pnl)} unrealized on ${item.shares.toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })} shares.`
                        }
                        tone={!item.hasLivePrice ? "amber" : "red"}
                        value={!item.hasLivePrice ? "Pending" : signedMoney(item.pnl)}
                      />
                    ))
                  )}
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Quick Trade"
                  subcopy="Add a symbol or log a buy/sell without leaving the page."
                />

                <div style={{ display: "grid", gap: 10 }}>
                  <Field label="Add Symbol">
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8 }}>
                      <input
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        placeholder="AAPL"
                        style={inputStyle()}
                      />
                      <button type="button" onClick={addAsset} style={buttonStyle(false)}>
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </Field>

                  <Field label="Trade Asset">
                    <select
                      value={tradeAssetId}
                      onChange={(e) => setTradeAssetId(e.target.value)}
                      style={inputStyle()}
                    >
                      <option value="">Select asset</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.symbol}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                    <Field label="Type">
                      <select
                        value={tradeType}
                        onChange={(e) => setTradeType(e.target.value)}
                        style={inputStyle()}
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </Field>

                    <Field label="Date">
                      <input
                        type="date"
                        value={tradeDate}
                        onChange={(e) => setTradeDate(e.target.value)}
                        style={inputStyle()}
                      />
                    </Field>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                    <Field label="Quantity">
                      <input
                        type="number"
                        step="0.0001"
                        value={tradeQty}
                        onChange={(e) => setTradeQty(e.target.value)}
                        placeholder="0.00"
                        style={inputStyle()}
                      />
                    </Field>

                    <Field label="Price">
                      <input
                        type="number"
                        step="0.01"
                        value={tradePrice}
                        onChange={(e) => setTradePrice(e.target.value)}
                        placeholder="0.00"
                        style={inputStyle()}
                      />
                    </Field>
                  </div>

                  <button type="button" onClick={logTrade} style={buttonStyle(true)}>
                    Save Trade <ArrowRight size={14} />
                  </button>
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Recent Trades"
                  subcopy="Latest transaction flow hitting the ledger."
                  right={<MiniPill>{recentTxns.length} shown</MiniPill>}
                />

                <div style={{ display: "grid", gap: 8 }}>
                  {recentTxns.length === 0 ? (
                    <EmptyState
                      title="No trades yet"
                      detail="Log your first buy or sell and this panel will light up."
                    />
                  ) : (
                    recentTxns.map((txn) => <TradeRow key={txn.id} txn={txn} assetMap={assetMap} />)
                  )}
                </div>
              </GlassPane>
            </div>
          </section>
        </div>
      </main>

      <style jsx global>{`
        .investRoot {
          position: relative;
          z-index: 1;
          padding: 18px 0 28px;
          font-family: ${FONT_STACK};
        }

        .investInner {
          width: min(100%, 1320px);
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }

        .investHeroGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
        }

        .investMetrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
        }

        .investMain {
          display: grid;
          grid-template-columns: minmax(0, 1.38fr) minmax(360px, 0.88fr);
          gap: 14px;
          align-items: start;
        }

        .investLeftCol,
        .investRightCol {
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        @media (max-width: 1260px) {
          .investMetrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .investMain {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 860px) {
          .investRoot {
            padding: 10px 0 22px;
          }

          .investInner {
            gap: 12px;
          }

          .investHeroGrid {
            grid-template-columns: 1fr;
          }

          .investMetrics {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }
      `}</style>
    </>
  );
}

function SummaryMini({ title, value, tone = "neutral" }) {
  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 78,
        borderRadius: 16,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.032), rgba(255,255,255,0.01))",
        padding: 13,
      }}
    >
      <div style={overlineStyle()}>{title}</div>
      <div
        style={{
          marginTop: 7,
          fontSize: 19,
          fontWeight: 850,
          letterSpacing: "-0.04em",
          color: tone === "neutral" ? "#fff" : meta.text,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SignalRow({ title, detail, tone = "neutral", value }) {
  const meta = toneMeta(tone);

  return (
    <div
      style={{
        minHeight: 58,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 16,
        border: `1px solid ${meta.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.25,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 12,
            color: "rgba(255,255,255,0.58)",
            lineHeight: 1.35,
            overflowWrap: "anywhere",
          }}
        >
          {detail}
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: tone === "neutral" ? "rgba(255,255,255,0.86)" : meta.text,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={overlineStyle()}>{label}</div>
      {children}
    </label>
  );
}

function inputStyle() {
  return {
    height: 46,
    borderRadius: 14,
    border: "1px solid rgba(214,226,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012)), rgba(8,12,20,0.76)",
    color: "#f7fbff",
    padding: "0 12px",
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
    width: "100%",
  };
}

function buttonStyle(primary = false) {
  return {
    minHeight: 46,
    padding: "0 14px",
    borderRadius: 14,
    border: primary
      ? "1px solid rgba(255,255,255,0.18)"
      : "1px solid rgba(214,226,255,0.10)",
    background: primary
      ? "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(233,239,248,0.88))"
      : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
    color: primary ? "#0b1220" : "#f7fbff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    boxShadow: primary ? "0 10px 22px rgba(255,255,255,0.08)" : undefined,
  };
}