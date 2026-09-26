type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

async function chatJson(
  url: string,
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isJsonObject(payload) &&
      isJsonObject(payload.error) &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : `LLM request failed (${response.status}).`;
    throw new Error(message);
  }

  const content =
    isJsonObject(payload) &&
    Array.isArray(payload.choices) &&
    isJsonObject(payload.choices[0]) &&
    isJsonObject(payload.choices[0].message) &&
    typeof payload.choices[0].message.content === "string"
      ? payload.choices[0].message.content
      : "";

  if (!content) {
    throw new Error("LLM returned an empty response.");
  }

  return extractJson(content);
}

export function hasLlmAccess(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() || process.env.XAI_API_KEY?.trim(),
  );
}

export async function completeJson(system: string, user: string): Promise<unknown> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    return chatJson(
      "https://api.openai.com/v1/chat/completions",
      openaiKey,
      process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      system,
      user,
    );
  }

  const xaiKey = process.env.XAI_API_KEY?.trim();
  if (xaiKey) {
    return chatJson(
      "https://api.x.ai/v1/chat/completions",
      xaiKey,
      process.env.XAI_MODEL?.trim() || "grok-3-mini",
      system,
      user,
    );
  }

  throw new Error("No LLM API key is configured.");
}
