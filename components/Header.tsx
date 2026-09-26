export function Header() {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 bg-[#191c1e] text-white">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-12">
        <span className="flex items-center gap-3 text-xl font-extrabold uppercase tracking-tight">
          <span className="h-8 w-2 rounded-full bg-[#7aa2ff]" />
          Bullshit Filter
        </span>
        <p className="hidden text-sm text-white/70 sm:block">
          Independent evidence before a shopping agent spends your money.
        </p>
      </div>
    </header>
  );
}
