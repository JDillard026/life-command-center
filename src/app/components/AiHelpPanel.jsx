"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getPageGuide } from "@/lib/ai-help/page-guides";

function starterMessage(guide) {
  return {
    role: "assistant",
    content: `You're on ${guide.label}. Ask me how this page works, what to do next, or how to complete something here.`,
  };
}

export default function AiHelpPanel() {
  const pathname = usePathname();
  const guide = useMemo(() => getPageGuide(pathname), [pathname]);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([starterMessage(guide)]);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    setMessages((prev) => {
      const hasRealConversation = prev.some((m) => m.role === "user");

      if (!hasRealConversation) {
        return [starterMessage(guide)];
      }

      const alreadyNoted =
        prev[prev.length - 1]?.meta === "page-change" &&
        prev[prev.length - 1]?.pageKey === guide.key;

      if (alreadyNoted) return prev;

      return [
        ...prev,
        {
          role: "assistant",
          content: `You're now on ${guide.label}. I can help with this page too.`,
          meta: "page-change",
          pageKey: guide.key,
        },
      ];
    });
  }, [guide]);

  async function sendMessage(text) {
    const cleaned = String(text || "").trim();
    if (!cleaned || loading) return;

    const nextUserMessage = { role: "user", content: cleaned };
    const nextMessages = [...messages, nextUserMessage];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: cleaned,
          pathname,
          history: nextMessages,
        }),
      });

      const raw = await res.text();

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`API returned non-JSON: ${raw.slice(0, 180)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || "AI help request failed.");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data?.answer ||
            "I couldn't give a useful answer there. Try rewording it.",
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error?.message ||
            "Something went wrong. Check your API route and key.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  async function summarizeForSupport() {
    if (loading) return;

    await sendMessage(
      "Summarize my current issue for support in 3 short bullet points so I can paste it into a support note."
    );
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[40] rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-white/16"
        >
          Help AI
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-[70]">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/45"
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-white/10 bg-[#07101a]/95 text-white shadow-2xl backdrop-blur-2xl">
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="border-b border-white/10 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                      AI Help
                    </div>
                    <h3 className="mt-1 text-lg font-semibold">
                      {guide.label}
                    </h3>
                    <p className="mt-1 text-sm text-white/60">
                      Guided help for the page you are on.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {guide.quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-400/16"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-3">
                  {messages.map((message, index) => {
                    const isUser = message.role === "user";

                    return (
                      <div
                        key={`${message.role}-${index}-${message.content.slice(
                          0,
                          20
                        )}`}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={[
                            "max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-[0_10px_30px_rgba(0,0,0,0.22)]",
                            isUser
                              ? "border border-cyan-400/25 bg-cyan-400/18 text-white"
                              : "border border-white/10 bg-white/8 text-white/90",
                          ].join(" ")}
                        >
                          {message.content}
                        </div>
                      </div>
                    );
                  })}

                  {loading && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white/65">
                        Thinking…
                      </div>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>
              </div>

              {/* Input */}
              <div className="border-t border-white/10 px-4 py-4">
                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={summarizeForSupport}
                    className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-400/16"
                  >
                    Summarize for Support
                  </button>

                  <button
                    type="button"
                    onClick={() => setMessages([starterMessage(guide)])}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10"
                  >
                    Reset Chat
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Ask about ${guide.label.toLowerCase()}...`}
                    className="flex-1 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-cyan-400/40 focus:bg-white/10"
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="rounded-2xl border border-cyan-400/25 bg-cyan-400/18 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-400/24 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Send
                  </button>
                </form>

                <p className="mt-3 text-[11px] leading-5 text-white/40">
                  This panel is for guided help. If something looks broken or data
                  is wrong, the user may still need support/admin help.
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}