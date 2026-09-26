import type { AgentTask, Product, SocialProofAudit } from "@/types/contracts";

export type BuyerSearchResult = {
  products: Product[];
  audits: SocialProofAudit[];
  task: AgentTask | null;
  source: "live" | "demo_fixture";
  warnings: string[];
};

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

function errorText(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === "string" ? data.error : fallback;
}

export async function runBuyerSearch(intent: string): Promise<BuyerSearchResult> {
  const productResponse = await fetch(
    `/api/products?q=${encodeURIComponent(intent)}`,
  );
  const productData = await readJson(productResponse);
  if (!productResponse.ok) {
    throw new Error(errorText(productData, "Search failed."));
  }

  const warning =
    typeof productData.warning === "string" ? productData.warning : undefined;
  const products = Array.isArray(productData.products)
    ? (productData.products as Product[])
    : [];
  if (!products.length) {
    throw new Error(warning ?? "No products matched that search.");
  }

  const warnings = warning ? [warning] : [];
  const candidateIds = products.map((product) => product.id);

  const [auditResults, taskResult] = await Promise.all([
    Promise.allSettled(
      candidateIds.map(async (productId) => {
        const response = await fetch("/api/social-proof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        const data = await readJson(response);
        if (!response.ok) {
          throw new Error(errorText(data, "Evidence lookup failed."));
        }
        return data as unknown as SocialProofAudit;
      }),
    ),
    fetch("/api/agent-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent, candidateIds }),
    })
      .then(async (response) => {
        const data = await readJson(response);
        if (!response.ok) {
          throw new Error(errorText(data, "Recommendation failed."));
        }
        return data as unknown as AgentTask;
      })
      .then(
        (task) => ({ task, error: undefined }),
        (caught: unknown) => ({
          task: null,
          error: caught instanceof Error ? caught.message : "Recommendation failed.",
        }),
      ),
  ]);

  const audits: SocialProofAudit[] = [];
  let failedAudits = 0;
  for (const result of auditResults) {
    if (result.status === "fulfilled") {
      audits.push(result.value);
    } else {
      failedAudits += 1;
    }
  }
  if (failedAudits > 0) {
    warnings.push(
      `Evidence lookup failed for ${failedAudits} of ${candidateIds.length} products.`,
    );
  }
  if (taskResult.error) {
    warnings.push(taskResult.error);
  }

  return {
    products,
    audits,
    task: taskResult.task,
    source: productData.source === "demo_fixture" ? "demo_fixture" : "live",
    warnings,
  };
}
