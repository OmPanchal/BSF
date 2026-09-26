import zlib from "node:zlib";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

const cookieJar = new Map<string, Map<string, string>>();

export function clearMerchantCookies(host: string) {
  cookieJar.delete(host.replace(/^www\./, "").toLowerCase());
}

function cookieHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function requestHeaders(url: string): Record<string, string> {
  const headers: Record<string, string> = { ...BROWSER_HEADERS };
  const cookies = cookieJar.get(cookieHost(url));
  if (cookies && cookies.size > 0) {
    headers.Cookie = [...cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
  return headers;
}

function rememberCookies(url: string, setCookie: string | string[] | undefined) {
  const host = cookieHost(url);
  if (!host) return;
  const entries = setCookie === undefined ? [] : Array.isArray(setCookie) ? setCookie : [setCookie];
  const jar = cookieJar.get(host) ?? new Map<string, string>();
  for (const entry of entries) {
    const pair = entry.split(";", 1)[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name && value) jar.set(name, value);
  }
  cookieJar.set(host, jar);
}

function decodeHttpBody(raw: Buffer, encoding: string | undefined): string {
  const enc = (encoding ?? "").toLowerCase();
  try {
    if (enc.includes("br")) return zlib.brotliDecompressSync(raw).toString("utf8");
    if (enc.includes("gzip")) return zlib.gunzipSync(raw).toString("utf8");
    if (enc.includes("deflate")) return zlib.inflateSync(raw).toString("utf8");
  } catch {
    // Some hosts lie about encoding; fall through to the raw bytes.
  }
  return raw.toString("utf8");
}

function amazonBlocked(html: string): boolean {
  const head = html.slice(0, 30_000);
  if (/captcha|automated access|validateCaptcha|opfcaptcha/i.test(head)) {
    return true;
  }
  // A real Amazon listing or search page is hundreds of KB. ~13KB is a block interstitial.
  return html.length < 40_000;
}

export type VerifiedListing = {
  pricePence: number;
  checkedAt: string;
  title?: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
};

export function toPence(raw: string): number | undefined {
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

export function decodeEntities(text: string): string {
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

export let lastMerchantFetch = {
  url: "",
  status: 0,
  length: 0,
  error: "",
};

function getHttps() {
  return require("node:https") as typeof import("node:https");
}

function fetchMerchantHtmlOnce(
  url: string,
  timeoutMs = 15_000,
  redirectsLeft = 4,
): Promise<string | undefined> {
  lastMerchantFetch = { url, status: 0, length: 0, error: "" };
  const https = getHttps();
  return new Promise((resolve) => {
    const request = https.get(
      url,
      { headers: requestHeaders(url), timeout: timeoutMs },
      (response) => {
        lastMerchantFetch.status = response.statusCode ?? 0;
        rememberCookies(url, response.headers["set-cookie"]);
        const location = response.headers.location;
        if (
          location &&
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          redirectsLeft > 0
        ) {
          response.resume();
          const next = new URL(location, url).toString();
          void fetchMerchantHtmlOnce(next, timeoutMs, redirectsLeft - 1).then(resolve);
          return;
        }
        if (!response.statusCode || response.statusCode >= 400) {
          lastMerchantFetch.error = `http ${response.statusCode ?? 0}`;
          response.resume();
          resolve(undefined);
          return;
        }
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const html = decodeHttpBody(
            Buffer.concat(chunks),
            response.headers["content-encoding"],
          );
          lastMerchantFetch.length = html.length;
          if (/amazon\./i.test(url) && amazonBlocked(html)) {
            cookieJar.delete(cookieHost(url));
            lastMerchantFetch.error = "blocked";
            resolve(undefined);
            return;
          }
          resolve(html);
        });
        response.on("error", (error) => {
          lastMerchantFetch.error = error.message;
          resolve(undefined);
        });
      },
    );
    request.on("timeout", () => {
      lastMerchantFetch.error = "timeout";
      request.destroy();
      resolve(undefined);
    });
    request.on("error", (error) => {
      lastMerchantFetch.error = error.message;
      resolve(undefined);
    });
  });
}

export async function fetchMerchantHtml(
  url: string,
  timeoutMs = 15_000,
): Promise<string | undefined> {
  const first = await fetchMerchantHtmlOnce(url, timeoutMs);
  if (first || !/amazon\./i.test(url) || lastMerchantFetch.error !== "blocked") {
    return first;
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  return fetchMerchantHtmlOnce(url, timeoutMs);
}

export async function fetchVerifiedListing(
  url: string,
  timeoutMs = 15_000,
): Promise<VerifiedListing | undefined> {
  let html = await fetchMerchantHtml(url, timeoutMs);
  if (!html) {
    const asin = url.match(/amazon\.co\.uk\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1];
    if (asin) {
      html = await fetchMerchantHtml(`https://www.amazon.co.uk/gp/aw/d/${asin}`, timeoutMs);
    }
  }
  if (!html) {
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
