"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

function niceErr(e) {
  return e?.message || "Something went wrong.";
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [msg, setMsg] = useState("");

  // simple prefs placeholders (local only for now)
  const [prefs, setPrefs] = useState({ compactUI: false });

  useEffect(() => {
    (async () => {
      try {
        setMsg("");
        if (!supabase) {
          setMsg("Supabase is not configured (missing env vars).");
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        setUserEmail(data?.user?.email || "");
      } catch (e) {
        setMsg(niceErr(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statusPill = useMemo(() => {
    if (loading) return { text: "Loading…", ok: true };
    if (!userEmail) return { text: "Not signed in", ok: false };
    return { text: "Signed in", ok: true };
  }, [loading, userEmail]);

  async function logout() {
    setMsg("");
    try {
      setLoading(true);
      await supabase?.auth.signOut();
      router.replace("/login");
    } catch (e) {
      setMsg(niceErr(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 980 }}>
      <header style={{ marginBottom: 16 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Settings
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "baseline",
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Settings</h1>
            <div className="muted" style={{ marginTop: 8 }}>
              Account • Integrations • Preferences
            </div>
          </div>

          <span className="pill" style={{ padding: "8px 10px" }}>
            Status: <b>{statusPill.text}</b>
          </span>
        </div>
      </header>

      {msg ? (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <div style={{ fontWeight: 950 }}>Notice</div>
          <div className="muted" style={{ marginTop: 6 }}>{msg}</div>
        </div>
      ) : null}

      <div className="row" style={{ gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        {/* Account */}
        <div className="card" style={{ padding: 14, flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Account</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Who’s logged in right now.
          </div>

          <div style={{ height: 12 }} />

          <div className="card" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12 }}>Email</div>
            <div style={{ fontWeight: 950, marginTop: 6 }}>
              {loading ? "Loading…" : userEmail || "—"}
            </div>
          </div>

          <div style={{ height: 12 }} />

          <button className="btn" type="button" onClick={logout} disabled={loading}>
            Logout
          </button>

          <div style={{ height: 10 }} />
          <div className="muted" style={{ fontSize: 12 }}>
            If login “disappears” on desktop, it usually means you’re already signed in. Logout forces it back.
          </div>
        </div>

        {/* Integrations */}
        <div className="card" style={{ padding: 14, flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Integrations</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Connect banks + automate transactions (future).
          </div>

          <div style={{ height: 12 }} />

          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <div style={{ fontWeight: 950 }}>Plaid</div>
              <span className="pill" style={{ padding: "6px 10px" }}>Coming soon</span>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              This will pull balances + transactions automatically.
            </div>

            <div style={{ height: 10 }} />
            <button className="btnGhost" type="button" disabled title="Not wired yet">
              Connect Plaid (disabled)
            </button>
          </div>

          <div style={{ height: 12 }} />
          <div className="muted" style={{ fontSize: 12 }}>
            We’ll wire this after database tables are live (so each user’s bank data stays isolated).
          </div>
        </div>

        {/* Preferences */}
        <div className="card" style={{ padding: 14, flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Preferences</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Small quality-of-life switches (local for now).
          </div>

          <div style={{ height: 12 }} />

          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 950 }}>Compact UI</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Tighter spacing (future).
                </div>
              </div>

              <button
                className={prefs.compactUI ? "btn" : "btnGhost"}
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, compactUI: !p.compactUI }))}
              >
                {prefs.compactUI ? "On" : "Off"}
              </button>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div className="card" style={{ padding: 12 }}>
            <div style={{ fontWeight: 950 }}>Data</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Later we’ll add: export CSV • import • wipe user data (danger zone).
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}