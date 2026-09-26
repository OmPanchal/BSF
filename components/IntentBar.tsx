"use client";

import { useEffect, useState } from "react";

type IntentBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
};

const SEARCH_STEPS = [
  "Matching the catalogue…",
  "Checking independent evidence…",
  "Comparing fit and budget…",
];

export function IntentBar({
  value,
  onChange,
  onSubmit,
  loading,
}: IntentBarProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!loading) {
      setStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % SEARCH_STEPS.length);
    }, 700);
    return () => window.clearInterval(timer);
  }, [loading]);

  return (
    <form
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label
        className="mb-3 block text-center text-lg font-bold tracking-tight md:text-xl"
        htmlFor="buyer-intent"
      >
        What should your bot buy?
      </label>
      <div
        className={`relative flex h-[72px] items-center overflow-hidden rounded-2xl border-2 bg-white pl-5 pr-3 shadow-[0_12px_32px_rgba(15,23,42,0.16)] ring-4 transition-[border-color,box-shadow] duration-300 ${
          loading
            ? "border-[#0051d5] ring-[#0051d5]/15"
            : "border-black ring-black/5 focus-within:ring-black/10"
        }`}
      >
        {loading ? (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-[#dbe1ff]">
            <span className="animate-search-scan absolute inset-y-0 w-1/3 rounded-full bg-[#0051d5]" />
          </span>
        ) : null}
        <span
          className={`material-symbols-outlined mr-3 shrink-0 text-[28px] text-[#0051d5] ${
            loading ? "animate-icon-pulse" : ""
          }`}
        >
          {loading ? "radar" : "search"}
        </span>
        <input
          id="buyer-intent"
          className="h-full w-full bg-transparent text-base font-medium text-[#191c1e] outline-none placeholder:font-normal placeholder:text-[#45474a]/70"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search products, e.g. workout earbuds under £100 with secure fit..."
          disabled={loading}
        />
        {value && !loading ? (
          <button
            type="button"
            aria-label="Clear search"
            className="btn-press mr-2 flex shrink-0 items-center justify-center rounded-full p-1 text-[#45474a] hover:bg-[#eceef0] hover:text-[#191c1e]"
            onClick={() => onChange("")}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="btn-press flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-black px-5 text-sm font-bold text-white hover:bg-[#45474a] disabled:opacity-80"
        >
          <span
            className={`material-symbols-outlined text-[20px] ${
              loading ? "animate-spin-slow" : ""
            }`}
          >
            {loading ? "progress_activity" : "search"}
          </span>
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
      <p
        className={`mt-3 h-5 text-center text-sm font-semibold text-[#0051d5] transition-opacity duration-200 ${
          loading ? "opacity-100" : "opacity-0"
        }`}
        aria-live="polite"
      >
        {loading ? SEARCH_STEPS[step] : "\u00a0"}
      </p>
    </form>
  );
}
