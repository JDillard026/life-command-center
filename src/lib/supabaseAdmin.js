import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createBaseClient(key, extra = {}) {
  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    ...extra,
  });
}

export function createSupabaseAdminClient() {
  const client = createBaseClient(serviceRole);
  if (!client) {
    throw new Error("Missing Supabase admin configuration.");
  }
  return client;
}

export function createSupabaseRequestClient(authorization = "") {
  const client = createBaseClient(anon, authorization
    ? {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      }
    : {}
  );

  if (!client) {
    throw new Error("Missing Supabase request configuration.");
  }

  return client;
}

export const supabaseAdmin = createBaseClient(serviceRole);
