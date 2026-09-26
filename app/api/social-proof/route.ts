import { auditProduct } from "@/lib/audit";
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

  try {
    const audit = await auditProduct(productId);
    return NextResponse.json(audit);
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : `Unknown productId: ${productId}`;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
