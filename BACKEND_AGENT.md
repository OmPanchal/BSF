# GrokTruth — backend and agent handoff

Paste this entire file into your Cursor chat. You own backend/API code. Coordinate on the contracts below; do not edit frontend component files. The goal is a working buyer experience by the 4:45 pm code freeze on 26 September 2026.

## Product in one sentence

A buyer asks Grok Bot to find a product under constraints; the bot consults an independent, source-linked evidence service, compares candidates, and prepares a purchase for human approval.

## Demo story and scope

The buyer wants workout earbuds under £100. A merchant listing with a high native rating looks attractive, but independent discussions reveal a relevant concern; another candidate fits the buyer better. The UI shows the bot's search, evidence, decision, and approved handoff. Use 2–4 real products in **one category**. Do not present fictional listings or fabricated forum posts as real. A clearly labelled fixture is acceptable when live search fails.

The actual Grok Bot integration method must be confirmed with event staff/docs before implementation. Grok Bot and the Grok model API are different products. Calling a model API does not by itself mean a Grok Bot performed the task. Expose `agentMode: "grok-bot" | "demo-simulation"` and label the latter clearly. Never emit fake browser logs or an order ID claiming a purchase occurred. If bot access is unavailable, ship the real evidence service and an explicitly simulated task timeline.

## Ownership

- `app/api/products/route.ts`
- `app/api/social-proof/route.ts`
- `app/api/agent-task/route.ts` and, if available, `app/api/agent-task/[id]/route.ts`
- `app/api/checkout/route.ts` only if an actual sandbox checkout integration exists
- `lib/catalog.ts`, `lib/tavily.ts`, `lib/audit.ts`, `lib/agent.ts`, `lib/demoFixture.ts`
- `types/contracts.ts` — create this first and tell the frontend teammate its path

Do not install a second framework or refactor the frontend. Next.js App Router and TypeScript are the shared assumptions; adjust paths together if the repo differs.

## Shared TypeScript contract

Put these types in `types/contracts.ts`. Use GBP minor units to avoid ambiguous money arithmetic.

```ts
export type Evidence = {
  url: string;
  title: string;
  excerpt: string;
  sourceType: "forum" | "retailer" | "manufacturer" | "other";
  publishedAt?: string;
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  pricePence: number;
  currency: "GBP";
  merchantUrl: string;
  imageUrl?: string;
  merchantRating?: number;
  merchantReviewCount?: number;
  category: string;
  attributes: Record<string, string | number | boolean>;
};

export type Claim = {
  text: string;
  evidenceUrls: string[];
  confidence: "low" | "medium" | "high";
};

export type SocialProofAudit = {
  productId: string;
  status: "complete" | "insufficient_evidence" | "error";
  mode: "live" | "demo_fixture";
  verdict: string;
  pros: Claim[];
  concerns: Claim[];
  sources: Evidence[];
  sourceCount: number;
  confidence: "low" | "medium" | "high";
  assessedAt: string;
  // Optional, only when a documented, reproducible scoring rule is implemented.
  trustScore?: number;
};

export type AgentEvent = {
  step: number;
  timestamp: string;
  status: "pending" | "in_progress" | "success" | "failed";
  message: string;
  sourceUrl?: string;
};

export type AgentTask = {
  taskId: string;
  agentMode: "grok-bot" | "demo-simulation";
  status: "running" | "awaiting_approval" | "completed" | "failed";
  intent: string;
  candidateIds: string[];
  selectedProductId?: string;
  rationale?: string;
  events: AgentEvent[];
};
```

## API endpoints

### `GET /api/products?q=...`

Return `{ products: Product[] }`. Match the seeded catalogue against buyer intent. Validate query length. Include real merchant URLs and a known price snapshot; display that the price may change. Product discovery from Shopify can be added if credentials and a usable catalogue are provided. Do not block the demo on Shopify setup.

### `POST /api/social-proof`

Input `{ productId: string }`. Lookup the canonical name and model in the catalogue instead of trusting a client-supplied product name. Return `SocialProofAudit`.

1. Search Tavily for **this exact model**, with two or three focused queries such as `"model name" reliability reddit`, `"model name" problem forum`, and `"model name" review`. Keep result counts bounded and use timeouts.
2. Deduplicate by normalized URL. Reject irrelevant model variants and empty snippets. Retain URLs, titles, snippets, and dates where available.
3. Ask the available LLM for structured claims **grounded only in those snippets**. It must attach source URLs to each claim, distinguish repeated reports from single anecdotes, avoid quantitative prevalence claims without a denominator, and return `insufficient_evidence` if results are weak. Validate the JSON response server side.
4. Cache per product for the demo. Never put API keys in client code or `NEXT_PUBLIC_` variables.
5. If Tavily or the LLM fails, return an honest error or an explicitly labelled `demo_fixture`; never silently substitute invented evidence.

Do not claim to detect or count fake reviews. Search snippets cannot establish that. Do not call pros “verified” unless the sources genuinely support them. A score is optional; if added, document the exact rule and show source count/confidence beside it. The main output is a cited verdict and relevant concerns.

Suggested model instruction: “Extract product-specific pros and concerns from these snippets. Every claim must cite one or more provided URLs. Do not infer defect rates, fake-review counts, or long-term durability from sparse snippets. Mark uncertainty explicitly. Return JSON matching the supplied schema.”

### `POST /api/agent-task`

Input `{ intent: string, candidateIds: string[] }`. Return an `AgentTask`. If event-provided Grok Bot integration is available, dispatch the buyer task and persist its real events. Give the bot access to product search and the audit endpoint using the actual supported tool mechanism. Never expose Tavily or model keys to the bot's browser. The bot should compare against budget/use case and stop at `awaiting_approval` with a chosen product and rationale.

If the event integration does not allow app-driven Grok Bot tasks, return a clearly marked `demo-simulation` task grounded in actual products/audits. The UI must show that mode. Do not describe generated progress text as real cloud-browser activity. Poll `GET /api/agent-task/:id` if tasks are asynchronous; simple polling is enough for a hackathon.

### Approval and checkout

Approval is a separate action. Opening a merchant page or preparing a cart is not a completed purchase. Only return `completed` with an order ID after a **real sandbox/test checkout response** confirms it. Otherwise return an approved merchant/cart link and a status such as `awaiting_approval` or `handoff_ready` (coordinate enum change with frontend). Never collect or log real card numbers or shipping addresses for this demo.

## Deterministic demo fixture

Provide one checked, reproducible fixture with real product identifiers and source links if possible. The fixture is `mode: "demo_fixture"`, visually labelled “Demo evidence snapshot”. Do not invent product ratings, prices, Reddit counts, defect percentages, discount codes, or orders. If real evidence is sparse, make the demo about an uncertain recommendation rather than a false dramatic flaw.

## First integration checkpoint

1. Commit/export `types/contracts.ts` and a working `GET /api/products` first.
2. Send the frontend teammate one sample JSON for `/api/products`, `/api/social-proof`, and `/api/agent-task`, plus whether Grok Bot integration is actually available.
3. Get `/api/social-proof` returning cited output for one product before scaling to more.
4. Do one end-to-end dry run by 3 pm. Keep a demo fixture for API failures.

## Acceptance checks

- Search returns valid, linked products under the requested budget.
- Every displayed evidence claim links to a source; no unsupported counts appear.
- Bot versus simulation mode is explicit in the API and UI.
- Approval precedes any purchase action; success is shown only after a confirmed sandbox response.
- The full demo completes in under three minutes.

## Environment

Use `.env.local` locally (never commit it): `TAVILY_API_KEY`, one available model API key (for example `OPENAI_API_KEY`), and any event-issued Grok Bot credentials. Confirm the model and Grok Bot access actually provided at the venue before hardcoding SDKs or model names.
