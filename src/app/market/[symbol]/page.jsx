"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function MarketSymbolPage({ params }) {
  const symbol = decodeURIComponent(params?.symbol || "").toUpperCase().trim();

  const [asset, setAsset] = useState(null);
  const [price, setPrice] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isOwned, setIsOwned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      setStatus("");

      if (!symbol) {
        setError("Missing market symbol.");
        setLoading(false);
        return;
      }

      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user || null;

        const searchRes = await fetch(
          `/api/market-search?query=${encodeURIComponent(symbol)}&type=ALL&limit=12`
        );
        const searchData = await searchRes.json();

        if (!searchRes.ok) {
          throw new Error(searchData?.error || "Failed to load market symbol.");
        }

        const rows = Array.isArray(searchData?.results) ? searchData.results : [];
        const exact =
          rows.find((x) => String(x.symbol || "").toUpperCase() === symbol) ||
          rows[0] ||
          {
            symbol,
            name: symbol,
            type: "Stock",
            exchange: "—",
            currency: "USD",
          };

        setAsset(exact);

        try {
          const priceRes = await fetch(`/api/prices?symbol=${encodeURIComponent(symbol)}`);
          const priceData = await priceRes.json();

          if (
            priceRes.ok &&
            Number.isFinite(Number(priceData?.price)) &&
            Number(priceData.price) > 0
          ) {
            setPrice(Number(priceData.price));
          } else {
            setPrice(null);
          }
        } catch (err) {
          console.error("price fetch failed", err);
          setPrice(null);
        }

        if (user) {
          const [{ data: favoriteRows, error: favoriteError }, { data: assetRows, error: assetError }] =
            await Promise.all([
              supabase
                .from("investment_favorites")
                .select("id,symbol")
                .eq("user_id", user.id)
                .eq("symbol", symbol),
              supabase
                .from("investment_assets")
                .select("id,symbol")
                .eq("user_id", user.id)
                .eq("symbol", symbol),
            ]);

          if (favoriteError) console.error(favoriteError);
          if (assetError) console.error(assetError);

          setIsFavorite(Array.isArray(favoriteRows) && favoriteRows.length > 0);
          setIsOwned(Array.isArray(assetRows) && assetRows.length > 0);
        } else {
          setIsFavorite(false);
          setIsOwned(false);
        }
      } catch (err) {
        console.error(err);
        setError(err?.message || "Failed to load market symbol.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [symbol]);

  const assetTypeLabel = useMemo(() => {
    const raw = String(asset?.type || "").toUpperCase();
    if (raw.includes("ETF")) return "ETF";
    if (raw.includes("FUND")) return "Fund";
    return raw || "Stock";
  }, [asset]);

  async function toggleFavorite() {
    setWorking(true);
    setError("");
    setStatus("");

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user || null;

      if (!user) {
        setError("You must be logged in.");
        setWorking(false);
        return;
      }

      if (isFavorite) {
        const { error } = await supabase
          .from("investment_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("symbol", symbol);

        if (error) throw error;

        setIsFavorite(false);
        setStatus(`${symbol} removed from favorites.`);
      } else {
        const { error } = await supabase
          .from("investment_favorites")
          .insert({
            user_id: user.id,
            symbol,
            name: asset?.name || symbol,
            asset_type: assetTypeLabel.toLowerCase(),
          });

        if (error) throw error;

        setIsFavorite(true);
        setStatus(`${symbol} added to favorites.`);
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to update favorite.");
    } finally {
      setWorking(false);
    }
  }

  async function addToPortfolio() {
    setWorking(true);
    setError("");
    setStatus("");

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user || null;

      if (!user) {
        setError("You must be logged in.");
        setWorking(false);
        return;
      }

      if (isOwned) {
        setStatus(`${symbol} is already in your portfolio.`);
        setWorking(false);
        return;
      }

      const { error } = await supabase
        .from("investment_assets")
        .insert({
          user_id: user.id,
          symbol,
          asset_type: assetTypeLabel.toLowerCase() === "etf" ? "etf" : "stock",
          account: "Main",
        });

      if (error) throw error;

      setIsOwned(true);
      setStatus(`${symbol} added to portfolio.`);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to add asset.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: "36px 28px 44px", maxWidth: "1280px", margin: "0 auto" }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 900 }}>Loading market symbol...</div>
        </div>
      </main>
    );
  }

  if (error && !asset) {
    return (
      <main style={{ padding: "36px 28px 44px", maxWidth: "1280px", margin: "0 auto" }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 900 }}>{error}</div>
          <div style={{ marginTop: 14 }}>
            <Link href="/investments/discover" className="btn">
              Back to Discover
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: "36px 28px 44px", maxWidth: "1280px", margin: "0 auto" }}>
      {(status || error) && (
        <div className="card" style={{ padding: 14, marginBottom: 18 }}>
          <div style={{ fontWeight: 900 }}>{error ? "Fix this" : "Status"}</div>
          <div className="muted" style={{ marginTop: 6 }}>{error || status}</div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr .9fr",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div
              className="muted"
              style={{
                fontSize: 12,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.16em",
              }}
            >
              Market Asset
            </div>

            <h1
              style={{
                margin: "10px 0 0",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                lineHeight: 1.04,
                fontWeight: 950,
              }}
            >
              {symbol}
            </h1>

            <div style={{ marginTop: 10, fontWeight: 850, fontSize: 18 }}>
              {asset?.name || symbol}
            </div>

            <div className="muted" style={{ marginTop: 10, fontSize: 14 }}>
              {assetTypeLabel} • {asset?.exchange || "—"} • {asset?.currency || "USD"}
            </div>

            <div style={{ height: 18 }} />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <StatCard
                title="Live Price"
                value={price ? money(price) : "Unavailable"}
                sub="Uses your current quote endpoint if available."
              />
              <StatCard
                title="Asset Type"
                value={assetTypeLabel}
                sub="Public market classification."
              />
              <StatCard
                title="Exchange"
                value={asset?.exchange || "—"}
                sub="Returned from market search."
              />
            </div>

            <div style={{ height: 18 }} />

            <RealPlaceholderChart symbol={symbol} />
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 20 }}>Actions</div>

            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <button
                className="btn"
                onClick={addToPortfolio}
                disabled={working || isOwned}
                style={{ opacity: working || isOwned ? 0.75 : 1 }}
              >
                {isOwned ? "Already in Portfolio" : working ? "Working..." : "Add to Portfolio"}
              </button>

              <button
                className="btnGhost"
                onClick={toggleFavorite}
                disabled={working}
                style={{ opacity: working ? 0.75 : 1 }}
              >
                {isFavorite ? "Remove Favorite" : "Add to Favorites"}
              </button>

              <Link href="/investments/discover" className="btnGhost">
                Back to Discover
              </Link>

              <Link href="/investments" className="btnGhost">
                Portfolio
              </Link>
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 20 }}>About this market page</div>
            <div className="muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
              This is the public market asset screen. It now works from the symbol in the URL instead of a tiny starter list.
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <MiniPoint title="Public page" sub="Works even if you do not own the asset yet." />
              <MiniPoint title="Real symbol support" sub="Can open market pages for symbols coming from Discover search." />
              <MiniPoint title="Scalable" sub="Later this can hold real chart history, quote stats, and news." />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ title, value, sub }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {title}
      </div>
      <div style={{ marginTop: 10, fontWeight: 950, fontSize: 22 }}>
        {value}
      </div>
      <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.45 }}>
        {sub}
      </div>
    </div>
  );
}

function RealPlaceholderChart({ symbol }) {
  return (
    <div
      style={{
        position: "relative",
        height: 360,
        borderRadius: 24,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,.08)",
        background:
          "linear-gradient(180deg, rgba(59,130,246,.14) 0%, rgba(59,130,246,.04) 40%, rgba(255,255,255,.02) 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)",
          backgroundSize: "100% 72px, 72px 100%",
          pointerEvents: "none",
        }}
      />

      <svg viewBox="0 0 1000 360" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
        <defs>
          <linearGradient id="chartFillMarketReal" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(96,165,250,.45)" />
            <stop offset="100%" stopColor="rgba(96,165,250,0)" />
          </linearGradient>
        </defs>

        <path
          d="M0,270 C75,248 135,228 200,220 C275,210 330,230 390,188 C450,146 500,132 560,150 C625,170 680,195 750,160 C820,126 885,102 940,84 C970,74 988,64 1000,54 L1000,360 L0,360 Z"
          fill="url(#chartFillMarketReal)"
        />
        <path
          d="M0,270 C75,248 135,228 200,220 C275,210 330,230 390,188 C450,146 500,132 560,150 C625,170 680,195 750,160 C820,126 885,102 940,84 C970,74 988,64 1000,54"
          fill="none"
          stroke="rgba(96,165,250,.95)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>

      <div
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          padding: "8px 10px",
          borderRadius: 12,
          background: "rgba(7,10,18,.55)",
          border: "1px solid rgba(255,255,255,.08)",
          fontWeight: 900,
        }}
      >
        {symbol} Market View
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