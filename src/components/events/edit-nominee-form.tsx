"use client";

import { useActionState } from "react";
import { updateCategoryNomineeAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
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
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updateCategoryNomineeAction, null);

  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 transition-all select-none">
        <span>Edit</span>
        <span className="text-[9px] text-stone-400 group-open:rotate-180 transition-transform">▼</span>
      </summary>

      <div className="absolute left-0 sm:left-auto sm:right-0 top-8 z-30 w-72 sm:w-80 rounded-2xl border border-stone-200 bg-white p-4 shadow-xl">
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="nomineeId" value={nominee.id} />
          <input type="hidden" name="backTo" value={backTo} />

          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <span className="text-xs font-semibold text-stone-900">Edit Nominee</span>
            <span className="text-[10px] text-stone-400 font-mono">ID: {nominee.id.slice(0, 6)}</span>
          </div>

          <div>
            <label
              htmlFor={`nominee-edit-name-${nominee.id}`}
              className="block text-xs font-semibold text-stone-800 mb-1"
            >
              Full Name
            </label>
            <input
              id={`nominee-edit-name-${nominee.id}`}
              name="name"
              minLength={1}
              maxLength={160}
              required
              defaultValue={nominee.name}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
            />
          </div>

          <div>
            <label
              htmlFor={`nominee-edit-code-${nominee.id}`}
              className="block text-xs font-semibold text-stone-800 mb-1"
            >
              Public Code <span className="text-stone-400 font-normal">· optional</span>
            </label>
            <input
              id={`nominee-edit-code-${nominee.id}`}
              name="publicCode"
              maxLength={32}
              pattern="[A-Za-z0-9-]*"
              defaultValue={nominee.public_code ?? ""}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-mono font-medium text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15 uppercase"
            />
          </div>

          <div>
            <label
              htmlFor={`nominee-edit-bio-${nominee.id}`}
              className="block text-xs font-semibold text-stone-800 mb-1"
            >
              Biography <span className="text-stone-400 font-normal">· optional</span>
            </label>
            <textarea
              id={`nominee-edit-bio-${nominee.id}`}
              name="biography"
              maxLength={3000}
              rows={2}
              defaultValue={nominee.biography ?? ""}
              className="w-full rounded-xl border border-stone-300 bg-white p-2 text-xs text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor={`nominee-edit-order-${nominee.id}`}
                className="block text-xs font-semibold text-stone-800 mb-1"
              >
                Order
              </label>
              <input
                id={`nominee-edit-order-${nominee.id}`}
                name="displayOrder"
                type="number"
                min="0"
                max="10000"
                required
                defaultValue={nominee.display_order}
                className="w-full rounded-xl border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:border-emerald-600 focus:outline-none"
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
                className="w-full rounded-xl border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-900 focus:border-emerald-600 focus:outline-none"
              >
                <option value="true">Visible</option>
                <option value="false">Hidden</option>
              </select>
            </div>
          </div>

          {state?.message && (
            <div
              className={`rounded-xl p-2 text-xs font-semibold flex items-center gap-1.5 ${
                state.success
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
              role={state.success ? "status" : "alert"}
            >
              <Icon name={state.success ? "check" : "alert"} size={13} />
              <span>{state.message}</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-800 disabled:opacity-60 transition-all active:scale-95 cursor-pointer"
            >
              {pending ? "Saving..." : "Save Details"}
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}
