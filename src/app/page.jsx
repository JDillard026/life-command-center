"use client";

import { useEffect, useMemo, useState } from "react";

const LS_BILLS = "lcc_bills_v1";
const LS_PORT_ASSETS = "lcc_port_assets_v1";
const LS_PORT_TXNS = "lcc_port_txns_v1";
const LS_PORT_PRICES = "lcc_port_prices_v1";

function safeParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function isoDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normSymbol(s) {
  return String(s || "").trim().toUpperCase();
}

export default function DashboardPage() {
  // Load ALL localStorage data inside useEffect only (prevents crashes)
  const [bills, setBills] = useState([]);
  const [assets, setAssets] = useState([]);
  const [txns, setTxns] = useState([]);
  const [prices, setPrices] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const b = safeParse(localStorage.getItem(LS_BILLS) || "[]", []);
    const a = safeParse(localStorage.getItem(LS_PORT_ASSETS) || "[]", []);
    const t = safeParse(localStorage.getItem(LS_PORT_TXNS) || "[]", []);
    const p = safeParse(localStorage.getItem(LS_PORT_PRICES) || "{}", {});

    setBills(Array.isArray(b) ? b : []);
    setAssets(Array.isArray(a) ? a : []);
    setTxns(Array.isArray(t) ? t : []);
    setPrices(p && typeof p === "object" ? p : {});
    setLoaded(true);
  }, []);

  const billsTotal = useMemo(() => {
    return bills.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  }, [bills]);

  const investmentsTotal = useMemo(() => {
    const txByAsset = new Map();
    for (const t of txns) {
      const arr = txByAsset.get(t.assetId) || [];
      arr.push(t);
      txByAsset.set(t.assetId, arr);
    }

    let totalValue = 0;

    for (const a of assets) {
      const list = (txByAsset.get(a.id) || [])
        .slice()
        .sort((x, y) => String(x.date).localeCompare(String(y.date)) || (x.createdAt || 0) - (y.createdAt || 0));

      let shares = 0;
      let cashNet = 0;

      for (const t of list) {
        const fee = Number(t.fee) || 0;

        if (t.type === "BUY") shares += Number(t.qty) || 0;
        if (t.type === "SELL") shares -= Number(t.qty) || 0;

        if (t.type === "CASH_IN") cashNet += (Number(t.amount) || 0) - fee;
        if (t.type === "CASH_OUT") cashNet -= (Number(t.amount) || 0) + fee;

        if (t.type === "DIVIDEND") cashNet += Number(t.amount) || 0;
      }

      const key = `${a.type}:${a.type === "cash" ? "CASH" : normSymbol(a.symbol)}`;
      const lastPrice = Number(prices?.[key]?.price) || 0;

      const value = a.type === "cash" ? Math.max(0, cashNet) : Math.max(0, shares) * lastPrice;
      totalValue += value;
    }

    return totalValue;
  }, [assets, txns, prices]);

  const today = isoDate();

  return (
    <main className="container">
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Dashboard</div>
        <h1 style={{ margin: 0 }}>Life Command Center</h1>
        <div className="muted" style={{ marginTop: 6 }}>
          Today: <b>{today}</b> • Overview across bills and investments.
        </div>
      </header>

      {!loaded ? (
        <div className="card" style={{ padding: 12 }}>
          <div style={{ fontWeight: 950 }}>Loading…</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Reading your saved data.
          </div>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div className="card kpi" style={{ flex: 1, minWidth: 240 }}>
              <div className="muted" style={{ fontSize: 12 }}>Investments value</div>
              <div className="kpiValue">{money(investmentsTotal)}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                From Investments ledger
              </div>
            </div>

            <div className="card kpi" style={{ flex: 1, minWidth: 240 }}>
              <div className="muted" style={{ fontSize: 12 }}>Monthly bills</div>
              <div className="kpiValue">{money(billsTotal)}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                From Bills Tracker
              </div>
            </div>

            <div className="card kpi" style={{ flex: 1, minWidth: 240 }}>
              <div className="muted" style={{ fontSize: 12 }}>Status</div>
              <div className="kpiValue">OK</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Local data loaded
              </div>
            </div>
          </div>

          <div style={{ height: 16 }} />

          {/* Next steps */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>Next steps</div>

            <div className="grid">
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 900 }}>1) Spending storage + history</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Hook Daily Spending Quick Add into storage + list.
                </div>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 900 }}>2) Bills recurring automation</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Auto-create next month’s bills and “due soon”.
                </div>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 900 }}>3) Net worth snapshot</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Combine savings + debts + investments into one chart.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}