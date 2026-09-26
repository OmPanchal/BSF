import { amazonSource } from "@/lib/sources/amazon";
import { duckduckgoSource } from "@/lib/sources/duckduckgo";
import { geminiSource } from "@/lib/sources/geminiGrounding";
import { serpapiSource } from "@/lib/sources/serpapi";
import { argosSource, johnLewisSource } from "@/lib/sources/shops";
import { tavilyProductSource } from "@/lib/sources/tavilySource";
import type { ProductSource } from "@/lib/sources/types";

/** Built at call time from the imported source objects, so a hot reload cannot leave search with an empty registry. */
const ALL: ProductSource[] = [
  amazonSource,
  tavilyProductSource,
  duckduckgoSource,
  argosSource,
  johnLewisSource,
  geminiSource,
  serpapiSource,
];

export function productSources(): ProductSource[] {
  return ALL.filter((source) => source.enabled());
}
