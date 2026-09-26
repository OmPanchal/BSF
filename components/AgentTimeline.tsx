"use client";

import type { AgentTask, Product } from "@/types/contracts";

type AgentTimelineProps = {
  task: AgentTask;
  selectedProduct?: Product;
};

export function AgentTimeline({ task, selectedProduct }: AgentTimelineProps) {
  return (
    <section className="rounded-[28px] bg-white p-6 text-[#1c1917] shadow-[0_18px_50px_rgba(80,40,20,0.08)] md:p-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-extrabold tracking-tight">
          {selectedProduct ? "Recommendation" : "Agent notes"}
        </h2>
        {task.status === "awaiting_approval" ? (
          <span className="rounded-full bg-[#f5f5f4] px-3 py-1 text-[11px] font-semibold text-[#57534e]">
            Awaiting your approval
          </span>
        ) : null}
      </div>
      {selectedProduct ? (
        <p className="mb-3 text-sm font-semibold text-[#1c1917]">
          {selectedProduct.brand} {selectedProduct.name}
        </p>
      ) : null}
      {task.rationale ? (
        <p className="text-base leading-7 text-[#57534e]">{task.rationale}</p>
      ) : null}
    </section>
  );
}
