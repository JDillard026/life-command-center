export function safeString(value) {
  return String(value || "").trim();
}

export function safeEmail(value) {
  return safeString(value).toLowerCase();
}

export function niceErr(error) {
  return error?.message || "Something went wrong.";
}

export function createEmptyProfile() {
  return {
    fullName: "",
    username: "",
    bio: "",
    phone: "",
    location: "",
    avatarUrl: "",
  };
}

export function createEmptyPrefs() {
  const fallbackTimeZone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
      : "America/New_York";

  return {
    compactUI: false,
    emailAlerts: true,
    pushAlerts: false,
    weeklySummary: true,
    darkMode: true,
    showBalances: true,
    twoFactorReady: false,
    currency: "USD",
    timezone: fallbackTimeZone,
  };
}

export function mapProfileFromIdentity(identity) {
  return {
    fullName: identity?.fullName || "",
    username: identity?.username || "",
    bio: identity?.profile?.bio || "",
    phone: identity?.profile?.phone || "",
    location: identity?.profile?.location || "",
    avatarUrl: identity?.avatarUrl || "",
  };
}

export function mapPrefsRow(row) {
  const defaults = createEmptyPrefs();

  if (!row) return defaults;

  return {
    compactUI: !!row.compact_ui,
    emailAlerts: !!row.email_alerts,
    pushAlerts: !!row.push_alerts,
    weeklySummary: !!row.weekly_summary,
    darkMode: !!row.dark_mode,
    showBalances: !!row.show_balances,
    twoFactorReady: !!row.two_factor_ready,
    currency: row.currency || defaults.currency,
    timezone: row.timezone || defaults.timezone,
  };
}

export function buildProfilePayload({ userId, userEmail, profile }) {
  return {
    id: userId,
    email: safeEmail(userEmail),
    full_name: safeString(profile.fullName) || null,
    username: safeString(profile.username) || null,
    bio: safeString(profile.bio) || null,
    phone: safeString(profile.phone) || null,
    location: safeString(profile.location) || null,
    avatar_url: safeString(profile.avatarUrl) || null,
  };
}

export function buildPrefsPayload({ userId, prefs }) {
  return {
    user_id: userId,
    compact_ui: !!prefs.compactUI,
    email_alerts: !!prefs.emailAlerts,
    push_alerts: !!prefs.pushAlerts,
    weekly_summary: !!prefs.weeklySummary,
    dark_mode: !!prefs.darkMode,
    show_balances: !!prefs.showBalances,
    two_factor_ready: !!prefs.twoFactorReady,
    currency: prefs.currency || "USD",
    timezone: prefs.timezone || "America/New_York",
  };
}

export function buildExportPayload({ profile, prefs }) {
  return {
    exported_at: new Date().toISOString(),
    profile: {
      fullName: profile.fullName,
      username: profile.username,
      bio: profile.bio,
      phone: profile.phone,
      location: profile.location,
      avatarUrl: profile.avatarUrl,
    },
    preferences: {
      compactUI: prefs.compactUI,
      emailAlerts: prefs.emailAlerts,
      pushAlerts: prefs.pushAlerts,
      weeklySummary: prefs.weeklySummary,
      darkMode: prefs.darkMode,
      showBalances: prefs.showBalances,
      twoFactorReady: prefs.twoFactorReady,
      currency: prefs.currency,
      timezone: prefs.timezone,
    },
  };
}

export function mergeImportPayload({ currentProfile, currentPrefs, parsed }) {
  return {
    profile: {
      ...currentProfile,
      fullName: parsed?.profile?.fullName ?? currentProfile.fullName,
      username: parsed?.profile?.username ?? currentProfile.username,
      bio: parsed?.profile?.bio ?? currentProfile.bio,
      phone: parsed?.profile?.phone ?? currentProfile.phone,
      location: parsed?.profile?.location ?? currentProfile.location,
      avatarUrl: parsed?.profile?.avatarUrl ?? currentProfile.avatarUrl,
    },
    prefs: {
      ...currentPrefs,
      compactUI: parsed?.preferences?.compactUI ?? currentPrefs.compactUI,
      emailAlerts: parsed?.preferences?.emailAlerts ?? currentPrefs.emailAlerts,
      pushAlerts: parsed?.preferences?.pushAlerts ?? currentPrefs.pushAlerts,
      weeklySummary:
        parsed?.preferences?.weeklySummary ?? currentPrefs.weeklySummary,
      darkMode: parsed?.preferences?.darkMode ?? currentPrefs.darkMode,
      showBalances:
        parsed?.preferences?.showBalances ?? currentPrefs.showBalances,
      twoFactorReady:
        parsed?.preferences?.twoFactorReady ?? currentPrefs.twoFactorReady,
      currency: parsed?.preferences?.currency ?? currentPrefs.currency,
      timezone: parsed?.preferences?.timezone ?? currentPrefs.timezone,
    },
  };
}

export function formatSyncTime() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}