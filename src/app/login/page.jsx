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

function BrandLogo({ size = 88, priority = false, glow = true }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        borderRadius: Math.round(size * 0.28),
        overflow: "hidden",
        boxShadow: glow
          ? "0 0 0 1px rgba(96,165,250,0.12), 0 18px 60px rgba(37,99,235,0.22)"
          : "none",
        flexShrink: 0,
      }}
    >
      <Image
        src="/brand/lcc-logo.png"
        alt="Life Command Center logo"
        fill
        priority={priority}
        sizes={`${size}px`}
        style={{
          objectFit: "cover",
        }}
      />
    </div>
  );
}

function MiniStat({ title, value, tone = "blue" }) {
  const toneMap = {
    blue: {
      border: "rgba(96,165,250,0.20)",
      bg: "rgba(37,99,235,0.08)",
      glow: "rgba(37,99,235,0.14)",
    },
    green: {
      border: "rgba(34,197,94,0.20)",
      bg: "rgba(34,197,94,0.07)",
      glow: "rgba(34,197,94,0.12)",
    },
    amber: {
      border: "rgba(245,158,11,0.20)",
      bg: "rgba(245,158,11,0.07)",
      glow: "rgba(245,158,11,0.12)",
    },
  };

  const t = toneMap[tone] || toneMap.blue;

  return (
    <div
      style={{
        border: `1px solid ${t.border}`,
        background: `linear-gradient(180deg, ${t.bg}, rgba(255,255,255,0.02))`,
        boxShadow: `0 14px 36px ${t.glow}`,
        borderRadius: 20,
        padding: 14,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "rgba(224,232,255,0.68)",
          fontWeight: 800,
          letterSpacing: 0.35,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 22,
          fontWeight: 950,
          letterSpacing: "-0.03em",
          color: "#F7FBFF",
        }}
      >
        {value}
      </div>
    </div>
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
          "radial-gradient(circle at 50% 35%, rgba(37,99,235,0.24), transparent 18%), radial-gradient(circle at 50% 60%, rgba(59,130,246,0.10), transparent 28%), linear-gradient(180deg, #040A13 0%, #06101D 55%, #091423 100%)",
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
          transform: leaving ? "scale(0.96)" : "scale(1)",
          transition: "transform 420ms ease",
          padding: 24,
        }}
      >
        <div style={{ display: "grid", placeItems: "center" }}>
          <BrandLogo size={132} priority glow />
        </div>

        <div
          style={{
            marginTop: 22,
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "rgba(186,211,255,0.86)",
          }}
        >
          Life Command Center
        </div>

        <div
          style={{
            marginTop: 14,
            fontSize: "clamp(32px, 5vw, 60px)",
            lineHeight: 1.05,
            fontWeight: 950,
            letterSpacing: "-0.05em",
            color: "#F8FBFF",
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

    if (!supabase) {
      setStatus("Missing Supabase environment variables.", "error");
      return;
    }

    if (!safeEmail(email)) {
      setStatus("Enter your email first.", "error");
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
          border: "1px solid rgba(239,68,68,0.28)",
          background: "rgba(127,29,29,0.18)",
          color: "#FFD4D4",
        }
      : msgType === "success"
      ? {
          border: "1px solid rgba(34,197,94,0.24)",
          background: "rgba(20,83,45,0.18)",
          color: "#DDFEE7",
        }
      : {
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.04)",
          color: "#E5EEFF",
        };

  return (
    <>
      {showSplash ? <SplashIntro leaving={splashLeaving} /> : null}

      <main
        style={{
          minHeight: "100vh",
          color: "#ECF4FF",
          background:
            "radial-gradient(circle at top left, rgba(29,78,216,0.18), transparent 26%), radial-gradient(circle at top right, rgba(16,185,129,0.10), transparent 22%), linear-gradient(180deg, #07111F 0%, #091423 42%, #0A1420 100%)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "linear-gradient(180deg, rgba(0,0,0,0.65), transparent 82%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: 1320,
            margin: "0 auto",
            padding: "18px 16px 28px",
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "8px 0 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <BrandLogo size={56} glow />
              <div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 950,
                    letterSpacing: "-0.03em",
                  }}
                >
                  Life Command Center
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 12,
                    color: "rgba(214,228,255,0.66)",
                    fontWeight: 800,
                    letterSpacing: 0.35,
                    textTransform: "uppercase",
                  }}
                >
                  Personal financial operating system
                </div>
              </div>
            </div>
          </header>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "1.04fr 0.96fr",
              gap: 24,
              alignItems: "stretch",
            }}
          >
            <div
              style={{
                position: "relative",
                borderRadius: 30,
                border: "1px solid rgba(255,255,255,0.10)",
                background:
                  "linear-gradient(180deg, rgba(12,18,30,0.74), rgba(8,13,24,0.84))",
                boxShadow: "0 24px 80px rgba(0,0,0,0.40)",
                padding: 24,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -140,
                  right: -120,
                  width: 320,
                  height: 320,
                  borderRadius: "50%",
                  background: "rgba(37,99,235,0.16)",
                  filter: "blur(80px)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: -120,
                  left: -100,
                  width: 260,
                  height: 260,
                  borderRadius: "50%",
                  background: "rgba(16,185,129,0.12)",
                  filter: "blur(90px)",
                }}
              />

              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 999,
                    padding: "8px 12px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.04)",
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    color: "rgba(198,217,255,0.88)",
                  }}
                >
                  Built for control
                </div>

                <h1
                  style={{
                    margin: "18px 0 0 0",
                    fontSize: "clamp(34px, 5vw, 62px)",
                    lineHeight: 0.98,
                    fontWeight: 950,
                    letterSpacing: "-0.05em",
                    maxWidth: 700,
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
                    marginTop: 18,
                    maxWidth: 620,
                    color: "rgba(226,236,255,0.72)",
                    fontSize: 16,
                    lineHeight: 1.7,
                  }}
                >
                  Track income, bills, spending, debt, savings, investments, and
                  your real day-to-day money flow in one private system.
                </p>

                <div
                  style={{
                    marginTop: 24,
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 14,
                  }}
                >
                  <MiniStat title="Spending" value="$1,284" tone="amber" />
                  <MiniStat title="Bills due" value="4 upcoming" tone="blue" />
                  <MiniStat title="Net flow" value="+$842" tone="green" />
                </div>

                <div
                  style={{
                    marginTop: 18,
                    display: "grid",
                    gridTemplateColumns: "1.1fr 0.9fr",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 22,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.035)",
                      padding: 18,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(206,222,255,0.70)",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: 0.35,
                      }}
                    >
                      Why it feels different
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 15,
                        lineHeight: 1.7,
                        color: "rgba(232,240,255,0.80)",
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
                      border: "1px solid rgba(255,255,255,0.10)",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))",
                      padding: 18,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(206,222,255,0.70)",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: 0.35,
                      }}
                    >
                      Core modules
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {[
                        "Income",
                        "Bills",
                        "Spending",
                        "Debt",
                        "Savings",
                        "Investments",
                        "Calendar",
                      ].map((item) => (
                        <span
                          key={item}
                          style={{
                            padding: "7px 10px",
                            borderRadius: 999,
                            border: "1px solid rgba(255,255,255,0.10)",
                            background: "rgba(255,255,255,0.04)",
                            fontSize: 12,
                            fontWeight: 800,
                            color: "rgba(236,244,255,0.82)",
                          }}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                position: "relative",
                borderRadius: 30,
                border: "1px solid rgba(255,255,255,0.12)",
                background:
                  "linear-gradient(180deg, rgba(9,15,26,0.94), rgba(10,16,28,0.96))",
                boxShadow: "0 26px 80px rgba(0,0,0,0.48)",
                padding: 24,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -70,
                  right: -60,
                  width: 180,
                  height: 180,
                  borderRadius: "50%",
                  background: "rgba(96,165,250,0.15)",
                  filter: "blur(60px)",
                }}
              />

              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <BrandLogo size={64} glow />
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        textTransform: "uppercase",
                        letterSpacing: 0.45,
                        color: "rgba(151,188,255,0.86)",
                        fontWeight: 900,
                      }}
                    >
                      Account access
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 28,
                        fontWeight: 950,
                        letterSpacing: "-0.04em",
                      }}
                    >
                      {mode === "login" ? "Welcome back" : "Create your account"}
                    </div>
                  </div>
                </div>

                <p
                  style={{
                    marginTop: 14,
                    color: "rgba(226,236,255,0.70)",
                    fontSize: 14,
                    lineHeight: 1.65,
                  }}
                >
                  Sign in to continue or create a private account for your own
                  data.
                </p>

                <div
                  style={{
                    marginTop: 18,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    padding: 6,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
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
                          height: 46,
                          borderRadius: 14,
                          border: active
                            ? "1px solid rgba(96,165,250,0.36)"
                            : "1px solid transparent",
                          background: active
                            ? "linear-gradient(135deg, rgba(37,99,235,0.24), rgba(16,185,129,0.14))"
                            : "transparent",
                          color: active ? "#FFFFFF" : "rgba(194,212,245,0.75)",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <form
                  onSubmit={onSubmit}
                  style={{ marginTop: 18, display: "grid", gap: 12 }}
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
                        style={{ ...inputStyle, paddingRight: 62 }}
                      />

                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        style={{
                          position: "absolute",
                          top: "50%",
                          right: 10,
                          transform: "translateY(-50%)",
                          height: 34,
                          padding: "0 10px",
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(255,255,255,0.04)",
                          color: "rgba(219,230,255,0.84)",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        {showPass ? "Hide" : "Show"}
                      </button>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={disabled}
                    style={{
                      height: 54,
                      borderRadius: 16,
                      border: "1px solid rgba(96,165,250,0.30)",
                      background: disabled
                        ? "rgba(255,255,255,0.08)"
                        : "linear-gradient(135deg, #2563EB 0%, #1D4ED8 38%, #0F766E 100%)",
                      color: "#FFFFFF",
                      fontWeight: 950,
                      fontSize: 15,
                      cursor: disabled ? "not-allowed" : "pointer",
                      boxShadow: disabled
                        ? "none"
                        : "0 18px 40px rgba(37,99,235,0.22)",
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
                    margin: "16px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
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
                      color: "rgba(209,223,250,0.60)",
                      fontWeight: 800,
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
                    height: 54,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#F7FBFF",
                    fontWeight: 900,
                    fontSize: 15,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  Continue with Google
                </button>

                <div
                  style={{
                    marginTop: 12,
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
                        lineHeight: 1.6,
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
          @media (max-width: 980px) {
            section {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 720px) {
            h1 {
              max-width: 100% !important;
              font-size: clamp(34px, 12vw, 52px) !important;
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
  color: "rgba(220,232,255,0.84)",
};

const inputStyle = {
  width: "100%",
  height: 52,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.045)",
  color: "#F7FBFF",
  padding: "0 16px",
  outline: "none",
  fontSize: 15,
};

const textButtonStyle = {
  background: "transparent",
  border: "none",
  padding: 0,
  color: "rgba(151,188,255,0.92)",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};