import { rememberProducts } from "@/lib/catalog";
import { getDemoProducts } from "@/lib/demoFixture";
import { SearchInputError, searchProductsLive } from "@/lib/searchProducts";
import type { Product, SearchConstraints } from "@/types/contracts";
import { NextRequest } from "next/server";

const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 400;

type SearchEvent =
  | { type: "constraints"; constraints: SearchConstraints }
  | { type: "product"; product: Product }
  | { type: "done"; source: "live" | "demo_fixture"; warning?: string }
  | { type: "error"; error: string };

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) {
    return Response.json(
      { error: `Query must be between ${MIN_QUERY_LENGTH} and ${MAX_QUERY_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SearchEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        const { products, similar } = await searchProductsLive(q, {
          onConstraints: (constraints) => send({ type: "constraints", constraints }),
          onProduct: (product) => {
            rememberProducts([product]);
            send({ type: "product", product });
          },
        });
        let warning: string | undefined;
        if (products.length === 0 && similar.length === 0) {
          warning = "No UK listings matched that search with a price confirmed on the merchant page.";
        } else if (products.length === 0) {
          warning = "Nothing matched every requirement, so only close alternatives are shown.";
        }
        send({ type: "done", source: "live", warning });
      } catch (caught) {
        if (caught instanceof SearchInputError) {
          send({ type: "error", error: caught.message });
        } else {
          const fixture = getDemoProducts();
          rememberProducts(fixture);
          for (const product of fixture) send({ type: "product", product });
          send({
            type: "done",
            source: "demo_fixture",
            warning:
              caught instanceof Error
                ? `Live search failed (${caught.message}). Showing labelled demo catalogue instead.`
                : "Live search failed. Showing labelled demo catalogue instead.",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
