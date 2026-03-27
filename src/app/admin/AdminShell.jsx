"use client";

export default function AdminShell({
  title,
  description,
  tabs = [],
  activeTab,
  onTabChange,
  actionSlot = null,
  children,
}) {
  return (
    <section className="adminShell">
      <div className="adminHero">
        <div className="adminHeroCopy">
          <div className="eyebrow">Admin Control</div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>

        {actionSlot ? <div className="adminHeroActions">{actionSlot}</div> : null}
      </div>

      {tabs?.length ? (
        <div className="tabsWrap">
          <div className="tabs">
            {tabs.map((tab) => {
              const active = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`tabButton ${active ? "active" : ""}`}
                  onClick={() => onTabChange?.(tab.id)}
                >
                  <span>{tab.label}</span>
                  {typeof tab.count === "number" ? (
                    <span className="tabCount">{tab.count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="adminBody">{children}</div>

      <style jsx>{`
        .adminShell {
          width: 100%;
          display: grid;
          gap: 18px;
        }

        .adminHero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: end;
          padding: 24px;
          border-radius: 30px;
          border: 1px solid rgba(151, 178, 255, 0.16);
          background:
            radial-gradient(circle at 0% 0%, rgba(93, 130, 255, 0.12), transparent 38%),
            linear-gradient(
              180deg,
              rgba(255,255,255,0.06),
              rgba(255,255,255,0.02) 18%,
              rgba(255,255,255,0.01) 35%,
              rgba(255,255,255,0) 100%
            ),
            rgba(7, 12, 21, 0.72);
          backdrop-filter: blur(18px);
          box-shadow:
            0 24px 80px rgba(0, 0, 0, 0.36),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(141, 174, 255, 0.84);
        }

        h1 {
          margin: 0;
          font-size: clamp(1.85rem, 2.8vw, 2.5rem);
          line-height: 1.05;
          color: #f4f8ff;
          font-weight: 800;
        }

        p {
          max-width: 760px;
          margin: 10px 0 0;
          color: rgba(214, 226, 255, 0.72);
          line-height: 1.6;
        }

        .adminHeroActions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
          align-items: center;
        }

        .tabsWrap {
          display: flex;
        }

        .tabs {
          display: inline-flex;
          gap: 8px;
          padding: 8px;
          border-radius: 22px;
          border: 1px solid rgba(151, 178, 255, 0.14);
          background: rgba(6, 10, 18, 0.66);
          backdrop-filter: blur(14px);
          overflow-x: auto;
        }

        .tabButton {
          appearance: none;
          border: 0;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-height: 42px;
          padding: 0 14px;
          border-radius: 16px;
          background: transparent;
          color: rgba(214, 226, 255, 0.76);
          font-weight: 700;
          white-space: nowrap;
          transition: 160ms ease;
        }

        .tabButton:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #f5f8ff;
        }

        .tabButton.active {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)),
            rgba(19, 29, 48, 0.92);
          color: #ffffff;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.05),
            0 10px 24px rgba(0, 0, 0, 0.24);
        }

        .tabCount {
          min-width: 24px;
          height: 24px;
          padding: 0 8px;
          border-radius: 999px;
          display: inline-grid;
          place-items: center;
          font-size: 0.72rem;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.9);
        }

        .adminBody {
          display: grid;
          gap: 16px;
        }

        @media (max-width: 860px) {
          .adminHero {
            grid-template-columns: 1fr;
            align-items: start;
            padding: 20px;
          }

          .adminHeroActions {
            justify-content: stretch;
          }
        }
      `}</style>
    </section>
  );
}