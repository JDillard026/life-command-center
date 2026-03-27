"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Download,
  RefreshCcw,
  Shield,
  ShieldAlert,
  StickyNote,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminActionToast from "./AdminActionToast";
import AdminAuditTimeline from "./AdminAuditTimeline";
import AdminConfirmDialog from "./AdminConfirmDialog";
import AdminEmptyState from "./AdminEmptyState";
import AdminNoteDrawer from "./AdminNoteDrawer";
import AdminSearchFilters from "./AdminSearchFilters";
import AdminShell from "./AdminShell";
import AdminStatCard from "./AdminStatCard";
import AdminTable from "./AdminTable";

const ROLE_OPTIONS = ["all", "admin", "support", "moderator", "user"];
const STATUS_OPTIONS = ["all", "active", "pending", "suspended"];
const NOTE_OPTIONS = ["all", "with_note", "no_note"];

function normalizeRole(value) {
  return String(value || "user").toLowerCase();
}

function normalizeStatus(value) {
  return String(value || "active").toLowerCase();
}

function formatTimestamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatAgo(value) {
  if (!value) return "—";

  const ms = new Date(value).getTime() - Date.now();
  const absMinutes = Math.round(Math.abs(ms) / 60000);

  if (!Number.isFinite(absMinutes)) return "—";
  if (absMinutes < 1) return "just now";
  if (absMinutes < 60) return `${absMinutes}m ago`;

  const hours = Math.round(absMinutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function prettifyAuditAction(action, details = {}) {
  if (!action) return "did something";

  if (action === "role_changed") {
    return `changed role to ${details?.next_role || "unknown"}`;
  }

  if (action === "status_changed") {
    return `changed status to ${details?.next_status || "unknown"}`;
  }

  if (action === "support_note_updated") return "updated support note";
  if (action === "support_note_cleared") return "cleared support note";
  if (action === "user_suspended") return "suspended account";
  if (action === "user_reactivated") return "reactivated account";
  if (action === "role_promoted_to_admin") return "promoted role to admin";
  if (action === "role_changed_to_user") return "changed role to user";

  return action.replaceAll("_", " ");
}

function auditDetailsText(action, details = {}) {
  if (action === "role_changed") {
    return `From ${details?.previous_role || "unknown"} to ${details?.next_role || "unknown"}`;
  }

  if (action === "status_changed") {
    return `From ${details?.previous_status || "unknown"} to ${details?.next_status || "unknown"}`;
  }

  if (action === "support_note_updated") {
    return `Note length: ${details?.note_length ?? 0} characters`;
  }

  if (action === "support_note_cleared") {
    return "Internal note removed";
  }

  return "";
}

function mapProfileToRow(profile) {
  const role = normalizeRole(profile?.role);
  const normalizedStatus = normalizeStatus(profile?.status);
  const derivedStatus = profile?.is_disabled ? "suspended" : normalizedStatus;

  const name =
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    profile?.email?.split("@")?.[0] ||
    "Unknown user";

  return {
    id: profile.id,
    name,
    email: profile.email || "—",
    role,
    status: derivedStatus,
    username: profile.username ? `@${profile.username}` : "—",
    phone: profile.phone || "—",
    bio: profile.bio || "",
    note: profile.support_note || "",
    hasNote: Boolean(profile.support_note?.trim()),
    lastUpdated: profile.updated_at || profile.created_at || null,
    createdAt: profile.created_at || null,
    createdAtLabel: formatTimestamp(profile.created_at),
    updatedAtLabel: formatTimestamp(profile.updated_at || profile.created_at),
  };
}

function mapAuditToRow(entry) {
  return {
    id: entry.id,
    actor: entry.actor_email || "Admin",
    action: prettifyAuditAction(entry.action, entry.details || {}),
    rawAction: entry.action || "",
    target: entry.target_email || "Unknown user",
    createdAt: entry.created_at || null,
    details: entry.details || {},
    detailsText: auditDetailsText(entry.action, entry.details || {}),
  };
}

function StatusPill({ value }) {
  const tone =
    value === "active"
      ? "green"
      : value === "pending"
      ? "amber"
      : value === "suspended"
      ? "red"
      : "neutral";

  return <span className={`pill ${tone}`}>{value}</span>;
}

function RolePill({ value }) {
  return <span className="rolePill">{value}</span>;
}

function QuickButton({ icon: Icon, children, onClick, disabled = false }) {
  return (
    <button type="button" className="quickBtn" onClick={onClick} disabled={disabled}>
      {Icon ? <Icon size={16} /> : null}
      <span>{children}</span>
    </button>
  );
}

function QueueCard({ title, users, emptyText, onManage, onToggleStatus }) {
  return (
    <div className="queueCard">
      <div className="queueHead">
        <h3>{title}</h3>
        <span>{users.length}</span>
      </div>

      {users.length ? (
        <div className="queueList">
          {users.map((user) => (
            <div key={user.id} className="queueRow">
              <div className="queueInfo">
                <div className="queueName">{user.name}</div>
                <div className="queueMeta">
                  {user.email} · {user.role} · {user.status}
                </div>
              </div>

              <div className="queueActions">
                <button type="button" className="queueBtn" onClick={() => onManage(user)}>
                  Manage
                </button>
                <button
                  type="button"
                  className={`queueBtn ${user.status === "suspended" ? "neutral" : "danger"}`}
                  onClick={() => onToggleStatus(user)}
                >
                  {user.status === "suspended" ? "Reactivate" : "Suspend"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="queueEmpty">{emptyText}</div>
      )}

      <style jsx>{`
        .queueCard {
          border-radius: 22px;
          border: 1px solid rgba(147, 175, 255, 0.14);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            rgba(8, 12, 20, 0.72);
          padding: 16px;
          display: grid;
          gap: 14px;
        }

        .queueHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .queueHead h3 {
          margin: 0;
          color: #f5f8ff;
          font-size: 1rem;
        }

        .queueHead span {
          min-width: 28px;
          height: 28px;
          padding: 0 8px;
          border-radius: 999px;
          display: inline-grid;
          place-items: center;
          color: #dbe7ff;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.07);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .queueList {
          display: grid;
          gap: 10px;
        }

        .queueRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.05);
        }

        .queueInfo {
          min-width: 0;
        }

        .queueName {
          color: #f5f8ff;
          font-weight: 700;
        }

        .queueMeta {
          margin-top: 4px;
          color: rgba(214, 226, 255, 0.62);
          font-size: 0.88rem;
          line-height: 1.45;
          word-break: break-word;
        }

        .queueActions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .queueBtn {
          min-height: 34px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(147, 175, 255, 0.14);
          background: rgba(18, 28, 48, 0.9);
          color: #f5f8ff;
          font-weight: 800;
          cursor: pointer;
        }

        .queueBtn.danger {
          border-color: rgba(255, 128, 128, 0.16);
          background: rgba(83, 24, 24, 0.82);
        }

        .queueBtn.neutral {
          border-color: rgba(147, 175, 255, 0.16);
          background: rgba(31, 43, 71, 0.9);
        }

        .queueEmpty {
          color: rgba(214, 226, 255, 0.6);
          line-height: 1.55;
        }

        @media (max-width: 680px) {
          .queueRow {
            grid-template-columns: 1fr;
          }

          .queueActions {
            justify-content: stretch;
          }

          .queueBtn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default function AdminPage() {
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [noteFilter, setNoteFilter] = useState("all");

  const [toast, setToast] = useState({
    open: false,
    message: "",
    tone: "success",
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleDraft, setRoleDraft] = useState("user");
  const [statusDraft, setStatusDraft] = useState("active");
  const [noteDraft, setNoteDraft] = useState("");
  const [savingDrawer, setSavingDrawer] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  function showToast(message, tone = "success") {
    setToast({
      open: true,
      message,
      tone,
    });
  }

  const loadAdminData = useCallback(async (showRefreshToast = false) => {
    if (!supabase) {
      setError("Supabase client is not configured.");
      setLoading(false);
      return;
    }

    try {
      setBusy(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("No authenticated user found.");

      setCurrentAdmin(user);

      const [profilesRes, auditRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, email, full_name, username, bio, phone, role, status, support_note, is_disabled, created_at, updated_at"
          )
          .order("updated_at", { ascending: false }),
        supabase
          .from("admin_audit_log")
          .select(
            "id, actor_user_id, actor_email, target_user_id, target_email, action, details, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(150),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (auditRes.error) throw auditRes.error;

      setUsers((profilesRes.data || []).map(mapProfileToRow));
      setActivity((auditRes.data || []).map(mapAuditToRow));
      setLastRefresh(new Date().toISOString());

      if (showRefreshToast) {
        showToast("Admin view refreshed", "info");
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to load admin data.");
      showToast(err?.message || "Failed to load admin data.", "error");
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData(false);
  }, [loadAdminData]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((user) => user.status === "active").length;
    const pending = users.filter((user) => user.status === "pending").length;
    const suspended = users.filter((user) => user.status === "suspended").length;
    const withNotes = users.filter((user) => user.note?.trim()).length;

    return { total, active, pending, suspended, withNotes };
  }, [users]);

  const roleCounts = useMemo(() => {
    return {
      admin: users.filter((user) => user.role === "admin").length,
      support: users.filter((user) => user.role === "support").length,
      moderator: users.filter((user) => user.role === "moderator").length,
      user: users.filter((user) => user.role === "user").length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const hasNote = Boolean(user.note?.trim());

      const matchSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query) ||
        user.status.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.phone.toLowerCase().includes(query);

      const matchRole = roleFilter === "all" || user.role === roleFilter;
      const matchStatus = statusFilter === "all" || user.status === statusFilter;
      const matchNote =
        noteFilter === "all" ||
        (noteFilter === "with_note" && hasNote) ||
        (noteFilter === "no_note" && !hasNote);

      return matchSearch && matchRole && matchStatus && matchNote;
    });
  }, [users, search, roleFilter, statusFilter, noteFilter]);

  const filteredActivity = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activity.filter((entry) => {
      if (!query) return true;

      return [entry.actor, entry.action, entry.target, entry.detailsText]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [activity, search]);

  const pendingUsers = useMemo(
    () => users.filter((user) => user.status === "pending").slice(0, 8),
    [users]
  );

  const suspendedUsers = useMemo(
    () => users.filter((user) => user.status === "suspended").slice(0, 8),
    [users]
  );

  const usersWithNotes = useMemo(
    () => users.filter((user) => user.note?.trim()).slice(0, 8),
    [users]
  );

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users", count: filteredUsers.length },
    { id: "activity", label: "Activity", count: filteredActivity.length },
    { id: "tools", label: "Tools" },
  ];

  const hasDrawerChanges = useMemo(() => {
    if (!selectedUser) return false;

    return (
      normalizeRole(roleDraft) !== normalizeRole(selectedUser.role) ||
      normalizeStatus(statusDraft) !== normalizeStatus(selectedUser.status) ||
      noteDraft.trim() !== (selectedUser.note || "").trim()
    );
  }, [selectedUser, roleDraft, statusDraft, noteDraft]);

  const userColumns = [
    {
      key: "name",
      header: "User",
      render: (_, row) => (
        <div className="userCell">
          <div className="avatar">{row.name.charAt(0).toUpperCase()}</div>
          <div>
            <div className="primaryText">{row.name}</div>
            <div className="secondaryText">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (value) => <RolePill value={value} />,
    },
    {
      key: "status",
      header: "Status",
      render: (value) => <StatusPill value={value} />,
    },
    {
      key: "hasNote",
      header: "Note",
      render: (value) => (
        <span className={value ? "noteYes" : "noteNo"}>
          {value ? "Has note" : "No note"}
        </span>
      ),
    },
    {
      key: "lastUpdated",
      header: "Updated",
      render: (value) => (
        <div>
          <div className="primaryText">{formatAgo(value)}</div>
          <div className="secondaryText">{formatTimestamp(value)}</div>
        </div>
      ),
    },
  ];

  const activityColumns = [
    {
      key: "action",
      header: "Event",
      render: (_, row) => (
        <div className="activityEvent">
          <div className="primaryText">
            {row.actor} {row.action}
          </div>
          {row.detailsText ? (
            <div className="secondaryText">{row.detailsText}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: "target",
      header: "Target",
      render: (value) => <span className="secondaryText strongLine">{value}</span>,
    },
    {
      key: "createdAt",
      header: "Time",
      render: (value) => (
        <div>
          <div className="primaryText">{formatAgo(value)}</div>
          <div className="secondaryText">{formatTimestamp(value)}</div>
        </div>
      ),
    },
  ];

  function openManageDrawer(user) {
    setSelectedUser(user);
    setRoleDraft(normalizeRole(user.role));
    setStatusDraft(normalizeStatus(user.status));
    setNoteDraft(user.note || "");
    setDrawerOpen(true);
  }

  function closeManageDrawer() {
    setDrawerOpen(false);
    setSelectedUser(null);
    setRoleDraft("user");
    setStatusDraft("active");
    setNoteDraft("");
    setSavingDrawer(false);
  }

  function clearDrawerNote() {
    setNoteDraft("");
  }

  async function saveUserChanges() {
    if (!selectedUser || !currentAdmin || !supabase) return;

    const trimmedNote = noteDraft.trim();
    const nextRole = normalizeRole(roleDraft);
    const nextStatus = normalizeStatus(statusDraft);
    const nextDisabled = nextStatus === "suspended";

    const previousRole = normalizeRole(selectedUser.role);
    const previousStatus = normalizeStatus(selectedUser.status);
    const previousNote = (selectedUser.note || "").trim();

    const noteChanged = trimmedNote !== previousNote;
    const roleChanged = nextRole !== previousRole;
    const statusChanged = nextStatus !== previousStatus;

    const isEditingSelf = currentAdmin.id === selectedUser.id;

    if (isEditingSelf && nextRole !== "admin") {
      showToast("You cannot remove your own admin role.", "error");
      return;
    }

    if (isEditingSelf && nextStatus === "suspended") {
      showToast("You cannot suspend your own account.", "error");
      return;
    }

    if (!roleChanged && !statusChanged && !noteChanged) {
      showToast("No changes to save", "info");
      return;
    }

    try {
      setSavingDrawer(true);

      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          role: nextRole,
          status: nextStatus,
          is_disabled: nextDisabled,
          support_note: trimmedNote || null,
          updated_at: now,
        })
        .eq("id", selectedUser.id);

      if (updateError) throw updateError;

      const auditRows = [];

      if (roleChanged) {
        auditRows.push({
          actor_user_id: currentAdmin.id,
          actor_email: currentAdmin.email,
          target_user_id: selectedUser.id,
          target_email: selectedUser.email,
          action: "role_changed",
          details: {
            previous_role: previousRole,
            next_role: nextRole,
          },
          created_at: now,
        });
      }

      if (statusChanged) {
        auditRows.push({
          actor_user_id: currentAdmin.id,
          actor_email: currentAdmin.email,
          target_user_id: selectedUser.id,
          target_email: selectedUser.email,
          action: "status_changed",
          details: {
            previous_status: previousStatus,
            next_status: nextStatus,
            is_disabled: nextDisabled,
          },
          created_at: now,
        });
      }

      if (noteChanged) {
        auditRows.push({
          actor_user_id: currentAdmin.id,
          actor_email: currentAdmin.email,
          target_user_id: selectedUser.id,
          target_email: selectedUser.email,
          action: trimmedNote ? "support_note_updated" : "support_note_cleared",
          details: {
            note_length: trimmedNote.length,
            previous_has_note: Boolean(previousNote),
            next_has_note: Boolean(trimmedNote),
          },
          created_at: now,
        });
      }

      if (auditRows.length) {
        const { error: auditError } = await supabase
          .from("admin_audit_log")
          .insert(auditRows);

        if (auditError) {
          await loadAdminData(false);
          closeManageDrawer();
          showToast("Profile updated, but audit log insert failed", "error");
          return;
        }
      }

      await loadAdminData(false);
      closeManageDrawer();
      showToast("User updated", "success");
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Failed to save user changes.", "error");
    } finally {
      setSavingDrawer(false);
    }
  }

  function openToggleStatusConfirm(user) {
    if (currentAdmin?.id && currentAdmin.id === user.id) {
      showToast("You cannot suspend your own account.", "error");
      return;
    }

    setConfirmTarget(user);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    setConfirmTarget(null);
    setConfirmLoading(false);
  }

  async function toggleUserStatusQuick() {
    if (!confirmTarget || !currentAdmin || !supabase) return;

    if (currentAdmin.id === confirmTarget.id) {
      showToast("You cannot suspend your own account.", "error");
      closeConfirm();
      return;
    }

    try {
      setConfirmLoading(true);

      const currentStatus = normalizeStatus(confirmTarget.status);
      const nextStatus = currentStatus === "suspended" ? "active" : "suspended";
      const nextDisabled = nextStatus === "suspended";
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          status: nextStatus,
          is_disabled: nextDisabled,
          updated_at: now,
        })
        .eq("id", confirmTarget.id);

      if (updateError) throw updateError;

      const { error: auditError } = await supabase
        .from("admin_audit_log")
        .insert({
          actor_user_id: currentAdmin.id,
          actor_email: currentAdmin.email,
          target_user_id: confirmTarget.id,
          target_email: confirmTarget.email,
          action: "status_changed",
          details: {
            previous_status: currentStatus,
            next_status: nextStatus,
            is_disabled: nextDisabled,
          },
          created_at: now,
        });

      if (auditError) {
        await loadAdminData(false);
        closeConfirm();
        showToast("Status updated, but audit log insert failed", "error");
        return;
      }

      await loadAdminData(false);
      closeConfirm();
      showToast(
        nextDisabled ? "User suspended" : "User reactivated",
        nextDisabled ? "error" : "success"
      );
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Failed to update user status.", "error");
    } finally {
      setConfirmLoading(false);
    }
  }

  function exportUsersCsv() {
    const lines = [
      [
        "id",
        "name",
        "email",
        "role",
        "status",
        "username",
        "phone",
        "updated_at",
        "support_note",
      ].join(","),
      ...filteredUsers.map((user) =>
        [
          user.id,
          `"${user.name.replace(/"/g, '""')}"`,
          user.email,
          user.role,
          user.status,
          user.username,
          user.phone,
          user.lastUpdated || "",
          `"${(user.note || "").replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "admin-users.csv";
    anchor.click();
    URL.revokeObjectURL(url);

    showToast("Users CSV exported", "info");
  }

  function exportAuditCsv() {
    const lines = [
      ["id", "actor", "action", "target", "details", "created_at"].join(","),
      ...filteredActivity.map((entry) =>
        [
          entry.id,
          `"${(entry.actor || "").replace(/"/g, '""')}"`,
          `"${(entry.action || "").replace(/"/g, '""')}"`,
          `"${(entry.target || "").replace(/"/g, '""')}"`,
          `"${JSON.stringify(entry.details || {}).replace(/"/g, '""')}"`,
          entry.createdAt || "",
        ].join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "admin-audit-log.csv";
    anchor.click();
    URL.revokeObjectURL(url);

    showToast("Audit CSV exported", "info");
  }

  function applyUserPreset({ role = "all", status = "all", note = "all", searchText = "" }) {
    setTab("users");
    setRoleFilter(role);
    setStatusFilter(status);
    setNoteFilter(note);
    setSearch(searchText);
  }

  return (
    <div className="adminPage">
      <AdminActionToast
        open={toast.open}
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast({ open: false, message: "", tone: "success" })}
      />

      <AdminShell
        title="Admin workspace"
        description="Live admin users and audit activity from Supabase."
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        actionSlot={
          <>
            <QuickButton icon={RefreshCcw} onClick={() => loadAdminData(true)} disabled={busy}>
              {busy ? "Refreshing..." : "Refresh"}
            </QuickButton>

            <QuickButton
              icon={Download}
              onClick={exportUsersCsv}
              disabled={!filteredUsers.length}
            >
              Export users
            </QuickButton>
          </>
        }
      >
        {error ? <div className="errorBar">{error}</div> : null}

        <div className="statsGrid">
          <AdminStatCard
            label="Total Users"
            value={stats.total}
            hint="Profiles currently visible to admin."
            icon={Users}
            tone="neutral"
          />
          <AdminStatCard
            label="Active"
            value={stats.active}
            hint="Accounts currently enabled."
            icon={Shield}
            tone="green"
          />
          <AdminStatCard
            label="Pending Review"
            value={stats.pending}
            hint="Profiles marked pending."
            icon={Activity}
            tone="amber"
          />
          <AdminStatCard
            label="Users With Notes"
            value={stats.withNotes}
            hint="Profiles with internal admin notes."
            icon={StickyNote}
            tone="red"
          />
        </div>

        {(tab === "users" || tab === "activity") && (
          <AdminSearchFilters
            searchValue={search}
            onSearchChange={setSearch}
            roleValue={roleFilter}
            onRoleChange={setRoleFilter}
            statusValue={statusFilter}
            onStatusChange={setStatusFilter}
            noteValue={noteFilter}
            onNoteChange={setNoteFilter}
            roles={ROLE_OPTIONS}
            statuses={STATUS_OPTIONS}
            noteOptions={NOTE_OPTIONS}
            onClear={() => {
              setSearch("");
              setRoleFilter("all");
              setStatusFilter("all");
              setNoteFilter("all");
            }}
          />
        )}

        {tab === "overview" && (
          <div className="overviewGrid">
            <section className="panel">
              <div className="panelHead">
                <div>
                  <div className="panelEyebrow">Users</div>
                  <h2>Recent profiles</h2>
                </div>

                <button type="button" className="textBtn" onClick={() => setTab("users")}>
                  View all
                </button>
              </div>

              {loading ? (
                <AdminEmptyState
                  title="Loading users"
                  description="Pulling profiles from Supabase now."
                />
              ) : (
                <AdminTable
                  columns={userColumns}
                  rows={users.slice(0, 6)}
                  renderActions={(row) => (
                    <div className="rowActions">
                      <button type="button" className="miniBtn" onClick={() => openManageDrawer(row)}>
                        Manage
                      </button>
                    </div>
                  )}
                />
              )}
            </section>

            <section className="panel">
              <div className="panelHead">
                <div>
                  <div className="panelEyebrow">Audit</div>
                  <h2>Latest activity</h2>
                </div>

                <button type="button" className="textBtn" onClick={() => setTab("activity")}>
                  View all
                </button>
              </div>

              {loading ? (
                <AdminEmptyState
                  title="Loading activity"
                  description="Pulling audit rows from Supabase now."
                />
              ) : (
                <AdminAuditTimeline items={activity} maxItems={7} />
              )}
            </section>
          </div>
        )}

        {tab === "users" && (
          <section className="panel">
            <div className="panelHead">
              <div>
                <div className="panelEyebrow">User Management</div>
                <h2>User table</h2>
              </div>

              <div className="panelMeta">
                {lastRefresh ? `Refreshed ${formatAgo(lastRefresh)}` : "Not loaded yet"}
              </div>
            </div>

            <AdminTable
              columns={userColumns}
              rows={filteredUsers}
              emptyTitle={loading ? "Loading users" : "No users match these filters"}
              emptyDescription={
                loading
                  ? "Still loading from Supabase."
                  : "Try a different role, status, note filter, or search value."
              }
              renderActions={(row) => (
                <div className="rowActions">
                  <button type="button" className="miniBtn" onClick={() => openManageDrawer(row)}>
                    Manage
                  </button>
                </div>
              )}
            />
          </section>
        )}

        {tab === "activity" && (
          <section className="panel">
            <div className="panelHead">
              <div>
                <div className="panelEyebrow">Audit Feed</div>
                <h2>Activity log</h2>
              </div>

              <div className="panelMeta">{filteredActivity.length} entries</div>
            </div>

            <div className="toolBar">
              <QuickButton icon={Download} onClick={exportAuditCsv} disabled={!filteredActivity.length}>
                Export audit
              </QuickButton>
            </div>

            <AdminTable
              columns={activityColumns}
              rows={filteredActivity}
              emptyTitle={loading ? "Loading activity" : "No activity matches your search"}
              emptyDescription={
                loading
                  ? "Still loading from Supabase."
                  : "Try a broader search term."
              }
              actionLabel=""
            />
          </section>
        )}

        {tab === "tools" && (
          <div className="toolsGrid">
            <section className="panel">
              <div className="panelHead">
                <div>
                  <div className="panelEyebrow">Quick Tools</div>
                  <h2>Admin operations</h2>
                </div>
              </div>

              <div className="toolButtonGrid">
                <QuickButton
                  icon={ShieldAlert}
                  onClick={() => applyUserPreset({ status: "suspended" })}
                  disabled={!stats.suspended}
                >
                  Show suspended
                </QuickButton>

                <QuickButton
                  icon={Activity}
                  onClick={() => applyUserPreset({ status: "pending" })}
                  disabled={!stats.pending}
                >
                  Show pending
                </QuickButton>

                <QuickButton
                  icon={StickyNote}
                  onClick={() => applyUserPreset({ note: "with_note" })}
                  disabled={!stats.withNotes}
                >
                  Show notes
                </QuickButton>

                <QuickButton
                  icon={Shield}
                  onClick={() => applyUserPreset({ role: "admin" })}
                  disabled={!roleCounts.admin}
                >
                  Show admins
                </QuickButton>

                <QuickButton
                  icon={Download}
                  onClick={exportUsersCsv}
                  disabled={!users.length}
                >
                  Export users CSV
                </QuickButton>

                <QuickButton
                  icon={Download}
                  onClick={exportAuditCsv}
                  disabled={!activity.length}
                >
                  Export audit CSV
                </QuickButton>
              </div>

              <div className="miniStats">
                <div className="miniStat">
                  <span>Admins</span>
                  <strong>{roleCounts.admin}</strong>
                </div>
                <div className="miniStat">
                  <span>Support</span>
                  <strong>{roleCounts.support}</strong>
                </div>
                <div className="miniStat">
                  <span>Moderators</span>
                  <strong>{roleCounts.moderator}</strong>
                </div>
                <div className="miniStat">
                  <span>Users</span>
                  <strong>{roleCounts.user}</strong>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panelHead">
                <div>
                  <div className="panelEyebrow">Queues</div>
                  <h2>Flagged user sections</h2>
                </div>
              </div>

              <div className="queueGrid">
                <QueueCard
                  title="Pending review"
                  users={pendingUsers}
                  emptyText="No pending users right now."
                  onManage={openManageDrawer}
                  onToggleStatus={openToggleStatusConfirm}
                />

                <QueueCard
                  title="Suspended users"
                  users={suspendedUsers}
                  emptyText="No suspended users right now."
                  onManage={openManageDrawer}
                  onToggleStatus={openToggleStatusConfirm}
                />

                <QueueCard
                  title="Users with notes"
                  users={usersWithNotes}
                  emptyText="No user notes right now."
                  onManage={openManageDrawer}
                  onToggleStatus={openToggleStatusConfirm}
                />
              </div>
            </section>
          </div>
        )}
      </AdminShell>

      <AdminNoteDrawer
        open={drawerOpen}
        user={selectedUser}
        roleValue={roleDraft}
        onRoleChange={setRoleDraft}
        statusValue={statusDraft}
        onStatusChange={setStatusDraft}
        noteValue={noteDraft}
        onNoteChange={setNoteDraft}
        onSave={saveUserChanges}
        onClearNote={clearDrawerNote}
        onClose={closeManageDrawer}
        saving={savingDrawer}
        hasChanges={hasDrawerChanges}
        roleOptions={ROLE_OPTIONS.filter((role) => role !== "all")}
        statusOptions={STATUS_OPTIONS.filter((status) => status !== "all")}
      />

      <AdminConfirmDialog
        open={confirmOpen}
        title={
          confirmTarget?.status === "suspended"
            ? "Reactivate this user?"
            : "Suspend this user?"
        }
        description={
          confirmTarget
            ? `${
                confirmTarget.status === "suspended"
                  ? "This will restore account access."
                  : "This will block access until you reactivate the account."
              } Target: ${confirmTarget.name}.`
            : "Confirm this action."
        }
        confirmLabel={
          confirmTarget?.status === "suspended" ? "Reactivate" : "Suspend"
        }
        tone={confirmTarget?.status === "suspended" ? "neutral" : "danger"}
        loading={confirmLoading}
        onConfirm={toggleUserStatusQuick}
        onClose={closeConfirm}
      />

      <style jsx>{`
        .adminPage {
          position: relative;
          display: grid;
          gap: 16px;
        }

        .errorBar {
          border-radius: 18px;
          border: 1px solid rgba(255, 128, 128, 0.18);
          background: rgba(83, 24, 24, 0.72);
          color: #ffd5d5;
          padding: 14px 16px;
          font-weight: 700;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .overviewGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
          gap: 16px;
          align-items: start;
        }

        .toolsGrid {
          display: grid;
          gap: 16px;
        }

        .queueGrid {
          display: grid;
          gap: 14px;
        }

        .panel {
          border-radius: 28px;
          border: 1px solid rgba(147, 175, 255, 0.14);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015)),
            rgba(7, 11, 18, 0.74);
          backdrop-filter: blur(18px);
          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255,255,255,0.05);
          padding: 18px;
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        .panelHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .panelEyebrow {
          font-size: 0.74rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: rgba(141, 174, 255, 0.84);
          font-weight: 800;
          margin-bottom: 7px;
        }

        h2 {
          margin: 0;
          color: #f5f8ff;
          font-size: 1.18rem;
        }

        .panelMeta {
          color: rgba(214, 226, 255, 0.62);
          font-size: 0.9rem;
        }

        .toolBar {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .toolButtonGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .miniStats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .miniStat {
          border-radius: 18px;
          padding: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          display: grid;
          gap: 6px;
        }

        .miniStat span {
          color: rgba(214, 226, 255, 0.58);
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .miniStat strong {
          color: #f5f8ff;
          font-size: 1.2rem;
        }

        .textBtn,
        .quickBtn,
        .miniBtn {
          appearance: none;
          cursor: pointer;
          font-weight: 800;
        }

        .textBtn {
          min-height: 38px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(147, 175, 255, 0.14);
          background: rgba(18, 28, 48, 0.7);
          color: #f5f8ff;
        }

        .quickBtn {
          min-height: 44px;
          padding: 0 14px;
          border-radius: 14px;
          border: 1px solid rgba(147, 175, 255, 0.14);
          background: rgba(18, 28, 48, 0.92);
          color: #f5f8ff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .quickBtn:disabled,
        .miniBtn:disabled,
        .textBtn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .userCell {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)),
            rgba(26, 38, 62, 0.92);
          border: 1px solid rgba(147, 175, 255, 0.14);
          color: #f5f8ff;
          font-weight: 800;
        }

        .primaryText {
          color: #f5f8ff;
          font-weight: 700;
          line-height: 1.4;
        }

        .secondaryText {
          color: rgba(214, 226, 255, 0.64);
          font-size: 0.9rem;
          line-height: 1.45;
        }

        .strongLine {
          color: rgba(230, 237, 255, 0.86);
        }

        .activityEvent {
          display: grid;
          gap: 4px;
        }

        .pill,
        .rolePill,
        .noteYes,
        .noteNo {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 0.82rem;
          font-weight: 800;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .pill.green {
          color: #9dffbe;
          background: rgba(50, 196, 108, 0.12);
          border: 1px solid rgba(50, 196, 108, 0.2);
        }

        .pill.amber {
          color: #ffd18d;
          background: rgba(255, 184, 92, 0.11);
          border: 1px solid rgba(255, 184, 92, 0.18);
        }

        .pill.red {
          color: #ffb0b0;
          background: rgba(255, 107, 107, 0.11);
          border: 1px solid rgba(255, 107, 107, 0.18);
        }

        .pill.neutral,
        .rolePill {
          color: #dbe7ff;
          background: rgba(147, 175, 255, 0.1);
          border: 1px solid rgba(147, 175, 255, 0.16);
        }

        .noteYes {
          color: #dbe7ff;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .noteNo {
          color: rgba(214, 226, 255, 0.52);
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
        }

        .rowActions {
          display: inline-flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .miniBtn {
          min-height: 34px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(147, 175, 255, 0.14);
          background: rgba(18, 28, 48, 0.9);
          color: #f5f8ff;
        }

        @media (max-width: 1180px) {
          .statsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .overviewGrid {
            grid-template-columns: 1fr;
          }

          .toolButtonGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .miniStats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .statsGrid,
          .toolButtonGrid,
          .miniStats {
            grid-template-columns: 1fr;
          }

          .panel {
            padding: 16px;
          }

          .panelHead {
            align-items: start;
            flex-direction: column;
          }

          .toolBar {
            width: 100%;
          }

          .toolBar :global(button) {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}