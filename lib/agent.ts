import { auditProduct } from "@/lib/audit";
import { getCatalogProducts, rememberProducts } from "@/lib/catalog";
import { getDemoAgentTask, getDemoProducts } from "@/lib/demoFixture";
import { completeJson, hasLlmAccess } from "@/lib/llm";
import { parseBudgetPence } from "@/lib/searchProducts";
import type { AgentEvent, AgentTask, Product, SocialProofAudit } from "@/types/contracts";

function nowIso(): string {
  return new Date().toISOString();
}

function event(step: number, message: string, sourceUrl?: string): AgentEvent {
  return {
    step,
    timestamp: nowIso(),
    status: "success",
    message,
    sourceUrl,
  };
}

function heuristicPick(
  intent: string,
  products: Product[],
  audits: SocialProofAudit[],
): { selectedProductId: string; rationale: string } {
  const budget = parseBudgetPence(intent);
  const intentTerms = intent
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 3);

  const ranked = [...products].sort((a, b) => {
    const aAudit = audits.find((audit) => audit.productId === a.id);
    const bAudit = audits.find((audit) => audit.productId === b.id);
    const aConcerns = aAudit?.concerns.length ?? 0;
    const bConcerns = bAudit?.concerns.length ?? 0;
    if (aConcerns !== bConcerns) {
      return aConcerns - bConcerns;
    }
    const haystack = (product: Product) =>
      `${product.brand} ${product.name} ${JSON.stringify(product.attributes)}`.toLowerCase();
    const aHits = intentTerms.filter((term) => haystack(a).includes(term)).length;
    const bHits = intentTerms.filter((term) => haystack(b).includes(term)).length;
    if (aHits !== bHits) {
      return bHits - aHits;
    }
    return a.pricePence - b.pricePence;
  });

  const selected =
    ranked.find(
      (product) => budget === undefined || product.pricePence <= budget,
    ) ?? ranked[0];

  const audit = audits.find((item) => item.productId === selected.id);
  const concern = audit?.concerns[0]?.text;
  const rationale = [
    `${selected.brand} ${selected.name} is the closest match to this buyer request`,
    budget
      ? `at ${(selected.pricePence / 100).toFixed(2)} GBP, within the stated budget`
      : `at ${(selected.pricePence / 100).toFixed(2)} GBP`,
    concern
      ? `Independent notes still include: ${concern}`
      : "Independent evidence is limited, so this is a constrained recommendation rather than a certainty.",
  ].join(". ");

  return { selectedProductId: selected.id, rationale };
}

async function llmPick(
  intent: string,
  products: Product[],
  audits: SocialProofAudit[],
): Promise<{ selectedProductId: string; rationale: string } | null> {
  try {
    const payload = await completeJson(
      "Choose one product ID that best matches the buyer intent. Prefer budget fit and cited concerns over merchant star ratings. Do not invent facts that are not in the product or audit JSON. Return {\"selectedProductId\":\"\",\"rationale\":\"\"}.",
      JSON.stringify({ intent, products, audits }),
    );
    if (
      payload &&
      typeof payload === "object" &&
      "selectedProductId" in payload &&
      typeof payload.selectedProductId === "string" &&
      products.some((product) => product.id === payload.selectedProductId) &&
      "rationale" in payload &&
      typeof payload.rationale === "string" &&
      payload.rationale.trim()
    ) {
      return {
        selectedProductId: payload.selectedProductId,
        rationale: payload.rationale.trim(),
      };
    }
  } catch {
    return null;
  }
  return null;
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
          (product) =>
            candidateIds.length === 0 || candidateIds.includes(product.id),
        );

  if (products.length === 0) {
    rememberProducts(getDemoProducts());
    return getDemoAgentTask(intent, candidateIds);
  }

  const ids = products.map((product) => product.id);
  const audits = await Promise.all(ids.map((id) => auditProduct(id)));
  const picked =
    (hasLlmAccess() ? await llmPick(intent, products, audits) : null) ??
    heuristicPick(intent, products, audits);

  const selected = products.find(
    (product) => product.id === picked.selectedProductId,
  );
  const selectedAudit = audits.find(
    (audit) => audit.productId === picked.selectedProductId,
  );

  return {
    taskId: `task-${Date.now()}`,
    agentMode: "demo-simulation",
    status: "awaiting_approval",
    intent,
    candidateIds: ids,
    selectedProductId: picked.selectedProductId,
    rationale: picked.rationale,
    events: [
      event(1, `Matched ${products.length} live merchant listing(s) to the buyer intent.`),
      event(
        2,
        `Read independent snippets for ${selected?.brand ?? "the selected product"} ${selected?.name ?? ""}`.trim(),
        selectedAudit?.sources[0]?.url,
      ),
      event(
        3,
        audits.every((audit) => audit.mode === "live")
          ? "Compared candidates against budget and cited concerns from live search."
          : "Compared candidates using a mix of live search and labelled demo evidence.",
      ),
      event(
        4,
        "Stopped for human approval before any purchase handoff. Opening a merchant page is not a completed order.",
      ),
    ],
  };
}
