import { NextResponse } from "next/server";
import { getPageGuide } from "@/lib/ai-help/page-guides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(text) {
  return String(text || "").trim().toLowerCase();
}

function includesAny(text, terms = []) {
  return terms.some((term) => text.includes(term));
}

function answerByPage(guide, message) {
  const q = clean(message);

  if (includesAny(q, ["purpose", "what is this page", "what am i looking at", "what does this page do"])) {
    return `${guide.label} is for ${guide.purpose.charAt(0).toLowerCase()}${guide.purpose.slice(1)} Main things on this page: ${guide.ui.slice(0, 5).join(", ")}.`;
  }

  if (includesAny(q, ["what should i check first", "where do i start", "what do i do next"])) {
    if (guide.key === "dashboard") {
      return "Start with the summary cards, then check recent activity and anything due soon. After that, go to the page that needs action first: bills for due dates, spending for recent purchases, or income if pay entries are missing.";
    }

    if (guide.key === "calendar") {
      return "Start by clicking the day you care about, review the timeline or event list for that day, then add or update paydays, reminders, or notes that affect your week.";
    }

    if (guide.key === "spending") {
      return "Start by reviewing today's or this week's entries, check category totals, then fix anything missing or incorrectly planned versus actual.";
    }

    if (guide.key === "bills") {
      return "Start with the next due bills, confirm paid status, then clean up recurring items and due dates so the month stays accurate.";
    }

    return `Start with the main list or summary section on ${guide.label}, then update the item that is most urgent.`;
  }

  if (guide.key === "dashboard") {
    if (includesAny(q, ["summary card", "summary cards", "read the summary"])) {
      return "The summary cards are your top-level snapshot. Read them as: overall totals first, then pressure points like due soon, recent activity, and account-level changes. This page is meant to tell you where attention is needed, not replace the detail pages.";
    }
  }

  if (guide.key === "calendar") {
    if (includesAny(q, ["add a payday", "add payday", "payday"])) {
      return "Use Calendar to create a dated event for the payday, then label it clearly so it stands out from reminders and expenses. Keep paydays clean and consistent so the page works as a timeline, not a cluttered note dump.";
    }

    if (includesAny(q, ["review events for one day", "review one day", "events for a day", "day"])) {
      return "Open the specific day and use the day breakdown or timeline view. The goal is to see every event tied to that date in one place instead of scanning the whole month.";
    }

    if (includesAny(q, ["spending and bills", "use this with spending", "use this with bills"])) {
      return "Use Calendar for date-based planning, Spending for what actually got spent, and Bills for recurring obligations. Calendar should help you see timing; the other pages hold the money details.";
    }
  }

  if (guide.key === "income") {
    if (includesAny(q, ["add a paycheck", "add paycheck", "paycheck"])) {
      return "Add the paycheck as an income entry with the correct date, amount, and source. Keep regular pay consistent so your monthly totals stay clean.";
    }

    if (includesAny(q, ["bonus", "extra income"])) {
      return "Track bonus or one-off income separately from normal pay so your regular income pattern stays easy to read.";
    }
  }

  if (guide.key === "bills") {
    if (includesAny(q, ["mark a bill paid", "mark bill paid", "paid"])) {
      return "Open the bill entry, update its paid status, and make sure the paid date is correct if your page supports it. The point is to separate due items from completed ones fast.";
    }

    if (includesAny(q, ["recurring"])) {
      return "Use recurring bills for anything that repeats monthly or on a predictable cycle. Keep names, due dates, and amounts consistent so the list stays easy to scan.";
    }

    if (includesAny(q, ["organize due dates", "due dates"])) {
      return "Keep bills ordered by due date and focus on the next ones first. That page should answer one question fast: what is due next and what is already handled.";
    }
  }

  if (guide.key === "spending") {
    if (includesAny(q, ["add a spending entry", "add spending", "log spending"])) {
      return "Add the purchase with the correct date, amount, and category. Keep categories tight so the page shows patterns instead of random clutter.";
    }

    if (includesAny(q, ["planned and actual", "planned vs actual"])) {
      return "Planned spending is what you expected to happen. Actual spending is what really happened. Use the difference to spot misses, overspending, or timing issues.";
    }

    if (includesAny(q, ["review a specific day", "specific day", "one day"])) {
      return "Open that day and review the detailed entries there instead of scanning the full month. That is the cleanest way to understand what happened on that date.";
    }
  }

  if (guide.key === "investments") {
    if (includesAny(q, ["stock transaction", "add transaction", "buy stock", "sell stock"])) {
      return "Add each buy or sell with the right date, shares, and price. Clean transaction history matters more than fancy charts.";
    }

    if (includesAny(q, ["cost basis"])) {
      return "Cost basis is the effective amount you paid for the position. It helps you compare current value against what you actually put in.";
    }
  }

  if (guide.key === "admin-users") {
    if (includesAny(q, ["save a support note", "support note", "save note"])) {
      return "Open View Activity for the user, go to the Notes area, type the note, and save it. That note should then flow into the user profile, note badges, and audit history if your admin wiring is working.";
    }

    if (includesAny(q, ["where do support notes show up", "where do notes show up", "show up"])) {
      return "Support notes should show up in the user profile, the Has Note badge on cards, the Users With Notes stat, the Notes tab in activity, and the Audit tab under Support Note Updates.";
    }

    if (includesAny(q, ["filter support note updates", "audit tab", "support note updates"])) {
      return "Open the Audit tab and filter by Support Note Updates. That view should isolate note-related changes so admins can review who changed what.";
    }
  }

  if (includesAny(q, ["support", "summarize", "issue"])) {
    return "Support summary: 1. State the page you were on. 2. State exactly what you tried to do. 3. State what happened instead of the expected result.";
  }

  return `${guide.label} is mainly for ${guide.purpose.charAt(0).toLowerCase()}${guide.purpose.slice(1)} Ask about a specific action on this page, like adding something, reviewing something, or what to check first.`;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "ai-help",
    mode: "local-fallback",
    requiresOpenAI: false,
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const message = String(body?.message || "").trim();
    const pathname = String(body?.pathname || "/");

    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const guide = getPageGuide(pathname);
    const answer = answerByPage(guide, message);

    return NextResponse.json({
      answer,
      page: {
        key: guide.key,
        label: guide.label,
        quickPrompts: guide.quickPrompts,
      },
    });
  } catch (error) {
    console.error("AI help local fallback error:", error);

    return NextResponse.json(
      {
        error: "Local help failed.",
      },
      { status: 500 }
    );
  }
}