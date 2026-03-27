"use client";

import { Inbox } from "lucide-react";

export default function AdminEmptyState({
  title = "Nothing here yet",
  description = "There is no data to show right now.",
  actionLabel,
  onAction,
  icon: Icon = Inbox,
}) {
  return (
    <div className="emptyState">
      <div className="emptyIcon">
        <Icon size={24} />
      </div>

      <h3>{title}</h3>
      <p>{description}</p>

      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}

      <style jsx>{`
        .emptyState {
          padding: 34px 22px;
          border-radius: 24px;
          border: 1px dashed rgba(147, 175, 255, 0.18);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)),
            rgba(8, 12, 20, 0.56);
          text-align: center;
        }

        .emptyIcon {
          width: 56px;
          height: 56px;
          margin: 0 auto 14px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          color: rgba(214, 226, 255, 0.8);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255,255,255,0.07);
        }

        h3 {
          margin: 0;
          color: #f5f8ff;
          font-size: 1.1rem;
        }

        p {
          margin: 10px auto 0;
          max-width: 540px;
          color: rgba(214, 226, 255, 0.68);
          line-height: 1.6;
        }

        button {
          margin-top: 16px;
          min-height: 42px;
          padding: 0 14px;
          border-radius: 14px;
          border: 1px solid rgba(147, 175, 255, 0.18);
          background: rgba(18, 28, 48, 0.92);
          color: #f5f8ff;
          font-weight: 700;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}