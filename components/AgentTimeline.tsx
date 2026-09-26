"use client";

import type { AgentTask } from "@/types/contracts";

type AgentTimelineProps = {
  task: AgentTask;
};

export function AgentTimeline({ task }: AgentTimelineProps) {
  return (
    <section className="rounded-xl border border-[#2a3644] bg-[#1a222c] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Recommendation</h2>
        {task.agentMode === "demo-simulation" ? (
          <span className="rounded-full border border-slate-500 px-2 py-0.5 text-xs font-medium text-slate-300">
            Simulated agent walkthrough
          </span>
        ) : (
          <span className="rounded-full border border-[#7dd3c0]/40 px-2 py-0.5 text-xs font-medium text-[#7dd3c0]">
            Grok Bot
          </span>
        )}
      </div>
      {task.rationale ? (
        <p className="mb-4 text-base leading-relaxed text-slate-100">
          {task.rationale}
        </p>
      ) : null}
      <ol className="space-y-2 text-sm text-slate-300">
        {task.events.map((event) => (
          <li key={event.step} className="flex gap-3">
            <span className="w-5 shrink-0 font-mono text-slate-500">
              {event.step}
            </span>
            <span>
              {event.message}
              {event.sourceUrl ? (
                <>
                  {" "}
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#7dd3c0] underline"
                  >
                    source
                  </a>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
