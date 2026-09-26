import { isFeatureEnabled } from "@/lib/feature-flags";
import { parseRoleplayBody, type ChatMessage } from "@/lib/roleplay-request";

// Scaffold for AI roleplay. Provider-agnostic: set AI_PROVIDER ("gemini" default,
// or "groq") and AI_API_KEY server-side. Stays behind FEATURES.aiRoleplay and
// degrades gracefully when disabled, unconfigured, or offline — so nothing here
// ever ships a broken experience or leaks a key to the browser.
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 24_000;
const MAX_MESSAGE_LENGTH = 1_000;
const PROVIDER_TIMEOUT_MS = 12_000;

const SYSTEM_PROMPT =
  "You are a warm Spanish tutor roleplaying a short everyday scenario for a " +
  "beginner. Stay in character, speak mostly in simple Spanish, keep replies to " +
  "one or two short sentences, gently help if the learner is stuck, and never " +
  "break character or grade harshly.";

export async function POST(request: Request) {
  if (!isFeatureEnabled("aiRoleplay")) {
    return Response.json(
      { reply: "Roleplay isn't available yet.", fallback: true },
      { status: 200 },
    );
  }

  const apiKey = process.env.AI_API_KEY;
  const provider = process.env.AI_PROVIDER ?? "gemini";

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Request is too large." }, { status: 413 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const body = parseRoleplayBody(rawBody);
  if (!body) {
    return Response.json({ error: "Invalid roleplay conversation." }, { status: 400 });
  }

  const { messages, scenario } = body;

  if (!apiKey) {
    // No provider configured — return a friendly demo line so the UI still works.
    return Response.json(
      { reply: "¡Hola! ¿Qué te gustaría pedir?", fallback: true },
      { status: 200 },
    );
  }

  try {
    const reply = await generateReply(provider, apiKey, scenario, messages);
    return Response.json({ reply: limitReply(reply) });
  } catch {
    return Response.json(
      { error: "The roleplay provider is temporarily unavailable." },
      { status: 502 },
    );
  }
}

function limitReply(reply: string): string {
  return reply.slice(0, MAX_MESSAGE_LENGTH);
}

async function generateReply(
  provider: string,
  apiKey: string,
  scenario: string,
  messages: ChatMessage[],
): Promise<string> {
  const system = `${SYSTEM_PROMPT} Scenario: ${scenario}.`;
  const signal = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);

  if (provider === "gemini") {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
        }),
      },
    );
    if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`);
    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("Gemini returned no reply.");
    }
    return reply;
  }

  if (provider !== "groq") throw new Error("Unsupported roleplay provider.");

  // Groq (OpenAI-compatible) as a drop-in alternate.
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: system }, ...messages],
      }),
    },
  );
  if (!response.ok) throw new Error(`Groq request failed: ${response.status}`);
  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("Groq returned no reply.");
  }
  return reply;
}
