"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fmtNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function compactNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(num);
}

function toneByValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "neutral";
  return n > 0 ? "good" : "bad";
}

function glowPanelStyle(tone = "neutral", strong = false) {
  if (tone === "good") {
    return {
      border: "1px solid rgba(34,197,94,.18)",
      background:
        "linear-gradient(180deg, rgba(34,197,94,.12) 0%, rgba(255,255,255,.03) 100%)",
      boxShadow: strong
        ? "0 0 26px rgba(34,197,94,.12), inset 0 0 0 1px rgba(34,197,94,.06)"
        : "0 0 18px rgba(34,197,94,.08)",
    };
  }

  if (tone === "bad") {
    return {
      border: "1px solid rgba(239,68,68,.18)",
      background:
        "linear-gradient(180deg, rgba(239,68,68,.12) 0%, rgba(255,255,255,.03) 100%)",
      boxShadow: strong
        ? "0 0 26px rgba(239,68,68,.12), inset 0 0 0 1px rgba(239,68,68,.06)"
        : "0 0 18px rgba(239,68,68,.08)",
    };
  }

  return {
    border: "1px solid rgba(255,255,255,.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.025) 100%)",
    boxShadow: strong ? "0 0 18px rgba(96,165,250,.08)" : "none",
  };
}

export default function InvestmentsPage() {
  const [assets, setAssets] = useState([]);
  const [txns, setTxns] = useState([]);
  const [prices, setPrices] = useState({});
  const [favorites, setFavorites] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [symbol, setSymbol] = useState("");
  const [txnAsset, setTxnAsset] = useState("");
  const [txnQty, setTxnQty] = useState("");
  const [txnPrice, setTxnPrice] = useState("");

  useEffect(() => {
    async function load() {
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

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
        setError("Failed loading investments data.");
        return;
      }

      setAssets(assetRows || []);
      setTxns(txnRows || []);
      setFavorites(favoriteRows || []);
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

      setLoadingPrices(true);
      const nextPrices = {};

      for (const sym of symbolsToLoad) {
        try {
          const res = await fetch(`/api/prices?symbol=${encodeURIComponent(sym)}`);
          const data = await res.json();

          if (res.ok && Number.isFinite(Number(data?.price)) && Number(data.price) > 0) {
            nextPrices[sym] = Number(data.price);
          }
        } catch (err) {
          console.error("price fetch failed for", sym, err);
        }
      }

      setPrices(nextPrices);
      setLoadingPrices(false);
    }

    loadPrices();
  }, [assets, favorites]);

  async function addAsset() {
    setError("");
    setStatus("");

    const cleanSymbol = symbol.toUpperCase().trim();

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

    const alreadyExists = assets.some(
      (a) => (a.symbol || "").toUpperCase() === cleanSymbol
    );

    if (alreadyExists) {
      setError("That asset already exists.");
      return;
    }

    const { data, error } = await supabase
      .from("investment_assets")
      .insert({
        user_id: user.id,
        asset_type: "stock",
        symbol: cleanSymbol,
        account: "Main",
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setError("Could not add asset.");
      return;
    }

    setAssets((prev) => [data, ...prev]);
    setSymbol("");
    setStatus("Asset added.");
  }

  async function addTrade() {
    setError("");
    setStatus("");

    if (!txnAsset || !txnQty || !txnPrice) {
      setError("Pick an asset and enter quantity + price.");
      return;
    }

    const qtyNum = Number(txnQty);
    const priceNum = Number(txnPrice);

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

    const { data, error } = await supabase
      .from("investment_transactions")
      .insert({
        user_id: user.id,
        asset_id: txnAsset,
        txn_type: "BUY",
        txn_date: new Date().toISOString().slice(0, 10),
        qty: qtyNum,
        price: priceNum,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setError("Could not add trade.");
      return;
    }

    setTxns((prev) => [data, ...prev]);
    setTxnQty("");
    setTxnPrice("");
    setStatus("Trade added.");
  }

  async function addFavoriteFromHolding(holding) {
    setError("");
    setStatus("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in.");
      return;
    }

    const cleanSymbol = String(holding.symbol || "").toUpperCase().trim();
    if (!cleanSymbol) {
      setError("Invalid symbol.");
      return;
    }

    const alreadyExists = favorites.some(
      (f) => String(f.symbol || "").toUpperCase() === cleanSymbol
    );

    if (alreadyExists) {
      setError(`${cleanSymbol} is already in favorites.`);
      return;
    }

    const { data, error } = await supabase
      .from("investment_favorites")
      .insert({
        user_id: user.id,
        symbol: cleanSymbol,
        name: holding.name || holding.symbol || cleanSymbol,
        asset_type: holding.asset_type || "stock",
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      setError("Could not add favorite.");
      return;
    }

    setFavorites((prev) => [data, ...prev]);
    setStatus(`${cleanSymbol} added to favorites.`);
  }

  async function removeFavorite(id) {
    setError("");
    setStatus("");

    const { error } = await supabase
      .from("investment_favorites")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setError("Could not remove favorite.");
      return;
    }

    setFavorites((prev) => prev.filter((f) => f.id !== id));
    setStatus("Favorite removed.");
  }

  const portfolio = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;
    let totalRealizedPnl = 0;

    const holdings = assets.map((a) => {
      const list = txns
        .filter((t) => t.asset_id === a.id)
        .sort((x, y) => {
          const xd = new Date(x.txn_date || 0).getTime();
          const yd = new Date(y.txn_date || 0).getTime();
          return xd - yd;
        });

      let shares = 0;
      let cost = 0;
      let realizedPnl = 0;

      for (const t of list) {
        const qty = Number(t.qty) || 0;
        const price = Number(t.price) || 0;
        const txnType = String(t.txn_type || "").toUpperCase();

        if (qty <= 0 || price < 0) continue;

        if (txnType === "BUY") {
          shares += qty;
          cost += qty * price;
          continue;
        }

        if (txnType === "SELL") {
          if (shares <= 0) continue;

          const sellQty = Math.min(qty, shares);
          const avgCostPerShare = shares > 0 ? cost / shares : 0;
          const removedCost = sellQty * avgCostPerShare;

          realizedPnl += sellQty * price - removedCost;
          shares -= sellQty;
          cost -= removedCost;

          if (shares <= 0 || cost < 0.000001) {
            shares = 0;
            cost = 0;
          }

          continue;
        }
      }

      const symbolKey = String(a.symbol || "").toUpperCase().trim();
      const livePrice = Number(prices[symbolKey]);
      const hasLivePrice = Number.isFinite(livePrice) && livePrice > 0;

      const value = hasLivePrice ? shares * livePrice : null;
      const pnl = hasLivePrice ? value - cost : null;
      const pnlPct =
        hasLivePrice && cost > 0 ? ((value - cost) / cost) * 100 : null;
      const avgCost = shares > 0 ? cost / shares : 0;

      if (hasLivePrice) totalValue += value;
      totalCost += cost;
      totalRealizedPnl += realizedPnl;

      return {
        ...a,
        shares,
        cost,
        value,
        pnl,
        pnlPct,
        avgCost,
        livePrice,
        hasLivePrice,
        txCount: list.length,
        realizedPnl,
      };
    });

    const sorted = [...holdings].sort((a, b) => {
      const aVal = Number(a.value) || 0;
      const bVal = Number(b.value) || 0;
      return bVal - aVal;
    });

    return {
      holdings: sorted,
      totalValue,
      totalCost,
      totalPnl: totalValue - totalCost,
      totalRealizedPnl,
      hasAnyLivePrices: sorted.some((h) => h.hasLivePrice),
    };
  }, [assets, txns, prices]);

  const livePricedHoldings = useMemo(() => {
    return portfolio.holdings.filter((h) => h.hasLivePrice && Number(h.shares) > 0);
  }, [portfolio.holdings]);

  const signals = useMemo(() => {
    const bestHolding =
      [...livePricedHoldings].sort(
        (a, b) => (Number(b.pnl) || 0) - (Number(a.pnl) || 0)
      )[0] || null;

    const worstHolding =
      [...livePricedHoldings].sort(
        (a, b) => (Number(a.pnl) || 0) - (Number(b.pnl) || 0)
      )[0] || null;

    const largestPosition =
      [...livePricedHoldings].sort(
        (a, b) => (Number(b.value) || 0) - (Number(a.value) || 0)
      )[0] || null;

    const liveCoverageCount = portfolio.holdings.filter((h) => h.hasLivePrice).length;
    const liveCoveragePct =
      portfolio.holdings.length > 0
        ? (liveCoverageCount / portfolio.holdings.length) * 100
        : 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTradeCount = txns.filter((t) => {
      if (!t?.txn_date) return false;
      const d = new Date(t.txn_date);
      return Number.isFinite(d.getTime()) && d >= thirtyDaysAgo;
    }).length;

    return {
      bestHolding,
      worstHolding,
      largestPosition,
      liveCoverageCount,
      liveCoveragePct,
      recentTradeCount,
      favoritesCount: favorites.length,
      totalHoldingsCount: portfolio.holdings.length,
      largestWeightPct:
        largestPosition && portfolio.totalValue > 0
          ? (Number(largestPosition.value) / Number(portfolio.totalValue)) * 100
          : null,
    };
  }, [livePricedHoldings, portfolio.holdings, portfolio.totalValue, txns, favorites.length]);

  const allocation = useMemo(() => {
    const total = portfolio.holdings.reduce((sum, h) => sum + (Number(h.value) || 0), 0);

    if (!Number.isFinite(total) || total <= 0) return [];

    return portfolio.holdings
      .filter((h) => Number(h.value) > 0)
      .map((h) => ({
        ...h,
        weight: (Number(h.value) / total) * 100,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);
  }, [portfolio.holdings]);

  const recentTxns = useMemo(() => {
    return [...txns].slice(0, 6);
  }, [txns]);

  const favoriteCards = useMemo(() => {
    return favorites.map((f) => {
      const sym = String(f.symbol || "").toUpperCase();
      const livePrice = Number(prices[sym]);
      const hasLivePrice = Number.isFinite(livePrice) && livePrice > 0;

      return {
        ...f,
        symbol: sym,
        livePrice,
        hasLivePrice,
      };
    });
  }, [favorites, prices]);

  const portfolioTone = portfolio.hasAnyLivePrices
    ? toneByValue(portfolio.totalPnl)
    : "neutral";

  return (
    <main
      style={{
        padding: "36px 28px 44px",
        maxWidth: "1320px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 16,
          alignItems: "end",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            className="muted"
            style={{
              fontSize: 12,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              marginBottom: 10,
            }}
          >
            Investments
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(2rem, 4vw, 3rem)",
              lineHeight: 1.04,
              fontWeight: 950,
            }}
          >
            Portfolio Command
          </h1>

          <div className="muted" style={{ marginTop: 10, fontSize: 15, maxWidth: 760 }}>
            Full account view first. Clean dashboard here. Deep trader chart lives on each asset screen.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href="/investments/discover" className="btnGhost">
            Discover
          </Link>

          <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>
            Overview
          </TabBtn>

          <TabBtn active={tab === "holdings"} onClick={() => setTab("holdings")}>
            Holdings
          </TabBtn>

          <TabBtn active={tab === "transactions"} onClick={() => setTab("transactions")}>
            Transactions
          </TabBtn>
        </div>
      </div>

      {(status || error) && (
        <div className="card" style={{ padding: 14, marginBottom: 18 }}>
          <div style={{ fontWeight: 900 }}>{error ? "Fix this" : "Status"}</div>
          <div className="muted" style={{ marginTop: 6 }}>{error || status}</div>
        </div>
      )}

      {tab === "overview" && (
        <>
          <div
            className="card"
            style={{
              padding: 20,
              marginBottom: 18,
              borderRadius: 26,
              background:
                portfolioTone === "good"
                  ? "linear-gradient(180deg, rgba(34,197,94,.10), rgba(255,255,255,.02))"
                  : portfolioTone === "bad"
                    ? "linear-gradient(180deg, rgba(239,68,68,.10), rgba(255,255,255,.02))"
                    : "linear-gradient(180deg, rgba(96,165,250,.10), rgba(255,255,255,.02))",
              border:
                portfolioTone === "good"
                  ? "1px solid rgba(34,197,94,.16)"
                  : portfolioTone === "bad"
                    ? "1px solid rgba(239,68,68,.16)"
                    : "1px solid rgba(255,255,255,.08)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.15fr .85fr",
                gap: 18,
                alignItems: "center",
              }}
            >
              <div>
                <div
                  className="muted"
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                  }}
                >
                  Portfolio Pulse
                </div>

                <div style={{ marginTop: 10, fontSize: "clamp(2rem, 4vw, 3.1rem)", fontWeight: 950 }}>
                  {portfolio.hasAnyLivePrices ? money(portfolio.totalValue) : "Waiting on live data"}
                </div>

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 16,
                    fontWeight: 850,
                    color:
                      portfolioTone === "good"
                        ? "#4ade80"
                        : portfolioTone === "bad"
                          ? "#f87171"
                          : "rgba(255,255,255,.85)",
                  }}
                >
                  {portfolio.hasAnyLivePrices
                    ? `${portfolio.totalPnl >= 0 ? "+" : ""}${money(portfolio.totalPnl)} vs remaining cost basis`
                    : loadingPrices
                      ? "Checking live market prices..."
                      : "Live pricing returns when quote fetch succeeds."}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <PulseMiniCard
                  label="Holdings"
                  value={String(portfolio.holdings.length)}
                  sub="Tracked positions"
                />
                <PulseMiniCard
                  label="Favorites"
                  value={String(favoriteCards.length)}
                  sub="Pinned symbols"
                />
                <PulseMiniCard
                  label="Trades"
                  value={String(txns.length)}
                  sub="Recorded transactions"
                />
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 16,
              marginBottom: 18,
            }}
          >
            <MetricCard
              title="Tracked Value"
              value={portfolio.hasAnyLivePrices ? money(portfolio.totalValue) : "Price unavailable"}
              sub={loadingPrices ? "Checking live prices..." : "Live values show when pricing returns."}
              tone="neutral"
              strong
            />

            <MetricCard
              title="Remaining Cost Basis"
              value={money(portfolio.totalCost)}
              sub="Active basis after accounting for sells."
              tone="neutral"
              strong
            />

            <MetricCard
              title="Unrealized P/L"
              value={portfolio.hasAnyLivePrices ? money(portfolio.totalPnl) : "Pending live data"}
              sub={
                portfolio.hasAnyLivePrices
                  ? portfolio.totalPnl >= 0
                    ? "Portfolio above remaining basis."
                    : "Portfolio below remaining basis."
                  : "P/L shows once live prices are available."
              }
              tone={portfolioTone}
              valueTone={portfolioTone}
              strong
            />

            <MetricCard
              title="Realized P/L"
              value={money(portfolio.totalRealizedPnl)}
              sub="Closed gain/loss from recorded sells."
              tone={toneByValue(portfolio.totalRealizedPnl)}
              valueTone={toneByValue(portfolio.totalRealizedPnl)}
              strong
            />
          </div>

          <div className="card" style={{ padding: 18, marginBottom: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 22 }}>Portfolio Signals</div>
            <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
              Live portfolio intelligence. No fake history. Just what is true right now.
            </div>

            <div style={{ height: 16 }} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <SignalCard
                label="Best Holding"
                title={signals.bestHolding?.symbol || "None"}
                value={
                  signals.bestHolding?.hasLivePrice
                    ? money(signals.bestHolding.pnl)
                    : "No live data"
                }
                secondary={
                  signals.bestHolding?.pnlPct != null
                    ? `${signals.bestHolding.pnlPct >= 0 ? "+" : ""}${signals.bestHolding.pnlPct.toFixed(2)}%`
                    : null
                }
                sub={
                  signals.bestHolding?.hasLivePrice
                    ? `${fmtNumber(signals.bestHolding.shares)} shares • ${money(
                        signals.bestHolding.value
                      )} value`
                    : "Shows top unrealized winner."
                }
                tone={signals.bestHolding ? "good" : "neutral"}
              />

              <SignalCard
                label="Worst Holding"
                title={signals.worstHolding?.symbol || "None"}
                value={
                  signals.worstHolding?.hasLivePrice
                    ? money(signals.worstHolding.pnl)
                    : "No live data"
                }
                secondary={
                  signals.worstHolding?.pnlPct != null
                    ? `${signals.worstHolding.pnlPct >= 0 ? "+" : ""}${signals.worstHolding.pnlPct.toFixed(2)}%`
                    : null
                }
                sub={
                  signals.worstHolding?.hasLivePrice
                    ? `${fmtNumber(signals.worstHolding.shares)} shares • ${money(
                        signals.worstHolding.value
                      )} value`
                    : "Shows biggest unrealized drag."
                }
                tone={signals.worstHolding ? "bad" : "neutral"}
              />

              <SignalCard
                label="Largest Position"
                title={signals.largestPosition?.symbol || "None"}
                value={
                  signals.largestPosition?.hasLivePrice
                    ? money(signals.largestPosition.value)
                    : "No live data"
                }
                secondary={
                  signals.largestWeightPct != null
                    ? `${signals.largestWeightPct.toFixed(1)}% of portfolio`
                    : null
                }
                sub={
                  signals.largestPosition?.hasLivePrice
                    ? `${fmtNumber(signals.largestPosition.shares)} shares at ${money(
                        signals.largestPosition.livePrice
                      )}`
                    : "Largest live-priced position."
                }
                tone="neutral"
              />

              <SignalCard
                label="Live Price Coverage"
                title={`${signals.liveCoverageCount}/${signals.totalHoldingsCount}`}
                value={
                  signals.totalHoldingsCount
                    ? `${signals.liveCoveragePct.toFixed(0)}%`
                    : "0%"
                }
                sub={
                  loadingPrices
                    ? "Checking quote coverage now."
                    : "How much of the portfolio has live prices."
                }
                tone="neutral"
              />

              <SignalCard
                label="Favorites Count"
                title={String(signals.favoritesCount)}
                value={signals.favoritesCount ? "Active" : "Empty"}
                sub="Pinned symbols in your watch section."
                tone="neutral"
              />

              <SignalCard
                label="Recent Trade Count"
                title={String(signals.recentTradeCount)}
                value="Last 30 days"
                sub="How active the account has been lately."
                tone="neutral"
              />
            </div>
          </div>

          <div className="card" style={{ padding: 18, marginBottom: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontWeight: 950, fontSize: 22 }}>Favorites</div>
                <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
                  Quick-access symbols you want to keep close.
                </div>
              </div>
            </div>

            <div style={{ height: 16 }} />

            {favoriteCards.length ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                {favoriteCards.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      borderRadius: 20,
                      padding: 16,
                      ...glowPanelStyle("neutral", true),
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 950, fontSize: 18 }}>{f.symbol}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {f.asset_type || "stock"}
                        </div>
                      </div>

                      <button
                        className="btnGhost"
                        onClick={() => removeFavorite(f.id)}
                        style={{ minWidth: 82 }}
                      >
                        Remove
                      </button>
                    </div>

                    <div style={{ marginTop: 12, fontWeight: 800, minHeight: 22 }}>
                      {f.name || f.symbol}
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <div className="muted" style={{ fontSize: 12 }}>Live Price</div>
                      <div style={{ marginTop: 4, fontWeight: 950, fontSize: 22 }}>
                        {f.hasLivePrice ? money(f.livePrice) : "Pending"}
                      </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <Link href={`/market/${encodeURIComponent(f.symbol)}`} className="btn">
                        Open Market
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No favorites yet"
                sub="You can add favorites from Discover later or from your holdings list."
              />
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr .8fr",
              gap: 18,
              marginBottom: 18,
            }}
          >
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 950, fontSize: 22 }}>Top Holdings</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
                Clean account summary. Open an asset only when you want chart detail.
              </div>

              <div style={{ height: 16 }} />

              {!portfolio.holdings.length ? (
                <EmptyState
                  title="No investments yet"
                  sub="Add your first asset, then log a trade to start building your portfolio."
                />
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {portfolio.holdings.slice(0, 8).map((h) => {
                    const isFavorite = favorites.some(
                      (f) =>
                        String(f.symbol || "").toUpperCase() ===
                        String(h.symbol || "").toUpperCase()
                    );

                    return (
                      <div
                        key={h.id}
                        style={{
                          borderRadius: 20,
                          padding: 16,
                          ...glowPanelStyle(toneByValue(h.pnl), false),
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1.25fr .75fr .95fr .95fr auto auto",
                            gap: 12,
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 950, fontSize: 17 }}>{h.symbol}</div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>
                              {h.account || "Main"} • {h.asset_type || "stock"} • {h.txCount} trade
                              {h.txCount === 1 ? "" : "s"}
                            </div>
                          </div>

                          <HoldingMiniStat label="Shares" value={fmtNumber(h.shares)} />
                          <HoldingMiniStat
                            label="Value"
                            value={h.hasLivePrice ? money(h.value) : "Pending"}
                          />
                          <HoldingMiniStat
                            label="P/L"
                            value={
                              h.hasLivePrice
                                ? `${money(h.pnl)}${h.pnlPct != null ? ` • ${h.pnlPct >= 0 ? "+" : ""}${h.pnlPct.toFixed(2)}%` : ""}`
                                : "Pending"
                            }
                            tone={h.hasLivePrice ? toneByValue(h.pnl) : "neutral"}
                          />

                          <button
                            className="btnGhost"
                            onClick={() => addFavoriteFromHolding(h)}
                            style={{ minWidth: 98 }}
                          >
                            {isFavorite ? "Favorited" : "Favorite"}
                          </button>

                          <Link href={`/investments/${h.id}`} className="btn">
                            View Asset
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 950, fontSize: 22 }}>Allocation View</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
                Portfolio weights by live market value.
              </div>

              <div style={{ height: 16 }} />

              {allocation.length ? (
                <div style={{ display: "grid", gap: 14 }}>
                  {allocation.map((h) => (
                    <div key={h.id}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          marginBottom: 8,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>{h.symbol}</div>
                        <div className="muted" style={{ fontSize: 13 }}>
                          {h.weight.toFixed(1)}%
                        </div>
                      </div>

                      <div
                        style={{
                          height: 10,
                          borderRadius: 999,
                          background: "rgba(255,255,255,.06)",
                          overflow: "hidden",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.max(4, Math.min(100, h.weight))}%`,
                            height: "100%",
                            borderRadius: 999,
                            background:
                              "linear-gradient(90deg, rgba(96,165,250,.95), rgba(59,130,246,.55))",
                            boxShadow: "0 0 18px rgba(96,165,250,.20)",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          marginTop: 6,
                        }}
                      >
                        <div className="muted" style={{ fontSize: 12 }}>
                          {money(h.value)}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {compactNumber(h.shares)} shares
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No allocation yet"
                  sub="Allocation appears once live market values are available."
                />
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr .9fr",
              gap: 18,
            }}
          >
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 950, fontSize: 22 }}>Recent Activity</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
                Latest buys and sells across your portfolio.
              </div>

              <div style={{ height: 16 }} />

              {recentTxns.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {recentTxns.map((t) => {
                    const asset = assets.find((a) => a.id === t.asset_id);
                    const txnType = String(t.txn_type || "").toUpperCase();
                    const tone =
                      txnType === "BUY" ? "good" : txnType === "SELL" ? "bad" : "neutral";

                    return (
                      <div
                        key={t.id}
                        style={{
                          borderRadius: 18,
                          padding: 14,
                          ...glowPanelStyle(tone, false),
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontWeight: 900 }}>
                            {asset?.symbol || "—"} • {t.txn_type}
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {t.txn_date}
                          </div>
                        </div>

                        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                          {fmtNumber(t.qty)} shares at {money(t.price)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No recent activity"
                  sub="Your newest investment trades will show here."
                />
              )}
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 950, fontSize: 22 }}>What Actually Comes Next</div>
              <div className="muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
                The next real backend upgrade is daily portfolio snapshots. That is what unlocks honest performance charts.
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                <MiniPoint title="Daily snapshots" sub="Store total portfolio value once per day." />
                <MiniPoint title="Real performance cards" sub="1D / 1W / 1M / YTD based on stored history." />
                <MiniPoint title="Portfolio chart" sub="Actual account curve, not fake reconstructed history." />
                <MiniPoint title="Signal expansion" sub="Add % gainers, losers, and watchlist alerts after snapshots." />
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "holdings" && (
        <>
          <div className="card" style={{ padding: 18, marginBottom: 18 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 950, fontSize: 20 }}>Add Asset</div>

              <Link href="/investments/discover" className="btnGhost">
                Discover Stocks
              </Link>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                className="input"
                placeholder="Symbol (VOO, QQQ)"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                style={{ minWidth: 240 }}
              />
              <button className="btn" onClick={addAsset}>
                Add Asset
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.05fr .75fr .9fr .9fr .9fr .95fr 110px 120px",
                gap: 12,
                padding: "16px 18px",
                borderBottom: "1px solid rgba(255,255,255,.08)",
                fontWeight: 900,
                color: "rgba(255,255,255,.75)",
              }}
            >
              <div>Symbol</div>
              <div>Shares</div>
              <div>Cost Basis</div>
              <div>Avg Cost</div>
              <div>Live Price</div>
              <div>P/L</div>
              <div>Fav</div>
              <div>Action</div>
            </div>

            {portfolio.holdings.length ? (
              portfolio.holdings.map((h) => {
                const isFavorite = favorites.some(
                  (f) =>
                    String(f.symbol || "").toUpperCase() ===
                    String(h.symbol || "").toUpperCase()
                );

                return (
                  <div
                    key={h.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.05fr .75fr .9fr .9fr .9fr .95fr 110px 120px",
                      gap: 12,
                      padding: "16px 18px",
                      borderBottom: "1px solid rgba(255,255,255,.08)",
                      alignItems: "center",
                      background:
                        h.hasLivePrice && Number.isFinite(h.pnl)
                          ? h.pnl >= 0
                            ? "linear-gradient(90deg, rgba(34,197,94,.05), transparent 35%)"
                            : "linear-gradient(90deg, rgba(239,68,68,.05), transparent 35%)"
                          : "transparent",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900 }}>{h.symbol}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {h.account || "Main"}
                      </div>
                    </div>

                    <div>{fmtNumber(h.shares)}</div>
                    <div>{money(h.cost)}</div>
                    <div>{h.shares > 0 ? money(h.avgCost) : "—"}</div>
                    <div>{h.hasLivePrice ? money(h.livePrice) : "Unavailable"}</div>

                    <div
                      style={{
                        color: h.hasLivePrice ? (h.pnl >= 0 ? "#4ade80" : "#f87171") : "inherit",
                        fontWeight: 850,
                      }}
                    >
                      {h.hasLivePrice
                        ? `${money(h.pnl)}${h.pnlPct != null ? ` • ${h.pnlPct >= 0 ? "+" : ""}${h.pnlPct.toFixed(2)}%` : ""}`
                        : "Pending"}
                    </div>

                    <div>
                      <button className="btnGhost" onClick={() => addFavoriteFromHolding(h)}>
                        {isFavorite ? "Saved" : "Save"}
                      </button>
                    </div>

                    <div>
                      <Link href={`/investments/${h.id}`} className="btn">
                        View
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: 18 }}>
                <EmptyState
                  title="No holdings yet"
                  sub="Add an asset above or use Discover to find public market assets."
                />
              </div>
            )}
          </div>
        </>
      )}

      {tab === "transactions" && (
        <>
          <div className="card" style={{ padding: 18, marginBottom: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 20, marginBottom: 14 }}>Add Trade</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select
                className="input"
                value={txnAsset}
                onChange={(e) => setTxnAsset(e.target.value)}
                style={{ minWidth: 220 }}
              >
                <option value="">Select Asset</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.symbol}
                  </option>
                ))}
              </select>

              <input
                className="input"
                placeholder="Qty"
                value={txnQty}
                onChange={(e) => setTxnQty(e.target.value)}
                style={{ minWidth: 120 }}
              />

              <input
                className="input"
                placeholder="Price"
                value={txnPrice}
                onChange={(e) => setTxnPrice(e.target.value)}
                style={{ minWidth: 120 }}
              />

              <button className="btn" onClick={addTrade}>
                Add Trade
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr .9fr",
              gap: 18,
            }}
          >
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <TableHeader cols={["Type", "Asset", "Qty", "Price", "Date"]} />

              {txns.length ? (
                txns.map((t) => {
                  const asset = assets.find((a) => a.id === t.asset_id);
                  const txnType = String(t.txn_type || "").toUpperCase();

                  return (
                    <div
                      key={t.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
                        gap: 12,
                        padding: "16px 18px",
                        borderBottom: "1px solid rgba(255,255,255,.08)",
                        alignItems: "center",
                        background:
                          txnType === "BUY"
                            ? "linear-gradient(90deg, rgba(34,197,94,.05), transparent 32%)"
                            : txnType === "SELL"
                              ? "linear-gradient(90deg, rgba(239,68,68,.05), transparent 32%)"
                              : "transparent",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 850,
                          color:
                            txnType === "BUY"
                              ? "#4ade80"
                              : txnType === "SELL"
                                ? "#f87171"
                                : "inherit",
                        }}
                      >
                        {t.txn_type}
                      </div>
                      <div>{asset?.symbol || "—"}</div>
                      <div>{fmtNumber(t.qty)}</div>
                      <div>{money(t.price)}</div>
                      <div>{t.txn_date}</div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: 18 }}>
                  <EmptyState
                    title="No trades yet"
                    sub="Add your first transaction to build cost basis and position size."
                  />
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 950, fontSize: 20 }}>Recent Activity</div>
              <div className="muted" style={{ marginTop: 8, fontSize: 14 }}>
                Latest portfolio moves at a glance.
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                {recentTxns.length ? (
                  recentTxns.map((t) => {
                    const asset = assets.find((a) => a.id === t.asset_id);
                    const txnType = String(t.txn_type || "").toUpperCase();
                    const tone =
                      txnType === "BUY" ? "good" : txnType === "SELL" ? "bad" : "neutral";

                    return (
                      <div
                        key={t.id}
                        style={{
                          borderRadius: 18,
                          padding: 14,
                          ...glowPanelStyle(tone, false),
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontWeight: 900 }}>
                            {asset?.symbol || "—"} • {t.txn_type}
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {t.txn_date}
                          </div>
                        </div>

                        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                          {fmtNumber(t.qty)} shares at {money(t.price)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState
                    title="No recent activity"
                    sub="Your newest investment trades will show here."
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function TabBtn({ active, children, onClick }) {
  return (
    <button
      className={active ? "btn" : "btnGhost"}
      onClick={onClick}
      style={{
        minWidth: 110,
        boxShadow: active ? "0 0 18px rgba(96,165,250,.18)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function MetricCard({
  title,
  value,
  sub,
  valueTone = "default",
  tone = "neutral",
  strong = false,
}) {
  const toneColor =
    valueTone === "good"
      ? "#4ade80"
      : valueTone === "bad"
        ? "#f87171"
        : "inherit";

  return (
    <div
      style={{
        borderRadius: 22,
        padding: 18,
        ...glowPanelStyle(tone, strong),
      }}
    >
      <div
        className="muted"
        style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}
      >
        {title}
      </div>
      <div style={{ marginTop: 10, fontSize: 20, fontWeight: 950, color: toneColor }}>
        {value}
      </div>
      <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45 }}>
        {sub}
      </div>
    </div>
  );
}

function PulseMiniCard({ label, value, sub }) {
  return (
    <div
      style={{
        borderRadius: 18,
        padding: 14,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.035)",
      }}
    >
      <div
        className="muted"
        style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}
      >
        {label}
      </div>
      <div style={{ marginTop: 8, fontWeight: 950, fontSize: 22 }}>{value}</div>
      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{sub}</div>
    </div>
  );
}

function HoldingMiniStat({ label, value, tone = "neutral" }) {
  const color =
    tone === "good"
      ? "#4ade80"
      : tone === "bad"
        ? "#f87171"
        : "rgba(255,255,255,.92)";

  return (
    <div>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 850, marginTop: 4, color }}>{value}</div>
    </div>
  );
}

function SignalCard({ label, title, value, secondary = null, sub, tone = "neutral" }) {
  const valueColor =
    tone === "good"
      ? "#4ade80"
      : tone === "bad"
        ? "#f87171"
        : "rgba(255,255,255,.92)";

  return (
    <div
      style={{
        borderRadius: 20,
        padding: 16,
        ...glowPanelStyle(tone, true),
      }}
    >
      <div
        className="muted"
        style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}
      >
        {label}
      </div>

      <div style={{ marginTop: 10, fontSize: 18, fontWeight: 950 }}>
        {title}
      </div>

      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 950, color: valueColor }}>
        {value}
      </div>

      {secondary ? (
        <div className="muted" style={{ marginTop: 4, fontSize: 13, fontWeight: 700 }}>
          {secondary}
        </div>
      ) : null}

      <div className="muted" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45 }}>
        {sub}
      </div>
    </div>
  );
}

function TableHeader({ cols }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`,
        gap: 12,
        padding: "16px 18px",
        borderBottom: "1px solid rgba(255,255,255,.08)",
        fontWeight: 900,
        color: "rgba(255,255,255,.75)",
      }}
    >
      {cols.map((c) => (
        <div key={c}>{c}</div>
      ))}
    </div>
  );
}

function EmptyState({ title, sub }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px dashed rgba(255,255,255,.16)",
        padding: "24px 18px",
        background: "rgba(255,255,255,.02)",
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
      <div className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.45 }}>
        {sub}
      </div>
    </div>
  );
}

function MiniPoint({ title, sub }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.03)",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 850 }}>{title}</div>
      <div className="muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45 }}>
        {sub}
      </div>
    </div>
  );
}