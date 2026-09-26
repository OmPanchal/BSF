import { createAgentTask } from "@/lib/agent";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const intent =
    "intent" in body && typeof body.intent === "string" ? body.intent.trim() : "";
  const candidateIds =
    "candidateIds" in body && Array.isArray(body.candidateIds)
      ? body.candidateIds.filter((id): id is string => typeof id === "string")
      : [];

  if (intent.length < 3) {
    return NextResponse.json(
      { error: "Body must include intent (min 3 characters)." },
      { status: 400 },
    );
  }

  const task = await createAgentTask(intent, candidateIds);
  return NextResponse.json(task);
}
