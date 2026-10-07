"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

export function RefreshAccount({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/payments/paystack/subaccount", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(`Paystack status: ${data.status}`);
      router.refresh();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Verification check failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={refresh}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
      >
        <span className={busy ? "animate-spin" : ""}>↻</span>
        <span>{busy ? "Querying Paystack…" : "Re-sync Paystack status"}</span>
      </button>

      {message && (
        <span className="text-xs text-stone-400 font-mono" role="status">
          · {message}
        </span>
      )}
    </div>
  );
}
