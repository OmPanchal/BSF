import { searchArgos, searchJohnLewis } from "@/lib/ukMerchants";
import { registerProductSource } from "@/lib/sources/registry";
import type { ListingHit, SourceQuery } from "@/lib/sources/types";

registerProductSource({
  id: "argos",
  enabled: () => true,
  async search(input: SourceQuery): Promise<ListingHit[]> {
    const hits = await searchArgos(input.specificProduct || input.query);
    return hits.map((hit) => ({ ...hit, sourceId: "argos" }));
  },
});

registerProductSource({
  id: "johnlewis",
  enabled: () => true,
  async search(input: SourceQuery): Promise<ListingHit[]> {
    const hits = await searchJohnLewis(input.specificProduct || input.query);
    return hits.map((hit) => ({ ...hit, sourceId: "johnlewis" }));
  },
});
