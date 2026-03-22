"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

function niceErr(e) {
  return e?.message || "Something went wrong.";
}

function safeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function initialsFromName(name, email) {
  const base = String(name || "").trim();
  if (base) {
    const parts = base.split(/\s+/).filter(Boolean);
    return (
      parts
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("") || "U"
    );
  }
  return String(email || "U").slice(0, 1).toUpperCase();
}

function SectionCard({ title, subtitle, right, children }) {
  return (
    <section className="settingsCard">
      <div className="sectionHead">
        <div>
          <div className="sectionTitle">{title}</div>
          {subtitle ? <div className="sectionSubtitle">{subtitle}</div> : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>

      <div style={{ height: 16 }} />
      {children}
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <div>
        <div className="fieldLabel">{label}</div>
        {hint ? <div className="fieldHint">{hint}</div> : null}
      </div>
      {children}
    </label>
  );
}

function Input(props) {
  return <input {...props} className={`settingsInput ${props.className || ""}`} />;
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`settingsInput ${props.className || ""}`}
      style={{
        minHeight: 110,
        resize: "vertical",
        paddingTop: 14,
        ...(props.style || {}),
      }}
    />
  );
}

function ToggleRow({ title, desc, enabled, onToggle }) {
  return (
    <div className="settingsRow">
      <div>
        <div className="rowTitle">{title}</div>
        <div className="rowDesc">{desc}</div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className={enabled ? "btnNeutralActive" : "btnNeutral"}
        style={{ minWidth: 78 }}
      >
        {enabled ? "On" : "Off"}
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [msg, setMsg] = useState("");

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
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setMsg("");

      if (!supabase) {
        setMsg("Supabase is not configured.");
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

      const [{ data: profileRow, error: profileError }, { data: prefsRow, error: prefsError }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle(),
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
    } catch (e) {
      setMsg(niceErr(e));
    } finally {
      setLoading(false);
    }
  }

  const statusPill = useMemo(() => {
    if (loading) return { text: "Loading…", ok: true };
    if (!userEmail) return { text: "Not signed in", ok: false };
    return { text: "Signed in", ok: true };
  }, [loading, userEmail]);

  const initials = useMemo(
    () => initialsFromName(profile.fullName, userEmail),
    [profile.fullName, userEmail]
  );

  function updateProfileField(key, value) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function updatePrefField(key, value) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  async function logout() {
    try {
      setLoading(true);
      setMsg("");
      await supabase?.auth.signOut();
      router.replace("/login");
    } catch (e) {
      setMsg(niceErr(e));
    } finally {
      setLoading(false);
    }
  }

  function onPickAvatar() {
    fileInputRef.current?.click();
  }

  async function onAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMsg("That file is not an image.");
      return;
    }

    if (!supabase || !userId) {
      setMsg("You must be signed in first.");
      return;
    }

    try {
      setSavingProfile(true);
      setMsg("");

      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setProfile((prev) => ({
        ...prev,
        avatarUrl: data?.publicUrl || "",
      }));

      setMsg("Profile picture uploaded. Hit Save profile.");
    } catch (e) {
      setMsg(niceErr(e));
    } finally {
      setSavingProfile(false);
    }
  }

  function removeAvatar() {
    setProfile((prev) => ({ ...prev, avatarUrl: "" }));
  }

  async function saveProfile() {
    if (!supabase || !userId) {
      setMsg("You must be signed in.");
      return;
    }

    try {
      setSavingProfile(true);
      setMsg("");

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

      setMsg("Profile saved.");
    } catch (e) {
      setMsg(niceErr(e));
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePreferences() {
    if (!supabase || !userId) {
      setMsg("You must be signed in.");
      return;
    }

    try {
      setSavingPrefs(true);
      setMsg("");

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

      setMsg("Preferences saved.");
    } catch (e) {
      setMsg(niceErr(e));
    } finally {
      setSavingPrefs(false);
    }
  }

  async function sendPasswordReset() {
    if (!supabase) {
      setMsg("Supabase is not configured.");
      return;
    }

    if (!safeEmail(userEmail)) {
      setMsg("No account email found.");
      return;
    }

    try {
      setSavingProfile(true);
      setMsg("");

      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setMsg("Password reset email sent.");
    } catch (e) {
      setMsg(niceErr(e));
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 1220 }}>
      <header style={{ marginBottom: 18 }}>
        <div className="topLabel">Settings</div>

        <div className="pageHead">
          <div>
            <h1 className="pageTitle">Account Settings</h1>
            <div className="pageSub">
              Profile • Security • Notifications • Preferences • Integrations
            </div>
          </div>

          <span
            className="statusPill"
            style={{
              border: statusPill.ok
                ? "1px solid rgba(120,170,155,0.16)"
                : "1px solid rgba(180,90,90,0.18)",
              background: statusPill.ok
                ? "rgba(120,170,155,0.08)"
                : "rgba(180,90,90,0.08)",
            }}
          >
            Status: <b>{statusPill.text}</b>
          </span>
        </div>
      </header>

      {msg ? (
        <div className="noticeCard" style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 900 }}>Notice</div>
          <div className="sectionSubtitle" style={{ marginTop: 6 }}>
            {msg}
          </div>
        </div>
      ) : null}

      <div className="settingsGrid">
        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard
            title="Profile"
            subtitle="Give the account a real identity. Name, username, bio, phone, location, and profile picture."
            right={
              <button
                className="btnPrimaryDark"
                type="button"
                onClick={saveProfile}
                disabled={loading || savingProfile}
              >
                {savingProfile ? "Saving..." : "Save profile"}
              </button>
            }
          >
            <div className="profileTop">
              <div className="avatarPanel">
                <div className="avatarWrap">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt="Profile avatar"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    initials
                  )}
                </div>

                <div style={{ height: 12 }} />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onAvatarChange}
                  style={{ display: "none" }}
                />

                <button
                  className="btnPrimaryDark"
                  type="button"
                  onClick={onPickAvatar}
                  style={{ width: "100%" }}
                >
                  Upload photo
                </button>

                <div style={{ height: 8 }} />

                <button
                  className="btnNeutral"
                  type="button"
                  onClick={removeAvatar}
                  style={{ width: "100%" }}
                >
                  Remove photo
                </button>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                <div className="twoCol">
                  <Field label="Full name">
                    <Input
                      value={profile.fullName}
                      onChange={(e) => updateProfileField("fullName", e.target.value)}
                      placeholder="Jacob Dillard"
                    />
                  </Field>

                  <Field label="Username" hint="Unique handle for the account.">
                    <Input
                      value={profile.username}
                      onChange={(e) => updateProfileField("username", e.target.value)}
                      placeholder="jacob"
                    />
                  </Field>
                </div>

                <Field label="Bio" hint="Small profile summary for the account card.">
                  <Textarea
                    value={profile.bio}
                    onChange={(e) => updateProfileField("bio", e.target.value)}
                    placeholder="Building a financial command center for real life."
                  />
                </Field>

                <div className="twoCol">
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

                <Field label="Email address" hint="Pulled from auth.">
                  <Input value={loading ? "Loading..." : userEmail || ""} disabled />
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Security" subtitle="The normal account stuff people expect.">
            <div style={{ display: "grid", gap: 12 }}>
              <div className="settingsRow">
                <div>
                  <div className="rowTitle">Password</div>
                  <div className="rowDesc">Send yourself a password reset email.</div>
                </div>

                <button
                  className="btnNeutral"
                  type="button"
                  onClick={sendPasswordReset}
                  disabled={savingProfile || loading}
                >
                  Reset password
                </button>
              </div>

              <div className="settingsRow">
                <div>
                  <div className="rowTitle">Two-factor authentication</div>
                  <div className="rowDesc">UI toggle for now. Real auth flow can be wired later.</div>
                </div>

                <button
                  className={prefs.twoFactorReady ? "btnNeutralActive" : "btnNeutral"}
                  type="button"
                  onClick={() => updatePrefField("twoFactorReady", !prefs.twoFactorReady)}
                >
                  {prefs.twoFactorReady ? "Enabled" : "Disabled"}
                </button>
              </div>

              <div className="settingsRow">
                <div>
                  <div className="rowTitle">Current session</div>
                  <div className="rowDesc">Sign out of this device.</div>
                </div>

                <button className="btnPrimaryDark" type="button" onClick={logout} disabled={loading}>
                  Logout
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Notifications"
            subtitle="The stuff users expect: alerts, summaries, reminders."
            right={
              <button
                className="btnPrimaryDark"
                type="button"
                onClick={savePreferences}
                disabled={savingPrefs || loading}
              >
                {savingPrefs ? "Saving..." : "Save preferences"}
              </button>
            }
          >
            <div style={{ display: "grid", gap: 12 }}>
              <ToggleRow
                title="Email alerts"
                desc="Important account and finance notices."
                enabled={prefs.emailAlerts}
                onToggle={() => updatePrefField("emailAlerts", !prefs.emailAlerts)}
              />

              <ToggleRow
                title="Push alerts"
                desc="Future mobile or browser push notifications."
                enabled={prefs.pushAlerts}
                onToggle={() => updatePrefField("pushAlerts", !prefs.pushAlerts)}
              />

              <ToggleRow
                title="Weekly summary"
                desc="Weekly recap of balances, spending, and bills."
                enabled={prefs.weeklySummary}
                onToggle={() => updatePrefField("weeklySummary", !prefs.weeklySummary)}
              />
            </div>
          </SectionCard>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <SectionCard title="Account card" subtitle="Preview how the account identity feels in the app.">
            <div className="accountPreview">
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div className="accountMiniAvatar">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt="Profile avatar preview"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    initials
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div className="accountName">
                    {profile.fullName || "Your Name"}
                  </div>

                  <div className="sectionSubtitle" style={{ marginTop: 6, fontSize: 13 }}>
                    {profile.username ? `@${profile.username.replace(/^@/, "")}` : "@username"}
                  </div>
                </div>
              </div>

              <div style={{ height: 14 }} />

              <div className="softPanel">
                <div className="fieldHint" style={{ fontSize: 12 }}>Bio</div>
                <div style={{ marginTop: 8, lineHeight: 1.65, color: "rgba(242,246,252,0.92)" }}>
                  {profile.bio || "Add a short profile description so the account feels real."}
                </div>
              </div>

              <div style={{ height: 12 }} />

              <div className="miniGrid">
                <div className="miniCard">
                  <div className="fieldHint" style={{ fontSize: 12 }}>Email</div>
                  <div style={{ marginTop: 6, fontWeight: 800, wordBreak: "break-word" }}>
                    {userEmail || "—"}
                  </div>
                </div>

                <div className="miniCard">
                  <div className="fieldHint" style={{ fontSize: 12 }}>Location</div>
                  <div style={{ marginTop: 6, fontWeight: 800 }}>
                    {profile.location || "—"}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Preferences" subtitle="Make the account behave more like a real user profile.">
            <div style={{ display: "grid", gap: 12 }}>
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

              <ToggleRow
                title="Dark mode"
                desc="Keep the darker LCC look."
                enabled={prefs.darkMode}
                onToggle={() => updatePrefField("darkMode", !prefs.darkMode)}
              />

              <ToggleRow
                title="Compact UI"
                desc="Tighter layout density."
                enabled={prefs.compactUI}
                onToggle={() => updatePrefField("compactUI", !prefs.compactUI)}
              />

              <ToggleRow
                title="Show balances"
                desc="Hide or show money values later for privacy."
                enabled={prefs.showBalances}
                onToggle={() => updatePrefField("showBalances", !prefs.showBalances)}
              />
            </div>
          </SectionCard>

          <SectionCard title="Integrations" subtitle="Stuff users expect under account settings even if some is not wired yet.">
            <div style={{ display: "grid", gap: 12 }}>
              <div className="settingsRow">
                <div>
                  <div className="rowTitle">Plaid</div>
                  <div className="rowDesc">Bank connection for balances and transactions.</div>
                </div>
                <span className="statusPill">Coming soon</span>
              </div>

              <div className="settingsRow">
                <div>
                  <div className="rowTitle">Google</div>
                  <div className="rowDesc">Sign-in and sync hooks later.</div>
                </div>
                <button className="btnNeutral" type="button" disabled>
                  Not wired
                </button>
              </div>

              <div className="settingsRow">
                <div>
                  <div className="rowTitle">Data export</div>
                  <div className="rowDesc">Export account data and settings later.</div>
                </div>
                <button className="btnNeutral" type="button" disabled>
                  Soon
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <style jsx>{`
        .settingsGrid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 18px;
          align-items: start;
        }

        .topLabel {
          font-size: 12px;
          margin-bottom: 8px;
          color: rgba(198, 208, 228, 0.72);
        }

        .pageHead {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .pageTitle {
          margin: 0;
          font-size: clamp(28px, 4vw, 44px);
          line-height: 1.05;
          letter-spacing: -0.04em;
          color: #f3f6fc;
        }

        .pageSub {
          margin-top: 10px;
          color: rgba(198, 208, 228, 0.78);
        }

        .settingsCard {
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background:
            radial-gradient(circle at top right, rgba(52, 84, 140, 0.08), transparent 20%),
            linear-gradient(180deg, rgba(12, 17, 28, 0.90), rgba(8, 12, 21, 0.96));
          padding: 18px;
          box-shadow:
            0 24px 60px rgba(0, 0, 0, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .sectionHead {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .sectionTitle {
          font-size: 24px;
          font-weight: 950;
          line-height: 1.1;
          letter-spacing: -0.03em;
          color: #f5f7fb;
        }

        .sectionSubtitle {
          margin-top: 8px;
          font-size: 13px;
          line-height: 1.5;
          color: rgba(198, 208, 228, 0.72);
        }

        .fieldLabel {
          font-size: 13px;
          font-weight: 850;
          color: rgba(232, 238, 247, 0.92);
        }

        .fieldHint {
          margin-top: 4px;
          font-size: 12px;
          line-height: 1.4;
          color: rgba(198, 208, 228, 0.62);
        }

        .profileTop {
          display: grid;
          grid-template-columns: 160px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .twoCol {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .avatarPanel {
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background:
            linear-gradient(180deg, rgba(16, 22, 34, 0.92), rgba(10, 14, 24, 0.96));
          padding: 16px;
        }

        .avatarWrap {
          width: 128px;
          height: 128px;
          border-radius: 999px;
          margin: 0 auto;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(circle at 30% 30%, rgba(110, 126, 160, 0.22), transparent 42%),
            linear-gradient(180deg, rgba(28, 38, 56, 0.96), rgba(15, 21, 33, 0.96));
          display: grid;
          place-items: center;
          font-size: 34px;
          font-weight: 950;
          color: #f7faff;
          box-shadow:
            0 16px 34px rgba(0, 0, 0, 0.26),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .accountPreview {
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          padding: 16px;
          background:
            radial-gradient(circle at top right, rgba(58, 82, 120, 0.14), transparent 24%),
            linear-gradient(180deg, rgba(16, 22, 34, 0.92), rgba(9, 14, 24, 0.96));
          box-shadow:
            0 18px 40px rgba(0, 0, 0, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .accountMiniAvatar {
          width: 72px;
          height: 72px;
          border-radius: 999px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 30% 30%, rgba(110, 126, 160, 0.20), transparent 42%),
            linear-gradient(180deg, rgba(28, 38, 56, 0.96), rgba(15, 21, 33, 0.96));
          font-size: 22px;
          font-weight: 950;
          color: #f7faff;
        }

        .accountName {
          font-size: 20px;
          font-weight: 950;
          line-height: 1.1;
          letter-spacing: -0.03em;
          color: #f4f7fd;
        }

        .softPanel,
        .miniCard,
        .settingsRow,
        .noticeCard {
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(255, 255, 255, 0.03);
          padding: 14px;
        }

        .miniGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .rowTitle {
          font-weight: 900;
          font-size: 15px;
          color: #f3f6fc;
        }

        .rowDesc {
          margin-top: 6px;
          font-size: 12px;
          line-height: 1.45;
          color: rgba(198, 208, 228, 0.62);
        }

        .settingsInput {
          width: 100%;
          min-height: 54px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(26, 33, 48, 0.92), rgba(13, 19, 31, 0.98));
          color: #f4f7fd;
          padding: 0 16px;
          outline: none;
          font-size: 14px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .settingsInput::placeholder {
          color: rgba(214, 224, 242, 0.34);
        }

        .settingsInput:focus {
          border-color: rgba(130, 150, 185, 0.24);
          box-shadow:
            0 0 0 1px rgba(130, 150, 185, 0.10),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .btnPrimaryDark {
          height: 46px;
          padding: 0 16px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(42, 48, 62, 0.96), rgba(19, 24, 34, 0.98));
          color: #f5f7fb;
          font-weight: 900;
          box-shadow:
            0 12px 24px rgba(0, 0, 0, 0.20),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .btnNeutral {
          height: 46px;
          padding: 0 16px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(24, 30, 42, 0.96), rgba(12, 17, 27, 0.98));
          color: rgba(239, 244, 252, 0.92);
          font-weight: 850;
        }

        .btnNeutralActive {
          height: 46px;
          padding: 0 16px;
          border-radius: 16px;
          border: 1px solid rgba(150, 160, 180, 0.14);
          background:
            linear-gradient(180deg, rgba(52, 58, 72, 0.96), rgba(24, 28, 38, 0.98));
          color: #ffffff;
          font-weight: 900;
        }

        .statusPill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 14px;
          border-radius: 999px;
          color: rgba(240, 245, 252, 0.92);
          backdrop-filter: blur(8px);
        }

        button {
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 1020px) {
          .settingsGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .profileTop {
            grid-template-columns: 1fr;
          }

          .twoCol,
          .miniGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}