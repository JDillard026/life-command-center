"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUserRole } from "@/lib/getCurrentUserRole";

export default function useRequireRole(options = {}) {
  const {
    roles = ["admin"],
    redirectTo = "/",
    loginPath = "/login",
    enabled = true,
  } = options;

  const router = useRouter();
  const pathname = usePathname();

  const allowedRoles = useMemo(() => {
    return Array.isArray(roles) ? roles : ["admin"];
  }, [JSON.stringify(roles)]);

  const [state, setState] = useState({
    loading: enabled,
    allowed: false,
    user: null,
    role: null,
    isDisabled: false,
    error: null,
  });

  useEffect(() => {
    let alive = true;

    async function checkRole() {
      if (!enabled) {
        if (!alive) return;
        setState({
          loading: false,
          allowed: true,
          user: null,
          role: null,
          isDisabled: false,
          error: null,
        });
        return;
      }

      if (alive) {
        setState((prev) => ({
          ...prev,
          loading: true,
        }));
      }

      try {
        const result = await getCurrentUserRole();
        const user = result?.user ?? null;
        const role = result?.role ?? null;
        const isDisabled = result?.isDisabled ?? false;

        if (!alive) return;

        if (!user) {
          setState({
            loading: false,
            allowed: false,
            user: null,
            role: null,
            isDisabled: false,
            error: "No authenticated user",
          });
          router.replace(loginPath);
          return;
        }

        if (isDisabled) {
          setState({
            loading: false,
            allowed: false,
            user,
            role,
            isDisabled: true,
            error: "This account is disabled",
          });
          router.replace(`${loginPath}?disabled=1`);
          return;
        }

        const allowed = allowedRoles.includes(role);

        if (!allowed) {
          setState({
            loading: false,
            allowed: false,
            user,
            role,
            isDisabled: false,
            error: `Role "${role}" is not allowed`,
          });
          router.replace(redirectTo);
          return;
        }

        setState({
          loading: false,
          allowed: true,
          user,
          role,
          isDisabled: false,
          error: null,
        });
      } catch (error) {
        if (!alive) return;

        setState({
          loading: false,
          allowed: false,
          user: null,
          role: null,
          isDisabled: false,
          error: error?.message || "Role check failed",
        });

        router.replace(loginPath);
      }
    }

    checkRole();

    return () => {
      alive = false;
    };
  }, [enabled, loginPath, pathname, redirectTo, router, allowedRoles]);

  return state;
}