"use client";

import { useActionState } from "react";
import { updateEventCategoryAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { Icon } from "@/components/icon";

type Props = {
  category: {
    id: string;
    name: string;
    description: string | null;
    display_order: number;
    is_active: boolean;
  };
  backTo: string;
};

export function EditCategoryForm({ category, backTo }: Props) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updateEventCategoryAction, null);

  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 transition-all select-none min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
        <span>Settings</span>
        <span className="text-[10px] text-stone-400 group-open:rotate-180 transition-transform">▼</span>
      </summary>

      <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50/60 p-4 shadow-xs space-y-3">
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="categoryId" value={category.id} />
          <input type="hidden" name="backTo" value={backTo} />

          <div>
            <label
              htmlFor={`category-edit-name-${category.id}`}
              className="block text-xs font-semibold text-stone-800 mb-1"
            >
              Category Name
            </label>
            <input
              id={`category-edit-name-${category.id}`}
              name="name"
              minLength={1}
              maxLength={120}
              required
              defaultValue={category.name}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
            />
          </div>

          <div>
            <label
              htmlFor={`category-edit-description-${category.id}`}
              className="block text-xs font-semibold text-stone-800 mb-1"
            >
              Description
            </label>
            <textarea
              id={`category-edit-description-${category.id}`}
              name="description"
              maxLength={2000}
              rows={2}
              defaultValue={category.description ?? ""}
              className="w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`category-edit-order-${category.id}`}
                className="block text-xs font-semibold text-stone-800 mb-1"
              >
                Display Order
              </label>
              <input
                id={`category-edit-order-${category.id}`}
                name="displayOrder"
                type="number"
                min="0"
                max="10000"
                required
                defaultValue={category.display_order}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor={`category-edit-active-${category.id}`}
                className="block text-xs font-semibold text-stone-800 mb-1"
              >
                Ballot Visibility
              </label>
              <select
                id={`category-edit-active-${category.id}`}
                name="isActive"
                defaultValue={String(category.is_active)}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-900 focus:border-emerald-600 focus:outline-none"
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

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-3.5 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-emerald-800 disabled:opacity-60 transition-all active:scale-95 cursor-pointer min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save Category"}
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}
