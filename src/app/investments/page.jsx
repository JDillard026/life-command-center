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

export default function InvestmentsPage() {
  const [assets, setAssets] = useState([]);
  const [txns, setTxns] = useState([]);
  const [prices, setPrices] = useState({});
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

      if (assetError || txnError) {
        console.error(assetError || txnError);
        setError("Failed loading investments data.");
        return;
      }

      setAssets(assetRows || []);
      setTxns(txnRows || []);
    }

    load();
  }, []);

  useEffect(() => {
    async function loadPrices() {
      if (!assets.length) {
        setPrices({});
        return;
      }

      setLoadingPrices(true);
      const nextPrices = {};

      for (const a of assets) {
        if (!a.symbol || a.asset_type === "cash") continue;

        try {
          const res = await fetch(`/api/prices?symbol=${encodeURIComponent(a.symbol)}`);
          const data = await res.json();

          if (res.ok && Number.isFinite(Number(data?.price)) && Number(data.price) > 0) {
            nextPrices[a.symbol] = Number(data.price);
          }
        } catch (err) {
          console.error("price fetch failed for", a.symbol, err);
        }
      }

      setPrices(nextPrices);
      setLoadingPrices(false);
    }

    loadPrices();
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

  const portfolio = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;

    const holdings = assets.map((a) => {
      const list = txns.filter((t) => t.asset_id === a.id);

      let shares = 0;
      let cost = 0;

      for (const t of list) {
        const qty = Number(t.qty) || 0;
        const price = Number(t.price) || 0;
        const txnType = String(t.txn_type || "").toUpperCase();

        if (txnType === "BUY") {
          shares += qty;
          cost += qty * price;
        }

        if (txnType === "SELL") {
          shares -= qty;
        }
      }

      const livePrice = Number(prices[a.symbol]);
      const hasLivePrice = Number.isFinite(livePrice) && livePrice > 0;
      const value = hasLivePrice ? shares * livePrice : null;
      const pnl = hasLivePrice ? value - cost : null;
      const avgCost = shares > 0 ? cost / shares : 0;

      if (hasLivePrice) totalValue += value;
      totalCost += cost;

      return {
        ...a,
        shares,
        cost,
        value,
        pnl,
        avgCost,
        livePrice,
        hasLivePrice,
        txCount: list.length,
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
      hasAnyLivePrices: sorted.some((h) => h.hasLivePrice),
    };
  }, [assets, txns, prices]);

  const recentTxns = useMemo(() => {
    return [...txns].slice(0, 8);
  }, [txns]);

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
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 16,
              marginBottom: 18,
            }}
          >
            <MetricCard
              title="Tracked Value"
              value={portfolio.hasAnyLivePrices ? money(portfolio.totalValue) : "Price unavailable"}
              sub={loadingPrices ? "Checking live prices..." : "Live values show when pricing returns."}
            />

            <MetricCard
              title="Total Cost Basis"
              value={money(portfolio.totalCost)}
              sub="Built from your recorded buy trades."
            />

            <MetricCard
              title="Portfolio P/L"
              value={portfolio.hasAnyLivePrices ? money(portfolio.totalPnl) : "Pending live data"}
              sub={
                portfolio.hasAnyLivePrices
                  ? portfolio.totalPnl >= 0
                    ? "Portfolio above cost basis."
                    : "Portfolio below cost basis."
                  : "P/L shows once live prices are available."
              }
              valueTone={
                portfolio.hasAnyLivePrices
                  ? portfolio.totalPnl >= 0
                    ? "good"
                    : "bad"
                  : "default"
              }
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.45fr .95fr",
              gap: 18,
            }}
          >
            <div className="card" style={{ padding: 18 }}>
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
                  <div style={{ fontWeight: 950, fontSize: 20 }}>Top Holdings</div>
                  <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
                    Clean account summary. Open an asset only when you want chart detail.
                  </div>
                </div>

                <Link href="/investments/discover" className="btnGhost">
                  Explore Market
                </Link>
              </div>

              <div style={{ height: 16 }} />

              {!portfolio.holdings.length ? (
                <EmptyState
                  title="No investments yet"
                  sub="Add your first asset, then log a trade to start building your portfolio."
                />
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {portfolio.holdings.slice(0, 8).map((h) => (
                    <div
                      key={h.id}
                      className="card"
                      style={{
                        padding: 14,
                        border: "1px solid rgba(255,255,255,.08)",
                        background: "rgba(255,255,255,.03)",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.15fr .8fr .9fr .9fr auto",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 16 }}>{h.symbol}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                            {h.account || "Main"} • {h.asset_type || "stock"} • {h.txCount} trade{h.txCount === 1 ? "" : "s"}
                          </div>
                        </div>

                        <div>
                          <div className="muted" style={{ fontSize: 12 }}>Shares</div>
                          <div style={{ fontWeight: 850, marginTop: 4 }}>{fmtNumber(h.shares)}</div>
                        </div>

                        <div>
                          <div className="muted" style={{ fontSize: 12 }}>Value</div>
                          <div style={{ fontWeight: 850, marginTop: 4 }}>
                            {h.hasLivePrice ? money(h.value) : "Pending"}
                          </div>
                        </div>

                        <div>
                          <div className="muted" style={{ fontSize: 12 }}>P/L</div>
                          <div
                            style={{
                              fontWeight: 850,
                              marginTop: 4,
                              color: h.hasLivePrice ? (h.pnl >= 0 ? "#4ade80" : "#f87171") : "inherit",
                            }}
                          >
                            {h.hasLivePrice ? money(h.pnl) : "Pending"}
                          </div>
                        </div>

                        <Link href={`/investments/${h.id}`} className="btn">
                          View Asset
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 950, fontSize: 20 }}>Next Upgrade Stack</div>
              <div className="muted" style={{ marginTop: 8, lineHeight: 1.5 }}>
                Now that the dashboard is separated from trader mode, the strongest next upgrades are:
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                <MiniPoint title="Allocation view" sub="Portfolio weights by live market value." />
                <MiniPoint title="Performance cards" sub="1D / 1W / 1M / YTD account change metrics." />
                <MiniPoint title="Watchlist" sub="Track symbols before adding them as holdings." />
                <MiniPoint title="Recent activity" sub="Show latest buy and sell activity on the dashboard." />
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
                gridTemplateColumns: "1.15fr .8fr .9fr .9fr .9fr .9fr 180px",
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
              <div>Action</div>
            </div>

            {portfolio.holdings.length ? (
              portfolio.holdings.map((h) => (
                <div
                  key={h.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.15fr .8fr .9fr .9fr .9fr .9fr 180px",
                    gap: 12,
                    padding: "16px 18px",
                    borderBottom: "1px solid rgba(255,255,255,.08)",
                    alignItems: "center",
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
                    {h.hasLivePrice ? money(h.pnl) : "Pending"}
                  </div>

                  <div>
                    <Link href={`/investments/${h.id}`} className="btn">
                      View Asset
                    </Link>
                  </div>
                </div>
              ))
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
                      }}
                    >
                      <div style={{ fontWeight: 850 }}>{t.txn_type}</div>
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

                    return (
                      <div
                        key={t.id}
                        style={{
                          border: "1px solid rgba(255,255,255,.08)",
                          background: "rgba(255,255,255,.03)",
                          borderRadius: 16,
                          padding: 14,
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
      style={{ minWidth: 110 }}
    >
      {children}
    </button>
  );
}

function MetricCard({ title, value, sub, valueTone = "default" }) {
  const toneColor =
    valueTone === "good"
      ? "#4ade80"
      : valueTone === "bad"
      ? "#f87171"
      : "inherit";

  return (
    <div className="card" style={{ padding: 18 }}>
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