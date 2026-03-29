"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  Newspaper,
  Plus,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassPane from "../../components/GlassPane";

export const dynamic = "force-dynamic";

const FONT_STACK =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const DEFAULT_UNIVERSE = {
  stocks: [
    { symbol: "AAPL", name: "Apple Inc.", type: "Stock", exchange: "NASDAQ" },
    { symbol: "MSFT", name: "Microsoft Corporation", type: "Stock", exchange: "NASDAQ" },
    { symbol: "NVDA", name: "NVIDIA Corporation", type: "Stock", exchange: "NASDAQ" },
    { symbol: "AMZN", name: "Amazon.com, Inc.", type: "Stock", exchange: "NASDAQ" },
    { symbol: "GOOGL", name: "Alphabet Inc.", type: "Stock", exchange: "NASDAQ" },
    { symbol: "META", name: "Meta Platforms, Inc.", type: "Stock", exchange: "NASDAQ" },
    { symbol: "AMD", name: "Advanced Micro Devices, Inc.", type: "Stock", exchange: "NASDAQ" },
    { symbol: "TSLA", name: "Tesla, Inc.", type: "Stock", exchange: "NASDAQ" },
  ],
  etfs: [
    { symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "QQQ", name: "Invesco QQQ Trust", type: "ETF", exchange: "NASDAQ" },
    { symbol: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "SCHD", name: "Schwab U.S. Dividend Equity ETF", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "SOXX", name: "iShares Semiconductor ETF", type: "ETF", exchange: "NASDAQ" },
    { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", type: "ETF", exchange: "NYSE Arca" },
  ],
  sectors: [
    { symbol: "XLK", name: "Technology Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "XLF", name: "Financial Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "XLE", name: "Energy Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "XLV", name: "Health Care Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "XLY", name: "Consumer Discretionary Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca" },
    { symbol: "XLI", name: "Industrial Select Sector SPDR Fund", type: "ETF", exchange: "NYSE Arca" },
  ],
};

function toNum(v, fallback = null) {
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

function fullDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toneByChange(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "neutral";
  return n > 0 ? "green" : "red";
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

function inputStyle() {
  return {
    height: 48,
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

function buttonStyle({ disabled = false, primary = false } = {}) {
  return {
    minHeight: 40,
    padding: "0 12px",
    borderRadius: 14,
    border: primary
      ? "1px solid rgba(255,255,255,0.18)"
      : "1px solid rgba(214,226,255,0.10)",
    background: disabled
      ? "rgba(255,255,255,0.03)"
      : primary
      ? "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(233,239,248,0.88))"
      : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))",
    color: disabled ? "rgba(255,255,255,0.42)" : primary ? "#0b1220" : "#f7fbff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontWeight: 800,
    fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: "none",
  };
}

function parseBatchPrices(json) {
  const out = {};

  function assign(symbol, raw) {
    const sym = String(symbol || "").trim().toUpperCase();
    if (!sym) return;

    if (typeof raw === "number") {
      out[sym] = {
        price: toNum(raw),
        change: null,
        changesPercentage: null,
      };
      return;
    }

    if (raw && typeof raw === "object") {
      out[sym] = {
        price: toNum(raw.price),
        change: toNum(raw.change),
        changesPercentage: toNum(
          raw.changesPercentage ?? raw.changePercent ?? raw.percent_change
        ),
      };
    }
  }

  if (Array.isArray(json)) {
    json.forEach((row) => assign(row?.symbol ?? row?.ticker, row));
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

function ActionLink({ href, children }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
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

function CompactStat({ label, value }) {
  return (
    <div
      style={{
        minHeight: 82,
        borderRadius: 18,
        border: "1px solid rgba(214,226,255,0.10)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.032), rgba(255,255,255,0.01))",
        padding: 14,
      }}
    >
      <div style={overlineStyle()}>{label}</div>
      <div
        style={{
          marginTop: 8,
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: "-0.05em",
          color: "#fff",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FocusHeadline({ item }) {
  return (
    <a
      href={item.url || "#"}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          minHeight: 84,
          display: "grid",
          gridTemplateColumns: "38px minmax(0, 1fr)",
          gap: 10,
          alignItems: "start",
          padding: "11px 12px",
          borderRadius: 16,
          border: "1px solid rgba(214,226,255,0.10)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            border: "1px solid rgba(214,226,255,0.10)",
            background: "rgba(10,14,21,0.46)",
            color: "#f7fbff",
          }}
        >
          <Newspaper size={15} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#fff",
              lineHeight: 1.35,
              overflowWrap: "anywhere",
            }}
          >
            {item.title || "Untitled headline"}
          </div>
          <div style={{ marginTop: 5, ...mutedStyle() }}>
            {item.site || "Source"} • {fullDateTime(item.publishedDate)}
          </div>
        </div>
      </div>
    </a>
  );
}

function WatchlistRow({ item, quote }) {
  const tone = toneByChange(quote?.changesPercentage ?? quote?.change ?? 0);
  const meta = toneMeta(tone);
  const price = Number.isFinite(Number(quote?.price)) ? money(quote.price) : "—";

  return (
    <Link
      href={`/market/${encodeURIComponent(item.symbol)}`}
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          minHeight: 60,
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
          <div style={{ fontSize: 13, fontWeight: 850, color: "#fff" }}>{item.symbol}</div>
          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              color: "rgba(255,255,255,0.58)",
              overflowWrap: "anywhere",
            }}
          >
            {item.name || item.asset_type || "Watchlist"}
          </div>
        </div>

        <div
          style={{
            textAlign: "right",
            fontSize: 12,
            fontWeight: 800,
            color: tone === "neutral" ? "rgba(255,255,255,0.76)" : meta.text,
            whiteSpace: "nowrap",
          }}
        >
          {price}
        </div>
      </div>
    </Link>
  );
}

function ResearchRow({
  item,
  quote,
  isSelected,
  owned,
  favorited,
  busy,
  onSelect,
  onAddAsset,
  onToggleFavorite,
}) {
  const tone = toneByChange(quote?.changesPercentage ?? quote?.change ?? 0);
  const meta = toneMeta(tone);
  const price = Number.isFinite(Number(quote?.price)) ? money(quote.price) : "—";
  const pctValue = Number.isFinite(Number(quote?.changesPercentage))
    ? `${Number(quote.changesPercentage) >= 0 ? "+" : ""}${Number(
        quote.changesPercentage
      ).toFixed(2)}%`
    : "—";

  return (
    <div
      style={{
        minHeight: 86,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.2fr) minmax(90px, 0.34fr) minmax(90px, 0.3fr) auto",
        gap: 10,
        alignItems: "center",
        padding: "12px 14px",
        borderRadius: 18,
        border: isSelected
          ? `1px solid ${meta.border}`
          : "1px solid rgba(214,226,255,0.08)",
        background: isSelected
          ? "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))"
          : "linear-gradient(180deg, rgba(255,255,255,0.022), rgba(255,255,255,0.008))",
        boxShadow: isSelected ? `0 0 16px ${meta.glow}` : "none",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        style={{
          all: "unset",
          cursor: "pointer",
          minWidth: 0,
          display: "grid",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${meta.border}`,
              background: meta.iconBg,
              color: tone === "neutral" ? "#fff" : meta.text,
              flexShrink: 0,
            }}
          >
            {tone === "red" ? <TrendingDown size={15} /> : <TrendingUp size={15} />}
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 850,
                color: "#fff",
                lineHeight: 1.2,
                overflowWrap: "anywhere",
              }}
            >
              {item.symbol}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: "rgba(255,255,255,0.58)",
                lineHeight: 1.35,
                overflowWrap: "anywhere",
              }}
            >
              {item.name} • {item.exchange}
            </div>
          </div>
        </div>
      </button>

      <div
        style={{
          fontSize: 13,
          fontWeight: 850,
          color: "#fff",
          whiteSpace: "nowrap",
          textAlign: "right",
        }}
      >
        {price}
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 850,
          color: tone === "neutral" ? "rgba(255,255,255,0.62)" : meta.text,
          whiteSpace: "nowrap",
          textAlign: "right",
        }}
      >
        {pctValue}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={onAddAsset}
          disabled={busy || owned}
          style={buttonStyle({ disabled: busy || owned })}
        >
          <Plus size={14} />
          {owned ? "Added" : "Add"}
        </button>

        <button
          type="button"
          onClick={onToggleFavorite}
          disabled={busy}
          style={buttonStyle({ disabled: busy })}
        >
          <Star size={14} />
          {favorited ? "Saved" : "Save"}
        </button>

        <Link href={`/market/${encodeURIComponent(item.symbol)}`} style={buttonStyle()}>
          <ExternalLink size={14} />
          Open
        </Link>
      </div>
    </div>
  );
}

function EmptyState({ title, detail }) {
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
      </div>
    </div>
  );
}

export default function DiscoverInvestmentsPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("stocks");
  const [results, setResults] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [savedSymbols, setSavedSymbols] = useState([]);
  const [prices, setPrices] = useState({});
  const [headlines, setHeadlines] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [loadingResults, setLoadingResults] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [addingSymbol, setAddingSymbol] = useState("");
  const [favoriteSymbol, setFavoriteSymbol] = useState("");

  const searchMode = query.trim().length >= 2;

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [assetRes, favoriteRes] = await Promise.all([
        supabase.from("investment_assets").select("symbol").eq("user_id", user.id),
        supabase
          .from("investment_favorites")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (assetRes.error || favoriteRes.error) {
        console.error(assetRes.error || favoriteRes.error);
        setError("Failed loading discover data.");
        return;
      }

      setSavedSymbols((assetRes.data || []).map((x) => String(x.symbol || "").toUpperCase()));
      setFavorites(favoriteRes.data || []);
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!searchMode) {
      setResults([]);
      setLoadingResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingResults(true);
      setError("");

      try {
        const res = await fetch(
          `/api/market-search?query=${encodeURIComponent(query)}&type=ALL&limit=24`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Failed to search market.");
        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch (err) {
        console.error(err);
        setResults([]);
        setError(err?.message || "Failed to search market.");
      } finally {
        setLoadingResults(false);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [query, searchMode]);

  const activeRows = useMemo(() => {
    if (searchMode) return results;
    return DEFAULT_UNIVERSE[tab] || DEFAULT_UNIVERSE.stocks;
  }, [searchMode, results, tab]);

  const allKnownRows = useMemo(() => {
    return [
      ...DEFAULT_UNIVERSE.stocks,
      ...DEFAULT_UNIVERSE.etfs,
      ...DEFAULT_UNIVERSE.sectors,
      ...results,
      ...favorites,
    ];
  }, [results, favorites]);

  useEffect(() => {
    const symbols = [
      ...new Set(
        [
          ...activeRows.map((x) => String(x.symbol || "").toUpperCase()),
          ...favorites.map((x) => String(x.symbol || "").toUpperCase()),
        ].filter(Boolean)
      ),
    ];

    async function loadPrices() {
      if (!symbols.length) {
        setPrices({});
        return;
      }

      const nextPrices = {};

      try {
        const batchRes = await fetch(
          `/api/prices-batch?symbols=${encodeURIComponent(symbols.join(","))}`,
          { cache: "no-store" }
        );
        const batchData = await batchRes.json();

        if (batchRes.ok) {
          Object.assign(nextPrices, parseBatchPrices(batchData));
        }
      } catch (err) {
        console.error("batch price fetch failed", err);
      }

      const missing = symbols.filter((sym) => {
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
                  price: toNum(data?.price),
                  change: toNum(data?.change),
                  changesPercentage: toNum(
                    data?.changesPercentage ?? data?.changePercent ?? data?.percent_change
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
  }, [activeRows, favorites]);

  useEffect(() => {
    if (!activeRows.length) return;

    const hasSelected = activeRows.some(
      (item) => String(item.symbol || "").toUpperCase() === String(selectedSymbol || "").toUpperCase()
    );

    if (!selectedSymbol || !hasSelected) {
      setSelectedSymbol(String(activeRows[0]?.symbol || "").toUpperCase());
    }
  }, [activeRows, selectedSymbol]);

  const selectedItem = useMemo(() => {
    const sym = String(selectedSymbol || "").toUpperCase();
    return allKnownRows.find((x) => String(x.symbol || "").toUpperCase() === sym) || null;
  }, [selectedSymbol, allKnownRows]);

  const selectedQuote = selectedSymbol ? prices[String(selectedSymbol).toUpperCase()] : null;
  const selectedTone = toneByChange(
    selectedQuote?.changesPercentage ?? selectedQuote?.change ?? 0
  );

  useEffect(() => {
    async function loadHeadlines() {
      const sym = String(selectedSymbol || "").toUpperCase().trim();
      if (!sym) {
        setHeadlines([]);
        return;
      }

      try {
        const res = await fetch(
          `/api/stock-news?symbols=${encodeURIComponent(sym)}&limit=6`,
          { cache: "no-store" }
        );
        const data = await res.json();
        setHeadlines(res.ok && Array.isArray(data?.articles) ? data.articles : []);
      } catch (err) {
        console.error("headline fetch failed", err);
        setHeadlines([]);
      }
    }

    loadHeadlines();
  }, [selectedSymbol]);

  const stats = useMemo(() => {
    const ownedMatches = activeRows.filter((x) =>
      savedSymbols.includes(String(x.symbol || "").toUpperCase())
    ).length;

    const favoriteMatches = activeRows.filter((x) =>
      favorites.some(
        (f) => String(f.symbol || "").toUpperCase() === String(x.symbol || "").toUpperCase()
      )
    ).length;

    return {
      visible: activeRows.length,
      ownedMatches,
      favoriteMatches,
    };
  }, [activeRows, savedSymbols, favorites]);

  async function addAsset(item) {
    setStatus("");
    setError("");
    setAddingSymbol(item.symbol);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in.");
        setAddingSymbol("");
        return;
      }

      const symbol = String(item.symbol || "").toUpperCase().trim();

      if (!symbol) {
        setError("Invalid symbol.");
        setAddingSymbol("");
        return;
      }

      if (savedSymbols.includes(symbol)) {
        setError(`${symbol} is already in your portfolio.`);
        setAddingSymbol("");
        return;
      }

      const { data, error } = await supabase
        .from("investment_assets")
        .insert({
          user_id: user.id,
          symbol,
          name: item.name,
          asset_type: String(item.type || "").toUpperCase() === "ETF" ? "etf" : "stock",
          account: "Brokerage",
        })
        .select()
        .single();

      if (error) {
        console.error(error);
        setError(`Could not add ${symbol}.`);
        setAddingSymbol("");
        return;
      }

      setSavedSymbols((prev) => [...prev, String(data.symbol || "").toUpperCase()]);
      setStatus(`${data.symbol} added to portfolio.`);
    } catch (err) {
      console.error(err);
      setError("Something went wrong adding the asset.");
    }

    setAddingSymbol("");
  }

  async function addFavorite(item) {
    setStatus("");
    setError("");
    setFavoriteSymbol(item.symbol);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in.");
        setFavoriteSymbol("");
        return;
      }

      const symbol = String(item.symbol || "").toUpperCase().trim();

      if (!symbol) {
        setError("Invalid symbol.");
        setFavoriteSymbol("");
        return;
      }

      const alreadyFavorite = favorites.some(
        (f) => String(f.symbol || "").toUpperCase() === symbol
      );

      if (alreadyFavorite) {
        setError(`${symbol} is already in favorites.`);
        setFavoriteSymbol("");
        return;
      }

      const { data, error } = await supabase
        .from("investment_favorites")
        .insert({
          user_id: user.id,
          symbol,
          name: item.name,
          asset_type: String(item.type || "").toUpperCase() === "ETF" ? "etf" : "stock",
        })
        .select()
        .single();

      if (error) {
        console.error(error);
        setError(`Could not favorite ${symbol}.`);
        setFavoriteSymbol("");
        return;
      }

      setFavorites((prev) => [data, ...prev]);
      setStatus(`${data.symbol} added to favorites.`);
    } catch (err) {
      console.error(err);
      setError("Something went wrong adding the favorite.");
    }

    setFavoriteSymbol("");
  }

  async function removeFavoriteBySymbol(symbol) {
    setStatus("");
    setError("");
    setFavoriteSymbol(symbol);

    const favorite = favorites.find(
      (f) => String(f.symbol || "").toUpperCase() === String(symbol || "").toUpperCase()
    );

    if (!favorite) {
      setFavoriteSymbol("");
      return;
    }

    const { error } = await supabase.from("investment_favorites").delete().eq("id", favorite.id);

    if (error) {
      console.error(error);
      setError(`Could not remove ${symbol} from favorites.`);
      setFavoriteSymbol("");
      return;
    }

    setFavorites((prev) => prev.filter((f) => f.id !== favorite.id));
    setStatus(`${symbol} removed from favorites.`);
    setFavoriteSymbol("");
  }

  return (
    <>
      <main className="discoverRoot">
        <div className="discoverInner">
          <GlassPane size="card">
            <div className="discoverHeroGrid">
              <div style={{ minWidth: 0 }}>
                <div style={overlineStyle()}>Research Desk</div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: "clamp(26px, 3.3vw, 38px)",
                    lineHeight: 0.98,
                    fontWeight: 900,
                    letterSpacing: "-0.06em",
                    color: "#fff",
                  }}
                >
                  Screen, research, route
                </div>

                <div style={{ marginTop: 10, ...mutedStyle(), maxWidth: 780 }}>
                  This page is for finding names fast. It is supposed to feel tighter and more
                  professional than the overview, like an actual research terminal.
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
                <MiniPill>{searchMode ? "Search live" : tab}</MiniPill>
                <ActionLink href="/investments">
                  Back to Overview <ArrowRight size={14} />
                </ActionLink>
              </div>
            </div>
          </GlassPane>

          {(status || error) && (
            <GlassPane tone={error ? "red" : "green"} size="card">
              <div style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>
                {error || status}
              </div>
            </GlassPane>
          )}

          <section className="discoverStats">
            <CompactStat label="Visible Rows" value={String(stats.visible)} />
            <CompactStat label="Owned in View" value={String(stats.ownedMatches)} />
            <CompactStat label="Saved in View" value={String(stats.favoriteMatches)} />
          </section>

          <section className="discoverMain">
            <div className="discoverLeftCol">
              <GlassPane size="card">
                <PaneHeader
                  title="Market screener"
                  subcopy="Search first. Browse by category when you are not in search mode."
                  right={<MiniPill>{searchMode ? "Search mode" : "Universe mode"}</MiniPill>}
                />

                <div style={{ display: "grid", gap: 12 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: 10,
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      <Search
                        size={16}
                        style={{
                          position: "absolute",
                          left: 14,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "rgba(255,255,255,0.46)",
                        }}
                      />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search ticker or company name..."
                        style={{ ...inputStyle(), paddingLeft: 40 }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      style={buttonStyle()}
                    >
                      Clear
                    </button>
                  </div>

                  {!searchMode ? (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {[
                        { key: "stocks", label: "Popular Stocks" },
                        { key: "etfs", label: "Popular ETFs" },
                        { key: "sectors", label: "Sector Exposure" },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setTab(item.key)}
                          style={buttonStyle({ primary: tab === item.key })}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title={searchMode ? "Search results" : "Screener rows"}
                  subcopy={
                    searchMode
                      ? loadingResults
                        ? "Searching live market results."
                        : `${results.length} matches returned.`
                      : "Compact rows so this feels like research, not another dashboard."
                  }
                  right={<MiniPill>{activeRows.length} rows</MiniPill>}
                />

                <div style={{ display: "grid", gap: 8 }}>
                  {activeRows.length ? (
                    activeRows.map((item) => {
                      const sym = String(item.symbol || "").toUpperCase();
                      const alreadyOwned = savedSymbols.includes(sym);
                      const alreadyFavorite = favorites.some(
                        (f) => String(f.symbol || "").toUpperCase() === sym
                      );

                      return (
                        <ResearchRow
                          key={`${sym}-${item.exchange || item.name || "row"}`}
                          item={item}
                          quote={prices[sym] || null}
                          isSelected={selectedSymbol === sym}
                          owned={alreadyOwned}
                          favorited={alreadyFavorite}
                          busy={addingSymbol === sym || favoriteSymbol === sym}
                          onSelect={() => setSelectedSymbol(sym)}
                          onAddAsset={() => addAsset(item)}
                          onToggleFavorite={() =>
                            alreadyFavorite
                              ? removeFavoriteBySymbol(sym)
                              : addFavorite(item)
                          }
                        />
                      );
                    })
                  ) : loadingResults ? (
                    <EmptyState
                      title="Searching..."
                      detail="Pulling live symbols from your market provider."
                    />
                  ) : (
                    <EmptyState
                      title="No matches found"
                      detail="Try a ticker or company name."
                    />
                  )}
                </div>
              </GlassPane>
            </div>

            <div className="discoverRightCol">
              <GlassPane tone={selectedTone} size="card">
                <PaneHeader
                  title="Focus panel"
                  subcopy="Selected symbol research and fast actions."
                  right={<MiniPill tone={selectedTone}>{selectedSymbol || "—"}</MiniPill>}
                />

                <div style={{ display: "grid", gap: 12 }}>
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      padding: 14,
                      borderRadius: 18,
                      border: `1px solid ${toneMeta(selectedTone).border}`,
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                    }}
                  >
                    <div style={overlineStyle()}>{selectedItem?.type || "Asset"}</div>

                    <div
                      style={{
                        fontSize: 28,
                        lineHeight: 1,
                        fontWeight: 900,
                        letterSpacing: "-0.05em",
                        color:
                          selectedTone === "neutral"
                            ? "#fff"
                            : toneMeta(selectedTone).text,
                      }}
                    >
                      {selectedSymbol || "—"}
                    </div>

                    <div style={{ ...mutedStyle(), overflowWrap: "anywhere" }}>
                      {selectedItem?.name || "Select a symbol from the screener."}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginTop: 4,
                      }}
                    >
                      {selectedItem?.exchange ? <MiniPill>{selectedItem.exchange}</MiniPill> : null}
                      {selectedItem?.type ? <MiniPill>{selectedItem.type}</MiniPill> : null}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          minHeight: 72,
                          borderRadius: 14,
                          border: "1px solid rgba(214,226,255,0.10)",
                          padding: 12,
                          background:
                            "linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.008))",
                        }}
                      >
                        <div style={overlineStyle()}>Price</div>
                        <div
                          style={{
                            marginTop: 7,
                            fontSize: 20,
                            fontWeight: 850,
                            color: "#fff",
                          }}
                        >
                          {Number.isFinite(Number(selectedQuote?.price))
                            ? money(selectedQuote.price)
                            : "—"}
                        </div>
                      </div>

                      <div
                        style={{
                          minHeight: 72,
                          borderRadius: 14,
                          border: `1px solid ${toneMeta(selectedTone).border}`,
                          padding: 12,
                          background:
                            "linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.008))",
                        }}
                      >
                        <div style={overlineStyle()}>Change</div>
                        <div
                          style={{
                            marginTop: 7,
                            fontSize: 20,
                            fontWeight: 850,
                            color:
                              selectedTone === "neutral"
                                ? "#fff"
                                : toneMeta(selectedTone).text,
                          }}
                        >
                          {Number.isFinite(Number(selectedQuote?.changesPercentage))
                            ? `${Number(selectedQuote.changesPercentage) >= 0 ? "+" : ""}${Number(
                                selectedQuote.changesPercentage
                              ).toFixed(2)}%`
                            : "—"}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 8,
                        marginTop: 4,
                      }}
                    >
                      {selectedItem ? (
                        <>
                          <button
                            type="button"
                            onClick={() => addAsset(selectedItem)}
                            disabled={
                              !selectedSymbol ||
                              addingSymbol === selectedSymbol ||
                              savedSymbols.includes(selectedSymbol)
                            }
                            style={buttonStyle({
                              disabled:
                                !selectedSymbol ||
                                addingSymbol === selectedSymbol ||
                                savedSymbols.includes(selectedSymbol),
                            })}
                          >
                            <Plus size={14} />
                            {savedSymbols.includes(selectedSymbol) ? "Added" : "Add to Portfolio"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const alreadyFavorite = favorites.some(
                                (f) =>
                                  String(f.symbol || "").toUpperCase() ===
                                  String(selectedSymbol || "").toUpperCase()
                              );

                              if (alreadyFavorite) {
                                removeFavoriteBySymbol(selectedSymbol);
                              } else {
                                addFavorite(selectedItem);
                              }
                            }}
                            disabled={!selectedSymbol || favoriteSymbol === selectedSymbol}
                            style={buttonStyle({
                              disabled: !selectedSymbol || favoriteSymbol === selectedSymbol,
                            })}
                          >
                            <Star size={14} />
                            {favorites.some(
                              (f) =>
                                String(f.symbol || "").toUpperCase() ===
                                String(selectedSymbol || "").toUpperCase()
                            )
                              ? "Saved"
                              : "Save"}
                          </button>
                        </>
                      ) : null}
                    </div>

                    {selectedSymbol ? (
                      <Link
                        href={`/market/${encodeURIComponent(selectedSymbol)}`}
                        style={buttonStyle({ primary: true })}
                      >
                        <ExternalLink size={14} />
                        Open Market View
                      </Link>
                    ) : null}
                  </div>
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="News"
                  subcopy="Live headline rail for the selected symbol."
                  right={<MiniPill>{headlines.length} stories</MiniPill>}
                />

                <div style={{ display: "grid", gap: 8 }}>
                  {headlines.length === 0 ? (
                    <EmptyState
                      title="No headlines returned"
                      detail="Pick a symbol or make sure the news route is wired."
                    />
                  ) : (
                    headlines.map((item, index) => (
                      <FocusHeadline key={`${item.url}-${index}`} item={item} />
                    ))
                  )}
                </div>
              </GlassPane>

              <GlassPane size="card">
                <PaneHeader
                  title="Watchlist"
                  subcopy="Saved names stay visible while you screen."
                  right={<MiniPill>{favorites.length} saved</MiniPill>}
                />

                <div style={{ display: "grid", gap: 8 }}>
                  {favorites.length === 0 ? (
                    <EmptyState
                      title="No saved names"
                      detail="Save symbols from the screener and they land here."
                    />
                  ) : (
                    favorites
                      .slice(0, 8)
                      .map((item) => (
                        <WatchlistRow
                          key={item.id}
                          item={item}
                          quote={prices[String(item.symbol || "").toUpperCase()] || null}
                        />
                      ))
                  )}
                </div>
              </GlassPane>
            </div>
          </section>
        </div>
      </main>

      <style jsx global>{`
        .discoverRoot {
          position: relative;
          z-index: 1;
          padding: 18px 0 28px;
          font-family: ${FONT_STACK};
        }

        .discoverInner {
          width: min(100%, 1380px);
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }

        .discoverHeroGrid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
        }

        .discoverStats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .discoverMain {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(340px, 0.82fr);
          gap: 14px;
          align-items: start;
        }

        .discoverLeftCol,
        .discoverRightCol {
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        @media (max-width: 1260px) {
          .discoverStats {
            grid-template-columns: 1fr 1fr;
          }

          .discoverMain {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 860px) {
          .discoverRoot {
            padding: 10px 0 22px;
          }

          .discoverInner {
            gap: 12px;
          }

          .discoverHeroGrid,
          .discoverStats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}