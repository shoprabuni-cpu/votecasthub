"use client";

import { useActionState, useEffect, useState } from "react";
import { updateCategoryNomineeAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { EventDialog } from "./event-dialog";
import { Icon } from "@/components/icon";

type Props = {
  nominee: {
    id: string;
    name: string;
    public_code: string | null;
    biography: string | null;
    display_order: number;
    is_active: boolean;
  };
  backTo: string;
};

export function EditNomineeForm({ nominee, backTo }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    updateCategoryNomineeAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        setOpen(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [state?.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-sm font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 transition-all select-none min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>Edit</span>
      </button>

      {open && (
        <EventDialog
          open={open}
          title={`Edit Nominee: ${nominee.name}`}
          onClose={() => setOpen(false)}
          busy={pending}
        >
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="nomineeId" value={nominee.id} />
            <input type="hidden" name="backTo" value={backTo} />

            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <span className="text-xs text-stone-500">Edit candidate details and voting code</span>
              <span className="text-[10px] text-stone-400 font-mono">ID: {nominee.id.slice(0, 8)}</span>
            </div>

            <div>
              <label
                htmlFor={`nominee-edit-name-${nominee.id}`}
                className="block text-xs font-semibold text-stone-800 mb-1"
              >
                Full Name <span className="text-emerald-700">*</span>
              </label>
              <input
                id={`nominee-edit-name-${nominee.id}`}
                name="name"
                minLength={1}
                maxLength={160}
                required
                defaultValue={nominee.name}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
              />
            </div>

            <div>
              <label
                htmlFor={`nominee-edit-code-${nominee.id}`}
                className="block text-xs font-semibold text-stone-800 mb-1"
              >
                Voting / Public Code <span className="text-stone-400 font-normal">· e.g. 01, 02, BNA-01</span>
              </label>
              <input
                id={`nominee-edit-code-${nominee.id}`}
                name="publicCode"
                maxLength={32}
                pattern="[A-Za-z0-9-]*"
                placeholder="e.g. 01"
                defaultValue={nominee.public_code ?? ""}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-mono font-medium text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15 uppercase"
              />
              <p className="mt-1 text-[11px] text-stone-500">
                This code is dialed in USSD and sent in WhatsApp messages (e.g. <code>VOTE 1000 01</code>).
              </p>
            </div>

            <div>
              <label
                htmlFor={`nominee-edit-bio-${nominee.id}`}
                className="block text-xs font-semibold text-stone-800 mb-1"
              >
                Biography / Profile <span className="text-stone-400 font-normal">· optional</span>
              </label>
              <textarea
                id={`nominee-edit-bio-${nominee.id}`}
                name="biography"
                maxLength={3000}
                rows={3}
                defaultValue={nominee.biography ?? ""}
                className="w-full rounded-xl border border-stone-300 bg-white p-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor={`nominee-edit-order-${nominee.id}`}
                  className="block text-xs font-semibold text-stone-800 mb-1"
                >
                  Display Order
                </label>
                <input
                  id={`nominee-edit-order-${nominee.id}`}
                  name="displayOrder"
                  type="number"
                  min="0"
                  max="10000"
                  required
                  defaultValue={nominee.display_order}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor={`nominee-edit-active-${nominee.id}`}
                  className="block text-xs font-semibold text-stone-800 mb-1"
                >
                  Status
                </label>
                <select
                  id={`nominee-edit-active-${nominee.id}`}
                  name="isActive"
                  defaultValue={String(nominee.is_active)}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="true">Visible to voters</option>
                  <option value="false">Hidden from ballot</option>
                </select>
              </div>
            </div>

            {state?.message && (
              <div
                className={`rounded-xl p-2.5 text-xs font-semibold flex items-center gap-1.5 ${
                  state.success
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
                role={state.success ? "status" : "alert"}
              >
                <Icon name={state.success ? "check" : "alert"} size={14} />
                <span>{state.message}</span>
              </div>
            )}

            <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-emerald-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="min-h-11 rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-emerald-800 disabled:opacity-60 transition-all active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-700"
              >
                {pending ? "Saving..." : "Save Details"}
              </button>
            </div>
          </form>
        </EventDialog>
      )}
    </>
  );
}
