export const BOARD_SYMBOLS = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq 100" },
  { symbol: "DIA", label: "Dow 30" },
  { symbol: "IWM", label: "Russell 2000" },
  { symbol: "VTI", label: "Total Market" },
  { symbol: "XLF", label: "Financials" },
];

export const DISCOVER_TYPES = ["ALL", "STOCK", "ETF", "FUND"];

export const DISCOVER_QUICK_SEARCHES = [
  "NVDA",
  "AAPL",
  "MSFT",
  "AMZN",
  "META",
  "TSLA",
  "SPY",
  "QQQ",
  "VOO",
  "VTI",
];

export function asSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

export function toNum(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function money(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function moneyTight(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function compactNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(num);
}

export function signedMoney(value) {
  const num = Number(value);
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

export function pct(value) {
  const num = Number(value);
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
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function toneMeta(tone = "neutral") {
  if (tone === "green") {
    return {
      text: "#8ef1bf",
      border: "rgba(109, 239, 170, 0.18)",
      glow: "rgba(87, 230, 158, 0.12)",
      iconBg: "rgba(8, 22, 15, 0.78)",
      softBg: "rgba(8, 22, 15, 0.42)",
    };
  }

  if (tone === "red") {
    return {
      text: "#ffb3c4",
      border: "rgba(255, 120, 156, 0.18)",
      glow: "rgba(255, 109, 152, 0.12)",
      iconBg: "rgba(24, 10, 14, 0.78)",
      softBg: "rgba(24, 10, 14, 0.42)",
    };
  }

  if (tone === "amber") {
    return {
      text: "#f2d38a",
      border: "rgba(244, 202, 103, 0.18)",
      glow: "rgba(244, 202, 103, 0.11)",
      iconBg: "rgba(24, 18, 10, 0.78)",
      softBg: "rgba(24, 18, 10, 0.42)",
    };
  }

  if (tone === "blue") {
    return {
      text: "#bbd6ff",
      border: "rgba(132, 174, 255, 0.18)",
      glow: "rgba(132, 174, 255, 0.11)",
      iconBg: "rgba(10, 15, 25, 0.78)",
      softBg: "rgba(10, 15, 25, 0.42)",
    };
  }

  return {
    text: "#f7fbff",
    border: "rgba(214, 226, 255, 0.13)",
    glow: "rgba(118, 150, 255, 0.08)",
    iconBg: "rgba(10, 15, 25, 0.78)",
    softBg: "rgba(10, 15, 25, 0.42)",
  };
}

export function toneByValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return "neutral";
  return num > 0 ? "green" : "red";
}

export function resolveAssetType(raw) {
  const value = String(raw || "").toUpperCase();
  if (value.includes("ETF")) return "ETF";
  if (value.includes("FUND")) return "Fund";
  if (value.includes("CRYPTO")) return "Crypto";
  return value || "Stock";
}

export function normalizeMarketResults(rows = []) {
  return rows
    .map((row) => ({
      symbol: asSymbol(row.symbol),
      name: String(row.name || "").trim(),
      exchange: String(row.exchange || "").trim(),
      type: resolveAssetType(row.type),
      currency: String(row.currency || "").trim() || "USD",
    }))
    .filter((row) => row.symbol && row.name);
}

export function parseBatchPrices(json) {
  const out = {};

  function assign(symbol, raw) {
    const sym = asSymbol(symbol);
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
        open: Number.isFinite(Number(raw.open)) ? Number(raw.open) : null,
        previousClose: Number.isFinite(Number(raw.previousClose)) ? Number(raw.previousClose) : null,
        dayLow: Number.isFinite(Number(raw.dayLow)) ? Number(raw.dayLow) : null,
        dayHigh: Number.isFinite(Number(raw.dayHigh)) ? Number(raw.dayHigh) : null,
        yearLow: Number.isFinite(Number(raw.yearLow)) ? Number(raw.yearLow) : null,
        yearHigh: Number.isFinite(Number(raw.yearHigh)) ? Number(raw.yearHigh) : null,
        volume: Number.isFinite(Number(raw.volume)) ? Number(raw.volume) : null,
        avgVolume: Number.isFinite(Number(raw.avgVolume)) ? Number(raw.avgVolume) : null,
        marketCap: Number.isFinite(Number(raw.marketCap)) ? Number(raw.marketCap) : null,
        exchange: raw.exchange || null,
        name: raw.name || null,
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
      if (!out[asSymbol(symbol)]) assign(symbol, raw);
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

export function buildPortfolio(assets = [], txns = [], prices = {}) {
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

    const sym = asSymbol(asset.symbol);
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
      symbol: sym,
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


export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function pushUnique(list, value) {
  if (value && !list.includes(value)) {
    list.push(value);
  }
}

export function buildDiscoverDecision({
  row,
  quote,
  newsCount = 0,
  owned = false,
  watched = false,
}) {
  const type = String(row?.type || "").toUpperCase();
  const isETF = type.includes("ETF") || type.includes("FUND");
  const marketCap = Number(quote?.marketCap) || 0;
  const volume = Number(quote?.volume) || 0;
  const changePct = Number(quote?.changesPercentage) || 0;
  const absMove = Math.abs(changePct);

  let longTermScore = 42;
  let traderScore = 38;
  let riskScore = 52;
  let entryScore = 50;

  if (isETF) {
    longTermScore += 18;
    riskScore += 14;
    entryScore += 8;
  }

  if (marketCap >= 500_000_000_000) {
    longTermScore += 18;
    riskScore += 14;
    entryScore += 8;
  } else if (marketCap >= 50_000_000_000) {
    longTermScore += 12;
    riskScore += 8;
    entryScore += 5;
  } else if (marketCap >= 10_000_000_000) {
    longTermScore += 7;
    riskScore += 4;
  } else if (marketCap > 0 && marketCap < 2_000_000_000) {
    riskScore -= 8;
    longTermScore -= 4;
  }

  if (volume >= 20_000_000) {
    traderScore += 18;
    riskScore += 8;
    longTermScore += 6;
  } else if (volume >= 5_000_000) {
    traderScore += 12;
    riskScore += 4;
    longTermScore += 3;
  } else if (volume > 0 && volume < 1_000_000) {
    traderScore -= 10;
    riskScore -= 8;
  }

  if (absMove >= 1 && absMove <= 4) {
    traderScore += 16;
    entryScore += 8;
  } else if (absMove > 4 && absMove <= 8) {
    traderScore += 11;
    entryScore -= 6;
    riskScore -= 10;
  } else if (absMove > 8) {
    traderScore += 5;
    entryScore -= 12;
    riskScore -= 18;
  } else if (absMove < 0.5) {
    traderScore -= 6;
  }

  if (changePct < -0.5 && changePct > -4) {
    entryScore += 7;
  }

  if (changePct > 3) {
    entryScore -= 5;
  }

  if (newsCount >= 4) {
    traderScore += 6;
  }

  if (owned) {
    longTermScore += 2;
  }

  if (watched) {
    entryScore += 2;
  }

  longTermScore = clamp(Math.round(longTermScore));
  traderScore = clamp(Math.round(traderScore));
  riskScore = clamp(Math.round(riskScore));
  entryScore = clamp(Math.round(entryScore));
  const overallScore = clamp(
    Math.round(longTermScore * 0.34 + traderScore * 0.26 + riskScore * 0.2 + entryScore * 0.2)
  );

  const style = longTermScore >= traderScore ? "long_term" : "trader";
  let verdict = "Watch list candidate";
  let verdictSub = "There is something here, but the setup is not screaming yet.";

  if (longTermScore >= 74 && entryScore >= 64 && riskScore >= 60) {
    verdict = "Strong long-term candidate";
    verdictSub = "Quality / size / stability look stronger than the average name.";
  } else if (longTermScore >= 72 && entryScore < 64) {
    verdict = "Good company, bad entry";
    verdictSub = "The name looks stronger than the current entry quality.";
  } else if (traderScore >= 72 && entryScore >= 60) {
    verdict = "Actionable trader setup";
    verdictSub = "Movement and liquidity are strong enough to pay attention right now.";
  } else if (traderScore >= 70 && riskScore < 58) {
    verdict = "Fast mover, higher-risk setup";
    verdictSub = "The move is real, but the risk and extension are higher too.";
  } else if (longTermScore < 54 && traderScore < 54) {
    verdict = "Weak candidate right now";
    verdictSub = "Not enough quality, setup, or structure to force the trade.";
  }

  const whyNow = [];
  const whyNot = [];
  const watchFor = [];

  if (isETF) pushUnique(whyNow, "ETF structure lowers single-company risk.");
  if (marketCap >= 50_000_000_000) pushUnique(whyNow, "Large size adds durability and attention.");
  if (volume >= 5_000_000) pushUnique(whyNow, "Liquidity is strong enough for cleaner entries and exits.");
  if (absMove >= 1 && absMove <= 4) pushUnique(whyNow, "Price action is active without looking completely insane.");
  if (newsCount >= 3) pushUnique(whyNow, "News flow is active, so there is a real reason people are watching.");

  if (absMove > 4) pushUnique(whyNot, "The move may already be extended for a fresh entry.");
  if (volume > 0 && volume < 1_000_000) pushUnique(whyNot, "Liquidity is weaker than ideal.");
  if (marketCap > 0 && marketCap < 2_000_000_000) pushUnique(whyNot, "Smaller-cap names usually carry more downside noise.");
  if (riskScore < 55) pushUnique(whyNot, "Risk profile is elevated compared with cleaner candidates.");
  if (!quote?.marketCap) pushUnique(whyNot, "The light model is missing deeper fundamental context.");

  if (changePct < -0.5) pushUnique(watchFor, "A cleaner reclaim after the current weakness.");
  if (changePct > 3) pushUnique(watchFor, "A pullback into a less stretched entry.");
  if (volume >= 5_000_000) pushUnique(watchFor, "Continued volume confirmation.");
  pushUnique(
    watchFor,
    style === "trader"
      ? "A tighter entry zone and invalidation level."
      : "A better price relative to your long-term thesis."
  );
  pushUnique(watchFor, "Whether the next catalyst strengthens or weakens the thesis.");

  return {
    style,
    overallScore,
    longTermScore,
    traderScore,
    riskScore,
    entryScore,
    verdict,
    verdictSub,
    whyNow,
    whyNot,
    watchFor,
  };
}
