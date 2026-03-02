"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

function safeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function niceErr(e) {
  return e?.message || "Something went wrong.";
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const disabled = useMemo(() => {
    return loading || !safeEmail(email) || String(pass || "").length < 6;
  }, [loading, email, pass]);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (data?.session) router.replace("/");
    })();
  }, [router]);

  async function onEmailAuth(e) {
    e.preventDefault();
    setMsg("");

    if (!supabase) {
      setMsg("Missing Supabase env vars in Render/.env.local.");
      return;
    }

    setLoading(true);
    try {
      const em = safeEmail(email);

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: em,
          password: pass,
        });
        if (error) throw error;

        setMsg("Signup OK. If email confirmation is enabled, check your inbox. Then log in.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: em,
          password: pass,
        });
        if (error) throw error;

        router.replace("/");
      }
    } catch (err) {
      setMsg(niceErr(err));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setMsg("");
    if (!supabase) {
      setMsg("Missing Supabase env vars in Render/.env.local.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      // after this, it redirects away
    } catch (err) {
      setMsg(niceErr(err));
      setLoading(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 900 }}>
      <header style={{ marginBottom: 16 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
          Life Command Center
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <div>
            <h1 style={{ margin: 0 }}>Login</h1>
            <div className="muted" style={{ marginTop: 8 }}>
              Separate accounts per person (Supabase Auth).
            </div>
          </div>

          <span className="pill" style={{ padding: "8px 10px" }}>
            Mode: <b>{mode === "login" ? "Login" : "Create account"}</b>
          </span>
        </div>
      </header>

      <div className="row" style={{ gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        <div className="card" style={{ padding: 14, flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>{mode === "login" ? "Login" : "Create account"}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Password must be at least 6 characters.
          </div>

          <div style={{ height: 10 }} />

          <form onSubmit={onEmailAuth} className="grid" style={{ gap: 10 }}>
            <input
              className="input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              className="input"
              placeholder="Password"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            <button className="btn" type="submit" disabled={disabled}>
              {loading ? "Working..." : mode === "login" ? "Login" : "Create account"}
            </button>
          </form>

          <div style={{ height: 10 }} />

          <button className="btnGhost" type="button" onClick={onGoogle} disabled={loading}>
            Continue with Google
          </button>

          <div style={{ height: 12 }} />

          {msg ? (
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 950 }}>Status</div>
              <div className="muted" style={{ marginTop: 6 }}>{msg}</div>
            </div>
          ) : null}

          <div style={{ height: 12 }} />

          <div className="muted" style={{ fontSize: 12 }}>
            {mode === "login" ? (
              <>
                No account?{" "}
                <button className="btnGhost" type="button" onClick={() => setMode("signup")} disabled={loading}>
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button className="btnGhost" type="button" onClick={() => setMode("login")} disabled={loading}>
                  Login
                </button>
              </>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 14, flex: 1, minWidth: 320 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>What this does</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Login first. Then we move Accounts/Bills/Investments data into the DB per user.
          </div>

          <div style={{ height: 10 }} />

          <div className="grid" style={{ gap: 10 }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 950 }}>Separate data per person</div>
              <div className="muted" style={{ marginTop: 6 }}>
                No more shared localStorage chaos.
              </div>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 950 }}>Works across devices</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Phone and PC match (once we move data to DB).
              </div>
            </div>

            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 950 }}>Apple later</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Apple sign-in needs Apple Developer ($). We’ll add it when you’re ready.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}