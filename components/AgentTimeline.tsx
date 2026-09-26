"use client";

import type { AgentTask, Product } from "@/types/contracts";
import Image from "next/image";

type AgentTimelineProps = {
  task: AgentTask;
  selectedProduct?: Product;
};

export function AgentTimeline({ task, selectedProduct }: AgentTimelineProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#c6c6ca]/30 bg-white shadow-sm">
      <div className="flex flex-col md:flex-row">
        <div className="flex items-center gap-4 bg-[#dbe1ff]/50 p-4 md:w-72 md:flex-col md:items-start">
          {selectedProduct?.imageUrl ? (
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white md:h-36 md:w-full">
              <Image
                src={selectedProduct.imageUrl}
                alt={`${selectedProduct.brand} ${selectedProduct.name}`}
                fill
                className="object-cover"
                sizes="288px"
              />
            </div>
          ) : null}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#0051d5]">
              Chosen for this buyer
            </p>
            <p className="mt-1 text-lg font-bold">
              {selectedProduct
                ? `${selectedProduct.brand} ${selectedProduct.name}`
                : "Recommendation"}
            </p>
          </div>
        </div>
        <div className="flex-1 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">Recommendation</h2>
            {task.agentMode === "demo-simulation" ? (
              <span className="rounded-lg bg-[#eceef0] px-2 py-1 text-[11px] font-bold text-[#45474a]">
                Simulated agent walkthrough
              </span>
            ) : (
              <span className="rounded-lg bg-[#dbe1ff] px-2 py-1 text-[11px] font-bold text-[#0051d5]">
                Grok Bot
              </span>
            )}
          </div>
          {task.rationale ? (
            <p className="text-[15px] leading-6 text-[#45474a]">
              {task.rationale}
            </p>
          ) : null}
          <ol className="mt-4 flex flex-col gap-2">
            {task.events.map((event) => (
              <li
                key={event.step}
                className="flex items-start gap-2 text-[13px] text-[#45474a]"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0051d5] text-[11px] font-bold text-white">
                  {event.step}
                </span>
                <span className="pt-0.5">{event.message}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
