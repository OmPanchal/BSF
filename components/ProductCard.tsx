"use client";

import type { Product, SocialProofAudit } from "@/types/contracts";
import Image from "next/image";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

type ProductCardProps = {
  product: Product;
  audit?: SocialProofAudit;
  recommended?: boolean;
  onOpen: () => void;
  onBuy: () => void;
};

export function ProductCard({
  product,
  audit,
  recommended,
  onOpen,
  onBuy,
}: ProductCardProps) {
  const highlight = product.attributes.listedUse
    ? String(product.attributes.listedUse)
    : product.category;
  const ip = product.attributes.ipRating
    ? String(product.attributes.ipRating)
    : null;
  const hasConcerns = (audit?.concerns.length ?? 0) > 0;

  return (
    <article
      className={`btn-press group relative flex cursor-pointer flex-col rounded-xl bg-white p-3 shadow-sm hover:shadow-md ${
        recommended
          ? "border-2 border-[#0051d5] shadow-[0_8px_24px_rgba(0,81,213,0.12)]"
          : hasConcerns
            ? "border border-[#c6c6ca]/30 border-t-4 border-t-amber-500"
            : "border border-[#c6c6ca]/30"
      }`}
      onClick={onOpen}
    >
      <div className="relative mb-3 aspect-[16/10] overflow-hidden rounded-lg bg-[#eceef0]">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={`${product.brand} ${product.name}`}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 400px"
          />
        ) : null}
        <div className="absolute left-2 top-2 rounded bg-white/90 px-2 py-0.5 text-[10px] font-bold tracking-wide backdrop-blur-md">
          {product.brand}
        </div>
        {recommended ? (
          <div className="absolute right-2 top-2 rounded bg-[#0051d5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Best match
          </div>
        ) : null}
      </div>
      {audit ? (
        <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-bold">
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#0051d5]" />
            {audit.confidence} confidence
          </span>
          {recommended ? (
            <span className="text-[#0051d5]">Best match</span>
          ) : (
            <span className="font-medium text-[#45474a]">Candidate</span>
          )}
        </div>
      ) : null}
      <h3 className="line-clamp-1 text-base font-bold group-hover:text-[#0051d5]">
        {product.brand} {product.name}
      </h3>
      <p className="mt-0.5 line-clamp-1 text-xs text-[#45474a]">
        {ip ? `${ip} · ` : null}
        {highlight}
      </p>
      {audit ? (
        <p className="mt-1 line-clamp-2 text-xs leading-4 text-[#45474a]">
          {audit.verdict}
        </p>
      ) : null}
      <div className="mb-3 mt-2 flex items-baseline gap-1">
        <span className="text-lg font-extrabold">
          {gbp.format(product.pricePence / 100)}
        </span>
        <span className="text-[11px] text-[#45474a]">snapshot</span>
      </div>
      <div
        className="mt-auto grid grid-cols-2 gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="btn-press h-9 rounded-lg bg-[#eceef0] px-2 text-center text-[11px] font-semibold hover:bg-[#e6e8ea]"
          onClick={onOpen}
        >
          View details
        </button>
        <button
          type="button"
          className="btn-press flex h-9 items-center justify-center gap-1 rounded-lg bg-black px-2 text-[11px] font-bold text-white hover:bg-[#45474a]"
          onClick={onBuy}
        >
          <span className="material-symbols-outlined text-[16px]">bolt</span>
          Buy now
        </button>
      </div>
    </article>
  );
}
