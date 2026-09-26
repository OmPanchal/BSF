"use client";

import { AgentTimeline } from "@/components/AgentTimeline";
import { ApprovalModal } from "@/components/ApprovalModal";
import { EvidencePanel } from "@/components/EvidencePanel";
import { Header } from "@/components/Header";
import { IntentBar } from "@/components/IntentBar";
import { ProductCard } from "@/components/ProductCard";
import type { AgentTask, Product, SocialProofAudit } from "@/types/contracts";
import { useState } from "react";

const DEFAULT_INTENT =
  "Workout earbuds under £100; prioritise secure fit and sweat resistance.";

export default function Home() {
  const [intent, setIntent] = useState(DEFAULT_INTENT);
  const [products, setProducts] = useState<Product[]>([]);
  const [audits, setAudits] = useState<SocialProofAudit[]>([]);
  const [task, setTask] = useState<AgentTask | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [investigateLoading, setInvestigateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);

  async function search() {
    setError(null);
    setAudits([]);
    setTask(null);
    setApprovalOpen(false);
    setSearchLoading(true);
    try {
      const response = await fetch(
        `/api/products?q=${encodeURIComponent(intent)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Search failed.");
      }
      setProducts(data.products ?? []);
      if (!data.products?.length) {
        setError(
          typeof data.warning === "string"
            ? data.warning
            : "No buyable UK listings found for that request.",
        );
      } else if (typeof data.warning === "string") {
        setError(data.warning);
      }
    } catch (caught) {
      setProducts([]);
      setError(caught instanceof Error ? caught.message : "Search failed.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function investigate() {
    setError(null);
    setInvestigateLoading(true);
    try {
      const candidateIds = products.map((product) => product.id);
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
      setError(caught instanceof Error ? caught.message : "Investigate failed.");
    } finally {
      setInvestigateLoading(false);
    }
  }

  const selectedProduct = products.find(
    (product) => product.id === task?.selectedProductId,
  );

  return (
    <div className="min-h-full">
      <Header />
      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <IntentBar
            value={intent}
            onChange={setIntent}
            onSubmit={search}
            loading={searchLoading}
          />
          {error ? (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          {products.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Candidates</h2>
                <button
                  type="button"
                  onClick={investigate}
                  disabled={investigateLoading}
                  className="rounded-lg bg-[#7dd3c0] px-4 py-2 text-sm font-semibold text-[#0f1419] disabled:opacity-60"
                >
                  {investigateLoading ? "Checking…" : "Investigate evidence"}
                </button>
              </div>
              <div className="grid gap-3">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    recommended={product.id === task?.selectedProductId}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
        <aside className="space-y-4">
          {audits.length > 0 ? <EvidencePanel audits={audits} /> : null}
          {task ? <AgentTimeline task={task} /> : null}
          {task && selectedProduct ? (
            <button
              type="button"
              onClick={() => setApprovalOpen(true)}
              className="w-full rounded-lg border border-[#7dd3c0] px-4 py-3 font-semibold text-[#7dd3c0]"
            >
              Review approval
            </button>
          ) : null}
        </aside>
      </main>
      {approvalOpen && selectedProduct ? (
        <ApprovalModal
          product={selectedProduct}
          onClose={() => setApprovalOpen(false)}
        />
      ) : null}
    </div>
  );
}
