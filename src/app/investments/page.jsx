"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
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

function tintVars(tone = "neutral") {
  if (tone === "good") {
    return {
      border: "rgba(16,185,129,.38)",
      glow: "rgba(16,185,129,.22)",
      top: "rgba(16,185,129,.13)",
      accent: "#86efac",
      soft: "#d1fae5",
    };
  }

  if (tone === "bad") {
    return {
      border: "rgba(244,63,94,.38)",
      glow: "rgba(244,63,94,.22)",
      top: "rgba(244,63,94,.13)",
      accent: "#fda4af",
      soft: "#ffe4e6",
    };
  }

  return {
    border: "rgba(96,165,250,.28)",
    glow: "rgba(96,165,250,.14)",
    top: "rgba(96,165,250,.08)",
    accent: "#e5efff",
    soft: "#f3f7ff",
  };
}

function pageSurface() {
  return {
    background: `
      radial-gradient(circle at top left, rgba(37,99,235,.10) 0%, rgba(0,0,0,0) 25%),
      radial-gradient(circle at top right, rgba(16,185,129,.05) 0%, rgba(0,0,0,0) 18%),
      linear-gradient(180deg, #05101a 0%, #081320 56%, #0a1724 100%)
    `,
  };
}

function heroPanel() {
  return {
    borderRadius: 32,
    border: "1px solid rgba(96,165,250,.18)",
    background: `
      radial-gradient(circle at top left, rgba(96,165,250,.10) 0%, rgba(255,255,255,0) 28%),
      linear-gradient(180deg, rgba(7,14,27,.98) 0%, rgba(6,11,22,.98) 100%)
    `,
    boxShadow:
      "0 24px 56px rgba(0,0,0,.30), 0 0 0 1px rgba(255,255,255,.025) inset",
    backdropFilter: "blur(10px)",
  };
}

function shellPanel(tone = "neutral", strong = false) {
  const t = tintVars(tone);

  return {
    borderRadius: 28,
    border: `1px solid ${strong ? "rgba(255,255,255,.12)" : t.border}`,
    background: `
      radial-gradient(circle at top left, ${t.top} 0%, rgba(255,255,255,0) 30%),
      linear-gradient(180deg, rgba(10,18,34,.97) 0%, rgba(7,13,25,.97) 100%)
    `,
    boxShadow: strong
      ? `0 18px 42px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.025) inset, 0 0 18px ${t.glow}`
      : `0 14px 28px rgba(0,0,0,.22), 0 0 0 1px rgba(255,255,255,.02) inset, 0 0 12px ${t.glow}`,
    backdropFilter: "blur(10px)",
  };
}

function softPanel(tone = "neutral") {
  const t = tintVars(tone);

  return {
    borderRadius: 22,
    border: `1px solid ${t.border}`,
    background: `
      radial-gradient(circle at top left, ${t.top} 0%, rgba(255,255,255,0) 26%),
      linear-gradient(180deg, rgba(12,20,37,.96) 0%, rgba(9,15,29,.96) 100%)
    `,
    boxShadow: `0 12px 24px rgba(0,0,0,.18), 0 0 12px ${t.glow}`,
  };
}

function microPanel(tone = "neutral") {
  const t = tintVars(tone);

  return {
    borderRadius: 18,
    border: `1px solid ${t.border}`,
    background: `
      radial-gradient(circle at top left, ${t.top} 0%, rgba(255,255,255,0) 28%),
      linear-gradient(180deg, rgba(14,23,41,.94) 0%, rgba(10,16,30,.94) 100%)
    `,
    boxShadow: `0 8px 16px rgba(0,0,0,.14), 0 0 10px ${t.glow}`,
  };
}

const sectionTitleStyle = {
  fontWeight: 950,
  fontSize: 24,
  letterSpacing: "-0.03em",
  color: "rgba(255,255,255,.99)",
};

const sectionSubStyle = {
  marginTop: 8,
  fontSize: 14,
  lineHeight: 1.6,
  color: "rgba(255,255,255,.84)",
};

const overlineStyle = {
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.18em",
  color: "rgba(255,255,255,.74)",
};

export default function InvestmentsPage() {
  const [assets, setAssets] = useState([]);
  const [txns, setTxns] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [prices, setPrices] = useState({});
  const [tab, setTab] = useState("overview");
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [symbol, setSymbol] = useState("");
  const [txnAsset, setTxnAsset] = useState("");
  const [txnQty, setTxnQty] = useState("");
  const [txnPrice, setTxnPrice] = useState("");

  const [holdingsMenuOpen, setHoldingsMenuOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedHoldingIds, setSelectedHoldingIds] = useState([]);

  const menuRef = useRef(null);

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
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) {
        setHoldingsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
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

  useEffect(() => {
    const validIds = new Set(assets.map((a) => a.id));
    setSelectedHoldingIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [assets]);

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

  function toggleHoldingSelected(id) {
    setSelectedHoldingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function startSelectMode() {
    setSelectMode(true);
    setHoldingsMenuOpen(false);
    setStatus("");
    setError("");
  }

  function cancelSelectMode() {
    setSelectMode(false);
    setSelectedHoldingIds([]);
    setHoldingsMenuOpen(false);
  }

  function selectAllHoldings() {
    setSelectedHoldingIds(assets.map((a) => a.id));
  }

  async function deleteHoldingsByIds(assetIds) {
    setError("");
    setStatus("");

    if (!assetIds.length) {
      setError("No holdings selected.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in.");
      return;
    }

    const targetAssets = assets.filter((a) => assetIds.includes(a.id));
    const targetSymbols = [
      ...new Set(
        targetAssets
          .map((a) => String(a.symbol || "").toUpperCase().trim())
          .filter(Boolean)
      ),
    ];

    const { error: txDeleteError } = await supabase
      .from("investment_transactions")
      .delete()
      .in("asset_id", assetIds)
      .eq("user_id", user.id);

    if (txDeleteError) {
      console.error(txDeleteError);
      setError("Could not remove related transactions.");
      return;
    }

    if (targetSymbols.length) {
      const { error: favoritesDeleteError } = await supabase
        .from("investment_favorites")
        .delete()
        .eq("user_id", user.id)
        .in("symbol", targetSymbols);

      if (favoritesDeleteError) {
        console.error(favoritesDeleteError);
        setError("Could not remove matching favorites.");
        return;
      }
    }

    const { error: assetDeleteError } = await supabase
      .from("investment_assets")
      .delete()
      .in("id", assetIds)
      .eq("user_id", user.id);

    if (assetDeleteError) {
      console.error(assetDeleteError);
      setError("Could not delete holdings.");
      return;
    }

    setAssets((prev) => prev.filter((a) => !assetIds.includes(a.id)));
    setTxns((prev) => prev.filter((t) => !assetIds.includes(t.asset_id)));
    setFavorites((prev) =>
      prev.filter(
        (f) => !targetSymbols.includes(String(f.symbol || "").toUpperCase().trim())
      )
    );

    setSelectedHoldingIds([]);
    setSelectMode(false);
    setStatus(
      assetIds.length === 1
        ? "Holding deleted."
        : `${assetIds.length} holdings deleted.`
    );
  }

  async function handleDeleteSelected() {
    if (!selectedHoldingIds.length) {
      setError("Pick at least one holding first.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedHoldingIds.length} selected holding${
        selectedHoldingIds.length === 1 ? "" : "s"
      }?\n\nThis will also remove related transactions and matching favorites.`
    );

    if (!confirmed) return;

    await deleteHoldingsByIds(selectedHoldingIds);
    setHoldingsMenuOpen(false);
  }

  async function handleDeleteAllHoldings() {
    if (!assets.length) {
      setError("There are no holdings to delete.");
      return;
    }

    const confirmed = window.confirm(
      `Delete all ${assets.length} holdings?\n\nThis will also remove all related transactions and matching favorites tied to those holdings.`
    );

    if (!confirmed) return;

    await deleteHoldingsByIds(assets.map((a) => a.id));
    setHoldingsMenuOpen(false);
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

  const recentTxns = useMemo(() => [...txns].slice(0, 6), [txns]);

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
        ...pageSurface(),
        padding: "30px 24px 48px",
        maxWidth: 1480,
        margin: "0 auto",
        color: "rgba(255,255,255,.97)",
        minHeight: "100vh",
      }}
    >
      <style jsx>{`
        .btn,
        .btnGhost,
        .input,
        .select {
          transition: all 0.18s ease;
        }

        .btn {
          min-width: 110px;
          height: 46px;
          padding: 0 18px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(
            180deg,
            rgba(122, 178, 255, 0.98) 0%,
            rgba(98, 160, 245, 0.96) 100%
          );
          color: white;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          box-shadow: 0 10px 22px rgba(59, 130, 246, 0.22);
          cursor: pointer;
        }

        .btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.03);
        }

        .btnGhost {
          min-width: 110px;
          height: 46px;
          padding: 0 18px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: linear-gradient(
            180deg,
            rgba(14, 22, 39, 0.95) 0%,
            rgba(8, 13, 25, 0.96) 100%
          );
          color: rgba(255, 255, 255, 0.96);
          font-weight: 850;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.14);
          cursor: pointer;
        }

        .btnGhost:hover {
          transform: translateY(-1px);
          border-color: rgba(255, 255, 255, 0.16);
        }

        .input,
        .select {
          height: 52px;
          padding: 0 16px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: linear-gradient(
            180deg,
            rgba(19, 28, 47, 0.95) 0%,
            rgba(12, 19, 35, 0.96) 100%
          );
          color: rgba(255, 255, 255, 0.98);
          outline: none;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.015);
        }

        .input::placeholder {
          color: rgba(255, 255, 255, 0.46);
        }

        .input:focus,
        .select:focus {
          border-color: rgba(96, 165, 250, 0.34);
          box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.08);
        }
      `}</style>

      <div
        style={{
          ...heroPanel(),
          padding: 28,
          marginBottom: 18,
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 18,
          alignItems: "end",
        }}
      >
        <div>
          <div style={overlineStyle}>Life Command Center</div>

          <h1
            style={{
              margin: "12px 0 0",
              fontSize: "clamp(2.6rem, 5.4vw, 4.25rem)",
              lineHeight: 0.98,
              fontWeight: 950,
              letterSpacing: "-0.05em",
              color: "rgba(255,255,255,.995)",
            }}
          >
            Investments Command
          </h1>

          <div
            style={{
              marginTop: 16,
              fontSize: 16,
              maxWidth: 820,
              color: "rgba(255,255,255,.84)",
              lineHeight: 1.65,
            }}
          >
            Track portfolio value, monitor position pressure, and open deeper detail only when you want it.
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
        <div
          style={{
            ...softPanel(error ? "bad" : "good"),
            padding: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 15 }}>
            {error ? "Fix this" : "Status"}
          </div>
          <div style={{ marginTop: 6, color: "rgba(255,255,255,.88)", lineHeight: 1.55 }}>
            {error || status}
          </div>
        </div>
      )}

      {tab === "overview" && (
        <>
          <div
            style={{
              ...shellPanel(portfolioTone, true),
              padding: 22,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.12fr .88fr",
                gap: 18,
                alignItems: "center",
              }}
            >
              <div>
                <div style={overlineStyle}>Portfolio Pulse</div>

                <div
                  style={{
                    marginTop: 12,
                    fontSize: "clamp(2.2rem, 4.6vw, 3.8rem)",
                    fontWeight: 950,
                    letterSpacing: "-0.04em",
                    color: "rgba(255,255,255,.99)",
                  }}
                >
                  {portfolio.hasAnyLivePrices ? money(portfolio.totalValue) : "Waiting on live data"}
                </div>

                <div
                  style={{
                    marginTop: 12,
                    fontSize: 18,
                    fontWeight: 900,
                    color:
                      portfolioTone === "good"
                        ? "#86efac"
                        : portfolioTone === "bad"
                        ? "#fda4af"
                        : "rgba(255,255,255,.90)",
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
                  gap: 14,
                }}
              >
                <PulseMiniCard label="Holdings" value={String(portfolio.holdings.length)} sub="Tracked positions" tone="neutral" />
                <PulseMiniCard label="Favorites" value={String(favoriteCards.length)} sub="Pinned symbols" tone="good" />
                <PulseMiniCard label="Trades" value={String(txns.length)} sub="Recorded transactions" tone="bad" />
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
              tone="good"
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

          <div style={{ ...shellPanel("neutral"), padding: 20, marginBottom: 18 }}>
            <div style={sectionTitleStyle}>Portfolio Signals</div>
            <div style={sectionSubStyle}>
              Live portfolio intelligence. No fake history. Just what is true right now.
            </div>

            <div style={{ height: 18 }} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              <SignalCard
                label="Best Holding"
                title={signals.bestHolding?.symbol || "None"}
                value={signals.bestHolding?.hasLivePrice ? money(signals.bestHolding.pnl) : "No live data"}
                secondary={
                  signals.bestHolding?.pnlPct != null
                    ? `${signals.bestHolding.pnlPct >= 0 ? "+" : ""}${signals.bestHolding.pnlPct.toFixed(2)}%`
                    : null
                }
                sub={
                  signals.bestHolding?.hasLivePrice
                    ? `${fmtNumber(signals.bestHolding.shares)} shares • ${money(signals.bestHolding.value)} value`
                    : "Shows top unrealized winner."
                }
                tone={signals.bestHolding ? "good" : "neutral"}
              />

              <SignalCard
                label="Worst Holding"
                title={signals.worstHolding?.symbol || "None"}
                value={signals.worstHolding?.hasLivePrice ? money(signals.worstHolding.pnl) : "No live data"}
                secondary={
                  signals.worstHolding?.pnlPct != null
                    ? `${signals.worstHolding.pnlPct >= 0 ? "+" : ""}${signals.worstHolding.pnlPct.toFixed(2)}%`
                    : null
                }
                sub={
                  signals.worstHolding?.hasLivePrice
                    ? `${fmtNumber(signals.worstHolding.shares)} shares • ${money(signals.worstHolding.value)} value`
                    : "Shows biggest unrealized drag."
                }
                tone={signals.worstHolding ? "bad" : "neutral"}
              />

              <SignalCard
                label="Largest Position"
                title={signals.largestPosition?.symbol || "None"}
                value={signals.largestPosition?.hasLivePrice ? money(signals.largestPosition.value) : "No live data"}
                secondary={
                  signals.largestWeightPct != null
                    ? `${signals.largestWeightPct.toFixed(1)}% of portfolio`
                    : null
                }
                sub={
                  signals.largestPosition?.hasLivePrice
                    ? `${fmtNumber(signals.largestPosition.shares)} shares at ${money(signals.largestPosition.livePrice)}`
                    : "Largest live-priced position."
                }
                tone="neutral"
              />

              <SignalCard
                label="Live Price Coverage"
                title={`${signals.liveCoverageCount}/${signals.totalHoldingsCount}`}
                value={signals.totalHoldingsCount ? `${signals.liveCoveragePct.toFixed(0)}%` : "0%"}
                sub={loadingPrices ? "Checking quote coverage now." : "How much of the portfolio has live prices."}
                tone="neutral"
              />

              <SignalCard
                label="Favorites Count"
                title={String(signals.favoritesCount)}
                value={signals.favoritesCount ? "Active" : "Empty"}
                sub="Pinned symbols in your watch section."
                tone="good"
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

          <div style={{ ...shellPanel("neutral"), padding: 20, marginBottom: 18 }}>
            <div style={sectionTitleStyle}>Favorites</div>
            <div style={sectionSubStyle}>Quick access symbols you want close without clutter.</div>

            <div style={{ height: 18 }} />

            {favoriteCards.length ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 14,
                }}
              >
                {favoriteCards.map((f) => (
                  <div key={f.id} style={{ ...softPanel("neutral"), padding: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 950, fontSize: 18, color: "rgba(255,255,255,.98)" }}>{f.symbol}</div>
                        <div style={{ fontSize: 12, marginTop: 4, color: "rgba(255,255,255,.72)" }}>
                          {f.asset_type || "stock"}
                        </div>
                      </div>

                      <button className="btnGhost" onClick={() => removeFavorite(f.id)} style={{ minWidth: 82 }}>
                        Remove
                      </button>
                    </div>

                    <div
                      style={{
                        marginTop: 14,
                        fontWeight: 850,
                        minHeight: 24,
                        color: "rgba(255,255,255,.94)",
                      }}
                    >
                      {f.name || f.symbol}
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,.76)" }}>Live Price</div>
                      <div
                        style={{
                          marginTop: 6,
                          fontWeight: 950,
                          fontSize: 26,
                          color: "rgba(255,255,255,.99)",
                        }}
                      >
                        {f.hasLivePrice ? money(f.livePrice) : "Pending"}
                      </div>
                    </div>

                    <div style={{ marginTop: 16 }}>
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
            <div style={{ ...shellPanel("neutral"), padding: 20 }}>
              <div style={sectionTitleStyle}>Top Holdings</div>
              <div style={sectionSubStyle}>
                Clean account summary. Open an asset only when you want deeper detail.
              </div>

              <div style={{ height: 18 }} />

              {!portfolio.holdings.length ? (
                <EmptyState
                  title="No investments yet"
                  sub="Add your first asset, then log a trade to start building your portfolio."
                />
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
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
                          ...softPanel(h.hasLivePrice ? toneByValue(h.pnl) : "neutral"),
                          padding: 18,
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1.2fr .8fr .95fr 1fr auto auto",
                            gap: 12,
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 950, fontSize: 17, color: "rgba(255,255,255,.98)" }}>
                              {h.symbol}
                            </div>
                            <div style={{ fontSize: 12, marginTop: 6, color: "rgba(255,255,255,.72)" }}>
                              {h.account || "Main"} • {h.asset_type || "stock"} • {h.txCount} trade
                              {h.txCount === 1 ? "" : "s"}
                            </div>
                          </div>

                          <HoldingMiniStat label="Shares" value={fmtNumber(h.shares)} />
                          <HoldingMiniStat label="Value" value={h.hasLivePrice ? money(h.value) : "Pending"} />
                          <HoldingMiniStat
                            label="P/L"
                            value={
                              h.hasLivePrice
                                ? `${money(h.pnl)}${h.pnlPct != null ? ` • ${h.pnlPct >= 0 ? "+" : ""}${h.pnlPct.toFixed(2)}%` : ""}`
                                : "Pending"
                            }
                            tone={h.hasLivePrice ? toneByValue(h.pnl) : "neutral"}
                          />

                          <button className="btnGhost" onClick={() => addFavoriteFromHolding(h)} style={{ minWidth: 98 }}>
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

            <div style={{ ...shellPanel("neutral"), padding: 20 }}>
              <div style={sectionTitleStyle}>Allocation View</div>
              <div style={sectionSubStyle}>Portfolio weights by live market value.</div>

              <div style={{ height: 18 }} />

              {allocation.length ? (
                <div style={{ display: "grid", gap: 16 }}>
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
                        <div style={{ fontWeight: 900, color: "rgba(255,255,255,.96)" }}>{h.symbol}</div>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,.80)" }}>
                          {h.weight.toFixed(1)}%
                        </div>
                      </div>

                      <div
                        style={{
                          height: 12,
                          borderRadius: 999,
                          background: "rgba(255,255,255,.09)",
                          overflow: "hidden",
                          position: "relative",
                          border: "1px solid rgba(255,255,255,.07)",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.max(4, Math.min(100, h.weight))}%`,
                            height: "100%",
                            borderRadius: 999,
                            background:
                              "linear-gradient(90deg, rgba(74,222,128,.96), rgba(59,130,246,.86))",
                            boxShadow: "0 0 16px rgba(59,130,246,.14)",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          marginTop: 8,
                        }}
                      >
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.74)" }}>{money(h.value)}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.74)" }}>
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
            <div style={{ ...shellPanel("neutral"), padding: 20 }}>
              <div style={sectionTitleStyle}>Recent Activity</div>
              <div style={sectionSubStyle}>Latest buys and sells across your portfolio.</div>

              <div style={{ height: 18 }} />

              {recentTxns.length ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {recentTxns.map((t) => {
                    const asset = assets.find((a) => a.id === t.asset_id);
                    const txnType = String(t.txn_type || "").toUpperCase();
                    const tone =
                      txnType === "BUY" ? "good" : txnType === "SELL" ? "bad" : "neutral";

                    return (
                      <div key={t.id} style={{ ...microPanel(tone), padding: 15 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontWeight: 900, color: "rgba(255,255,255,.97)" }}>
                            {asset?.symbol || "—"} • {t.txn_type}
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,.74)" }}>{t.txn_date}</div>
                        </div>

                        <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,.84)" }}>
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

            <div style={{ ...shellPanel("neutral"), padding: 20 }}>
              <div style={sectionTitleStyle}>What Actually Comes Next</div>
              <div style={{ marginTop: 8, lineHeight: 1.65, color: "rgba(255,255,255,.84)" }}>
                The next real backend upgrade is daily portfolio snapshots. That is what unlocks honest performance charts.
              </div>

              <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                <MiniPoint
                  title="Daily snapshots"
                  sub="Store total portfolio value once per day."
                  tone="good"
                />
                <MiniPoint
                  title="Real performance cards"
                  sub="1D / 1W / 1M / YTD based on stored history."
                  tone="neutral"
                />
                <MiniPoint
                  title="Portfolio chart"
                  sub="Actual account curve, not fake reconstructed history."
                  tone="bad"
                />
                <MiniPoint
                  title="Signal expansion"
                  sub="Add gainers, losers, and watchlist alerts after snapshots."
                  tone="neutral"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "holdings" && (
        <>
          <div
            style={{
              ...shellPanel("neutral"),
              padding: 20,
              marginBottom: 18,
              position: "relative",
              zIndex: 30,
              overflow: "visible",
            }}
          >
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
              <div>
                <div style={{ fontWeight: 950, fontSize: 22, letterSpacing: "-0.02em" }}>
                  Holdings
                </div>
                <div style={{ marginTop: 6, fontSize: 14, color: "rgba(255,255,255,.82)" }}>
                  Manage assets quietly. Bulk actions stay tucked away until you need them.
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                  position: "relative",
                  zIndex: 80,
                }}
              >
                {selectMode ? (
                  <>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,.12)",
                        background: "rgba(255,255,255,.04)",
                        color: "rgba(255,255,255,.92)",
                        fontWeight: 800,
                      }}
                    >
                      {selectedHoldingIds.length} selected
                    </div>

                    <button className="btnGhost" onClick={selectAllHoldings}>
                      Select All
                    </button>

                    <button className="btnGhost" onClick={cancelSelectMode}>
                      Cancel
                    </button>

                    <button
                      onClick={handleDeleteSelected}
                      style={{
                        minWidth: 138,
                        height: 46,
                        padding: "0 18px",
                        borderRadius: 999,
                        border: "1px solid rgba(244,63,94,.34)",
                        background:
                          "linear-gradient(180deg, rgba(80,10,24,.95) 0%, rgba(56,8,18,.96) 100%)",
                        color: "#ffd5dc",
                        fontWeight: 900,
                        boxShadow: "0 8px 16px rgba(0,0,0,.18), 0 0 10px rgba(244,63,94,.10)",
                        cursor: "pointer",
                      }}
                    >
                      Delete Selected
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/investments/discover" className="btnGhost">
                      Discover Stocks
                    </Link>

                    <div
                      style={{ position: "relative", zIndex: 100 }}
                      ref={menuRef}
                    >
                      <button
                        onClick={() => setHoldingsMenuOpen((prev) => !prev)}
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 999,
                          border: "1px solid rgba(255,255,255,.10)",
                          background:
                            "linear-gradient(180deg, rgba(12,19,35,.95) 0%, rgba(8,13,25,.96) 100%)",
                          color: "rgba(255,255,255,.96)",
                          fontSize: 22,
                          fontWeight: 900,
                          cursor: "pointer",
                          boxShadow: "0 8px 16px rgba(0,0,0,.14)",
                        }}
                        aria-label="Manage holdings"
                        title="Manage holdings"
                      >
                        …
                      </button>

                      {holdingsMenuOpen ? (
                        <div
                          style={{
                            position: "absolute",
                            right: 0,
                            top: 54,
                            width: 220,
                            borderRadius: 18,
                            border: "1px solid rgba(255,255,255,.10)",
                            background:
                              "linear-gradient(180deg, rgba(16,24,42,.99) 0%, rgba(11,17,31,.99) 100%)",
                            boxShadow: "0 20px 40px rgba(0,0,0,.32)",
                            padding: 8,
                            zIndex: 9999,
                          }}
                        >
                          <MenuAction label="Select multiple" onClick={startSelectMode} />
                          <MenuAction
                            label="Delete all holdings"
                            onClick={handleDeleteAllHoldings}
                            danger
                          />
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
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

          <div
            style={{
              ...shellPanel("neutral"),
              padding: 0,
              overflow: "hidden",
              position: "relative",
              zIndex: 1,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: selectMode
                  ? "64px 1.05fr .75fr .9fr .9fr .9fr 1fr 110px 120px"
                  : "1.05fr .75fr .9fr .9fr .9fr 1fr 110px 120px",
                gap: 12,
                padding: "16px 18px",
                borderBottom: "1px solid rgba(255,255,255,.09)",
                fontWeight: 900,
                color: "rgba(255,255,255,.76)",
                background: "rgba(255,255,255,.035)",
              }}
            >
              {selectMode ? <div>Select</div> : null}
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

                const tone = h.hasLivePrice ? toneByValue(h.pnl) : "neutral";
                const tint = tintVars(tone);
                const selected = selectedHoldingIds.includes(h.id);

                return (
                  <div
                    key={h.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: selectMode
                        ? "64px 1.05fr .75fr .9fr .9fr .9fr 1fr 110px 120px"
                        : "1.05fr .75fr .9fr .9fr .9fr 1fr 110px 120px",
                      gap: 12,
                      padding: "16px 18px",
                      borderBottom: "1px solid rgba(255,255,255,.06)",
                      alignItems: "center",
                      background: `
                        linear-gradient(90deg, ${selected ? "rgba(96,165,250,.10)" : tint.top}, rgba(255,255,255,0) 28%),
                        rgba(255,255,255,.014)
                      `,
                    }}
                  >
                    {selectMode ? (
                      <div>
                        <button
                          onClick={() => toggleHoldingSelected(h.id)}
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 10,
                            border: selected
                              ? "1px solid rgba(96,165,250,.44)"
                              : "1px solid rgba(255,255,255,.12)",
                            background: selected
                              ? "linear-gradient(180deg, rgba(30,64,175,.95) 0%, rgba(29,78,216,.95) 100%)"
                              : "rgba(255,255,255,.04)",
                            color: "white",
                            fontWeight: 900,
                            cursor: "pointer",
                          }}
                          title={selected ? "Deselect" : "Select"}
                        >
                          {selected ? "✓" : ""}
                        </button>
                      </div>
                    ) : null}

                    <div>
                      <div style={{ fontWeight: 900, color: "rgba(255,255,255,.98)" }}>{h.symbol}</div>
                      <div style={{ fontSize: 12, marginTop: 4, color: "rgba(255,255,255,.70)" }}>
                        {h.account || "Main"}
                      </div>
                    </div>

                    <div>{fmtNumber(h.shares)}</div>
                    <div>{money(h.cost)}</div>
                    <div>{h.shares > 0 ? money(h.avgCost) : "—"}</div>
                    <div>{h.hasLivePrice ? money(h.livePrice) : "Unavailable"}</div>

                    <div
                      style={{
                        color: h.hasLivePrice
                          ? h.pnl >= 0
                            ? "#86efac"
                            : "#fda4af"
                          : "rgba(255,255,255,.94)",
                        fontWeight: 900,
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
          <div style={{ ...shellPanel("neutral"), padding: 20, marginBottom: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 22, marginBottom: 14, letterSpacing: "-0.02em" }}>
              Add Trade
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select
                className="select"
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
            <div
              style={{
                ...shellPanel("neutral"),
                padding: 0,
                overflow: "hidden",
              }}
            >
              <TableHeader cols={["Type", "Asset", "Qty", "Price", "Date"]} />

              {txns.length ? (
                txns.map((t) => {
                  const asset = assets.find((a) => a.id === t.asset_id);
                  const txnType = String(t.txn_type || "").toUpperCase();
                  const tone =
                    txnType === "BUY" ? "good" : txnType === "SELL" ? "bad" : "neutral";

                  const tint = tintVars(tone);

                  return (
                    <div
                      key={t.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                        gap: 12,
                        padding: "16px 18px",
                        borderBottom: "1px solid rgba(255,255,255,.06)",
                        alignItems: "center",
                        background: `
                          linear-gradient(90deg, ${tint.top}, rgba(255,255,255,0) 28%),
                          rgba(255,255,255,.012)
                        `,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                          color:
                            txnType === "BUY"
                              ? "#86efac"
                              : txnType === "SELL"
                              ? "#fda4af"
                              : "rgba(255,255,255,.96)",
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

            <div style={{ ...shellPanel("neutral"), padding: 20 }}>
              <div style={sectionTitleStyle}>Recent Activity</div>
              <div style={sectionSubStyle}>Latest portfolio moves at a glance.</div>

              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                {recentTxns.length ? (
                  recentTxns.map((t) => {
                    const asset = assets.find((a) => a.id === t.asset_id);
                    const txnType = String(t.txn_type || "").toUpperCase();
                    const tone =
                      txnType === "BUY" ? "good" : txnType === "SELL" ? "bad" : "neutral";

                    return (
                      <div key={t.id} style={{ ...microPanel(tone), padding: 15 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontWeight: 900, color: "rgba(255,255,255,.97)" }}>
                            {asset?.symbol || "—"} • {t.txn_type}
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,.74)" }}>
                            {t.txn_date}
                          </div>
                        </div>

                        <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,.84)" }}>
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
      onClick={onClick}
      style={{
        minWidth: 118,
        height: 46,
        padding: "0 18px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(255,255,255,.15)"
          : "1px solid rgba(255,255,255,.11)",
        background: active
          ? "linear-gradient(180deg, rgba(255,255,255,.98) 0%, rgba(236,236,236,.95) 100%)"
          : "linear-gradient(180deg, rgba(12,19,35,.95) 0%, rgba(8,13,25,.96) 100%)",
        color: active ? "#111827" : "rgba(255,255,255,.95)",
        fontWeight: 850,
        boxShadow: active
          ? "0 8px 18px rgba(255,255,255,.08)"
          : "0 8px 16px rgba(0,0,0,.14)",
        cursor: "pointer",
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
      ? "#86efac"
      : valueTone === "bad"
      ? "#fda4af"
      : "rgba(255,255,255,.99)";

  const panel = softPanel(tone);

  return (
    <div
      style={{
        ...panel,
        padding: 20,
        ...(strong
          ? {
              boxShadow: `${panel.boxShadow}, 0 0 0 1px rgba(255,255,255,.025) inset`,
            }
          : {}),
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,.74)",
        }}
      >
        {title}
      </div>
      <div style={{ marginTop: 12, fontSize: 26, fontWeight: 950, color: toneColor }}>
        {value}
      </div>
      <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,.82)" }}>
        {sub}
      </div>
    </div>
  );
}

function PulseMiniCard({ label, value, sub, tone = "neutral" }) {
  return (
    <div style={{ ...microPanel(tone), padding: 18 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,.72)",
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 10, fontWeight: 950, fontSize: 28, color: "rgba(255,255,255,.99)" }}>
        {value}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,.82)" }}>
        {sub}
      </div>
    </div>
  );
}

function HoldingMiniStat({ label, value, tone = "neutral" }) {
  const color =
    tone === "good"
      ? "#86efac"
      : tone === "bad"
      ? "#fda4af"
      : "rgba(255,255,255,.97)";

  return (
    <div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.72)" }}>{label}</div>
      <div style={{ fontWeight: 900, marginTop: 6, color }}>{value}</div>
    </div>
  );
}

function SignalCard({ label, title, value, secondary = null, sub, tone = "neutral" }) {
  const valueColor =
    tone === "good"
      ? "#86efac"
      : tone === "bad"
      ? "#fda4af"
      : "rgba(255,255,255,.98)";

  return (
    <div style={{ ...softPanel(tone), padding: 18 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,.72)",
        }}
      >
        {label}
      </div>

      <div style={{ marginTop: 12, fontSize: 18, fontWeight: 950, color: "rgba(255,255,255,.99)" }}>
        {title}
      </div>

      <div style={{ marginTop: 10, fontSize: 28, fontWeight: 950, color: valueColor }}>
        {value}
      </div>

      {secondary ? (
        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,.82)" }}>
          {secondary}
        </div>
      ) : null}

      <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,.82)" }}>
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
        color: "rgba(255,255,255,.76)",
        background: "rgba(255,255,255,.03)",
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
        borderRadius: 22,
        border: "1px dashed rgba(255,255,255,.17)",
        padding: "30px 18px",
        background:
          "linear-gradient(180deg, rgba(15,24,42,.92) 0%, rgba(11,17,32,.92) 100%)",
        textAlign: "center",
        boxShadow: "0 10px 18px rgba(0,0,0,.12)",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 16, color: "rgba(255,255,255,.98)" }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,.82)" }}>
        {sub}
      </div>
    </div>
  );
}

function MiniPoint({ title, sub, tone = "neutral" }) {
  return (
    <div style={{ ...microPanel(tone), padding: 15 }}>
      <div style={{ fontWeight: 900, fontSize: 17, color: "rgba(255,255,255,.98)" }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.65, color: "rgba(255,255,255,.84)" }}>
        {sub}
      </div>
    </div>
  );
}

function MenuAction({ label, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: 12,
        border: "none",
        background: danger ? "rgba(244,63,94,.08)" : "transparent",
        color: danger ? "#ffc9d3" : "rgba(255,255,255,.94)",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}