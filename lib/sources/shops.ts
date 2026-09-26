import { searchArgos, searchJohnLewis } from "@/lib/ukMerchants";
import { registerProductSource } from "@/lib/sources/registry";
import type { ListingHit, ProductSource, SourceQuery } from "@/lib/sources/types";

export const argosSource: ProductSource = {
  id: "argos",
  enabled: () => true,
  async search(input: SourceQuery): Promise<ListingHit[]> {
    const hits = await searchArgos(input.specificProduct || input.query);
    return hits.map((hit) => ({ ...hit, sourceId: "argos" }));
  },
};

export const johnLewisSource: ProductSource = {
  id: "johnlewis",
  enabled: () => true,
  async search(input: SourceQuery): Promise<ListingHit[]> {
    const hits = await searchJohnLewis(input.specificProduct || input.query);
    return hits.map((hit) => ({ ...hit, sourceId: "johnlewis" }));
  },
};

registerProductSource(argosSource);
registerProductSource(johnLewisSource);
