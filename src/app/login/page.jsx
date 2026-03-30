"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
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
        border: "1px solid rgba(121, 163, 255, 0.22)",
        background:
          "linear-gradient(180deg, rgba(8,13,24,0.98), rgba(5,8,16,1))",
        boxShadow:
          "0 18px 42px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 24px rgba(57,104,255,0.10)",
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

function SignalPill({ children, tone = "blue" }) {
  const tones = {
    blue: {
      border: "rgba(99, 137, 255, 0.18)",
      bg: "rgba(18, 30, 61, 0.38)",
      color: "rgba(232,239,255,0.92)",
      glow: "0 0 18px rgba(75,122,255,0.08)",
    },
    green: {
      border: "rgba(52, 210, 146, 0.18)",
      bg: "rgba(12, 38, 31, 0.34)",
      color: "rgba(228,255,243,0.92)",
      glow: "0 0 18px rgba(38,183,122,0.08)",
    },
    amber: {
      border: "rgba(255, 179, 72, 0.18)",
      bg: "rgba(45, 28, 8, 0.34)",
      color: "rgba(255,243,221,0.92)",
      glow: "0 0 18px rgba(255,163,48,0.08)",
    },
  };

  const t = tones[tone] || tones.blue;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 34,
        padding: "0 14px",
        borderRadius: 999,
        border: `1px solid ${t.border}`,
        background: `linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)), ${t.bg}`,
        color: t.color,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.4,
        boxShadow: `${t.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function InfoCard({ label, title, text, tone = "blue" }) {
  const tones = {
    blue: {
      border: "rgba(87, 126, 255, 0.22)",
      glow: "radial-gradient(circle at 100% 0%, rgba(73,119,255,0.18), transparent 46%)",
    },
    green: {
      border: "rgba(49, 199, 129, 0.22)",
      glow: "radial-gradient(circle at 100% 0%, rgba(37,194,118,0.16), transparent 46%)",
    },
    amber: {
      border: "rgba(255, 168, 55, 0.20)",
      glow: "radial-gradient(circle at 100% 0%, rgba(255,156,35,0.14), transparent 46%)",
    },
  };

  const t = tones[tone] || tones.blue;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: 170,
        borderRadius: 24,
        border: `1px solid ${t.border}`,
        background:
          "linear-gradient(180deg, rgba(12,18,31,0.88), rgba(8,11,19,0.94))",
        padding: 20,
        boxShadow:
          "0 20px 40px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.03)",
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
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "rgba(213,224,244,0.66)",
          }}
        >
          {label}
        </div>

        <div
          style={{
            marginTop: 12,
            fontSize: 30,
            lineHeight: 0.98,
            fontWeight: 900,
            letterSpacing: "-0.05em",
            color: "#F7FAFF",
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 12,
            fontSize: 13.5,
            lineHeight: 1.65,
            color: "rgba(226,234,246,0.72)",
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

function RailRow({ title, sub, tone = "blue" }) {
  const dot =
    tone === "green"
      ? "rgba(42,196,120,0.92)"
      : tone === "amber"
      ? "rgba(255,174,64,0.92)"
      : "rgba(87,126,255,0.95)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "12px minmax(0,1fr)",
        gap: 12,
        alignItems: "start",
        padding: "14px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: dot,
          boxShadow: `0 0 14px ${dot}`,
          marginTop: 6,
        }}
      />

      <div>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 800,
            color: "#F6F9FF",
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 5,
            fontSize: 13,
            lineHeight: 1.65,
            color: "rgba(225,233,244,0.68)",
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const submitRef = useRef(false);

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      if (!supabase) return;

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) return;
      if (error || !session?.user) return;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_disabled, status")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profileError) {
        setStatus(profileError.message || "Failed to load user profile.", "error");
        return;
      }

      const normalizedStatus = String(profile?.status || "active").toLowerCase();
      const isDisabled =
        profile?.is_disabled === true || normalizedStatus === "suspended";

      if (isDisabled) {
        await supabase.auth.signOut();
        if (!mounted) return;
        setStatus("This account has been disabled.", "error");
        return;
      }

      router.replace("/");
    }

    checkSession();

    return () => {
      mounted = false;
    };
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

    if (submitRef.current) return;

    if (!supabase) {
      setStatus("Missing Supabase environment variables.", "error");
      return;
    }

    submitRef.current = true;
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
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: pass,
      });

      if (error) throw error;

      const signedInUser = data?.user;
      if (!signedInUser) {
        throw new Error("Login succeeded but no user was returned.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_disabled, status")
        .eq("id", signedInUser.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message || "Failed to load user profile.");
      }

      const normalizedStatus = String(profile?.status || "active").toLowerCase();
      const isDisabled =
        profile?.is_disabled === true || normalizedStatus === "suspended";

      if (isDisabled) {
        await supabase.auth.signOut();
        setStatus("This account has been disabled.", "error");
        return;
      }

      router.replace("/");
    } catch (err) {
      setStatus(niceErr(err), "error");
    } finally {
      submitRef.current = false;
      setLoading(false);
    }
  }

  async function onGoogle() {
    setStatus("");

    if (!supabase) {
      setStatus("Missing Supabase environment variables.", "error");
      return;
    }

    if (loading) return;

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

    if (loading) return;

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

  const modeMeta =
    mode === "signup"
      ? {
          eyebrow: "Build your system",
          title: "Create your command center",
          sub: "Start your private financial dashboard and bring everything into one place.",
          cta: "Create My Command Center",
          tone: "green",
        }
      : {
          eyebrow: "Account access",
          title: "Welcome back",
          sub: "Log in fast and get straight to what needs your attention.",
          cta: "Enter Command Center",
          tone: "blue",
        };

  const messageStyles =
    msgType === "error"
      ? {
          border: "1px solid rgba(239,68,68,0.22)",
          background:
            "linear-gradient(180deg, rgba(82,26,26,0.28), rgba(55,18,18,0.20))",
          color: "#FFD7D7",
        }
      : msgType === "success"
      ? {
          border: "1px solid rgba(52,211,153,0.20)",
          background:
            "linear-gradient(180deg, rgba(17,67,52,0.25), rgba(11,39,31,0.18))",
          color: "#DDFEEB",
        }
      : {
          border: "1px solid rgba(255,255,255,0.10)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
          color: "#E6EDF9",
        };

  return (
    <main className="lccLoginRoot">
      <div className="lccBgGrid" />
      <div className="lccBgStars" />
      <div className="lccBgGlow lccBgGlowA" />
      <div className="lccBgGlow lccBgGlowB" />
      <div className="lccBgGlow lccBgGlowC" />
      <div className="lccVignette" />

      <div className="lccShell">
        <header className="lccHeader">
          <div className="lccBrandWrap">
            <BrandLogo size={66} priority />
            <div>
              <div className="lccBrandTitle">Life Command Center</div>
              <div className="lccBrandSub">Personal financial operating system</div>
            </div>
          </div>

          <div className="lccHeaderSignals">
            <SignalPill tone="blue">Clear cash flow</SignalPill>
            <SignalPill tone="amber">Catch due pressure</SignalPill>
            <SignalPill tone="green">Build real control</SignalPill>
          </div>
        </header>

        <section className="lccLayout">
          <section className="lccAuthPanel">
            <div className="lccAuthHead">
              <div className="lccAuthEyebrow">{modeMeta.eyebrow}</div>
              <div className="lccAuthTitle">{modeMeta.title}</div>
              <div className="lccAuthSub">{modeMeta.sub}</div>
            </div>

            <div className={`lccModeNotice ${modeMeta.tone === "green" ? "isGreen" : "isBlue"}`}>
              <div className="lccModeNoticeTitle">
                {mode === "signup" ? "What you are building" : "What you will step back into"}
              </div>

              <div className="lccModeNoticeList">
                {mode === "signup" ? (
                  <>
                    <RailRow
                      title="Bills, debt, savings, and spending in one system"
                      sub="Stop bouncing across separate tools just to understand your money."
                      tone="green"
                    />
                    <RailRow
                      title="See what needs action first"
                      sub="Get a cleaner view of pressure, balances, and what matters now."
                      tone="amber"
                    />
                  </>
                ) : (
                  <>
                    <RailRow
                      title="See due dates, pressure, and account flow"
                      sub="Get straight to the pages that tell you what is happening."
                      tone="blue"
                    />
                    <RailRow
                      title="Pick up where you left off"
                      sub="Your private dashboard is waiting, not buried behind clutter."
                      tone="green"
                    />
                  </>
                )}
              </div>
            </div>

            <div className="lccToggle">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setMsg("");
                }}
                disabled={loading}
                className={`lccToggleBtn ${mode === "login" ? "isActive" : ""}`}
              >
                Login
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setMsg("");
                }}
                disabled={loading}
                className={`lccToggleBtn ${mode === "signup" ? "isActive" : ""}`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={onSubmit} className="lccAuthForm">
              <label className="lccFieldWrap">
                <span className="lccLabel">Email</span>
                <input
                  className="lccAuthInput"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </label>

              <label className="lccFieldWrap">
                <span className="lccLabel">Password</span>

                <div style={{ position: "relative" }}>
                  <input
                    className="lccAuthInput"
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
                    style={{ paddingRight: 84 }}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="lccShowPass"
                  >
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <button type="submit" disabled={disabled} className="lccPrimaryBtn">
                {loading ? "Working..." : modeMeta.cta}
              </button>
            </form>

            <div className="lccDivider">
              <div className="lccDividerLine" />
              <div className="lccDividerText">OR</div>
              <div className="lccDividerLine" />
            </div>

            <button
              type="button"
              onClick={onGoogle}
              disabled={loading}
              className="lccGoogleBtn"
            >
              Continue with Google
            </button>

            <div className="lccLinkRow">
              <button
                type="button"
                onClick={onForgotPassword}
                disabled={loading}
                className="lccTextBtn"
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
                className="lccTextBtn"
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
          </section>

          <section className="lccHeroPanel">
            <div className="lccHeroTop">
              <SignalPill tone="blue">Private finance command center</SignalPill>
              <SignalPill tone="green">Less chaos. More control.</SignalPill>
            </div>

            <div className="lccHeroTitle">
              Make better money
              <br />
              decisions before
              <br />
              small problems stack
            </div>

            <div className="lccHeroCopy">
              Life Command Center helps you track bills, debt, spending,
              savings, income, and account movement in one place so your money
              feels tighter, calmer, and easier to manage.
            </div>

            <div className="lccHeroCards">
              <InfoCard
                label="Bills"
                title="Catch what is due"
                text="See upcoming payment pressure before it turns into late surprises."
                tone="amber"
              />
              <InfoCard
                label="Cash Flow"
                title="Know where you stand"
                text="See what is coming in, what is leaving, and where your month is headed."
                tone="blue"
              />
              <InfoCard
                label="Debt + Savings"
                title="Move with intention"
                text="Track payoff progress and savings growth without guessing or bouncing around."
                tone="green"
              />
            </div>

            <div className="lccHeroRail">
              <div className="lccHeroRailLabel">Why this app feels different</div>
              <RailRow
                title="One place instead of scattered tools"
                sub="Track the money system as a whole instead of piecing it together from separate apps."
                tone="blue"
              />
              <RailRow
                title="Pressure shows up earlier"
                sub="Bills, flow, and balances become easier to spot before they turn into damage."
                tone="amber"
              />
              <RailRow
                title="The dashboard is built to act, not just look nice"
                sub="It is meant to help you decide what to do next, not just show random numbers."
                tone="green"
              />
            </div>
          </section>
        </section>
      </div>

      <style jsx>{`
        .lccLoginRoot {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          color: #eef3fb;
          background:
            radial-gradient(circle at top left, rgba(43, 71, 138, 0.14), transparent 18%),
            radial-gradient(circle at top right, rgba(180, 122, 54, 0.06), transparent 18%),
            linear-gradient(180deg, #04070c 0%, #070b12 42%, #080d15 100%);
        }

        .lccBgGrid,
        .lccBgStars,
        .lccBgGlow,
        .lccVignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .lccBgGrid {
          background-image:
            linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: linear-gradient(180deg, rgba(0,0,0,0.88), rgba(0,0,0,0.18));
        }

        .lccBgStars {
          opacity: 0.34;
          background-image:
            radial-gradient(circle at 12% 18%, rgba(255,255,255,0.95) 0 1px, transparent 1.7px),
            radial-gradient(circle at 28% 34%, rgba(255,255,255,0.72) 0 1px, transparent 1.7px),
            radial-gradient(circle at 54% 22%, rgba(255,255,255,0.82) 0 1px, transparent 1.7px),
            radial-gradient(circle at 74% 30%, rgba(255,255,255,0.65) 0 1px, transparent 1.7px),
            radial-gradient(circle at 86% 17%, rgba(255,255,255,0.8) 0 1px, transparent 1.7px),
            radial-gradient(circle at 22% 76%, rgba(255,255,255,0.72) 0 1px, transparent 1.7px),
            radial-gradient(circle at 58% 70%, rgba(255,255,255,0.72) 0 1px, transparent 1.7px),
            radial-gradient(circle at 91% 82%, rgba(255,255,255,0.68) 0 1px, transparent 1.7px);
          animation: twinkle 8s ease-in-out infinite alternate;
        }

        .lccBgGlow {
          filter: blur(44px);
        }

        .lccBgGlowA {
          background: radial-gradient(circle at 20% 22%, rgba(49, 102, 255, 0.16), transparent 34%);
          animation: driftA 16s ease-in-out infinite alternate;
        }

        .lccBgGlowB {
          background: radial-gradient(circle at 84% 20%, rgba(255, 159, 44, 0.08), transparent 24%);
          animation: driftB 18s ease-in-out infinite alternate;
        }

        .lccBgGlowC {
          background: radial-gradient(circle at 62% 58%, rgba(39, 189, 123, 0.08), transparent 24%);
          animation: driftC 14s ease-in-out infinite alternate;
        }

        .lccVignette {
          background: radial-gradient(circle at 50% 42%, transparent 38%, rgba(0,0,0,0.28) 100%);
        }

        .lccShell {
          position: relative;
          z-index: 1;
          max-width: 1440px;
          margin: 0 auto;
          padding: 22px 18px 28px;
        }

        .lccHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
          flex-wrap: wrap;
          padding: 2px 2px 18px;
        }

        .lccBrandWrap {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .lccBrandTitle {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #f4f7fd;
        }

        .lccBrandSub {
          margin-top: 4px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.04px;
          text-transform: uppercase;
          color: rgba(211,220,238,0.7);
        }

        .lccHeaderSignals {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .lccLayout {
          display: grid;
          grid-template-columns: minmax(420px, 0.92fr) minmax(0, 1.08fr);
          gap: 24px;
          align-items: stretch;
        }

        .lccAuthPanel,
        .lccHeroPanel {
          position: relative;
          overflow: hidden;
          border-radius: 34px;
          border: 1px solid rgba(255,255,255,0.08);
          background:
            linear-gradient(180deg, rgba(11,16,28,0.80), rgba(8,11,19,0.92)),
            rgba(7,10,18,0.86);
          box-shadow:
            0 30px 90px rgba(0,0,0,0.40),
            inset 0 1px 0 rgba(255,255,255,0.03);
          backdrop-filter: blur(10px);
        }

        .lccAuthPanel {
          padding: 28px;
        }

        .lccAuthPanel::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 0% 18%, rgba(84,120,207,0.14), transparent 22%),
            radial-gradient(circle at 100% 0%, rgba(190,131,65,0.06), transparent 26%);
        }

        .lccHeroPanel {
          padding: 34px;
        }

        .lccHeroPanel::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 78% 30%, rgba(73,113,255,0.18), transparent 18%),
            radial-gradient(circle at 86% 76%, rgba(192,135,61,0.08), transparent 14%),
            radial-gradient(circle at 12% 84%, rgba(43,188,121,0.08), transparent 16%);
        }

        .lccAuthHead,
        .lccHeroTop {
          position: relative;
          z-index: 1;
        }

        .lccAuthEyebrow {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: rgba(215,225,243,0.82);
        }

        .lccAuthTitle {
          margin-top: 8px;
          font-size: clamp(30px, 3vw, 44px);
          line-height: 1.02;
          font-weight: 900;
          letter-spacing: -0.05em;
          color: #f5f7fb;
        }

        .lccAuthSub {
          margin-top: 12px;
          font-size: 14px;
          line-height: 1.75;
          color: rgba(225,233,244,0.74);
          max-width: 520px;
        }

        .lccModeNotice {
          position: relative;
          z-index: 1;
          margin-top: 18px;
          border-radius: 22px;
          padding: 18px;
          border: 1px solid rgba(255,255,255,0.08);
          background:
            linear-gradient(180deg, rgba(15,22,36,0.84), rgba(9,13,22,0.92));
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.04),
            0 14px 30px rgba(0,0,0,0.18);
        }

        .lccModeNotice.isBlue {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.04),
            0 14px 30px rgba(0,0,0,0.18),
            0 0 24px rgba(56,104,255,0.08);
        }

        .lccModeNotice.isGreen {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.04),
            0 14px 30px rgba(0,0,0,0.18),
            0 0 24px rgba(32,175,113,0.08);
        }

        .lccModeNoticeTitle {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.9px;
          text-transform: uppercase;
          color: rgba(212,224,242,0.70);
        }

        .lccModeNoticeList {
          margin-top: 6px;
        }

        .lccToggle {
          position: relative;
          z-index: 1;
          margin-top: 20px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 6px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.025);
        }

        .lccToggleBtn {
          height: 50px;
          border-radius: 14px;
          border: 1px solid transparent;
          background: transparent;
          color: rgba(198,210,232,0.76);
          font-weight: 900;
          font-size: 14px;
          cursor: pointer;
          transition:
            background 180ms ease,
            color 180ms ease,
            border-color 180ms ease,
            transform 180ms ease,
            box-shadow 180ms ease;
        }

        .lccToggleBtn:hover {
          transform: translateY(-1px);
        }

        .lccToggleBtn.isActive {
          border-color: rgba(138,163,215,0.22);
          background: linear-gradient(180deg, rgba(34,46,72,0.96), rgba(20,28,44,0.96));
          color: #f7faff;
          box-shadow:
            0 10px 24px rgba(0,0,0,0.18),
            inset 0 1px 0 rgba(255,255,255,0.03);
        }

        .lccAuthForm {
          position: relative;
          z-index: 1;
          margin-top: 18px;
          display: grid;
          gap: 14px;
        }

        .lccFieldWrap {
          display: grid;
          gap: 8px;
        }

        .lccLabel {
          font-size: 13px;
          font-weight: 800;
          color: rgba(225,233,245,0.84);
        }

        .lccAuthInput {
          width: 100%;
          height: 56px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.10);
          background:
            linear-gradient(180deg, rgba(19,27,43,0.94), rgba(10,15,27,0.98)) !important;
          color: #f4f7fd !important;
          padding: 0 18px;
          outline: none;
          font-size: 15px;
          caret-color: #f4f7fd;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.05),
            0 10px 24px rgba(0,0,0,0.18);
          appearance: none;
          -webkit-appearance: none;
          transition:
            border-color 160ms ease,
            box-shadow 160ms ease,
            transform 160ms ease;
        }

        .lccAuthInput::placeholder {
          color: rgba(214,224,242,0.42) !important;
        }

        .lccAuthInput:focus {
          border-color: rgba(79,126,255,0.38) !important;
          box-shadow:
            0 0 0 1px rgba(79,126,255,0.18),
            0 0 24px rgba(47,107,255,0.12),
            inset 0 1px 0 rgba(255,255,255,0.05);
          transform: translateY(-1px);
        }

        .lccAuthInput:-webkit-autofill,
        .lccAuthInput:-webkit-autofill:hover,
        .lccAuthInput:-webkit-autofill:focus,
        .lccAuthInput:-webkit-autofill:active {
          -webkit-text-fill-color: #f4f7fd !important;
          caret-color: #f4f7fd !important;
          border: 1px solid rgba(255,255,255,0.10) !important;
          -webkit-box-shadow:
            0 0 0 1000px rgba(10,15,27,1) inset,
            inset 0 1px 0 rgba(255,255,255,0.05),
            0 10px 24px rgba(0,0,0,0.18) !important;
          box-shadow:
            0 0 0 1000px rgba(10,15,27,1) inset,
            inset 0 1px 0 rgba(255,255,255,0.05),
            0 10px 24px rgba(0,0,0,0.18) !important;
          border-radius: 18px !important;
          transition: background-color 99999s ease-in-out 0s;
        }

        .lccShowPass {
          position: absolute;
          top: 50%;
          right: 10px;
          transform: translateY(-50%);
          height: 36px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(31,40,61,0.98);
          color: rgba(236,242,250,0.88);
          font-weight: 800;
          cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .lccPrimaryBtn,
        .lccGoogleBtn {
          width: 100%;
          height: 58px;
          border-radius: 18px;
          font-weight: 900;
          font-size: 15px;
          cursor: pointer;
          transition:
            transform 180ms ease,
            box-shadow 180ms ease,
            border-color 180ms ease,
            background 180ms ease;
        }

        .lccPrimaryBtn:hover,
        .lccGoogleBtn:hover {
          transform: translateY(-1px);
        }

        .lccPrimaryBtn {
          border: 1px solid rgba(156,178,232,0.18);
          background:
            linear-gradient(180deg, rgba(39,48,71,0.98), rgba(17,22,33,0.98));
          color: #ffffff;
          box-shadow:
            0 18px 38px rgba(0,0,0,0.28),
            inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .lccPrimaryBtn:disabled,
        .lccGoogleBtn:disabled {
          cursor: not-allowed;
          transform: none;
          opacity: 0.66;
          box-shadow: none;
        }

        .lccDivider {
          position: relative;
          z-index: 1;
          margin: 18px 0;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .lccDividerLine {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.08);
        }

        .lccDividerText {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
          color: rgba(204,215,236,0.58);
        }

        .lccGoogleBtn {
          position: relative;
          z-index: 1;
          border: 1px solid rgba(255,255,255,0.10);
          background:
            linear-gradient(180deg, rgba(18,22,31,0.94), rgba(12,15,21,0.96));
          color: #f5f8fd;
          box-shadow:
            0 12px 28px rgba(0,0,0,0.20),
            inset 0 1px 0 rgba(255,255,255,0.03);
        }

        .lccLinkRow {
          position: relative;
          z-index: 1;
          margin-top: 16px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .lccTextBtn {
          background: transparent;
          border: none;
          padding: 0;
          color: rgba(174,192,225,0.88);
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .lccHeroTop {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .lccHeroTitle {
          position: relative;
          z-index: 1;
          margin-top: 24px;
          max-width: 760px;
          font-size: clamp(46px, 5.8vw, 84px);
          line-height: 0.95;
          letter-spacing: -0.06em;
          font-weight: 900;
          color: #f7faff;
        }

        .lccHeroCopy {
          position: relative;
          z-index: 1;
          margin-top: 22px;
          max-width: 760px;
          font-size: 17px;
          line-height: 1.72;
          color: rgba(225,233,244,0.78);
        }

        .lccHeroCards {
          position: relative;
          z-index: 1;
          margin-top: 24px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .lccHeroRail {
          position: relative;
          z-index: 1;
          margin-top: 16px;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.07);
          background:
            linear-gradient(180deg, rgba(14,18,28,0.78), rgba(10,13,21,0.88));
          padding: 22px;
          box-shadow:
            0 16px 30px rgba(0,0,0,0.16),
            inset 0 1px 0 rgba(255,255,255,0.03);
        }

        .lccHeroRailLabel {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.85px;
          text-transform: uppercase;
          color: rgba(214,224,242,0.72);
          margin-bottom: 4px;
        }

        @keyframes twinkle {
          0% { opacity: 0.24; }
          100% { opacity: 0.40; }
        }

        @keyframes driftA {
          0% { transform: translate3d(0,0,0) scale(1); }
          100% { transform: translate3d(2%,4%,0) scale(1.08); }
        }

        @keyframes driftB {
          0% { transform: translate3d(0,0,0) scale(1); }
          100% { transform: translate3d(-3%,2%,0) scale(1.06); }
        }

        @keyframes driftC {
          0% { transform: translate3d(0,0,0) scale(1); }
          100% { transform: translate3d(3%,-2%,0) scale(1.05); }
        }

        @media (max-width: 1240px) {
          .lccLayout {
            grid-template-columns: 1fr;
          }

          .lccAuthPanel {
            max-width: 760px;
          }
        }

        @media (max-width: 980px) {
          .lccHeroCards {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .lccShell {
            padding: 18px 14px 22px;
          }

          .lccAuthPanel,
          .lccHeroPanel {
            padding: 22px;
            border-radius: 28px;
          }

          .lccHeroTitle {
            font-size: clamp(38px, 13vw, 58px);
          }
        }

        @media (max-width: 640px) {
          .lccLoginRoot {
            min-height: 100dvh;
          }

          .lccLinkRow {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}