import { getDemoProducts } from "@/lib/demoFixture";
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

  return NextResponse.json({ products: getDemoProducts() });
}
