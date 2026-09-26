"use client";

import { AgentTimeline } from "@/components/AgentTimeline";
import { ApprovalModal } from "@/components/ApprovalModal";
import { Header } from "@/components/Header";
import { IntentBar } from "@/components/IntentBar";
import { ProductCard } from "@/components/ProductCard";
import { ProductDrawer } from "@/components/ProductDrawer";
import { SearchSkeletons } from "@/components/SearchSkeletons";
import type { AgentTask, Product, SocialProofAudit } from "@/types/contracts";
import { useState } from "react";

const DEFAULT_INTENT =
  "Workout earbuds under £100; prioritise secure fit and sweat resistance.";

export default function Home() {
  const [intent, setIntent] = useState(DEFAULT_INTENT);
  const [products, setProducts] = useState<Product[]>([]);
  const [audits, setAudits] = useState<SocialProofAudit[]>([]);
  const [task, setTask] = useState<AgentTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerProductId, setDrawerProductId] = useState<string | null>(null);
  const [approvalProductId, setApprovalProductId] = useState<string | null>(
    null,
  );

  async function search() {
    setError(null);
    setAudits([]);
    setTask(null);
    setDrawerProductId(null);
    setApprovalProductId(null);
    setLoading(true);
    const startedAt = Date.now();
    try {
      const productResponse = await fetch(
        `/api/products?q=${encodeURIComponent(intent)}`,
      );
      const productData = await productResponse.json();
      if (!productResponse.ok) {
        throw new Error(productData.error ?? "Search failed.");
      }

      const nextProducts: Product[] = productData.products ?? [];
      setProducts(nextProducts);

      if (!nextProducts.length) {
        setError("No products in this demo catalogue.");
        return;
      }

      const candidateIds = nextProducts.map((product) => product.id);
      const [auditResults, taskResponse] = await Promise.all([
        Promise.all(
          candidateIds.map(async (productId) => {
            const response = await fetch("/api/social-proof", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productId }),
            });
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error ?? "Evidence lookup failed.");
            }
            return data as SocialProofAudit;
          }),
        ),
        fetch("/api/agent-task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent, candidateIds }),
        }),
      ]);

      const taskData = await taskResponse.json();
      if (!taskResponse.ok) {
        throw new Error(taskData.error ?? "Recommendation failed.");
      }

      setAudits(auditResults);
      setTask(taskData as AgentTask);
    } catch (caught) {
      setProducts([]);
      setAudits([]);
      setTask(null);
      setError(caught instanceof Error ? caught.message : "Search failed.");
    } finally {
      const remaining = 1200 - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      }
      setLoading(false);
    }
  }

  const recommendedId = task?.selectedProductId;
  const recommendedProduct = products.find(
    (product) => product.id === recommendedId,
  );
  const drawerProduct = products.find(
    (product) => product.id === drawerProductId,
  );
  const approvalProduct = products.find(
    (product) => product.id === approvalProductId,
  );

  function auditFor(productId: string) {
    return audits.find((audit) => audit.productId === productId);
  }

  return (
    <div className="min-h-full bg-surface">
      <Header />
      <main className="w-full pt-16">
        <section className="border-b border-[#c6c6ca]/40 bg-[linear-gradient(120deg,#ffffff_0%,#dbe1ff_58%,#ffdadb_100%)] py-8 md:py-10">
          <div className="mx-auto flex max-w-4xl flex-col items-center px-4 md:px-12">
            <IntentBar
              value={intent}
              onChange={setIntent}
              onSubmit={search}
              loading={loading}
            />
          </div>
        </section>

        <section className="py-10">
          <div className="mx-auto max-w-[1440px] px-4 md:px-12">
            {error ? (
              <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </p>
            ) : null}

            {loading ? <SearchSkeletons /> : null}

            {products.length === 0 && !loading && !error ? (
              <div className="flex flex-col items-center py-20 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dbe1ff] text-[#0051d5]">
                  <span className="material-symbols-outlined text-[32px]">
                    search
                  </span>
                </span>
                <h3 className="text-2xl font-bold tracking-tight">
                  Store ratings are only half the story.
                </h3>
                <p className="mt-2 max-w-md text-[15px] leading-6 text-[#45474a]">
                  Search to load two candidates, the labelled evidence snapshot,
                  and a recommendation you can approve.
                </p>
              </div>
            ) : null}

            {products.length > 0 && !loading ? (
              <>
                <div className="mb-6 flex flex-col items-baseline justify-between gap-2 sm:flex-row">
                  <h1 className="text-2xl font-bold">Search results</h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-[#c6c6ca]/30 bg-[#eceef0] px-2 py-1 text-[11px] font-bold">
                      Demo evidence snapshot
                    </span>
                    <p className="text-[13px] text-[#45474a]">
                      Showing{" "}
                      <span className="font-bold text-[#191c1e]">
                        {products.length}
                      </span>{" "}
                      ranked matches
                    </p>
                  </div>
                </div>

                <div className="mb-6 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
                  {products.map((product, index) => (
                    <div
                      key={product.id}
                      className="animate-fade-up"
                      style={{ animationDelay: `${index * 90}ms` }}
                    >
                      <ProductCard
                        product={product}
                        audit={auditFor(product.id)}
                        recommended={product.id === recommendedId}
                        onOpen={() => setDrawerProductId(product.id)}
                        onBuy={() => setApprovalProductId(product.id)}
                      />
                    </div>
                  ))}
                </div>

                {task ? (
                  <div className="animate-fade-up" style={{ animationDelay: "180ms" }}>
                    <AgentTimeline
                      task={task}
                      selectedProduct={recommendedProduct}
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      </main>

      {drawerProduct ? (
        <ProductDrawer
          product={drawerProduct}
          audit={auditFor(drawerProduct.id)}
          recommended={drawerProduct.id === recommendedId}
          onClose={() => setDrawerProductId(null)}
          onBuy={() => setApprovalProductId(drawerProduct.id)}
        />
      ) : null}

      {approvalProduct ? (
        <ApprovalModal
          product={approvalProduct}
          onClose={() => setApprovalProductId(null)}
        />
      ) : null}
    </div>
  );
}
