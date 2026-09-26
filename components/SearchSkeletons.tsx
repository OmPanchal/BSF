export function SearchSkeletons() {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="animate-fade-up rounded-xl border border-[#c6c6ca]/30 bg-white p-3"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <div className="animate-shimmer mb-3 aspect-[16/10] rounded-lg" />
          <div className="animate-shimmer mb-2 h-3 w-1/3 rounded" />
          <div className="animate-shimmer mb-2 h-4 w-2/3 rounded" />
          <div className="animate-shimmer mb-3 h-3 w-full rounded" />
          <div className="grid grid-cols-2 gap-2">
            <div className="animate-shimmer h-9 rounded-lg" />
            <div className="animate-shimmer h-9 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
