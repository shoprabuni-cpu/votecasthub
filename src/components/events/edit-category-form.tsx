"use client";

import { useActionState, useEffect, useState } from "react";
import { updateEventCategoryAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { EventDialog } from "./event-dialog";
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
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updateEventCategoryAction, null);

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
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 hover:border-emerald-600 transition-all select-none min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>Edit Category</span>
      </button>

      {open && (
        <EventDialog
          open={open}
          title={`Edit Category: ${category.name}`}
          onClose={() => setOpen(false)}
          busy={pending}
        >
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="categoryId" value={category.id} />
            <input type="hidden" name="backTo" value={backTo} />

            <div>
              <label
                htmlFor={`category-edit-name-${category.id}`}
                className="block text-xs font-semibold text-stone-800 mb-1"
              >
                Category Name <span className="text-emerald-700">*</span>
              </label>
              <input
                id={`category-edit-name-${category.id}`}
                name="name"
                minLength={1}
                maxLength={120}
                required
                defaultValue={category.name}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
              />
            </div>

            <div>
              <label
                htmlFor={`category-edit-description-${category.id}`}
                className="block text-xs font-semibold text-stone-800 mb-1"
              >
                Description <span className="text-stone-400 font-normal">· optional</span>
              </label>
              <textarea
                id={`category-edit-description-${category.id}`}
                name="description"
                maxLength={2000}
                rows={2}
                defaultValue={category.description ?? ""}
                className="w-full rounded-xl border border-stone-300 bg-white p-2.5 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15 resize-none"
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
                  className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 focus:border-emerald-600 focus:outline-none"
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
                className="min-h-11 rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="min-h-11 inline-flex items-center gap-1.5 rounded-xl bg-emerald-900 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-800 disabled:opacity-60 transition-all active:scale-95 cursor-pointer"
              >
                {pending ? "Saving..." : "Save Category"}
              </button>
            </div>
          </form>
        </EventDialog>
      )}
    </>
  );
}
