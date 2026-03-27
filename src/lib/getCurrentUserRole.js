import { supabase } from "@/lib/supabaseClient";

export async function getCurrentUserRole() {
  if (!supabase) {
    return {
      user: null,
      role: null,
      isDisabled: false,
      error: "Supabase client is not available",
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      role: null,
      isDisabled: false,
      error: userError?.message || "No authenticated user",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_disabled, status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || "Failed to load user profile");
  }

  const normalizedRole = String(profile?.role || "user").toLowerCase();
  const normalizedStatus = String(profile?.status || "active").toLowerCase();

  const isDisabled =
    profile?.is_disabled === true || normalizedStatus === "suspended";

  return {
    user,
    role: normalizedRole,
    isDisabled,
    error: null,
  };
}