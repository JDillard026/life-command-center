export const GOAL_PRESETS = [
  "Emergency Fund",
  "Vacation",
  "Truck / Car Fund",
  "House Projects",
  "Christmas / Gifts",
  "Taxes",
  "Investing (Cash to Brokerage)",
  "Other",
];

export const PRIORITY_OPTIONS = ["High", "Medium", "Low"];
export const QUICK_AMOUNTS = [25, 100, 250, 500];
export const BOARD_TABS = ["dashboard", "focus", "contributions", "planner", "tools"];

export function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export function parseMoneyInput(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}

export function fmtMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function fmtMoneyTight(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0.00";
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

export function pct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0%";
  return `${Math.round(num)}%`;
}

export function isoDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function todayISO() {
  return isoDate(new Date());
}

export function monthKeyFromISO(iso) {
  const s = String(iso || "");
  return s.length >= 7 ? s.slice(0, 7) : "";
}

export function fmtMonthLabel(ym) {
  if (!ym || ym.length < 7) return "—";
  const [y, m] = ym.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatAgo(value) {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  const minutes = Math.round(ms / 60000);

  if (!Number.isFinite(minutes)) return "—";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function daysUntil(iso) {
  if (!iso) return null;
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const due = new Date(`${iso}T00:00:00`).getTime();
  if (!Number.isFinite(due)) return null;
  return Math.round((due - today) / 86400000);
}

export function progressPercent(goal) {
  const target = safeNum(goal?.target, 0);
  const current = safeNum(goal?.current, 0);
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}

export function amountLeft(goal) {
  return Math.max(0, safeNum(goal?.target, 0) - safeNum(goal?.current, 0));
}

export function priorityRank(priority) {
  if (priority === "High") return 0;
  if (priority === "Medium") return 1;
  return 2;
}

export function dueLabel(goal) {
  if (!goal?.dueDate) return "No due date";
  const d = daysUntil(goal.dueDate);
  if (d === null) return "No due date";
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d}d`;
}

export function progressTone(goal) {
  const value = progressPercent(goal);
  if (value >= 100) return "green";
  if (value >= 65) return "green";
  if (value >= 30) return "amber";
  return "neutral";
}

export function dueTone(goal) {
  const d = daysUntil(goal?.dueDate);
  if (d === null) return "neutral";
  if (d < 0) return "red";
  if (d === 0) return "red";
  if (d <= 7) return "amber";
  return "green";
}

export function priorityTone(priority) {
  if (priority === "High") return "red";
  if (priority === "Medium") return "amber";
  return "neutral";
}

export function toneMeta(tone = "neutral") {
  if (tone === "green") {
    return {
      text: "#97efc7",
      border: "rgba(143, 240, 191, 0.18)",
      glow: "rgba(110, 229, 173, 0.10)",
    };
  }

  if (tone === "amber") {
    return {
      text: "#f5cf88",
      border: "rgba(255, 204, 112, 0.18)",
      glow: "rgba(255, 194, 92, 0.10)",
    };
  }

  if (tone === "red") {
    return {
      text: "#ffb4c5",
      border: "rgba(255, 132, 163, 0.18)",
      glow: "rgba(255, 108, 145, 0.10)",
    };
  }

  if (tone === "blue") {
    return {
      text: "#bcd7ff",
      border: "rgba(143, 177, 255, 0.18)",
      glow: "rgba(143, 177, 255, 0.10)",
    };
  }

  return {
    text: "#f7fbff",
    border: "rgba(214, 226, 255, 0.14)",
    glow: "rgba(140, 170, 255, 0.08)",
  };
}

export function goalInitials(name = "") {
  const clean = String(name).trim();
  if (!clean) return "SG";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function paceNeed(goal) {
  const left = amountLeft(goal);
  const d = daysUntil(goal?.dueDate);

  if (left <= 0 || d === null) {
    return {
      perDay: null,
      perWeek: null,
      perMonth: null,
    };
  }

  const safeDays = Math.max(1, d);

  return {
    perDay: left / safeDays,
    perWeek: left / (safeDays / 7),
    perMonth: left / (safeDays / 30),
  };
}

export function recentProjection(goal) {
  const list = Array.isArray(goal?.contributions) ? goal.contributions : [];

  if (amountLeft(goal) <= 0) {
    return {
      text: "Already funded",
      tone: "green",
    };
  }

  if (list.length < 2) {
    return {
      text: "Need more history",
      tone: "neutral",
    };
  }

  const recent = list
    .slice()
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .slice(-8);

  const dates = recent
    .map((item) => new Date(`${item.date}T00:00:00`).getTime())
    .filter((n) => Number.isFinite(n));

  const total = recent.reduce((sum, item) => sum + safeNum(item.amount, 0), 0);

  if (dates.length < 2 || total <= 0) {
    return {
      text: "Need more history",
      tone: "neutral",
    };
  }

  const first = Math.min(...dates);
  const last = Math.max(...dates);
  const spanDays = Math.max(1, Math.round((last - first) / 86400000) + 1);
  const perDay = total / spanDays;

  if (!Number.isFinite(perDay) || perDay <= 0) {
    return {
      text: "Need more history",
      tone: "neutral",
    };
  }

  const left = amountLeft(goal);
  const daysToFinish = Math.ceil(left / perDay);
  const finish = new Date();
  finish.setDate(finish.getDate() + daysToFinish);

  return {
    text: `At this pace, around ${finish.toLocaleDateString()}`,
    tone: daysToFinish <= 60 ? "green" : "amber",
  };
}

export function projectedFinishByMonthly(goal, monthlyAdd) {
  const left = amountLeft(goal);
  const monthly = safeNum(monthlyAdd, 0);

  if (left <= 0) {
    return {
      months: 0,
      finishLabel: "Already funded",
      tone: "green",
    };
  }

  if (monthly <= 0) {
    return {
      months: null,
      finishLabel: "No monthly push set",
      tone: "neutral",
    };
  }

  const months = Math.ceil(left / monthly);
  const finish = new Date();
  finish.setMonth(finish.getMonth() + months);

  return {
    months,
    finishLabel: finish.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    }),
    tone: months <= 6 ? "green" : months <= 18 ? "amber" : "red",
  };
}

export function fundingMood(goal) {
  const progress = progressPercent(goal);
  const due = daysUntil(goal?.dueDate);
  const left = amountLeft(goal);

  if (left <= 0) {
    return {
      title: "Goal completed",
      copy: "This one is already funded. Keep it protected.",
      tone: "green",
    };
  }

  if (due !== null && due < 0) {
    return {
      title: "You are late",
      copy: "This target date already passed and the goal is still short.",
      tone: "red",
    };
  }

  if (due !== null && due <= 7) {
    return {
      title: "This is getting close",
      copy: "The due date is close enough that pace matters right now.",
      tone: "amber",
    };
  }

  if (progress >= 80) {
    return {
      title: "Final stretch",
      copy: "You are close enough that steady small adds will finish it.",
      tone: "green",
    };
  }

  if (progress >= 45) {
    return {
      title: "Good momentum",
      copy: "This goal has real traction. Keep feeding it consistently.",
      tone: "green",
    };
  }

  return {
    title: "Still early",
    copy: "This goal needs stronger funding pace to feel real.",
    tone: "amber",
  };
}

export function resolvedGoalName(preset, customName) {
  if (preset && preset !== "Other") return preset;
  return String(customName || "").trim();
}

export function mapGoalRow(row) {
  return {
    id: row.id,
    name: String(row.name ?? "").trim(),
    target: safeNum(row.target_amount, 0),
    current: safeNum(row.current_amount, 0),
    dueDate: row.target_date || "",
    priority: row.priority || "Medium",
    archived: !!row.archived,
    createdAt:
      row.created_at_ms ??
      (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
    updatedAt: row.updated_at || row.created_at || null,
    contributions: Array.isArray(row.contributions) ? row.contributions : [],
  };
}

export function mapGoalToRow(goal, userId) {
  return {
    id: goal.id,
    user_id: userId,
    name: String(goal.name ?? "").trim(),
    target_amount: safeNum(goal.target, 0),
    current_amount: safeNum(goal.current, 0),
    target_date: goal.dueDate || null,
    category: "general",
    notes: "",
    priority: goal.priority || "Medium",
    archived: !!goal.archived,
    contributions: Array.isArray(goal.contributions) ? goal.contributions : [],
    created_at_ms: goal.createdAt ?? Date.now(),
    updated_at: new Date().toISOString(),
  };
}