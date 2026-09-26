# espresso

UK shopping search. A buyer types a normal sentence (“a cheap gaming mouse, £25 or less”, “Sony WH-1000XM5”, “MacBook Pro 2025”). The app parses that into a product and constraints, searches several UK sources for a short window, and only shows a listing after the price has been read off the merchant page. Exact matches and near misses are separate lists. Each exact match can get a Gemini pros-and-cons audit, and the page ends with one recommended product.

Prices are GBP pence (`pricePence`). A displayed price is the figure confirmed on the product page, not a number copied out of a search snippet.

## Run

```bash
npm install
npm run dev
```

The app is a Next.js App Router project (`next dev`, default http://localhost:3000). Copy `.env.example` to `.env.local` and set at least `TAVILY_API_KEY` and `GEMINI_API_KEY`. `SERPAPI_API_KEY` is optional. `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, and `GOOGLE_API_KEY` are accepted as the Gemini key.

| Variable | Role |
| --- | --- |
| `TAVILY_API_KEY` | Review snippets, and one of the product-discovery sources. |
| `GEMINI_API_KEY` | Query rewrite, optional grounded discovery, review pros/cons, and the final pick. |
| `GEMINI_MODEL` | Preferred Gemini model. Default `gemini-3.6-flash`. |
| `SERPAPI_API_KEY` | Google shopping results. The source stays off when this is empty. |
| `SEARCH_WINDOW_MS` | How long a search keeps looking. Default `12000`. |
| `OPENAI_API_KEY`, `XAI_API_KEY` | Unused while a Gemini key is set. `completeJson` only falls through to them when Gemini is not configured. |

## What a search does

`components/SearchExperience.tsx` sends the query to `GET /api/products?q=`. The route streams newline-delimited JSON (`application/x-ndjson`). The client appends each product as it arrives and ignores events from an older search if the buyer submits again.

`lib/searchProducts.ts` (`searchProductsLive`) is the orchestrator.

1. **Parse the request** (`lib/intent.ts`). A rules parser always runs. Gemini is asked to rewrite the sentence into JSON, but only for about 2.5 seconds. If it is slow, over quota, or returns junk, the rules result is used. The parser’s price range wins over a model that invents a budget. Named products are kept together, so “MacBook Pro 2025” does not become a search for the word “2025”.
2. **Emit constraints** immediately, before any listing is verified.
3. **Discover**, in parallel, from every enabled source, for up to 8 seconds or whatever remains of the window (at least 1.5 seconds).
4. **Screen titles** with `evaluateListing`. Roundups, accessories, the wrong product type, and the wrong model are dropped. Survivors are sorted by match score.
5. **Verify the merchant page** (`fetchVerifiedListing`), four pages at a time. A listing with no confirmed GBP price is dropped. The title and price on the page are screened again.
6. **Stream** each accepted product. At most 8 exact and 8 similar. Duplicates are collapsed by brand plus name, and by Amazon ASIN or URL.
7. If the buyer set a price bound and time remains, run a **second wave of the same query without the price filter**, then screen and verify that wave the same way. This is not a search for the bare noun (“mouse”, “headphones”).
8. If something was screened but nothing verified, retry the first six screened URLs once.

Amazon product ids are `amz-{asin}`. Every other URL is `web-` plus the first 12 hex characters of the SHA-1 of the URL.

If the buyer never names a product, the route emits an `error` event. If live search throws, the route sends the labelled demo catalogue (`lib/demoFixture.ts`) and a `done` event with `source: "demo_fixture"`. An empty live result is not replaced with demo products. It finishes as `source: "live"` with a warning.

### Stream events

```text
{"type":"constraints","constraints":{...}}
{"type":"product","product":{...}}
{"type":"done","source":"live"|"demo_fixture","warning"?:string}
{"type":"error","error":string}
```

`types/contracts.ts` still contains `ProductSearchResponse`, which describes an older single JSON body. The live products route does not return that body.

The query must be 3–400 characters.

## Intent

`SearchConstraints` (`types/contracts.ts`) is the structured request:

- `product` — the thing to buy (“mouse”, “headphones”, “macbook pro”). “computer” and “pc” are searched and matched as laptop, notebook, or desktop.
- `keywords` — words that should appear in the title (brand, “wireless”, a year). “cheap” and similar filler are not keywords.
- `preferences` — soft ranking hints (“secure fit”). They do not reject a listing.
- `excludes` — “non-X” / “not X”, plus case/cover/sleeve when the buyer asked for the device itself.
- `minPricePence` / `maxPricePence` — from phrases such as “£25 or less”, “under £200”, “between £30 and £80”, “budget of 150 pounds”.
- `specificProduct` — set only for an exact model (“Sony WH-1000XM5”, “MacBook Pro 2025”). Discovery then uses that name.
- `allowAccessories` — true only when the buyer asked for a case, cover, or similar.
- `searchQuery` — the short merchant query.

## Matching

`evaluateListing` decides exact, similar, or reject. A listing needs the product type in the title. One deviation is allowed. Two or more and it is rejected.

A deviation is any of: a missing keyword, an audience the buyer did not ask for (“for kids”), a price outside the bound but still close, a phone-specific title on a non-phone search, or a neighbouring model code.

- **Price.** “Close” means within `max(25% of the bound, £5)`. Further than that is rejected. Inside that band, the listing is similar and the note says how far over or under it is.
- **Accessories.** Case, cover, sleeve, desk, table, chair, and “for {product}” are rejected unless the buyer asked for an accessory. A charging case mentioned on headphones is not treated as an accessory. “With a case” on audio gear is not either.
- **Models.** Brand tokens of 4+ letters in `specificProduct` must appear. A model code (a token that contains a digit, length at least 4, and not a year) must appear. A stem match (the code without its last character, stem at least 5 characters, such as `1000xm4` against `1000xm5`) is one deviation. Anything else is rejected.
- **Years.** A listed year more than one year away from the requested year is rejected. A missing year is a note, not a rejection.
- **Other rejects.** Roundup titles (“best 10”, “buying guide”), bundles that pair the product with a different category, and titles that mention an excluded word.

Exact means zero deviations. Similar means exactly one. Each section is capped at 8.

## Sources

Sources implement `ProductSource` in `lib/sources/types.ts`: `id`, `enabled()`, and `search()`. `lib/sources/index.ts` lists them explicitly and returns the ones that are enabled. Adding a retailer means exporting a `ProductSource` and putting it in that list.

| Source | When it runs | What it returns |
| --- | --- | --- |
| `amazon` | Always | Amazon UK search (`/s?k=`). A price bound is sent as `rh=p_36:{min}-{max}` in pence. |
| `tavily` | When `TAVILY_API_KEY` is set | `"{query} buy UK"`, or the exact model name plus “buy UK”. Snippet URLs are kept only when the nearby text matches the query. Roundup titles are dropped. |
| `duckduckgo` | Always | The HTML results for `"{query} buy UK"`. |
| `argos`, `johnlewis` | Always | Those shops’ search pages. |
| `gemini` | When a Gemini key is set | Web links from Gemini grounding, only chunks that have a real title. |
| `serpapi` | When `SERPAPI_API_KEY` or `SERP_API_KEY` is set | Google results restricted to known UK shop hosts. |

Web results are kept only for product URLs on Amazon UK, Argos, John Lewis, Currys, Very, and AO (`lib/webSearch.ts`). Category indexes are dropped: Argos must be `/product/{id}`, John Lewis `/p{id}`, Currys must contain `/products/`, Very must be a product path, AO must contain `/product/`. Amazon links are reduced to `https://www.amazon.co.uk/dp/{asin}`.

Each source is raced against the wave budget. A timeout or a thrown error becomes an empty list for that source. The other sources still count.

## Prices

`lib/pagePrice.ts` loads merchant HTML. Amazon pages are fetched with `curl`, because Amazon answers Node’s HTTPS client with a short 503. Other hosts use Node `https`, and fall back to `curl` on a block page or a 5xx. Cookies are stored per host. A poisoned Amazon cookie jar is cleared when a response looks like a block.

An Amazon page is treated as a block when the HTML mentions a captcha or is under 40KB. Real search and product pages are much larger. Blocked pages are not shown and are not parsed for a price.

An Amazon price is accepted only when it is in pounds. The buy-box `priceAmount` and the core-price element are both read. If both exist and they differ, the listing is discarded. Search-result snippet prices are never shown. Argos and John Lewis have their own page parsers in the same file. The verified record also carries the page title, image, star rating, and review count when those nodes exist.

## Reviews

After an exact match arrives, the client `POST`s `/api/social-proof` with `{ productId }`. `lib/audit.ts` looks the product up in the in-memory catalogue (`lib/catalog.ts`), which is filled as products are streamed. The catalogue does not survive a process restart.

The audit searches Tavily (`searchDepth: advanced`, Amazon UK excluded, about 12 seconds, up to 8 results) for `"{brand} {model} review pros cons"`. A snippet is kept only when it mentions the model code, if there is one, and at least two distinctive tokens from the name.

Gemini turns those snippets into pros and concerns. Each claim must cite a snippet. If Gemini’s source index does not match the claim text as well as another snippet does, the citation is moved to the overlapping snippet. Claims with no URL are dropped. `thinkingBudget` is 0 so the call does not spend the timeout on hidden reasoning. The preferred model is tried once, then one spare model. Review calls share two Gemini slots so they do not pile up. Intent parsing uses a short timeout and does not wait on that queue.

Empty audits are not cached as final. An audit whose claims all cite a single URL, while several sources were supplied, is treated as collapsed and computed again.

The drawer numbers citations from the audit’s source list (`[1]`, `[2]`, …), not from the position of a URL inside one claim. If both pros and concerns are empty, the card and the drawer say that plainly.

## Recommendation

When the stream finishes, the client `POST`s `/api/agent-task` with `{ intent, candidateIds }` for the exact matches. `lib/agent.ts` asks Gemini to pick one product id and write a rationale from the supplied prices, match notes, pros, and concerns. If Gemini fails, the pick is the exact match with the best pros-minus-concerns score, then the lowest price. The rationale says so when the pick was not scored by Gemini.

`agentMode` is always `"demo-simulation"`. Nothing is purchased. “Buy now” opens the merchant URL. The recommendation panel shows the chosen product and the rationale. It does not show the simulated-agent label or the numbered step boxes.

## Frontend

The page is `app/page.tsx`, rendered by `components/SearchExperience.tsx`.

- The wordmark is the coffee emoji and the name espresso, on the start screen and above the results.
- Cards appear as NDJSON `product` events arrive. There is a short pause between paints so a buffered chunk still shows up one card at a time.
- Skeletons show only while the search is loading and no card has arrived yet. Once cards exist, the page says it is still checking more listings until `done`.
- Sort is relevance (arrival order), price low to high, or price high to low. A new search resets the sort to relevance. Both the matching list and the similar list use the same sort.
- Card keys are the product id. Clicking a card opens `ProductDrawer` and does not remount the list.
- Similar options sit under the exact matches and explain the one missed requirement.

## Layout of the code

```text
app/page.tsx                         the page
app/layout.tsx                       document title
app/api/products/route.ts            NDJSON search
app/api/social-proof/route.ts        one review audit
app/api/agent-task/route.ts          one recommendation
app/api/intent-debug/route.ts        parser debug, not used by the page
components/SearchExperience.tsx      search, sort, lists, recommendation
components/ProductCard.tsx           one listing
components/ProductDrawer.tsx         price, pros, concerns, numbered sources
components/AgentTimeline.tsx         recommendation panel
lib/intent.ts                        parse and match
lib/searchProducts.ts                timed search
lib/pagePrice.ts                     merchant HTML and confirmed prices
lib/amazonSearch.ts                  Amazon UK result parsing
lib/sources/                         one file per discovery source
lib/audit.ts                         review pros and cons
lib/agent.ts                         the pick
lib/llm.ts                           Gemini JSON calls
lib/catalog.ts                       in-memory products and audits
types/contracts.ts                   shared types
```

`FRONTEND_AGENT.md` and `BACKEND_AGENT.md` are the original handoff notes. They describe an older single-JSON products response and a Grok Bot timeline. This file describes the code as it runs now.
