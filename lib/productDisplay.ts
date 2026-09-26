import type { Product } from "@/types/contracts";

const INTERNAL_ATTRIBUTES = new Set(["listedFrom", "priceCheckedAt", "sourceHost"]);

export function priceCheckLabel(product: Product): string {
  const checkedAt = product.attributes.priceCheckedAt;
  if (typeof checkedAt !== "string") {
    return "Price snapshot — may change";
  }
  const time = new Date(checkedAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Price read from merchant page at ${time} — may change`;
}

export function merchantHost(product: Product): string | undefined {
  const host = product.attributes.sourceHost;
  return typeof host === "string" ? host.replace(/^www\./, "") : undefined;
}

export function displayAttributes(
  product: Product,
): [string, string | number | boolean][] {
  return Object.entries(product.attributes).filter(
    ([key]) => !INTERNAL_ATTRIBUTES.has(key),
  );
}
