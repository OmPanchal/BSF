import type {
  AgentTask,
  Product,
  SearchConstraints,
  SocialProofAudit,
} from "@/types/contracts";

export type BuyerSearchResult = {
  products: Product[];
  similar: Product[];
  constraints?: SearchConstraints;
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

export async function fetchAgentTask(intent: string, candidateIds: string[]): Promise<AgentTask> {
  const response = await fetch("/api/agent-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, candidateIds }),
  });
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(errorText(data, "Recommendation failed."));
  }
  return data as unknown as AgentTask;
}

export async function fetchAudit(productId: string): Promise<SocialProofAudit> {
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
}

export type SearchStreamHandlers = {
  onConstraints: (constraints: SearchConstraints) => void;
  onProduct: (product: Product) => void;
  onDone: (info: { source: "live" | "demo_fixture"; warning?: string }) => void;
};

export async function streamBuyerSearch(
  intent: string,
  handlers: SearchStreamHandlers,
): Promise<void> {
  const response = await fetch(`/api/products?q=${encodeURIComponent(intent)}`);
  if (!response.ok || !response.body) {
    const data = await readJson(response);
    throw new Error(errorText(data, "Search failed."));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const take = async (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as Record<string, unknown>;
    if (event.type === "constraints" && event.constraints && typeof event.constraints === "object") {
      handlers.onConstraints(event.constraints as SearchConstraints);
    } else if (event.type === "product" && event.product && typeof event.product === "object") {
      handlers.onProduct(event.product as Product);
      await new Promise((resolve) => setTimeout(resolve, 40));
    } else if (event.type === "done") {
      handlers.onDone({
        source: event.source === "demo_fixture" ? "demo_fixture" : "live",
        warning: typeof event.warning === "string" ? event.warning : undefined,
      });
    } else if (event.type === "error") {
      throw new Error(typeof event.error === "string" ? event.error : "Search failed.");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) await take(line);
    if (done) break;
  }
  if (buffer.trim()) await take(buffer);
}

export async function runBuyerSearch(intent: string): Promise<BuyerSearchResult> {
  const products: Product[] = [];
  const similar: Product[] = [];
  let constraints: SearchConstraints | undefined;
  let source: "live" | "demo_fixture" = "live";
  let warning: string | undefined;
  await streamBuyerSearch(intent, {
    onConstraints: (next) => {
      constraints = next;
    },
    onProduct: (product) => {
      if (product.match?.kind === "similar") similar.push(product);
      else products.push(product);
    },
    onDone: (info) => {
      source = info.source;
      warning = info.warning;
    },
  });

  const warnings = warning ? [warning] : [];
  if (!products.length && !similar.length) {
    return {
      products: [],
      similar: [],
      constraints,
      audits: [],
      task: null,
      source,
      warnings: warnings.length
        ? warnings
        : ["No UK listings matched that search with a confirmed price."],
    };
  }
  const candidateIds = (products.length ? products : similar).map((product) => product.id);
  const [auditResults, taskResult] = await Promise.all([
    Promise.allSettled(candidateIds.map(fetchAudit)),
    fetchAgentTask(intent, candidateIds)
      .then(
        (task) => ({ task, error: undefined as string | undefined }),
        (caught: unknown) => ({
          task: null,
          error: caught instanceof Error ? caught.message : "Recommendation failed.",
        }),
      ),
  ]);

  const audits: SocialProofAudit[] = [];
  let failedAudits = 0;
  for (const result of auditResults) {
    if (result.status === "fulfilled") audits.push(result.value);
    else failedAudits += 1;
  }
  if (failedAudits > 0) {
    warnings.push(`Evidence lookup failed for ${failedAudits} of ${candidateIds.length} products.`);
  }
  if (taskResult.error) warnings.push(taskResult.error);

  return { products, similar, constraints, audits, task: taskResult.task, source, warnings };
}
