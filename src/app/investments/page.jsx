"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const DISPLAY_FONT = 'Georgia, "Times New Roman", serif';

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function fmtNumber(n, digits = 4) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
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
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function monthLabel() {
  return new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function toneByValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "neutral";
  return n > 0 ? "good" : "bad";
}

function toneVars(tone = "neutral") {
  if (tone === "good") {
    return {
      border: "rgba(92, 247, 184, 0.20)",
      glow: "rgba(92, 247, 184, 0.14)",
      accent: "#95f7ca",
      top: "rgba(92, 247, 184, 0.10)",
      text: "#dffff1",
    };
  }

  if (tone === "bad") {
    return {
      border: "rgba(255, 126, 169, 0.18)",
      glow: "rgba(255, 126, 169, 0.12)",
      accent: "#ffb3cb",
      top: "rgba(255, 126, 169, 0.10)",
      text: "#ffe2ea",
    };
  }

  return {
    border: "rgba(225, 235, 255, 0.14)",
    glow: "rgba(133, 173, 255, 0.10)",
    accent: "rgba(255,255,255,.92)",
    top: "rgba(109, 146, 255, 0.10)",
    text: "rgba(255,255,255,.96)",
  };
}

function pageShell() {
  return {
    minHeight: "100vh",
    maxWidth: 1480,
    margin: "0 auto",
    padding: "24px 20px 56px",
    color: "rgba(255,255,255,.96)",
    background: `
      radial-gradient(circle at 12% 8%, rgba(85,135,255,.08) 0%, rgba(0,0,0,0) 24%),
      radial-gradient(circle at 78% 6%, rgba(255,255,255,.04) 0%, rgba(0,0,0,0) 18%),
      radial-gradient(circle at 50% 36%, rgba(99, 135, 255, .04) 0%, rgba(0,0,0,0) 28%)
    `,
  };
}

function glass(tone = "neutral", radius = 28) {
  const t = toneVars(tone);

  return {
    position: "relative",
    overflow: "hidden",
    borderRadius: radius,
    border: `1px solid ${t.border}`,
    background: `
      linear-gradient(180deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,.045) 10%, rgba(255,255,255,.01) 20%, rgba(255,255,255,0) 34%),
      radial-gradient(circle at top left, ${t.top} 0%, rgba(255,255,255,0) 28%),
      linear-gradient(180deg, rgba(9,14,28,.28) 0%, rgba(7,11,22,.16) 100%)
    `,
    boxShadow: `
      0 0 0 1px rgba(255,255,255,.02) inset,
      0 14px 38px rgba(0,0,0,.14),
      0 0 20px ${t.glow}
    `,
    backdropFilter: "blur(26px)",
    WebkitBackdropFilter: "blur(26px)",
  };
}

function heroRail() {
  return {
    ...glass("neutral", 34),
    padding: "26px 24px 24px",
  };
}

function pill(active = false) {
  return {
    height: 40,
    padding: "0 16px",
    borderRadius: 999,
    border: active
      ? "1px solid rgba(255,255,255,.28)"
      : "1px solid rgba(255,255,255,.10)",
    background: active
      ? "linear-gradient(180deg, rgba(255,255,255,.94) 0%, rgba(236,241,248,.88) 100%)"
      : "linear-gradient(180deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,.04) 100%)",
    color: active ? "#0b1220" : "rgba(255,255,255,.92)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
    whiteSpace: "nowrap",
    boxShadow: active ? "0 8px 18px rgba(255,255,255,.08)" : "none",
  };
}

function actionBtn(primary = false) {
  return {
    height: 44,
    padding: "0 16px",
    borderRadius: 999,
    border: primary
      ? "1px solid rgba(255,255,255,.28)"
      : "1px solid rgba(255,255,255,.10)",
    background: primary
      ? "linear-gradient(180deg, rgba(255,255,255,.95) 0%, rgba(233,239,248,.88) 100%)"
      : "linear-gradient(180deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,.03) 100%)",
    color: primary ? "#0b1220" : "rgba(255,255,255,.94)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: primary ? "0 10px 22px rgba(255,255,255,.08)" : "none",
  };
}

function inputBase() {
  return {
    height: 48,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.05)",
    color: "rgba(255,255,255,.96)",
    padding: "0 14px",
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
  };
}

function overlineStyle(color = "rgba(255,255,255,.56)") {
  return {
    fontSize: 11,
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    fontWeight: 800,
    color,
  };
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
    const qty = Number(t.qty) || 0;
    const price = Number(t.price) || 0;
    const txnType = String(t.txn_type || "").toUpperCase();
    const notional = qty * price;
    const signed = txnType === "SELL" ? -notional : notional;
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
  const values = points.map((p) => Number(p.value) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = padX + (index * (width - padX * 2)) / Math.max(1, points.length - 1);
      const y =
        height - padY - ((Number(point.value) || 0) - min) * ((height - padY * 2) / range);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function pointCoords(points, width, height, padX, padY) {
  const values = points.map((p) => Number(p.value) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return points.map((point, index) => {
    const x = padX + (index * (width - padX * 2)) / Math.max(1, points.length - 1);
    const y =
      height - padY - ((Number(point.value) || 0) - min) * ((height - padY * 2) / range);

    return { ...point, x, y };
  });
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

      const { data: assetRows, error: assetError } = await supabase
        .from("investment_assets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const { data: txnRows, error: txnError } = await supabase
        .from("investment_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("txn_date", { ascending: false });

      const { data: favoriteRows, error: favoriteError } = await supabase
        .from("investment_favorites")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (assetError || txnError || favoriteError) {
        console.error(assetError || txnError || favoriteError);
        setError("Failed loading investment data.");
        setLoading(false);
        return;
      }

      setAssets(assetRows || []);
      setTxns(txnRows || []);
      setFavorites(favoriteRows || []);
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

        if (batchRes.ok && batchData?.prices && typeof batchData.prices === "object") {
          for (const sym of Object.keys(batchData.prices)) {
            const raw = batchData.prices[sym];
            nextPrices[sym] = raw && typeof raw === "object" ? Number(raw.price) : Number(raw);
          }
        }
      } catch (err) {
        console.error("batch price fetch failed", err);
      }

      const missing = symbolsToLoad.filter((sym) => {
        const n = Number(nextPrices[sym]);
        return !Number.isFinite(n) || n <= 0;
      });

      await Promise.all(
        missing.map(async (sym) => {
          try {
            const res = await fetch(`/api/prices?symbol=${encodeURIComponent(sym)}`, {
              cache: "no-store",
            });
            const data = await res.json();

            if (res.ok && Number.isFinite(Number(data?.price)) && Number(data.price) > 0) {
              nextPrices[sym] = Number(data.price);
            }
          } catch (err) {
            console.error("single price fetch failed", sym, err);
          }
        })
      );

      setPrices(nextPrices);
    }

    loadPrices();
  }, [assets, favorites]);

  async function addAsset() {
    setStatus("");
    setError("");

    const cleanSymbol = String(symbol || "").toUpperCase().trim();

    if (!cleanSymbol) {
      setError("Enter a symbol first.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in.");
      return;
    }

    if (assets.some((a) => String(a.symbol || "").toUpperCase().trim() === cleanSymbol)) {
      setError(`${cleanSymbol} already exists.`);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("investment_assets")
      .insert({
        user_id: user.id,
        symbol: cleanSymbol,
        asset_type: "stock",
        account: "Main",
      })
      .select()
      .single();

    if (insertError) {
      console.error(insertError);
      setError("Could not add asset.");
      return;
    }

    setAssets((prev) => [data, ...prev]);
    setSymbol("");
    setStatus(`${cleanSymbol} added.`);
  }

  async function addTrade() {
    setStatus("");
    setError("");

    const qtyNum = Number(tradeQty);
    const priceNum = Number(tradePrice);

    if (!tradeAssetId) {
      setError("Choose a holding first.");
      return;
    }

    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }

    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError("Price must be greater than 0.");
      return;
    }

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
        txn_date: tradeDate,
        qty: qtyNum,
        price: priceNum,
      })
      .select()
      .single();

    if (insertError) {
      console.error(insertError);
      setError("Could not add trade.");
      return;
    }

    setTxns((prev) => [data, ...prev]);
    setTradeQty("");
    setTradePrice("");
    setStatus(`${tradeType} trade added.`);
  }

  async function addFavoriteFromHolding(holding) {
    setStatus("");
    setError("");

    const cleanSymbol = String(holding.symbol || "").toUpperCase().trim();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in.");
      return;
    }

    if (favorites.some((f) => String(f.symbol || "").toUpperCase().trim() === cleanSymbol)) {
      setError(`${cleanSymbol} is already favorited.`);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("investment_favorites")
      .insert({
        user_id: user.id,
        symbol: cleanSymbol,
        name: cleanSymbol,
        asset_type: holding.asset_type || "stock",
      })
      .select()
      .single();

    if (insertError) {
      console.error(insertError);
      setError("Could not add favorite.");
      return;
    }

    setFavorites((prev) => [data, ...prev]);
    setStatus(`${cleanSymbol} added to favorites.`);
  }

  const portfolio = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;
    let totalRealizedPnl = 0;

    const holdings = assets.map((asset) => {
      const ledger = txns
        .filter((t) => t.asset_id === asset.id)
        .sort((a, b) => {
          const ad = new Date(a.txn_date || 0).getTime();
          const bd = new Date(b.txn_date || 0).getTime();
          return ad - bd;
        });

      let shares = 0;
      let remainingBasis = 0;
      let realizedPnl = 0;

      for (const t of ledger) {
        const qty = Number(t.qty) || 0;
        const price = Number(t.price) || 0;
        const txnType = String(t.txn_type || "").toUpperCase();

        if (qty <= 0 || price < 0) continue;

        if (txnType === "BUY") {
          shares += qty;
          remainingBasis += qty * price;
          continue;
        }

        if (txnType === "SELL") {
          if (shares <= 0) continue;

          const sellQty = Math.min(qty, shares);
          const avgCost = shares > 0 ? remainingBasis / shares : 0;
          const removedBasis = sellQty * avgCost;

          realizedPnl += sellQty * price - removedBasis;
          shares -= sellQty;
          remainingBasis -= removedBasis;

          if (shares <= 0 || remainingBasis < 0.000001) {
            shares = 0;
            remainingBasis = 0;
          }
        }
      }

      const symbolKey = String(asset.symbol || "").toUpperCase().trim();
      const livePrice = Number(prices[symbolKey]);
      const hasLivePrice = Number.isFinite(livePrice) && livePrice > 0;
      const value = hasLivePrice ? shares * livePrice : null;
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

    const sorted = [...holdings].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

    return {
      holdings: sorted,
      totalValue,
      totalCost,
      totalRealizedPnl,
      totalPnl: totalValue - totalCost,
    };
  }, [assets, txns, prices]);

  const openPositions = portfolio.holdings.filter((h) => Number(h.shares) > 0);
  const alerts = openPositions.filter((h) => !h.hasLivePrice || Number(h.pnl) < 0);
  const heroTone = toneByValue(portfolio.totalPnl);

  const flowPoints = useMemo(() => buildFlowPoints(txns), [txns]);
  const chartWidth = 960;
  const chartHeight = 360;
  const chartPadX = 34;
  const chartPadY = 36;
  const path = buildPath(flowPoints, chartWidth, chartHeight, chartPadX, chartPadY);
  const coords = pointCoords(flowPoints, chartWidth, chartHeight, chartPadX, chartPadY);

  const recentTxns = [...txns]
    .sort((a, b) => {
      const ad = new Date(a.txn_date || 0).getTime();
      const bd = new Date(b.txn_date || 0).getTime();
      return bd - ad;
    })
    .slice(0, 6);

  return (
    <main style={pageShell()}>
      <style jsx>{`
        input::placeholder {
          color: rgba(255, 255, 255, 0.42);
        }
        select option {
          color: #111827;
        }
      `}</style>

      <section style={heroRail()}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 18,
            alignItems: "start",
          }}
        >
          <div>
            <div style={overlineStyle("rgba(190,255,223,.84)")}>Live Investments Board</div>

            <h1
              style={{
                margin: "10px 0 0",
                fontFamily: DISPLAY_FONT,
                fontSize: "clamp(2.8rem, 6vw, 5.2rem)",
                lineHeight: 0.94,
                letterSpacing: "-0.06em",
                fontWeight: 700,
                color: "rgba(255,255,255,.98)",
              }}
            >
              Investments Command
            </h1>

            <div
              style={{
                marginTop: 14,
                fontSize: 15,
                lineHeight: 1.7,
                color: "rgba(255,255,255,.76)",
                maxWidth: 760,
              }}
            >
              Track real position value, remaining basis, recent trade flow, and portfolio pressure
              without burying the space background.
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                color: alerts.length ? "#ffbdd0" : "#cffff0",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: alerts.length ? "#ff8aae" : "#adf3d0",
                  boxShadow: alerts.length
                    ? "0 0 16px rgba(255,138,174,.55)"
                    : "0 0 16px rgba(173,243,208,.48)",
                }}
              />
              {alerts.length
                ? `${alerts.length} holding${alerts.length === 1 ? "" : "s"} need review now.`
                : "No immediate investment alerts."}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <span style={pill(false)}>{monthLabel()}</span>
            <Link href="/investments" style={pill(true)}>
              Overview
            </Link>
            <Link href="/investments/discover" style={pill(false)}>
              Discover
            </Link>
          </div>
        </div>
      </section>

      {(status || error) && (
        <section
          style={{
            ...glass(error ? "bad" : "good", 22),
            padding: "12px 16px",
            marginTop: 14,
          }}
        >
          <div
            style={{
              fontWeight: 800,
              color: error ? "#ffcade" : "#dffff1",
            }}
          >
            {error || status}
          </div>
        </section>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
          marginTop: 14,
        }}
      >
        <TopCard
          title="Portfolio Value"
          value={money(portfolio.totalValue)}
          sub={`${money(portfolio.totalPnl)} vs remaining basis`}
          tone={heroTone}
        />
        <TopCard
          title="Open Positions"
          value={String(openPositions.length)}
          sub={`${money(portfolio.totalCost)} remaining basis`}
          chip={`${favorites.length} favorites`}
          tone="neutral"
        />
        <TopCard
          title="Alerts"
          value={alerts.length ? "Review" : "Clear"}
          sub={alerts.length ? `${alerts.length} active signals` : "No urgent pressure"}
          chip={alerts.length ? `${alerts.length} active` : "stable"}
          tone={alerts.length ? "bad" : "good"}
        />
      </section>

      <section
        style={{
          ...glass("neutral", 32),
          padding: 18,
          marginTop: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "start",
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 24,
                fontWeight: 700,
                color: "rgba(255,255,255,.96)",
              }}
            >
              Position Flow
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 13,
                color: "rgba(255,255,255,.62)",
              }}
            >
              Cumulative trade notional from recorded buys and sells.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={pill(false)}>1W</span>
            <span style={pill(true)}>1M</span>
            <span style={pill(false)}>YTD</span>
            <span style={pill(false)}>All</span>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            height: 370,
            borderRadius: 26,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,.06)",
            background: `
              linear-gradient(180deg, rgba(255,255,255,.035) 0%, rgba(255,255,255,.01) 100%),
              radial-gradient(circle at top center, rgba(255,255,255,.06) 0%, rgba(255,255,255,0) 38%)
            `,
          }}
        >
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            style={{ width: "100%", height: "100%" }}
            preserveAspectRatio="none"
          >
            {[0.25, 0.5, 0.75].map((line, idx) => (
              <line
                key={idx}
                x1="0"
                x2={chartWidth}
                y1={chartHeight * line}
                y2={chartHeight * line}
                stroke="rgba(255,255,255,.06)"
                strokeDasharray="5 10"
              />
            ))}

            {coords.map((point, idx) => (
              <line
                key={idx}
                x1={point.x}
                x2={point.x}
                y1="0"
                y2={chartHeight}
                stroke="rgba(255,255,255,.035)"
              />
            ))}

            <path
              d={path}
              fill="none"
              stroke="rgba(255,255,255,.98)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#lineGlow)"
            />

            {coords.map((point, idx) => (
              <g key={idx}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="8"
                  fill="rgba(10,14,22,.92)"
                  stroke="rgba(255,255,255,.98)"
                  strokeWidth="3"
                />
                <circle cx={point.x} cy={point.y} r="3" fill="rgba(255,255,255,.98)" />
              </g>
            ))}

            <defs>
              <filter id="lineGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          </svg>

          {coords.map((point, idx) => (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: `calc(${(point.x / chartWidth) * 100}% - 18px)`,
                bottom: 12,
                fontSize: 12,
                color: "rgba(255,255,255,.62)",
                fontWeight: 700,
              }}
            >
              {point.label}
            </div>
          ))}

          <div
            style={{
              position: "absolute",
              right: 18,
              top: 110,
              ...glass(
                (flowPoints[flowPoints.length - 1]?.value || 0) >= 0 ? "good" : "bad",
                18
              ),
              padding: "10px 16px",
            }}
          >
            <div
              style={{
                fontWeight: 900,
                fontSize: 16,
                color:
                  (flowPoints[flowPoints.length - 1]?.value || 0) >= 0 ? "#9df4cb" : "#ffb7cd",
              }}
            >
              {money(flowPoints[flowPoints.length - 1]?.value || 0)}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 14,
          marginTop: 14,
        }}
      >
        <div style={{ ...glass("neutral", 30), padding: 18 }}>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 22,
              fontWeight: 700,
              color: "rgba(255,255,255,.96)",
            }}
          >
            Top Holdings
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,.62)" }}>
            Largest live positions sitting on the board right now.
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {portfolio.holdings.length ? (
              portfolio.holdings.slice(0, 6).map((h) => (
                <HoldingRow
                  key={h.id}
                  holding={h}
                  isFavorite={favorites.some(
                    (f) =>
                      String(f.symbol || "").toUpperCase() === String(h.symbol || "").toUpperCase()
                  )}
                  onFavorite={() => addFavoriteFromHolding(h)}
                />
              ))
            ) : (
              <EmptyState
                title="No holdings yet"
                sub="Add an asset below or use Discover to start the portfolio."
              />
            )}
          </div>
        </div>

        <div style={{ ...glass("neutral", 30), padding: 18 }}>
          <div
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 22,
              fontWeight: 700,
              color: "rgba(255,255,255,.96)",
            }}
          >
            Recent Movement
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,.62)" }}>
            Latest activity across your investment ledger.
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {recentTxns.length ? (
              recentTxns.map((txn) => {
                const holding = assets.find((a) => a.id === txn.asset_id);
                const txnType = String(txn.txn_type || "").toUpperCase();

                return (
                  <RecentTxnRow
                    key={txn.id}
                    symbol={holding?.symbol || "—"}
                    txnType={txnType}
                    qty={txn.qty}
                    price={txn.price}
                    date={txn.txn_date}
                  />
                );
              })
            ) : (
              <EmptyState
                title="No trade activity yet"
                sub="Record a buy or sell below and the board will populate."
              />
            )}
          </div>
        </div>
      </section>

      <section
        style={{
          ...glass("neutral", 32),
          padding: 18,
          marginTop: 14,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 16,
            alignItems: "end",
            marginBottom: 16,
          }}
        >
          <div>
            <div style={overlineStyle()}>Quick Entry</div>
            <div
              style={{
                marginTop: 6,
                fontFamily: DISPLAY_FONT,
                fontSize: 22,
                fontWeight: 700,
                color: "rgba(255,255,255,.96)",
              }}
            >
              Add Assets and Trades
            </div>
          </div>

          <Link href="/investments/discover" style={actionBtn(false)}>
            Open Discover
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 14,
          }}
        >
          <div style={{ ...glass("neutral", 22), padding: 14 }}>
            <div style={overlineStyle("rgba(255,255,255,.46)")}>Add Holding</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                marginTop: 12,
              }}
            >
              <input
                style={inputBase()}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="VOO, QQQ, NVDA"
              />
              <button style={actionBtn(true)} onClick={addAsset}>
                Add
              </button>
            </div>
          </div>

          <div style={{ ...glass("neutral", 22), padding: 14 }}>
            <div style={overlineStyle("rgba(255,255,255,.46)")}>Log Trade</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                gap: 10,
                marginTop: 12,
              }}
            >
              <select
                style={{ ...inputBase(), gridColumn: "span 2" }}
                value={tradeAssetId}
                onChange={(e) => setTradeAssetId(e.target.value)}
              >
                <option value="">Select holding</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {String(a.symbol || "").toUpperCase()}
                  </option>
                ))}
              </select>

              <select style={inputBase()} value={tradeType} onChange={(e) => setTradeType(e.target.value)}>
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>

              <input
                style={inputBase()}
                type="number"
                step="0.0001"
                placeholder="Qty"
                value={tradeQty}
                onChange={(e) => setTradeQty(e.target.value)}
              />

              <input
                style={inputBase()}
                type="number"
                step="0.01"
                placeholder="Price"
                value={tradePrice}
                onChange={(e) => setTradePrice(e.target.value)}
              />

              <input
                style={inputBase()}
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <button style={actionBtn(true)} onClick={addTrade}>
                Save Trade
              </button>
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <div style={{ marginTop: 14 }}>
          <EmptyState title="Loading investments..." sub="Pulling holdings, trades, and favorites." />
        </div>
      )}
    </main>
  );
}

function TopCard({ title, value, sub, chip, tone = "neutral" }) {
  const t = toneVars(tone);

  return (
    <div
      style={{
        ...glass(tone, 30),
        padding: 18,
        minHeight: 162,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "start",
        }}
      >
        <div style={overlineStyle("rgba(255,255,255,.46)")}>{title}</div>
        {chip ? (
          <span
            style={{
              height: 28,
              padding: "0 10px",
              borderRadius: 999,
              border: `1px solid ${t.border}`,
              background: "rgba(255,255,255,.04)",
              display: "inline-flex",
              alignItems: "center",
              color: t.accent,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {chip}
          </span>
        ) : (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "rgba(255,255,255,.9)",
              boxShadow: "0 0 12px rgba(255,255,255,.24)",
              marginTop: 6,
            }}
          />
        )}
      </div>

      <div
        style={{
          marginTop: 14,
          fontFamily: DISPLAY_FONT,
          fontSize: "clamp(2rem, 4vw, 3.4rem)",
          lineHeight: 0.96,
          fontWeight: 700,
          letterSpacing: "-0.05em",
          color: tone === "bad" ? "#ffbdd0" : "rgba(255,255,255,.98)",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 16,
          fontSize: 14,
          lineHeight: 1.55,
          color: tone === "bad" ? "#ffd5e2" : "rgba(255,255,255,.68)",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function HoldingRow({ holding, isFavorite, onFavorite }) {
  const tone = holding.hasLivePrice ? toneByValue(holding.pnl) : "neutral";

  return (
    <div
      style={{
        ...glass(tone, 22),
        padding: 14,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.2fr) repeat(3, minmax(0,.8fr)) auto auto",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, color: "rgba(255,255,255,.96)" }}>
            {String(holding.symbol || "").toUpperCase()}
          </div>
          <div style={{ fontSize: 12, marginTop: 4, color: "rgba(255,255,255,.58)" }}>
            {holding.account || "Main"} • {holding.asset_type || "stock"} • {holding.txCount} trade
            {holding.txCount === 1 ? "" : "s"}
          </div>
        </div>

        <MiniStat label="Shares" value={fmtNumber(holding.shares)} />
        <MiniStat label="Value" value={holding.hasLivePrice ? money(holding.value) : "Pending"} />
        <MiniStat
          label="P/L"
          tone={tone}
          value={
            holding.hasLivePrice
              ? `${money(holding.pnl)}${holding.pnlPct != null ? ` • ${pct(holding.pnlPct)}` : ""}`
              : "Pending"
          }
        />

        <button style={actionBtn(false)} onClick={onFavorite}>
          {isFavorite ? "Favorited" : "Favorite"}
        </button>

        <Link href={`/investments/${holding.id}`} style={actionBtn(true)}>
          View
        </Link>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone = "neutral" }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,.42)",
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 14,
          fontWeight: 800,
          color:
            tone === "good"
              ? "#9df4cb"
              : tone === "bad"
                ? "#ffbdd0"
                : "rgba(255,255,255,.92)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function RecentTxnRow({ symbol, txnType, qty, price, date }) {
  const tone = txnType === "SELL" ? "bad" : "good";

  return (
    <div
      style={{
        ...glass(tone, 22),
        padding: 14,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div
          style={{
            height: 28,
            padding: "0 10px",
            borderRadius: 999,
            border: `1px solid ${toneVars(tone).border}`,
            background: "rgba(255,255,255,.04)",
            color: tone === "bad" ? "#ffbdd0" : "#9df4cb",
            display: "inline-flex",
            alignItems: "center",
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {txnType}
        </div>

        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "rgba(255,255,255,.94)" }}>
            {symbol} • {fmtNumber(qty)} @ {money(price)}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,.56)" }}>
            Notional {money((Number(qty) || 0) * (Number(price) || 0))}
          </div>
        </div>

        <div style={{ fontSize: 12, color: "rgba(255,255,255,.56)", fontWeight: 700 }}>
          {shortDate(date)}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, sub }) {
  return (
    <div
      style={{
        ...glass("neutral", 22),
        padding: 18,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 16, color: "rgba(255,255,255,.94)" }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,.62)" }}>
        {sub}
      </div>
    </div>
  );
}