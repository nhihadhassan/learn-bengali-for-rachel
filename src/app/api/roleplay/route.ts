import { isFeatureEnabled } from "@/lib/feature-flags";

// Scaffold for AI roleplay. Provider-agnostic: set AI_PROVIDER ("gemini" default,
// or "groq") and AI_API_KEY server-side. Stays behind FEATURES.aiRoleplay and
// degrades gracefully when disabled, unconfigured, or offline — so nothing here
// ever ships a broken experience or leaks a key to the browser.
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

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

  let body: { messages?: ChatMessage[]; scenario?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const messages = body.messages ?? [];
  const scenario = body.scenario ?? "ordering at a café";

  if (!apiKey) {
    // No provider configured — return a friendly demo line so the UI still works.
    return Response.json(
      { reply: "¡Hola! ¿Qué te gustaría pedir?", fallback: true },
      { status: 200 },
    );
  }

  try {
    const reply = await generateReply(provider, apiKey, scenario, messages);
    return Response.json({ reply });
  } catch {
    return Response.json(
      { reply: "Lo siento, no puedo responder ahora mismo.", fallback: true },
      { status: 200 },
    );
  }
}

async function generateReply(
  provider: string,
  apiKey: string,
  scenario: string,
  messages: ChatMessage[],
): Promise<string> {
  const system = `${SYSTEM_PROMPT} Scenario: ${scenario}.`;

  if (provider === "gemini") {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
        }),
      },
    );
    const data = await response.json();
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "…"
    );
  }

  // Groq (OpenAI-compatible) as a drop-in alternate.
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: system }, ...messages],
      }),
    },
  );
  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? "…";
}
