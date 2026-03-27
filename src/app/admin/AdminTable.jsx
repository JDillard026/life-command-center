"use client";

import AdminEmptyState from "./AdminEmptyState";

export default function AdminTable({
  columns = [],
  rows = [],
  keyField = "id",
  emptyTitle = "No matching records",
  emptyDescription = "Try changing your filters or search input.",
  onRowClick,
  renderActions,
  actionLabel = "Actions",
}) {
  if (!rows.length) {
    return (
      <AdminEmptyState title={emptyTitle} description={emptyDescription} />
    );
  }

  return (
    <div className="tableShell">
      <div className="desktopTable">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.header}</th>
              ))}
              {renderActions ? <th className="actionsHead">{actionLabel}</th> : null}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row[keyField]}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? "clickable" : ""}
              >
                {columns.map((column) => (
                  <td key={`${row[keyField]}-${column.key}`}>
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key] ?? "—"}
                  </td>
                ))}

                {renderActions ? (
                  <td
                    className="actionsCell"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {renderActions(row)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobileCards">
        {rows.map((row) => (
          <article
            key={row[keyField]}
            className={`mobileCard ${onRowClick ? "clickable" : ""}`}
            onClick={() => onRowClick?.(row)}
          >
            <div className="mobileGrid">
              {columns.map((column) => (
                <div key={`${row[keyField]}-${column.key}`} className="mobileItem">
                  <span className="mobileLabel">{column.header}</span>
                  <div className="mobileValue">
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key] ?? "—"}
                  </div>
                </div>
              ))}
            </div>

            {renderActions ? (
              <div
                className="mobileActions"
                onClick={(event) => event.stopPropagation()}
              >
                {renderActions(row)}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <style jsx>{`
        .tableShell {
          border-radius: 24px;
          border: 1px solid rgba(147, 175, 255, 0.14);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015)),
            rgba(7, 11, 18, 0.74);
          backdrop-filter: blur(18px);
          overflow: hidden;
          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .desktopTable {
          overflow-x: visible;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        thead {
          background: rgba(255, 255, 255, 0.025);
        }

        th {
          text-align: left;
          padding: 14px 14px;
          font-size: 0.76rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(214, 226, 255, 0.58);
          white-space: nowrap;
        }

        td {
          padding: 14px 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          color: #eef4ff;
          vertical-align: top;
          word-break: break-word;
        }

        tr.clickable {
          cursor: pointer;
        }

        tr.clickable:hover {
          background: rgba(255, 255, 255, 0.025);
        }

        .actionsHead,
        .actionsCell {
          text-align: right;
          width: 96px;
          white-space: nowrap;
        }

        .mobileCards {
          display: none;
          padding: 14px;
          gap: 12px;
        }

        .mobileCard {
          border-radius: 18px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .mobileCard.clickable {
          cursor: pointer;
        }

        .mobileGrid {
          display: grid;
          gap: 12px;
        }

        .mobileItem {
          display: grid;
          gap: 6px;
        }

        .mobileLabel {
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(214, 226, 255, 0.56);
        }

        .mobileValue {
          color: #eef4ff;
        }

        .mobileActions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        @media (max-width: 860px) {
          .desktopTable {
            display: none;
          }

          .mobileCards {
            display: grid;
          }
        }
      `}</style>
    </div>
  );
}