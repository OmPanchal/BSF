import { evaluateListing, parseIntentRules } from "@/lib/intent";
import { NextResponse } from "next/server";

export async function GET() {
  const qs = [
    "wireless earbuds under £50",
    "running headphones between £30 and £80",
    "a cheap gaming mouse, £25 or less",
    "noise cancelling headphones for flights with a budget of 150 pounds",
    "Earbuds that stay in when I run, under £100",
    "Sony headphones",
    "gaming keyboard around £60",
    "I want a mechanical keyboard over £40 but not razer",
    "Workout earbuds under £100, secure fit, sweat resistance",
    "case for iphone 15 under 20",
    "Sweatproof buds for the gym, under £100",
    "A secure fit, not just a high rating",
    "headphones £50-£100",
    "a mouse for 30 quid",
  ];
  const parsed = qs.map((q) => {
    const c = parseIntentRules(q);
    return `${q} => p=${c.product} k=${c.keywords} pref=${c.preferences} ex=${c.excludes} min=${c.minPricePence} max=${c.maxPricePence} cheap=${c.preferCheap}`;
  });
  const mouse = parseIntentRules("a cheap gaming mouse, £25 or less");
  const titles: [string, number][] = [
    ["Gaming Keyboard and Mouse Set, RGB Backlit", 2499],
    ["Logitech G305 LIGHTSPEED Wireless Gaming Mouse", 1999],
    ["Gaming Mouse Pad XXL", 999],
    ["Razer DeathAdder Essential Gaming Mouse", 2899],
    ["Logitech M185 Wireless Mouse", 999],
    ["Logitech G502 Gaming Mouse", 4500],
  ];
  const buds = parseIntentRules("wireless earbuds under £50");
  const budTitles = [
    "Wireless Earbuds, Bluetooth 5.4 Headphones with Mic & Deep Bass, Charging Case for iPhone",
    "Ear Tips for Sony WF-1000XM5 Earbuds",
    "Wireless Earbuds for Honor 90 Motorola",
  ];
  const mac = parseIntentRules("Macbook pro 2025");
  const macTitles = [
    "Apple 2025 MacBook Pro Laptop with M4 Pro: 14-inch, 24GB, 512GB SSD",
    "MOSISO Compatible with MacBook Pro 14 inch Case 2025 M4",
    "Hard Case for MacBook Pro 16 inch 2025",
    "MacBook Pro 14 Sleeve 2025",
    "KEEBEE MacBook Pro 16 inch Case M4 Pro 2025",
    "Apple MacBook Pro 14-inch M4 Pro 2024",
  ];
  return NextResponse.json({
    parsed,
    mouse: titles.map(([t, p]) => [t, p, evaluateListing(mouse, t, p)]),
    buds: budTitles.map((t) => [t, evaluateListing(buds, t, 2999)]),
    macbook: {
      constraints: mac,
      listings: macTitles.map((t) => [t, evaluateListing(mac, t, 199_900)]),
    },
  });
}
