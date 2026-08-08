"use client";

import { useRef, useState } from "react";

const FALLBACK_ERROR =
  "Something didn't work on our side. Please try again in a moment.";

type Step = { heading: string; body: string; icon?: string };
type PlanCard = {
  type: "plan";
  title: string;
  situation: string;
  steps: Step[];
};
type AnswerCard = { type: "answer"; title: string; body: string };
type Card = PlanCard | AnswerCard;
type Result = { card: Card } | { answer: string };

const PERSONAS: { label: string; starter: string }[] = [
  {
    label: "I'm a care worker",
    starter:
      "I'm a care worker and my days are busy looking after people. I've never really used AI and I'd love to know where to start.",
  },
  {
    label: "I run a restaurant",
    starter:
      "I run a small restaurant. Between orders, staff and suppliers I have very little time. What could AI do for me?",
  },
  {
    label: "I work for the city",
    starter:
      "I work for the city, mostly with paperwork and residents' questions. I'm curious what AI could help me with.",
  },
  {
    label: "I'm retired",
    starter:
      "I'm retired and I keep hearing about AI. I'd like to try it for everyday things, but I don't know where to begin.",
  },
];

// Find a suggested question inside straight, curly, or guillemet quotes.
function extractQuestion(body: string): string | null {
  const match = body.match(
    /"([^"\n]{4,})"|“([^”\n]{4,})”|«([^»\n]{4,})»/,
  );
  return match ? (match[1] ?? match[2] ?? match[3] ?? null) : null;
}

export default function Home() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  async function ask(previousAnswer?: string) {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          previousAnswer ? { message, previousAnswer } : { message },
        ),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || (!data?.card && !data?.answer)) {
        setError(typeof data?.error === "string" ? data.error : FALLBACK_ERROR);
        return;
      }

      setResult(data.card ? { card: data.card } : { answer: data.answer });
    } catch {
      setError(
        "We couldn't reach our helper. Check your internet connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length === 0) {
      setError("Please write a few words about yourself first.");
      return;
    }
    setResult(null);
    ask();
  }

  function simplify() {
    if (!result) return;
    const previous =
      "card" in result ? JSON.stringify(result.card) : result.answer;
    ask(previous);
  }

  function pickPersona(starter: string) {
    setMessage(starter);
    textareaRef.current?.focus();
  }

  function askThisNow(question: string) {
    setMessage(question);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    textareaRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
    textareaRef.current?.focus({ preventScroll: true });
  }

  async function saveCard() {
    if (!cardRef.current || saving) return;
    setSaving(true);
    setError(null);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = "puente-plan.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      setError(
        "We couldn't save the card as an image. You can take a screenshot instead.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 sm:px-8 py-14 sm:py-20 flex flex-col gap-14">
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="font-serif text-4xl tracking-wide">Puente</p>
        <p className="text-base text-ink-soft tracking-widest uppercase">
          Your bridge to AI
        </p>
      </header>

      <section className="flex flex-col gap-5 text-center sm:text-left">
        <h1 className="font-serif text-[2.75rem] leading-[1.08] sm:text-6xl md:text-7xl text-balance">
          AI can help you too. Let&rsquo;s start small.
        </h1>
        <p className="text-[1.375rem] sm:text-2xl text-ink-soft leading-relaxed">
          Tell us a little about yourself, in any language. We&rsquo;ll suggest
          three tiny things you can try today.
        </p>
      </section>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div
          className="flex flex-wrap justify-center sm:justify-start gap-3"
          role="group"
          aria-label="Choose a starting point"
        >
          {PERSONAS.map((persona) => (
            <button
              key={persona.label}
              type="button"
              onClick={() => pickPersona(persona.starter)}
              className="rounded-full border border-line bg-white px-5 py-2.5 text-lg font-medium text-ink transition-colors duration-150 hover:border-ink hover:bg-ink hover:text-white active:border-ink active:bg-ink active:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
            >
              {persona.label}
            </button>
          ))}
        </div>

        <label htmlFor="situation" className="sr-only">
          Describe your situation in your own words
        </label>
        <textarea
          ref={textareaRef}
          id="situation"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          rows={7}
          placeholder="For example: I run a small bakery and I've never used AI. I'm not sure where to begin…"
          className="w-full rounded-2xl border border-line bg-white p-6 text-xl leading-relaxed placeholder:text-ink-soft/70 shadow-[inset_0_2px_6px_rgba(0,0,0,0.04)] transition-colors duration-150 focus:outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/15 resize-y"
        />
        <button
          type="submit"
          disabled={loading}
          className="self-center sm:self-start rounded-full bg-ink px-10 py-4 text-xl font-medium text-white transition-colors duration-150 hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {loading ? "Thinking…" : "Show me where to start"}
        </button>
      </form>

      <section aria-live="polite" className="flex flex-col gap-6">
        {loading && (
          <div className="flex items-center gap-3 text-ink-soft text-xl">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-ink-soft motion-safe:animate-pulse" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink-soft motion-safe:animate-pulse motion-safe:[animation-delay:200ms]" />
              <span className="h-2.5 w-2.5 rounded-full bg-ink-soft motion-safe:animate-pulse motion-safe:[animation-delay:400ms]" />
            </span>
            Putting together some ideas for you…
          </div>
        )}

        {error && !loading && (
          <p className="rounded-2xl border border-ink px-6 py-5 text-xl leading-relaxed">
            {error}
          </p>
        )}

        {result && !loading && (
          <div className="flex flex-col gap-6 motion-safe:animate-fade-up">
            {"card" in result ? (
              /* Captured by html2canvas — keep colors as plain hex tokens here. */
              <div
                ref={cardRef}
                className="rounded-3xl border border-line bg-white p-6 sm:p-10 flex flex-col gap-8"
              >
                <div className="flex flex-col gap-3 text-center sm:text-left">
                  <h2 className="font-serif text-3xl sm:text-4xl text-balance">
                    {result.card.title}
                  </h2>
                  {result.card.type === "plan" && (
                    <p className="text-xl text-ink-soft leading-relaxed">
                      {result.card.situation}
                    </p>
                  )}
                </div>
                {result.card.type === "answer" ? (
                  <p className="max-w-[65ch] text-xl leading-relaxed whitespace-pre-wrap">
                    {result.card.body}
                  </p>
                ) : (
                <ol className="flex flex-col divide-y divide-line">
                  {result.card.steps.map((step, i) => {
                    const question = extractQuestion(step.body);
                    return (
                      <li key={i} className="flex gap-4 sm:gap-5 py-6 first:pt-0 last:pb-0">
                        <span
                          aria-hidden="true"
                          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-base font-semibold text-white"
                        >
                          {i + 1}
                        </span>
                        <div className="flex flex-col gap-2 max-w-[65ch]">
                          <h3 className="text-[1.375rem] font-semibold leading-snug">
                            {step.heading}
                          </h3>
                          <p className="text-xl text-ink-soft leading-relaxed">
                            {step.body}
                          </p>
                          {question && (
                            <button
                              type="button"
                              data-html2canvas-ignore
                              onClick={() => askThisNow(question)}
                              className="self-start text-lg font-medium underline underline-offset-4 transition-colors duration-150 hover:text-ink-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                            >
                              Ask this now
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-line bg-white px-6 py-6 text-xl leading-relaxed whitespace-pre-wrap">
                {result.answer}
              </div>
            )}

            <div className="flex flex-wrap justify-center sm:justify-start gap-3">
              <button
                type="button"
                onClick={simplify}
                className="rounded-full border border-ink bg-white px-8 py-4 text-xl font-medium text-ink transition-colors duration-150 hover:bg-ink hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                Explain it even simpler
              </button>
              {"card" in result && (
                <button
                  type="button"
                  onClick={saveCard}
                  disabled={saving}
                  className="rounded-full border border-ink bg-white px-8 py-4 text-xl font-medium text-ink transition-colors duration-150 hover:bg-ink hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save this card"}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <footer className="mt-auto pt-10 text-center sm:text-left text-lg text-ink-soft">
        Puente means &ldquo;bridge&rdquo;. Everyone starts somewhere.
      </footer>
    </main>
  );
}
