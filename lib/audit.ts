import { getDemoAudit } from "@/lib/demoFixture";
import {
  clearAuditInflight,
  getAuditInflight,
  getCachedAudit,
  getCatalogProduct,
  rememberAudit,
  setAuditInflight,
} from "@/lib/catalog";
import { completeJson, getGeminiApiKey } from "@/lib/llm";
import { tavilySearch, getTavilyApiKey, type TavilyResult } from "@/lib/tavily";
import type { Claim, Evidence, Product, SocialProofAudit } from "@/types/contracts";

function sourceTypeFor(url: string): Evidence["sourceType"] {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (/reddit|forum|community/.test(host)) return "forum";
  if (/amazon\.|argos\.|johnlewis\.|currys\./.test(host)) return "retailer";
  if (/sony\.|apple\.|bose\.|jabra\.|sennheiser\./.test(host)) return "manufacturer";
  return "other";
}

function reviewQuery(product: Product): string {
  const label = `${product.brand} ${product.name}`;
  const model = label.match(/\b[A-Za-z]{0,8}-?\d[A-Za-z0-9-]{2,}\b/)?.[0];
  const name = model ? `${product.brand} ${model}` : label.split(/\s+/).slice(0, 6).join(" ");
  return `${name} review pros cons`;
}

function mentionsProduct(product: Product, result: TavilyResult): boolean {
  const hay = `${result.title} ${result.content}`.toLowerCase().replace(/-/g, "");
  const model = `${product.brand} ${product.name}`
    .toLowerCase()
    .replace(/-/g, "")
    .match(/[a-z]*\d[a-z0-9]{3,}/)?.[0];
  if (model && !/^(?:19|20)\d{2}$/.test(model) && !hay.includes(model)) return false;
  const tokens = `${product.brand} ${product.name}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3 && !/^(with|wireless|premium|black|white|noise)$/.test(token));
  if (tokens.length === 0) return true;
  const hits = tokens.filter((token) => hay.includes(token));
  return hits.length >= Math.min(2, tokens.length);
}

function toEvidence(results: TavilyResult[]): Evidence[] {
  const seen = new Set<string>();
  const sources: Evidence[] = [];
  for (const result of results) {
    if (!result.url || !result.content.trim() || seen.has(result.url)) continue;
    seen.add(result.url);
    sources.push({
      url: result.url,
      title: result.title,
      excerpt: result.content.slice(0, 320),
      sourceType: sourceTypeFor(result.url),
      publishedAt: result.publishedDate,
    });
  }
  return sources.slice(0, 8);
}

function claimUrl(sources: Evidence[], item: Record<string, unknown>): string | undefined {
  const index =
    typeof item.source === "number"
      ? item.source
      : typeof item.source === "string"
        ? Number(item.source)
        : NaN;
  if (Number.isInteger(index) && index >= 1 && index <= sources.length) {
    return sources[index - 1]?.url;
  }
  const urls = Array.isArray(item.evidenceUrls) ? item.evidenceUrls : [];
  for (const url of urls) {
    if (typeof url !== "string") continue;
    const hit = sources.find(
      (source) => source.url === url || source.url.replace(/\/$/, "") === url.replace(/\/$/, ""),
    );
    if (hit) return hit.url;
  }
  return undefined;
}

function overlapScore(text: string, source: Evidence): number {
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3);
  if (tokens.length === 0) return 0;
  const hay = `${source.title} ${source.excerpt}`.toLowerCase();
  return tokens.filter((token) => hay.includes(token)).length;
}

function citedUrl(text: string, sources: Evidence[], item: Record<string, unknown>): string | undefined {
  const cited = claimUrl(sources, item);
  let best: Evidence | undefined;
  let bestScore = 0;
  for (const source of sources) {
    const score = overlapScore(text, source);
    if (score > bestScore) {
      best = source;
      bestScore = score;
    }
  }
  const citedSource = cited ? sources.find((source) => source.url === cited) : undefined;
  const citedScore = citedSource ? overlapScore(text, citedSource) : 0;
  if (best && bestScore > citedScore) return best.url;
  return cited ?? best?.url;
}

function asClaims(value: unknown, sources: Evidence[]): Claim[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const text = typeof record.text === "string" ? record.text.trim() : "";
      const url = text ? citedUrl(text, sources, record) : undefined;
      if (!text || !url) return [];
      return [{ text, evidenceUrls: [url], confidence: "medium" as const }];
    })
    .slice(0, 4);
}

async function geminiReview(
  product: Product,
  sources: Evidence[],
): Promise<Pick<SocialProofAudit, "verdict" | "pros" | "concerns" | "confidence" | "status"> | undefined> {
  if (!getGeminiApiKey() || sources.length === 0) return undefined;
  const payload = (await completeJson(
    [
      "Extract a short pros and cons list for this product from the numbered snippets only.",
      "Return JSON: {\"verdict\": string, \"pros\": [{\"text\": string, \"source\": number}], \"concerns\": [{\"text\": string, \"source\": number}], \"confidence\": \"low\"|\"medium\"|\"high\"}.",
      "source is the snippet number, and each claim must use the number of the snippet it came from. Different claims should cite different snippets when the facts come from different pages.",
      "Each text is one short sentence stating a single fact from the snippets. Do not invent reviews.",
    ].join(" "),
    sources
      .map((source, index) => `[${index + 1}] ${source.title}\n${source.excerpt}`)
      .join("\n\n") + `\n\nProduct: ${product.brand} ${product.name}`,
  )) as Record<string, unknown> | null;
  if (!payload || typeof payload.verdict !== "string" || !payload.verdict.trim()) {
    console.error("[audit] gemini payload", payload && typeof payload === "object" ? Object.keys(payload) : payload);
    return undefined;
  }
  const pros = asClaims(payload.pros, sources);
  const concerns = asClaims(payload.concerns, sources);
  const confidence =
    payload.confidence === "high" || payload.confidence === "medium" || payload.confidence === "low"
      ? payload.confidence
      : "low";
  return {
    verdict: payload.verdict.trim(),
    pros,
    concerns,
    confidence,
    status: pros.length + concerns.length > 0 ? "complete" : "insufficient_evidence",
  };
}

async function buildAudit(product: Product): Promise<SocialProofAudit> {
  const demo = getDemoAudit(product.id);
  let sources: Evidence[] = [];
  if (getTavilyApiKey()) {
    try {
      const found = await tavilySearch(reviewQuery(product), {
        maxResults: 8,
        searchDepth: "advanced",
        excludeDomains: ["amazon.co.uk", "www.amazon.co.uk"],
        timeoutMs: 12_000,
      });
      sources = toEvidence(found.results.filter((result) => mentionsProduct(product, result)));
    } catch {
      sources = [];
    }
  }

  const reviewed = await geminiReview(product, sources).catch((error: unknown) => {
    console.error("[audit] gemini review failed", error instanceof Error ? error.message : error);
    return undefined;
  });
  if (reviewed) {
    return {
      productId: product.id,
      mode: "live",
      sourceCount: sources.length,
      sources,
      assessedAt: new Date().toISOString(),
      ...reviewed,
    };
  }

  if (demo) return demo;
  return {
    productId: product.id,
    status: "insufficient_evidence",
    mode: sources.length > 0 ? "live" : "demo_fixture",
    verdict: sources.length
      ? `Found ${sources.length} pages about ${product.brand} ${product.name}, but Gemini did not extract grounded pros or cons.`
      : `No independent review pages were found for ${product.brand} ${product.name}.`,
    pros: [],
    concerns: [],
    sources,
    sourceCount: sources.length,
    confidence: "low",
    assessedAt: new Date().toISOString(),
  };
}

function citationsCollapsed(audit: SocialProofAudit): boolean {
  const urls = new Set(
    [...audit.pros, ...audit.concerns].flatMap((claim) => claim.evidenceUrls),
  );
  return audit.sources.length > 1 && urls.size <= 1 && audit.pros.length + audit.concerns.length > 1;
}

export async function auditProduct(productId: string): Promise<SocialProofAudit> {
  const cached = getCachedAudit(productId);
  if (
    cached &&
    !citationsCollapsed(cached) &&
    (cached.pros.length + cached.concerns.length > 0 || cached.mode === "demo_fixture")
  ) {
    return cached;
  }
  const inflight = getAuditInflight(productId);
  if (inflight) return inflight;

  const product = getCatalogProduct(productId);
  const promise = (product ? buildAudit(product) : Promise.resolve(getDemoAudit(productId))).then(
    (audit) => {
      if (!audit) throw new Error(`Unknown productId: ${productId}`);
      rememberAudit(audit);
      return audit;
    },
  );
  setAuditInflight(productId, promise);
  try {
    return await promise;
  } finally {
    clearAuditInflight(productId);
  }
}
