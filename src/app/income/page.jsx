"use client";

import { useEffect, useMemo, useState } from "react";

const LS_INCOME = "lcc_income_v1";

function safeParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now());
}

function isoDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthKeyFromISO(iso) {
  const s = String(iso || "");
  return s.length >= 7 ? s.slice(0, 7) : "";
}

function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export default function IncomePage() {
  // settings
  const [goalMonthly, setGoalMonthly] = useState("8000");
  const [goalWeekly, setGoalWeekly] = useState("2000");

  // quick add
  const [date, setDate] = useState(isoDate());
  const [source, setSource] = useState("Paycheck");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  // data
  const [deposits, setDeposits] = useState([]); // {id,date,source,amount,note,createdAt}
  const [status, setStatus] = useState({ msg: "" });
  const [error, setError] = useState("");

  // filters
  const [viewMonth, setViewMonth] = useState(monthKeyFromISO(isoDate()));
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("date_desc"); // date_desc | amt_desc | source_asc

  // load
  useEffect(() => {
    const saved = safeParse(localStorage.getItem(LS_INCOME) || "{}", {});
    const sDeposits = Array.isArray(saved.deposits) ? saved.deposits : [];
    setDeposits(sDeposits);

    if (saved.goalMonthly != null) setGoalMonthly(String(saved.goalMonthly));
    if (saved.goalWeekly != null) setGoalWeekly(String(saved.goalWeekly));
    if (saved.viewMonth) setViewMonth(String(saved.viewMonth));

    setStatus({ msg: "Income loaded ✅" });
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(
        LS_INCOME,
        JSON.stringify({
          deposits,
          goalMonthly: parseMoneyInput(goalMonthly),
          goalWeekly: parseMoneyInput(goalWeekly),
          viewMonth,
        })
      );
    } catch {}
  }, [deposits, goalMonthly, goalWeekly, viewMonth]);

  function addDeposit(e) {
    e.preventDefault();
    setError("");
    setStatus({ msg: "" });

    const dt = String(date || "").trim();
    const src = String(source || "").trim();
    const amt = parseMoneyInput(amount);
    const nt = String(note || "").trim();

    if (!dt) return setError("Date is required.");
    if (!src) return setError("Source is required.");
    if (!Number.isFinite(amt) || amt <= 0) return setError("Amount must be > 0.");

    const id = uid();
    setDeposits((prev) => [
      { id, date: dt, source: src, amount: amt, note: nt, createdAt: Date.now() },
      ...prev,
    ]);

    setAmount("");
    setNote("");
    setStatus({ msg: "Deposit added ✅" });
  }

  function deleteDeposit(id) {
    if (!confirm("Delete this deposit?")) return;
    setDeposits((prev) => prev.filter((d) => d.id !== id));
  }

  function quickPreset(src, amt) {
    setSource(src);
    setAmount(String(amt));
  }

  const computed = useMemo(() => {
    const thisMonth = viewMonth || monthKeyFromISO(isoDate());

    const monthDeposits = deposits.filter((d) => monthKeyFromISO(d.date) === thisMonth);
    const monthTotal = monthDeposits.reduce((s, d) => s + (Number(d.amount) || 0), 0);

    // weekly: last 7 days total from today
    const now = new Date();
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = t0 - 6 * 86400000;

    let weekTotal = 0;
    for (const d of deposits) {
      const t = new Date(String(d.date) + "T00:00:00").getTime();
      if (t >= weekStart && t <= t0) weekTotal += Number(d.amount) || 0;
    }

    const gM = parseMoneyInput(goalMonthly);
    const gW = parseMoneyInput(goalWeekly);

    const monthPct = Number.isFinite(gM) && gM > 0 ? clamp((monthTotal / gM) * 100, 0, 999) : 0;
    const weekPct = Number.isFinite(gW) && gW > 0 ? clamp((weekTotal / gW) * 100, 0, 999) : 0;

    // streak: consecutive days with any deposit (ending today or yesterday)
    const daysWith = new Set(deposits.map((d) => d.date));
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const t = t0 - i * 86400000;
      const di = new Date(t);
      const key = isoDate(di);
      if (daysWith.has(key)) streak++;
      else break;
    }
    // if today is empty, allow streak to start from yesterday (more realistic)
    if (streak === 0) {
      for (let i = 1; i < 365; i++) {
        const t = t0 - i * 86400000;
        const di = new Date(t);
        const key = isoDate(di);
        if (daysWith.has(key)) streak++;
        else break;
      }
    }

    // recent list (filtered)
    const qq = q.trim().toLowerCase();
    let rows = deposits.slice();

    if (qq) {
      rows = rows.filter((d) => {
        const hay = `${d.source} ${d.note} ${d.date}`.toLowerCase();
        return hay.includes(qq);
      });
    }

    rows.sort((a, b) => {
      if (sortBy === "date_desc") return String(b.date).localeCompare(String(a.date)) || (b.createdAt || 0) - (a.createdAt || 0);
      if (sortBy === "amt_desc") return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (sortBy === "source_asc") return String(a.source).localeCompare(String(b.source));
      return 0;
    });

    // month options
    const months = Array.from(new Set(deposits.map((d) => monthKeyFromISO(d.date)).filter(Boolean))).sort().reverse();
    if (!months.includes(thisMonth)) months.unshift(thisMonth);

    return {
      thisMonth,
      monthDeposits,
      monthTotal,
      weekTotal,
      monthPct,
      weekPct,
      streak,
      rows,
      months,
      goalMonthlyNum: Number.isFinite(gM) ? gM : 0,
      goalWeeklyNum: Number.isFinite(gW) ? gW : 0,
    };
  }, [deposits, goalMonthly, goalWeekly, viewMonth, q, sortBy]);

  return (
    <main className="container">
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Income</div>
        <h1 style={{ margin: 0 }}>Income Command</h1>
        <div className="muted" style={{ marginTop: 6 }}>
          This page drives everything. Track deposits + hit your goals.
        </div>
        {status.msg ? <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>{status.msg}</div> : null}
      </header>

      {/* KPIs */}
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="card kpi" style={{ flex: 1, minWidth: 240, padding: 14 }}>
          <div className="muted" style={{ fontSize: 12 }}>This month</div>
          <div className="kpiValue">{money(computed.monthTotal)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Goal {money(computed.goalMonthlyNum)} • {computed.monthPct.toFixed(0)}%
          </div>
          <div className="card" style={{ marginTop: 10, padding: 10 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Month: <b>{computed.thisMonth}</b>
            </div>
          </div>
        </div>

        <div className="card kpi" style={{ flex: 1, minWidth: 240, padding: 14 }}>
          <div className="muted" style={{ fontSize: 12 }}>Last 7 days</div>
          <div className="kpiValue">{money(computed.weekTotal)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Goal {money(computed.goalWeeklyNum)} • {computed.weekPct.toFixed(0)}%
          </div>
          <div className="card" style={{ marginTop: 10, padding: 10 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Momentum matters.
            </div>
          </div>
        </div>

        <div className="card kpi" style={{ flex: 1, minWidth: 240, padding: 14 }}>
          <div className="muted" style={{ fontSize: 12 }}>Streak</div>
          <div className="kpiValue">{computed.streak} days</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Days with at least one deposit logged
          </div>
          <div className="card" style={{ marginTop: 10, padding: 10 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Don’t break the chain.
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* Goals + Quick Add */}
      <div className="row" style={{ gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Goals */}
        <div className="card" style={{ flex: 1, minWidth: 340, padding: 12 }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Income Goals</div>

          <div className="grid" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Monthly goal</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={goalMonthly}
                  onChange={(e) => setGoalMonthly(e.target.value)}
                  placeholder="8000"
                />
              </div>

              <div style={{ flex: 1, minWidth: 160 }}>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Weekly goal</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={goalWeekly}
                  onChange={(e) => setGoalWeekly(e.target.value)}
                  placeholder="2000"
                />
              </div>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 900 }}>Goal Progress</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Month: {computed.monthPct.toFixed(0)}% • Week: {computed.weekPct.toFixed(0)}%
              </div>
            </div>

            <div className="muted" style={{ fontSize: 12 }}>
              Set these once. Everything else runs off income.
            </div>
          </div>
        </div>

        {/* Add Deposit */}
        <div className="card" style={{ flex: 2, minWidth: 420, padding: 12 }}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>Add Deposit</div>

          <form onSubmit={addDeposit} className="grid" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 170 }} />
              <input className="input" placeholder="Source (Paycheck, Bonus, Side hustle...)" value={source} onChange={(e) => setSource(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
              <input className="input" placeholder="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 180 }} />
            </div>

            <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

            {error ? (
              <div className="card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 950 }}>Fix this:</div>
                <div className="muted" style={{ marginTop: 4 }}>{error}</div>
              </div>
            ) : null}

            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn" type="submit">Add Deposit</button>
              <button className="btnGhost" type="button" onClick={() => { setAmount(""); setNote(""); setError(""); }}>
                Clear
              </button>

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btnGhost" type="button" onClick={() => quickPreset("Paycheck", 2000)}>Paycheck $2,000</button>
                <button className="btnGhost" type="button" onClick={() => quickPreset("Bonus", 500)}>Bonus $500</button>
                <button className="btnGhost" type="button" onClick={() => quickPreset("Side Hustle", 200)}>Side $200</button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* History */}
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950 }}>Deposit History</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {computed.rows.length} items • Search + sort below
            </div>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select className="input" value={viewMonth} onChange={(e) => setViewMonth(e.target.value)} style={{ width: 140 }}>
              {computed.months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <input className="input" placeholder="Search source/note/date…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} />

            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: 200 }}>
              <option value="date_desc">Sort: Date (new → old)</option>
              <option value="amt_desc">Sort: Amount (high → low)</option>
              <option value="source_asc">Sort: Source (A → Z)</option>
            </select>
          </div>
        </div>

        <div style={{ height: 10 }} />

        {computed.rows.length === 0 ? (
          <div className="muted">No deposits yet.</div>
        ) : (
          <div className="grid">
            {computed.rows.map((d) => (
              <div key={d.id} className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 950 }}>
                      {money(d.amount)}{" "}
                      <span className="muted" style={{ fontWeight: 800 }}>• {d.source}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Date {d.date}{d.note ? ` • Note: ${d.note}` : ""}
                    </div>
                  </div>

                  <div className="row" style={{ gap: 8 }}>
                    <button className="btnGhost" type="button" onClick={() => deleteDeposit(d.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 12 }} />

        <div className="muted" style={{ fontSize: 12 }}>
          Next upgrade: Auto-calc pay periods + show “needed to hit goal” per day.
        </div>
      </div>
    </main>
  );
}