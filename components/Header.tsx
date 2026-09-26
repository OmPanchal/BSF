export function Header() {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-[#c6c6ca]/30 bg-[#f7f9fb]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 md:px-12">
        <span className="flex items-center gap-2 text-xl font-bold uppercase tracking-tight">
          <span className="h-3 w-3 rounded-full bg-[#0051d5] shadow-[0_0_0_4px_rgba(0,81,213,0.15)]" />
          Bullshit Filter
        </span>
        <p className="hidden text-sm text-[#45474a] sm:block">
          Independent evidence before a shopping agent spends your money.
        </p>
      </div>
    </header>
  );
}
