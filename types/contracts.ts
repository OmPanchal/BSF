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
