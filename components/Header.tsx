export function Header() {
  return (
    <header className="border-b border-[#2a3644] px-6 py-4">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Bullshit Filter
        </h1>
        <p className="text-sm text-slate-400 sm:text-base">
          Independent evidence before a shopping agent spends your money.
        </p>
      </div>
    </header>
  );
}
