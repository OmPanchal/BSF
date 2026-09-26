import { getDemoAudit } from "@/lib/demoFixture";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const productId =
    typeof body === "object" &&
    body !== null &&
    "productId" in body &&
    typeof body.productId === "string"
      ? body.productId
      : null;

  if (!productId) {
    return NextResponse.json(
      { error: "Body must include productId: string." },
      { status: 400 },
    );
  }

  const audit = getDemoAudit(productId);

  if (!audit) {
    return NextResponse.json(
      { error: `Unknown productId: ${productId}` },
      { status: 400 },
    );
  }

  return NextResponse.json(audit);
}
