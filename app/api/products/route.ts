import { rememberProducts } from "@/lib/catalog";
import { getDemoProducts } from "@/lib/demoFixture";
import { getTavilyApiKey } from "@/lib/tavily";
import { searchProductsLive } from "@/lib/searchProducts";
import { NextRequest, NextResponse } from "next/server";

const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 400;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      {
        error: `Query must be between ${MIN_QUERY_LENGTH} and ${MAX_QUERY_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  if (!getTavilyApiKey()) {
    return NextResponse.json(
      {
        error:
          "Live product search needs TAVILY_API_KEY in .env.local. Add a Tavily key and retry.",
      },
      { status: 503 },
    );
  }

  try {
    const products = await searchProductsLive(q);
    if (products.length === 0) {
      return NextResponse.json({
        products: [],
        source: "live" as const,
        warning:
          "No UK listings with a price we could confirm on the merchant page. Nothing is shown rather than an unverified price.",
      });
    }
    rememberProducts(products);
    return NextResponse.json({ products, source: "live" as const });
  } catch (caught) {
    const fixture = getDemoProducts();
    rememberProducts(fixture);
    return NextResponse.json({
      products: fixture,
      source: "demo_fixture" as const,
      warning:
        caught instanceof Error
          ? `Live search failed (${caught.message}). Showing labelled demo catalogue instead.`
          : "Live search failed. Showing labelled demo catalogue instead.",
    });
  }
}
