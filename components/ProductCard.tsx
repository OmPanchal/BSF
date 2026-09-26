"use client";

import { merchantHost, priceCheckLabel } from "@/lib/productDisplay";
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
    : (merchantHost(product) ?? product.category);
  const ip = product.attributes.ipRating
    ? String(product.attributes.ipRating)
    : null;
  const hasConcerns = (audit?.concerns.length ?? 0) > 0;
  const limitedEvidence = audit !== undefined && audit.status !== "complete";

  return (
    <article
      className="btn-press group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_18px_50px_rgba(80,40,20,0.08)] hover:shadow-[0_22px_60px_rgba(80,40,20,0.14)]"
      onClick={onOpen}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-[#f5f5f4]">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={`${product.brand} ${product.name}`}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 480px"
          />
        ) : null}
        {recommended || hasConcerns || audit ? (
          <div
            className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-semibold ${
              recommended
                ? "bg-[#1c1917] text-white"
                : hasConcerns
                  ? "bg-white/90 text-[#9d174d]"
                  : "bg-white/90 text-[#57534e]"
            }`}
          >
            {recommended
              ? "Recommended"
              : hasConcerns
                ? `${audit?.concerns.length ?? 0} concern${audit?.concerns.length === 1 ? "" : "s"}`
                : limitedEvidence
                  ? "Limited independent evidence"
                  : `${audit?.confidence} confidence`}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-medium text-[#78716c]">
          {product.brand}
          {audit ? ` · ${audit.confidence} confidence` : ""}
        </p>
        <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1c1917]">
          {product.name}
        </h3>
        <p className="mt-1 text-sm text-[#78716c]">
          {ip ? `${ip} · ` : null}
          {highlight}
        </p>
        {product.match?.kind === "similar" && product.match.notes.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {product.match.notes.map((note) => (
              <li
                key={note}
                className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900"
              >
                {note}
              </li>
            ))}
          </ul>
        ) : null}
        {audit ? (
          audit.pros.length + audit.concerns.length === 0 ? (
            <p className="mt-3 text-sm font-semibold leading-5 text-amber-900">
              No pros or cons found in the reviews.
            </p>
          ) : (
            <p className="mt-3 line-clamp-3 text-sm leading-5 text-[#44403c]">
              {audit.verdict}
            </p>
          )
        ) : null}
        {product.merchantRating !== undefined ? (
          <p className="mt-3 text-xs text-[#78716c]">
            {product.merchantRating.toFixed(1)} merchant rating
            {product.merchantReviewCount !== undefined
              ? ` · ${product.merchantReviewCount.toLocaleString("en-GB")} reviews`
              : ""}
          </p>
        ) : null}
        <div className="mb-4 mt-4">
          <span className="text-3xl font-extrabold tracking-tight">
            {gbp.format(product.pricePence / 100)}
          </span>
          <p className="mt-1 text-[11px] text-[#a8a29e]">
            {priceCheckLabel(product)}
          </p>
        </div>
        <div
          className="mt-auto grid grid-cols-2 gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="btn-press h-10 rounded-full border border-[#e7e5e4] text-xs font-semibold text-[#1c1917] hover:bg-[#fafaf9]"
            onClick={onOpen}
          >
            View details
          </button>
          <button
            type="button"
            className="btn-press flex h-10 items-center justify-center gap-1 rounded-full bg-[#1c1917] px-2 text-xs font-semibold text-white hover:bg-black"
            onClick={onBuy}
          >
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            Buy now
          </button>
        </div>
      </div>
    </article>
  );
}
