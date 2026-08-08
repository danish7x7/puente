import Anthropic from "@anthropic-ai/sdk";

// The API key is read here, on the server, and nowhere else.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Puente, a warm and patient guide helping people who are not technical get started with AI. Always respond in the same language the user wrote in. Use zero jargon. Give exactly 3 tiny, concrete things they can do today, each doable in under 10 minutes and completely free. Be encouraging and specific to their situation. If a previous answer is provided, simplify it further using shorter sentences and everyday words.

Rules for the advice:
- Never name any specific AI product, company, or website. No brand names, no URLs. Refer generically to "an AI assistant" when relevant, and where it feels natural, remind them they can ask right here on this page, for example: "you can ask that right here, just type it in the box above".
- Not every step should be "ask an AI". Vary the three steps across different kinds of actions that fit the person's situation: one might be asking an AI assistant a specific question (give them the exact words to ask, in quotes, so they can copy them), one might use something they already have (their phone camera to photograph a confusing document and ask about it, dictating instead of typing, translating something they need), and one might be a small real-world action. Sound like a knowledgeable friend giving advice, not an advertisement.
- Only ever suggest things that are free.
- Never use emojis in any text.
- Never use em dashes in any output. Use commas or periods instead.

Respond with valid JSON only, no markdown, no code fences, no text before or after the JSON. Use exactly this shape:
{"title": string, "situation": string, "steps": [{"heading": string, "body": string}]}
Rules for the JSON:
- "title": a short, warm headline for their plan, like a friendly Monday-morning plan.
- "situation": one encouraging sentence that reflects their situation back to them.
- "steps": exactly 3 items. Each has a short heading (a few words) and a body of one or two plain sentences describing something they can do today.
- Everything in the same language as the user's message.`;

const MAX_MESSAGE_LENGTH = 2000;

// In-memory rate limit: max 10 requests per minute per IP.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT) {
    requestLog.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  // Keep the map from growing unbounded.
  if (requestLog.size > 10_000) {
    for (const [key, times] of requestLog) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) requestLog.delete(key);
    }
  }
  return false;
}

type Step = { heading: string; body: string };
type Card = { title: string; situation: string; steps: Step[] };

// Strip accidental markdown fences and any stray text around the JSON object.
function parseCard(raw: string): Card | null {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  text = text.slice(start, end + 1);

  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const { title, situation, steps } = parsed as Record<string, unknown>;
    if (typeof title !== "string" || typeof situation !== "string") return null;
    if (!Array.isArray(steps) || steps.length !== 3) return null;
    const cleanSteps: Step[] = [];
    for (const step of steps) {
      if (typeof step !== "object" || step === null) return null;
      const { heading, body } = step as Record<string, unknown>;
      if (typeof heading !== "string" || typeof body !== "string") return null;
      cleanSteps.push({ heading, body });
    }
    return { title, situation, steps: cleanSteps };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return Response.json(
      { error: "You're going a little fast. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "We couldn't read your message. Please try again." },
      { status: 400 },
    );
  }

  const { message, previousAnswer } = (body ?? {}) as {
    message?: unknown;
    previousAnswer?: unknown;
  };

  if (typeof message !== "string" || message.trim().length === 0) {
    return Response.json(
      { error: "Please write a few words about yourself first." },
      { status: 400 },
    );
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      {
        error:
          "That's a bit long for us to read in one go. Could you shorten it to under 2,000 characters?",
      },
      { status: 400 },
    );
  }

  if (previousAnswer !== undefined && typeof previousAnswer !== "string") {
    return Response.json(
      { error: "We couldn't read your message. Please try again." },
      { status: 400 },
    );
  }

  const userContent = previousAnswer
    ? `${message.trim()}\n\nHere is the previous answer you gave me:\n\n${previousAnswer}\n\nPlease simplify it further using shorter sentences and everyday words. Keep the exact same JSON shape.`
    : message.trim();

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const rawText = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!rawText) {
      return Response.json(
        { error: "Something didn't work on our side. Please try again in a moment." },
        { status: 502 },
      );
    }

    const card = parseCard(rawText);
    if (card) {
      return Response.json({ card });
    }
    // Parse failure: fall back to plain text so the user still gets an answer.
    return Response.json({ answer: rawText });
  } catch {
    // Never expose internal errors or configuration details to the client.
    return Response.json(
      { error: "Something didn't work on our side. Please try again in a moment." },
      { status: 502 },
    );
  }
}
