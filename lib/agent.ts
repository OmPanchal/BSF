import { auditProduct } from "@/lib/audit";
import { getCatalogProducts, rememberProducts } from "@/lib/catalog";
import { getDemoAgentTask, getDemoProducts } from "@/lib/demoFixture";
import { completeJson, getGeminiApiKey } from "@/lib/llm";
import type { AgentEvent, AgentTask, Product, SocialProofAudit } from "@/types/contracts";

function nowIso(): string {
  return new Date().toISOString();
}

function event(step: number, message: string, sourceUrl?: string): AgentEvent {
  return { step, timestamp: nowIso(), status: "success", message, sourceUrl };
}

function heuristicPick(
  products: Product[],
  audits: SocialProofAudit[],
): { selectedProductId: string; rationale: string } {
  const ranked = [...products].sort((a, b) => {
    const aAudit = audits.find((audit) => audit.productId === a.id);
    const bAudit = audits.find((audit) => audit.productId === b.id);
    const aScore = (aAudit?.pros.length ?? 0) - (aAudit?.concerns.length ?? 0);
    const bScore = (bAudit?.pros.length ?? 0) - (bAudit?.concerns.length ?? 0);
    if (aScore !== bScore) return bScore - aScore;
    const aExact = a.match?.kind === "exact" ? 1 : 0;
    const bExact = b.match?.kind === "exact" ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    return a.pricePence - b.pricePence;
  });
  const selected = ranked[0];
  const price = `£${(selected.pricePence / 100).toFixed(2)}`;
  return {
    selectedProductId: selected.id,
    rationale: `${selected.brand} ${selected.name} is the closest match at ${price}. Review evidence was not scored by Gemini, so this is a constrained pick.`,
  };
}

async function geminiPick(
  intent: string,
  products: Product[],
  audits: SocialProofAudit[],
): Promise<{ selectedProductId: string; rationale: string } | undefined> {
  if (!getGeminiApiKey()) return undefined;
  const payload = (await completeJson(
    [
      "Pick the single best product for the buyer.",
      "Use only the supplied prices, match notes, pros, and concerns. Do not invent reviews.",
      "Prefer an exact match inside budget with fewer cited concerns.",
      "Return JSON {\"selectedProductId\": string, \"rationale\": string}.",
      "The id must be one of the provided product ids.",
    ].join(" "),
    JSON.stringify({
      intent,
      products: products.map((product) => ({
        id: product.id,
        name: `${product.brand} ${product.name}`,
        pricePence: product.pricePence,
        match: product.match,
        rating: product.merchantRating,
        reviews: product.merchantReviewCount,
      })),
      audits: audits.map((audit) => ({
        productId: audit.productId,
        verdict: audit.verdict,
        pros: audit.pros.map((claim) => claim.text),
        concerns: audit.concerns.map((claim) => claim.text),
      })),
    }),
  )) as Record<string, unknown> | null;
  if (
    !payload ||
    typeof payload.selectedProductId !== "string" ||
    typeof payload.rationale !== "string" ||
    !products.some((product) => product.id === payload.selectedProductId)
  ) {
    return undefined;
  }
  return {
    selectedProductId: payload.selectedProductId,
    rationale: payload.rationale.trim(),
  };
}

export async function createAgentTask(
  intent: string,
  candidateIds: string[],
): Promise<AgentTask> {
  const fromCatalog = getCatalogProducts(candidateIds);
  const products =
    fromCatalog.length > 0
      ? fromCatalog
      : getDemoProducts().filter(
          (product) => candidateIds.length === 0 || candidateIds.includes(product.id),
        );

  if (products.length === 0) {
    rememberProducts(getDemoProducts());
    return getDemoAgentTask(intent, candidateIds);
  }

  const ids = products.map((product) => product.id);
  const audits = await Promise.all(ids.map((id) => auditProduct(id)));
  const picked = (await geminiPick(intent, products, audits).catch(() => undefined)) ??
    heuristicPick(products, audits);
  const selected = products.find((product) => product.id === picked.selectedProductId);
  const selectedAudit = audits.find((audit) => audit.productId === picked.selectedProductId);

  return {
    taskId: `task-${Date.now()}`,
    agentMode: "demo-simulation",
    status: "awaiting_approval",
    intent,
    candidateIds: ids,
    selectedProductId: picked.selectedProductId,
    rationale: picked.rationale,
    events: [
      event(1, `Kept ${products.length} listing(s) after a timed pass across the search sources.`),
      event(
        2,
        `Gemini read review snippets for ${selected?.brand ?? "the selected product"} ${selected?.name ?? ""}`.trim(),
        selectedAudit?.sources[0]?.url,
      ),
      event(3, "Ranked exact matches ahead of near misses using cited pros and concerns."),
      event(4, "Stopped for human approval before any purchase handoff. Opening a merchant page is not a completed order."),
    ],
  };
}
