"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

const LS_KEY = "lcc_investments_portfolio";

function safeParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function parseMoneyInput(v) {
  // allows: 1000, 1,000, $1,000.50
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function parseNumberInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function pct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return `${num.toFixed(2)}%`;
}

const ASSET_TYPES = [
  { value: "stock", label: "Stock" },
  { value: "etf", label: "ETF" },
  { value: "crypto", label: "Crypto" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export default function InvestmentsPage() {
  const [items, setItems] = useState([]);

  // add form
  const [type, setType] = useState("stock");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [account, setAccount] = useState("Main");
  const [shares, setShares] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  // edit
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    type: "stock",
    symbol: "",
    name: "",
    account: "",
    shares: "",
    avgCost: "",
    price: "",
    note: "",
  });

  // load
  useEffect(() => {
    const saved = safeParse(localStorage.getItem(LS_KEY) || "[]", []);
    setItems(Array.isArray(saved) ? saved : []);
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  function addItem(e) {
    e.preventDefault();
    setError("");

    const sym = symbol.trim().toUpperCase();
    const nm = name.trim();
    const acct = account.trim() || "Main";

    // cash can be handled without shares; we treat shares as "units" if provided
    const sh = shares === "" ? (type === "cash" ? 1 : NaN) : parseNumberInput(shares);
    const ac = avgCost === "" ? (type === "cash" ? parseMoneyInput(price || "0") : NaN) : parseMoneyInput(avgCost);
    const pr = price === "" ? NaN : parseMoneyInput(price);

    if (!acct) return setError("Account is required.");
    if (type !== "cash" && !sym) return setError("Symbol is required (ex: VOO, QQQ, BTC).");
    if (type !== "cash" && !Number.isFinite(sh) ) return setError("Shares/units must be a number.");
    if (type !== "cash" && sh <= 0) return setError("Shares/units must be greater than 0.");
    if (type !== "cash" && (!Number.isFinite(ac) || ac <= 0)) return setError("Avg cost must be a number greater than 0.");
    if (!Number.isFinite(pr) || pr < 0) return setError("Current price/value must be a valid number (0 or more).");

    // cash: we store as 1 unit, avgCost = current value, price = current value (so cost==value)
    const normalized = type === "cash"
      ? {
          shares: 1,
          avgCost: pr,
          price: pr,
        }
      : {
          shares: sh,
          avgCost: ac,
          price: pr,
        };

    const id = globalThis.crypto?.randomUUID?.() ?? String(Date.now());

    setItems((prev) => [
      {
        id,
        type,
        symbol: type === "cash" ? "CASH" : sym,
        name: nm,
        account: acct,
        shares: normalized.shares,
        avgCost: normalized.avgCost,
        price: normalized.price,
        note: note.trim(),
        createdAt: Date.now(),
      },
      ...prev,
    ]);

    setType("stock");
    setSymbol("");
    setName("");
    setAccount(acct); // keep same account for speed
    setShares("");
    setAvgCost("");
    setPrice("");
    setNote("");
  }

  function startEdit(it) {
    setEditingId(it.id);
    setError("");
    setEditDraft({
      type: it.type || "stock",
      symbol: it.symbol || "",
      name: it.name || "",
      account: it.account || "Main",
      shares: String(it.shares ?? ""),
      avgCost: String(it.avgCost ?? ""),
      price: String(it.price ?? ""),
      note: it.note || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({
      type: "stock",
      symbol: "",
      name: "",
      account: "",
      shares: "",
      avgCost: "",
      price: "",
      note: "",
    });
  }

  function saveEdit(id) {
    setError("");

    const tp = editDraft.type || "stock";
    const sym = String(editDraft.symbol || "").trim().toUpperCase();
    const nm = String(editDraft.name || "").trim();
    const acct = String(editDraft.account || "").trim() || "Main";

    const sh = editDraft.shares === "" ? (tp === "cash" ? 1 : NaN) : parseNumberInput(editDraft.shares);
    const pr = editDraft.price === "" ? NaN : parseMoneyInput(editDraft.price);
    const ac = editDraft.avgCost === "" ? (tp === "cash" ? pr : NaN) : parseMoneyInput(editDraft.avgCost);

    if (!acct) return setError("Account is required.");
    if (tp !== "cash" && !sym) return setError("Symbol is required.");
    if (tp !== "cash" && (!Number.isFinite(sh) || sh <= 0)) return setError("Shares/units must be greater than 0.");
    if (tp !== "cash" && (!Number.isFinite(ac) || ac <= 0)) return setError("Avg cost must be greater than 0.");
    if (!Number.isFinite(pr) || pr < 0) return setError("Current price/value must be 0 or more.");

    const normalized = tp === "cash"
      ? { shares: 1, avgCost: pr, price: pr }
      : { shares: sh, avgCost: ac, price: pr };

    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              type: tp,
              symbol: tp === "cash" ? "CASH" : sym,
              name: nm,
              account: acct,
              shares: normalized.shares,
              avgCost: normalized.avgCost,
              price: normalized.price,
              note: String(editDraft.note || "").trim(),
            }
          : it
      )
    );

    cancelEdit();
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((x) => x.id !== id));
    if (editingId === id) cancelEdit();
  }

  const computed = useMemo(() => {
    const rows = items.map((it) => {
      const sh = Number(it.shares) || 0;
      const ac = Number(it.avgCost) || 0;
      const pr = Number(it.price) || 0;

      const cost = sh * ac;
      const value = sh * pr;
      const gain = value - cost;
      const gainPct = cost > 0 ? (gain / cost) * 100 : 0;

      return { ...it, cost, value, gain, gainPct };
    });

    const totalValue = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
    const totalCost = rows.reduce((s, r) => s + (Number(r.cost) || 0), 0);
    const totalGain = totalValue - totalCost;
    const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    const byType = rows.reduce((acc, r) => {
      const k = r.type || "other";
      acc[k] = (acc[k] || 0) + (Number(r.value) || 0);
      return acc;
    }, {});

    const byAccount = rows.reduce((acc, r) => {
      const k = r.account || "Main";
      acc[k] = (acc[k] || 0) + (Number(r.value) || 0);
      return acc;
    }, {});

    return { rows, totalValue, totalCost, totalGain, totalGainPct, byType, byAccount };
  }, [items]);

  return (
    <main className="container">
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Investments
        </div>
        <h1 style={{ margin: 0 }}>Portfolio</h1>
        <div className="muted" style={{ marginTop: 8 }}>
          Track holdings, cost basis, and gains. (Manual prices for now — we can add auto-pricing later.)
        </div>
      </header>

      {/* SUMMARY */}
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="card" style={{ padding: 12, flex: 1, minWidth: 220 }}>
          <div className="muted" style={{ fontSize: 12 }}>Total value</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{money(computed.totalValue)}</div>
        </div>

        <div className="card" style={{ padding: 12, flex: 1, minWidth: 220 }}>
          <div className="muted" style={{ fontSize: 12 }}>Total cost</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{money(computed.totalCost)}</div>
        </div>

        <div className="card" style={{ padding: 12, flex: 1, minWidth: 220 }}>
          <div className="muted" style={{ fontSize: 12 }}>Total gain / loss</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            {money(computed.totalGain)} <span className="muted" style={{ fontSize: 12 }}>({pct(computed.totalGainPct)})</span>
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="row" style={{ gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* ADD FORM */}
        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Add holding</div>

          <form onSubmit={addItem} className="grid" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <select
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{ width: 160 }}
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              <input
                className="input"
                placeholder="Account (ex: Fidelity, Robinhood, 401k)"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                style={{ flex: 1, minWidth: 220 }}
              />
            </div>

            <div className="row" style={{ gap: 10 }}>
              <input
                className="input"
                placeholder={type === "cash" ? "Symbol (auto: CASH)" : "Symbol (ex: VOO, QQQ, BTC)"}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                style={{ flex: 1 }}
                disabled={type === "cash"}
              />
              <input
                className="input"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>

            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <input
                className="input"
                inputMode="decimal"
                placeholder={type === "cash" ? "Units (auto)" : "Shares / units"}
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                style={{ width: 170 }}
                disabled={type === "cash"}
              />
              <input
                className="input"
                inputMode="decimal"
                placeholder={type === "cash" ? "Cost (auto)" : "Avg cost"}
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                style={{ width: 170 }}
                disabled={type === "cash"}
              />
              <input
                className="input"
                inputMode="decimal"
                placeholder={type === "cash" ? "Cash value" : "Current price"}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                style={{ width: 170 }}
              />
            </div>

            <input
              className="input"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            {error && (
              <div className="card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 900 }}>Fix this:</div>
                <div className="muted" style={{ marginTop: 4 }}>{error}</div>
              </div>
            )}

            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <button className="btn" type="submit">Add</button>
              <button
                className="btnGhost"
                type="button"
                onClick={() => {
                  setType("stock");
                  setSymbol("");
                  setName("");
                  setShares("");
                  setAvgCost("");
                  setPrice("");
                  setNote("");
                  setError("");
                }}
              >
                Clear
              </button>
            </div>

            <div className="muted" style={{ fontSize: 12 }}>
              Tip: Enter price manually for now. Later we can auto-fetch prices.
            </div>
          </form>
        </div>

        {/* BREAKDOWN */}
        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Breakdown</div>

          <div className="grid" style={{ gap: 10 }}>
            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>By type</div>
              <div className="grid" style={{ gap: 6 }}>
                {Object.keys(computed.byType).length === 0 ? (
                  <div className="muted">No data yet.</div>
                ) : (
                  Object.entries(computed.byType).map(([k, v]) => {
                    const pctOf = computed.totalValue > 0 ? (v / computed.totalValue) * 100 : 0;
                    const label = ASSET_TYPES.find((x) => x.value === k)?.label || k;
                    return (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>{label}</div>
                        <div className="muted">{money(v)} • {pct(pctOf)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>By account</div>
              <div className="grid" style={{ gap: 6 }}>
                {Object.keys(computed.byAccount).length === 0 ? (
                  <div className="muted">No data yet.</div>
                ) : (
                  Object.entries(computed.byAccount).map(([k, v]) => {
                    const pctOf = computed.totalValue > 0 ? (v / computed.totalValue) * 100 : 0;
                    return (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>{k}</div>
                        <div className="muted">{money(v)} • {pct(pctOf)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div style={{ height: 10 }} />
          <div className="muted" style={{ fontSize: 12 }}>
            Next: add “transactions” (buy/sell) so cost basis updates automatically.
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* HOLDINGS LIST */}
      <div className="card">
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Holdings</div>

        {computed.rows.length === 0 ? (
          <div className="muted">No holdings yet. Add your first holding above.</div>
        ) : (
          <div className="grid">
            {computed.rows.map((it) => {
              const isEditing = editingId === it.id;

              return (
                <div key={it.id} className="card" style={{ padding: 12 }}>
                  {isEditing ? (
                    <div className="grid" style={{ gap: 10 }}>
                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <select
                          className="input"
                          value={editDraft.type}
                          onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value }))}
                          style={{ width: 160 }}
                        >
                          {ASSET_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>

                        <input
                          className="input"
                          value={editDraft.account}
                          onChange={(e) => setEditDraft((d) => ({ ...d, account: e.target.value }))}
                          placeholder="Account"
                          style={{ flex: 1, minWidth: 220 }}
                        />
                      </div>

                      <div className="row" style={{ gap: 10 }}>
                        <input
                          className="input"
                          value={editDraft.symbol}
                          onChange={(e) => setEditDraft((d) => ({ ...d, symbol: e.target.value }))}
                          placeholder="Symbol"
                          style={{ flex: 1 }}
                          disabled={editDraft.type === "cash"}
                        />
                        <input
                          className="input"
                          value={editDraft.name}
                          onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                          placeholder="Name (optional)"
                          style={{ flex: 1 }}
                        />
                      </div>

                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <input
                          className="input"
                          value={editDraft.shares}
                          onChange={(e) => setEditDraft((d) => ({ ...d, shares: e.target.value }))}
                          placeholder="Shares"
                          style={{ width: 170 }}
                          disabled={editDraft.type === "cash"}
                        />
                        <input
                          className="input"
                          value={editDraft.avgCost}
                          onChange={(e) => setEditDraft((d) => ({ ...d, avgCost: e.target.value }))}
                          placeholder="Avg cost"
                          style={{ width: 170 }}
                          disabled={editDraft.type === "cash"}
                        />
                        <input
                          className="input"
                          value={editDraft.price}
                          onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value }))}
                          placeholder={editDraft.type === "cash" ? "Cash value" : "Current price"}
                          style={{ width: 170 }}
                        />
                      </div>

                      <input
                        className="input"
                        value={editDraft.note}
                        onChange={(e) => setEditDraft((d) => ({ ...d, note: e.target.value }))}
                        placeholder="Note (optional)"
                      />

                      <div className="row" style={{ gap: 10 }}>
                        <button className="btn" type="button" onClick={() => saveEdit(it.id)}>
                          Save
                        </button>
                        <button className="btnGhost" type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 950, fontSize: 16 }}>
                            {it.type === "cash" ? "Cash" : (it.symbol || "—")}{" "}
                            <span className="muted" style={{ fontWeight: 700 }}>
                              • {it.account || "Main"}
                            </span>
                          </div>

                          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                            {it.name ? `${it.name} • ` : ""}
                            Value {money(it.value)} • Cost {money(it.cost)} • G/L {money(it.gain)} ({pct(it.gainPct)})
                          </div>

                          {it.note ? (
                            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                              Note: {it.note}
                            </div>
                          ) : null}
                        </div>

                        <div className="row" style={{ gap: 8 }}>
                          <button className="btnGhost" type="button" onClick={() => startEdit(it)}>
                            Edit
                          </button>
                          <button className="btnGhost" type="button" onClick={() => removeItem(it.id)}>
                            Delete
                          </button>
                        </div>
                      </div>

                      <div style={{ height: 10 }} />

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="pill">
                          {it.type.toUpperCase()}
                        </div>
                        <div className="pill">
                          {it.type === "cash" ? "VALUE" : "SHARES"}: {it.type === "cash" ? money(it.value) : (Number(it.shares) || 0)}
                        </div>
                        <div className="pill">
                          PRICE: {money(it.price)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}