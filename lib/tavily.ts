export type TavilyResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
  images: string[];
};

export type TavilySearchResponse = {
  results: TavilyResult[];
  images: string[];
};

type TavilySearchOptions = {
  maxResults?: number;
  includeImages?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  searchDepth?: "basic" | "advanced";
  country?: string;
  timeoutMs?: number;
};

function asImageUrl(entry: unknown): string | undefined {
  if (typeof entry === "string" && /^https?:\/\//i.test(entry)) {
    return entry;
  }
  if (
    entry &&
    typeof entry === "object" &&
    "url" in entry &&
    typeof entry.url === "string" &&
    /^https?:\/\//i.test(entry.url)
  ) {
    return entry.url;
  }
  return undefined;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function tavilyErrorMessage(payload: unknown, status: number, action: string): string {
  if (payload && typeof payload === "object") {
    if (
      "detail" in payload &&
      payload.detail &&
      typeof payload.detail === "object" &&
      "error" in payload.detail &&
      typeof payload.detail.error === "string"
    ) {
      return payload.detail.error;
    }
    if ("error" in payload && typeof payload.error === "string") {
      return payload.error;
    }
  }
  return `${action} failed (${status}).`;
}

export function getTavilyApiKey(): string | undefined {
  const key = process.env.TAVILY_API_KEY?.trim();
  return key ? key : undefined;
}

export async function tavilySearch(
  query: string,
  options: TavilySearchOptions = {},
): Promise<TavilySearchResponse> {
  const apiKey = getTavilyApiKey();
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set.");
  }

  const timeoutMs = options.timeoutMs ?? 12_000;
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      max_results: options.maxResults ?? 8,
      include_images: options.includeImages ?? false,
      include_domains: options.includeDomains,
      exclude_domains: options.excludeDomains,
      search_depth: options.searchDepth ?? "basic",
      country: options.country,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(tavilyErrorMessage(payload, response.status, "Tavily search"));
  }

  const resultsRaw =
    payload &&
    typeof payload === "object" &&
    "results" in payload &&
    Array.isArray(payload.results)
      ? payload.results
      : [];

  const topImagesRaw =
    payload &&
    typeof payload === "object" &&
    "images" in payload &&
    Array.isArray(payload.images)
      ? payload.images
      : [];

  const results: TavilyResult[] = resultsRaw.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const url = asString("url" in item ? item.url : "");
    const title = asString("title" in item ? item.title : "");
    if (!url || !title) {
      return [];
    }
    const images = Array.isArray("images" in item ? item.images : null)
      ? (item.images as unknown[])
          .map(asImageUrl)
          .filter((image): image is string => Boolean(image))
      : [];
    return [
      {
        title,
        url,
        content: asString("content" in item ? item.content : ""),
        score: typeof ("score" in item ? item.score : undefined) === "number"
          ? item.score
          : undefined,
        publishedDate: asString(
          "published_date" in item ? item.published_date : "",
        ) || undefined,
        images,
      },
    ];
  });

  return {
    results,
    images: topImagesRaw
      .map(asImageUrl)
      .filter((image): image is string => Boolean(image)),
  };
}
