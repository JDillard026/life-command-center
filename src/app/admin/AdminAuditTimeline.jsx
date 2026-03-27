"use client";

import AdminEmptyState from "./AdminEmptyState";

function formatTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown time";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatAgo(value) {
  const ms = new Date(value).getTime() - Date.now();
  const absMinutes = Math.round(Math.abs(ms) / 60000);

  if (!Number.isFinite(absMinutes)) return "Unknown";
  if (absMinutes < 1) return "just now";
  if (absMinutes < 60) return `${absMinutes}m ago`;

  const hours = Math.round(absMinutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function AdminAuditTimeline({
  items = [],
  emptyTitle = "No admin activity yet",
  emptyDescription = "Actions will appear here when admins update users, notes, or permissions.",
  maxItems,
}) {
  const rows = typeof maxItems === "number" ? items.slice(0, maxItems) : items;

  if (!rows.length) {
    return (
      <AdminEmptyState
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="timeline">
      {rows.map((entry) => (
        <div key={entry.id} className="timelineItem">
          <span className="timelineDot" />

          <div className="timelineContent">
            <div className="timelineTitle">
              <strong>{entry.actor || "Admin"}</strong> {entry.action || "did something"}
            </div>

            <div className="timelineMeta">
              {entry.target || "Unknown target"} · {formatTimestamp(entry.createdAt)}
            </div>

            <div className="timelineAgo">{formatAgo(entry.createdAt)}</div>
          </div>
        </div>
      ))}

      <style jsx>{`
        .timeline {
          display: grid;
          gap: 14px;
          padding-left: 6px;
        }

        .timelineItem {
          position: relative;
          display: grid;
          grid-template-columns: 18px minmax(0, 1fr);
          gap: 12px;
          align-items: start;
        }

        .timelineItem:not(:last-child)::after {
          content: "";
          position: absolute;
          left: 8px;
          top: 22px;
          bottom: -12px;
          width: 1px;
          background: rgba(147, 175, 255, 0.14);
        }

        .timelineDot {
          width: 14px;
          height: 14px;
          margin-top: 4px;
          border-radius: 999px;
          background: #9bb7ff;
          box-shadow: 0 0 22px rgba(155, 183, 255, 0.9);
        }

        .timelineContent {
          min-width: 0;
        }

        .timelineTitle {
          color: #eef4ff;
          line-height: 1.5;
        }

        .timelineMeta {
          margin-top: 4px;
          color: rgba(214, 226, 255, 0.62);
          font-size: 0.92rem;
          line-height: 1.45;
        }

        .timelineAgo {
          margin-top: 6px;
          color: rgba(155, 183, 255, 0.82);
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}