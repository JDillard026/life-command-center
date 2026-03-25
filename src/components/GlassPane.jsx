import styles from "./GlassPane.module.css";

function cx(...names) {
  return names.filter(Boolean).join(" ");
}

const TONE_CLASS = {
  neutral: styles.toneNeutral,
  green: styles.toneGreen,
  amber: styles.toneAmber,
  red: styles.toneRed,
};

const SIZE_CLASS = {
  hero: styles.sizeHero,
  card: styles.sizeCard,
  compact: styles.sizeCompact,
};

export default function GlassPane({
  as: Tag = "section",
  tone = "neutral",
  size = "card",
  className = "",
  style,
  children,
  ...props
}) {
  return (
    <Tag
      className={cx(
        styles.pane,
        TONE_CLASS[tone] || styles.toneNeutral,
        SIZE_CLASS[size] || styles.sizeCard,
        className
      )}
      style={style}
      {...props}
    >
      <div className={styles.inner}>{children}</div>
    </Tag>
  );
}