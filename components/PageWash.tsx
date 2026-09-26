export function PageWash() {
  return (
    <>
      <div className="animate-blob pointer-events-none absolute left-[6%] top-[8%] h-80 w-80 rounded-full bg-[#ff7ad9]/75 blur-3xl" />
      <div className="animate-blob-alt pointer-events-none absolute right-[4%] top-[12%] h-96 w-96 rounded-full bg-[#7eb6ff]/75 blur-3xl" />
      <div className="animate-blob-slow pointer-events-none absolute left-[28%] top-[42%] h-80 w-[36rem] rounded-full bg-[#c4b5fd]/60 blur-3xl" />
      <div className="animate-blob pointer-events-none absolute right-[10%] top-[70%] h-72 w-72 rounded-full bg-[#ff7ad9]/45 blur-3xl" />
    </>
  );
}
