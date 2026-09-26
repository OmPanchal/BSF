import { registerProductSource } from "@/lib/sources/registry";
import type { ListingHit, SourceQuery } from "@/lib/sources/types";
import { getTavilyApiKey, tavilySearch } from "@/lib/tavily";
import { normalizeListingUrl } from "@/lib/webSearch";

const QUERY_STOP = new Set(["buy", "the", "and", "for", "with", "under", "from"]);
const ROUNDUP = /\b(best \d+|top \d+|buying guide|round-?up|compared|vs\.?)\b/i;

function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !QUERY_STOP.has(token));
}

function titleMatchesQuery(title: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const hay = title.toLowerCase();
  const hits = tokens.filter((token) => hay.includes(token));
  return hits.length >= Math.min(2, tokens.length);
}

function titleBeside(content: string, index: number): string {
  return content
    .slice(Math.max(0, index - 160), index)
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\[\]|()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-140);
}

registerProductSource({
  id: "tavily",
  enabled: () => Boolean(getTavilyApiKey()),
  async search(input: SourceQuery): Promise<ListingHit[]> {
    // A named model is always the Tavily query, not a rewritten category phrase.
    const query = input.specificProduct
      ? `${input.specificProduct} buy UK`
      : `${input.query} buy UK`;
    const tokens = queryTokens(input.specificProduct || input.query);
    const found = await tavilySearch(query, {
      maxResults: 8,
      country: "united kingdom",
      timeoutMs: 8_000,
    });
    const hits: ListingHit[] = [];
    const seen = new Set<string>();
    const add = (raw: string, title: string) => {
      const url = normalizeListingUrl(raw);
      const cleaned = title.replace(/^Amazon\.co\.uk\s*:\s*/i, "").trim();
      if (!url || cleaned.length < 8 || seen.has(url) || ROUNDUP.test(cleaned)) return;
      if (!titleMatchesQuery(cleaned, tokens)) return;
      seen.add(url);
      hits.push({ url, title: cleaned, sourceId: "tavily" });
    };
    for (const result of found.results) {
      add(result.url, result.title);
      // A shop link inside the snippet only counts when the words next to it
      // name this product. The article title is not reused for those links.
      for (const match of result.content.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
        add(match[0], titleBeside(result.content, match.index ?? 0));
      }
    }
    return hits;
  },
});
