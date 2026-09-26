const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

export type VerifiedListing = {
  pricePence: number;
  checkedAt: string;
  title?: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
};

function toPence(raw: string): number | undefined {
  const match = raw.replace(/,/g, "").match(/(\d+)(?:\.(\d{1,2}))?/);
  if (!match) {
    return undefined;
  }
  const pounds = Number(match[1]);
  const pence = match[2] ? Number(match[2].padEnd(2, "0")) : 0;
  if (!Number.isFinite(pounds) || pounds <= 0 || pounds > 100_000) {
    return undefined;
  }
  return pounds * 100 + pence;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&pound;|&#163;/g, "£")
    .replace(/\s+/g, " ")
    .trim();
}

function amazonBuyboxPence(html: string): number | undefined {
  const start = html.indexOf('"desktop_buybox_group_1"');
  if (start === -1) {
    return undefined;
  }
  const match = html
    .slice(start, start + 2_000)
    .match(/"priceAmount"\s*:\s*([\d.]+)\s*,\s*"currencySymbol"\s*:\s*"([^"]+)"/);
  if (!match || decodeEntities(match[2]) !== "£") {
    return undefined;
  }
  return toPence(match[1]);
}

function amazonCorePricePence(html: string): number | undefined {
  const start = html.search(/id="corePrice(?:Display_desktop)?_feature_div"/);
  if (start === -1) {
    return undefined;
  }
  const match = html
    .slice(start, start + 4_000)
    .match(/class="a-offscreen">\s*([^<]+?)\s*</);
  if (!match) {
    return undefined;
  }
  const text = decodeEntities(match[1]);
  return text.startsWith("£") ? toPence(text) : undefined;
}

function parseAmazon(html: string): Omit<VerifiedListing, "checkedAt"> | undefined {
  const buybox = amazonBuyboxPence(html);
  const core = amazonCorePricePence(html);
  const pricePence = buybox ?? core;
  if (pricePence === undefined) {
    return undefined;
  }
  // Two independent price elements on the page must agree.
  if (buybox !== undefined && core !== undefined && buybox !== core) {
    return undefined;
  }

  const title = html.match(/id="productTitle"[^>]*>([^<]+)</)?.[1];
  const imageUrl =
    html.match(/data-old-hires="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/)?.[1] ??
    html.match(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/)?.[1];
  const ratingText = html.match(
    /id="acrPopover"[^>]*title="(\d(?:\.\d)?) out of 5 stars"/,
  )?.[1];
  const reviewText = html.match(
    /id="acrCustomerReviewText"[^>]*>\s*\(?([\d,]+)/,
  )?.[1];

  return {
    pricePence,
    title: title ? decodeEntities(title) : undefined,
    imageUrl,
    rating: ratingText ? Number(ratingText) : undefined,
    reviewCount: reviewText ? Number(reviewText.replace(/,/g, "")) : undefined,
  };
}

function jsonLdGbpPence(node: unknown, depth = 0): number | undefined {
  if (depth > 8 || !node || typeof node !== "object") {
    return undefined;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = jsonLdGbpPence(item, depth + 1);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
  const obj = node as Record<string, unknown>;
  const currency = String(obj.priceCurrency ?? "").toUpperCase();
  const price = obj.price ?? obj.lowPrice;
  if (currency === "GBP" && (typeof price === "string" || typeof price === "number")) {
    return toPence(String(price));
  }
  for (const value of Object.values(obj)) {
    const found = jsonLdGbpPence(value, depth + 1);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

function parseGeneric(html: string): Omit<VerifiedListing, "checkedAt"> | undefined {
  const prices = new Set<number>();
  for (const match of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const pence = jsonLdGbpPence(JSON.parse(match[1]));
      if (pence !== undefined) {
        prices.add(pence);
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  // Multiple different structured prices means we can't tell which is the offer.
  if (prices.size !== 1) {
    return undefined;
  }
  const imageUrl = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  )?.[1];
  const title = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  )?.[1];
  return {
    pricePence: [...prices][0],
    imageUrl,
    title: title ? decodeEntities(title) : undefined,
  };
}

export async function fetchVerifiedListing(
  url: string,
  timeoutMs = 15_000,
): Promise<VerifiedListing | undefined> {
  let html: string;
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return undefined;
    }
    html = await response.text();
  } catch {
    return undefined;
  }

  if (/captcha|automated access/i.test(html.slice(0, 20_000)) && html.length < 50_000) {
    return undefined;
  }

  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();

  const parsed = host.endsWith("amazon.co.uk") ? parseAmazon(html) : parseGeneric(html);
  return parsed ? { ...parsed, checkedAt: new Date().toISOString() } : undefined;
}
