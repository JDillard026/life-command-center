import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getPageGuide } from "@/lib/ai-help/page-guides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toHistoryText(history = []) {
  return history
    .slice(-8)
    .map((item) => {
      const role = item?.role === "assistant" ? "ASSISTANT" : "USER";
      const content = String(item?.content || "").trim();
      if (!content) return null;
      return `${role}: ${content}`;
    })
    .filter(Boolean)
    .join("\n");
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "ai-help",
    hasKey: !!process.env.OPENAI_API_KEY,
  });
}

export async function POST(req) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY on the server." },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey });

    const body = await req.json();
    const message = String(body?.message || "").trim();
    const pathname = String(body?.pathname || "/");
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const guide = getPageGuide(pathname);

    const prompt = `
CURRENT PAGE: ${guide.label}
PATHNAME: ${pathname}

PAGE PURPOSE:
${guide.purpose}

KNOWN UI ON THIS PAGE:
${guide.ui.map((item) => `- ${item}`).join("\n")}

RECENT CHAT:
${toHistoryText(history)}

LATEST USER QUESTION:
${message}
    `.trim();

    const response = await client.responses.create({
      model: "gpt-5.4",
      instructions: `
You are the in-app help assistant for Life Command Center.

Your job:
- Help users understand the page they are on.
- Give short, practical answers.
- Prefer 2-5 steps when explaining actions.
- Stay grounded to the UI described in the prompt.
- If you are unsure, say that clearly.
- Do not invent buttons, tabs, or features that were not listed.
- If the problem sounds like a real bug, data issue, or admin-only issue, say they may need support/admin help.
- Keep the tone clear, direct, and helpful.
- Keep answers under 180 words unless the user explicitly asks for more.
      `.trim(),
      input: prompt,
    });

    const answer =
      String(response.output_text || "").trim() ||
      "I couldn't generate a useful help reply for that.";

    return NextResponse.json({
      answer,
      page: {
        key: guide.key,
        label: guide.label,
        quickPrompts: guide.quickPrompts,
      },
    });
  } catch (error) {
    console.error("AI help error:", error);

    return NextResponse.json(
      {
        error: error?.message || "AI help failed. Check server logs.",
      },
      { status: 500 }
    );
  }
}