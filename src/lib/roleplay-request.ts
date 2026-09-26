export type ChatMessage = { role: "user" | "assistant"; content: string };
export type RoleplayBody = { messages: ChatMessage[]; scenario: string };

const MAX_MESSAGES = 24;
const MAX_MESSAGE_LENGTH = 1_000;
const MAX_SCENARIO_LENGTH = 120;
const MAX_TOTAL_CHARACTERS = 24_000;

export function parseRoleplayBody(value: unknown): RoleplayBody | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;

  const candidate = value as { messages?: unknown; scenario?: unknown };
  const scenario = candidate.scenario ?? "ordering at a café";
  const messages = candidate.messages;

  if (
    typeof scenario !== "string" ||
    scenario.trim().length === 0 ||
    scenario.length > MAX_SCENARIO_LENGTH ||
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_MESSAGES
  ) {
    return;
  }

  let totalCharacters = scenario.length;
  const parsedMessages: ChatMessage[] = [];
  for (const message of messages) {
    if (
      !message ||
      typeof message !== "object" ||
      Array.isArray(message) ||
      !["user", "assistant"].includes((message as ChatMessage).role) ||
      typeof (message as ChatMessage).content !== "string" ||
      (message as ChatMessage).content.trim().length === 0 ||
      (message as ChatMessage).content.length > MAX_MESSAGE_LENGTH
    ) {
      return;
    }

    const parsed = message as ChatMessage;
    totalCharacters += parsed.content.length;
    if (totalCharacters > MAX_TOTAL_CHARACTERS) return;
    parsedMessages.push({ role: parsed.role, content: parsed.content });
  }

  return { messages: parsedMessages, scenario: scenario.trim() };
}
