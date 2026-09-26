import { geminiGenerate, geminiGroundingLinks, getGeminiApiKey } from "@/lib/llm";
import { registerProductSource } from "@/lib/sources/registry";
import type { ListingHit, ProductSource, SourceQuery } from "@/lib/sources/types";
import { normalizeListingUrl } from "@/lib/webSearch";

export const geminiSource: ProductSource = {
  id: "gemini",
  enabled: () => Boolean(getGeminiApiKey()),
  async search(input: SourceQuery): Promise<ListingHit[]> {
    const q = input.specificProduct || input.query;
    const payload = await geminiGenerate(
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Find current UK shop listing pages for: ${q}. Prefer amazon.co.uk, argos.co.uk, johnlewis.com and currys.co.uk product pages.`,
              },
            ],
          },
        ],
        tools: [{ google_search: {} }],
      },
      6_000,
    );
    const hits: ListingHit[] = [];
    const seen = new Set<string>();
    for (const link of geminiGroundingLinks(payload)) {
      const url = normalizeListingUrl(link.url);
      const title = link.title.trim();
      if (!url || !title || seen.has(url) || /^https?:/i.test(title)) continue;
      seen.add(url);
      hits.push({ url, title, sourceId: "gemini" });
    }
    return hits;
  },
};
registerProductSource(geminiSource);
