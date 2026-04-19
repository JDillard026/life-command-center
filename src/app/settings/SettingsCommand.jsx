"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import useCurrentAccountIdentity from "@/hooks/useCurrentAccountIdentity";
import styles from "./settings.module.css";
import {
  buildExportPayload,
  buildPrefsPayload,
  buildProfilePayload,
  createEmptyPrefs,
  createEmptyProfile,
  formatSyncTime,
  mapPrefsRow,
  mapProfileFromIdentity,
  mergeImportPayload,
  niceErr,
  safeEmail,
} from "./settings.helpers";
import {
  Field,
  Input,
  QuickActionButton,
  SectionCard,
  SectionPills,
  Select,
  StatTile,
  Textarea,
  ToggleRow,
  ToolRow,
} from "./settings.components";

function cx(...names) {
  return names.filter(Boolean).join(" ");
}

export default function SettingsCommand() {
  const router = useRouter();
  const avatarInputRef = useRef(null);
  const importInputRef = useRef(null);
  const hydratedUserRef = useRef("");

  const identity = useCurrentAccountIdentity();

  const [profile, setProfile] = useState(createEmptyProfile());
  const [prefs, setPrefs] = useState(createEmptyPrefs());
  const [activeSection, setActiveSection] = useState("account");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState("neutral");
  const [lastSynced, setLastSynced] = useState("");
  const [busy, setBusy] = useState({
    profile: false,
    prefs: false,
    avatar: false,
    auth: false,
    tools: false,
    all: false,
    refresh: false,
  });

  const sectionItems = useMemo(
    () => [
      { key: "account", label: "Account" },
      { key: "experience", label: "Experience" },
      { key: "notifications", label: "Notifications" },
      { key: "security", label: "Security" },
      { key: "data", label: "Data & Privacy" },
    ],
    []
  );

  const statusText = useMemo(() => {
    if (identity.loading) return "Loading";
    return identity.userId ? "Signed in" : "Not signed in";
  }, [identity.loading, identity.userId]);

  const notificationCount = useMemo(() => {
    return [prefs.emailAlerts, prefs.pushAlerts, prefs.weeklySummary].filter(Boolean)
      .length;
  }, [prefs.emailAlerts, prefs.pushAlerts, prefs.weeklySummary]);

  const privacyMode = prefs.showBalances ? "Visible" : "Private";

  function setMessage(message, tone = "neutral") {
    setNotice(message);
    setNoticeTone(tone);
  }

  function stampSynced() {
    setLastSynced(formatSyncTime());
  }

  function updateProfileField(key, value) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function updatePrefField(key, value) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  const loadPreferences = useCallback(async (userId) => {
    if (!supabase || !userId) {
      setPrefs(createEmptyPrefs());
      return createEmptyPrefs();
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const nextPrefs = mapPrefsRow(data);
    setPrefs(nextPrefs);
    return nextPrefs;
  }, []);

  useEffect(() => {
    if (identity.loading) return;

    if (!identity.userId) {
      router.replace("/login");
      return;
    }

    if (hydratedUserRef.current !== identity.userId) {
      hydratedUserRef.current = identity.userId;
      setProfile(mapProfileFromIdentity(identity));

      void loadPreferences(identity.userId)
        .then(() => {
          stampSynced();
        })
        .catch((error) => {
          setMessage(niceErr(error), "error");
        });
    }
  }, [identity, loadPreferences, router]);

  async function refreshAll() {
    try {
      setBusy((prev) => ({ ...prev, refresh: true }));
      setMessage("");

      const nextIdentity = await identity.refresh();

      if (!nextIdentity.userId) {
        router.replace("/login");
        return;
      }

      setProfile(mapProfileFromIdentity(nextIdentity));
      await loadPreferences(nextIdentity.userId);
      stampSynced();
      setMessage("Live account data refreshed.", "success");
    } catch (error) {
      setMessage(niceErr(error), "error");
    } finally {
      setBusy((prev) => ({ ...prev, refresh: false }));
    }
  }

  async function persistProfile({ silent = false } = {}) {
    if (!supabase || !identity.userId) {
      if (!silent) setMessage("You must be signed in.", "error");
      return false;
    }

    try {
      setBusy((prev) => ({ ...prev, profile: true }));

      const payload = buildProfilePayload({
        userId: identity.userId,
        userEmail: identity.email,
        profile,
      });

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

      const nextIdentity = await identity.refresh();
      setProfile(mapProfileFromIdentity(nextIdentity));
      stampSynced();

      if (!silent) setMessage("Account profile saved.", "success");
      return true;
    } catch (error) {
      if (!silent) setMessage(niceErr(error), "error");
      return false;
    } finally {
      setBusy((prev) => ({ ...prev, profile: false }));
    }
  }

  async function persistPreferences({ silent = false } = {}) {
    if (!supabase || !identity.userId) {
      if (!silent) setMessage("You must be signed in.", "error");
      return false;
    }

    try {
      setBusy((prev) => ({ ...prev, prefs: true }));

      const payload = buildPrefsPayload({
        userId: identity.userId,
        prefs,
      });

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
        setMessage("Part of the page saved, but something failed.", "warning");
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

    if (!safeEmail(identity.email)) {
      setMessage("No account email found.", "error");
      return;
    }

    try {
      setBusy((prev) => ({ ...prev, auth: true }));
      setMessage("");

      const { error } = await supabase.auth.resetPasswordForEmail(identity.email, {
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

    if (!supabase || !identity.userId) {
      setMessage("You must be signed in first.", "error");
      return;
    }

    try {
      setBusy((prev) => ({ ...prev, avatar: true }));
      setMessage("");

      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `${identity.userId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setProfile((prev) => ({
        ...prev,
        avatarUrl: data?.publicUrl || "",
      }));

      setMessage("Avatar uploaded. Save profile or save all to commit it.", "success");
    } catch (error) {
      setMessage(niceErr(error), "error");
    } finally {
      setBusy((prev) => ({ ...prev, avatar: false }));
      event.target.value = "";
    }
  }

  function removeAvatar() {
    setProfile((prev) => ({ ...prev, avatarUrl: "" }));
    setMessage("Avatar removed from the form. Save profile to commit it.", "warning");
  }

  function exportSettingsJson() {
    try {
      const payload = buildExportPayload({ profile, prefs });
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
      if (!navigator?.clipboard) {
        throw new Error("Clipboard is not available in this browser.");
      }

      setBusy((prev) => ({ ...prev, tools: true }));

      const payload = buildExportPayload({ profile, prefs });
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
      const merged = mergeImportPayload({
        currentProfile: profile,
        currentPrefs: prefs,
        parsed,
      });

      setProfile(merged.profile);
      setPrefs(merged.prefs);
      setMessage("Backup imported into the form. Save all to commit it.", "success");
    } catch {
      setMessage("That JSON file is invalid.", "error");
    } finally {
      setBusy((prev) => ({ ...prev, tools: false }));
      event.target.value = "";
    }
  }

  function renderAccountSection() {
    return (
      <div className={styles.sectionStack}>
        <SectionCard
          title="Account identity"
          subtitle="The real shared identity block the app should trust everywhere."
          right={
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => persistProfile()}
              disabled={busy.profile || busy.all || identity.loading}
            >
              {busy.profile ? "Saving..." : "Save profile"}
            </button>
          }
        >
          <div className={styles.sectionSplit}>
            <aside className={styles.avatarPanel}>
              <div className={styles.avatarWrap}>
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt="Profile avatar"
                    className={styles.avatarImage}
                  />
                ) : (
                  <span className={styles.avatarFallback}>{identity.initials}</span>
                )}
              </div>

              <div className={styles.btnRow}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={triggerAvatarUpload}
                  disabled={busy.avatar}
                >
                  {busy.avatar ? "Uploading..." : "Upload photo"}
                </button>

                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={removeAvatar}
                >
                  Remove photo
                </button>
              </div>
            </aside>

            <div className={styles.formStack}>
              <div className={cx(styles.fieldGrid, styles.fieldGridTwo)}>
                <Field label="Full name">
                  <Input
                    value={profile.fullName}
                    onChange={(e) => updateProfileField("fullName", e.target.value)}
                    placeholder="Jacob Dillard"
                  />
                </Field>

                <Field label="Username" hint="Public handle if you want one.">
                  <Input
                    value={profile.username}
                    onChange={(e) => updateProfileField("username", e.target.value)}
                    placeholder="jacob"
                  />
                </Field>
              </div>

              <Field
                label="Bio"
                hint="Identity copy for account cards and shared profile surfaces."
              >
                <Textarea
                  value={profile.bio}
                  onChange={(e) => updateProfileField("bio", e.target.value)}
                  placeholder="Building the best financial command center possible."
                />
              </Field>

              <div className={cx(styles.fieldGrid, styles.fieldGridTwo)}>
                <Field label="Phone">
                  <Input
                    value={profile.phone}
                    onChange={(e) => updateProfileField("phone", e.target.value)}
                    placeholder="(555) 555-5555"
                  />
                </Field>

                <Field label="Location">
                  <Input
                    value={profile.location}
                    onChange={(e) => updateProfileField("location", e.target.value)}
                    placeholder="Wimauma, FL"
                  />
                </Field>
              </div>

              <Field label="Email address" hint="Pulled from auth and treated as source of truth.">
                <Input value={identity.email || ""} disabled />
              </Field>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Connected accounts"
          subtitle="Bank sync belongs here once Plaid is live."
        >
          <div className={styles.toolStack}>
            <ToolRow
              title="Linked institutions"
              desc="Show each connected bank, last sync, reconnect, disconnect, and sync health here."
              action={<span className={styles.pill}>Soon</span>}
            />
            <ToolRow
              title="Permissions"
              desc="Give users visible control over what account data the app is using."
              action={<span className={styles.pill}>Soon</span>}
            />
            <ToolRow
              title="Sync failures"
              desc="Show broken connections fast instead of making users guess why numbers look wrong."
              action={<span className={styles.pill}>Soon</span>}
            />
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderExperienceSection() {
    return (
      <div className={styles.sectionStack}>
        <SectionCard
          title="Workspace behavior"
          subtitle="Persistent app-level controls that actually belong in settings."
          right={
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => persistPreferences()}
              disabled={busy.prefs || busy.all || identity.loading}
            >
              {busy.prefs ? "Saving..." : "Save preferences"}
            </button>
          }
        >
          <div className={cx(styles.fieldGrid, styles.fieldGridTwo)}>
            <Field label="Currency">
              <Select
                value={prefs.currency}
                onChange={(e) => updatePrefField("currency", e.target.value)}
              >
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="CAD">CAD — Canadian Dollar</option>
              </Select>
            </Field>

            <Field label="Timezone">
              <Input
                value={prefs.timezone}
                onChange={(e) => updatePrefField("timezone", e.target.value)}
                placeholder="America/New_York"
              />
            </Field>
          </div>

          <div className={styles.toolStack}>
            <ToggleRow
              title="Dark mode"
              desc="Keep the premium dark Life Command Center look."
              enabled={prefs.darkMode}
              onToggle={() => updatePrefField("darkMode", !prefs.darkMode)}
            />
            <ToggleRow
              title="Compact UI"
              desc="Denser layout for people who want more information on screen."
              enabled={prefs.compactUI}
              onToggle={() => updatePrefField("compactUI", !prefs.compactUI)}
            />
            <ToggleRow
              title="Show balances"
              desc="Hide money values when users want more privacy."
              enabled={prefs.showBalances}
              onToggle={() => updatePrefField("showBalances", !prefs.showBalances)}
            />
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderNotificationSection() {
    return (
      <div className={styles.sectionStack}>
        <SectionCard
          title="Notifications"
          subtitle="Persistent alerts that shape how the app behaves."
          right={
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => persistPreferences()}
              disabled={busy.prefs || busy.all || identity.loading}
            >
              {busy.prefs ? "Saving..." : "Save preferences"}
            </button>
          }
        >
          <div className={styles.toolStack}>
            <ToggleRow
              title="Email alerts"
              desc="Important finance and account notices by email."
              enabled={prefs.emailAlerts}
              onToggle={() => updatePrefField("emailAlerts", !prefs.emailAlerts)}
            />
            <ToggleRow
              title="Push alerts"
              desc="Future browser or mobile push support."
              enabled={prefs.pushAlerts}
              onToggle={() => updatePrefField("pushAlerts", !prefs.pushAlerts)}
            />
            <ToggleRow
              title="Weekly summary"
              desc="A clean recap of balances, bills, spending, and movement."
              enabled={prefs.weeklySummary}
              onToggle={() => updatePrefField("weeklySummary", !prefs.weeklySummary)}
            />
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderSecuritySection() {
    return (
      <div className={styles.sectionStack}>
        <SectionCard title="Security" subtitle="Normal account security tools without clutter.">
          <div className={styles.toolStack}>
            <ToolRow
              title="Password reset"
              desc={`Send a reset link to ${identity.email || "your account email"}.`}
              action={
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={sendPasswordReset}
                  disabled={busy.auth || identity.loading}
                >
                  {busy.auth ? "Working..." : "Reset password"}
                </button>
              }
            />

            <ToolRow
              title="Two-factor readiness"
              desc="UI-level toggle for now so the account center is ready for real MFA wiring later."
              action={
                <button
                  type="button"
                  className={prefs.twoFactorReady ? styles.primaryBtn : styles.secondaryBtn}
                  onClick={() =>
                    updatePrefField("twoFactorReady", !prefs.twoFactorReady)
                  }
                >
                  {prefs.twoFactorReady ? "Enabled" : "Disabled"}
                </button>
              }
            />

            <ToolRow
              title="Current session"
              desc="Log out this device cleanly."
              action={
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={logout}
                  disabled={busy.auth || identity.loading}
                >
                  Logout
                </button>
              }
            />

            <ToolRow
              title="Device list"
              desc="Add recent devices and log-out-all-devices here when you wire session management."
              action={<span className={styles.pill}>Soon</span>}
            />
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderDataSection() {
    return (
      <div className={styles.sectionStack}>
        <SectionCard
          title="Data & transfer"
          subtitle="Useful account tools instead of dead weight."
        >
          <div className={styles.toolStack}>
            <ToolRow
              title="Export settings JSON"
              desc="Download a backup of account profile and preferences."
              action={
                <button
                  type="button"
                  className={styles.secondaryBtn}
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
                  className={styles.secondaryBtn}
                  onClick={triggerImportJson}
                  disabled={busy.tools}
                >
                  Import
                </button>
              }
            />

            <ToolRow
              title="Copy current config"
              desc="Copy the current account-center payload to the clipboard."
              action={
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={copyConfigJson}
                  disabled={busy.tools}
                >
                  {busy.tools ? "Copying..." : "Copy JSON"}
                </button>
              }
            />
          </div>
        </SectionCard>

        <SectionCard title="Danger zone" subtitle="Low-noise destructive actions.">
          <div className={styles.toolStack}>
            <ToolRow
              title="Logout this device"
              desc="End the current session right now."
              action={
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={logout}
                  disabled={busy.auth || identity.loading}
                >
                  Logout
                </button>
              }
            />

            <ToolRow
              title="Delete account"
              desc="Wire this after you define the real deletion flow and data-retention rules."
              action={<span className={styles.pill}>Later</span>}
            />
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderActiveSection() {
    switch (activeSection) {
      case "experience":
        return renderExperienceSection();
      case "notifications":
        return renderNotificationSection();
      case "security":
        return renderSecuritySection();
      case "data":
        return renderDataSection();
      case "account":
      default:
        return renderAccountSection();
    }
  }

  const noticeClass =
    noticeTone === "success"
      ? styles.noticeSuccess
      : noticeTone === "error"
      ? styles.noticeError
      : noticeTone === "warning"
      ? styles.noticeWarning
      : "";

  return (
    <main className={styles.shell}>
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

      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.heroIdentity}>
              <div className={styles.avatarWrap}>
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt="Profile avatar"
                    className={styles.avatarImage}
                  />
                ) : (
                  <span className={styles.avatarFallback}>{identity.initials}</span>
                )}
              </div>

              <div className={styles.heroCopy}>
                <div className={styles.eyebrow}>Account Center</div>
                <h1 className={styles.title}>{identity.displayName}</h1>
                <p className={styles.subtitle}>
                  Real account identity, app preferences, privacy, notifications,
                  security, and data controls — without the junk-drawer feeling.
                </p>
              </div>
            </div>

            <div className={styles.heroActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={saveAll}
                disabled={
                  identity.loading ||
                  busy.all ||
                  busy.profile ||
                  busy.prefs
                }
              >
                {busy.all ? "Saving..." : "Save all"}
              </button>

              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={refreshAll}
                disabled={busy.refresh || identity.loading}
              >
                {busy.refresh ? "Refreshing..." : "Refresh"}
              </button>

              <button
                type="button"
                className={styles.ghostBtn}
                onClick={logout}
                disabled={busy.auth || identity.loading}
              >
                {busy.auth ? "Working..." : "Logout"}
              </button>
            </div>
          </div>

          <div className={styles.statsGrid}>
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
        </header>

        {notice ? (
          <div className={cx(styles.notice, noticeClass)}>
            <strong>Notice</strong>
            <span>{notice}</span>
          </div>
        ) : null}

        <div className={styles.contentGrid}>
          <div className={styles.main}>
            <SectionPills
              items={sectionItems}
              active={activeSection}
              onChange={setActiveSection}
            />
            {renderActiveSection()}
          </div>

          <aside className={styles.sideStack}>
            <SectionCard
              title="Live preview"
              subtitle="What the shared account surfaces should reflect."
              className={styles.stickyCard}
            >
              <div className={styles.previewCard}>
                <div className={styles.previewTop}>
                  <div className={styles.avatarWrap}>
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt="Preview avatar"
                        className={styles.avatarImage}
                      />
                    ) : (
                      <span className={styles.avatarFallback}>{identity.initials}</span>
                    )}
                  </div>

                  <div className={styles.previewIdentity}>
                    <div className={styles.previewName}>
                      {profile.fullName || identity.displayName}
                    </div>
                    <div className={styles.previewHandle}>
                      {profile.username
                        ? `@${profile.username.replace(/^@/, "")}`
                        : identity.email || "@account"}
                    </div>
                  </div>
                </div>

                <div className={styles.previewBio}>
                  {profile.bio || "Add a short account bio so the profile feels complete."}
                </div>

                <div className={styles.metaGrid}>
                  <div className={styles.metaCard}>
                    <div className={styles.metaLabel}>Email</div>
                    <div className={styles.metaValue}>{identity.email || "—"}</div>
                  </div>

                  <div className={styles.metaCard}>
                    <div className={styles.metaLabel}>Location</div>
                    <div className={styles.metaValue}>{profile.location || "—"}</div>
                  </div>

                  <div className={styles.metaCard}>
                    <div className={styles.metaLabel}>Privacy</div>
                    <div className={styles.metaValue}>{privacyMode}</div>
                  </div>

                  <div className={styles.metaCard}>
                    <div className={styles.metaLabel}>Theme</div>
                    <div className={styles.metaValue}>
                      {prefs.darkMode ? "Dark glass" : "Light"}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Quick actions"
              subtitle="Stuff people actually reach for."
            >
              <div className={styles.quickActions}>
                <QuickActionButton
                  title="Save everything"
                  desc="Commit profile and preferences together."
                  onClick={saveAll}
                  disabled={
                    identity.loading ||
                    busy.all ||
                    busy.profile ||
                    busy.prefs
                  }
                />
                <QuickActionButton
                  title="Reload live data"
                  desc="Pull the latest profile and preferences from Supabase."
                  onClick={refreshAll}
                  disabled={busy.refresh || identity.loading}
                />
                <QuickActionButton
                  title="Reset password"
                  desc={`Send reset email to ${identity.email || "your account"}.`}
                  onClick={sendPasswordReset}
                  disabled={busy.auth || identity.loading}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Plan & billing"
              subtitle="Keep subscription controls here, not in the main nav."
            >
              <div className={styles.toolStack}>
                <ToolRow
                  title="Current workspace"
                  desc="Premium finance command center."
                  action={<span className={cx(styles.pill, styles.pillGood)}>Live</span>}
                />
                <ToolRow
                  title="Billing portal"
                  desc="Wire plan, invoices, card updates, and subscription state here."
                  action={<span className={styles.pill}>Soon</span>}
                />
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>
    </main>
  );
}