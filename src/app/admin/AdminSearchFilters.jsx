"use client";

import { Search, X } from "lucide-react";

export default function AdminSearchFilters({
  searchValue,
  onSearchChange,
  roleValue,
  onRoleChange,
  statusValue,
  onStatusChange,
  noteValue,
  onNoteChange,
  roles = ["all", "admin", "support", "moderator", "user"],
  statuses = ["all", "active", "pending", "suspended"],
  noteOptions = ["all", "with_note", "no_note"],
  onClear,
}) {
  return (
    <div className="filters">
      <div className="searchWrap">
        <Search size={18} />
        <input
          value={searchValue}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder="Search name, email, username, phone, role, status..."
        />
      </div>

      <select value={roleValue} onChange={(event) => onRoleChange?.(event.target.value)}>
        {roles.map((role) => (
          <option key={role} value={role}>
            {role === "all" ? "All roles" : role}
          </option>
        ))}
      </select>

      <select value={statusValue} onChange={(event) => onStatusChange?.(event.target.value)}>
        {statuses.map((status) => (
          <option key={status} value={status}>
            {status === "all" ? "All statuses" : status}
          </option>
        ))}
      </select>

      <select value={noteValue} onChange={(event) => onNoteChange?.(event.target.value)}>
        {noteOptions.map((option) => (
          <option key={option} value={option}>
            {option === "all"
              ? "All notes"
              : option === "with_note"
              ? "With note"
              : "No note"}
          </option>
        ))}
      </select>

      <button type="button" className="clearBtn" onClick={onClear}>
        <X size={16} />
        <span>Clear</span>
      </button>

      <style jsx>{`
        .filters {
          display: grid;
          grid-template-columns:
            minmax(240px, 1.6fr)
            minmax(150px, 0.7fr)
            minmax(150px, 0.7fr)
            minmax(150px, 0.7fr)
            auto;
          gap: 12px;
          padding: 14px;
          border-radius: 22px;
          border: 1px solid rgba(147, 175, 255, 0.14);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015)),
            rgba(7, 11, 18, 0.7);
          backdrop-filter: blur(16px);
        }

        .searchWrap {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 48px;
          padding: 0 14px;
          border-radius: 16px;
          background: rgba(2, 6, 12, 0.62);
          border: 1px solid rgba(255,255,255,0.06);
          color: rgba(214, 226, 255, 0.62);
        }

        input,
        select {
          width: 100%;
          min-height: 48px;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          background: rgba(2, 6, 12, 0.62);
          color: #f4f8ff;
          padding: 0 14px;
          outline: none;
          box-shadow: none;
        }

        input {
          border: 0;
          background: transparent;
          padding: 0;
          min-height: unset;
        }

        input::placeholder {
          color: rgba(214, 226, 255, 0.44);
        }

        .clearBtn {
          min-height: 48px;
          padding: 0 14px;
          border-radius: 16px;
          border: 1px solid rgba(147, 175, 255, 0.14);
          background: rgba(18, 28, 48, 0.88);
          color: #f4f8ff;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
          cursor: pointer;
        }

        @media (max-width: 1120px) {
          .filters {
            grid-template-columns: 1fr 1fr;
          }

          .clearBtn {
            width: 100%;
          }
        }

        @media (max-width: 640px) {
          .filters {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}