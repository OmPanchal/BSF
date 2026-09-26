import type { ProductSource } from "@/lib/sources/types";

const sources: ProductSource[] = [];

export function registerProductSource(source: ProductSource): void {
  const index = sources.findIndex((item) => item.id === source.id);
  if (index >= 0) sources[index] = source;
  else sources.push(source);
}

export function productSources(): ProductSource[] {
  return sources.filter((source) => source.enabled());
}
