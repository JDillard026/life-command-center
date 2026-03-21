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

  const [mode, setMode] = useState("login"); // login | signup | reset
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info"); // info | success | error

  const disabled = useMemo(() => {
    if (loading) return true;
    if (!safeEmail(email)) return true;
    if (mode === "reset") return false;
    return String(pass || "").length < 6;
  }, [loading, email, pass, mode]);

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (data?.session) router.replace("/");
    })();
  }, [router]);

  function setStatus(text, type = "info") {
    setMsg(text);
    setMsgType(type);
  }

  async function onEmailAuth(e) {
    e.preventDefault();
    setStatus("");

    if (!supabase) {
      setStatus("Missing Supabase env vars in Render or .env.local.", "error");
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

        setStatus(
          "Account created. If email confirmation is enabled, check your inbox, then log in.",
          "success"
        );
        setMode("login");
        setPass("");
        return;
      }

      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(em, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;

        setStatus("Password reset email sent. Check your inbox.", "success");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: em,
        password: pass,
      });
      if (error) throw error;

      router.replace("/");
    } catch (err) {
      setStatus(niceErr(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setStatus("");

    if (!supabase) {
      setStatus("Missing Supabase env vars in Render or .env.local.", "error");
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
    } catch (err) {
      setStatus(niceErr(err), "error");
      setLoading(false);
    }
  }

  const title =
    mode === "login"
      ? "Welcome back"
      : mode === "signup"
      ? "Create your account"
      : "Reset password";

  const subtitle =
    mode === "login"
      ? "Sign in to your Life Command Center."
      : mode === "signup"
      ? "Create a private account for your own data."
      : "Enter your email and we’ll send you a reset link.";

  const cardBg = "rgba(12, 18, 30, 0.78)";
  const softBorder = "rgba(255,255,255,0.10)";
  const strongBorder = "rgba(255,255,255,0.16)";
  const muted = "rgba(226,232,240,0.68)";
  const inputBg = "rgba(255,255,255,0.045)";

  return (
    <main
      style={{
        minHeight: "100vh",
        color: "#e8eef8",
        background:
          "radial-gradient(circle at top left, rgba(29,78,216,0.18), transparent 28%), radial-gradient(circle at top right, rgba(16,185,129,0.12), transparent 24%), linear-gradient(180deg, #07111f 0%, #091423 42%, #0a1420 100%)",
        padding: "32px 18px",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: 22,
        }}
      >
        <section
          style={{
            border: `1px solid ${softBorder}`,
            background: cardBg,
            borderRadius: 28,
            padding: 28,
            boxShadow: "0 30px 80px rgba(0,0,0,0.42)",
            backdropFilter: "blur(18px)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 18% 18%, rgba(59,130,246,0.14), transparent 22%), radial-gradient(circle at 82% 14%, rgba(34,197,94,0.10), transparent 20%)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                border: `1px solid ${softBorder}`,
                background: "rgba(255,255,255,0.04)",
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                color: "#c6d4ea",
              }}
            >
              Life Command Center
            </div>

            <div style={{ height: 18 }} />

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(30px, 4vw, 54px)",
                lineHeight: 1.02,
                fontWeight: 950,
                letterSpacing: "-0.04em",
              }}
            >
              Secure login for your
              <br />
              financial operating system
            </h1>

            <p
              style={{
                marginTop: 16,
                maxWidth: 620,
                color: muted,
                fontSize: 16,
                lineHeight: 1.65,
              }}
            >
              Separate accounts. Private user data. Cross-device access.
              Cleaner auth. Less chaos.
            </p>

            <div
              style={{
                marginTop: 22,
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              {[
                {
                  title: "Private by user",
                  text: "Each person gets their own account and their own data boundaries.",
                },
                {
                  title: "Works across devices",
                  text: "Phone and desktop stay in sync once your modules are database-backed.",
                },
                {
                  title: "Built to scale",
                  text: "Clean auth now makes the rest of the app easier later.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    border: `1px solid ${softBorder}`,
                    background: "rgba(255,255,255,0.035)",
                    borderRadius: 20,
                    padding: 16,
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 14 }}>{item.title}</div>
                  <div
                    style={{
                      marginTop: 8,
                      color: muted,
                      fontSize: 13,
                      lineHeight: 1.55,
                    }}
                  >
                    {item.text}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 18,
                border: `1px solid ${softBorder}`,
                background:
                  "linear-gradient(135deg, rgba(34,197,94,0.10), rgba(59,130,246,0.08))",
                borderRadius: 22,
                padding: 18,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 14 }}>Current direction</div>
              <div
                style={{
                  marginTop: 8,
                  color: muted,
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                Email/password and Google login stay here. Apple can come later.
                This version is built for your real Next.js + Supabase setup.
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            border: `1px solid ${strongBorder}`,
            background: "rgba(10, 16, 28, 0.92)",
            borderRadius: 28,
            padding: 28,
            boxShadow: "0 26px 80px rgba(0,0,0,0.50)",
            backdropFilter: "blur(18px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  textTransform: "uppercase",
                  letterSpacing: 0.32,
                  color: "#8fb2df",
                  fontWeight: 800,
                }}
              >
                Account access
              </div>
              <h2
                style={{
                  margin: "8px 0 0 0",
                  fontSize: 32,
                  lineHeight: 1.08,
                  fontWeight: 950,
                  letterSpacing: "-0.03em",
                }}
              >
                {title}
              </h2>
              <p
                style={{
                  margin: "10px 0 0 0",
                  color: muted,
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {subtitle}
              </p>
            </div>

            <div
              style={{
                border: `1px solid ${softBorder}`,
                borderRadius: 999,
                padding: "9px 12px",
                background: "rgba(255,255,255,0.04)",
                fontSize: 12,
                color: "#cfe0f7",
                fontWeight: 800,
              }}
            >
              Mode: {mode}
            </div>
          </div>

          <div style={{ height: 18 }} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              padding: 6,
              borderRadius: 18,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${softBorder}`,
            }}
          >
            {[
              { key: "login", label: "Login" },
              { key: "signup", label: "Create account" },
              { key: "reset", label: "Reset password" },
            ].map((item) => {
              const active = mode === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setMode(item.key);
                    setMsg("");
                  }}
                  disabled={loading}
                  style={{
                    borderRadius: 14,
                    border: active ? "1px solid rgba(96,165,250,0.45)" : "1px solid transparent",
                    background: active
                      ? "linear-gradient(135deg, rgba(37,99,235,0.30), rgba(16,185,129,0.18))"
                      : "transparent",
                    color: active ? "#f3f8ff" : "#afc2dd",
                    fontWeight: 800,
                    padding: "12px 10px",
                    cursor: "pointer",
                    transition: "0.2s ease",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div style={{ height: 18 }} />

          <form onSubmit={onEmailAuth} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#cfe0f7", fontWeight: 700 }}>
                Email
              </span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 16,
                  border: `1px solid ${softBorder}`,
                  background: inputBg,
                  color: "#f4f8ff",
                  padding: "0 16px",
                  outline: "none",
                  fontSize: 15,
                }}
              />
            </label>

            {mode !== "reset" ? (
              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#cfe0f7", fontWeight: 700 }}>
                  Password
                </span>

                <div style={{ position: "relative" }}>
                  <input
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    type={showPass ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder={mode === "signup" ? "Create a password" : "Enter your password"}
                    style={{
                      width: "100%",
                      height: 52,
                      borderRadius: 16,
                      border: `1px solid ${softBorder}`,
                      background: inputBg,
                      color: "#f4f8ff",
                      padding: "0 54px 0 16px",
                      outline: "none",
                      fontSize: 15,
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: 10,
                      transform: "translateY(-50%)",
                      border: `1px solid ${softBorder}`,
                      background: "rgba(255,255,255,0.05)",
                      color: "#cfe0f7",
                      borderRadius: 12,
                      height: 34,
                      padding: "0 10px",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>

                <span style={{ fontSize: 12, color: muted }}>
                  {mode === "signup"
                    ? "Use at least 6 characters."
                    : "Use the password tied to this account."}
                </span>
              </label>
            ) : null}

            <button
              type="submit"
              disabled={disabled}
              style={{
                marginTop: 4,
                height: 54,
                borderRadius: 16,
                border: "1px solid rgba(96,165,250,0.28)",
                background: disabled
                  ? "rgba(255,255,255,0.08)"
                  : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 34%, #0f766e 100%)",
                color: "#ffffff",
                fontWeight: 900,
                fontSize: 15,
                cursor: disabled ? "not-allowed" : "pointer",
                boxShadow: disabled ? "none" : "0 18px 40px rgba(37,99,235,0.22)",
              }}
            >
              {loading
                ? "Working..."
                : mode === "login"
                ? "Enter Command Center"
                : mode === "signup"
                ? "Create Account"
                : "Send Reset Email"}
            </button>
          </form>

          <div
            style={{
              margin: "16px 0",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            <div style={{ color: muted, fontSize: 12, fontWeight: 700 }}>OR</div>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          </div>

          <button
            type="button"
            onClick={onGoogle}
            disabled={loading}
            style={{
              width: "100%",
              height: 54,
              borderRadius: 16,
              border: `1px solid ${softBorder}`,
              background: "rgba(255,255,255,0.04)",
              color: "#f4f8ff",
              fontWeight: 850,
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Continue with Google
          </button>

          {msg ? (
            <div
              style={{
                marginTop: 16,
                borderRadius: 18,
                padding: 14,
                border:
                  msgType === "error"
                    ? "1px solid rgba(239,68,68,0.35)"
                    : msgType === "success"
                    ? "1px solid rgba(34,197,94,0.28)"
                    : `1px solid ${softBorder}`,
                background:
                  msgType === "error"
                    ? "rgba(127,29,29,0.20)"
                    : msgType === "success"
                    ? "rgba(20,83,45,0.18)"
                    : "rgba(255,255,255,0.04)",
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 13,
                  color:
                    msgType === "error"
                      ? "#fecaca"
                      : msgType === "success"
                      ? "#bbf7d0"
                      : "#d9e7f8",
                }}
              >
                {msgType === "error"
                  ? "Error"
                  : msgType === "success"
                  ? "Success"
                  : "Status"}
              </div>

              <div
                style={{
                  marginTop: 6,
                  color:
                    msgType === "error"
                      ? "#ffd4d4"
                      : msgType === "success"
                      ? "#dcfce7"
                      : muted,
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {msg}
              </div>
            </div>
          ) : null}

          <div
            style={{
              marginTop: 18,
              paddingTop: 18,
              borderTop: "1px solid rgba(255,255,255,0.08)",
              display: "grid",
              gap: 8,
              color: muted,
              fontSize: 13,
            }}
          >
            <div>
              {mode !== "login" ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setMsg("");
                  }}
                  disabled={loading}
                  style={textButtonStyle}
                >
                  Back to login
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setMsg("");
                  }}
                  disabled={loading}
                  style={textButtonStyle}
                >
                  Need an account? Create one
                </button>
              )}
            </div>

            {mode === "login" ? (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset");
                    setMsg("");
                  }}
                  disabled={loading}
                  style={textButtonStyle}
                >
                  Forgot your password?
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <style jsx>{`
        @media (max-width: 980px) {
          main > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

const textButtonStyle = {
  background: "transparent",
  border: "none",
  color: "#8fb2df",
  padding: 0,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 13,
};