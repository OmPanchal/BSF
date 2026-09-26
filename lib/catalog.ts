import type { Product, SocialProofAudit } from "@/types/contracts";

const productsById = new Map<string, Product>();
const auditsById = new Map<string, SocialProofAudit>();
const auditInflight = new Map<string, Promise<SocialProofAudit>>();

export function rememberProducts(products: Product[]): void {
  for (const product of products) {
    productsById.set(product.id, product);
  }
}

export function getCatalogProduct(id: string): Product | undefined {
  return productsById.get(id);
}

export function getCatalogProducts(ids: string[]): Product[] {
  return ids
    .map((id) => productsById.get(id))
    .filter((product): product is Product => Boolean(product));
}

export function getCachedAudit(productId: string): SocialProofAudit | undefined {
  return auditsById.get(productId);
}

export function rememberAudit(audit: SocialProofAudit): void {
  auditsById.set(audit.productId, audit);
}

export function getAuditInflight(
  productId: string,
): Promise<SocialProofAudit> | undefined {
  return auditInflight.get(productId);
}

export function setAuditInflight(
  productId: string,
  promise: Promise<SocialProofAudit>,
): void {
  auditInflight.set(productId, promise);
}

export function clearAuditInflight(productId: string): void {
  auditInflight.delete(productId);
}
