import type {
  AgentTask,
  Product,
  SocialProofAudit,
} from "@/types/contracts";

export const DEMO_ASSESSED_AT = "2026-09-26T10:00:00.000Z";

export const DEMO_PRODUCTS: Product[] = [
  {
    id: "sony-wf-c700n",
    name: "WF-C700N",
    brand: "Sony",
    pricePence: 7900,
    currency: "GBP",
    merchantUrl:
      "https://www.amazon.co.uk/Sony-WF-C700N-Cancelling-Headphones-Resistant/dp/B0BYPX4Q6X",
    imageUrl:
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
    merchantRating: 4.6,
    merchantReviewCount: 18432,
    category: "workout-earbuds",
    attributes: {
      listedUse: "everyday commute",
      noiseCancelling: true,
      ipRating: "IPX4",
    },
  },
  {
    id: "jabra-elite-4-active",
    name: "Elite 4 Active",
    brand: "Jabra",
    pricePence: 6900,
    currency: "GBP",
    merchantUrl:
      "https://www.amazon.co.uk/Jabra-Elite-Active-Bluetooth-Earbuds/dp/B09N6X5K6P",
    imageUrl:
      "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?auto=format&fit=crop&w=800&q=80",
    merchantRating: 4.3,
    merchantReviewCount: 9124,
    category: "workout-earbuds",
    attributes: {
      listedUse: "training and running",
      noiseCancelling: true,
      ipRating: "IP57",
    },
  },
];

const SONY_SOURCES = [
  {
    url: "https://www.rtings.com/headphones/reviews/sony/wf-c700n",
    title: "Sony WF-C700N Headphones Review — RTINGS.com",
    excerpt:
      "Comfortable for seated listening; the shallow tips are less secure when you move your head quickly.",
    sourceType: "other" as const,
    publishedAt: "2023-08-15",
  },
  {
    url: "https://www.reddit.com/r/SonyHeadphones/comments/15k3n0h/wfc700n_keep_falling_out/",
    title: "WF-C700N keep falling out : r/SonyHeadphones",
    excerpt:
      "Several posters report the buds shifting or dropping during walks and light exercise even with the stock tips.",
    sourceType: "forum" as const,
    publishedAt: "2023-08-08",
  },
];

const JABRA_SOURCES = [
  {
    url: "https://www.rtings.com/headphones/reviews/jabra/elite-4-active",
    title: "Jabra Elite 4 Active Headphones Review — RTINGS.com",
    excerpt:
      "Designed for workouts: more stable in-ear fit and a higher IP rating than typical commute buds.",
    sourceType: "other" as const,
    publishedAt: "2023-03-20",
  },
  {
    url: "https://www.jabra.com/sports-headphones/jabra-elite-4-active",
    title: "Jabra Elite 4 Active — manufacturer page",
    excerpt:
      "Manufacturer lists IP57 dust and water protection and a secure active fit for training.",
    sourceType: "manufacturer" as const,
  },
];

export const DEMO_AUDITS: Record<string, SocialProofAudit> = {
  "sony-wf-c700n": {
    productId: "sony-wf-c700n",
    status: "complete",
    mode: "demo_fixture",
    verdict:
      "Strong everyday listing with a high merchant rating, but independent discussion flags an insecure fit when you move — a poor match for workout use.",
    pros: [
      {
        text: "Reviewers describe solid noise cancelling and sound for the price on commutes.",
        evidenceUrls: [SONY_SOURCES[0].url],
        confidence: "medium",
      },
    ],
    concerns: [
      {
        text: "Forum and lab notes describe the buds shifting or falling out during movement; this is not a prevalence count.",
        evidenceUrls: [SONY_SOURCES[0].url, SONY_SOURCES[1].url],
        confidence: "medium",
      },
    ],
    sources: SONY_SOURCES,
    sourceCount: SONY_SOURCES.length,
    confidence: "medium",
    assessedAt: DEMO_ASSESSED_AT,
  },
  "jabra-elite-4-active": {
    productId: "jabra-elite-4-active",
    status: "complete",
    mode: "demo_fixture",
    verdict:
      "Lower merchant rating than the Sony listing, but independent and manufacturer sources align with secure fit and sweat resistance under £100.",
    pros: [
      {
        text: "Independent testing and the manufacturer both describe a workout-oriented, more stable fit.",
        evidenceUrls: [JABRA_SOURCES[0].url, JABRA_SOURCES[1].url],
        confidence: "medium",
      },
      {
        text: "IP57 rating is documented by the manufacturer for dust and water during training.",
        evidenceUrls: [JABRA_SOURCES[1].url],
        confidence: "high",
      },
    ],
    concerns: [
      {
        text: "Independent coverage of long-term durability is still limited; treat longevity as uncertain.",
        evidenceUrls: [JABRA_SOURCES[0].url],
        confidence: "low",
      },
    ],
    sources: JABRA_SOURCES,
    sourceCount: JABRA_SOURCES.length,
    confidence: "medium",
    assessedAt: DEMO_ASSESSED_AT,
  },
};

export const RECOMMENDED_PRODUCT_ID = "jabra-elite-4-active";

export function getDemoProducts(): Product[] {
  return DEMO_PRODUCTS;
}

export function getDemoAudit(productId: string): SocialProofAudit | undefined {
  return DEMO_AUDITS[productId];
}

export function getDemoAgentTask(
  intent: string,
  candidateIds: string[],
): AgentTask {
  const ids =
    candidateIds.length > 0
      ? candidateIds
      : DEMO_PRODUCTS.map((product) => product.id);

  return {
    taskId: "demo-task-earbuds-001",
    agentMode: "demo-simulation",
    status: "awaiting_approval",
    intent,
    candidateIds: ids,
    selectedProductId: RECOMMENDED_PRODUCT_ID,
    rationale:
      "Both options are under £100. The Sony listing has the higher merchant rating, but independent notes about fit during movement conflict with a workout brief. The Jabra Elite 4 Active is the better match for secure fit and sweat resistance, with remaining uncertainty about long-term durability.",
    events: [
      {
        step: 1,
        timestamp: "2026-09-26T10:00:01.000Z",
        status: "success",
        message: "Matched the seeded catalogue for workout earbuds under £100.",
      },
      {
        step: 2,
        timestamp: "2026-09-26T10:00:02.000Z",
        status: "success",
        message:
          "Read the labelled demo evidence snapshot for Sony WF-C700N (fit during movement).",
        sourceUrl: SONY_SOURCES[1].url,
      },
      {
        step: 3,
        timestamp: "2026-09-26T10:00:03.000Z",
        status: "success",
        message:
          "Read the labelled demo evidence snapshot for Jabra Elite 4 Active (workout fit / IP57).",
        sourceUrl: JABRA_SOURCES[0].url,
      },
      {
        step: 4,
        timestamp: "2026-09-26T10:00:04.000Z",
        status: "success",
        message:
          "Compared candidates against secure fit and sweat resistance. Stopped for human approval before any purchase handoff.",
      },
    ],
  };
}
