import { searchAmazonUk } from "@/lib/amazonSearch";
import { registerProductSource } from "@/lib/sources/registry";
import type { ListingHit, ProductSource, SourceQuery } from "@/lib/sources/types";

export const amazonSource: ProductSource = {
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
};
registerProductSource(amazonSource);
