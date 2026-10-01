"use client";

import { useActionState, useState } from "react";
import { createOrganizationInvitationAction, revokeOrganizationInvitationAction } from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

type Invitation = { id: string; email: string; role: string; status: string; created_at: string; expires_at: string };
type TeamMember = { user_id: string; email: string; display_name: string | null; role: string; joined_at: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: "Africa/Accra" }).format(new Date(value));
}

function RevokeInvitationForm({ organizationId, invitationId }: { organizationId: string; invitationId: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(revokeOrganizationInvitationAction, null);
  return <form action={action} className="revoke-invitation-form"><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="invitationId" value={invitationId} /><button type="submit" disabled={pending}>{pending ? "Revoking…" : "Revoke"}</button>{state?.message && <small role="status">{state.message}</small>}</form>;
}

export function InvitationPanel({ organizationId, canInviteAdmin, invitations, members }: { organizationId: string; canInviteAdmin: boolean; invitations: Invitation[]; members: TeamMember[] }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(createOrganizationInvitationAction, null);
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    if (!state?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(state.inviteUrl);
      setCopied(true);
    } catch { setCopied(false); }
  }

  return <>
    <section className="team-list"><div className="section-title-row"><div><p className="eyebrow">CURRENT MEMBERS</p><h2>Organization team</h2></div><span>{members.length} {members.length === 1 ? "member" : "members"}</span></div><div className="invitation-table">{members.map((member) => <article className="invitation-row" key={member.user_id}><div><strong>{member.display_name || member.email}</strong>{member.display_name && <small>{member.email}</small>}<small>Joined {formatDate(member.joined_at)}</small></div><span className="invitation-status">{member.role}</span></article>)}</div></section>
    <form action={action} className="invitation-form">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="invitation-form-grid"><label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="teammate@example.com" /></label><label>Organization role<select name="role" defaultValue="editor"><option value="editor">Editor · manage events</option><option value="viewer">Viewer · read only</option>{canInviteAdmin && <option value="admin">Admin · manage members</option>}</select></label><button className="primary-link" type="submit" disabled={pending}>{pending ? "Creating link…" : "Create invitation link"}</button></div>
      <p className="auth-hint">The link expires after 7 days and can only be accepted by a confirmed account using the invited email.</p>
      {state?.message && <p className={`form-message${state.success ? " success-message" : ""}`} role={state.success ? "status" : "alert"}>{state.message}</p>}
      {state?.inviteUrl && <div className="invite-link-result"><a href={state.inviteUrl}>{state.inviteUrl}</a><button type="button" className="secondary-button" onClick={copyInvite}>{copied ? "Copied" : "Copy link"}</button></div>}
    </form>
    <section className="invitation-list"><div className="section-title-row"><div><p className="eyebrow">ACCESS</p><h2>Recent invitations</h2></div><span>{invitations.filter((item) => item.status === "pending").length} pending</span></div>
      {invitations.length ? <div className="invitation-table">{invitations.map((invite) => <article className="invitation-row" key={invite.id}><div><strong>{invite.email}</strong><small>{invite.role} · created {formatDate(invite.created_at)}</small></div><span className={`invitation-status invitation-status-${invite.status}`}>{invite.status}</span>{invite.status === "pending" && <RevokeInvitationForm organizationId={organizationId} invitationId={invite.id} />}</article>)}</div> : <p className="quiet-empty">No invitations have been created yet.</p>}
    </section>
  </>;
}
