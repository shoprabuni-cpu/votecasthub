"use client";

import { useActionState } from "react";
import { updateEventCategoryAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

type Props = { category: { id: string; name: string; description: string | null; display_order: number; is_active: boolean }; backTo: string };

export function EditCategoryForm({ category, backTo }: Props) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updateEventCategoryAction, null);
  return <details className="edit-details">
    <summary>Manage category</summary>
    <form action={formAction} className="inline-create-form edit-item-form">
      <input type="hidden" name="categoryId" value={category.id} />
      <input type="hidden" name="backTo" value={backTo} />
      <label htmlFor={`category-edit-name-${category.id}`}>Category name</label>
      <input id={`category-edit-name-${category.id}`} name="name" minLength={1} maxLength={120} required defaultValue={category.name} />
      <label htmlFor={`category-edit-description-${category.id}`}>Description</label>
      <textarea id={`category-edit-description-${category.id}`} name="description" maxLength={2000} rows={2} defaultValue={category.description ?? ""} />
      <div className="edit-fields-row">
        <div className="field"><label htmlFor={`category-edit-order-${category.id}`}>Display order</label><input id={`category-edit-order-${category.id}`} name="displayOrder" type="number" min="0" max="10000" required defaultValue={category.display_order} /></div>
        <div className="field"><label htmlFor={`category-edit-active-${category.id}`}>Visibility</label><select id={`category-edit-active-${category.id}`} name="isActive" defaultValue={String(category.is_active)}><option value="true">Visible to voters</option><option value="false">Hidden</option></select></div>
      </div>
      {state?.message && <p className={state.success ? "form-message form-success" : "form-message"} role={state.success ? "status" : "alert"}>{state.message}</p>}
      <button className="secondary-button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save category"}</button>
    </form>
  </details>;
}
