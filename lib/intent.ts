import { completeJson, hasLlmAccess } from "@/lib/llm";
import { formatPounds } from "@/lib/productDisplay";
import type { ProductMatch, SearchConstraints } from "@/types/contracts";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

// Product nouns that mean the same thing in listing titles.
const PRODUCT_SYNONYMS: string[][] = [
  ["earbuds", "earbud", "earphones", "earphone", "buds", "in-ear headphones", "iems", "iem"],
  ["headphones", "headphone", "headset", "headsets"],
  ["mouse", "mice"],
  ["keyboard", "keyboards"],
  ["laptop", "laptops", "notebook"],
  ["tv", "tvs", "television", "televisions"],
  ["phone", "phones", "smartphone", "smartphones"],
  ["speaker", "speakers"],
  ["watch", "watches", "smartwatch", "smartwatches"],
  ["trainers", "sneakers", "running shoes"],
  ["monitor", "monitors", "display"],
  ["controller", "controllers", "gamepad"],
];

// Descriptor phrases and the ways listings commonly spell them.
const KEYWORD_SYNONYMS: string[][] = [
  ["noise cancelling", "noise canceling", "noise-cancelling", "noise-canceling", "noise cancellation", "anc"],
  ["wireless", "bluetooth", "cordless", "true wireless", "tws"],
  ["sweatproof", "sweat-proof", "sweat proof", "sweat resistant", "sweat-resistant", "waterproof", "water resistant", "water-resistant", "ipx4", "ipx5", "ipx6", "ipx7", "ipx8", "ip54", "ip55", "ip67", "ip68"],
  ["waterproof", "water resistant", "water-resistant", "ipx5", "ipx6", "ipx7", "ipx8", "ip67", "ip68"],
  ["running", "sport", "sports", "workout", "gym", "exercise", "fitness", "training", "jogging"],
  ["gaming", "gamer", "esports"],
  ["open ear", "open-ear", "bone conduction", "air conduction"],
  ["bone conduction", "bone-conduction"],
  ["over ear", "over-ear", "around ear", "around-ear"],
  ["on ear", "on-ear"],
  ["in ear", "in-ear"],
  ["kids", "children", "child", "toddler"],
  ["rgb", "backlit", "led"],
  ["ergonomic", "vertical"],
  ["usb c", "usb-c", "type-c", "type c"],
];

const MULTIWORD_TERMS = [...new Set(KEYWORD_SYNONYMS.flat().filter((term) => term.includes(" ")))]
  .sort((a, b) => b.length - a.length);

// Adjectives listings rarely spell out; treat them as ranking preferences, not hard filters.
const SUBJECTIVE = new Set([
  "comfortable", "comfy", "reliable", "durable", "stylish", "premium", "lightweight",
  "light", "small", "compact", "sturdy", "powerful", "loud", "quiet", "fast", "portable",
  "secure", "stable", "easy", "solid", "sleek",
]);

const CHEAP_WORDS = /\b(cheap|cheapest|affordable|inexpensive|budget|bargain|low[- ]cost|value)\b/g;

const FILLER_WORDS = new Set([
  "a", "an", "the", "some", "any", "me", "my", "i", "please", "pair", "of", "good", "best",
  "decent", "nice", "great", "top", "quality", "new", "really", "very", "that", "is", "are",
  "one", "ones", "something", "thing", "things", "product", "products", "item", "items",
  "want", "need", "looking", "find", "get", "buy", "show", "search", "recommend", "and",
  "or", "to", "in", "on", "it", "be", "can", "you", "would", "like", "which", "under",
  "price", "priced", "budget", "decently", "highly", "rated", "well",
]);

// Words that can't be a product noun on their own.
const NON_PRODUCT = new Set([
  "fit", "rating", "ratings", "review", "reviews", "price", "quality", "sound", "battery",
  "life", "run", "running", "gym", "use", "flights", "travel", "work", "commute", "value",
]);

const DEVICE_TARGETS =
  /\b(iphone|ipad|samsung|galaxy|pixel|ps4|ps5|playstation|xbox|switch|macbook|mac|pc|android|kindle|airpods|tesla)\b/;

const ACCESSORY_WORDS = [
  "case", "cases", "cover", "covers", "skin", "skins", "stand", "holder", "mount", "pad",
  "pads", "mat", "mats", "tips", "cushion", "cushions", "replacement", "cable", "charger",
  "adapter", "adaptor", "strap", "protector", "bag", "pouch", "hooks", "dongle", "receiver",
  "sleeve", "grips", "foam", "earpads", "sticker", "stickers", "decal", "folio", "hardshell",
  "bumper", "keyboard cover", "screen protector", "desk", "table", "chair",
];

// Multi-word devices that must not be split into "pro" / "2025" as the product.
const NAMED_PRODUCTS = [
  "macbook pro", "macbook air", "macbook",
  "ipad pro", "ipad air", "ipad mini", "ipad",
  "airpods max", "airpods pro", "airpods",
  "apple watch", "mac mini", "mac studio", "imac", "iphone",
  "surface laptop", "surface pro",
].sort((a, b) => b.length - a.length);

const YEAR_TOKEN = /^(?:19|20)\d{2}$/;
const CHIP_TOKEN = /^m[1-5](?:\s*(?:pro|max|ultra))?$/i;
const AUDIO_PRODUCT = /\b(earbuds?|earphones?|headphones?|airpods|buds|headset|iems?)\b/;

const AUDIENCE_WORDS = ["kids", "children", "child", "toddler", "toddlers", "baby", "dog", "dogs", "cat", "cats", "pet", "pets"];

const PHONE_SPAM =
  /\bfor\s+(?:iphone|samsung|galaxy|honor|motorola|moto|tcl|xiaomi|redmi|oppo|huawei|pixel|nokia|realme|vivo|oneplus|android)\b/i;

// Product families used to spot bundles ("gaming keyboard and mouse set").
const CATEGORY_FAMILIES: Record<string, string[]> = {
  audio: ["earbuds", "earphones", "headphones", "headset"],
  mouse: ["mouse", "mice"],
  keyboard: ["keyboard"],
  controller: ["controller", "gamepad"],
  speaker: ["speaker"],
  webcam: ["webcam"],
  monitor: ["monitor"],
};

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsTerm(haystack: string, term: string): boolean {
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegex(term)}(?:$|[^a-z0-9])`, "i").test(haystack);
}

function inflections(word: string): string[] {
  const forms = new Set([word]);
  if (word.endsWith("ies")) forms.add(`${word.slice(0, -3)}y`);
  else if (word.endsWith("es")) forms.add(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 3) forms.add(word.slice(0, -1));
  else {
    forms.add(`${word}s`);
    forms.add(`${word}es`);
  }
  return [...forms];
}

function productTerms(product: string): string[] {
  const parts = product.split(/\s+/).filter(Boolean);
  const head = parts[parts.length - 1] ?? product;
  const terms = new Set([product]);
  // "macbook pro" must not match every title that merely says "pro".
  if (parts.length === 1) {
    inflections(head).forEach((term) => terms.add(term));
  }
  for (const group of PRODUCT_SYNONYMS) {
    if (group.includes(product) || (parts.length === 1 && group.includes(head))) {
      group.forEach((term) => terms.add(term));
    }
  }
  if (product === "computer" || product === "pc") {
    ["laptop", "laptops", "notebook", "computer", "computers", "pc", "desktop"].forEach((term) =>
      terms.add(term),
    );
  }
  return [...terms];
}

function wantsAccessory(text: string): boolean {
  return ACCESSORY_WORDS.some((word) => containsTerm(text, word));
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function buildSearchQuery(product: string, keywords: string[], accessories: boolean): string {
  const parts = [...keywords];
  if (/macbook|imac|ipad|iphone/.test(product) && !parts.includes("apple")) {
    parts.unshift("apple");
  }
  parts.push(product === "computer" || product === "pc" ? "laptop" : product);
  if (!accessories && /macbook|imac|mac mini|mac studio/.test(product)) {
    parts.push("laptop");
  }
  return uniqueStrings(parts).join(" ");
}

function keywordTerms(keyword: string): string[] {
  const terms = new Set(inflections(keyword));
  terms.add(keyword);
  for (const group of KEYWORD_SYNONYMS) {
    if (group.includes(keyword)) {
      group.forEach((term) => terms.add(term));
    }
  }
  return [...terms];
}

function familyOf(word: string): string | undefined {
  return Object.entries(CATEGORY_FAMILIES).find(([, words]) =>
    words.some((w) => inflections(w).includes(word)),
  )?.[0];
}

function excludeWords(text: string): string[] {
  return splitList(text).flatMap((part) =>
    part.split(/\s+/).filter((word) => word.length > 2 && !FILLER_WORDS.has(word) && word !== "one"),
  );
}

function splitList(text: string): string[] {
  return text
    .split(/,|\band\b|\bor\b|\//)
    .map((part) => part.replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 1);
}

// ---------------------------------------------------------------------------
// Price parsing
// ---------------------------------------------------------------------------

const AMOUNT = String.raw`((?:\d{1,3}(?:,\d{3})+|\d{1,6})(?:\.\d{1,2})?)`;
const MONEY = String.raw`£?\s*${AMOUNT}\s*(?:pounds?|quid|gbp)?`;
const CURRENCY_MONEY = String.raw`(?:£\s*${AMOUNT}|${AMOUNT}\s*(?:pounds?|quid|gbp)\b)`;

function amountToPence(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : undefined;
}

type PriceRange = { minPence?: number; maxPence?: number };

function extractPrice(text: string): { range: PriceRange; rest: string } {
  const range: PriceRange = {};
  let rest = text;

  const take = (pattern: string, apply: (amounts: (number | undefined)[]) => void) => {
    const re = new RegExp(pattern, "i");
    const match = rest.match(re);
    if (!match) return false;
    apply(match.slice(1).map(amountToPence).filter((n) => n !== undefined));
    rest = rest.replace(re, " ");
    return true;
  };

  const setRange = (a?: number, b?: number) => {
    if (a === undefined || b === undefined) return;
    range.minPence = Math.min(a, b);
    range.maxPence = Math.max(a, b);
  };

  // Ranges first so "between £30 and £80" isn't read as a bare "£80".
  const rangeMatched =
    take(String.raw`\b(?:between|from)\s+${MONEY}\s*(?:and|to|-|–)\s*${MONEY}`, ([a, b]) => setRange(a, b)) ||
    take(String.raw`£\s*${AMOUNT}\s*(?:-|–|to)\s*£?\s*${AMOUNT}`, ([a, b]) => setRange(a, b)) ||
    take(String.raw`\b${AMOUNT}\s*(?:-|–|to)\s*${AMOUNT}\s*(?:pounds|quid|gbp)\b`, ([a, b]) => setRange(a, b));

  if (!rangeMatched) {
    const around = take(
      String.raw`\b(?:around|about|roughly|approx(?:imately)?|circa|near|~)\s*${MONEY}`,
      ([a]) => {
        if (a === undefined) return;
        range.minPence = Math.round(a * 0.8);
        range.maxPence = Math.round(a * 1.2);
      },
    );
    if (!around) {
      take(
        String.raw`(?:\b(?:under|below|less than|up to|upto|max(?:imum)?(?: of)?|no more than|not more than|cheaper than|at most|for less than|sub|budget(?: of| is)?)\s*:?\s*${MONEY}|<\s*${MONEY})`,
        (amounts) => (range.maxPence = amounts[0]),
      ) ||
        take(
          String.raw`${MONEY}\s*(?:or less|or under|or below|or cheaper|or lower|max(?:imum)?|tops|at most)\b`,
          ([a]) => (range.maxPence = a),
        ) ||
        take(String.raw`\bwithin\s+${CURRENCY_MONEY}`, (amounts) => (range.maxPence = amounts[0]));

      take(
        String.raw`(?:\b(?:over|above|more than|at least|min(?:imum)?(?: of)?|starting (?:at|from)|no less than)\s*${MONEY}|>\s*${MONEY})`,
        (amounts) => (range.minPence = amounts[0]),
      ) ||
        take(String.raw`${MONEY}\s*(?:or more|or above|or higher|plus|\+)`, ([a]) => (range.minPence = a)) ||
        take(String.raw`\bfrom\s+${CURRENCY_MONEY}`, (amounts) => (range.minPence = amounts[0]));

      // A bare "£40" or "40 quid" with no qualifier reads as a ceiling.
      if (range.maxPence === undefined && range.minPence === undefined) {
        take(CURRENCY_MONEY, (amounts) => (range.maxPence = amounts[0]));
      }
    }
  }

  if (
    range.minPence !== undefined &&
    range.maxPence !== undefined &&
    range.minPence > range.maxPence
  ) {
    [range.minPence, range.maxPence] = [range.maxPence, range.minPence];
  }
  return { range, rest };
}

// ---------------------------------------------------------------------------
// Rule-based intent parsing
// ---------------------------------------------------------------------------

export function parseIntentRules(query: string): SearchConstraints {
  const lower = query.toLowerCase().replace(/[’']/g, "'");
  const { range, rest } = extractPrice(lower);

  const preferCheap = CHEAP_WORDS.test(rest);
  CHEAP_WORDS.lastIndex = 0;

  const keywords: string[] = [];
  const preferences: string[] = [];
  const excludes: string[] = [];

  const [first = "", ...otherClauses] = rest.split(/[;.!?\n]+/);
  otherClauses.forEach((clause) => preferences.push(...splitList(clause)));

  // Only the first comma segment names the product; later segments are extra wishes.
  const [mainSegment = "", ...extraSegments] = first.split(",");
  extraSegments.forEach((segment) => preferences.push(...splitList(segment)));

  let main = ` ${mainSegment} `;

  for (const match of lower.matchAll(/\bnon[-\s]+([a-z][a-z0-9-]{2,})\b/g)) {
    excludes.push(match[1]);
  }
  const exclude = main.match(
    /(?:\bbut\s+)?\b(?:not|no|without|except|excluding|avoid(?:ing)?)\s+(.+)$/,
  );
  if (exclude) {
    excludes.push(...excludeWords(exclude[1]));
    main = main.slice(0, exclude.index);
  }
  main = main.replace(/\bnon[-\s]+[a-z][a-z0-9-]{2,}\b/g, " ");

  const clause = main.match(
    /\b(?:that|which|who|when|so that|so|ideally|preferably|prioriti[sz]e|prioriti[sz]ing|good for|great for)\b(.*)$/,
  );
  if (clause) {
    preferences.push(...splitList(clause[1]));
    main = main.slice(0, clause.index);
  }

  const withClause = main.match(/\bwith\s+(.+)$/);
  if (withClause) {
    for (const part of splitList(withClause[1])) {
      if (SUBJECTIVE.has(part.split(" ")[0])) preferences.push(part);
      else keywords.push(part);
    }
    main = main.slice(0, withClause.index);
  }

  const forClause = main.match(/\bfor\s+(?:the\s+|a\s+|an\s+|my\s+)?(.+)$/);
  if (forClause) {
    const target = forClause[1].trim();
    if (DEVICE_TARGETS.test(target)) keywords.push(target);
    else preferences.push(...splitList(target));
    main = main.slice(0, forClause.index);
  }

  main = main
    .replace(CHEAP_WORDS, " ")
    .replace(/\b(?:i'?m|i am|i'd|i would|can you|could you|help me|looking for)\b/g, " ");

  for (const term of MULTIWORD_TERMS) {
    if (containsTerm(main, term)) {
      keywords.push(term);
      main = main.replace(new RegExp(escapeRegex(term), "gi"), " ");
    }
  }

  const tokens = main
    .replace(/[^a-z0-9 -]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !FILLER_WORDS.has(token));

  let product = "";
  const joined = tokens.join(" ");
  const named = NAMED_PRODUCTS.find((name) => containsTerm(joined, name));
  if (named) {
    product = named;
    const nameParts = named.split(" ");
    const start = tokens.findIndex((_, index) => tokens.slice(index, index + nameParts.length).join(" ") === named);
    if (start >= 0) tokens.splice(start, nameParts.length);
  } else {
    // Years and chip names are model keywords, not the product noun.
    while (tokens.length > 0 && (YEAR_TOKEN.test(tokens[tokens.length - 1]) || CHIP_TOKEN.test(tokens[tokens.length - 1]))) {
      keywords.push(tokens.pop() ?? "");
    }
    const lastTwo = tokens.slice(-2).join(" ");
    if (PRODUCT_SYNONYMS.some((group) => group.includes(lastTwo))) {
      product = lastTwo;
      tokens.splice(-2, 2);
    } else if (tokens.length > 0 && !NON_PRODUCT.has(tokens[tokens.length - 1])) {
      product = tokens.pop() ?? "";
    }
  }

  for (const token of tokens) {
    if (YEAR_TOKEN.test(token) || CHIP_TOKEN.test(token)) keywords.push(token);
    else if (SUBJECTIVE.has(token)) preferences.push(token);
    else keywords.push(token);
  }

  if (/^(?:wh|wf|wi)-?\d/i.test(product)) {
    keywords.push(product);
    product = /^wf/i.test(product) ? "earbuds" : "headphones";
  }

  const allowAccessories = wantsAccessory(lower);
  const cleanKeywords = uniqueStrings(keywords);
  const specificProduct = specificProductFrom(query, cleanKeywords);
  const cleanExcludes = uniqueStrings(excludes);
  if (!allowAccessories && /macbook|iphone|ipad|imac/.test(product)) {
    for (const word of ["case", "cover", "sleeve", "skin"]) {
      if (!cleanExcludes.includes(word)) cleanExcludes.push(word);
    }
  }

  return {
    query,
    product,
    keywords: cleanKeywords,
    preferences: uniqueStrings(preferences),
    excludes: cleanExcludes,
    minPricePence: range.minPence,
    maxPricePence: range.maxPence,
    preferCheap,
    allowAccessories,
    specificProduct,
    searchQuery: specificProduct
      ? specificProduct
      : buildSearchQuery(product, cleanKeywords, allowAccessories),
    tavilyQuery: specificProduct
      ? specificProduct
      : allowAccessories
        ? undefined
        : `${buildSearchQuery(product, cleanKeywords, false)} -case -cover -sleeve`.trim(),
  };
}

function specificProductFrom(query: string, keywords: string[]): string | undefined {
  const named = query.match(
    /\b((?:apple\s+)?(?:macbook pro|macbook air|iphone|ipad pro|ipad air|airpods pro|airpods max)(?:\s+\d{4})?)\b/i,
  );
  if (named?.[1]) {
    return named[1].replace(/\s+/g, " ").trim();
  }
  const model = query.match(/\b([a-z]{1,8}[- ]?\d{3,}[a-z0-9-]*)\b/i);
  if (!model?.[1]) return undefined;
  const brand = keywords.find((word) => /^[a-z]{3,}$/i.test(word) && !YEAR_TOKEN.test(word));
  return [brand, model[1]].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Optional LLM refinement
// ---------------------------------------------------------------------------

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.toLowerCase().trim())
    .filter((item) => item.length > 1 && item.length < 60)
    .slice(0, 6);
}

function poundsToPence(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 100_000
    ? Math.round(value * 100)
    : undefined;
}

export async function parseIntent(query: string): Promise<SearchConstraints> {
  const rules = parseIntentRules(query);
  if (!hasLlmAccess()) {
    return rules;
  }

  try {
    const pending = completeJson(
      [
        "Rewrite a messy UK shopping request into a structured product search.",
        "Return JSON only:",
        '{"product": string (the item they want to buy, e.g. "macbook pro" or "headphones";',
        "never name a case/cover/sleeve unless they asked for an accessory),",
        '"keywords": string[] (model year, chip, brand, "wireless"),',
        '"preferences": string[], "excludes": string[] (always include case/cover/sleeve when they want the device),',
        '"specificProduct": string|null (only when they named an exact model, e.g. "Sony WH-1000XM5" or "MacBook Pro 2025"; otherwise null),',
        '"allowAccessories": boolean, "merchantQuery": string (short Amazon UK query),',
        '"tavilyQuery": string (if specificProduct is set, this MUST be that exact product name and nothing else),',
        '"minPrice": number|null, "maxPrice": number|null (GBP pounds)}.',
        "Do not invent a budget or product they did not mention.",
      ].join(" "),
      query,
      2_500,
    ).catch(() => null);
    const payload = (await Promise.race([
      pending,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_500)),
    ])) as Record<string, unknown> | null;
    if (!payload || typeof payload !== "object") {
      return rules;
    }
    const product =
      typeof payload.product === "string" && payload.product.trim().length > 1
        ? payload.product.toLowerCase().trim()
        : rules.product;
    const allowAccessories =
      typeof payload.allowAccessories === "boolean"
        ? payload.allowAccessories
        : rules.allowAccessories;
    const keywords = (stringList(payload.keywords) ?? rules.keywords).filter(
      (keyword) => !/cheap|affordable|inexpensive|budget|bargain|value/.test(keyword),
    );
    const excludes = uniqueStrings([
      ...(stringList(payload.excludes) ?? rules.excludes),
      ...(allowAccessories || AUDIO_PRODUCT.test(product) ? [] : ["case", "cover", "sleeve"]),
    ]);
    const merchantQuery =
      typeof payload.merchantQuery === "string" && payload.merchantQuery.trim().length > 2
        ? payload.merchantQuery.replace(/[^\w\s£+\-]/g, " ").replace(/\s+/g, " ").trim()
        : buildSearchQuery(product, keywords, allowAccessories);
    const specificProduct =
      typeof payload.specificProduct === "string" && payload.specificProduct.trim().length > 2
        ? payload.specificProduct.replace(/\s+/g, " ").trim()
        : rules.specificProduct;
    const tavilyQuery = specificProduct
      ? specificProduct
      : typeof payload.tavilyQuery === "string" && payload.tavilyQuery.trim().length > 2
        ? payload.tavilyQuery.trim()
        : allowAccessories
          ? undefined
          : `${merchantQuery} -case -cover -sleeve`;
    return {
      ...rules,
      product,
      specificProduct,
      keywords,
      preferences: stringList(payload.preferences) ?? rules.preferences,
      excludes,
      allowAccessories,
      searchQuery: specificProduct || merchantQuery,
      tavilyQuery,
      minPricePence: rules.minPricePence ?? poundsToPence(payload.minPrice),
      maxPricePence: rules.maxPricePence ?? poundsToPence(payload.maxPrice),
    };
  } catch {
    return rules;
  }
}

export function searchPhrase(constraints: SearchConstraints): string {
  return constraints.searchQuery || [...constraints.keywords, constraints.product].join(" ").trim();
}

// ---------------------------------------------------------------------------
// Matching listings against the constraints
// ---------------------------------------------------------------------------

export type ListingEvaluation =
  | { relevant: false; reason: string }
  | { relevant: true; match: ProductMatch; score: number };

// How far outside the budget still counts as a "similar" option.
export function nearTolerance(boundPence: number): number {
  return Math.max(Math.round(boundPence * 0.25), 500);
}

const INCLUDED_ACCESSORY =
  /\b(?:with|includes?|including|plus)\s+(?:a\s+|the\s+)?(?:\w+\s+){0,2}(?:case|cover|bag|pouch)\b/i;

function accessoryMismatch(constraints: SearchConstraints, text: string): string | undefined {
  if (constraints.allowAccessories) return undefined;

  const product = constraints.product;
  const escaped = escapeRegex(product);
  if (new RegExp(`\\b(?:for|compatible with|fits)\\s+${escaped}\\b`, "i").test(text)) {
    return "accessory for that device";
  }

  const chargingCaseOnAudio =
    AUDIO_PRODUCT.test(product) &&
    /\bcharging case\b/.test(text) &&
    !/\b(?:hard case|hardshell|protective case|clear case|folio|sleeve)\b/.test(text);
  if (chargingCaseOnAudio) return undefined;
  if (INCLUDED_ACCESSORY.test(text) && AUDIO_PRODUCT.test(product)) return undefined;

  const hit = ACCESSORY_WORDS.find((word) => containsTerm(text, word));
  if (!hit) return undefined;
  return `accessory (${hit})`;
}

function modelMismatch(specific: string | undefined, text: string, notes: string[]): number | "reject" {
  if (!specific) return 0;
  const hay = text.toLowerCase();
  const brands = specific
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !/\d/.test(token));
  if (brands.some((token) => !hay.includes(token))) return "reject";

  const codes = specific.toLowerCase().match(/[a-z]*\d[a-z0-9]*/gi) ?? [];
  const models = codes.filter((code) => code.length >= 4 && !/^(?:19|20)\d{2}$/.test(code));
  if (models.length === 0) return 0;
  if (models.every((code) => hay.includes(code))) return 0;
  const near = models.some((code) => {
    const stem = code.slice(0, -1);
    return stem.length >= 5 && hay.includes(stem);
  });
  if (!near) return "reject";
  notes.push(`Different model from ${specific}`);
  return 1;
}

export function evaluateListing(
  constraints: SearchConstraints,
  title: string,
  pricePence?: number,
): ListingEvaluation {
  const text = title.toLowerCase();
  const query = constraints.query.toLowerCase();

  if (!productTerms(constraints.product).some((term) => containsTerm(text, term))) {
    return { relevant: false, reason: "different product type" };
  }
  if (/\b(best \d+|top \d+|buying guide|round-?up|compared)\b/i.test(title)) {
    return { relevant: false, reason: "roundup, not a listing" };
  }

  const excluded = constraints.excludes.find((term) => containsTerm(text, term));
  if (excluded) {
    return { relevant: false, reason: `mentions excluded "${excluded}"` };
  }

  const accessoryReason = accessoryMismatch(constraints, text);
  if (accessoryReason) {
    return { relevant: false, reason: accessoryReason };
  }

  const head = constraints.product.split(/\s+/).pop() ?? constraints.product;
  const headAlternation = productTerms(constraints.product).map(escapeRegex).join("|");

  const headFamily = familyOf(head);
  for (const [family, words] of Object.entries(CATEGORY_FAMILIES)) {
    if (family === headFamily) continue;
    const others = words.filter((w) => containsTerm(text, w) && !containsTerm(query, w));
    if (others.length === 0) continue;
    const otherAlternation = others.map(escapeRegex).join("|");
    const joined = new RegExp(
      `\\b(?:${otherAlternation})\\b\\s*(?:and|&|\\+)\\s*(?:\\S+\\s+){0,5}?(?:${headAlternation})\\b|\\b(?:${headAlternation})\\b\\s*(?:and|&|\\+)\\s*(?:\\S+\\s+){0,5}?(?:${otherAlternation})\\b`,
      "i",
    );
    if (/\b(set|combo|bundle|kit)\b/.test(text) || joined.test(text)) {
      return { relevant: false, reason: `bundle with ${family}` };
    }
  }

  const notes: string[] = [];

  const specificTokens = new Set(
    (constraints.specificProduct ?? "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 1),
  );
  const modelDeviation = modelMismatch(constraints.specificProduct, text, notes);
  if (modelDeviation === "reject") {
    return { relevant: false, reason: `different model from ${constraints.specificProduct}` };
  }

  const missing = constraints.keywords.filter((keyword) => {
    if (specificTokens.has(keyword) && !YEAR_TOKEN.test(keyword)) return false;
    return !keywordTerms(keyword).some((term) => containsTerm(text, term));
  });
  const wantedYear = constraints.keywords.map((keyword) => keyword.match(YEAR_TOKEN)?.[0]).find(Boolean);
  const listedYear = text.match(/\b((?:19|20)\d{2})\b/)?.[1];
  if (wantedYear && listedYear && Math.abs(Number(listedYear) - Number(wantedYear)) > 1) {
    return { relevant: false, reason: `${listedYear} model, not ${wantedYear}` };
  }
  missing.forEach((keyword) => notes.push(`Not listed as ${keyword}`));

  const audience = AUDIENCE_WORDS.find(
    (word) => containsTerm(text, word) && !containsTerm(query, word),
  );
  if (audience) {
    notes.push(`Made for ${audience}`);
  }

  let priceDeviation = 0;
  if (pricePence !== undefined) {
    const { minPricePence: min, maxPricePence: max } = constraints;
    if (max !== undefined && pricePence > max) {
      const over = pricePence - max;
      if (over > nearTolerance(max)) {
        return { relevant: false, reason: "well over budget" };
      }
      notes.push(`${formatPounds(over)} over your ${formatPounds(max)} budget`);
      priceDeviation = 1;
    } else if (min !== undefined && pricePence < min) {
      const under = min - pricePence;
      if (under > nearTolerance(min)) {
        return { relevant: false, reason: "well under minimum" };
      }
      notes.push(`${formatPounds(under)} below your ${formatPounds(min)} minimum`);
      priceDeviation = 1;
    }
  }

  const phoneSpam = PHONE_SPAM.test(title) && !DEVICE_TARGETS.test(query);
  if (phoneSpam) {
    notes.push("Listed for a specific phone");
  }

  const deviations =
    missing.length + (audience ? 1 : 0) + priceDeviation + (phoneSpam ? 1 : 0) + modelDeviation;
  if (deviations > 1) {
    return { relevant: false, reason: notes.join("; ") };
  }

  const coverage =
    constraints.keywords.length === 0
      ? 1
      : (constraints.keywords.length - missing.length) / constraints.keywords.length;
  const preferenceHits = constraints.preferences.filter((preference) =>
    preference
      .split(/\s+/)
      .filter((word) => word.length > 3 && !FILLER_WORDS.has(word))
      .some((word) => keywordTerms(word).some((term) => containsTerm(text, term))),
  ).length;

  let score = coverage * 3 + preferenceHits;
  if (phoneSpam) {
    score -= 1.5;
  }

  return {
    relevant: true,
    score,
    match: { kind: deviations === 0 ? "exact" : "similar", notes },
  };
}
