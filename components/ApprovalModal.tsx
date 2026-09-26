"use client";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-labelledby="approval-title"
        className="w-full max-w-lg rounded-xl border border-[#2a3644] bg-[#1a222c] p-6"
      >
        <h2 id="approval-title" className="text-xl font-semibold">
          Approve purchase handoff
        </h2>
        <p className="mt-3 text-slate-300">
          This does not complete a purchase and does not create an order. The
          next click opens the merchant checkout page for{" "}
          <strong>
            {product.brand} {product.name}
          </strong>{" "}
          ({gbp.format(product.pricePence / 100)} snapshot).
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Status stays awaiting approval until you finish checkout on the
          merchant site.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={product.merchantUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-[#7dd3c0] px-4 py-2 font-semibold text-[#0f1419]"
          >
            Open merchant checkout
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#2a3644] px-4 py-2 text-slate-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
