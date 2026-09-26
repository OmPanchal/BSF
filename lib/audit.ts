import { getDemoAudit } from "@/lib/demoFixture";
import {
  clearAuditInflight,
  getAuditInflight,
  getCachedAudit,
  getCatalogProduct,
  rememberAudit,
  setAuditInflight,
} from "@/lib/catalog";
import { completeJson, hasLlmAccess } from "@/lib/llm";
import { tavilySearch, type TavilyResult } from "@/lib/tavily";
import type {
  Claim,
  Evidence,
  Product,
  SocialProofAudit,
} from "@/types/contracts";

function sourceTypeFor(url: string): Evidence["sourceType"] {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (host.includes("reddit.com") || host.includes("forum")) {
    return "forum";
  }
  if (
    host.includes("amazon.") ||
    host.includes("argos.") ||
    host.includes("johnlewis.") ||
    host.includes("currys.")
  ) {
    return "retailer";
  }
  if (
    host.includes("jabra.") ||
    host.includes("sony.") ||
    host.includes("apple.") ||
    host.includes("bose.") ||
    host.includes("sennheiser.")
  ) {
    return "manufacturer";
  }
  return "other";
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString();
  } catch {
    return url;
  }
}

function toEvidence(results: TavilyResult[]): Evidence[] {
  const seen = new Set<string>();
  const sources: Evidence[] = [];
  for (const result of results) {
    const url = normalizeUrl(result.url);
    if (seen.has(url) || !result.content.trim()) {
      continue;
    }
    seen.add(url);
    sources.push({
      url,
      title: result.title,
      excerpt: result.content.slice(0, 280),
      sourceType: sourceTypeFor(url),
      publishedAt: result.publishedDate,
    });
  }
  return sources;
}

function asClaims(value: unknown, allowedUrls: Set<string>): Claim[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const claims: Claim[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const text = "text" in item && typeof item.text === "string" ? item.text.trim() : "";
    if (!text) {
      continue;
    }
    const evidenceUrls = (
      "evidenceUrls" in item && Array.isArray(item.evidenceUrls)
        ? item.evidenceUrls.filter(
            (url: unknown): url is string => typeof url === "string",
          )
        : []
    ).filter(
      (url: string) => allowedUrls.has(url) || allowedUrls.has(normalizeUrl(url)),
    );
    if (evidenceUrls.length === 0) {
      continue;
    }
    const confidence =
      "confidence" in item &&
      (item.confidence === "low" ||
        item.confidence === "medium" ||
        item.confidence === "high")
        ? item.confidence
        : "low";
    claims.push({ text, evidenceUrls, confidence });
  }
  return claims;
}

function confidenceFromSources(sourceCount: number): SocialProofAudit["confidence"] {
  if (sourceCount >= 4) {
    return "medium";
  }
  if (sourceCount >= 2) {
    return "low";
  }
  return "low";
}

async function liveAudit(product: Product): Promise<SocialProofAudit> {
  const modelLabel = `${product.brand} ${product.name}`.trim();
  const queries = [
    `"${modelLabel}" reliability reddit`,
    `"${modelLabel}" problem forum`,
    `"${modelLabel}" review`,
  ];

  const batches = await Promise.all(
    queries.map((query) =>
      tavilySearch(query, {
        maxResults: 5,
        timeoutMs: 12_000,
        excludeDomains: ["pinterest.com", "facebook.com"],
      }).catch(() => ({ results: [], images: [] })),
    ),
  );

  const sources = toEvidence(batches.flatMap((batch) => batch.results)).slice(0, 8);
  const allowedUrls = new Set(sources.map((source) => source.url));

  if (sources.length === 0) {
    return {
      productId: product.id,
      status: "insufficient_evidence",
      mode: "live",
      verdict: `No independent snippets were found for ${modelLabel}. Treat merchant ratings as unconfirmed.`,
      pros: [],
      concerns: [],
      sources: [],
      sourceCount: 0,
      confidence: "low",
      assessedAt: new Date().toISOString(),
    };
  }

  if (!hasLlmAccess()) {
    return {
      productId: product.id,
      status: "insufficient_evidence",
      mode: "live",
      verdict: `Found ${sources.length} independent pages for ${modelLabel}, but no model API key is configured to extract grounded claims.`,
      pros: [],
      concerns: [],
      sources,
      sourceCount: sources.length,
      confidence: "low",
      assessedAt: new Date().toISOString(),
    };
  }

  const payload = await completeJson(
    "Extract product-specific pros and concerns from these snippets. Every claim must cite one or more provided URLs. Do not infer defect rates, fake-review counts, or long-term durability from sparse snippets. Mark uncertainty explicitly. Return JSON matching {\"verdict\":\"string\",\"status\":\"complete\"|\"insufficient_evidence\",\"pros\":[{\"text\":\"\",\"evidenceUrls\":[],\"confidence\":\"low\"|\"medium\"|\"high\"}],\"concerns\":[...]}",
    JSON.stringify({
      product: { id: product.id, brand: product.brand, name: product.name },
      sources,
    }),
  );

  const object = payload && typeof payload === "object" ? payload : {};
  const status =
    "status" in object &&
    (object.status === "complete" || object.status === "insufficient_evidence")
      ? object.status
      : sources.length >= 2
        ? "complete"
        : "insufficient_evidence";
  const verdict =
    "verdict" in object && typeof object.verdict === "string" && object.verdict.trim()
      ? object.verdict.trim()
      : `Independent snippets for ${modelLabel} are limited; claims below are only those tied to a source URL.`;

  const pros = asClaims("pros" in object ? object.pros : [], allowedUrls).slice(0, 3);
  const concerns = asClaims(
    "concerns" in object ? object.concerns : [],
    allowedUrls,
  ).slice(0, 3);

  return {
    productId: product.id,
    status,
    mode: "live",
    verdict,
    pros,
    concerns,
    sources,
    sourceCount: sources.length,
    confidence: confidenceFromSources(sources.length),
    assessedAt: new Date().toISOString(),
  };
}

export async function auditProduct(productId: string): Promise<SocialProofAudit> {
  const cached = getCachedAudit(productId);
  if (cached) {
    return cached;
  }

  const inflight = getAuditInflight(productId);
  if (inflight) {
    return inflight;
  }

  const work = (async () => {
    const product = getCatalogProduct(productId);
    if (!product) {
      const fixture = getDemoAudit(productId);
      if (fixture) {
        rememberAudit(fixture);
        return fixture;
      }
      throw new Error(`Unknown productId: ${productId}`);
    }

    try {
      const audit = await liveAudit(product);
      rememberAudit(audit);
      return audit;
    } catch {
      const fixture = getDemoAudit(productId);
      if (fixture) {
        rememberAudit(fixture);
        return fixture;
      }
      const failed: SocialProofAudit = {
        productId,
        status: "error",
        mode: "live",
        verdict:
          "Live evidence search failed. No demo snapshot exists for this product, so no claims are shown.",
        pros: [],
        concerns: [],
        sources: [],
        sourceCount: 0,
        confidence: "low",
        assessedAt: new Date().toISOString(),
      };
      rememberAudit(failed);
      return failed;
    }
  })();

  setAuditInflight(productId, work);
  try {
    return await work;
  } finally {
    clearAuditInflight(productId);
  }
}
