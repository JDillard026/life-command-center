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
export const QUICK_AMOUNTS = [25, 100, 250, 500, 1000];
export const WORKSPACE_TABS = ["dashboard", "history", "planner"];

export const DEFAULT_GOAL_DRAFT = {
  preset: "Emergency Fund",
  customName: "",
  target: "",
  current: "",
  dueDate: "",
  priority: "Medium",
};

export function uid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function safeNum(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function parseMoneyInput(value) {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  const next = Number(cleaned);
  return Number.isFinite(next) ? next : NaN;
}

export function fmtMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "$0";

  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function fmtMoneyTight(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "$0.00";

  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

export function pct(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return "0%";
  return `${Math.round(next)}%`;
}

export function isoDate(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function todayISO() {
  return isoDate(new Date());
}

export function monthKeyFromISO(iso) {
  const text = String(iso || "");
  return text.length >= 7 ? text.slice(0, 7) : "";
}

export function fmtMonthLabel(monthKey) {
  if (!monthKey || monthKey.length < 7) return "—";

  const [year, month] = monthKey.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;

  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function fmtDate(iso) {
  if (!iso) return "—";

  const date = new Date(`${iso}T00:00:00`);
  if (!Number.isFinite(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
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
  if (days < 30) return `${days}d ago`;

  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

export function daysUntil(iso) {
  if (!iso) return null;

  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  const target = new Date(`${iso}T00:00:00`).getTime();
  if (!Number.isFinite(target)) return null;

  return Math.round((target - today) / 86400000);
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

export function priorityTone(priority) {
  if (priority === "High") return "red";
  if (priority === "Medium") return "amber";
  return "neutral";
}

export function dueTone(goal) {
  const days = daysUntil(goal?.dueDate);

  if (days === null) return "neutral";
  if (days < 0) return "red";
  if (days <= 7) return "amber";
  return "green";
}

export function progressTone(goal) {
  const progress = progressPercent(goal);

  if (progress >= 100) return "green";
  if (progress >= 70) return "green";
  if (progress >= 35) return "amber";
  return "neutral";
}

export function dueLabel(goal) {
  if (!goal?.dueDate) return "No due date";

  const days = daysUntil(goal.dueDate);
  if (days === null) return "No due date";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

export function toneMeta(tone = "neutral") {
  if (tone === "green") {
    return {
      text: "#97efc7",
      border: "rgba(117, 237, 176, 0.22)",
      glow: "rgba(81, 214, 141, 0.16)",
    };
  }

  if (tone === "amber") {
    return {
      text: "#f5cf88",
      border: "rgba(255, 201, 107, 0.22)",
      glow: "rgba(255, 193, 82, 0.16)",
    };
  }

  if (tone === "red") {
    return {
      text: "#ffb4c5",
      border: "rgba(255, 132, 163, 0.22)",
      glow: "rgba(255, 105, 145, 0.16)",
    };
  }

  if (tone === "blue") {
    return {
      text: "#bcd7ff",
      border: "rgba(147, 180, 255, 0.22)",
      glow: "rgba(122, 164, 255, 0.16)",
    };
  }

  return {
    text: "#f7fbff",
    border: "rgba(214, 226, 255, 0.16)",
    glow: "rgba(123, 156, 255, 0.11)",
  };
}

export function goalInitials(name = "") {
  const clean = String(name || "").trim();
  if (!clean) return "SG";

  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function normalizeContribution(entry = {}) {
  return {
    id: entry.id || uid(),
    date: entry.date || todayISO(),
    amount: Math.max(0, safeNum(entry.amount, 0)),
    note: String(entry.note || "").trim(),
  };
}

export function sortContributionsDesc(list = []) {
  return [...list].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || ""))
  );
}

export function recentContributions(goal, limit = 8) {
  const items = Array.isArray(goal?.contributions) ? goal.contributions : [];
  return sortContributionsDesc(items).slice(0, limit);
}

export function thisMonthContributionTotal(goal) {
  const items = Array.isArray(goal?.contributions) ? goal.contributions : [];
  const key = monthKeyFromISO(todayISO());

  return items.reduce((sum, entry) => {
    return monthKeyFromISO(entry.date) === key
      ? sum + safeNum(entry.amount, 0)
      : sum;
  }, 0);
}

export function last30ContributionTotal(goal) {
  const items = Array.isArray(goal?.contributions) ? goal.contributions : [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  return items.reduce((sum, entry) => {
    const time = new Date(`${entry.date}T00:00:00`).getTime();
    if (!Number.isFinite(time)) return sum;
    return time >= cutoff.getTime() ? sum + safeNum(entry.amount, 0) : sum;
  }, 0);
}

export function averageContribution(goal) {
  const items = Array.isArray(goal?.contributions) ? goal.contributions : [];
  if (!items.length) return 0;

  const total = items.reduce((sum, entry) => sum + safeNum(entry.amount, 0), 0);
  return total / items.length;
}

export function paceNeed(goal) {
  const left = amountLeft(goal);
  const days = daysUntil(goal?.dueDate);

  if (left <= 0 || days === null) {
    return {
      perDay: null,
      perWeek: null,
      perMonth: null,
    };
  }

  const safeDays = Math.max(1, days);

  return {
    perDay: left / safeDays,
    perWeek: left / (safeDays / 7),
    perMonth: left / (safeDays / 30),
  };
}

export function recentProjection(goal) {
  const left = amountLeft(goal);
  if (left <= 0) {
    return {
      text: "Already funded",
      tone: "green",
    };
  }

  const total30 = last30ContributionTotal(goal);
  if (total30 <= 0) {
    return {
      text: "Need more history",
      tone: "neutral",
    };
  }

  const perDay = total30 / 30;
  if (!Number.isFinite(perDay) || perDay <= 0) {
    return {
      text: "Need more history",
      tone: "neutral",
    };
  }

  const daysToFinish = Math.ceil(left / perDay);
  const finish = new Date();
  finish.setDate(finish.getDate() + daysToFinish);

  return {
    text: `Around ${finish.toLocaleDateString()}`,
    tone: daysToFinish <= 60 ? "green" : daysToFinish <= 180 ? "amber" : "red",
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
  const left = amountLeft(goal);
  const progress = progressPercent(goal);
  const days = daysUntil(goal?.dueDate);

  if (left <= 0) {
    return {
      title: "Goal completed",
      copy: "This goal is already funded. Protect it and do not cannibalize it.",
      tone: "green",
    };
  }

  if (days !== null && days < 0) {
    return {
      title: "You are late",
      copy: "The date already passed and this goal is still short.",
      tone: "red",
    };
  }

  if (days !== null && days <= 14) {
    return {
      title: "Date pressure is real",
      copy: "This one needs active funding now, not passive wishing.",
      tone: "amber",
    };
  }

  if (progress >= 80) {
    return {
      title: "Final stretch",
      copy: "You are close enough that steady adds will finish this cleanly.",
      tone: "green",
    };
  }

  if (progress >= 45) {
    return {
      title: "Good momentum",
      copy: "This goal has traction. Consistency matters more than size now.",
      tone: "green",
    };
  }

  return {
    title: "Still early",
    copy: "This goal needs stronger funding pace to feel real.",
    tone: "amber",
  };
}

export function nextMilestonePct(goal) {
  const progress = progressPercent(goal);
  const marks = [25, 50, 75, 100];
  return marks.find((mark) => progress < mark) ?? null;
}

export function resolvedGoalName(preset, customName) {
  if (preset && preset !== "Other") return preset;
  return String(customName || "").trim();
}

export function normalizeGoal(goal = {}) {
  return {
    id: goal.id || uid(),
    name: String(goal.name || "").trim(),
    target: Math.max(0, safeNum(goal.target, 0)),
    current: Math.max(0, safeNum(goal.current, 0)),
    dueDate: goal.dueDate || "",
    priority: goal.priority || "Medium",
    archived: !!goal.archived,
    createdAt: goal.createdAt ?? Date.now(),
    updatedAt: goal.updatedAt || new Date().toISOString(),
    contributions: Array.isArray(goal.contributions)
      ? goal.contributions.map(normalizeContribution)
      : [],
  };
}

export function normalizeImportedGoal(goal = {}) {
  return normalizeGoal({
    id: goal.id || uid(),
    name: String(goal.name || "").trim(),
    target: safeNum(goal.target, 0),
    current: safeNum(goal.current, 0),
    dueDate: goal.dueDate || "",
    priority: goal.priority || "Medium",
    archived: !!goal.archived,
    createdAt: goal.createdAt ?? Date.now(),
    updatedAt: new Date().toISOString(),
    contributions: Array.isArray(goal.contributions)
      ? goal.contributions.map(normalizeContribution)
      : [],
  });
}

export function mapGoalRow(row = {}) {
  return normalizeGoal({
    id: row.id,
    name: row.name,
    target: row.target_amount,
    current: row.current_amount,
    dueDate: row.target_date || "",
    priority: row.priority || "Medium",
    archived: !!row.archived,
    createdAt:
      row.created_at_ms ??
      (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
    contributions: Array.isArray(row.contributions) ? row.contributions : [],
  });
}

export function mapGoalToRow(goal, userId) {
  const normalized = normalizeGoal(goal);

  return {
    id: normalized.id,
    user_id: userId,
    name: normalized.name,
    target_amount: normalized.target,
    current_amount: normalized.current,
    target_date: normalized.dueDate || null,
    category: "general",
    notes: "",
    priority: normalized.priority,
    archived: normalized.archived,
    contributions: normalized.contributions,
    created_at_ms: normalized.createdAt,
    updated_at: new Date().toISOString(),
  };
}