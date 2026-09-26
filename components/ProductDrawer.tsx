"use client";

import {
  displayAttributes,
  merchantHost,
  priceCheckLabel,
  sourceNumber,
} from "@/lib/productDisplay";
import type { Product, SocialProofAudit } from "@/types/contracts";
import Image from "next/image";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

function formatAttributeKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatAttributeValue(value: string | number | boolean) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

type ProductDrawerProps = {
  product: Product;
  audit?: SocialProofAudit;
  recommended?: boolean;
  evidenceLoading?: boolean;
  onClose: () => void;
  onBuy: () => void;
};

export function ProductDrawer({
  product,
  audit,
  recommended,
  evidenceLoading,
  onClose,
  onBuy,
}: ProductDrawerProps) {
  const attributes = displayAttributes(product);
  const host = merchantHost(product);

  return (
    <div
      className="animate-overlay-in fixed inset-0 z-50 flex justify-end bg-[#191c1e]/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        className="animate-drawer-in flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-labelledby="drawer-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white/90 p-4 backdrop-blur-md">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#1c1917]">
            {product.id}
            {recommended ? " · recommended" : ""}
          </span>
          <button
            type="button"
            aria-label="Close details"
            className="btn-press rounded-full bg-[#eceef0] p-1 hover:bg-[#e6e8ea]"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-6 p-6">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#eceef0]">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={`${product.brand} ${product.name}`}
                fill
                className="object-cover"
                sizes="576px"
              />
            ) : null}
            {audit?.mode === "demo_fixture" ? (
              <div className="absolute left-3 top-3 rounded bg-white/90 px-2 py-1 text-[11px] font-bold backdrop-blur-sm">
                Demo evidence snapshot
              </div>
            ) : null}
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-[#45474a]">
              {product.brand}
            </span>
            <h2 id="drawer-title" className="mt-1 text-3xl font-bold">
              {product.name}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-2xl font-extrabold">
                {gbp.format(product.pricePence / 100)}
              </span>
              <span className="rounded bg-[#eceef0] px-2 py-1 text-[11px] font-semibold text-[#1c1917]">
                {priceCheckLabel(product)}
              </span>
            </div>
            {host ? (
              <p className="mt-2 text-xs text-[#45474a]">Sold via {host}</p>
            ) : null}
            {product.match?.kind === "similar" && product.match.notes.length > 0 ? (
              <p className="mt-2 inline-block rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                Close alternative: {product.match.notes.join(" · ")}
              </p>
            ) : null}
            {product.merchantRating !== undefined ? (
              <div className="mt-2 flex items-center gap-1 text-[#45474a]">
                <span className="material-symbols-outlined text-[18px] text-[#191c1e]">
                  star
                </span>
                <span className="text-xs font-semibold text-[#191c1e]">
                  {product.merchantRating.toFixed(1)} merchant rating
                </span>
                {product.merchantReviewCount !== undefined ? (
                  <span className="text-[13px]">
                    ({product.merchantReviewCount.toLocaleString("en-GB")}{" "}
                    reviews)
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {attributes.length > 0 ? (
            <div className="rounded-xl bg-[#f2f4f6] p-4">
              <h3 className="mb-2 text-sm font-bold">Key specifications</h3>
              <div className="grid grid-cols-2 gap-2">
                {attributes.map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-lg bg-white p-2"
                  >
                    <span className="block text-[11px] font-bold text-[#45474a]">
                      {formatAttributeKey(key)}
                    </span>
                    <span className="text-xs font-semibold">
                      {formatAttributeValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {audit ? (
            <div className="rounded-xl bg-[#f2f4f6] p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold">Independent evidence</h3>
                <span className="text-[11px] font-semibold text-[#45474a]">
                  {audit.sourceCount} sources · {audit.confidence} confidence
                </span>
              </div>
              {audit.status !== "complete" && (audit.pros.length > 0 || audit.concerns.length > 0) ? (
                <p className="mb-2 inline-block rounded bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900">
                  {audit.status === "error"
                    ? "Evidence lookup failed"
                    : "Limited independent evidence"}
                </p>
              ) : null}
              {audit.pros.length === 0 && audit.concerns.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-bold text-amber-950">No pros or cons</p>
                  <p className="mt-1 text-[13px] leading-5 text-amber-900">
                    The pages we checked did not support a pros and cons list for this product.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[15px] leading-6 text-[#45474a]">{audit.verdict}</p>
                  <div className="mt-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide">Pros</p>
                    {audit.pros.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] leading-5">
                        {audit.pros.map((claim) => (
                          <li key={claim.text}>
                            {claim.text}
                            {claim.evidenceUrls.map((url) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1 font-semibold text-[#1c1917] underline"
                              >
                                [{sourceNumber(audit.sources, url)}]
                              </a>
                            ))}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-[13px] leading-5 text-[#78716c]">
                        No pros were found in the reviews.
                      </p>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
                      Concerns
                    </p>
                    {audit.concerns.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] leading-5">
                        {audit.concerns.map((claim) => (
                          <li key={claim.text}>
                            {claim.text}
                            {claim.evidenceUrls.map((url) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1 font-semibold text-[#1c1917] underline"
                              >
                                [{sourceNumber(audit.sources, url)}]
                              </a>
                            ))}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-[13px] leading-5 text-[#78716c]">
                        No concerns were found in the reviews.
                      </p>
                    )}
                  </div>
                </>
              )}
              {audit.sources.length > 0 && (
              <div className="mt-4 space-y-2">
                {audit.sources.map((source, index) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg bg-white p-3 hover:bg-[#eceef0]"
                  >
                    <p className="text-xs font-bold">
                      [{index + 1}] {source.title}
                    </p>
                    <p className="mt-1 text-[13px] text-[#45474a]">
                      {source.excerpt}
                    </p>
                    <p className="mt-1 text-[11px] uppercase text-[#1c1917]">
                      {source.sourceType}
                      {source.publishedAt ? ` · ${source.publishedAt}` : ""}
                    </p>
                  </a>
                ))}
              </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-[#e7e5e4] bg-[#fafaf9] px-4 py-3">
              <p className="text-sm font-bold text-[#1c1917]">
                {evidenceLoading ? "Checking reviews" : "No pros or cons yet"}
              </p>
              <p className="mt-1 text-[13px] leading-5 text-[#57534e]">
                {evidenceLoading
                  ? "Pros and cons will show here once the review pages have been read."
                  : "This product has no pros and cons list. Reviews were not available to summarise."}
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 mt-auto flex items-center gap-4 bg-white p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
          <a
            href={product.merchantUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-press flex h-12 items-center justify-center rounded-full border border-[#e7e5e4] px-4 text-sm font-semibold text-[#1c1917] hover:bg-[#fafaf9]"
          >
            Merchant listing
          </a>
          <button
            type="button"
            className="btn-press flex h-12 flex-1 items-center justify-center gap-1 rounded-full bg-[#1c1917] text-sm font-semibold text-white hover:bg-black"
            onClick={onBuy}
          >
            <span className="material-symbols-outlined text-[20px]">
              shopping_bag
            </span>
            Buy now · {gbp.format(product.pricePence / 100)}
          </button>
        </div>
      </aside>
    </div>
  );
}
