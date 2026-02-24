export const dynamic = "force-dynamic";

/**
 * POST /api/quotes
 * Body: { symbols: [{ symbol, type, cgId }] }
 * Returns: { quotes: { [symbolKey]: { price, source, ts } }, errors: { [symbolKey]: string } }
 *
 * - Crypto: uses CoinGecko simple price endpoint
 * - Stocks/ETFs: optional Alpha Vantage GLOBAL_QUOTE (requires ALPHAVANTAGE_API_KEY)
 */

function json(res, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function normKey(x) {
  return String(x || "").trim().toUpperCase();
}

async function fetchCoinGeckoPrices(cryptoItems) {
  // cryptoItems: [{ key, cgId }]
  const out = { quotes: {}, errors: {} };
  if (!cryptoItems.length) return out;

  // CoinGecko expects ids, not symbols, for /simple/price. :contentReference[oaicite:2]{index=2}
  const ids = cryptoItems.map((x) => x.cgId).filter(Boolean);
  if (!ids.length) {
    cryptoItems.forEach((x) => (out.errors[x.key] = "Missing CoinGecko id (cgId)"));
    return out;
  }

  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=" +
    encodeURIComponent(ids.join(",")) +
    "&vs_currencies=usd";

  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    cryptoItems.forEach((x) => (out.errors[x.key] = `CoinGecko error: ${r.status} ${t}`));
    return out;
  }

  const data = await r.json();
  const ts = Date.now();

  cryptoItems.forEach((x) => {
    const v = data?.[x.cgId]?.usd;
    if (typeof v === "number") {
      out.quotes[x.key] = { price: v, source: "coingecko", ts };
    } else {
      out.errors[x.key] = "CoinGecko: price not found for cgId";
    }
  });

  return out;
}

async function fetchAlphaVantagePrices(stockItems) {
  // stockItems: [{ key, symbol }]
  const out = { quotes: {}, errors: {} };
  if (!stockItems.length) return out;

  const key = process.env.ALPHAVANTAGE_API_KEY;
  if (!key) {
    stockItems.forEach((x) => (out.errors[x.key] = "Missing ALPHAVANTAGE_API_KEY (stocks will stay manual)"));
    return out;
  }

  // Alpha Vantage has a “Global Quote” endpoint (per-symbol). :contentReference[oaicite:3]{index=3}
  // We'll do a simple parallel fetch (small portfolios are fine).
  await Promise.all(
    stockItems.map(async (x) => {
      try {
        const url =
          "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=" +
          encodeURIComponent(x.symbol) +
          "&apikey=" +
          encodeURIComponent(key);

        const r = await fetch(url, { headers: { accept: "application/json" } });
        const data = await r.json().catch(() => ({}));

        const priceStr = data?.["Global Quote"]?.["05. price"];
        const price = Number(priceStr);

        if (Number.isFinite(price) && price > 0) {
          out.quotes[x.key] = { price, source: "alphavantage", ts: Date.now() };
        } else {
          out.errors[x.key] = "Alpha Vantage: price not found (symbol?)";
        }
      } catch (e) {
        out.errors[x.key] = `Alpha Vantage error: ${e?.message || "unknown"}`;
      }
    })
  );

  return out;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const symbols = Array.isArray(body?.symbols) ? body.symbols : [];

    // Build normalized request list
    const crypto = [];
    const stocks = [];
    const allKeys = new Set();

    for (const s of symbols) {
      const type = String(s?.type || "").toLowerCase();
      const symbol = normKey(s?.symbol);
      const cgId = String(s?.cgId || "").trim();

      if (!symbol) continue;

      const key = `${type || "other"}:${symbol}`;
      if (allKeys.has(key)) continue;
      allKeys.add(key);

      if (type === "crypto") crypto.push({ key, cgId, symbol });
      else if (type === "stock" || type === "etf") stocks.push({ key, symbol });
      // other/cash: skip live pricing
    }

    const [cg, av] = await Promise.all([fetchCoinGeckoPrices(crypto), fetchAlphaVantagePrices(stocks)]);

    return json({
      quotes: { ...cg.quotes, ...av.quotes },
      errors: { ...cg.errors, ...av.errors },
    });
  } catch (e) {
    return json({ error: e?.message || "Bad request" }, 400);
  }
}