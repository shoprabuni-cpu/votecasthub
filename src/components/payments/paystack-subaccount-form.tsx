"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

type Provider = {
  name: string;
  code: string;
};

type VerifiedAccount = {
  key: string;
  name: string;
};

type Props = {
  organizationId: string;
  mode?: "create" | "update";
  businessName?: string;
  onSaved?: () => void;
};

export function PaystackSubaccountForm({
  organizationId,
  mode = "create",
  businessName = "",
  onSaved,
}: Props) {
  const router = useRouter();

  const [settlementType, setSettlementType] = useState<"ghipss" | "mobile_money">("ghipss");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [verifiedAccount, setVerifiedAccount] = useState<VerifiedAccount | null>(null);
  const [lookupStatus, setLookupStatus] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const verificationKey = JSON.stringify([organizationId, settlementType, bankCode, accountNumber]);
  const verifiedAccountName =
    verifiedAccount?.key === verificationKey ? verifiedAccount.name : "";

  // Fetch banks or mobile money providers
  useEffect(() => {
    const controller = new AbortController();

    async function loadProviders() {
      try {
        const response = await fetch("/api/payments/paystack/account-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId, type: settlementType }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) {
          setProviders(data.providers || []);
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setMessage(err instanceof Error ? err.message : "Could not load settlement providers.");
        }
      }
    }

    loadProviders();
    return () => controller.abort();
  }, [organizationId, settlementType]);

  // Account lookup debounce
  useEffect(() => {
    const controller = new AbortController();
    const normalized = accountNumber.replace(/[\s()-]/g, "").replace(/^\+?233/, "0");

    const isValid =
      settlementType === "mobile_money"
        ? /^0\d{9}$/.test(normalized)
        : /^\d{6,20}$/.test(accountNumber);

    if (!bankCode || !isValid) return;

    const timer = setTimeout(async () => {
      setLookupStatus("Checking account with Paystack & NIBSS…");
      try {
        const response = await fetch("/api/payments/paystack/account-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            type: settlementType,
            bankCode,
            accountNumber,
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        if (!controller.signal.aborted) {
          setVerifiedAccount({ key: verificationKey, name: data.accountName });
          setLookupStatus("");
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setLookupStatus(err instanceof Error ? err.message : "Account lookup unavailable.");
        }
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [organizationId, settlementType, bankCode, accountNumber, verificationKey]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!verifiedAccountName || !isConfirmed || isSubmitting) return;

    setIsSubmitting(true);
    setMessage("");

    const form = new FormData(e.currentTarget);

    try {
      const response = await fetch("/api/payments/paystack/subaccount", {
        method: mode === "update" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          type: settlementType,
          bankCode,
          accountNumber,
          confirmedAccountName: verifiedAccountName,
          businessName: form.get("businessName"),
          contactName: form.get("contactName"),
          contactPhone: form.get("contactPhone"),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setMessage(
        data.status === "active"
          ? "Payment account active and ready for settlements."
          : "Account submitted. Paystack settlement approval is pending."
      );
      onSaved?.();
      router.refresh();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Unable to save payment account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset disabled={isSubmitting} className="space-y-5">
        {/* Settlement Type Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2">
            Settlement Method
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: "ghipss" as const, label: "Bank Account (ACH/GhIPSS)", icon: "coin" as const },
              { value: "mobile_money" as const, label: "Mobile Money (MTN/Telecel/AT)", icon: "sparkle" as const },
            ].map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => {
                  setSettlementType(option.value);
                  setProviders([]);
                  setMessage("");
                  setLookupStatus("");
                  setBankCode("");
                  setAccountNumber("");
                  setVerifiedAccount(null);
                  setIsConfirmed(false);
                }}
                className={`flex items-center justify-center gap-2.5 rounded-xl border p-3.5 text-xs font-semibold transition-all ${
                  settlementType === option.value
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600/30 shadow-2xs"
                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
                }`}
              >
                <Icon name={option.icon} size={15} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Fields Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Business / Organizer Name */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Settlement Account Name / Business Name
            </label>
            <input
              name="businessName"
              defaultValue={businessName}
              required
              minLength={2}
              maxLength={160}
              placeholder="e.g. Accra Arts Collective or Event Brand"
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-all shadow-2xs"
            />
          </div>

          {/* Provider / Bank Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              {settlementType === "mobile_money" ? "Mobile Money Network" : "Bank Name"}
            </label>
            <select
              required
              value={bankCode}
              onChange={(e) => {
                setBankCode(e.target.value);
                setLookupStatus("");
                setVerifiedAccount(null);
                setIsConfirmed(false);
              }}
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-xs text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-all shadow-2xs"
            >
              <option value="">
                {providers.length ? "Choose provider…" : "Loading providers…"}
              </option>
              {providers.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Account Number */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              {settlementType === "mobile_money" ? "MoMo Phone Number" : "Account Number"}
            </label>
            <input
              value={accountNumber}
              onChange={(e) => {
                setAccountNumber(e.target.value);
                setLookupStatus("");
                setVerifiedAccount(null);
                setIsConfirmed(false);
              }}
              required
              inputMode="numeric"
              maxLength={24}
              placeholder={settlementType === "mobile_money" ? "0241234567" : "1234567890"}
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-all font-mono shadow-2xs"
            />
          </div>

          {/* Account Verification Box */}
          <div className="sm:col-span-2">
            <div
              className={`rounded-xl border p-4 transition-all ${
                verifiedAccountName
                  ? "border-emerald-200 bg-emerald-50/70"
                  : lookupStatus
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-stone-200 bg-stone-50 text-stone-500"
              }`}
            >
              {verifiedAccountName ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                    <Icon name="check" size={13} />
                    <span>Registered Account Name Confirmed</span>
                  </div>
                  <div className="text-base font-bold text-stone-900 font-mono">
                    {verifiedAccountName}
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Verified through Paystack settlement network. Please verify this matches your bank/MoMo identity.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  {lookupStatus ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                      <span>{lookupStatus}</span>
                    </>
                  ) : (
                    <>
                      <Icon name="shield" size={14} className="text-stone-400" />
                      <span>Select provider and enter number to automatically verify account ownership.</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Confirmation Checkbox */}
          {verifiedAccountName && (
            <div className="sm:col-span-2">
              <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3.5 cursor-pointer hover:bg-stone-50 transition-colors shadow-2xs">
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 bg-white text-emerald-700 focus:ring-emerald-600"
                />
                <span className="text-xs text-stone-700">
                  I confirm that <strong className="text-stone-900 font-mono">{verifiedAccountName}</strong> is the legitimate recipient account for our organization’s ticket and paid vote revenues.
                </span>
              </label>
            </div>
          )}

          {/* Contact Details */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Contact Name</label>
            <input
              name="contactName"
              required
              minLength={2}
              maxLength={120}
              placeholder="Full name of representative"
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-all shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">Contact Phone</label>
            <input
              name="contactPhone"
              required
              type="tel"
              minLength={7}
              maxLength={24}
              placeholder="024XXXXXXX"
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-all font-mono shadow-2xs"
            />
          </div>
        </div>
      </fieldset>

      {/* Message Output */}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800" role="status">
          {message}
        </div>
      )}

      {/* Submit Action */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !verifiedAccountName || !isConfirmed}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
        >
          {isSubmitting ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <span>Saving account…</span>
            </>
          ) : mode === "update" ? (
            "Save updated payment account"
          ) : (
            "Create & verify payment account"
          )}
        </button>
      </div>
    </form>
  );
}
