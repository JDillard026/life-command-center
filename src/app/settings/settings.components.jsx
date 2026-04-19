"use client";

import styles from "./settings.module.css";

function cx(...names) {
  return names.filter(Boolean).join(" ");
}

export function SectionPills({ items, active, onChange }) {
  return (
    <div className={styles.sectionNav}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cx(
            styles.sectionPill,
            active === item.key && styles.sectionPillActive
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  right,
  children,
  className = "",
}) {
  return (
    <section className={cx(styles.sectionCard, className)}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitleWrap}>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {subtitle ? <p className={styles.sectionSubtitle}>{subtitle}</p> : null}
        </div>

        {right ? <div className={styles.sectionRight}>{right}</div> : null}
      </div>

      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={cx(styles.field, className)}>
      <div className={styles.fieldMeta}>
        <div className={styles.fieldLabel}>{label}</div>
        {hint ? <div className={styles.fieldHint}>{hint}</div> : null}
      </div>
      {children}
    </label>
  );
}

export function Input({ className = "", ...props }) {
  return <input {...props} className={cx(styles.input, className)} />;
}

export function Textarea({ className = "", ...props }) {
  return (
    <textarea
      {...props}
      className={cx(styles.input, styles.textarea, className)}
    />
  );
}

export function Select({ className = "", children, ...props }) {
  return (
    <select {...props} className={cx(styles.input, styles.select, className)}>
      {children}
    </select>
  );
}

export function ToggleRow({ title, desc, enabled, onToggle }) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleCopy}>
        <div className={styles.toggleTitle}>{title}</div>
        <div className={styles.toggleDesc}>{desc}</div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className={cx(styles.switchBtn, enabled && styles.switchBtnOn)}
      >
        <span className={styles.switchTrack}>
          <span className={styles.switchThumb} />
        </span>
        <span className={styles.switchLabel}>{enabled ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

export function StatTile({ label, value, tone = "neutral" }) {
  return (
    <div
      className={cx(
        styles.statCard,
        tone === "good" && styles.statToneGood,
        tone === "accent" && styles.statToneAccent
      )}
    >
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );
}

export function ToolRow({ title, desc, action }) {
  return (
    <div className={styles.toolRow}>
      <div className={styles.toolCopy}>
        <div className={styles.toolTitle}>{title}</div>
        <div className={styles.toolDesc}>{desc}</div>
      </div>
      <div>{action}</div>
    </div>
  );
}

export function QuickActionButton({ title, desc, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={styles.quickActionBtn}
    >
      <span className={styles.quickActionTitle}>{title}</span>
      <span className={styles.quickActionDesc}>{desc}</span>
    </button>
  );
}