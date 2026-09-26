import { decodeEntities, fetchMerchantHtml, toPence } from "@/lib/pagePrice";

export type MerchantHit = {
  url: string;
  title: string;
  searchPricePence?: number;
};

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export async function searchArgos(query: string): Promise<MerchantHit[]> {
  const slug = query.trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "");
  if (!slug) return [];
  const html = await fetchMerchantHtml(`https://www.argos.co.uk/search/${encodeURIComponent(slug)}/`, 12_000);
  if (!html) return [];
  const hits: MerchantHit[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/href="(\/product\/\d+[^"]*)"/gi)) {
    const path = match[1] ?? "";
    const id = path.match(/\/product\/(\d+)/)?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const around = html.slice(Math.max(0, (match.index ?? 0) - 400), (match.index ?? 0) + 1_200);
    const title =
      stripTags(around.match(/<(?:h2|h3|span)[^>]*>([\s\S]*?)<\/(?:h2|h3|span)>/i)?.[1] ?? "") ||
      `Argos product ${id}`;
    const priceText = around.match(/£\s*\d[\d,]*(?:\.\d{2})?/)?.[0];
    hits.push({
      url: `https://www.argos.co.uk/product/${id}`,
      title,
      searchPricePence: priceText ? toPence(priceText) : undefined,
    });
    if (hits.length >= 8) break;
  }
  return hits;
}

export async function searchJohnLewis(query: string): Promise<MerchantHit[]> {
  const url = `https://www.johnlewis.com/search?search-term=${encodeURIComponent(query)}`;
  const html = await fetchMerchantHtml(url, 12_000);
  if (!html) return [];
  const hits: MerchantHit[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/href="(\/[^"]+\/p\d+)"/gi)) {
    const path = match[1] ?? "";
    if (seen.has(path)) continue;
    seen.add(path);
    const around = html.slice(Math.max(0, (match.index ?? 0) - 200), (match.index ?? 0) + 1_400);
    const title =
      stripTags(around.match(/<(?:h2|h3|span)[^>]*>([\s\S]*?)<\/(?:h2|h3|span)>/i)?.[1] ?? "") ||
      stripTags(path.split("/").filter(Boolean)[0] ?? "John Lewis listing");
    const priceText = around.match(/£\s*\d[\d,]*(?:\.\d{2})?/)?.[0];
    hits.push({
      url: `https://www.johnlewis.com${path}`,
      title,
      searchPricePence: priceText ? toPence(priceText) : undefined,
    });
    if (hits.length >= 8) break;
  }
  return hits;
}
