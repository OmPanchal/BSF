"use client";

import { AgentTimeline } from "@/components/AgentTimeline";
import { ApprovalModal } from "@/components/ApprovalModal";
import { IntentBar } from "@/components/IntentBar";
import { PageWash } from "@/components/PageWash";
import { ProductCard } from "@/components/ProductCard";
import { ProductDrawer } from "@/components/ProductDrawer";
import { SearchSkeletons } from "@/components/SearchSkeletons";
import { runBuyerSearch } from "@/lib/runSearch";
import type { AgentTask, Product, SocialProofAudit } from "@/types/contracts";
import { useState } from "react";

const DEFAULT_INTENT =
  "Workout earbuds under £100; prioritise secure fit and sweat resistance.";

const BRIEFS = [
  "Earbuds that stay in when I run, under £100",
  "Sweatproof buds for the gym, under £100",
  "A secure fit, not just a high rating",
];

export function SearchExperience() {
  const [intent, setIntent] = useState(DEFAULT_INTENT);
  const [products, setProducts] = useState<Product[]>([]);
  const [audits, setAudits] = useState<SocialProofAudit[]>([]);
  const [task, setTask] = useState<AgentTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [source, setSource] = useState<"live" | "demo_fixture">("live");
  const [drawerProductId, setDrawerProductId] = useState<string | null>(null);
  const [approvalProductId, setApprovalProductId] = useState<string | null>(
    null,
  );

  async function search(override?: string) {
    const next = (override ?? intent).trim();
    if (!next || loading) return;
    setSearched(true);
    setError(null);
    setWarnings([]);
    setAudits([]);
    setTask(null);
    setDrawerProductId(null);
    setApprovalProductId(null);
    setLoading(true);
    const startedAt = Date.now();
    try {
      const result = await runBuyerSearch(next);
      const remaining = 900 - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      }
      setProducts(result.products);
      setAudits(result.audits);
      setTask(result.task);
      setSource(result.source);
      setWarnings(result.warnings);
    } catch (caught: unknown) {
      setProducts([]);
      setAudits([]);
      setTask(null);
      setError(caught instanceof Error ? caught.message : "Search failed.");
    } finally {
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
    <div className="min-h-full bg-[#fffaf5]">
      <div
        className={`pointer-events-none fixed inset-0 overflow-hidden transition-opacity duration-700 ${
          searched ? "opacity-[0.28]" : "opacity-100"
        }`}
      >
        <PageWash />
      </div>
      <main className="relative z-10">
        <section
          className={`flex flex-col items-center px-4 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] md:px-12 ${
            searched
              ? "justify-start pb-2 pt-5"
              : "min-h-screen justify-center"
          }`}
        >
          <div
            className={`w-full max-w-4xl overflow-hidden text-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              searched
                ? "mb-0 max-h-0 opacity-0"
                : "mb-8 max-h-[28rem] opacity-100"
            }`}
          >
            <p className="mb-4 text-5xl font-extrabold tracking-tight text-[#1c1917] md:text-7xl">
              Bullshit Filter
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1c1917] md:text-3xl">
              What should your bot buy?
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-base text-[#57534e] md:text-lg">
              Independent evidence before a shopping agent spends your money.
            </p>
          </div>
          <div
            className={`w-full transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              searched ? "max-w-5xl" : "max-w-3xl"
            }`}
          >
            <IntentBar
              compact={searched}
              value={intent}
              onChange={setIntent}
              onSubmit={() => {
                void search();
              }}
              loading={loading}
            />
            <div
              className={`flex flex-wrap justify-center gap-2 overflow-hidden transition-all duration-500 ${
                searched
                  ? "mt-0 max-h-0 opacity-0"
                  : "mt-5 max-h-40 opacity-100"
              }`}
            >
              {BRIEFS.map((brief) => (
                <button
                  key={brief}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setIntent(brief);
                    void search(brief);
                  }}
                  className="btn-press rounded-full border border-white bg-white/80 px-4 py-2 text-sm text-[#44403c] shadow-sm hover:bg-white disabled:opacity-60"
                >
                  {brief}
                </button>
              ))}
            </div>
          </div>
        </section>

        {searched ? (
          <section className="relative pb-20 pt-4">
            <div className="mx-auto max-w-5xl px-4 md:px-12">
              {error ? (
                <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </p>
              ) : null}
              {!loading && warnings.length > 0 ? (
                <div className="mb-6 space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}
              {loading ? <SearchSkeletons /> : null}
              {products.length > 0 && !loading ? (
                <>
                  <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <h2 className="text-4xl font-extrabold tracking-tight text-[#1c1917]">
                      {products.length === 1
                        ? "1 result"
                        : `${products.length} results`}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {source === "demo_fixture" ? (
                        <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#9d174d] shadow-sm">
                          Demo catalogue — live search unavailable
                        </span>
                      ) : null}
                      {audits.some((audit) => audit.mode === "demo_fixture") ? (
                        <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#57534e] shadow-sm">
                          Demo evidence snapshot
                        </span>
                      ) : audits.length > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#57534e] shadow-sm">
                          Live sources
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mb-8 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
                    <div className="animate-fade-up">
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
        ) : null}
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
