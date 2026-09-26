import { decodeEntities } from "@/lib/pagePrice";
import { registerProductSource } from "@/lib/sources/registry";
import type { ListingHit, SourceQuery } from "@/lib/sources/types";
import { normalizeListingUrl } from "@/lib/webSearch";

registerProductSource({
  id: "duckduckgo",
  enabled: () => true,
  async search(input: SourceQuery): Promise<ListingHit[]> {
    const q = `${input.specificProduct || input.query} buy UK`;
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    const html = await response.text();
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
});
