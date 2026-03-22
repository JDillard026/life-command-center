"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Shield,
  Lock,
  Users,
  RefreshCw,
  Mail,
  User2,
  ArrowUpCircle,
  ArrowDownCircle,
  Search,
  UserX,
  UserCheck,
  ScrollText,
  Eye,
  Activity,
  Clock3,
  Download,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  History,
  StickyNote,
  Save,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

/* ---------------- helpers ---------------- */

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString();
}

function actionLabel(action) {
  switch (action) {
    case "role_promoted_to_admin":
      return "Promoted to Admin";
    case "role_changed_to_user":
      return "Changed to User";
    case "user_disabled":
      return "User Disabled";
    case "user_reenabled":
      return "User Re-enabled";
    case "support_note_updated":
      return "Support Note Updated";
    default:
      return action || "Unknown Action";
  }
}

function actionSentence(entry) {
  const actor = entry.actor_email || "Unknown admin";
  const target = entry.target_email || "Unknown user";

  switch (entry.action) {
    case "role_promoted_to_admin":
      return `${actor} promoted ${target} to admin`;
    case "role_changed_to_user":
      return `${actor} changed ${target} to regular user`;
    case "user_disabled":
      return `${actor} disabled ${target}`;
    case "user_reenabled":
      return `${actor} re-enabled ${target}`;
    case "support_note_updated":
      return `${actor} updated the support note for ${target}`;
    default:
      return `${actor} updated ${target}`;
  }
}

function actionTone(action) {
  switch (action) {
    case "role_promoted_to_admin":
      return {
        border: "rgba(245, 158, 11, 0.24)",
        bg: "rgba(245, 158, 11, 0.10)",
        text: "#fcd34d",
        dot: "#f59e0b",
      };
    case "role_changed_to_user":
      return {
        border: "rgba(148, 163, 184, 0.18)",
        bg: "rgba(255,255,255,0.04)",
        text: "#dbe7ff",
        dot: "#cbd5e1",
      };
    case "user_disabled":
      return {
        border: "rgba(248, 113, 113, 0.24)",
        bg: "rgba(248, 113, 113, 0.10)",
        text: "#fca5a5",
        dot: "#ef4444",
      };
    case "user_reenabled":
      return {
        border: "rgba(34, 211, 238, 0.24)",
        bg: "rgba(34, 211, 238, 0.10)",
        text: "#67e8f9",
        dot: "#22d3ee",
      };
    case "support_note_updated":
      return {
        border: "rgba(167, 139, 250, 0.24)",
        bg: "rgba(167, 139, 250, 0.10)",
        text: "#c4b5fd",
        dot: "#8b5cf6",
      };
    default:
      return {
        border: "rgba(255,255,255,0.12)",
        bg: "rgba(255,255,255,0.04)",
        text: "#e5eefc",
        dot: "#94a3b8",
      };
  }
}

function detailsText(details = {}, action) {
  if (action === "role_promoted_to_admin" || action === "role_changed_to_user") {
    return `Role: ${details.old_role ?? "unknown"} → ${details.new_role ?? "unknown"}`;
  }

  if (action === "user_disabled" || action === "user_reenabled") {
    return `Disabled: ${String(details.old_disabled)} → ${String(details.new_disabled)}`;
  }

  if (action === "support_note_updated") {
    return `Had note before: ${String(details.had_previous_note)} • Has note now: ${String(details.has_note_now)} • Note length: ${details.note_length ?? 0}`;
  }

  return "";
}

function reasonText(details = {}) {
  const value = typeof details?.reason === "string" ? details.reason.trim() : "";
  return value || "";
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const str = String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
}

/* ---------------- reusable ui ---------------- */

function SectionCard({ title, subtitle, icon: Icon, children, right }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {Icon ? (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
              <Icon className="h-5 w-5 text-white/80" />
            </div>
          ) : null}

          <div>
            <div className="text-lg font-black text-white">{title}</div>
            {subtitle ? (
              <div className="text-sm text-white/55">{subtitle}</div>
            ) : null}
          </div>
        </div>

        {right || null}
      </div>

      {children}
    </section>
  );
}

function StatCard({ title, value, icon: Icon, tone = "default" }) {
  const toneMap = {
    default: {
      border: "border-white/10",
      bg: "bg-white/[0.04]",
      iconWrap: "border-white/10 bg-white/[0.03]",
      icon: "text-white/80",
    },
    amber: {
      border: "border-amber-400/20",
      bg: "bg-amber-400/10",
      iconWrap: "border-amber-400/20 bg-amber-400/10",
      icon: "text-amber-300",
    },
    red: {
      border: "border-red-400/20",
      bg: "bg-red-400/10",
      iconWrap: "border-red-400/20 bg-red-400/10",
      icon: "text-red-300",
    },
    cyan: {
      border: "border-cyan-400/20",
      bg: "bg-cyan-400/10",
      iconWrap: "border-cyan-400/20 bg-cyan-400/10",
      icon: "text-cyan-300",
    },
    purple: {
      border: "border-purple-400/20",
      bg: "bg-purple-400/10",
      iconWrap: "border-purple-400/20 bg-purple-400/10",
      icon: "text-purple-300",
    },
  };

  const t = toneMap[tone] || toneMap.default;

  return (
    <div className={`rounded-[24px] border ${t.border} ${t.bg} p-5`}>
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border ${t.iconWrap}`}>
        <Icon className={`h-5 w-5 ${t.icon}`} />
      </div>
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">{title}</div>
      <div className="mt-2 text-3xl font-black text-white">{value}</div>
    </div>
  );
}

function TimelineEntry({ entry }) {
  const tone = actionTone(entry.action);
  const extra = detailsText(entry.details, entry.action);
  const reason = reasonText(entry.details);

  return (
    <div className="relative">
      <div
        className="absolute left-[-1px] top-6 h-3.5 w-3.5 rounded-full border-2 border-[#08111f]"
        style={{ backgroundColor: tone.dot }}
      />

      <div
        className="rounded-[24px] border bg-[linear-gradient(180deg,rgba(11,17,31,0.92),rgba(6,10,20,0.97))] p-4 md:p-5"
        style={{ borderColor: tone.border }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]"
                style={{
                  borderColor: tone.border,
                  background: tone.bg,
                  color: tone.text,
                }}
              >
                {actionLabel(entry.action)}
              </div>

              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/60">
                {fmtDate(entry.created_at)}
              </div>
            </div>

            <div className="mt-3 text-sm font-semibold leading-6 text-white/90">
              {actionSentence(entry)}
            </div>

            {extra ? (
              <div className="mt-2 text-xs text-white/55">{extra}</div>
            ) : null}

            {reason ? (
              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-3">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-300/90">
                  <ScrollText className="h-3.5 w-3.5" />
                  Reason
                </div>
                <div className="mt-2 text-sm leading-6 text-amber-100/90">{reason}</div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/55">
            {entry.actor_email || "Unknown admin"}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserActivityModal({
  open,
  onClose,
  profile,
  userAuditLog,
  auditLoading,
  noteValue,
  onNoteChange,
  onSaveNote,
  noteSaving,
}) {
  const [tab, setTab] = useState("all");

  useEffect(() => {
    if (open) setTab("all");
  }, [open, profile?.id]);

  const roleHistory = useMemo(() => {
    return userAuditLog.filter(
      (entry) =>
        entry.action === "role_promoted_to_admin" ||
        entry.action === "role_changed_to_user"
    );
  }, [userAuditLog]);

  const statusHistory = useMemo(() => {
    return userAuditLog.filter(
      (entry) =>
        entry.action === "user_disabled" ||
        entry.action === "user_reenabled"
    );
  }, [userAuditLog]);

  const noteHistory = useMemo(() => {
    return userAuditLog.filter((entry) => entry.action === "support_note_updated");
  }, [userAuditLog]);

  const visibleLog = useMemo(() => {
    if (tab === "role") return roleHistory;
    if (tab === "status") return statusHistory;
    if (tab === "notes") return noteHistory;
    return userAuditLog;
  }, [tab, userAuditLog, roleHistory, statusHistory, noteHistory]);

  if (!open || !profile) return null;

  const promotions = roleHistory.filter((x) => x.action === "role_promoted_to_admin").length;
  const demotions = roleHistory.filter((x) => x.action === "role_changed_to_user").length;
  const disables = statusHistory.filter((x) => x.action === "user_disabled").length;
  const reenables = statusHistory.filter((x) => x.action === "user_reenabled").length;
  const noteUpdates = noteHistory.length;

  return (
    <div className="fixed inset-0 z-[121] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(7,12,24,0.98),rgba(4,8,18,0.99))] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
        <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative z-10 flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5 md:px-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
              <Activity className="h-6 w-6 text-cyan-300" />
            </div>

            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300/80">
                User Activity
              </div>
              <div className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">
                {profile.full_name || profile.username || profile.email || "User Detail"}
              </div>
              <div className="mt-2 text-sm text-white/60">
                Role history, status history, and internal support notes.
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/80 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto px-5 py-5 md:px-6">
          <section className="grid gap-4 md:grid-cols-5">
            <StatCard title="Current Role" value={profile.role || "user"} icon={Shield} tone="amber" />
            <StatCard
              title="Status"
              value={profile.is_disabled ? "Disabled" : "Active"}
              icon={profile.is_disabled ? UserX : CheckCircle2}
              tone={profile.is_disabled ? "red" : "cyan"}
            />
            <StatCard title="Promotions" value={promotions} icon={ArrowUpCircle} tone="amber" />
            <StatCard title="Disables" value={disables} icon={UserX} tone="red" />
            <StatCard title="Note Updates" value={noteUpdates} icon={StickyNote} tone="purple" />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 md:p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-400/10">
                  <StickyNote className="h-4 w-4 text-purple-300" />
                </div>

                <div>
                  <div className="text-lg font-black text-white">Support Note</div>
                  <div className="text-sm text-white/55">
                    Internal admin-only notes for support and account context.
                  </div>
                </div>
              </div>

              <textarea
                value={noteValue}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="Example: User had trouble logging in, reset access, asked how to use Bills page..."
                className="min-h-[180px] w-full rounded-[22px] border border-white/10 bg-[#0b1220] px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/35 focus:border-white/20"
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-white/50">
                  Last updated: {fmtDate(profile.support_note_updated_at)}
                </div>

                <button
                  onClick={onSaveNote}
                  disabled={noteSaving}
                  className="inline-flex items-center gap-2 rounded-2xl border border-purple-400/20 bg-purple-400/10 px-4 py-2 text-sm font-semibold text-purple-300 transition hover:bg-purple-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {noteSaving ? "Saving..." : "Save Note"}
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 md:p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                  <Clock3 className="h-4 w-4 text-white/75" />
                </div>

                <div>
                  <div className="text-lg font-black text-white">User Timeline</div>
                  <div className="text-sm text-white/55">
                    Filter the activity stream for this user.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", label: "All" },
                  { key: "role", label: "Role" },
                  { key: "status", label: "Status" },
                  { key: "notes", label: "Notes" },
                ].map((item) => {
                  const active = tab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setTab(item.key)}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? "border border-white/10 bg-white/[0.08] text-white"
                          : "border border-transparent bg-transparent text-white/60 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-3 text-sm text-white/65">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  Demotions: <span className="font-semibold text-white">{demotions}</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  Re-enables: <span className="font-semibold text-white">{reenables}</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  Email: <span className="font-semibold text-white">{profile.email || "No email"}</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  Joined: <span className="font-semibold text-white">{fmtDate(profile.created_at)}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 md:p-5">
            {auditLoading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/65">
                Loading user activity...
              </div>
            ) : null}

            {!auditLoading && visibleLog.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/65">
                No activity found for this tab yet.
              </div>
            ) : null}

            {!auditLoading && visibleLog.length > 0 ? (
              <div className="relative pl-8">
                <div className="absolute left-[13px] top-0 bottom-0 w-px bg-white/10" />
                <div className="grid gap-4">
                  {visibleLog.map((entry) => (
                    <TimelineEntry key={entry.id} entry={entry} />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actingId, setActingId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [reasonDrafts, setReasonDrafts] = useState({});
  const [supportNoteDrafts, setSupportNoteDrafts] = useState({});
  const [noteSavingId, setNoteSavingId] = useState("");

  const [auditLog, setAuditLog] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  const [timelineSearch, setTimelineSearch] = useState("");

  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showUserActivity, setShowUserActivity] = useState(false);

  async function loadProfiles() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUserId(user?.id ?? "");

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, username, role, is_disabled, disabled_at, created_at, support_note, support_note_updated_at, support_note_updated_by"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message || "Failed to load users.");
      setProfiles([]);
      setLoading(false);
      return [];
    }

    setProfiles(data ?? []);
    setLoading(false);
    return data ?? [];
  }

  async function loadAuditLog() {
    setAuditLoading(true);
    setAuditError("");

    const { data, error } = await supabase
      .from("admin_audit_log")
      .select(
        "id, actor_user_id, actor_email, target_user_id, target_email, action, details, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setAuditError(error.message || "Failed to load audit log.");
      setAuditLog([]);
      setAuditLoading(false);
      return [];
    }

    setAuditLog(data ?? []);
    setAuditLoading(false);
    return data ?? [];
  }

  async function refreshAll() {
    const [profilesData] = await Promise.all([loadProfiles(), loadAuditLog()]);
    return profilesData;
  }

  function getReason(profileId) {
    return (reasonDrafts[profileId] || "").trim();
  }

  function setReason(profileId, value) {
    setReasonDrafts((prev) => ({
      ...prev,
      [profileId]: value,
    }));
  }

  function clearReason(profileId) {
    setReasonDrafts((prev) => {
      const next = { ...prev };
      delete next[profileId];
      return next;
    });
  }

  function getSupportNote(profileId, fallback = "") {
    return supportNoteDrafts[profileId] ?? fallback ?? "";
  }

  function setSupportNote(profileId, value) {
    setSupportNoteDrafts((prev) => ({
      ...prev,
      [profileId]: value,
    }));
  }

  async function changeRole(profileId, newRole) {
    setActingId(profileId);
    setError("");
    setNotice("");

    const { error } = await supabase.rpc("set_user_role", {
      target_user_id: profileId,
      new_role: newRole,
      reason: getReason(profileId) || null,
    });

    if (error) {
      setError(error.message || "Failed to update role.");
      setActingId("");
      return;
    }

    clearReason(profileId);
    setNotice(`User role updated to ${newRole}.`);
    const nextProfiles = await refreshAll();
    const updated = nextProfiles.find((p) => p.id === profileId);
    if (updated && selectedProfile?.id === profileId) {
      setSelectedProfile(updated);
    }
    setActingId("");
  }

  async function changeDisabled(profileId, disableUser) {
    setActingId(profileId);
    setError("");
    setNotice("");

    const { error } = await supabase.rpc("set_user_disabled", {
      target_user_id: profileId,
      disable_user: disableUser,
      reason: getReason(profileId) || null,
    });

    if (error) {
      setError(error.message || "Failed to update disabled status.");
      setActingId("");
      return;
    }

    clearReason(profileId);
    setNotice(disableUser ? "User disabled." : "User re-enabled.");
    const nextProfiles = await refreshAll();
    const updated = nextProfiles.find((p) => p.id === profileId);
    if (updated && selectedProfile?.id === profileId) {
      setSelectedProfile(updated);
    }
    setActingId("");
  }

  async function saveSupportNote(profileId) {
    setNoteSavingId(profileId);
    setError("");
    setNotice("");

    const currentValue =
      getSupportNote(
        profileId,
        profiles.find((p) => p.id === profileId)?.support_note || ""
      ) || "";

    const { error } = await supabase.rpc("set_user_support_note", {
      target_user_id: profileId,
      new_note: currentValue || null,
    });

    if (error) {
      setError(error.message || "Failed to save support note.");
      setNoteSavingId("");
      return;
    }

    setNotice(currentValue.trim() ? "Support note saved." : "Support note cleared.");
    const nextProfiles = await refreshAll();
    const updated = nextProfiles.find((p) => p.id === profileId);

    if (updated) {
      setSupportNote(profileId, updated.support_note || "");
      if (selectedProfile?.id === profileId) {
        setSelectedProfile(updated);
      }
    }

    setNoteSavingId("");
  }

  async function openUserActivity(profile) {
    setSelectedProfile(profile);
    setShowUserActivity(true);
    setSupportNote(profile.id, profile.support_note || "");

    if (!auditLog.length) {
      await loadAuditLog();
    }
  }

  function exportAuditJson() {
    downloadFile(
      `admin-audit-log-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(auditLog, null, 2),
      "application/json"
    );
    setNotice("Audit log exported as JSON.");
  }

  function exportProfilesCsv() {
    const headers = [
      "id",
      "email",
      "full_name",
      "username",
      "role",
      "is_disabled",
      "disabled_at",
      "created_at",
      "support_note_updated_at",
    ];

    const lines = [
      headers.join(","),
      ...profiles.map((profile) =>
        [
          csvEscape(profile.id),
          csvEscape(profile.email),
          csvEscape(profile.full_name),
          csvEscape(profile.username),
          csvEscape(profile.role),
          csvEscape(profile.is_disabled),
          csvEscape(profile.disabled_at),
          csvEscape(profile.created_at),
          csvEscape(profile.support_note_updated_at),
        ].join(",")
      ),
    ];

    downloadFile(
      `profiles-${new Date().toISOString().slice(0, 10)}.csv`,
      lines.join("\n"),
      "text/csv;charset=utf-8"
    );
    setNotice("Profiles exported as CSV.");
  }

  async function copyDisabledEmails() {
    const emails = profiles
      .filter((p) => p.is_disabled && p.email)
      .map((p) => p.email)
      .join("\n");

    if (!emails) {
      setNotice("No disabled user emails to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(emails);
      setNotice("Disabled user emails copied.");
    } catch {
      setError("Failed to copy emails.");
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  const stats = useMemo(() => {
    const total = profiles.length;
    const admins = profiles.filter((p) => p.role === "admin").length;
    const users = profiles.filter((p) => p.role !== "admin").length;
    const disabled = profiles.filter((p) => p.is_disabled).length;
    const usersWithNotes = profiles.filter((p) => (p.support_note || "").trim()).length;
    const recentSignups7d = profiles.filter((p) => {
      if (!p.created_at) return false;
      return Date.now() - new Date(p.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000;
    }).length;

    return { total, admins, users, disabled, recentSignups7d, usersWithNotes };
  }, [profiles]);

  const actionSummary = useMemo(() => {
    return {
      promotions: auditLog.filter((x) => x.action === "role_promoted_to_admin").length,
      demotions: auditLog.filter((x) => x.action === "role_changed_to_user").length,
      disables: auditLog.filter((x) => x.action === "user_disabled").length,
      reenables: auditLog.filter((x) => x.action === "user_reenabled").length,
      noteUpdates: auditLog.filter((x) => x.action === "support_note_updated").length,
      recent24h: auditLog.filter((x) => {
        if (!x.created_at) return false;
        return Date.now() - new Date(x.created_at).getTime() <= 24 * 60 * 60 * 1000;
      }).length,
    };
  }, [auditLog]);

  const filteredProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();

    return [...profiles]
      .filter((profile) => {
        if (roleFilter === "admin" && profile.role !== "admin") return false;
        if (roleFilter === "user" && profile.role !== "user") return false;
        if (roleFilter === "disabled" && !profile.is_disabled) return false;
        if (roleFilter === "active" && profile.is_disabled) return false;

        if (!term) return true;

        const haystack = [
          profile.email,
          profile.full_name,
          profile.username,
          profile.role,
          profile.is_disabled ? "disabled" : "active",
          (profile.support_note || "").trim() ? "has note" : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(term);
      })
      .sort((a, b) => {
        if (a.is_disabled && !b.is_disabled) return -1;
        if (!a.is_disabled && b.is_disabled) return 1;
        if (a.role === "admin" && b.role !== "admin") return -1;
        if (a.role !== "admin" && b.role === "admin") return 1;
        return 0;
      });
  }, [profiles, search, roleFilter]);

  const filteredAuditLog = useMemo(() => {
    const term = timelineSearch.trim().toLowerCase();

    return auditLog.filter((entry) => {
      if (auditActionFilter !== "all" && entry.action !== auditActionFilter) {
        return false;
      }

      if (!term) return true;

      const reason = reasonText(entry.details);
      const haystack = [
        entry.actor_email,
        entry.target_email,
        entry.action,
        actionLabel(entry.action),
        reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [auditLog, auditActionFilter, timelineSearch]);

  const recentAuditPreview = useMemo(() => auditLog.slice(0, 8), [auditLog]);
  const recentSignups = useMemo(() => profiles.slice(0, 8), [profiles]);
  const disabledProfiles = useMemo(() => profiles.filter((p) => p.is_disabled), [profiles]);

  const healthChecks = useMemo(() => {
    const missingEmails = profiles.filter((p) => !p.email).length;
    const duplicateEmailCount = (() => {
      const counts = {};
      for (const p of profiles) {
        const email = (p.email || "").toLowerCase().trim();
        if (!email) continue;
        counts[email] = (counts[email] || 0) + 1;
      }
      return Object.values(counts).filter((n) => n > 1).length;
    })();

    return [
      {
        label: "At least one admin exists",
        ok: stats.admins > 0,
        detail: stats.admins > 0 ? `${stats.admins} admin account(s)` : "No admins found",
      },
      {
        label: "Profiles missing email",
        ok: missingEmails === 0,
        detail: missingEmails === 0 ? "No missing emails" : `${missingEmails} profile(s) missing email`,
      },
      {
        label: "Duplicate profile emails",
        ok: duplicateEmailCount === 0,
        detail: duplicateEmailCount === 0 ? "No duplicates found" : `${duplicateEmailCount} duplicate email group(s)`,
      },
      {
        label: "Disabled account load",
        ok: stats.disabled < Math.max(5, Math.ceil(stats.total * 0.5)),
        detail: `${stats.disabled} disabled account(s)`,
      },
      {
        label: "Recent audit activity",
        ok: actionSummary.recent24h > 0,
        detail:
          actionSummary.recent24h > 0
            ? `${actionSummary.recent24h} admin action(s) in last 24h`
            : "No admin actions in last 24h",
      },
    ];
  }, [profiles, stats.admins, stats.disabled, stats.total, actionSummary.recent24h]);

  const selectedUserAuditLog = useMemo(() => {
    if (!selectedProfile) return [];

    return auditLog.filter((entry) => {
      if (entry.target_user_id && entry.target_user_id === selectedProfile.id) return true;
      if (entry.target_email && entry.target_email === selectedProfile.email) return true;
      return false;
    });
  }, [auditLog, selectedProfile]);

  return (
    <>
      <div className="space-y-6 px-4 py-4 md:px-6">
        <section className="relative overflow-hidden rounded-[28px] border border-amber-400/20 bg-[linear-gradient(180deg,rgba(20,16,8,0.92),rgba(10,10,14,0.96))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.42)]">
          <div className="absolute -right-12 top-0 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-yellow-300/5 blur-3xl" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10">
                <Shield className="h-7 w-7 text-amber-300" />
              </div>

              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-300/80">
                  Restricted Area
                </div>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">
                  Admin Center
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-white/65">
                  Clean control center for users, audit history, system health, and support notes.
                </p>
              </div>
            </div>

            <button
              onClick={refreshAll}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {error ? (
            <div className="relative z-10 mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="relative z-10 mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
              {notice}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-6">
          <StatCard title="Total Profiles" value={stats.total} icon={Users} />
          <StatCard title="Admins" value={stats.admins} icon={Shield} tone="amber" />
          <StatCard title="Regular Users" value={stats.users} icon={Lock} />
          <StatCard title="Disabled" value={stats.disabled} icon={UserX} tone="red" />
          <StatCard title="Recent Signups" value={stats.recentSignups7d} icon={Clock3} tone="cyan" />
          <StatCard title="Users With Notes" value={stats.usersWithNotes} icon={StickyNote} tone="purple" />
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-3">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "users", label: "Users", icon: Users },
              { key: "audit", label: "Audit", icon: History },
              { key: "system", label: "System", icon: Wrench },
            ].map((item) => {
              const active = activeTab === item.key;
              const Icon = item.icon;

              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? "border border-white/10 bg-white/[0.08] text-white"
                      : "border border-transparent bg-transparent text-white/60 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        {activeTab === "users" && (
          <SectionCard
            title="User Management"
            subtitle="Search users, open user activity, control access, and track who has support notes."
            icon={Users}
            right={
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search email, name, username..."
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20 sm:w-[280px]"
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-11 rounded-2xl border border-white/10 bg-[#0b1220] px-4 text-sm text-white outline-none focus:border-white/20"
                >
                  <option value="all">All users</option>
                  <option value="admin">Admins only</option>
                  <option value="user">Users only</option>
                  <option value="active">Active only</option>
                  <option value="disabled">Disabled only</option>
                </select>
              </div>
            }
          >
            <div className="mb-4 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/55">
              {loading ? "Loading..." : `${filteredProfiles.length} shown • ${profiles.length} total`}
            </div>

            {!loading && filteredProfiles.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/65">
                No users match this search.
              </div>
            ) : null}

            <div className="grid gap-3">
              {filteredProfiles.map((profile) => {
                const isSelf = profile.id === currentUserId;
                const isBusy = actingId === profile.id;
                const isAdmin = profile.role === "admin";
                const isDisabled = !!profile.is_disabled;
                const hasNote = !!(profile.support_note || "").trim();

                return (
                  <div
                    key={profile.id}
                    className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,15,28,0.86),rgba(6,10,20,0.94))] p-4"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                              <User2 className="h-4 w-4 text-white/75" />
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-sm font-black text-white">
                                {profile.full_name ||
                                  profile.username ||
                                  profile.email ||
                                  "Unnamed user"}
                                {isSelf ? " (You)" : ""}
                              </div>

                              <div className="mt-1 flex items-center gap-2 text-xs text-white/55">
                                <Mail className="h-3.5 w-3.5" />
                                <span className="truncate">{profile.email || "No email"}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/65">
                              Joined {fmtDate(profile.created_at)}
                            </div>

                            <div
                              className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${
                                isAdmin
                                  ? "border border-amber-400/25 bg-amber-400/10 text-amber-300"
                                  : "border border-white/10 bg-white/[0.03] text-white/75"
                              }`}
                            >
                              {profile.role || "user"}
                            </div>

                            {isDisabled && (
                              <div className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-red-300">
                                Disabled
                              </div>
                            )}

                            {hasNote && (
                              <div className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-purple-300">
                                Has Note
                              </div>
                            )}

                            {isDisabled && profile.disabled_at && (
                              <div className="rounded-full border border-red-400/15 bg-red-400/5 px-3 py-1 text-xs text-red-200/80">
                                Disabled {fmtDate(profile.disabled_at)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => openUserActivity(profile)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/15"
                          >
                            <Eye className="h-4 w-4" />
                            View Activity
                          </button>

                          {!isAdmin && (
                            <button
                              onClick={() => changeRole(profile.id, "admin")}
                              disabled={isBusy || isDisabled}
                              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <ArrowUpCircle className="h-4 w-4" />
                              {isBusy ? "Working..." : "Make Admin"}
                            </button>
                          )}

                          {isAdmin && !isSelf && (
                            <button
                              onClick={() => changeRole(profile.id, "user")}
                              disabled={isBusy}
                              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <ArrowDownCircle className="h-4 w-4" />
                              {isBusy ? "Working..." : "Make User"}
                            </button>
                          )}

                          {!isSelf && !isDisabled && (
                            <button
                              onClick={() => changeDisabled(profile.id, true)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <UserX className="h-4 w-4" />
                              {isBusy ? "Working..." : "Disable User"}
                            </button>
                          )}

                          {!isSelf && isDisabled && (
                            <button
                              onClick={() => changeDisabled(profile.id, false)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <UserCheck className="h-4 w-4" />
                              {isBusy ? "Working..." : "Re-enable User"}
                            </button>
                          )}

                          {isSelf && (
                            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-200">
                              Your account cannot demote or disable itself here
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3">
                        <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
                          <ScrollText className="h-3.5 w-3.5" />
                          Reason for next admin action
                        </div>

                        <input
                          value={reasonDrafts[profile.id] ?? ""}
                          onChange={(e) => setReason(profile.id, e.target.value)}
                          placeholder="Optional reason for promote, demote, disable, or re-enable..."
                          className="h-11 w-full rounded-2xl border border-white/10 bg-[#0b1220] px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {activeTab === "audit" && (
          <SectionCard
            title="Audit Timeline"
            subtitle="Search and filter admin actions, including note updates."
            icon={History}
            right={
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                  placeholder="Search actor, target, or reason..."
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20 sm:w-[280px]"
                />

                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="h-11 rounded-2xl border border-white/10 bg-[#0b1220] px-4 text-sm text-white outline-none focus:border-white/20"
                >
                  <option value="all">All actions</option>
                  <option value="role_promoted_to_admin">Promoted to Admin</option>
                  <option value="role_changed_to_user">Changed to User</option>
                  <option value="user_disabled">Disabled Users</option>
                  <option value="user_reenabled">Re-enabled Users</option>
                  <option value="support_note_updated">Support Note Updates</option>
                </select>
              </div>
            }
          >
            <div className="mb-4 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/55">
              {auditLoading ? "Loading..." : `${filteredAuditLog.length} timeline item${filteredAuditLog.length === 1 ? "" : "s"} shown`}
            </div>

            {auditError ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                {auditError}
              </div>
            ) : null}

            {!auditError && auditLoading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/65">
                Loading audit timeline...
              </div>
            ) : null}

            {!auditError && !auditLoading && filteredAuditLog.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/65">
                No audit actions match this search or filter.
              </div>
            ) : null}

            {!auditError && !auditLoading && filteredAuditLog.length > 0 ? (
              <div className="relative pl-8">
                <div className="absolute left-[13px] top-0 bottom-0 w-px bg-white/10" />
                <div className="grid gap-4">
                  {filteredAuditLog.map((entry) => (
                    <TimelineEntry key={entry.id} entry={entry} />
                  ))}
                </div>
              </div>
            ) : null}
          </SectionCard>
        )}

        {activeTab === "system" && (
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <SectionCard
                title="System Health"
                subtitle="Fast checks that help catch admin-side problems."
                icon={Activity}
              >
                <div className="grid gap-3">
                  {healthChecks.map((item) => (
                    <div
                      key={item.label}
                      className={`rounded-2xl border px-4 py-4 ${
                        item.ok
                          ? "border-cyan-400/20 bg-cyan-400/10"
                          : "border-red-400/20 bg-red-400/10"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {item.ok ? (
                            <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-300" />
                          )}
                        </div>

                        <div>
                          <div className="text-sm font-black text-white">{item.label}</div>
                          <div className="mt-1 text-sm text-white/65">{item.detail}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Quick Admin Tools"
                subtitle="Useful actions that help you manage the app faster."
                icon={Wrench}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    onClick={exportAuditJson}
                    className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/15"
                  >
                    <Download className="h-4 w-4" />
                    Export Audit JSON
                  </button>

                  <button
                    onClick={exportProfilesCsv}
                    className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/15"
                  >
                    <Download className="h-4 w-4" />
                    Export Profiles CSV
                  </button>

                  <button
                    onClick={copyDisabledEmails}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-400/15"
                  >
                    <Mail className="h-4 w-4" />
                    Copy Disabled Emails
                  </button>

                  <button
                    onClick={refreshAll}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh Everything
                  </button>
                </div>
              </SectionCard>
            </div>

            <div className="space-y-4">
              <SectionCard
                title="Recent Signups"
                subtitle="Newest profiles created in the system."
                icon={Users}
              >
                {recentSignups.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/65">
                    No profiles found.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {recentSignups.map((profile) => (
                      <div
                        key={profile.id}
                        className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,15,28,0.86),rgba(6,10,20,0.94))] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-white">
                              {profile.full_name || profile.username || profile.email || "Unnamed user"}
                            </div>
                            <div className="mt-1 truncate text-xs text-white/55">
                              {profile.email || "No email"}
                            </div>
                          </div>

                          <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/60">
                            {fmtDate(profile.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Disabled Accounts"
                subtitle="Quick view of who is currently blocked."
                icon={UserX}
              >
                {disabledProfiles.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/65">
                    No disabled users.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {disabledProfiles.map((profile) => (
                      <div
                        key={profile.id}
                        className="rounded-[22px] border border-red-400/20 bg-red-400/10 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-white">
                              {profile.full_name || profile.username || profile.email || "Unnamed user"}
                            </div>
                            <div className="mt-1 truncate text-xs text-red-100/80">
                              {profile.email || "No email"}
                            </div>
                          </div>

                          <div className="shrink-0 rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs text-red-100/80">
                            {fmtDate(profile.disabled_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Recent Admin Activity"
                subtitle="Latest audit items without leaving the page."
                icon={History}
              >
                {auditLoading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/65">
                    Loading recent activity...
                  </div>
                ) : recentAuditPreview.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/65">
                    No admin actions logged yet.
                  </div>
                ) : (
                  <div className="relative pl-8">
                    <div className="absolute left-[13px] top-0 bottom-0 w-px bg-white/10" />
                    <div className="grid gap-4">
                      {recentAuditPreview.map((entry) => (
                        <TimelineEntry key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        )}
      </div>

      <UserActivityModal
        open={showUserActivity}
        onClose={() => setShowUserActivity(false)}
        profile={selectedProfile}
        userAuditLog={selectedUserAuditLog}
        auditLoading={auditLoading}
        noteValue={
          selectedProfile
            ? getSupportNote(selectedProfile.id, selectedProfile.support_note || "")
            : ""
        }
        onNoteChange={(value) => {
          if (selectedProfile) setSupportNote(selectedProfile.id, value);
        }}
        onSaveNote={() => {
          if (selectedProfile) saveSupportNote(selectedProfile.id);
        }}
        noteSaving={noteSavingId === selectedProfile?.id}
      />
    </>
  );
}