# GrokTruth — frontend and demo handoff

Paste this entire file into your Cursor chat. You own the buyer interface and three-minute demo. Coordinate against `types/contracts.ts` created by the backend teammate. The goal is a working buyer experience by the 4:45 pm code freeze on 26 September 2026.

## Product in one sentence

A buyer tells Grok Bot what to buy. It examines real candidate products and independent, source-linked discussion, then recommends an option and asks for approval before any purchase handoff.

## The demo narrative

“Find me workout earbuds under £100.” Start with two or three products, including one whose high merchant rating makes it look appealing. Show the agent investigating a relevant concern from independent sources, choosing a better fit for this buyer, and asking for human approval. The punchline is the *reasoned choice with evidence*, not an arbitrary 94/100 badge or animated terminal text.

Use the same one category as the backend. The UI may use a clearly labelled evidence snapshot if live search fails. Do not present fictional reviews, defect rates, prices, orders, or discount savings as real. Do not label a simulated task “Grok Bot running.”

## Ownership

- `app/page.tsx`
- `components/Header.tsx`
- `components/IntentBar.tsx`
- `components/ProductCard.tsx`
- `components/EvidencePanel.tsx`
- `components/AgentTimeline.tsx`
- `components/ApprovalModal.tsx`
- Frontend styles and assets

Avoid modifying backend routes, `lib/*`, and `types/contracts.ts` without coordinating. Next.js App Router and TypeScript are shared assumptions; adapt together if the repo differs.

## Shared API contract

Import `Product`, `SocialProofAudit`, and `AgentTask` from `types/contracts.ts`. Backend owns the definitive types. Expected fields:

- `Product`: `id`, `name`, `brand`, `pricePence`, `currency`, `merchantUrl`, optional `imageUrl`, optional `merchantRating` and `merchantReviewCount`, `attributes`.
- `SocialProofAudit`: `productId`, `status`, `mode` (`live` or `demo_fixture`), `verdict`, `pros`, `concerns`, `sources`, `sourceCount`, `confidence`, `assessedAt`, optional `trustScore`.
- Each claim has `text`, `evidenceUrls`, `confidence`. Each source has `url`, `title`, `excerpt`, `sourceType`, optional `publishedAt`.
- `AgentTask`: `taskId`, `agentMode` (`grok-bot` or `demo-simulation`), `status`, `intent`, `candidateIds`, optional `selectedProductId`, optional `rationale`, `events`.

Endpoints:

```text
GET  /api/products?q=<encoded buyer intent>  -> { products: Product[] }
POST /api/social-proof  { productId }       -> SocialProofAudit
POST /api/agent-task   { intent, candidateIds } -> AgentTask
GET  /api/agent-task/<taskId>               -> AgentTask (if backend uses polling)
```

Approval/checkout endpoint is to be agreed only after the integration path is real. Opening a merchant link is a purchase handoff, not a completed order.

## Build the buyer flow

1. **Intent:** Header and prominent input: “What should your bot buy?” Seed example “Workout earbuds under £100; prioritise secure fit and sweat resistance.” One submit action starts the flow.
2. **Discover:** Fetch `/api/products`. Show 2–4 cards with image, price, source/store link, and merchant rating only if real data exists. Show loading, no results, and API error states. Format `pricePence / 100` with `Intl.NumberFormat`.
3. **Investigate:** Start the agent task and audits. If the backend's Grok Bot connector provides real events, render them. Otherwise show “Simulated agent walkthrough” clearly above the event list. Avoid pretend terminal logs such as “Accessing cloud browser” without an actual browser event.
4. **Evidence:** For each candidate, show the verdict, 1–2 pros, 1–2 concerns, source count, confidence, and clickable citations. Display “Limited independent evidence” when appropriate. A fixture needs a visible “Demo evidence snapshot” tag. If there is an optional score, show the scoring explanation and confidence nearby; never treat it as scientific certainty.
5. **Decision:** Highlight the selected product and make the buyer-specific reason legible: price, requested constraints, concern that changed the decision, and any unresolved uncertainty.
6. **Approval:** Modal states exactly what the next click does. “Open merchant checkout” if it only opens a store link; “Authorize test purchase” only if backend has a genuine sandbox transaction. Show an order ID only after a confirmed response from that sandbox.

## Visual direction

A clean buyer tool rather than a cybersecurity dashboard: dark slate or light neutral canvas, strong product imagery, distinct evidence cards, and a simple agent activity timeline. Use red/amber only for specific, cited concerns. Keep the main story readable at projector distance. Do not use a SpaceXAI/Grok badge or logo unless venue assets or permissions make that appropriate; text saying “Grok Bot” is enough.

Suggested layout: intent bar at top; product candidates in the centre; a side panel for evidence and the buyer's decision; a compact approval modal. On a laptop, the whole decision should be visible without scrolling through a wall of logs.

## Demo script (target under 3 minutes)

- **0:00–0:25:** “Store ratings alone don't tell you whether these earbuds fit your use.” Enter the buyer request.
- **0:25–1:05:** Show candidates; the apparent favourite has an attractive listing.
- **1:05–1:55:** Open the evidence view, click a source, and explain the buyer-specific concern. Show low confidence when data is sparse.
- **1:55–2:30:** Grok Bot selects an alternative and explains why it meets price/use constraints. State plainly if agent events are simulated.
- **2:30–3:00:** Human approves the real sandbox transaction or opens a merchant checkout link. End with an honest audit trail of what happened.

## Integration schedule

- **First:** Build against a local typed fixture matching `types/contracts.ts`, then remove the frontend-only fixture once the backend responds.
- **12:00:** Request sample JSON and integration status from backend teammate.
- **1:30:** Wire real fetches to `/api/products`, `/api/social-proof`, `/api/agent-task`.
- **3:00:** Run the entire three-minute flow and fix the first visible failure.
- **Before 4:45:** Keep a labelled fixture fallback for flaky external searches; rehearse once with a clean browser session.

## Acceptance checks

- A buyer can submit an intent, see candidates, inspect cited concerns, understand the selected option, and approve the correct next action.
- UI distinguishes a real Grok Bot run, simulation, live evidence, and fixture evidence.
- No fabricated “fake reviews blocked” count, defect percentage, discount, checkout, or order appears.
- Usable loading/error states; no dead buttons; entire flow fits the three-minute demo.

## One-line pitch

“GrokTruth gives shopping agents an independent evidence check before they spend your money, then shows the human exactly why the bot made its choice.”
