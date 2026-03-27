"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

function isPublicPath(pathname = "") {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/auth")
  );
}

export default function AppAccessGate({ children }) {
  const pathname = usePathname() || "/";
  const router = useRouter();

  const publicRoute = useMemo(() => isPublicPath(pathname), [pathname]);

  const [checking, setChecking] = useState(!publicRoute);
  const [disabledMessage, setDisabledMessage] = useState(false);

  useEffect(() => {
    if (!publicRoute || pathname !== "/login") {
      setDisabledMessage(false);
      return;
    }

    if (typeof window === "undefined") {
      setDisabledMessage(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setDisabledMessage(params.get("disabled") === "1");
  }, [publicRoute, pathname]);

  useEffect(() => {
    let alive = true;

    async function redirectToLogin(disabled = false) {
      try {
        await supabase?.auth?.signOut?.();
      } catch {
        // ignore signout failures
      }

      if (!alive) return;

      setChecking(false);
      router.replace(disabled ? "/login?disabled=1" : "/login");
    }

    async function runCheck() {
      if (publicRoute) {
        if (!alive) return;
        setChecking(false);
        return;
      }

      if (!supabase) {
        await redirectToLogin(false);
        return;
      }

      if (alive) {
        setChecking(true);
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!alive) return;

        if (userError || !user) {
          await redirectToLogin(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_disabled, status")
          .eq("id", user.id)
          .maybeSingle();

        if (!alive) return;

        if (profileError) {
          console.error("AppAccessGate profile lookup failed:", profileError);
          await redirectToLogin(false);
          return;
        }

        const isDisabled =
          profile?.is_disabled === true ||
          String(profile?.status || "").toLowerCase() === "suspended";

        if (isDisabled) {
          await redirectToLogin(true);
          return;
        }

        setChecking(false);
      } catch (error) {
        console.error("AppAccessGate runCheck failed:", error);
        await redirectToLogin(false);
      }
    }

    runCheck();

    const authListener = supabase?.auth?.onAuthStateChange?.((event) => {
      if (publicRoute) return;

      if (event === "SIGNED_OUT") {
        router.replace("/login");
        return;
      }

      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        runCheck();
      }
    });

    return () => {
      alive = false;
      authListener?.data?.subscription?.unsubscribe?.();
    };
  }, [publicRoute, router]);

  if (publicRoute) {
    return (
      <>
        {disabledMessage ? (
          <div className="disabledBanner">
            <div className="disabledBannerInner">
              <ShieldAlert size={16} />
              <span>Your account has been suspended. Contact support for access.</span>
            </div>

            <style jsx>{`
              .disabledBanner {
                position: sticky;
                top: 0;
                z-index: 60;
                padding: 12px 16px 0;
                background: transparent;
              }

              .disabledBannerInner {
                max-width: 720px;
                margin: 0 auto;
                min-height: 44px;
                padding: 0 14px;
                display: flex;
                align-items: center;
                gap: 10px;
                border-radius: 14px;
                background: rgba(110, 22, 22, 0.92);
                border: 1px solid rgba(255, 128, 128, 0.2);
                color: #ffd8d8;
                font-weight: 700;
                box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
              }
            `}</style>
          </div>
        ) : null}
        {children}
      </>
    );
  }

  if (checking) {
    return (
      <div className="appGate">
        <div className="appGateCard">
          <div className="appGateIcon">
            <Loader2 className="spin" size={24} />
          </div>
          <h1>Checking account access</h1>
          <p>Verifying your session and account status.</p>
        </div>

        <style jsx>{`
          .appGate {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background:
              radial-gradient(circle at top, rgba(57, 89, 168, 0.18), transparent 38%),
              radial-gradient(circle at 85% 10%, rgba(29, 185, 84, 0.08), transparent 28%),
              linear-gradient(180deg, #04070c 0%, #08101b 100%);
          }

          .appGateCard {
            width: min(440px, 100%);
            border-radius: 28px;
            border: 1px solid rgba(148, 174, 255, 0.18);
            background: rgba(7, 11, 18, 0.78);
            backdrop-filter: blur(18px);
            box-shadow:
              0 24px 80px rgba(0, 0, 0, 0.44),
              inset 0 1px 0 rgba(255, 255, 255, 0.06);
            padding: 28px;
            text-align: center;
          }

          .appGateIcon {
            width: 58px;
            height: 58px;
            margin: 0 auto 16px;
            border-radius: 18px;
            display: grid;
            place-items: center;
            color: #dbe7ff;
            background:
              linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)),
              rgba(33, 46, 76, 0.72);
            border: 1px solid rgba(148, 174, 255, 0.24);
          }

          h1 {
            margin: 0;
            color: #eef4ff;
            font-size: 1.28rem;
            font-weight: 700;
          }

          p {
            margin: 10px 0 0;
            color: rgba(214, 226, 255, 0.72);
            line-height: 1.55;
          }

          .spin {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return children;
}