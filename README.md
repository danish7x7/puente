# Puente

**Your bridge to AI.** Puente is a single-page app for people who are not technical and want to get started with AI. You describe your situation in plain words, in any language, and Puente replies with a warm, jargon-free plan: three tiny things you can try today, each free and doable in under 10 minutes. And if you ask for something concrete ("write a menu description for my chicken dish"), Puente just does it for you, right there.

*Puente* means "bridge" in Spanish. Everyone starts somewhere.

## Features

- **Plain-words input** with four persona chips (care worker, restaurant owner, city employee, retired) that pre-fill an editable starter sentence.
- **Two response modes**, decided automatically from your message:
  - **Plan**: when you describe your situation, you get a card with a warm title, a sentence reflecting your situation back, and three numbered steps rendered as readable rows.
  - **Answer**: when you ask for a concrete task (write, explain, translate, summarize), the work is actually done and shown as a simple card with a title and the finished text. No steps, no coaching.
- **"Ask this now"**: when a plan step suggests an exact question to ask an AI assistant (in quotes), a link copies it into the box above so you can ask immediately without leaving the page. Submitting it returns a real answer, not another plan.
- **"Explain it even simpler"**: re-asks with the previous answer so the reply comes back in shorter sentences and everyday words. Works on both modes and keeps the mode of what it is simplifying.
- **"Save this card"**: exports the answer card as a PNG (via html2canvas) to keep or share. Works for plans and answers.
- **Any language in, same language out.** Write in Spanish, get Spanish back.
- Calm monochrome design: white, near-black, grays, large readable type, reduced-motion friendly.

## Stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
- Tailwind CSS v4
- [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) calling Claude (`claude-sonnet-4-6`), server-side only
- html2canvas for the PNG export
- No database, no auth, no analytics, no external fonts

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root with your Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com)):

   ```bash
   ANTHROPIC_API_KEY=your-key-here
   ```

   `.env.local` is gitignored. The key is read in exactly one place, the server route handler, and never reaches the browser.

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## How it works

The page posts to a single route handler, `app/api/ask/route.ts`, with `{ message, previousAnswer? }`. The server:

- accepts POST only (anything else gets a 405),
- rejects empty messages and messages over 2,000 characters with friendly 400s,
- rate-limits to 10 requests per minute per IP in memory (friendly 429),
- asks Claude for JSON only, capped at 1,024 output tokens. The model first decides the mode:
  - **Plan**: `{ "type": "plan", "title", "situation", "steps": [{ "heading", "body", "icon" }] }` with exactly 3 steps. `icon` is one of a fixed enum (`chat`, `camera`, `pen`, `phone`, `list`, `idea`); it is validated and carried in the payload but not yet rendered.
  - **Answer**: `{ "type": "answer", "title", "body" }` where `body` is the completed work itself.
  - When a message contains both a situation and a direct request, ANSWER mode wins.
- strips accidental code fences, parses, and strictly validates whichever shape came back (an off-enum icon is defaulted rather than failing the card),
- falls back to plain-text display if parsing fails, and
- never exposes the API key, env vars, or internal errors to the client.

The advice rules ask Claude to never name AI products, companies, or websites, suggest only free things, vary the three plan steps (an exact question to ask, something you already have like your phone camera, a small real-world action), and avoid emojis and em dashes.

## Try it: 5 test cases

Paste any of these into the box (or tap a chip) and press **Show me where to start**. Then try **Explain it even simpler** and **Save this card**.

1. **The busy parent (English, plan mode)**
   > I'm a single parent with two kids in school. Between work and homework help I have no time, and everyone keeps talking about AI. What could it actually do for me?

   Expect: a plan card with three varied steps, at least one with an exact question in quotes and an "Ask this now" link.

2. **The Spanish-speaking shop owner (Spanish, plan mode)**
   > Tengo una tienda pequeña de ropa en mi barrio. Nunca he usado la inteligencia artificial y no sé si es para mí.

   Expect: the whole card comes back in Spanish, same warm tone, no jargon.

3. **The skeptical retiree (via chip, plus simplify)**
   Tap **"I'm retired"**, keep the pre-filled sentence, and submit.

   Expect: gentle, non-technical suggestions; try **Explain it even simpler** afterwards and watch the sentences get shorter while it stays a plan.

4. **The concrete task (answer mode)**
   > Write a short, warm menu description for a casual chicken dish.

   Expect: an answer card containing an actual ready-to-use menu description. No steps, no "you could ask an AI", just the finished text. Then click a plan's "Ask this now" link sometime and notice it also returns a real answer.

5. **The guardrails test (too long / empty)**
   Submit with the box empty, then paste a very long text (over 2,000 characters).

   Expect: friendly plain-language errors ("Please write a few words about yourself first." / a polite ask to shorten it), never a technical error. Submitting more than 10 times in a minute politely asks you to wait a moment.

## Scripts

```bash
npm run dev     # start the dev server
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```

## Notes

- The rate limit is in-memory and per-instance. It resets on restart and does not coordinate across serverless instances.
- The exported PNG excludes the "Ask this now" links (they would be dead in a static image).
- The card capture intentionally uses plain hex colors; html2canvas cannot parse the modern color functions (`color-mix`/`oklab`) that Tailwind v4 opacity modifiers generate, so avoid `/opacity` classes inside the card element.
