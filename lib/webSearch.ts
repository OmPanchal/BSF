import { geminiGenerate, geminiGroundingLinks, getGeminiApiKey } from "@/lib/llm";
import { decodeEntities, toPence } from "@/lib/pagePrice";
import { getTavilyApiKey, tavilySearch } from "@/lib/tavily";

export type WebHit = {
  url: string;
  title: string;
  snippet?: string;
  source: "tavily" | "duckduckgo" | "gemini";
};

const LISTING_HOSTS = [
  "amazon.co.uk",
  "argos.co.uk",
  "johnlewis.com",
  "currys.co.uk",
  "very.co.uk",
  "ao.com",
];

function amazonAsin(text: string): string | undefined {
  const decoded = (() => {
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  })();
  return decoded.match(/(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/)([A-Z0-9]{10})/i)?.[1]?.toUpperCase();
}

function unwrapDuckUrl(raw: string): string {
  try {
    const href = raw.startsWith("//") ? `https:${raw}` : raw;
    const url = new URL(href, "https://html.duckduckgo.com/");
    const nested = url.searchParams.get("uddg") ?? url.searchParams.get("u");
    return nested ? decodeURIComponent(nested) : url.toString();
  } catch {
    return raw;
  }
}

export function normalizeListingUrl(raw: string): string | undefined {
  let href = unwrapDuckUrl(raw).split("#")[0] ?? "";
  try {
    href = decodeURIComponent(href);
  } catch {
    // Keep the raw href.
  }
  const asin = amazonAsin(href);
  if (asin) {
    return `https://www.amazon.co.uk/dp/${asin}`;
  }
  try {
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!LISTING_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
      return undefined;
    }
    if (host.endsWith("amazon.co.uk") || host.endsWith("amazon.com")) {
      return undefined;
    }
    if (host.endsWith("argos.co.uk") && !/\/product\/\d+/.test(url.pathname)) {
      return undefined;
    }
    if (host.endsWith("johnlewis.com") && !/\/p\d+\/?$/.test(url.pathname)) {
      return undefined;
    }
    if (host.endsWith("currys.co.uk") && !/\/products\//.test(url.pathname)) {
      return undefined;
    }
    if (host.endsWith("very.co.uk") && !/\/product\/|\.prd(?:\/|$)/.test(url.pathname)) {
      return undefined;
    }
    if (host.endsWith("ao.com") && !/\/product\//.test(url.pathname)) {
      return undefined;
    }
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

function collectUrls(text: string): string[] {
  return [...text.matchAll(/https?:\/\/[^\s"'<>]+/gi)].map((match) => match[0]);
}

async function searchDuckDuckGo(query: string): Promise<WebHit[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Accept: "text/html",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed (${response.status}).`);
  }
  const html = await response.text();
  const hits: WebHit[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const listing = normalizeListingUrl(decodeEntities(match[1] ?? ""));
    if (!listing || seen.has(listing)) continue;
    seen.add(listing);
    hits.push({
      url: listing,
      title: decodeEntities((match[2] ?? "").replace(/<[^>]+>/g, " ")),
      source: "duckduckgo",
    });
  }
  return hits;
}

async function searchGeminiWeb(query: string): Promise<WebHit[]> {
  if (!getGeminiApiKey()) {
    return [];
  }
  const payload = await geminiGenerate(
    {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "Find current UK retailer product pages for this shopping query.",
                "Prefer amazon.co.uk, argos.co.uk, johnlewis.com and currys.co.uk listing pages, not accessories unless asked.",
                `Query: ${query}`,
              ].join(" "),
            },
          ],
        },
      ],
      tools: [{ google_search: {} }],
    },
    18_000,
  );
  const hits: WebHit[] = [];
  const seen = new Set<string>();
  const add = (url: string, title: string) => {
    const listing = normalizeListingUrl(url);
    if (!listing || seen.has(listing)) return;
    seen.add(listing);
    hits.push({ url: listing, title: title || listing, source: "gemini" });
  };
  for (const link of geminiGroundingLinks(payload)) {
    add(link.url, link.title);
  }
  const text = JSON.stringify(payload);
  for (const url of collectUrls(text)) {
    add(url, "");
  }
  return hits;
}

async function searchTavilyWeb(query: string): Promise<WebHit[]> {
  if (!getTavilyApiKey()) {
    return [];
  }
  const hits: WebHit[] = [];
  const seen = new Set<string>();
  for (const q of [`${query} site:amazon.co.uk/dp`, `${query} buy UK amazon.co.uk`]) {
    const found = await tavilySearch(q, {
      maxResults: 10,
      country: "united kingdom",
      timeoutMs: 12_000,
    });
    for (const result of found.results) {
      const fromUrl = normalizeListingUrl(result.url);
      const extras = collectUrls(result.content).map(normalizeListingUrl);
      for (const listing of [fromUrl, ...extras]) {
        if (!listing || seen.has(listing)) continue;
        seen.add(listing);
        hits.push({
          url: listing,
          title: result.title.replace(/^Amazon\.co\.uk\s*:\s*/i, ""),
          snippet: result.content,
          source: "tavily",
        });
      }
    }
    if (hits.length > 0) break;
  }
  return hits;
}

export async function searchWebListings(query: string): Promise<{
  hits: WebHit[];
  counts: { tavily: number; duckduckgo: number; gemini: number };
}> {
  const [tavily, duckduckgo, gemini] = await Promise.allSettled([
    searchTavilyWeb(`${query} site:amazon.co.uk/dp`),
    searchDuckDuckGo(`${query} site:amazon.co.uk/dp`),
    searchGeminiWeb(query),
  ]);
  const tavilyHits = tavily.status === "fulfilled" ? tavily.value : [];
  const duckHits = duckduckgo.status === "fulfilled" ? duckduckgo.value : [];
  const geminiHits = gemini.status === "fulfilled" ? gemini.value : [];
  const hits: WebHit[] = [];
  const seen = new Set<string>();
  for (const hit of [...tavilyHits, ...duckHits, ...geminiHits]) {
    if (seen.has(hit.url)) continue;
    seen.add(hit.url);
    hits.push(hit);
  }
  return {
    hits,
    counts: {
      tavily: tavilyHits.length,
      duckduckgo: duckHits.length,
      gemini: geminiHits.length,
    },
  };
}

export function snippetPricePence(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const match = text.match(/£\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?/);
  return match ? toPence(match[0]) : undefined;
}
