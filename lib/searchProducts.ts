import { createHash } from "crypto";
import { completeJson, hasLlmAccess } from "@/lib/llm";
import { fetchVerifiedListing, type VerifiedListing } from "@/lib/pagePrice";
import { tavilySearch, type TavilyResult } from "@/lib/tavily";
import type { Product } from "@/types/contracts";

const MERCHANT_HOSTS = [
  "amazon.co.uk",
  "www.amazon.co.uk",
  "argos.co.uk",
  "www.argos.co.uk",
  "johnlewis.com",
  "www.johnlewis.com",
  "currys.co.uk",
  "www.currys.co.uk",
  "very.co.uk",
  "www.very.co.uk",
  "ao.com",
  "www.ao.com",
  "richersounds.com",
  "www.richersounds.com",
  "apple.com",
  "www.apple.com",
];

const SKIP_HOST_SNIPPETS = [
  "reddit.com",
  "youtube.com",
  "youtu.be",
  "wikipedia.org",
  "rtings.com",
  "trustpilot.com",
];

const LISTICLE_HINT =
  /\b(best|top \d+|vs\.?|compared|round-?up|deals of)\b/i;

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isMerchantUrl(url: string): boolean {
  const host = hostnameOf(url);
  return MERCHANT_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

function looksLikeListing(result: TavilyResult): boolean {
  const host = hostnameOf(result.url);
  if (SKIP_HOST_SNIPPETS.some((skip) => host.includes(skip))) {
    return false;
  }
  let pathname = "";
  try {
    pathname = new URL(result.url).pathname.toLowerCase();
  } catch {
    return false;
  }
  if (
    pathname === "/s" ||
    pathname.startsWith("/s/") ||
    pathname === "/b" ||
    pathname.startsWith("/b/") ||
    pathname.startsWith("/gp/aw") ||
    pathname.startsWith("/stores/")
  ) {
    return false;
  }
  if (LISTICLE_HINT.test(result.title) && !isMerchantUrl(result.url)) {
    return false;
  }
  if (isMerchantUrl(result.url)) {
    return (
      /\/(?:dp|gp\/product|product)\//i.test(pathname) || pathname.includes("/p/")
    );
  }
  return /\/(?:dp|gp\/product|product)\//i.test(result.url);
}

function amazonAsin(url: string): string | undefined {
  const match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return match?.[1]?.toLowerCase();
}

export function productIdFromUrl(url: string): string {
  const asin = amazonAsin(url);
  if (asin) {
    return `amz-${asin}`;
  }
  return `web-${createHash("sha1").update(url).digest("hex").slice(0, 16)}`;
}

function canonicalMerchantUrl(url: string): string {
  const asin = amazonAsin(url);
  if (asin) {
    return `https://www.amazon.co.uk/dp/${asin.toUpperCase()}`;
  }
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function listingKey(url: string): string {
  const asin = amazonAsin(url);
  if (asin) {
    return `asin:${asin}`;
  }
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "").toLowerCase()}${parsed.pathname.replace(/\/$/, "").toLowerCase()}`;
  } catch {
    return url;
  }
}

export function parseBudgetPence(intent: string): number | undefined {
  const match = intent.match(
    /(?:under|below|max(?:imum)?|less than|up to)\s*£?\s*(\d{1,5})/i,
  );
  if (match) {
    return Number(match[1]) * 100;
  }
  return undefined;
}

function guessBrandAndName(title: string): { brand: string; name: string } {
  const cleaned = title
    .replace(/\s*[|–-]\s*(Amazon\.co\.uk|Argos|John Lewis|Currys).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(/\s+/);
  const brand = parts[0] ?? "Unknown";
  const name = (parts.slice(1, 8).join(" ") || cleaned).replace(/[\s,;:|–-]+$/, "");
  return { brand, name };
}

type ListingDraft = {
  canonicalUrl: string;
  title: string;
};

function collectDrafts(results: TavilyResult[]): ListingDraft[] {
  const seen = new Set<string>();
  const drafts: ListingDraft[] = [];
  for (const result of results) {
    if (!looksLikeListing(result)) {
      continue;
    }
    const canonicalUrl = canonicalMerchantUrl(result.url);
    const key = listingKey(canonicalUrl);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    drafts.push({ canonicalUrl, title: result.title });
    if (drafts.length >= 8) {
      break;
    }
  }
  return drafts;
}

function productFromListing(
  intent: string,
  draft: ListingDraft,
  listing: VerifiedListing,
): Product {
  const { brand, name } = guessBrandAndName(listing.title ?? draft.title);
  return {
    id: productIdFromUrl(draft.canonicalUrl),
    name,
    brand,
    pricePence: listing.pricePence,
    currency: "GBP",
    merchantUrl: draft.canonicalUrl,
    imageUrl: listing.imageUrl,
    merchantRating: listing.rating,
    merchantReviewCount: listing.reviewCount,
    category: intent.slice(0, 80),
    attributes: {
      sourceHost: hostnameOf(draft.canonicalUrl),
      listedFrom: "live_web_search",
      priceCheckedAt: listing.checkedAt,
    },
  };
}

async function verifiedProducts(
  intent: string,
  drafts: ListingDraft[],
): Promise<Product[]> {
  const listings = await Promise.all(
    drafts.map((draft) => fetchVerifiedListing(draft.canonicalUrl)),
  );
  return drafts.flatMap((draft, index) => {
    const listing = listings[index];
    return listing ? [productFromListing(intent, draft, listing)] : [];
  });
}

async function rankProducts(intent: string, products: Product[]): Promise<Product[]> {
  if (products.length <= 4 || !hasLlmAccess()) {
    return products.slice(0, 4);
  }

  try {
    const payload = await completeJson(
      "Pick up to 4 product IDs that best match the buyer intent. Do not change prices. Return JSON {\"ids\":[...]} using only provided ids.",
      JSON.stringify({
        intent,
        products: products.map((product) => ({
          id: product.id,
          brand: product.brand,
          name: product.name,
          pricePence: product.pricePence,
        })),
      }),
    );
    const ids =
      payload &&
      typeof payload === "object" &&
      "ids" in payload &&
      Array.isArray(payload.ids)
        ? payload.ids.filter((id: unknown): id is string => typeof id === "string")
        : [];
    const picked = ids
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is Product => Boolean(product));
    if (picked.length > 0) {
      return picked.slice(0, 4);
    }
  } catch {
    // Keep insertion order.
  }
  return products.slice(0, 4);
}

function dedupeProducts(products: Product[]): Product[] {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) {
      return false;
    }
    seen.add(product.id);
    return true;
  });
}

export async function searchProductsLive(intent: string): Promise<Product[]> {
  const settled = await Promise.allSettled([
    tavilySearch(`${intent} buy UK price`, {
      maxResults: 8,
      country: "united kingdom",
      excludeDomains: [
        "reddit.com",
        "youtube.com",
        "wikipedia.org",
        "facebook.com",
        "pinterest.com",
      ],
      timeoutMs: 14_000,
    }),
    // Tavily returns no results when `country` is combined with `includeDomains`.
    tavilySearch(`${intent} UK price`, {
      maxResults: 10,
      includeDomains: ["amazon.co.uk"],
      timeoutMs: 14_000,
    }),
    tavilySearch(intent, {
      maxResults: 10,
      includeDomains: ["amazon.co.uk"],
      timeoutMs: 14_000,
    }),
  ]);

  const results: TavilyResult[] = [];
  for (const item of settled) {
    if (item.status === "fulfilled") {
      results.push(...item.value.results);
    }
  }

  if (results.length === 0) {
    const failed = settled.find((item) => item.status === "rejected");
    if (failed && failed.status === "rejected") {
      throw failed.reason instanceof Error
        ? failed.reason
        : new Error("Live product search returned no results.");
    }
    return [];
  }

  const drafts = collectDrafts(results);
  const verified = await verifiedProducts(intent, drafts);
  const budget = parseBudgetPence(intent);
  const inBudget =
    budget === undefined
      ? verified
      : verified.filter((product) => product.pricePence <= budget);

  return rankProducts(intent, dedupeProducts(inBudget));
}
