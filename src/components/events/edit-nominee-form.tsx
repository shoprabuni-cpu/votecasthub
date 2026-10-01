"use client";

import { useActionState } from "react";
import { updateCategoryNomineeAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

type Props = { nominee: { id: string; name: string; public_code: string | null; biography: string | null; display_order: number; is_active: boolean }; backTo: string };

export function EditNomineeForm({ nominee, backTo }: Props) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updateCategoryNomineeAction, null);
  return <details className="edit-details edit-nominee-details">
    <summary>Edit</summary>
    <form action={formAction} className="nominee-form edit-item-form">
      <input type="hidden" name="nomineeId" value={nominee.id} />
      <input type="hidden" name="backTo" value={backTo} />
      <label htmlFor={`nominee-edit-name-${nominee.id}`}>Nominee name</label><input id={`nominee-edit-name-${nominee.id}`} name="name" minLength={1} maxLength={160} required defaultValue={nominee.name} />
      <label htmlFor={`nominee-edit-code-${nominee.id}`}>Public code <span>optional</span></label><input id={`nominee-edit-code-${nominee.id}`} name="publicCode" maxLength={32} pattern="[A-Za-z0-9-]*" defaultValue={nominee.public_code ?? ""} />
      <label htmlFor={`nominee-edit-bio-${nominee.id}`}>Biography <span>optional</span></label><textarea id={`nominee-edit-bio-${nominee.id}`} name="biography" maxLength={3000} rows={2} defaultValue={nominee.biography ?? ""} />
      <div className="edit-fields-row">
        <div className="field"><label htmlFor={`nominee-edit-order-${nominee.id}`}>Display order</label><input id={`nominee-edit-order-${nominee.id}`} name="displayOrder" type="number" min="0" max="10000" required defaultValue={nominee.display_order} /></div>
        <div className="field"><label htmlFor={`nominee-edit-active-${nominee.id}`}>Visibility</label><select id={`nominee-edit-active-${nominee.id}`} name="isActive" defaultValue={String(nominee.is_active)}><option value="true">Visible to voters</option><option value="false">Hidden</option></select></div>
      </div>
      {state?.message && <p className={state.success ? "form-message form-success" : "form-message"} role={state.success ? "status" : "alert"}>{state.message}</p>}
      <button className="secondary-button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save nominee"}</button>
    </form>
  </details>;
}
