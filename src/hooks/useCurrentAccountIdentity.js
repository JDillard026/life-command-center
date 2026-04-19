"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function safeString(value) {
  return String(value || "").trim();
}

function safeEmail(value) {
  return safeString(value).toLowerCase();
}

function initialsFromName(name, email) {
  const base = safeString(name);

  if (base) {
    const parts = base.split(/\s+/).filter(Boolean);
    const initials = parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");

    return initials || "U";
  }

  return String(email || "U").slice(0, 1).toUpperCase();
}

function emptyIdentity(error = null) {
  return {
    loading: false,
    error,
    user: null,
    userId: "",
    email: "",
    fullName: "",
    username: "",
    avatarUrl: "",
    displayName: "Account",
    initials: "U",
    profile: {
      bio: "",
      phone: "",
      location: "",
    },
  };
}

function buildIdentitySnapshot({ user = null, profile = null, error = null }) {
  const email = safeEmail(user?.email);
  const fullName =
    safeString(profile?.full_name) ||
    safeString(user?.user_metadata?.full_name) ||
    safeString(user?.user_metadata?.name);

  const username = safeString(profile?.username);
  const avatarUrl =
    safeString(profile?.avatar_url) || safeString(user?.user_metadata?.avatar_url);

  const displayName = fullName || username || email || "Account";
  const initials = initialsFromName(fullName || username, email);

  return {
    loading: false,
    error,
    user,
    userId: user?.id || "",
    email,
    fullName,
    username,
    avatarUrl,
    displayName,
    initials,
    profile: {
      bio: safeString(profile?.bio),
      phone: safeString(profile?.phone),
      location: safeString(profile?.location),
    },
  };
}

export default function useCurrentAccountIdentity() {
  const [state, setState] = useState({
    ...emptyIdentity(),
    loading: true,
  });

  const resolveIdentity = useCallback(async (sessionOverride) => {
    if (!supabase) {
      return emptyIdentity("Supabase client is not available.");
    }

    const session =
      sessionOverride !== undefined
        ? sessionOverride
        : (await supabase.auth.getSession()).data.session ?? null;

    const user = session?.user ?? null;

    if (!user) {
      return emptyIdentity();
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, bio, phone, location")
      .eq("id", user.id)
      .maybeSingle();

    return buildIdentitySnapshot({
      user,
      profile,
      error: profileError?.message || null,
    });
  }, []);

  const refresh = useCallback(async () => {
    const next = await resolveIdentity();
    setState(next);
    return next;
  }, [resolveIdentity]);

  useEffect(() => {
    let alive = true;

    async function boot(sessionOverride) {
      const next = await resolveIdentity(sessionOverride);
      if (!alive) return;
      setState(next);
    }

    setState((prev) => ({ ...prev, loading: true }));
    void boot();

    if (!supabase) {
      return () => {
        alive = false;
      };
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void boot(session);
    });

    return () => {
      alive = false;
      data?.subscription?.unsubscribe?.();
    };
  }, [resolveIdentity]);

  return useMemo(
    () => ({
      ...state,
      refresh,
    }),
    [state, refresh]
  );
}