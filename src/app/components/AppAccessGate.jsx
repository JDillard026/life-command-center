"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUserRole } from "@/lib/getCurrentUserRole";

const PUBLIC_ROUTES = ["/login", "/reset-password"];
const PUBLIC_PREFIXES = ["/auth"];

function isPublicRoute(pathname) {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
}

export default function AppAccessGate({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  const checkingRef = useRef(false);
  const rerunRef = useRef(false);
  const mountedRef = useRef(false);
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
        const publicRoute = isPublicRoute(pathname);

        if (publicRoute) {
          if (mountedRef.current) setReady(true);
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      // DO NOT await Supabase calls directly in this callback.
      queueCheck();
    });

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
      subscription?.unsubscribe();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#040915] px-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-5 text-sm text-white/75 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          Checking access...
        </div>
      </div>
    );
  }

  return children;
}