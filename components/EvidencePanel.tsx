"use client";

import { sourceNumber } from "@/lib/productDisplay";
import type { SocialProofAudit } from "@/types/contracts";

type EvidencePanelProps = {
  audits: SocialProofAudit[];
};

export function EvidencePanel({ audits }: EvidencePanelProps) {
  return (
    <section className="rounded-xl border border-[#2a3644] bg-[#1a222c] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Evidence</h2>
        {audits.some((audit) => audit.mode === "demo_fixture") ? (
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-200">
            Demo evidence snapshot
          </span>
        ) : (
          <span className="rounded-full border border-[#7dd3c0]/40 bg-[#7dd3c0]/10 px-2 py-0.5 text-xs font-medium text-[#7dd3c0]">
            Live sources
          </span>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {audits.map((audit) => (
          <div key={audit.productId} className="rounded-lg border border-[#2a3644] p-3">
            <p className="text-sm text-slate-400">
              {audit.sourceCount} sources · {audit.confidence} confidence
            </p>
            <p className="mt-2 text-base leading-relaxed">{audit.verdict}</p>
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Pros
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {audit.pros.slice(0, 2).map((claim) => (
                  <li key={claim.text}>
                    {claim.text}{" "}
                    {claim.evidenceUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 text-[#7dd3c0] underline"
                      >
                        [{sourceNumber(audit.sources, url)}]
                      </a>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
                Concerns
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {audit.concerns.slice(0, 2).map((claim) => (
                  <li key={claim.text}>
                    {claim.text}{" "}
                    {claim.evidenceUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 text-[#7dd3c0] underline"
                      >
                        [{sourceNumber(audit.sources, url)}]
                      </a>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
