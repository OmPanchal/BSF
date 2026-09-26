export type Evidence = {
  url: string;
  title: string;
  excerpt: string;
  sourceType: "forum" | "retailer" | "manufacturer" | "other";
  publishedAt?: string;
};

export type ProductMatch = {
  kind: "exact" | "similar";
  // Why a similar product falls short, e.g. "£4.99 over your £25 budget".
  notes: string[];
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
  match?: ProductMatch;
};

export type SearchConstraints = {
  query: string;
  product: string;
  // Must appear in the listing title (or a synonym), e.g. "noise cancelling", "sony".
  keywords: string[];
  // Soft preferences used only for ranking, e.g. "secure fit".
  preferences: string[];
  excludes: string[];
  minPricePence?: number;
  maxPricePence?: number;
  preferCheap: boolean;
  // True when the buyer asked for a case/cover/etc., not the device itself.
  allowAccessories: boolean;
  // Clean merchant query, e.g. "Apple MacBook Pro 2025 laptop".
  searchQuery: string;
  tavilyQuery?: string;
  // Set when the buyer named a model ("WH-1000XM5", "MacBook Pro 2025"). Tavily searches this string.
  specificProduct?: string;
};

export type ProductSearchResponse = {
  products: Product[];
  similar: Product[];
  constraints?: SearchConstraints;
  source: "live" | "demo_fixture";
  warning?: string;
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
