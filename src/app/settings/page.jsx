"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

function niceErr(error) {
  return error?.message || "Something went wrong.";
}

function safeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function initialsFromName(name, email) {
  const base = String(name || "").trim();

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

function SectionCard({ title, subtitle, right, children, className = "" }) {
  return (
    <section className={`settingsCard ${className}`}>
      <div className="sectionHead">
        <div className="sectionHeadText">
          <h2 className="sectionTitle">{title}</h2>
          {subtitle ? <p className="sectionSubtitle">{subtitle}</p> : null}
        </div>
        {right ? <div className="sectionRight">{right}</div> : null}
      </div>
      <div className="sectionBody">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <div className="fieldMeta">
        <div className="fieldLabel">{label}</div>
        {hint ? <div className="fieldHint">{hint}</div> : null}
      </div>
      {children}
    </label>
  );
}

function Input({ className = "", ...props }) {
  return <input {...props} className={`settingsInput ${className}`.trim()} />;
}

function Textarea({ className = "", style, ...props }) {
  return (
    <textarea
      {...props}
      className={`settingsInput settingsTextarea ${className}`.trim()}
      style={style}
    />
  );
}

function ToggleRow({ title, desc, enabled, onToggle }) {
  return (
    <div className="toggleRow">
      <div className="toggleCopy">
        <div className="toggleTitle">{title}</div>
        <div className="toggleDesc">{desc}</div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className={enabled ? "switchBtn switchBtnOn" : "switchBtn"}
      >
        <span className="switchTrack">
          <span className="switchThumb" />
        </span>
        <span className="switchLabel">{enabled ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

function StatTile({ label, value, tone = "neutral" }) {
  return (
    <div className={`statTile statTile-${tone}`}>
      <div className="statLabel">{label}</div>
      <div className="statValue">{value}</div>
    </div>
  );
}

function ToolRow({ title, desc, action }) {
  return (
    <div className="toolRow">
      <div>
        <div className="toolTitle">{title}</div>
        <div className="toolDesc">{desc}</div>
      </div>
      <div className="toolAction">{action}</div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const avatarInputRef = useRef(null);
  const importInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState("neutral");
  const [lastSynced, setLastSynced] = useState("");

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [busy, setBusy] = useState({
    profile: false,
    prefs: false,
    avatar: false,
    auth: false,
    tools: false,
    all: false,
  });

  const [profile, setProfile] = useState({
    fullName: "",
    username: "",
    bio: "",
    phone: "",
    location: "",
    avatarUrl: "",
  });

  const [prefs, setPrefs] = useState({
    compactUI: false,
    emailAlerts: true,
    pushAlerts: false,
    weeklySummary: true,
    darkMode: true,
    showBalances: true,
    twoFactorReady: false,
    currency: "USD",
    timezone:
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
        : "America/New_York",
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initials = useMemo(
    () => initialsFromName(profile.fullName, userEmail),
    [profile.fullName, userEmail]
  );

  const notificationCount = useMemo(() => {
    return [
      prefs.emailAlerts,
      prefs.pushAlerts,
      prefs.weeklySummary,
    ].filter(Boolean).length;
  }, [prefs.emailAlerts, prefs.pushAlerts, prefs.weeklySummary]);

  const privacyMode = prefs.showBalances ? "Visible" : "Private";

  const statusText = useMemo(() => {
    if (loading) return "Loading";
    if (!userEmail) return "Not signed in";
    return "Signed in";
  }, [loading, userEmail]);

  function stampSynced() {
    setLastSynced(
      new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    );
  }

  function setMessage(message, tone = "neutral") {
    setNotice(message);
    setNoticeTone(tone);
  }

  function updateProfileField(key, value) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function updatePrefField(key, value) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");

      if (!supabase) {
        setMessage("Supabase is not configured.", "error");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || "");

      const [
        { data: profileRow, error: profileError },
        { data: prefsRow, error: prefsError },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (profileError) throw profileError;
      if (prefsError) throw prefsError;

      if (profileRow) {
        setProfile({
          fullName: profileRow.full_name || "",
          username: profileRow.username || "",
          bio: profileRow.bio || "",
          phone: profileRow.phone || "",
          location: profileRow.location || "",
          avatarUrl: profileRow.avatar_url || "",
        });
      } else {
        setProfile((prev) => ({
          ...prev,
          fullName: user.user_metadata?.full_name || "",
          avatarUrl: user.user_metadata?.avatar_url || "",
        }));
      }

      if (prefsRow) {
        setPrefs({
          compactUI: !!prefsRow.compact_ui,
          emailAlerts: !!prefsRow.email_alerts,
          pushAlerts: !!prefsRow.push_alerts,
          weeklySummary: !!prefsRow.weekly_summary,
          darkMode: !!prefsRow.dark_mode,
          showBalances: !!prefsRow.show_balances,
          twoFactorReady: !!prefsRow.two_factor_ready,
          currency: prefsRow.currency || "USD",
          timezone: prefsRow.timezone || "America/New_York",
        });
      }

      stampSynced();
    } catch (error) {
      setMessage(niceErr(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function persistProfile({ silent = false } = {}) {
    if (!supabase || !userId) {
      if (!silent) setMessage("You must be signed in.", "error");
      return false;
    }

    try {
      setBusy((prev) => ({ ...prev, profile: true }));

      const payload = {
        id: userId,
        email: safeEmail(userEmail),
        full_name: profile.fullName || null,
        username: profile.username || null,
        bio: profile.bio || null,
        phone: profile.phone || null,
        location: profile.location || null,
        avatar_url: profile.avatarUrl || null,
      };

      const { error } = await supabase.from("profiles").upsert(payload, {
        onConflict: "id",
      });

      if (error) throw error;

      await supabase.auth.updateUser({
        data: {
          full_name: profile.fullName || null,
          avatar_url: profile.avatarUrl || null,
        },
      });

      stampSynced();
      if (!silent) setMessage("Profile saved.", "success");
      return true;
    } catch (error) {
      if (!silent) setMessage(niceErr(error), "error");
      return false;
    } finally {
      setBusy((prev) => ({ ...prev, profile: false }));
    }
  }

  async function persistPreferences({ silent = false } = {}) {
    if (!supabase || !userId) {
      if (!silent) setMessage("You must be signed in.", "error");
      return false;
    }

    try {
      setBusy((prev) => ({ ...prev, prefs: true }));

      const payload = {
        user_id: userId,
        compact_ui: prefs.compactUI,
        email_alerts: prefs.emailAlerts,
        push_alerts: prefs.pushAlerts,
        weekly_summary: prefs.weeklySummary,
        dark_mode: prefs.darkMode,
        show_balances: prefs.showBalances,
        two_factor_ready: prefs.twoFactorReady,
        currency: prefs.currency,
        timezone: prefs.timezone,
      };

      const { error } = await supabase.from("user_preferences").upsert(payload, {
        onConflict: "user_id",
      });

      if (error) throw error;

      stampSynced();
      if (!silent) setMessage("Preferences saved.", "success");
      return true;
    } catch (error) {
      if (!silent) setMessage(niceErr(error), "error");
      return false;
    } finally {
      setBusy((prev) => ({ ...prev, prefs: false }));
    }
  }

  async function saveAll() {
    try {
      setBusy((prev) => ({ ...prev, all: true }));
      setMessage("");

      const profileOk = await persistProfile({ silent: true });
      const prefsOk = await persistPreferences({ silent: true });

      if (profileOk && prefsOk) {
        setMessage("Everything saved.", "success");
      } else if (profileOk || prefsOk) {
        setMessage("Part of the page saved, but something else failed.", "warning");
      } else {
        setMessage("Nothing saved.", "error");
      }
    } finally {
      setBusy((prev) => ({ ...prev, all: false }));
    }
  }

  async function logout() {
    try {
      setBusy((prev) => ({ ...prev, auth: true }));
      setMessage("");

      await supabase?.auth.signOut();
      router.replace("/login");
    } catch (error) {
      setMessage(niceErr(error), "error");
    } finally {
      setBusy((prev) => ({ ...prev, auth: false }));
    }
  }

  async function sendPasswordReset() {
    if (!supabase) {
      setMessage("Supabase is not configured.", "error");
      return;
    }

    if (!safeEmail(userEmail)) {
      setMessage("No account email found.", "error");
      return;
    }

    try {
      setBusy((prev) => ({ ...prev, auth: true }));
      setMessage("");

      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setMessage("Password reset email sent.", "success");
    } catch (error) {
      setMessage(niceErr(error), "error");
    } finally {
      setBusy((prev) => ({ ...prev, auth: false }));
    }
  }

  function triggerAvatarUpload() {
    avatarInputRef.current?.click();
  }

  async function onAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("That file is not an image.", "error");
      return;
    }

    if (!supabase || !userId) {
      setMessage("You must be signed in first.", "error");
      return;
    }

    try {
      setBusy((prev) => ({ ...prev, avatar: true }));
      setMessage("");

      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setProfile((prev) => ({
        ...prev,
        avatarUrl: data?.publicUrl || "",
      }));

      setMessage("Avatar uploaded. Save all when you’re ready.", "success");
    } catch (error) {
      setMessage(niceErr(error), "error");
    } finally {
      setBusy((prev) => ({ ...prev, avatar: false }));
      event.target.value = "";
    }
  }

  function removeAvatar() {
    setProfile((prev) => ({ ...prev, avatarUrl: "" }));
    setMessage("Avatar removed from the form. Save all to commit it.", "warning");
  }

  function exportSettingsJson() {
    try {
      const payload = {
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

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lcc-settings-backup.json";
      a.click();
      URL.revokeObjectURL(url);

      setMessage("Settings backup exported.", "success");
    } catch (error) {
      setMessage(niceErr(error), "error");
    }
  }

  async function copyConfigJson() {
    try {
      setBusy((prev) => ({ ...prev, tools: true }));

      const payload = {
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

      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setMessage("Current config copied to clipboard.", "success");
    } catch (error) {
      setMessage(niceErr(error), "error");
    } finally {
      setBusy((prev) => ({ ...prev, tools: false }));
    }
  }

  function triggerImportJson() {
    importInputRef.current?.click();
  }

  async function onImportJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setBusy((prev) => ({ ...prev, tools: true }));

      const raw = await file.text();
      const parsed = JSON.parse(raw);

      if (parsed.profile) {
        setProfile((prev) => ({
          ...prev,
          fullName: parsed.profile.fullName ?? prev.fullName,
          username: parsed.profile.username ?? prev.username,
          bio: parsed.profile.bio ?? prev.bio,
          phone: parsed.profile.phone ?? prev.phone,
          location: parsed.profile.location ?? prev.location,
          avatarUrl: parsed.profile.avatarUrl ?? prev.avatarUrl,
        }));
      }

      if (parsed.preferences) {
        setPrefs((prev) => ({
          ...prev,
          compactUI:
            parsed.preferences.compactUI ?? prev.compactUI,
          emailAlerts:
            parsed.preferences.emailAlerts ?? prev.emailAlerts,
          pushAlerts:
            parsed.preferences.pushAlerts ?? prev.pushAlerts,
          weeklySummary:
            parsed.preferences.weeklySummary ?? prev.weeklySummary,
          darkMode:
            parsed.preferences.darkMode ?? prev.darkMode,
          showBalances:
            parsed.preferences.showBalances ?? prev.showBalances,
          twoFactorReady:
            parsed.preferences.twoFactorReady ?? prev.twoFactorReady,
          currency: parsed.preferences.currency ?? prev.currency,
          timezone: parsed.preferences.timezone ?? prev.timezone,
        }));
      }

      setMessage("Backup imported into the form. Save all to commit it.", "success");
    } catch {
      setMessage("That JSON file is invalid.", "error");
    } finally {
      setBusy((prev) => ({ ...prev, tools: false }));
      event.target.value = "";
    }
  }

  return (
    <main className="settingsShell">
      <div className="settingsBackdrop" aria-hidden="true">
        <div className="bgBase" />
        <div className="bgGrid" />
        <div className="bgStars" />
        <div className="bgGlow bgGlowA" />
        <div className="bgGlow bgGlowB" />
        <div className="bgGlow bgGlowC" />
      </div>

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={onAvatarChange}
        style={{ display: "none" }}
      />

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        onChange={onImportJson}
        style={{ display: "none" }}
      />

      <div className="settingsPage">
        <header className="commandHero">
          <div className="eyebrow">Settings</div>

          <div className="heroGlass">
            <div className="heroTop">
              <div className="heroCopy">
                <h1 className="heroTitle">Account Command</h1>
                <p className="heroSubtitle">
                  Clean account setup, privacy, notifications, security, backups,
                  integrations, and the core tools people actually expect.
                </p>
              </div>

              <div className="heroActions">
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={saveAll}
                  disabled={loading || busy.all || busy.profile || busy.prefs}
                >
                  {busy.all ? "Saving..." : "Save all"}
                </button>

                <button
                  type="button"
                  className="btn btnSecondary"
                  onClick={loadData}
                  disabled={loading}
                >
                  Refresh
                </button>

                <button
                  type="button"
                  className="btn btnGhost"
                  onClick={logout}
                  disabled={busy.auth || loading}
                >
                  {busy.auth ? "Working..." : "Logout"}
                </button>
              </div>
            </div>

            <div className="heroStats">
              <StatTile label="Status" value={statusText} tone="good" />
              <StatTile
                label="Notifications live"
                value={`${notificationCount}/3`}
              />
              <StatTile label="Privacy mode" value={privacyMode} />
              <StatTile
                label="Last synced"
                value={lastSynced || "Not yet"}
                tone="accent"
              />
            </div>
          </div>
        </header>

        {notice ? (
          <div className={`notice notice-${noticeTone}`}>
            <div className="noticeTitle">Notice</div>
            <div className="noticeText">{notice}</div>
          </div>
        ) : null}

        <div className="settingsLayout">
          <div className="mainStack">
            <SectionCard
              title="Identity"
              subtitle="Your real account identity. Clean, professional, and easy to manage."
              right={
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={() => persistProfile()}
                  disabled={loading || busy.profile || busy.all}
                >
                  {busy.profile ? "Saving..." : "Save profile"}
                </button>
              }
            >
              <div className="identityLayout">
                <aside className="avatarCard">
                  <div className="avatarFrame">
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt="Profile avatar"
                        className="avatarImage"
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>

                  <div className="avatarMeta">
                    <div className="avatarName">
                      {profile.fullName || "Your Name"}
                    </div>
                    <div className="avatarHandle">
                      {profile.username
                        ? `@${profile.username.replace(/^@/, "")}`
                        : "@username"}
                    </div>
                  </div>

                  <div className="avatarButtons">
                    <button
                      type="button"
                      className="btn btnPrimary"
                      onClick={triggerAvatarUpload}
                      disabled={busy.avatar}
                    >
                      {busy.avatar ? "Uploading..." : "Upload photo"}
                    </button>

                    <button
                      type="button"
                      className="btn btnSecondary"
                      onClick={removeAvatar}
                    >
                      Remove photo
                    </button>
                  </div>
                </aside>

                <div className="formStack">
                  <div className="fieldGrid two">
                    <Field label="Full name">
                      <Input
                        value={profile.fullName}
                        onChange={(e) =>
                          updateProfileField("fullName", e.target.value)
                        }
                        placeholder="Jacob Dillard"
                      />
                    </Field>

                    <Field label="Username" hint="Unique public handle.">
                      <Input
                        value={profile.username}
                        onChange={(e) =>
                          updateProfileField("username", e.target.value)
                        }
                        placeholder="jacob"
                      />
                    </Field>
                  </div>

                  <Field
                    label="Bio"
                    hint="Short description for the account card and profile surfaces."
                  >
                    <Textarea
                      value={profile.bio}
                      onChange={(e) => updateProfileField("bio", e.target.value)}
                      placeholder="Building a financial command center for real life."
                    />
                  </Field>

                  <div className="fieldGrid two">
                    <Field label="Phone">
                      <Input
                        value={profile.phone}
                        onChange={(e) =>
                          updateProfileField("phone", e.target.value)
                        }
                        placeholder="(555) 555-5555"
                      />
                    </Field>

                    <Field label="Location">
                      <Input
                        value={profile.location}
                        onChange={(e) =>
                          updateProfileField("location", e.target.value)
                        }
                        placeholder="Wimauma, FL"
                      />
                    </Field>
                  </div>

                  <Field label="Email address" hint="Pulled from auth.">
                    <Input
                      value={loading ? "Loading..." : userEmail || ""}
                      disabled
                    />
                  </Field>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="App behavior"
              subtitle="Control how the site feels day to day."
              right={
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={() => persistPreferences()}
                  disabled={loading || busy.prefs || busy.all}
                >
                  {busy.prefs ? "Saving..." : "Save preferences"}
                </button>
              }
            >
              <div className="fieldGrid two">
                <Field label="Currency">
                  <select
                    className="settingsInput"
                    value={prefs.currency}
                    onChange={(e) => updatePrefField("currency", e.target.value)}
                  >
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="CAD">CAD — Canadian Dollar</option>
                  </select>
                </Field>

                <Field label="Timezone">
                  <Input
                    value={prefs.timezone}
                    onChange={(e) => updatePrefField("timezone", e.target.value)}
                    placeholder="America/New_York"
                  />
                </Field>
              </div>

              <div className="toggleStack">
                <ToggleRow
                  title="Dark mode"
                  desc="Keep the premium dark LCC look."
                  enabled={prefs.darkMode}
                  onToggle={() => updatePrefField("darkMode", !prefs.darkMode)}
                />

                <ToggleRow
                  title="Compact UI"
                  desc="Tighter spacing and denser layout."
                  enabled={prefs.compactUI}
                  onToggle={() => updatePrefField("compactUI", !prefs.compactUI)}
                />

                <ToggleRow
                  title="Show balances"
                  desc="Hide money values when you want more privacy."
                  enabled={prefs.showBalances}
                  onToggle={() =>
                    updatePrefField("showBalances", !prefs.showBalances)
                  }
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Notifications"
              subtitle="Simple, expected controls with no clutter."
            >
              <div className="toggleStack">
                <ToggleRow
                  title="Email alerts"
                  desc="Important finance and account notices."
                  enabled={prefs.emailAlerts}
                  onToggle={() =>
                    updatePrefField("emailAlerts", !prefs.emailAlerts)
                  }
                />

                <ToggleRow
                  title="Push alerts"
                  desc="Future browser or mobile push support."
                  enabled={prefs.pushAlerts}
                  onToggle={() =>
                    updatePrefField("pushAlerts", !prefs.pushAlerts)
                  }
                />

                <ToggleRow
                  title="Weekly summary"
                  desc="A recap of balances, spending, bills, and motion."
                  enabled={prefs.weeklySummary}
                  onToggle={() =>
                    updatePrefField("weeklySummary", !prefs.weeklySummary)
                  }
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Security"
              subtitle="The normal account stuff every real app needs."
            >
              <div className="toolsStack">
                <ToolRow
                  title="Password reset"
                  desc="Send a reset link to your account email."
                  action={
                    <button
                      type="button"
                      className="btn btnSecondary"
                      onClick={sendPasswordReset}
                      disabled={busy.auth || loading}
                    >
                      {busy.auth ? "Working..." : "Reset password"}
                    </button>
                  }
                />

                <ToolRow
                  title="Two-factor readiness"
                  desc="UI-level toggle for now. Wire your actual auth flow later."
                  action={
                    <button
                      type="button"
                      className={
                        prefs.twoFactorReady
                          ? "btn btnSecondary btnOn"
                          : "btn btnSecondary"
                      }
                      onClick={() =>
                        updatePrefField(
                          "twoFactorReady",
                          !prefs.twoFactorReady
                        )
                      }
                    >
                      {prefs.twoFactorReady ? "Enabled" : "Disabled"}
                    </button>
                  }
                />

                <ToolRow
                  title="Current session"
                  desc="Sign out on this device."
                  action={
                    <button
                      type="button"
                      className="btn btnGhost"
                      onClick={logout}
                      disabled={busy.auth || loading}
                    >
                      Logout
                    </button>
                  }
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Backup & transfer tools"
              subtitle="Useful settings tools that actually help instead of just taking up space."
            >
              <div className="toolsStack">
                <ToolRow
                  title="Export settings JSON"
                  desc="Download a backup of your profile and preference config."
                  action={
                    <button
                      type="button"
                      className="btn btnSecondary"
                      onClick={exportSettingsJson}
                    >
                      Export
                    </button>
                  }
                />

                <ToolRow
                  title="Import settings JSON"
                  desc="Load a backup into the form, then save it."
                  action={
                    <button
                      type="button"
                      className="btn btnSecondary"
                      onClick={triggerImportJson}
                      disabled={busy.tools}
                    >
                      Import
                    </button>
                  }
                />

                <ToolRow
                  title="Copy current config"
                  desc="Copy the current settings payload to your clipboard."
                  action={
                    <button
                      type="button"
                      className="btn btnSecondary"
                      onClick={copyConfigJson}
                      disabled={busy.tools}
                    >
                      {busy.tools ? "Copying..." : "Copy JSON"}
                    </button>
                  }
                />
              </div>
            </SectionCard>
          </div>

          <aside className="sideStack">
            <SectionCard
              title="Account preview"
              subtitle="How the identity block feels inside the app."
              className="stickyCard"
            >
              <div className="previewCard">
                <div className="previewTop">
                  <div className="previewAvatar">
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt="Preview avatar"
                        className="avatarImage"
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>

                  <div className="previewIdentity">
                    <div className="previewName">
                      {profile.fullName || "Your Name"}
                    </div>
                    <div className="previewHandle">
                      {profile.username
                        ? `@${profile.username.replace(/^@/, "")}`
                        : "@username"}
                    </div>
                  </div>
                </div>

                <div className="previewBio">
                  {profile.bio ||
                    "Add a short description so the profile feels complete."}
                </div>

                <div className="previewMetaGrid">
                  <div className="previewMetaCard">
                    <div className="miniLabel">Email</div>
                    <div className="miniValue breakValue">{userEmail || "—"}</div>
                  </div>

                  <div className="previewMetaCard">
                    <div className="miniLabel">Location</div>
                    <div className="miniValue">{profile.location || "—"}</div>
                  </div>

                  <div className="previewMetaCard">
                    <div className="miniLabel">Privacy</div>
                    <div className="miniValue">{privacyMode}</div>
                  </div>

                  <div className="previewMetaCard">
                    <div className="miniLabel">Theme</div>
                    <div className="miniValue">
                      {prefs.darkMode ? "Dark glass" : "Light disabled"}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Quick tools"
              subtitle="Fast actions people reach for all the time."
            >
              <div className="quickTools">
                <button
                  type="button"
                  className="quickToolBtn"
                  onClick={saveAll}
                  disabled={loading || busy.all || busy.profile || busy.prefs}
                >
                  <span className="quickToolTitle">Save everything</span>
                  <span className="quickToolDesc">
                    Commit profile and preferences together
                  </span>
                </button>

                <button
                  type="button"
                  className="quickToolBtn"
                  onClick={loadData}
                  disabled={loading}
                >
                  <span className="quickToolTitle">Reload live data</span>
                  <span className="quickToolDesc">
                    Pull the latest profile and preferences from Supabase
                  </span>
                </button>

                <button
                  type="button"
                  className="quickToolBtn"
                  onClick={sendPasswordReset}
                  disabled={busy.auth || loading}
                >
                  <span className="quickToolTitle">Reset password</span>
                  <span className="quickToolDesc">
                    Send reset email to {userEmail || "your account"}
                  </span>
                </button>
              </div>
            </SectionCard>

            <SectionCard
              title="Integrations"
              subtitle="What’s ready, what’s next, and where the page has room to grow."
            >
              <div className="integrationList">
                <div className="integrationRow">
                  <div>
                    <div className="integrationTitle">Supabase auth</div>
                    <div className="integrationDesc">
                      Live account identity and session state.
                    </div>
                  </div>
                  <span className="pill pillGood">Live</span>
                </div>

                <div className="integrationRow">
                  <div>
                    <div className="integrationTitle">Profile storage</div>
                    <div className="integrationDesc">
                      Uses profiles and user_preferences.
                    </div>
                  </div>
                  <span className="pill pillGood">Live</span>
                </div>

                <div className="integrationRow">
                  <div>
                    <div className="integrationTitle">Plaid</div>
                    <div className="integrationDesc">
                      Bank sync surface for later.
                    </div>
                  </div>
                  <span className="pill">Soon</span>
                </div>

                <div className="integrationRow">
                  <div>
                    <div className="integrationTitle">Google</div>
                    <div className="integrationDesc">
                      Sign-in and calendar hooks later.
                    </div>
                  </div>
                  <span className="pill">Soon</span>
                </div>

                <div className="integrationRow">
                  <div>
                    <div className="integrationTitle">Data export/import</div>
                    <div className="integrationDesc">
                      JSON tools are already included here.
                    </div>
                  </div>
                  <span className="pill pillAccent">Ready</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Danger zone"
              subtitle="Low-noise account controls."
            >
              <div className="dangerStack">
                <div className="dangerCard">
                  <div>
                    <div className="dangerTitle">Logout this device</div>
                    <div className="dangerDesc">
                      End the current session right now.
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btnDanger"
                    onClick={logout}
                    disabled={busy.auth || loading}
                  >
                    Logout
                  </button>
                </div>
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .settingsShell {
          position: relative;
          min-height: 100%;
          padding: 18px 18px 28px;
          overflow: hidden;
        }

        .settingsBackdrop {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .bgBase,
        .bgGrid,
        .bgStars,
        .bgGlow {
          position: absolute;
          inset: 0;
        }

        .bgBase {
          background:
            radial-gradient(circle at top left, rgba(35, 78, 170, 0.16), transparent 22%),
            radial-gradient(circle at 85% 22%, rgba(36, 150, 137, 0.08), transparent 18%),
            linear-gradient(180deg, #060b14 0%, #07101b 46%, #060b13 100%);
        }

        .bgGrid {
          opacity: 0.12;
          background-image:
            linear-gradient(rgba(130, 154, 198, 0.09) 1px, transparent 1px),
            linear-gradient(90deg, rgba(130, 154, 198, 0.09) 1px, transparent 1px);
          background-size: 34px 34px;
          mask-image: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.95),
            rgba(0, 0, 0, 0.78) 46%,
            rgba(0, 0, 0, 0.4) 74%,
            transparent 100%
          );
          -webkit-mask-image: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.95),
            rgba(0, 0, 0, 0.78) 46%,
            rgba(0, 0, 0, 0.4) 74%,
            transparent 100%
          );
        }

        .bgStars {
          opacity: 0.66;
          background-image:
            radial-gradient(1.2px 1.2px at 22px 28px, rgba(255,255,255,0.72), transparent 60%),
            radial-gradient(1px 1px at 90px 118px, rgba(255,255,255,0.54), transparent 60%),
            radial-gradient(1px 1px at 154px 60px, rgba(96,172,255,0.52), transparent 60%),
            radial-gradient(1px 1px at 42px 188px, rgba(255,255,255,0.44), transparent 60%),
            radial-gradient(1px 1px at 200px 150px, rgba(92,228,210,0.28), transparent 60%),
            radial-gradient(1px 1px at 300px 84px, rgba(255,255,255,0.4), transparent 60%),
            radial-gradient(1.2px 1.2px at 332px 206px, rgba(96,172,255,0.32), transparent 60%);
          background-size: 360px 260px;
        }

        .bgGlow {
          border-radius: 999px;
          filter: blur(80px);
        }

        .bgGlowA {
          top: -90px;
          left: -120px;
          width: 320px;
          height: 320px;
          background: rgba(48, 92, 255, 0.08);
        }

        .bgGlowB {
          right: -140px;
          top: 28%;
          width: 360px;
          height: 360px;
          background: rgba(24, 202, 180, 0.06);
        }

        .bgGlowC {
          left: 28%;
          bottom: -140px;
          width: 420px;
          height: 260px;
          background: rgba(58, 82, 168, 0.08);
        }

        .settingsPage {
          position: relative;
          z-index: 1;
          width: min(1420px, 100%);
          margin: 0 auto;
        }

        .eyebrow {
          margin-bottom: 10px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(200, 212, 232, 0.68);
        }

        .commandHero {
          margin-bottom: 18px;
        }

        .heroGlass,
        .settingsCard,
        .notice {
          position: relative;
          overflow: hidden;
          border-radius: 30px;
          border: 1px solid rgba(255, 255, 255, 0.075);
          background:
            radial-gradient(circle at top right, rgba(56, 86, 146, 0.11), transparent 20%),
            linear-gradient(180deg, rgba(10, 15, 24, 0.9), rgba(7, 11, 19, 0.97));
          box-shadow:
            0 26px 60px rgba(0, 0, 0, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        .heroGlass {
          padding: 22px;
        }

        .heroTop {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          flex-wrap: wrap;
        }

        .heroCopy {
          max-width: 760px;
        }

        .heroTitle {
          margin: 0;
          font-size: clamp(34px, 5vw, 58px);
          line-height: 0.98;
          letter-spacing: -0.06em;
          color: #f4f7fd;
        }

        .heroSubtitle {
          margin: 12px 0 0;
          max-width: 760px;
          color: rgba(204, 214, 232, 0.78);
          font-size: 14px;
          line-height: 1.65;
        }

        .heroActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .heroStats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }

        .statTile {
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.065);
          background: rgba(255, 255, 255, 0.03);
          padding: 14px 16px;
        }

        .statTile-good {
          background:
            linear-gradient(180deg, rgba(33, 64, 54, 0.34), rgba(15, 25, 23, 0.22));
        }

        .statTile-accent {
          background:
            linear-gradient(180deg, rgba(28, 44, 78, 0.42), rgba(14, 18, 28, 0.26));
        }

        .statLabel {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(190, 202, 224, 0.58);
        }

        .statValue {
          margin-top: 8px;
          font-size: 16px;
          font-weight: 900;
          color: rgba(245, 248, 253, 0.96);
          line-height: 1.25;
        }

        .notice {
          padding: 16px 18px;
          margin-bottom: 18px;
        }

        .notice-success {
          border-color: rgba(92, 178, 145, 0.18);
          background:
            linear-gradient(180deg, rgba(14, 24, 22, 0.96), rgba(8, 13, 15, 0.98));
        }

        .notice-warning {
          border-color: rgba(197, 164, 88, 0.18);
        }

        .notice-error {
          border-color: rgba(196, 93, 93, 0.2);
          background:
            linear-gradient(180deg, rgba(22, 12, 14, 0.96), rgba(14, 8, 10, 0.98));
        }

        .noticeTitle {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(203, 214, 232, 0.62);
        }

        .noticeText {
          margin-top: 8px;
          color: rgba(244, 247, 252, 0.94);
          line-height: 1.5;
        }

        .settingsLayout {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
          gap: 18px;
          align-items: start;
        }

        .mainStack,
        .sideStack {
          display: grid;
          gap: 18px;
        }

        .stickyCard {
          position: sticky;
          top: 12px;
        }

        .settingsCard {
          padding: 18px;
        }

        .sectionHead {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
        }

        .sectionHeadText {
          min-width: 0;
        }

        .sectionTitle {
          margin: 0;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 1.05;
          color: #f4f7fd;
        }

        .sectionSubtitle {
          margin: 8px 0 0;
          color: rgba(198, 208, 228, 0.72);
          line-height: 1.55;
          font-size: 13px;
        }

        .sectionRight {
          display: flex;
          align-items: center;
        }

        .sectionBody {
          margin-top: 16px;
        }

        .identityLayout {
          display: grid;
          grid-template-columns: 210px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .avatarCard,
        .previewCard,
        .previewMetaCard,
        .toolRow,
        .integrationRow,
        .dangerCard,
        .quickToolBtn,
        .toggleRow {
          border-radius: 22px;
          border: 1px solid rgba(255, 255, 255, 0.065);
          background: rgba(255, 255, 255, 0.03);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
        }

        .avatarCard {
          padding: 16px;
        }

        .avatarFrame {
          width: 132px;
          height: 132px;
          margin: 0 auto;
          border-radius: 999px;
          overflow: hidden;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.075);
          background:
            radial-gradient(circle at 30% 30%, rgba(123, 138, 172, 0.2), transparent 42%),
            linear-gradient(180deg, rgba(26, 35, 52, 0.96), rgba(14, 20, 31, 0.98));
          color: #f8faff;
          font-size: 34px;
          font-weight: 950;
          box-shadow:
            0 16px 36px rgba(0, 0, 0, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.035);
        }

        .avatarImage {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatarMeta {
          margin-top: 14px;
          text-align: center;
        }

        .avatarName {
          font-size: 16px;
          font-weight: 900;
          color: #f4f7fd;
        }

        .avatarHandle {
          margin-top: 6px;
          color: rgba(193, 205, 226, 0.66);
          font-size: 13px;
        }

        .avatarButtons {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }

        .formStack,
        .toggleStack,
        .toolsStack,
        .integrationList,
        .dangerStack,
        .quickTools {
          display: grid;
          gap: 14px;
        }

        .fieldGrid {
          display: grid;
          gap: 14px;
        }

        .fieldGrid.two {
          grid-template-columns: 1fr 1fr;
        }

        .field {
          display: grid;
          gap: 8px;
        }

        .fieldMeta {
          display: grid;
          gap: 3px;
        }

        .fieldLabel {
          font-size: 13px;
          font-weight: 900;
          color: rgba(236, 241, 249, 0.94);
        }

        .fieldHint {
          font-size: 12px;
          line-height: 1.4;
          color: rgba(196, 208, 228, 0.62);
        }

        .settingsInput {
          width: 100%;
          min-height: 54px;
          border: 1px solid rgba(255, 255, 255, 0.075);
          border-radius: 18px;
          padding: 0 16px;
          background:
            linear-gradient(180deg, rgba(22, 29, 42, 0.94), rgba(12, 17, 28, 0.98));
          color: #f4f7fd;
          font-size: 14px;
          outline: none;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            0 10px 22px rgba(0, 0, 0, 0.16);
        }

        .settingsTextarea {
          min-height: 126px;
          resize: vertical;
          padding-top: 14px;
        }

        .settingsInput::placeholder {
          color: rgba(214, 223, 241, 0.34);
        }

        .settingsInput:focus {
          border-color: rgba(135, 155, 192, 0.24);
          box-shadow:
            0 0 0 1px rgba(135, 155, 192, 0.1),
            0 12px 24px rgba(0, 0, 0, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.035);
        }

        .toggleRow,
        .toolRow,
        .integrationRow,
        .dangerCard {
          padding: 14px;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
        }

        .toggleCopy,
        .toolAction {
          min-width: 0;
        }

        .toggleTitle,
        .toolTitle,
        .integrationTitle,
        .dangerTitle {
          font-size: 15px;
          font-weight: 900;
          color: #f4f7fd;
        }

        .toggleDesc,
        .toolDesc,
        .integrationDesc,
        .dangerDesc {
          margin-top: 6px;
          font-size: 12px;
          line-height: 1.45;
          color: rgba(196, 208, 228, 0.62);
        }

        .switchBtn {
          min-width: 102px;
          height: 44px;
          padding: 0 12px;
          border: 1px solid rgba(255, 255, 255, 0.075);
          border-radius: 16px;
          background:
            linear-gradient(180deg, rgba(25, 31, 43, 0.96), rgba(12, 17, 27, 0.98));
          color: rgba(242, 246, 252, 0.92);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-weight: 900;
        }

        .switchBtnOn {
          border-color: rgba(125, 156, 206, 0.18);
          background:
            linear-gradient(180deg, rgba(40, 48, 66, 0.96), rgba(18, 24, 35, 0.98));
          color: #ffffff;
        }

        .switchTrack {
          position: relative;
          width: 34px;
          height: 18px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          display: inline-block;
        }

        .switchThumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: #f4f7fd;
          transition: transform 0.18s ease;
        }

        .switchBtnOn .switchThumb {
          transform: translateX(16px);
        }

        .switchLabel {
          min-width: 22px;
        }

        .previewCard {
          padding: 16px;
        }

        .previewTop {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .previewAvatar {
          width: 78px;
          height: 78px;
          border-radius: 999px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.075);
          background:
            radial-gradient(circle at 30% 30%, rgba(123, 138, 172, 0.2), transparent 42%),
            linear-gradient(180deg, rgba(26, 35, 52, 0.96), rgba(14, 20, 31, 0.98));
          display: grid;
          place-items: center;
          font-size: 24px;
          font-weight: 950;
          color: #f8faff;
        }

        .previewIdentity {
          min-width: 0;
        }

        .previewName {
          font-size: 21px;
          font-weight: 950;
          letter-spacing: -0.03em;
          color: #f4f7fd;
          line-height: 1.08;
        }

        .previewHandle {
          margin-top: 6px;
          color: rgba(193, 205, 226, 0.66);
          font-size: 13px;
        }

        .previewBio {
          margin-top: 14px;
          padding: 14px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.028);
          color: rgba(242, 246, 252, 0.92);
          line-height: 1.6;
        }

        .previewMetaGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 12px;
        }

        .previewMetaCard {
          padding: 12px;
        }

        .miniLabel {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(190, 202, 224, 0.58);
        }

        .miniValue {
          margin-top: 7px;
          color: #f4f7fd;
          font-weight: 850;
          line-height: 1.35;
        }

        .breakValue {
          word-break: break-word;
        }

        .quickToolBtn {
          padding: 14px;
          text-align: left;
          cursor: pointer;
        }

        .quickToolTitle {
          display: block;
          font-size: 15px;
          font-weight: 900;
          color: #f4f7fd;
        }

        .quickToolDesc {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          line-height: 1.45;
          color: rgba(196, 208, 228, 0.62);
        }

        .integrationRow {
          align-items: flex-start;
        }

        .pill {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 64px;
          height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(241, 246, 252, 0.9);
          font-size: 12px;
          font-weight: 900;
        }

        .pillGood {
          border-color: rgba(90, 180, 142, 0.18);
          background: rgba(48, 103, 82, 0.16);
        }

        .pillAccent {
          border-color: rgba(111, 146, 214, 0.18);
          background: rgba(38, 55, 90, 0.24);
        }

        .btn {
          height: 46px;
          padding: 0 16px;
          border-radius: 16px;
          font-weight: 900;
          border: 1px solid rgba(255, 255, 255, 0.075);
          cursor: pointer;
          transition:
            transform 0.16s ease,
            border-color 0.16s ease,
            background 0.16s ease;
        }

        .btn:hover:not(:disabled),
        .quickToolBtn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .btn:disabled,
        .quickToolBtn:disabled {
          opacity: 0.62;
          cursor: not-allowed;
        }

        .btnPrimary {
          background:
            linear-gradient(180deg, rgba(56, 66, 90, 0.96), rgba(20, 27, 39, 0.98));
          color: #f6f9ff;
          box-shadow:
            0 12px 26px rgba(0, 0, 0, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .btnSecondary {
          background:
            linear-gradient(180deg, rgba(24, 30, 42, 0.96), rgba(12, 17, 27, 0.98));
          color: rgba(239, 244, 252, 0.92);
        }

        .btnGhost {
          background: rgba(255, 255, 255, 0.03);
          color: rgba(239, 244, 252, 0.92);
        }

        .btnDanger {
          background:
            linear-gradient(180deg, rgba(72, 34, 39, 0.94), rgba(38, 16, 21, 0.98));
          border-color: rgba(204, 101, 101, 0.18);
          color: #fff0f0;
        }

        .btnOn {
          border-color: rgba(111, 146, 214, 0.18);
        }

        button,
        select,
        input,
        textarea {
          font: inherit;
        }

        @media (max-width: 1260px) {
          .settingsLayout {
            grid-template-columns: 1fr;
          }

          .stickyCard {
            position: relative;
            top: 0;
          }
        }

        @media (max-width: 980px) {
          .heroStats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .identityLayout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .settingsShell {
            padding: 14px 12px 22px;
          }

          .heroGlass,
          .settingsCard,
          .notice {
            border-radius: 24px;
          }

          .heroGlass,
          .settingsCard {
            padding: 16px;
          }

          .heroActions {
            width: 100%;
          }

          .heroActions .btn {
            flex: 1 1 100%;
          }

          .heroStats,
          .fieldGrid.two,
          .previewMetaGrid {
            grid-template-columns: 1fr;
          }

          .toggleRow,
          .toolRow,
          .integrationRow,
          .dangerCard {
            flex-direction: column;
            align-items: stretch;
          }

          .toolAction,
          .toolAction :global(button) {
            width: 100%;
          }

          .sectionRight,
          .sectionRight :global(button) {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}