import { decodeEntities, fetchMerchantHtml } from "@/lib/pagePrice";
import { registerProductSource } from "@/lib/sources/registry";
import type { ListingHit, ProductSource, SourceQuery } from "@/lib/sources/types";
import { normalizeListingUrl } from "@/lib/webSearch";

export const duckduckgoSource: ProductSource = {
  id: "duckduckgo",
  enabled: () => true,
  async search(input: SourceQuery): Promise<ListingHit[]> {
    const q = `${input.specificProduct || input.query} buy UK`;
    const html = await fetchMerchantHtml(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
      8_000,
    );
    if (!html) return [];
    const hits: ListingHit[] = [];
    const seen = new Set<string>();
    for (const match of html.matchAll(
      /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    )) {
      const url = normalizeListingUrl(decodeEntities(match[1] ?? ""));
      const title = decodeEntities((match[2] ?? "").replace(/<[^>]+>/g, " "));
      if (!url || !title || seen.has(url)) continue;
      seen.add(url);
      hits.push({ url, title, sourceId: "duckduckgo" });
    }
    return hits;
  },
};
registerProductSource(duckduckgoSource);
