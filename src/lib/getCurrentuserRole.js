import { supabase } from "@/lib/supabaseClient";

export async function getCurrentUserRole() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, role: null, isDisabled: false };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_disabled")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return { user, role: "user", isDisabled: false };
  }

  return {
    user,
    role: profile?.role ?? "user",
    isDisabled: profile?.is_disabled ?? false,
  };
}