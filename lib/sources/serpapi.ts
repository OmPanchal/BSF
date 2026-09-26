import { registerProductSource } from "@/lib/sources/registry";
import type { ListingHit, SourceQuery } from "@/lib/sources/types";
import { toPence } from "@/lib/pagePrice";
import { normalizeListingUrl } from "@/lib/webSearch";

function serpKey(): string | undefined {
  const key = process.env.SERPAPI_API_KEY?.trim() || process.env.SERP_API_KEY?.trim();
  return key || undefined;
}

registerProductSource({
  id: "serpapi",
  enabled: () => Boolean(serpKey()),
  async search(input: SourceQuery): Promise<ListingHit[]> {
    const key = serpKey();
    if (!key) return [];
    const q = input.specificProduct || input.query;
    const params = new URLSearchParams({
      engine: "google_shopping",
      q,
      gl: "uk",
      hl: "en",
      api_key: key,
    });
    const response = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    const payload = (await response.json().catch(() => null)) as
      | { shopping_results?: unknown }
      | null;
    const rows = Array.isArray(payload?.shopping_results) ? payload.shopping_results : [];
    const hits: ListingHit[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const item = row as { title?: unknown; link?: unknown; product_link?: unknown; price?: unknown; thumbnail?: unknown };
      const raw = typeof item.link === "string" ? item.link : typeof item.product_link === "string" ? item.product_link : "";
      const url = raw ? normalizeListingUrl(raw) : undefined;
      const title = typeof item.title === "string" ? item.title : "";
      if (!url || !title || seen.has(url)) continue;
      seen.add(url);
      const price = typeof item.price === "string" && item.price.includes("£") ? toPence(item.price) : undefined;
      hits.push({
        url,
        title,
        pricePence: price,
        imageUrl: typeof item.thumbnail === "string" ? item.thumbnail : undefined,
        sourceId: "serpapi",
      });
    }
    return hits;
  },
});
