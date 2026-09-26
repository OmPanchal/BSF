"use client";

type IntentBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
};

export function IntentBar({
  value,
  onChange,
  onSubmit,
  loading,
}: IntentBarProps) {
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="flex-1">
        <span className="mb-2 block text-sm font-medium text-slate-300">
          What should your bot buy?
        </span>
        <input
          className="w-full rounded-lg border border-[#2a3644] bg-[#121920] px-4 py-3 text-base text-slate-100 outline-none ring-[#7dd3c0] placeholder:text-slate-500 focus:ring-2"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Workout earbuds under £100"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-[#7dd3c0] px-5 py-3 text-base font-semibold text-[#0f1419] hover:bg-[#9ee0d2] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Searching…" : "Search"}
      </button>
    </form>
  );
}
