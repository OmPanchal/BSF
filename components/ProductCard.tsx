"use client";

import type { Product } from "@/types/contracts";
import Image from "next/image";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

type ProductCardProps = {
  product: Product;
  recommended?: boolean;
};

export function ProductCard({ product, recommended }: ProductCardProps) {
  return (
    <article
      className={`flex gap-4 rounded-xl border bg-[#1a222c] p-4 ${
        recommended ? "border-[#7dd3c0]" : "border-[#2a3644]"
      }`}
    >
      {product.imageUrl ? (
        <Image
          src={product.imageUrl}
          alt={`${product.brand} ${product.name}`}
          width={120}
          height={120}
          className="h-[120px] w-[120px] shrink-0 rounded-lg object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        {recommended ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#7dd3c0]">
            Recommended for this buyer
          </p>
        ) : null}
        <h3 className="text-lg font-semibold">
          {product.brand} {product.name}
        </h3>
        <p className="mt-1 text-xl text-slate-100">
          {gbp.format(product.pricePence / 100)}
        </p>
        <p className="mt-1 text-xs text-slate-500">Price snapshot — may change</p>
        {product.merchantRating !== undefined ? (
          <p className="mt-2 text-sm text-slate-400">
            Merchant rating {product.merchantRating.toFixed(1)}
            {product.merchantReviewCount !== undefined
              ? ` (${product.merchantReviewCount.toLocaleString("en-GB")} reviews)`
              : null}
          </p>
        ) : null}
        <a
          href={product.merchantUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-[#7dd3c0] underline"
        >
          Merchant listing
        </a>
      </div>
    </article>
  );
}
