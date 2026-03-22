export const HELP_PAGE_GUIDES = [
  {
    key: "dashboard",
    label: "Dashboard",
    matchers: ["/", "/dashboard"],
    ui: [
      "summary cards",
      "recent activity",
      "due soon",
      "top-level totals",
      "account overview",
    ],
    purpose:
      "Help the user understand overall financial status, alerts, and where to go next.",
    quickPrompts: [
      "What am I looking at on this page?",
      "How do I read the summary cards?",
      "What should I check first?",
    ],
  },
  {
    key: "income",
    label: "Income",
    matchers: ["/income"],
    ui: [
      "income entries",
      "pay dates",
      "income totals",
      "income form",
      "pay schedule",
    ],
    purpose:
      "Help the user add income, understand pay timing, and review how income affects their month.",
    quickPrompts: [
      "How do I add a paycheck?",
      "How should I track bonus income?",
      "What is the best way to organize my pay entries?",
    ],
  },
  {
    key: "bills",
    label: "Bills",
    matchers: ["/bills"],
    ui: [
      "bill list",
      "due dates",
      "paid status",
      "monthly totals",
      "bill form",
    ],
    purpose:
      "Help the user manage due dates, mark bills paid, and keep monthly obligations organized.",
    quickPrompts: [
      "How do I mark a bill paid?",
      "How do I track recurring bills?",
      "What is the easiest way to organize due dates?",
    ],
  },
  {
    key: "spending",
    label: "Spending",
    matchers: ["/spending"],
    ui: [
      "transactions",
      "planned spending",
      "categories",
      "day details",
      "calendar/timeline view",
    ],
    purpose:
      "Help the user log spending, review categories, and understand what happened on a specific day.",
    quickPrompts: [
      "How do I add a spending entry?",
      "How do I review a specific day?",
      "What is the difference between planned and actual spending?",
    ],
  },
  {
    key: "calendar",
    label: "Calendar",
    matchers: ["/calendar"],
    ui: [
      "events",
      "paydays",
      "expense reminders",
      "day timeline",
      "notes",
    ],
    purpose:
      "Help the user manage date-based events like paydays, expenses, reminders, and notes.",
    quickPrompts: [
      "How do I add a payday?",
      "How do I review events for one day?",
      "How should I use this page with spending and bills?",
    ],
  },
  {
    key: "investments",
    label: "Investments",
    matchers: ["/investments"],
    ui: [
      "assets",
      "transactions",
      "positions",
      "cost basis",
      "portfolio totals",
    ],
    purpose:
      "Help the user track holdings, transactions, value changes, and portfolio summaries.",
    quickPrompts: [
      "How do I add a stock transaction?",
      "What does cost basis mean here?",
      "How should I track small positions?",
    ],
  },
  {
    key: "admin-users",
    label: "Admin / Users",
    matchers: ["/admin", "/users", "/activity"],
    ui: [
      "user cards",
      "View Activity modal",
      "Notes tab",
      "Audit tab",
      "Has Note badge",
      "Users With Notes stat",
      "Support Note Updates filter",
    ],
    purpose:
      "Help admins review user activity, manage support notes, and audit support note changes.",
    quickPrompts: [
      "How do I save a support note?",
      "Where do support notes show up?",
      "How do I filter support note updates in Audit?",
    ],
  },
];

export function getPageGuide(pathname = "/") {
  const normalized = String(pathname || "/").toLowerCase();

  const found = HELP_PAGE_GUIDES.find((guide) =>
    guide.matchers.some((matcher) => {
      if (matcher === "/") return normalized === "/";
      return normalized.startsWith(matcher.toLowerCase());
    })
  );

  return (
    found || {
      key: "general",
      label: "Life Command Center",
      ui: ["forms", "lists", "stats", "activity", "navigation"],
      purpose:
        "Help the user understand the current page and complete the task they are trying to do.",
      quickPrompts: [
        "How do I use this page?",
        "What does this section do?",
        "What should I do first here?",
      ],
    }
  );
}