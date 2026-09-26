"use client";

import { useEffect, useRef, useState } from "react";

type IntentBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  compact?: boolean;
};

const SEARCH_STEPS = [
  "Reading your request…",
  "Searching UK listings…",
  "Filtering out accessories and off-budget items…",
  "Confirming prices on merchant pages…",
  "Checking independent evidence…",
];

// Mounted only while loading, so every search starts from the first step.
function SearchStatus() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, SEARCH_STEPS.length - 1));
    }, 1800);
    return () => window.clearInterval(timer);
  }, []);

  return <>{SEARCH_STEPS[step]}</>;
}

export function IntentBar({
  value,
  onChange,
  onSubmit,
  loading,
  compact = false,
}: IntentBarProps) {
  const selectedOnFocus = useRef(false);

  return (
    <form
      className={`w-full ${compact ? "max-w-none" : "max-w-3xl"}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="sr-only" htmlFor="buyer-intent">
        What should your bot buy?
      </label>
      <div
        className={`relative overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_24px_70px_rgba(90,50,140,0.18)] transition-shadow duration-300 hover:shadow-[0_28px_80px_rgba(90,50,140,0.24)] ${
          loading ? "ring-2 ring-[#c4b5fd]" : ""
        }`}
      >
        {loading ? (
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1 overflow-hidden bg-[#ede9fe]">
            <span className="animate-search-scan absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-[#7eb6ff] via-[#c4b5fd] to-[#ff7ad9]" />
          </span>
        ) : null}
        <input
          id="buyer-intent"
          className={`w-full bg-transparent text-base text-[#1c1917] outline-none placeholder:text-[#a8a29e] ${
            compact ? "px-5 pb-1 pt-3" : "px-6 pb-2 pt-5"
          }`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => {
            // After a search, clicking the bar selects the old query so typing replaces it.
            if (compact) {
              event.currentTarget.select();
              selectedOnFocus.current = true;
            }
          }}
          onMouseUp={(event) => {
            // Without this the click's mouseup moves the caret and drops the selection.
            if (selectedOnFocus.current) {
              event.preventDefault();
              selectedOnFocus.current = false;
            }
          }}
          placeholder="Wireless earbuds under £50, noise cancelling headphones £100–£200…"
          disabled={loading}
        />
        <div className={`flex items-center justify-between px-4 ${compact ? "pb-3 pt-1" : "pb-4 pt-2"}`}>
          <p className="pl-2 text-sm text-[#78716c]" aria-live="polite">
            {loading ? <SearchStatus /> : "Search UK listings"}
          </p>
          <div className="flex items-center gap-2">
            {value && !loading ? (
              <button
                type="button"
                aria-label="Clear search"
                className="btn-press flex h-9 w-9 items-center justify-center rounded-full text-[#78716c] hover:bg-[#f5f5f4]"
                onClick={() => onChange("")}
              >
                <span className="material-symbols-outlined text-[18px]">
                  close
                </span>
              </button>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              aria-label={loading ? "Searching" : "Search"}
              className="btn-press flex h-10 w-10 items-center justify-center rounded-full bg-[#1c1917] text-white hover:bg-black disabled:opacity-70"
            >
              <span
                className={`material-symbols-outlined text-[20px] ${
                  loading ? "animate-spin-slow" : ""
                }`}
              >
                {loading ? "progress_activity" : "arrow_upward"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
