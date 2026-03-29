export const dynamic = "force-dynamic";

const TTL_MS = 1000 * 60 * 5;
const memoryCache = new Map();

function makeKey(symbols, limit) {
  return `${symbols || "latest"}::${limit}`;
}

function getCached(key) {
  const hit = memoryCache.get(key);
  if (!hit) return null;

  if (Date.now() - hit.ts > TTL_MS) {
    memoryCache.delete(key);
    return null;
  }

  return hit.data;
}

function setCached(key, data) {
  memoryCache.set(key, {
    ts: Date.now(),
    data,
  });
}

function normalizeArticle(row) {
  const symbols = Array.isArray(row?.symbols)
    ? row.symbols
    : row?.symbol
    ? [row.symbol]
    : [];

  return {
    title: row?.title || "",
    text: row?.text || row?.snippet || row?.content || "",
    url: row?.url || row?.link || "",
    publishedDate: row?.publishedDate || row?.published_at || row?.date || "",
    site: row?.site || row?.source || "",
    image: row?.image || row?.image_url || "",
    symbol: row?.symbol || symbols[0] || "",
    symbols,
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = String(searchParams.get("symbols") || "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 8), 1), 20);

    const key = makeKey(symbols, limit);
    const cached = getCached(key);

    if (cached) {
      return Response.json({
        ...cached,
        cached: true,
      });
    }

    const apiKey =
      process.env.FMP_API_KEY ||
      process.env.NEXT_PUBLIC_FMP_API_KEY ||
      process.env.FINANCIAL_MODELING_PREP_API_KEY;

    if (!apiKey) {
      return Response.json({
        articles: [],
        error: "Missing FMP API key.",
        rateLimited: false,
      });
    }

    const url = symbols
      ? `https://financialmodelingprep.com/stable/news/stock?symbols=${encodeURIComponent(
          symbols
        )}&limit=${limit}&apikey=${encodeURIComponent(apiKey)}`
      : `https://financialmodelingprep.com/stable/news/stock-latest?page=0&limit=${limit}&apikey=${encodeURIComponent(
          apiKey
        )}`;

    const res = await fetch(url, {
      cache: "no-store",
    });

    if (res.status === 429) {
      return Response.json({
        articles: cached?.articles || [],
        error: "Research headlines temporarily unavailable.",
        rateLimited: true,
      });
    }

    const text = await res.text();

    if (!res.ok) {
      return Response.json({
        articles: cached?.articles || [],
        error: text || "Failed to load stock news.",
        rateLimited: false,
      });
    }

    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      return Response.json({
        articles: cached?.articles || [],
        error: "News provider returned invalid JSON.",
        rateLimited: false,
      });
    }

    const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];

    const articles = rows
      .map(normalizeArticle)
      .filter((item) => item.title && item.url)
      .sort((a, b) => new Date(b.publishedDate || 0) - new Date(a.publishedDate || 0));

    const payload = {
      articles,
      error: "",
      rateLimited: false,
    };

    setCached(key, payload);

    return Response.json(payload);
  } catch (error) {
    console.error("stock-news route error", error);

    return Response.json({
      articles: [],
      error: "Unexpected stock news error.",
      rateLimited: false,
    });
  }
}