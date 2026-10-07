"use client";

import { useRef, useState } from "react";
import { AppModal } from "@/components/ui/app-modal";

interface PaystackCreditButtonProps {
  organizationId: string;
  credits: number;
  className?: string;
  label?: string;
  featured?: boolean;
}

export function PaystackCreditButton({
  organizationId,
  credits,
  className,
  label = "Purchase with Paystack",
  featured = false,
}: PaystackCreditButtonProps) {
  const key = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buy = async () => {
    setBusy(true);
    try {
      key.current ??= crypto.randomUUID();
      const r = await fetch("/api/payments/paystack/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, credits, requestKey: key.current }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Payment initialization failed.");
      window.location.assign(d.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment temporarily unavailable. Please try again.");
      setBusy(false);
    }
  };

  const defaultClasses = featured
    ? "w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 transition-all cursor-pointer"
    : "w-full inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-semibold text-stone-800 shadow-2xs hover:bg-stone-50 hover:border-stone-300 active:scale-[0.99] disabled:opacity-60 transition-all cursor-pointer";

  return (
    <>
      <button
        type="button"
        onClick={buy}
        disabled={busy}
        className={className ?? defaultClasses}
      >
        {busy ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Opening Paystack...</span>
          </>
        ) : (
          <span>{label}</span>
        )}
      </button>

      <AppModal
        open={Boolean(error)}
        title="Payment unavailable"
        message={error ?? "Please check your network connection and try again."}
        tone="danger"
        confirmLabel="Close"
        cancelLabel=""
        onCancel={() => setError(null)}
        onConfirm={() => setError(null)}
      />
    </>
  );
}
