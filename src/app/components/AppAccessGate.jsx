"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUserRole } from "@/lib/getCurrentUserRole";

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/logout",
];

const PUBLIC_PREFIXES = ["/auth"];

function isPublicRoute(pathname = "") {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function AppAccessGate({ children }) {
  const router = useRouter();
  const pathname = usePathname() || "";

  const [ready, setReady] = useState(false);

  const mountedRef = useRef(false);
  const checkingRef = useRef(false);
  const rerunRef = useRef(false);
  const signingOutRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    async function runCheck() {
      if (!mountedRef.current) return;

      if (checkingRef.current) {
        rerunRef.current = true;
        return;
      }

      checkingRef.current = true;

      try {
        if (!supabase) {
          setReady(true);
          return;
        }

        const publicRoute = isPublicRoute(pathname);

        if (publicRoute) {
          setReady(true);
          return;
        }

        const { user, isDisabled } = await getCurrentUserRole();

        if (!mountedRef.current) return;

        if (!user) {
          setReady(false);
          router.replace("/login");
          return;
        }

        if (isDisabled) {
          setReady(false);

          if (!signingOutRef.current) {
            signingOutRef.current = true;
            try {
              await supabase.auth.signOut();
            } catch {
              // ignore signout failure, still redirect
            } finally {
              signingOutRef.current = false;
            }
          }

          router.replace("/login");
          return;
        }

        setReady(true);
      } finally {
        checkingRef.current = false;

        if (rerunRef.current) {
          rerunRef.current = false;
          setTimeout(() => {
            runCheck();
          }, 0);
        }
      }
    }

    function queueCheck() {
      setTimeout(() => {
        runCheck();
      }, 0);
    }

    queueCheck();

    let unsubscribe = null;

    try {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(() => {
        queueCheck();
      });

      unsubscribe = () => subscription?.unsubscribe?.();
    } catch {
      unsubscribe = null;
    }

    function handleFocus() {
      queueCheck();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        queueCheck();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mountedRef.current = false;
      try {
        unsubscribe?.();
      } catch {}
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="lccGate">
        <div className="lccGateCard">
          <div className="lccGateTitle">Checking access</div>
          <div className="lccGateText">
            Loading your command center and verifying session status.
          </div>
        </div>
      </div>
    );
  }

  return children;
}