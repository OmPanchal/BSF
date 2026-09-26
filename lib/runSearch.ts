import type { AgentTask, Product, SocialProofAudit } from "@/types/contracts";

export async function runBuyerSearch(intent: string): Promise<{
  products: Product[];
  audits: SocialProofAudit[];
  task: AgentTask;
}> {
  const productResponse = await fetch(
    `/api/products?q=${encodeURIComponent(intent)}`,
  );
  const productData = await productResponse.json();
  if (!productResponse.ok) {
    throw new Error(productData.error ?? "Search failed.");
  }

  const products: Product[] = productData.products ?? [];
  if (!products.length) {
    throw new Error("No products matched that search.");
  }

  const candidateIds = products.map((product) => product.id);
  const [audits, taskResponse] = await Promise.all([
    Promise.all(
      candidateIds.map(async (productId) => {
        const response = await fetch("/api/social-proof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Evidence lookup failed.");
        }
        return data as SocialProofAudit;
      }),
    ),
    fetch("/api/agent-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent, candidateIds }),
    }),
  ]);

  const taskData = await taskResponse.json();
  if (!taskResponse.ok) {
    throw new Error(taskData.error ?? "Recommendation failed.");
  }

  return { products, audits, task: taskData as AgentTask };
}
