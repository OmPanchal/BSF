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
        <span className="rounded-full bg-[#f5f5f4] px-3 py-1 text-[11px] font-semibold text-[#57534e]">
          {task.agentMode === "demo-simulation"
            ? "Simulated agent walkthrough"
            : "Grok Bot"}
        </span>
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
      <ol className="mt-6 grid gap-3 sm:grid-cols-2">
        {task.events.map((event) => (
          <li
            key={event.step}
            className="rounded-2xl bg-[#fafaf9] p-3 text-sm leading-5 text-[#57534e]"
          >
            <span
              className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white ${
                event.status === "failed" ? "bg-[#9d174d]" : "bg-[#1c1917]"
              }`}
            >
              {event.step}
            </span>
            {event.message}
            {event.sourceUrl ? (
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-xs font-semibold text-[#1c1917] underline"
              >
                Source
              </a>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
