import { clearMerchantCookies, decodeEntities, fetchMerchantHtml, toPence } from "@/lib/pagePrice";

export type AmazonSearchHit = {
  asin: string;
  title: string;
  // Price shown on the search results page; the product page is still the source of truth.
  searchPricePence?: number;
  sponsored: boolean;
  rank: number;
};

const RESULT_OPEN =
  /<div[^>]*data-asin="([A-Z0-9]{10})"[^>]*data-component-type="s-search-result"[^>]*>|<div[^>]*data-component-type="s-search-result"[^>]*data-asin="([A-Z0-9]{10})"[^>]*>/g;

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function titleFromBlock(block: string): string | undefined {
  const headings = [...block.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)]
    .map((match) => stripTags(match[1]))
    .filter((title) => title.length > 6 && !/sponsored|leave ad feedback/i.test(title));
  if (headings.length > 0) {
    return headings.sort((a, b) => b.length - a.length)[0];
  }

  const recipe = block.match(/data-cy="title-recipe"[\s\S]{0,2500}/i);
  if (recipe) {
    const text = stripTags(recipe[0]).replace(/title-recipe/i, "").trim();
    if (text.length > 6) return text.slice(0, 200);
  }

  const normal = block.match(
    /a-size-(?:medium|base)[^"]*a-text-normal"[^>]*>([\s\S]*?)<\/(?:span|a)>/i,
  );
  if (normal) {
    const text = stripTags(normal[1]);
    if (text.length > 6) return text;
  }

  const slug = block.match(/\/([^/"']{8,120})\/dp\/[A-Z0-9]{10}/);
  if (slug?.[1]) {
    return decodeURIComponent(slug[1]).replace(/-/g, " ");
  }
  return undefined;
}

function parseResultBlock(block: string): Omit<AmazonSearchHit, "asin" | "rank"> | undefined {
  const title = titleFromBlock(block);
  if (!title) {
    return undefined;
  }
  const priceText = block.match(
    /class="a-price"[^>]*>\s*<span class="a-offscreen">\s*([^<]+?)\s*</,
  )?.[1];
  const decoded = priceText ? decodeEntities(priceText) : undefined;
  return {
    title,
    searchPricePence: decoded?.startsWith("£") ? toPence(decoded) : undefined,
    sponsored: /\bSponsored\b/.test(block),
  };
}

function parseHits(html: string): AmazonSearchHit[] {
  const opens = [...html.matchAll(RESULT_OPEN)];
  const hits: AmazonSearchHit[] = [];
  const seen = new Set<string>();
  opens.forEach((match, index) => {
    const asin = match[1] ?? match[2];
    if (!asin || seen.has(asin)) {
      return;
    }
    const end = opens[index + 1]?.index ?? Math.min(html.length, (match.index ?? 0) + 60_000);
    const parsed = parseResultBlock(html.slice(match.index, end));
    if (!parsed) {
      return;
    }
    seen.add(asin);
    hits.push({ asin, rank: hits.length, ...parsed });
  });
  return hits;
}

export async function searchAmazonUk(
  query: string,
  range: { minPence?: number; maxPence?: number } = {},
): Promise<AmazonSearchHit[]> {
  const params = new URLSearchParams({ k: query });
  if (range.minPence !== undefined || range.maxPence !== undefined) {
    params.set("rh", `p_36:${range.minPence ?? ""}-${range.maxPence ?? ""}`);
  }
  const url = `https://www.amazon.co.uk/s?${params}`;
  clearMerchantCookies("amazon.co.uk");

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await sleep(600);
    }
    const html = await fetchMerchantHtml(url, 12_000);
    if (!html) {
      continue;
    }
    const hits = parseHits(html);
    if (hits.length > 0) {
      return hits;
    }
  }
  return [];
}
