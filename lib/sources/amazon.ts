import { searchAmazonUk } from "@/lib/amazonSearch";
import { registerProductSource } from "@/lib/sources/registry";
import type { ListingHit, SourceQuery } from "@/lib/sources/types";

registerProductSource({
  id: "amazon",
  enabled: () => true,
  async search(input: SourceQuery): Promise<ListingHit[]> {
    const query = input.specificProduct || input.query;
    const hits = await searchAmazonUk(query, {
      minPence: input.minPence,
      maxPence: input.maxPence,
    });
    return hits.map((hit) => ({
      url: `https://www.amazon.co.uk/dp/${hit.asin}`,
      title: hit.title,
      pricePence: hit.searchPricePence,
      sourceId: "amazon",
    }));
  },
});
