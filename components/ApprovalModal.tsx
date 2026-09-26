"use client";

import { priceCheckLabel } from "@/lib/productDisplay";
import type { Product } from "@/types/contracts";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

type ApprovalModalProps = {
  product: Product;
  onClose: () => void;
};

export function ApprovalModal({ product, onClose }: ApprovalModalProps) {
  return (
    <div className="animate-overlay-in fixed inset-0 z-[60] flex items-center justify-center bg-[#191c1e]/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-labelledby="approval-title"
        className="animate-modal-in flex w-full max-w-md flex-col items-center rounded-2xl bg-white p-10 text-center shadow-2xl"
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f5f5f4] text-[#1c1917]">
          <span
            className="material-symbols-outlined text-[36px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            task_alt
          </span>
        </div>
        <h2 id="approval-title" className="text-2xl font-bold">
          Approve purchase handoff
        </h2>
        <p className="mt-2 text-[15px] leading-6 text-[#45474a]">
          This does not complete a purchase and does not create an order. The
          next click opens the merchant checkout page for{" "}
          <strong>
            {product.brand} {product.name}
          </strong>{" "}
          ({gbp.format(product.pricePence / 100)}).
        </p>
        <p className="mt-1 text-[13px] text-[#45474a]">{priceCheckLabel(product)}</p>
        <p className="mt-2 text-[13px] text-[#45474a]">
          Status stays awaiting approval until you finish checkout on the
          merchant site.
        </p>
        <div className="mt-6 flex w-full flex-col gap-2">
          <a
            href={product.merchantUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-press flex h-12 items-center justify-center rounded-full bg-[#1c1917] text-sm font-semibold text-white hover:bg-black"
          >
            Open merchant checkout
          </a>
          <button
            type="button"
            onClick={onClose}
            className="btn-press h-12 rounded-full bg-[#f5f5f4] text-sm font-semibold text-[#1c1917] hover:bg-[#e7e5e4]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
