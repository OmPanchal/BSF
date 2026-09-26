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

export function getGeminiApiKey(): string | undefined {
  const key =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim();
  return key || undefined;
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
}

function geminiText(payload: unknown): string {
  if (!isJsonObject(payload) || !Array.isArray(payload.candidates)) {
    return "";
  }
  const content = isJsonObject(payload.candidates[0]) ? payload.candidates[0].content : undefined;
  if (!isJsonObject(content) || !Array.isArray(content.parts)) {
    return "";
  }
  return content.parts
    .map((part) => (isJsonObject(part) && typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

export function geminiGroundingLinks(payload: unknown): { url: string; title: string }[] {
  if (!isJsonObject(payload) || !Array.isArray(payload.candidates)) {
    return [];
  }
  const candidate = payload.candidates[0];
  if (!isJsonObject(candidate)) {
    return [];
  }
  const meta = candidate.groundingMetadata;
  if (!isJsonObject(meta) || !Array.isArray(meta.groundingChunks)) {
    return [];
  }
  const links: { url: string; title: string }[] = [];
  for (const chunk of meta.groundingChunks) {
    if (!isJsonObject(chunk) || !isJsonObject(chunk.web)) continue;
    const url = typeof chunk.web.uri === "string" ? chunk.web.uri : "";
    const title = typeof chunk.web.title === "string" ? chunk.web.title : "";
    if (url) links.push({ url, title: title || url });
  }
  return links;
}

async function geminiGenerateWithModel(
  body: Record<string, unknown>,
  model: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  const payload: unknown = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, payload };
}

const GEMINI_FALLBACKS = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
];

let liveModel = "";
let geminiActive = 0;
const geminiWaiters: Array<() => void> = [];

function acquireGemini(): Promise<void> {
  if (geminiActive < 2) {
    geminiActive += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    geminiWaiters.push(() => {
      geminiActive += 1;
      resolve();
    });
  });
}

function releaseGemini() {
  geminiActive -= 1;
  geminiWaiters.shift()?.();
}

function withoutThinking(body: Record<string, unknown>): Record<string, unknown> {
  if (!isJsonObject(body.generationConfig) || !("thinkingConfig" in body.generationConfig)) {
    return body;
  }
  const { thinkingConfig: _thinking, ...generationConfig } = body.generationConfig;
  return { ...body, generationConfig };
}

function geminiErrorMessage(payload: unknown, status: number): string {
  return isJsonObject(payload) &&
    isJsonObject(payload.error) &&
    typeof payload.error.message === "string"
    ? payload.error.message
    : `Gemini request failed (${status}).`;
}

function geminiRetryable(status: number, message: string): boolean {
  return (
    status === 404 ||
    status === 429 ||
    status === 503 ||
    /high demand|unavailable|no longer available|not found/i.test(message)
  );
}

async function callGemini(
  body: Record<string, unknown>,
  model: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; payload: unknown }> {
  await acquireGemini();
  try {
    return await geminiGenerateWithModel(body, model, timeoutMs);
  } finally {
    releaseGemini();
  }
}

export async function geminiGenerate(
  body: Record<string, unknown>,
  timeoutMs = 20_000,
): Promise<unknown> {
  const start = liveModel || geminiModel();
  const models = [start, ...GEMINI_FALLBACKS.filter((model) => model !== start)];
  let lastError = "Gemini request failed.";
  for (const model of models) {
    const requestBody = /lite/i.test(model) ? withoutThinking(body) : body;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await callGemini(requestBody, model, timeoutMs);
        if (result.ok) {
          liveModel = model;
          return result.payload;
        }
        lastError = geminiErrorMessage(result.payload, result.status);
        if (result.status === 400 && requestBody !== body) break;
        if (!geminiRetryable(result.status, lastError)) {
          if (result.status === 400 && requestBody === body) {
            const plain = await callGemini(withoutThinking(body), model, timeoutMs);
            if (plain.ok) {
              liveModel = model;
              return plain.payload;
            }
            lastError = geminiErrorMessage(plain.payload, plain.status);
          }
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Gemini request failed.";
        if (!/timeout|aborted|unavailable|high demand|fetch failed/i.test(lastError)) {
          throw error instanceof Error ? error : new Error(lastError);
        }
      }
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
    console.error(`[gemini] ${model} unavailable, trying the next model`);
  }
  throw new Error(lastError);
}

async function geminiJson(system: string, user: string): Promise<unknown> {
  const payload = await geminiGenerate({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
    },
  }, 8_000);
  const text = geminiText(payload);
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }
  return extractJson(text);
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
    getGeminiApiKey() || process.env.OPENAI_API_KEY?.trim() || process.env.XAI_API_KEY?.trim(),
  );
}

export async function completeJson(system: string, user: string): Promise<unknown> {
  if (getGeminiApiKey()) {
    return geminiJson(system, user);
  }

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
