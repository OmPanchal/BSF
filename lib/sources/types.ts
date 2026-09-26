export type ListingHit = {
  url: string;
  title: string;
  pricePence?: number;
  imageUrl?: string;
  sourceId: string;
};

export type SourceQuery = {
  query: string;
  specificProduct?: string;
  minPence?: number;
  maxPence?: number;
};

/** Add a new retailer or search API by implementing this and calling registerProductSource. */
export type ProductSource = {
  id: string;
  enabled: () => boolean;
  search: (input: SourceQuery) => Promise<ListingHit[]>;
};
