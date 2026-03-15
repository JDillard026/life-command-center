import { NextResponse } from "next/server";

const DEFAULT_LIMIT = 24;

function normalizeRows(rows = []) {
  return rows
    .map((r) => ({
      symbol: String(r.symbol || "").toUpperCase().trim(),
      name: String(r.name || r.companyName || r.company || "").trim(),
      exchange: String(r.exchangeShortName || r.exchange || "").trim(),
      type: String(r.type || r.assetType || "").trim(),
      currency: String(r.currency || "").trim(),
    }))
    .filter((r) => r.symbol && r.name);
}

function dedupeRows(rows = []) {
  const seen = new Set();
  const out = [];

  for (const row of rows) {
    const key = `${row.symbol}__${row.exchange}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

function friendlyType(row) {
  const raw = String(row.type || "").toLowerCase();

  if (raw.includes("etf")) return "ETF";
  if (raw.includes("fund")) return "Fund";
  if (raw.includes("stock")) return "Stock";
  if (raw.includes("equity")) return "Stock";

  // heuristic fallback
  if (
    row.name.includes("ETF") ||
    row.name.includes("Trust") ||
    row.name.includes("Fund")
  ) {
    return "ETF";
  }

  return "Stock";
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${text.slice(0, 160)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("API returned non-JSON data.");
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const query = String(searchParams.get("query") || "").trim();
    const type = String(searchParams.get("type") || "ALL").trim().toUpperCase();
    const limit = Math.max(
      1,
      Math.min(50, Number(searchParams.get("limit") || DEFAULT_LIMIT))
    );

    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing FMP_API_KEY." }, { status: 500 });
    }

    let rows = [];

    if (query) {
      const [symbolRaw, nameRaw] = await Promise.all([
        fetchJson(
          `https://financialmodelingprep.com/stable/search-symbol?query=${encodeURIComponent(
            query
          )}&apikey=${encodeURIComponent(apiKey)}`
        ),
        fetchJson(
          `https://financialmodelingprep.com/stable/search-name?query=${encodeURIComponent(
            query
          )}&apikey=${encodeURIComponent(apiKey)}`
        ),
      ]);

      rows = dedupeRows([
        ...normalizeRows(Array.isArray(symbolRaw) ? symbolRaw : []),
        ...normalizeRows(Array.isArray(nameRaw) ? nameRaw : []),
      ]);
    } else {
      const stockListRaw = await fetchJson(
        `https://financialmodelingprep.com/stable/stock-list?apikey=${encodeURIComponent(
          apiKey
        )}`
      );

      rows = dedupeRows(normalizeRows(Array.isArray(stockListRaw) ? stockListRaw : []));
    }

    rows = rows.map((r) => ({
      ...r,
      type: friendlyType(r),
    }));

    if (type !== "ALL") {
      rows = rows.filter((r) => r.type.toUpperCase() === type);
    }

    // prioritize cleaner U.S.-style exchange results
    const exchangePriority = {
      NASDAQ: 1,
      NYSE: 2,
      "NYSE ARCA": 3,
      AMEX: 4,
      ARCA: 5,
    };

    rows = rows.sort((a, b) => {
      const aExact = query && a.symbol.toUpperCase() === query.toUpperCase() ? -10 : 0;
      const bExact = query && b.symbol.toUpperCase() === query.toUpperCase() ? -10 : 0;

      if (aExact !== bExact) return aExact - bExact;

      const aStarts =
        query && a.symbol.toUpperCase().startsWith(query.toUpperCase()) ? -5 : 0;
      const bStarts =
        query && b.symbol.toUpperCase().startsWith(query.toUpperCase()) ? -5 : 0;

      if (aStarts !== bStarts) return aStarts - bStarts;

      const ap = exchangePriority[a.exchange.toUpperCase()] || 99;
      const bp = exchangePriority[b.exchange.toUpperCase()] || 99;

      if (ap !== bp) return ap - bp;

      return a.symbol.localeCompare(b.symbol);
    });

    const sliced = rows.slice(0, limit);

    return NextResponse.json({
      query,
      type,
      count: sliced.length,
      results: sliced,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Failed to search market symbols." },
      { status: 500 }
    );
  }
}
