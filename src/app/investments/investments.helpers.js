export const BOARD_SYMBOLS = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq 100" },
  { symbol: "DIA", label: "Dow 30" },
  { symbol: "IWM", label: "Russell 2000" },
];

export const DESK_TABS = ["dashboard", "positions", "research", "ticket", "watchlist"];
export const NEWS_TTL_MS = 1000 * 60 * 5;

export function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function signedMoney(n) {
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

export function pct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
}

export function shortDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function fullDateTime(value) {
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

export function monthLabel() {
  return new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function initials(label = "") {
  const clean = String(label || "").trim();
  if (!clean) return "—";
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
}

export function toneMeta(tone = "neutral") {
  if (tone === "green") {
    return {
      text: "#97efc7",
      border: "rgba(143,240,191,0.16)",
      glow: "rgba(110,229,173,0.10)",
      iconBg: "rgba(12,22,17,0.72)",
    };
  }

  if (tone === "red") {
    return {
      text: "#ffb4c5",
      border: "rgba(255,132,163,0.16)",
      glow: "rgba(255,108,145,0.10)",
      iconBg: "rgba(24,11,15,0.72)",
    };
  }

  if (tone === "amber") {
    return {
      text: "#f5cf88",
      border: "rgba(255,204,112,0.16)",
      glow: "rgba(255,194,92,0.10)",
      iconBg: "rgba(24,18,11,0.72)",
    };
  }

  if (tone === "blue") {
    return {
      text: "#bcd7ff",
      border: "rgba(143,177,255,0.16)",
      glow: "rgba(143,177,255,0.10)",
      iconBg: "rgba(12,16,24,0.72)",
    };
  }

  return {
    text: "#f7fbff",
    border: "rgba(214,226,255,0.13)",
    glow: "rgba(140,170,255,0.08)",
    iconBg: "rgba(12,16,24,0.72)",
  };
}

export function toneByValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "neutral";
  return n > 0 ? "green" : "red";
}

export function parseBatchPrices(json) {
  const out = {};

  function assign(symbol, raw) {
    const sym = String(symbol || "").trim().toUpperCase();
    if (!sym) return;

    if (typeof raw === "number") {
      out[sym] = {
        price: Number.isFinite(raw) ? raw : null,
        change: null,
        changesPercentage: null,
      };
      return;
    }

    if (raw && typeof raw === "object") {
      out[sym] = {
        price: Number.isFinite(Number(raw.price)) ? Number(raw.price) : null,
        change: Number.isFinite(Number(raw.change)) ? Number(raw.change) : null,
        changesPercentage: Number.isFinite(
          Number(raw.changesPercentage ?? raw.changePercent ?? raw.percent_change)
        )
          ? Number(raw.changesPercentage ?? raw.changePercent ?? raw.percent_change)
          : null,
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

export function sameNewsArticles(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    const aKey = `${a[i]?.url || ""}__${a[i]?.publishedDate || ""}__${a[i]?.title || ""}`;
    const bKey = `${b[i]?.url || ""}__${b[i]?.publishedDate || ""}__${b[i]?.title || ""}`;
    if (aKey !== bKey) return false;
  }

  return true;
}

export function buildPortfolio(assets, txns, prices) {
  const txnsByAsset = {};

  for (const txn of txns) {
    const key = txn.asset_id;
    txnsByAsset[key] = txnsByAsset[key] || [];
    txnsByAsset[key].push(txn);
  }

  let totalValue = 0;
  let totalCost = 0;
  let totalRealizedPnl = 0;
  let totalDayMove = 0;

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

    const sym = String(asset.symbol || "").toUpperCase().trim();
    const quote = prices[sym] || null;
    const livePrice = Number.isFinite(Number(quote?.price)) ? Number(quote.price) : null;
    const dayChange = Number.isFinite(Number(quote?.change)) ? Number(quote.change) : null;
    const dayPct = Number.isFinite(Number(quote?.changesPercentage))
      ? Number(quote.changesPercentage)
      : null;

    const hasLivePrice = Number.isFinite(livePrice) && livePrice > 0;
    const value = hasLivePrice ? shares * livePrice : 0;
    const pnl = hasLivePrice ? value - remainingBasis : null;
    const pnlPct =
      hasLivePrice && remainingBasis > 0
        ? ((value - remainingBasis) / remainingBasis) * 100
        : null;
    const positionDayMove =
      hasLivePrice && Number.isFinite(dayChange) ? shares * dayChange : 0;

    if (hasLivePrice) totalValue += value;
    totalCost += remainingBasis;
    totalRealizedPnl += realizedPnl;
    totalDayMove += positionDayMove;

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
      dayChange,
      dayPct,
      positionDayMove,
    };
  });

  return {
    holdings: [...holdings].sort((a, b) => toNum(b.value) - toNum(a.value)),
    totalValue,
    totalCost,
    totalRealizedPnl,
    totalPnl: totalValue - totalCost,
    totalDayMove,
    totalDayPct:
      totalValue - totalDayMove > 0 ? (totalDayMove / (totalValue - totalDayMove)) * 100 : null,
  };
}