"use client";

import { AgentTimeline } from "@/components/AgentTimeline";
import { ApprovalModal } from "@/components/ApprovalModal";
import { IntentBar } from "@/components/IntentBar";
import { PageWash } from "@/components/PageWash";
import { ProductCard } from "@/components/ProductCard";
import { ProductDrawer } from "@/components/ProductDrawer";
import { SearchSkeletons } from "@/components/SearchSkeletons";
import { formatPounds } from "@/lib/productDisplay";
import { fetchAgentTask, fetchAudit, streamBuyerSearch } from "@/lib/runSearch";
import type {
  AgentTask,
  Product,
  SearchConstraints,
  SocialProofAudit,
} from "@/types/contracts";
import { useRef, useState } from "react";

const DEFAULT_INTENT =
  "Workout earbuds under £100; prioritise secure fit and sweat resistance.";

const BRIEFS = [
  "Earbuds that stay in when I run, under £100",
  "A cheap gaming mouse, £25 or less",
  "Noise cancelling headphones for flights, £100–£200",
];

function priceChip(constraints: SearchConstraints): string | null {
  const { minPricePence: min, maxPricePence: max } = constraints;
  if (min !== undefined && max !== undefined)
    return `${formatPounds(min)}–${formatPounds(max)}`;
  if (max !== undefined) return `Up to ${formatPounds(max)}`;
  if (min !== undefined) return `From ${formatPounds(min)}`;
  return null;
}

function ConstraintChips({ constraints }: { constraints: SearchConstraints }) {
  const price = priceChip(constraints);
  const chips: { label: string; tone: "strong" | "soft" | "warn" }[] = [
    { label: constraints.product, tone: "strong" },
    ...constraints.keywords.map((label) => ({
      label,
      tone: "strong" as const,
    })),
    ...(price ? [{ label: price, tone: "strong" as const }] : []),
    ...(constraints.preferCheap
      ? [{ label: "Cheapest first", tone: "soft" as const }]
      : []),
    ...constraints.preferences.map((label) => ({
      label: `Prefer: ${label}`,
      tone: "soft" as const,
    })),
    ...constraints.excludes.map((label) => ({
      label: `Not: ${label}`,
      tone: "warn" as const,
    })),
  ];
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#78716c]">
        Searched for
      </span>
      {chips.map((chip) => (
        <span
          key={chip.label}
          className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
            chip.tone === "strong"
              ? "bg-[#1c1917] text-white"
              : chip.tone === "warn"
                ? "bg-red-50 text-red-800"
                : "bg-white text-[#57534e]"
          }`}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

export function SearchExperience() {
  const [intent, setIntent] = useState(DEFAULT_INTENT);
  const [products, setProducts] = useState<Product[]>([]);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [constraints, setConstraints] = useState<
    SearchConstraints | undefined
  >();
  const [evidenceLoadingIds, setEvidenceLoadingIds] = useState<string[]>([]);
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
  const searchGeneration = useRef(0);

  function rememberAudit(audit: SocialProofAudit) {
    setAudits((current) =>
      current.some((item) => item.productId === audit.productId)
        ? current.map((item) => (item.productId === audit.productId ? audit : item))
        : [...current, audit],
    );
  }

  async function search(override?: string) {
    const next = (override ?? intent).trim();
    if (!next || loading) return;
    const generation = ++searchGeneration.current;
    setSearched(true);
    setError(null);
    setWarnings([]);
    setAudits([]);
    setTask(null);
    setProducts([]);
    setSimilar([]);
    setConstraints(undefined);
    setDrawerProductId(null);
    setApprovalProductId(null);
    setEvidenceLoadingIds([]);
    setLoading(true);
    const found: Product[] = [];
    const stale = () => generation !== searchGeneration.current;
    try {
      await streamBuyerSearch(next, {
        onConstraints: (nextConstraints) => {
          if (!stale()) setConstraints(nextConstraints);
        },
        onProduct: (product) => {
          if (stale()) return;
          found.push(product);
          const add = (current: Product[]) =>
            current.some((item) => item.id === product.id) ? current : [...current, product];
          if (product.match?.kind === "similar") setSimilar(add);
          else setProducts(add);
          if (product.match?.kind === "similar") return;
          setEvidenceLoadingIds((ids) => (ids.includes(product.id) ? ids : [...ids, product.id]));
          fetchAudit(product.id)
            .then((audit) => {
              if (!stale()) rememberAudit(audit);
            })
            .catch(() => undefined)
            .finally(() => {
              if (stale()) return;
              setEvidenceLoadingIds((ids) => ids.filter((id) => id !== product.id));
            });
        },
        onDone: (info) => {
          if (stale()) return;
          setSource(info.source);
          setWarnings(info.warning ? [info.warning] : []);
        },
      });
      const exactIds = found
        .filter((product) => product.match?.kind !== "similar")
        .map((product) => product.id);
      const candidateIds = exactIds.length ? exactIds : found.map((product) => product.id);
      if (candidateIds.length && !stale()) {
        const taskResult = await fetchAgentTask(next, candidateIds).catch((caught: unknown) => {
          if (!stale()) {
            setWarnings((current) => [
              ...current,
              caught instanceof Error ? caught.message : "Recommendation failed.",
            ]);
          }
          return null;
        });
        if (taskResult && !stale()) setTask(taskResult);
      }
    } catch (caught: unknown) {
      if (!stale()) {
        setError(caught instanceof Error ? caught.message : "Search failed.");
      }
    } finally {
      if (!stale()) setLoading(false);
    }
  }

  const allProducts = [...products, ...similar];
  const recommendedId = task?.selectedProductId;
  const recommendedProduct = allProducts.find(
    (product) => product.id === recommendedId,
  );
  const drawerProduct = allProducts.find(
    (product) => product.id === drawerProductId,
  );
  const approvalProduct = allProducts.find(
    (product) => product.id === approvalProductId,
  );

  function auditFor(productId: string) {
    return audits.find((audit) => audit.productId === productId);
  }

  function openDrawer(productId: string) {
    setDrawerProductId(productId);
    if (auditFor(productId) || evidenceLoadingIds.includes(productId)) return;
    // Similar options skip the up-front evidence pass, so fetch it when first opened.
    setEvidenceLoadingIds((ids) => [...ids, productId]);
    fetchAudit(productId)
      .then((audit) =>
        setAudits((current) =>
          current.some((item) => item.productId === audit.productId)
            ? current
            : [...current, audit],
        ),
      )
      .catch(() => undefined)
      .finally(() =>
        setEvidenceLoadingIds((ids) => ids.filter((id) => id !== productId)),
      );
  }

  function productGrid(list: Product[]) {
    return (
      <div className="mb-8 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((product, index) => (
          <div
            key={product.id}
            className="animate-fade-up"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <ProductCard
              product={product}
              audit={auditFor(product.id)}
              recommended={product.id === recommendedId}
              onOpen={() => openDrawer(product.id)}
              onBuy={() => setApprovalProductId(product.id)}
            />
          </div>
        ))}
      </div>
    );
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
            searched ? "justify-start pb-2 pt-5" : "min-h-screen justify-center"
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
              {loading && products.length === 0 && similar.length === 0 ? (
                <>
                  {constraints ? <ConstraintChips constraints={constraints} /> : null}
                  <SearchSkeletons />
                </>
              ) : null}
              {!loading &&
              searched &&
              products.length === 0 &&
              similar.length === 0 &&
              !error ? (
                <div className="mb-8">
                  {constraints ? (
                    <ConstraintChips constraints={constraints} />
                  ) : null}
                  <h2 className="text-3xl font-extrabold tracking-tight text-[#1c1917]">
                    No matching results
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[#57534e]">
                    Try the search again, or loosen the price or product
                    wording.
                  </p>
                </div>
              ) : null}
              {products.length > 0 || similar.length > 0 ? (
                <>
                  {constraints ? (
                    <ConstraintChips constraints={constraints} />
                  ) : null}
                  {products.length > 0 ? (
                    <>
                      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <h2 className="text-4xl font-extrabold tracking-tight text-[#1c1917]">
                          {products.length === 1
                            ? "1 matching result"
                            : `${products.length} matching results`}
                        </h2>
                        <div className="flex flex-wrap gap-2">
                          {source === "demo_fixture" ? (
                            <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#9d174d] shadow-sm">
                              Demo catalogue — live search unavailable
                            </span>
                          ) : null}
                          {audits.some(
                            (audit) => audit.mode === "demo_fixture",
                          ) ? (
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
                      {productGrid(products)}
                    </>
                  ) : null}
                  {similar.length > 0 ? (
                    <div className="mt-4 border-t border-[#e7e5e4] pt-10">
                      <h2 className="text-3xl font-extrabold tracking-tight text-[#1c1917]">
                        Similar options
                      </h2>
                      <p className="mb-6 mt-2 max-w-2xl text-sm leading-6 text-[#57534e]">
                        Close to what you asked for, but they miss a requirement
                        — usually the budget, or a word that is not on the
                        listing.
                      </p>
                      {productGrid(similar)}
                    </div>
                  ) : null}
                  {loading ? (
                    <p className="mb-8 text-sm text-[#57534e]">Still checking more listings…</p>
                  ) : null}
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
