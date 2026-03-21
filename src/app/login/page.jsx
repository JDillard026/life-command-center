"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

function safeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function niceErr(err) {
  return err?.message || "Something went wrong.";
}

function BrandLogo({ size = 64, priority = false }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        borderRadius: Math.round(size * 0.3),
        overflow: "hidden",
        flexShrink: 0,
        border: "1px solid rgba(132, 157, 214, 0.24)",
        background:
          "linear-gradient(180deg, rgba(11,18,32,0.98), rgba(7,12,24,1))",
        boxShadow:
          "0 14px 34px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <Image
        src="/brand/lcc-logo.png"
        alt="Life Command Center logo"
        fill
        priority={priority}
        sizes={`${size}px`}
        style={{ objectFit: "cover" }}
      />
    </div>
  );
}

function StatCard({ title, value, tone = "blue" }) {
  const toneMap = {
    blue: {
      border: "rgba(121, 149, 214, 0.18)",
      bg: "linear-gradient(180deg, rgba(18,25,40,0.82), rgba(10,14,24,0.92))",
      glow: "radial-gradient(circle at 0% 100%, rgba(90,140,255,0.18), transparent 45%)",
    },
    amber: {
      border: "rgba(213, 162, 92, 0.18)",
      bg: "linear-gradient(180deg, rgba(22,19,18,0.82), rgba(12,11,14,0.92))",
      glow: "radial-gradient(circle at 0% 100%, rgba(224,153,67,0.16), transparent 45%)",
    },
    green: {
      border: "rgba(112, 185, 160, 0.18)",
      bg: "linear-gradient(180deg, rgba(14,24,24,0.82), rgba(10,14,18,0.92))",
      glow: "radial-gradient(circle at 100% 100%, rgba(60,185,150,0.16), transparent 45%)",
    },
  };

  const t = toneMap[tone] || toneMap.blue;

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        border: `1px solid ${t.border}`,
        background: t.bg,
        minHeight: 106,
        padding: "18px 18px 16px",
        overflow: "hidden",
        boxShadow:
          "0 16px 36px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: t.glow,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.7,
            textTransform: "uppercase",
            color: "rgba(218,228,250,0.72)",
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 20,
            lineHeight: 1.05,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: "#F4F7FD",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function ModulePill({ children }) {
  return (
    <span
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))",
        color: "rgba(240,244,252,0.90)",
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {children}
    </span>
  );
}

function SplashIntro({ leaving }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at 50% 40%, rgba(56,88,140,0.18), transparent 18%), linear-gradient(180deg, #05070D 0%, #060A12 45%, #070C16 100%)",
        transform: leaving ? "translateY(-100%)" : "translateY(0)",
        opacity: leaving ? 0 : 1,
        transition:
          "transform 760ms cubic-bezier(0.22, 1, 0.36, 1), opacity 520ms ease",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          textAlign: "center",
          transform: leaving ? "scale(0.97)" : "scale(1)",
          transition: "transform 420ms ease",
          padding: 24,
        }}
      >
        <div style={{ display: "grid", placeItems: "center" }}>
          <BrandLogo size={148} priority />
        </div>

        <div
          style={{
            marginTop: 20,
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 1.8,
            textTransform: "uppercase",
            color: "rgba(196,210,240,0.82)",
          }}
        >
          Life Command Center
        </div>

        <div
          style={{
            marginTop: 14,
            fontSize: "clamp(30px, 5vw, 58px)",
            lineHeight: 1.02,
            fontWeight: 900,
            letterSpacing: "-0.05em",
            color: "#F5F7FB",
          }}
        >
          Your financial system,
          <br />
          one command center
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [showSplash, setShowSplash] = useState(true);
  const [splashLeaving, setSplashLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setSplashLeaving(true), 850);
    const t2 = setTimeout(() => setShowSplash(false), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

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

  const disabled = useMemo(() => {
    if (loading) return true;
    if (!safeEmail(email)) return true;
    return String(pass || "").length < 6;
  }, [loading, email, pass]);

  async function onSubmit(e) {
    e.preventDefault();
    setStatus("");

    if (!supabase) {
      setStatus("Missing Supabase environment variables.", "error");
      return;
    }

    setLoading(true);

    try {
      const cleanEmail = safeEmail(email);

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: pass,
        });
        if (error) throw error;

        setStatus(
          "Account created. Check your email if confirmation is enabled, then log in.",
          "success"
        );
        setMode("login");
        setPass("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: pass,
        });
        if (error) throw error;

        router.replace("/");
      }
    } catch (err) {
      setStatus(niceErr(err), "error");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setStatus("");

    if (!supabase) {
      setStatus("Missing Supabase environment variables.", "error");
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

  async function onForgotPassword() {
    setStatus("");

    if (!safeEmail(email)) {
      setStatus("Enter your email first.", "error");
      return;
    }

    if (!supabase) {
      setStatus("Missing Supabase environment variables.", "error");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        safeEmail(email),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) throw error;
      setStatus("Password reset email sent. Check your inbox.", "success");
    } catch (err) {
      setStatus(niceErr(err), "error");
    } finally {
      setLoading(false);
    }
  }

  const messageStyles =
    msgType === "error"
      ? {
          border: "1px solid rgba(239,68,68,0.22)",
          background: "rgba(110,26,26,0.18)",
          color: "#FFD7D7",
        }
      : msgType === "success"
      ? {
          border: "1px solid rgba(52,211,153,0.20)",
          background: "rgba(18,72,57,0.18)",
          color: "#DDFEEB",
        }
      : {
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.04)",
          color: "#E6EDF9",
        };

  return (
    <>
      {showSplash ? <SplashIntro leaving={splashLeaving} /> : null}

      <main
        style={{
          minHeight: "100vh",
          position: "relative",
          overflow: "hidden",
          color: "#EEF3FB",
          background:
            "radial-gradient(circle at top left, rgba(56,84,134,0.16), transparent 18%), radial-gradient(circle at top right, rgba(180,124,66,0.08), transparent 20%), linear-gradient(180deg, #05070C 0%, #070A11 38%, #080C14 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.026) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.026) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "linear-gradient(180deg, rgba(0,0,0,0.86), rgba(0,0,0,0.18))",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: 0.28,
            backgroundImage:
              "radial-gradient(circle at 14% 18%, rgba(255,255,255,0.95) 0 1px, transparent 1.6px), radial-gradient(circle at 30% 42%, rgba(255,255,255,0.75) 0 1px, transparent 1.7px), radial-gradient(circle at 68% 25%, rgba(255,255,255,0.82) 0 1px, transparent 1.7px), radial-gradient(circle at 84% 35%, rgba(255,255,255,0.78) 0 1px, transparent 1.7px), radial-gradient(circle at 58% 70%, rgba(255,255,255,0.74) 0 1px, transparent 1.7px), radial-gradient(circle at 23% 78%, rgba(255,255,255,0.78) 0 1px, transparent 1.7px), radial-gradient(circle at 92% 78%, rgba(255,255,255,0.68) 0 1px, transparent 1.7px)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 1380,
            margin: "0 auto",
            padding: "22px 18px 28px",
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "4px 2px 18px",
            }}
          >
            <BrandLogo size={64} />

            <div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                  color: "#F3F6FC",
                }}
              >
                Life Command Center
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 1.1,
                  textTransform: "uppercase",
                  color: "rgba(209,219,239,0.70)",
                }}
              >
                Personal financial operating system
              </div>
            </div>
          </header>

          <section className="login-grid">
            <div
              style={{
                position: "relative",
                borderRadius: 32,
                border: "1px solid rgba(255,255,255,0.08)",
                background:
                  "linear-gradient(180deg, rgba(11,15,24,0.78), rgba(7,10,18,0.90))",
                padding: 34,
                overflow: "hidden",
                boxShadow:
                  "0 30px 80px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(circle at 82% 32%, rgba(86,122,205,0.18), transparent 22%), radial-gradient(circle at 87% 76%, rgba(190,132,67,0.10), transparent 16%), radial-gradient(circle at 12% 88%, rgba(79,136,122,0.10), transparent 18%)",
                  pointerEvents: "none",
                }}
              />

              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 999,
                    padding: "10px 14px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 0.9,
                    textTransform: "uppercase",
                    color: "rgba(218,228,245,0.85)",
                  }}
                >
                  Built for control
                </div>

                <h1
                  style={{
                    margin: "26px 0 0 0",
                    maxWidth: 760,
                    fontSize: "clamp(48px, 5.8vw, 82px)",
                    lineHeight: 0.96,
                    letterSpacing: "-0.06em",
                    fontWeight: 900,
                    color: "#F5F7FB",
                  }}
                >
                  Run your entire
                  <br />
                  financial life
                  <br />
                  from one command
                  <br />
                  center
                </h1>

                <p
                  style={{
                    marginTop: 24,
                    maxWidth: 700,
                    fontSize: 17,
                    lineHeight: 1.7,
                    color: "rgba(223,232,244,0.78)",
                  }}
                >
                  Track income, bills, spending, debt, savings, investments, and
                  your real day-to-day money flow in one private system.
                </p>

                <div
                  className="stats-grid"
                  style={{
                    marginTop: 28,
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 14,
                  }}
                >
                  <StatCard title="Spending" value="$1,284" tone="blue" />
                  <StatCard title="Bills Due" value="4 upcoming" tone="amber" />
                  <StatCard title="Net Flow" value="+$842" tone="green" />
                </div>

                <div
                  className="bottom-grid"
                  style={{
                    marginTop: 16,
                    display: "grid",
                    gridTemplateColumns: "1fr 0.92fr",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 22,
                      border: "1px solid rgba(255,255,255,0.07)",
                      background:
                        "linear-gradient(180deg, rgba(14,18,28,0.78), rgba(10,13,21,0.88))",
                      padding: 22,
                      boxShadow:
                        "0 16px 30px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.03)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                        color: "rgba(214,224,242,0.72)",
                      }}
                    >
                      Why it feels different
                    </div>

                    <div
                      style={{
                        marginTop: 14,
                        fontSize: 16,
                        lineHeight: 1.8,
                        color: "rgba(233,239,248,0.82)",
                        maxWidth: 470,
                      }}
                    >
                      Less scattered apps. Less guessing. More visibility into
                      what is due, what is coming in, and where your money is
                      actually going.
                    </div>
                  </div>

                  <div
                    style={{
                      borderRadius: 22,
                      border: "1px solid rgba(255,255,255,0.07)",
                      background:
                        "linear-gradient(180deg, rgba(14,18,28,0.78), rgba(10,13,21,0.88))",
                      padding: 22,
                      boxShadow:
                        "0 16px 30px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.03)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                        color: "rgba(214,224,242,0.72)",
                      }}
                    >
                      Core modules
                    </div>

                    <div
                      style={{
                        marginTop: 14,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <ModulePill>Income</ModulePill>
                      <ModulePill>Bills</ModulePill>
                      <ModulePill>Spending</ModulePill>
                      <ModulePill>Debt</ModulePill>
                      <ModulePill>Savings</ModulePill>
                      <ModulePill>Investments</ModulePill>
                      <ModulePill>Calendar</ModulePill>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                position: "relative",
                borderRadius: 32,
                border: "1px solid rgba(255,255,255,0.08)",
                background:
                  "linear-gradient(180deg, rgba(12,15,24,0.80), rgba(8,11,18,0.92))",
                padding: 28,
                overflow: "hidden",
                boxShadow:
                  "0 30px 80px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(circle at 100% 0%, rgba(189,137,77,0.08), transparent 26%), radial-gradient(circle at 0% 20%, rgba(86,122,205,0.12), transparent 22%)",
                  pointerEvents: "none",
                }}
              />

              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <BrandLogo size={74} />
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 900,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        color: "rgba(215,225,243,0.82)",
                      }}
                    >
                      Account access
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 30,
                        lineHeight: 1.05,
                        fontWeight: 900,
                        letterSpacing: "-0.04em",
                        color: "#F5F7FB",
                      }}
                    >
                      {mode === "login" ? "Welcome back" : "Create your account"}
                    </div>
                  </div>
                </div>

                <p
                  style={{
                    marginTop: 18,
                    fontSize: 14,
                    lineHeight: 1.75,
                    color: "rgba(225,233,244,0.72)",
                  }}
                >
                  Sign in to continue or create a private account for your own
                  data.
                </p>

                <div
                  style={{
                    marginTop: 20,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    padding: 6,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  {[
                    { key: "login", label: "Login" },
                    { key: "signup", label: "Sign Up" },
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
                          height: 48,
                          borderRadius: 14,
                          border: active
                            ? "1px solid rgba(138,163,215,0.22)"
                            : "1px solid transparent",
                          background: active
                            ? "linear-gradient(180deg, rgba(34,46,72,0.96), rgba(20,28,44,0.96))"
                            : "transparent",
                          color: active ? "#F7FAFF" : "rgba(198,210,232,0.76)",
                          fontWeight: 900,
                          fontSize: 14,
                          cursor: "pointer",
                          boxShadow: active
                            ? "0 10px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.03)"
                            : "none",
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <form
                  onSubmit={onSubmit}
                  style={{ marginTop: 18, display: "grid", gap: 14 }}
                >
                  <label style={{ display: "grid", gap: 8 }}>
                    <span style={labelStyle}>Email</span>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 8 }}>
                    <span style={labelStyle}>Password</span>

                    <div style={{ position: "relative" }}>
                      <input
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        type={showPass ? "text" : "password"}
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                        placeholder={
                          mode === "login"
                            ? "Enter your password"
                            : "Create a password"
                        }
                        style={{ ...inputStyle, paddingRight: 74 }}
                      />

                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        style={showPassButtonStyle}
                      >
                        {showPass ? "Hide" : "Show"}
                      </button>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={disabled}
                    style={{
                      height: 56,
                      borderRadius: 18,
                      border: "1px solid rgba(196,144,81,0.16)",
                      background: disabled
                        ? "rgba(255,255,255,0.06)"
                        : "linear-gradient(180deg, rgba(39,44,57,0.98), rgba(18,21,29,0.98))",
                      color: "#FFFFFF",
                      fontWeight: 900,
                      fontSize: 16,
                      cursor: disabled ? "not-allowed" : "pointer",
                      boxShadow: disabled
                        ? "none"
                        : "0 18px 38px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)",
                    }}
                  >
                    {loading
                      ? "Working..."
                      : mode === "login"
                      ? "Enter Command Center"
                      : "Create Account"}
                  </button>
                </form>

                <div
                  style={{
                    margin: "18px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: "rgba(255,255,255,0.08)",
                    }}
                  />
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: 1,
                      color: "rgba(204,215,236,0.58)",
                    }}
                  >
                    OR
                  </div>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: "rgba(255,255,255,0.08)",
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={onGoogle}
                  disabled={loading}
                  style={{
                    width: "100%",
                    height: 56,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background:
                      "linear-gradient(180deg, rgba(18,22,31,0.94), rgba(12,15,21,0.96))",
                    color: "#F5F8FD",
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow:
                      "0 12px 28px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)",
                  }}
                >
                  Continue with Google
                </button>

                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    disabled={loading}
                    style={textButtonStyle}
                  >
                    Forgot password?
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode((m) => (m === "login" ? "signup" : "login"));
                      setMsg("");
                    }}
                    disabled={loading}
                    style={textButtonStyle}
                  >
                    {mode === "login"
                      ? "Need an account?"
                      : "Already have an account?"}
                  </button>
                </div>

                {msg ? (
                  <div
                    style={{
                      marginTop: 16,
                      borderRadius: 18,
                      padding: 14,
                      ...messageStyles,
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 13 }}>
                      {msgType === "error"
                        ? "Error"
                        : msgType === "success"
                        ? "Success"
                        : "Status"}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        lineHeight: 1.65,
                      }}
                    >
                      {msg}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>

        <style jsx>{`
          .login-grid {
            display: grid;
            grid-template-columns: 1.08fr 0.92fr;
            gap: 24px;
            align-items: stretch;
          }

          @media (max-width: 1100px) {
            .login-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 760px) {
            .stats-grid {
              grid-template-columns: 1fr !important;
            }

            .bottom-grid {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 640px) {
            main {
              min-height: 100dvh;
            }
          }
        `}</style>
      </main>
    </>
  );
}

const labelStyle = {
  fontSize: 13,
  fontWeight: 800,
  color: "rgba(225,233,245,0.84)",
};

const inputStyle = {
  width: "100%",
  height: 54,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.97), rgba(246,248,252,0.96))",
  color: "#101722",
  padding: "0 18px",
  outline: "none",
  fontSize: 15,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
};

const showPassButtonStyle = {
  position: "absolute",
  top: "50%",
  right: 10,
  transform: "translateY(-50%)",
  height: 34,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(16,20,29,0.92)",
  color: "rgba(226,234,245,0.82)",
  fontWeight: 800,
  cursor: "pointer",
};

const textButtonStyle = {
  background: "transparent",
  border: "none",
  padding: 0,
  color: "rgba(174,192,225,0.88)",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};