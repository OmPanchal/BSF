import { createHash } from "node:crypto";
import { evaluateListing, parseIntent, searchPhrase } from "@/lib/intent";
import { fetchVerifiedListing, type VerifiedListing } from "@/lib/pagePrice";
import { productSources } from "@/lib/sources";
import type { ListingHit, SourceQuery } from "@/lib/sources/types";
import type { Product, ProductMatch, SearchConstraints } from "@/types/contracts";

const SEARCH_WINDOW_MS = Number(process.env.SEARCH_WINDOW_MS) || 12_000;
const MAX_PER_SECTION = 8;
const VERIFY_CONCURRENCY = 4;

export class SearchInputError extends Error {}

function amazonAsin(text: string): string | undefined {
  const decoded = (() => {
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  })();
  return decoded.match(/(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/)([A-Z0-9]{10})/i)?.[1]?.toUpperCase();
}

export function productIdFromUrl(url: string): string {
  const asin = amazonAsin(url);
  if (asin) return `amz-${asin.toLowerCase()}`;
  return `web-${createHash("sha1").update(url).digest("hex").slice(0, 12)}`;
}

function guessBrandAndName(title: string): { brand: string; name: string } {
  const cleaned = title
    .replace(/\s*[|–-]\s*(Amazon\.co\.uk|Argos|John Lewis|Currys).*$/i, "")
    .replace(/^Amazon\.co\.uk\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(/\s+/);
  return {
    brand: parts[0] ?? "Unknown",
    name: (parts.slice(1, 8).join(" ") || cleaned).replace(/[\s,;:|–-]+$/, ""),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

async function runWave(input: SourceQuery, deadline: number): Promise<ListingHit[]> {
  const budget = Math.max(1_500, Math.min(8_000, deadline - Date.now()));
  if (budget < 1_500) return [];
  const batches = await Promise.all(
    productSources().map((source) =>
      withTimeout(source.search(input).catch(() => [] as ListingHit[]), budget, [] as ListingHit[]),
    ),
  );
  return batches.flat();
}

type Candidate = ListingHit & { rank: number };

type Screened = {
  candidate: Candidate;
  evaluation: Extract<ReturnType<typeof evaluateListing>, { relevant: true }>;
};

function screenCandidates(constraints: SearchConstraints, candidates: Candidate[]): Screened[] {
  return candidates
    .map((candidate) => ({
      candidate,
      evaluation: evaluateListing(constraints, candidate.title, candidate.pricePence),
    }))
    .filter((item): item is Screened => item.evaluation.relevant)
    .sort((a, b) => b.evaluation.score - a.evaluation.score || a.candidate.rank - b.candidate.rank);
}

async function mapLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await run(items[index]);
      }
    }),
  );
  return results;
}

function toProduct(
  constraints: SearchConstraints,
  candidate: Candidate,
  listing: VerifiedListing,
  match: ProductMatch,
): Product {
  const host = (() => {
    try {
      return new URL(candidate.url).hostname.replace(/^www\./, "");
    } catch {
      return candidate.sourceId;
    }
  })();
  const { brand, name } = guessBrandAndName(listing.title ?? candidate.title);
  return {
    id: productIdFromUrl(candidate.url),
    name,
    brand,
    pricePence: listing.pricePence,
    currency: "GBP",
    merchantUrl: candidate.url,
    imageUrl: listing.imageUrl ?? candidate.imageUrl,
    merchantRating: listing.rating,
    merchantReviewCount: listing.reviewCount,
    category: constraints.product,
    attributes: {
      sourceHost: host,
      listedFrom: candidate.sourceId,
      priceCheckedAt: listing.checkedAt,
    },
    match,
  };
}

export type LiveSearchResult = {
  constraints: SearchConstraints;
  products: Product[];
  similar: Product[];
};

export type SearchHooks = {
  onConstraints?: (constraints: SearchConstraints) => void;
  onProduct?: (product: Product) => void;
};

function listingKey(product: Product): string {
  return `${product.brand} ${product.name}`.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function searchProductsLive(
  intent: string,
  hooks: SearchHooks = {},
): Promise<LiveSearchResult> {
  const constraints = await parseIntent(intent);
  if (!constraints.product && !constraints.specificProduct) {
    throw new SearchInputError(
      "Tell me what product you're after — for example “wireless earbuds under £50”.",
    );
  }
  hooks.onConstraints?.(constraints);

  const deadline = Date.now() + SEARCH_WINDOW_MS;
  const products: Product[] = [];
  const similarProducts: Product[] = [];
  const seen = new Set<string>();
  const seenUrls = new Set<string>();
  let rank = 0;

  const accept = (product: Product | undefined) => {
    if (!product) return;
    const key = listingKey(product);
    if (seen.has(key)) return;
    const bucket = product.match?.kind === "similar" ? similarProducts : products;
    if (bucket.length >= MAX_PER_SECTION) return;
    seen.add(key);
    bucket.push(product);
    hooks.onProduct?.(product);
  };

  const takeHits = (hits: ListingHit[]): Candidate[] => {
    const fresh: Candidate[] = [];
    for (const hit of hits) {
      const key = amazonAsin(hit.url) ?? hit.url;
      if (!hit.title || seenUrls.has(key)) continue;
      seenUrls.add(key);
      fresh.push({ ...hit, rank: rank++ });
    }
    return fresh;
  };

  const verify = (items: Screened[]) => {
    const exact = items.filter((item) => item.evaluation.match.kind === "exact").slice(0, 10);
    const similar = items.filter((item) => item.evaluation.match.kind === "similar").slice(0, 10);
    return mapLimit([...exact, ...similar], VERIFY_CONCURRENCY, async ({ candidate }) => {
      const listing = await fetchVerifiedListing(candidate.url, 8_000);
      if (!listing) return;
      const checked = evaluateListing(
        constraints,
        listing.title ?? candidate.title,
        listing.pricePence,
      );
      if (!checked.relevant) return;
      accept(toProduct(constraints, candidate, listing, checked.match));
    });
  };

  const primary = constraints.specificProduct || searchPhrase(constraints);
  const firstHits = takeHits(
    await runWave(
      {
        query: primary,
        specificProduct: constraints.specificProduct,
        minPence: constraints.minPricePence,
        maxPence: constraints.maxPricePence,
      },
      deadline,
    ),
  );
  const firstScreened = screenCandidates(constraints, firstHits);
  const firstPass = verify(firstScreened);

  let secondScreened: Screened[] = [];
  if (
    (constraints.minPricePence !== undefined || constraints.maxPricePence !== undefined) &&
    Date.now() < deadline - 2_000
  ) {
    const secondHits = takeHits(
      await runWave({ query: primary, specificProduct: constraints.specificProduct }, deadline),
    );
    secondScreened = screenCandidates(constraints, secondHits);
    await verify(secondScreened);
  }
  await firstPass;

  if (products.length + similarProducts.length === 0 && firstScreened.length + secondScreened.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await verify([...firstScreened, ...secondScreened].slice(0, 6));
  }

  return { constraints, products, similar: similarProducts };
}
