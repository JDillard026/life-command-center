"use client";

import { useEffect, useMemo, useState } from "react";

// Prevent Next/Render from trying to pre-render this page during build
export const dynamic = "force-dynamic";

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function daysUntil(iso) {
  if (!iso) return null;
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const d = new Date(iso + "T00:00:00").getTime();
  return Math.round((d - t0) / 86400000);
}

function safeJSONParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export default function CalendarPage() {
  const [selected, setSelected] = useState(todayISO());
  const [note, setNote] = useState("");
  const [events, setEvents] = useState([]);
  const [bills, setBills] = useState([]);

  // Load saved data (client only)
  useEffect(() => {
    const savedEvents = safeJSONParse(localStorage.getItem("lcc_events") || "[]", []);
    setEvents(Array.isArray(savedEvents) ? savedEvents : []);

    const savedBills = safeJSONParse(localStorage.getItem("lcc_bills") || "[]", []);
    setBills(Array.isArray(savedBills) ? savedBills : []);
  }, []);

  // Persist events
  useEffect(() => {
    try {
      localStorage.setItem("lcc_events", JSON.stringify(events));
    } catch {}
  }, [events]);

  const selectedEvents = useMemo(() => {
    return events
      .filter((e) => e?.date === selected)
      .sort((a, b) => (a?.createdAt > b?.createdAt ? -1 : 1));
  }, [events, selected]);

  const upcomingBills = useMemo(() => {
    const withDue = bills.filter((b) => b?.dueDate);
    return withDue.sort((a, b) => (a.dueDate > b.dueDate ? 1 : -1)).slice(0, 10);
  }, [bills]);

  function addEvent(e) {
    e.preventDefault();
    const title = note.trim();
    if (!title) return;

    const id = globalThis.crypto?.randomUUID?.() ?? String(Date.now());

    setEvents((prev) => [
      ...prev,
      { id, title, date: selected, createdAt: Date.now() },
    ]);
    setNote("");
  }

  function removeEvent(id) {
    setEvents((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <main className="container">
      <header style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Calendar
        </div>
        <h1 style={{ margin: 0 }}>Dates & Due Dates</h1>
        <div className="muted" style={{ marginTop: 8 }}>
          Pick a date, add notes/events, and see what’s coming up.
        </div>
      </header>

      <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
        {/* LEFT CARD */}
        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Pick a date</div>

          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <input
              type="date"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="input"
              style={{ flex: 1, minWidth: 220 }}
            />

            <button className="btnGhost" type="button" onClick={() => setSelected(todayISO())}>
              Today
            </button>

            <button
              className="btnGhost"
              type="button"
              onClick={() => {
                const d = new Date(selected + "T00:00:00");
                d.setDate(d.getDate() - 1);
                setSelected(d.toISOString().split("T")[0]);
              }}
            >
              Yesterday
            </button>

            <button
              className="btnGhost"
              type="button"
              onClick={() => {
                const d = new Date(selected + "T00:00:00");
                d.setDate(d.getDate() + 1);
                setSelected(d.toISOString().split("T")[0]);
              }}
            >
              Tomorrow
            </button>
          </div>

          <div style={{ height: 12 }} />

          <div style={{ fontWeight: 800, marginBottom: 8 }}>Add a note/event</div>
          <form onSubmit={addEvent} className="row" style={{ gap: 10 }}>
            <input
              className="input"
              placeholder="Example: Pay HOA, Date night, Gym PR day…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
            <button className="btn" type="submit">
              Add
            </button>
          </form>

          <div style={{ height: 14 }} />

          <div style={{ fontWeight: 900, marginBottom: 8 }}>Events on {fmtDate(selected)}</div>

          {selectedEvents.length === 0 ? (
            <div className="muted">No events for this date.</div>
          ) : (
            <div className="grid">
              {selectedEvents.map((e) => (
                <div key={e.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{e.title}</div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {fmtDate(e.date)}
                      </div>
                    </div>
                    <button className="btnGhost" type="button" onClick={() => removeEvent(e.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT CARD */}
        <div className="card" style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Upcoming bill due dates</div>

          {upcomingBills.length === 0 ? (
            <div className="muted">No bills with due dates yet.</div>
          ) : (
            <div className="grid">
              {upcomingBills.map((b) => {
                const d = daysUntil(b.dueDate);
                const label =
                  d === null
                    ? ""
                    : d === 0
                    ? "Due today"
                    : d > 0
                    ? `Due in ${d} day${d === 1 ? "" : "s"}`
                    : `${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} late`;

                return (
                  <div key={b.id ?? b.name ?? b.dueDate} className="card" style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>{b.name || "Bill"}</div>
                        <div className="muted" style={{ marginTop: 4 }}>
                          {fmtDate(b.dueDate)} • {label}
                        </div>
                      </div>
                      <div className="pill">
                        {b.amount
                          ? Number(b.amount).toLocaleString(undefined, {
                              style: "currency",
                              currency: "USD",
                            })
                          : "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ height: 10 }} />
          <div className="muted" style={{ fontSize: 12 }}>
            Next: wire this into the sidebar + add “Today” widgets on the dashboard.
          </div>
        </div>
      </div>
    </main>
  );
}