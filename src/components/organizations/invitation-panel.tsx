"use client";

import { useActionState, useState } from "react";
import {
  createOrganizationInvitationAction,
  revokeOrganizationInvitationAction,
} from "@/lib/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";
import { Icon } from "@/components/icon";

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
};

type TeamMember = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  joined_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeZone: "Africa/Accra",
  }).format(new Date(value));
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: "bg-emerald-50 text-emerald-900 border-emerald-200/80 font-bold",
    admin: "bg-amber-50 text-amber-900 border-amber-200/80 font-semibold",
    editor: "bg-sky-50 text-sky-900 border-sky-200/80 font-semibold",
    viewer: "bg-stone-100 text-stone-700 border-stone-200 font-medium",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wider ${
        styles[role] ?? styles.viewer
      }`}
    >
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-800 border-amber-200/80",
    accepted: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    revoked: "bg-red-50 text-red-700 border-red-200/80",
    expired: "bg-stone-100 text-stone-600 border-stone-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        styles[status] ?? styles.expired
      }`}
    >
      {status}
    </span>
  );
}

function RevokeInvitationForm({
  organizationId,
  invitationId,
}: {
  organizationId: string;
  invitationId: string;
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    revokeOrganizationInvitationAction,
    null
  );

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700 shadow-2xs hover:bg-red-50 hover:border-red-300 disabled:opacity-60 transition-all cursor-pointer"
      >
        {pending ? "Revoking..." : "Revoke link"}
      </button>
      {state?.message && (
        <span className="text-[11px] text-stone-500 font-medium">{state.message}</span>
      )}
    </form>
  );
}

export function InvitationPanel({
  organizationId,
  canInviteAdmin,
  invitations,
  members,
}: {
  organizationId: string;
  canInviteAdmin: boolean;
  invitations: Invitation[];
  members: TeamMember[];
}) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    createOrganizationInvitationAction,
    null
  );
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    if (!state?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(state.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Invite Form Card */}
      <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
              <Icon name="userPlus" size={15} />
            </span>
            <h2 className="text-base font-serif font-bold text-stone-900">Invite a Teammate</h2>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Generate an access link with assigned permissions. The invited teammate must sign in with
            their invited email address to accept.
          </p>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="organizationId" value={organizationId} />

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            {/* Email Address */}
            <div className="sm:col-span-7 space-y-1.5">
              <label htmlFor="input-invite-email" className="block text-xs font-semibold text-stone-800">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-400">
                  <Icon name="mail" size={15} />
                </span>
                <input
                  id="input-invite-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                  placeholder="colleague@institution.edu.gh"
                  className="w-full rounded-xl border border-stone-300 bg-white pl-10 pr-4 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
                />
              </div>
            </div>

            {/* Role Select */}
            <div className="sm:col-span-5 space-y-1.5">
              <label htmlFor="select-invite-role" className="block text-xs font-semibold text-stone-800">
                Permission Role
              </label>
              <select
                id="select-invite-role"
                name="role"
                defaultValue="editor"
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-xs font-semibold text-stone-800 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-600/15"
              >
                <option value="editor">Editor · Setup events & nominees</option>
                <option value="viewer">Viewer · Read-only access & tallies</option>
                {canInviteAdmin && (
                  <option value="admin">Admin · Manage team & organization</option>
                )}
              </select>
            </div>
          </div>

          {/* Role Explanations */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="rounded-xl border border-stone-100 bg-stone-50/50 p-2.5 text-[11px] text-stone-600">
              <strong className="text-stone-900 font-semibold block mb-0.5">Editor</strong>
              Can create award categories, upload nominee photos, and manage draft ballots.
            </div>
            <div className="rounded-xl border border-stone-100 bg-stone-50/50 p-2.5 text-[11px] text-stone-600">
              <strong className="text-stone-900 font-semibold block mb-0.5">Viewer</strong>
              Can inspect ballots and real-time tallies without making configuration changes.
            </div>
            <div className="rounded-xl border border-stone-100 bg-stone-50/50 p-2.5 text-[11px] text-stone-600">
              <strong className="text-stone-900 font-semibold block mb-0.5">Admin</strong>
              Can manage teammates, connect payment settlement, and edit org profile.
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[11px] text-stone-400">
              ✦ Invitation links automatically expire in 7 days for security.
            </p>

            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-60 transition-all active:scale-95 cursor-pointer"
            >
              {pending ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Creating invitation...</span>
                </>
              ) : (
                <>
                  <Icon name="sparkle" size={14} />
                  <span>Create Invitation Link</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Server Response Feedback */}
        {state?.message && (
          <div
            className={`rounded-xl p-3.5 text-xs font-semibold flex items-center gap-2 ${
              state.success
                ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border border-red-200 bg-red-50 text-red-900"
            }`}
            role={state.success ? "status" : "alert"}
          >
            <Icon name={state.success ? "check" : "alert"} size={16} />
            <span>{state.message}</span>
          </div>
        )}

        {/* Newly Created Invite Link Share Card */}
        {state?.inviteUrl && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Invitation Link Ready to Share
              </span>
              <span className="text-[11px] text-emerald-700 font-medium">Valid for 7 days</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={state.inviteUrl}
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-stone-800 focus:outline-none select-all"
              />
              <button
                type="button"
                onClick={copyInvite}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-all shrink-0 cursor-pointer"
              >
                {copied ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}
                <span>{copied ? "Copied!" : "Copy link"}</span>
              </button>
            </div>
            <p className="text-[11px] text-emerald-800/80">
              Send this link to your teammate via email, WhatsApp, or Slack. They will be added to this
              organization upon accepting.
            </p>
          </div>
        )}
      </div>

      {/* Current Team Members Section */}
      <div className="rounded-2xl border border-stone-200/90 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-stone-100 p-5 sm:px-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              CURRENT ROSTER
            </p>
            <h2 className="text-base font-serif font-bold text-stone-900">Active Members</h2>
          </div>
          <span className="text-xs text-stone-500">
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </div>

        <div className="divide-y divide-stone-100">
          {members.map((member) => (
            <div
              key={member.user_id}
              className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Initial Avatar */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 font-serif font-bold text-stone-700 text-sm">
                  {(member.display_name || member.email)[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-stone-900">
                      {member.display_name || member.email}
                    </span>
                    <RoleBadge role={member.role} />
                  </div>
                  <div className="text-[11px] text-stone-400 flex items-center gap-2 mt-0.5">
                    {member.display_name && <span>{member.email}</span>}
                    <span>· Joined {formatDate(member.joined_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invitations History Section */}
      <div className="rounded-2xl border border-stone-200/90 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-stone-100 p-5 sm:px-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">HISTORY</p>
            <h2 className="text-base font-serif font-bold text-stone-900">Recent Invitations</h2>
          </div>
          <span className="text-xs text-stone-500">
            {invitations.filter((i) => i.status === "pending").length} pending
          </span>
        </div>

        {invitations.length ? (
          <div className="divide-y divide-stone-100">
            {invitations.map((invite) => (
              <div
                key={invite.id}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/40 transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-stone-900">{invite.email}</span>
                    <RoleBadge role={invite.role} />
                    <StatusBadge status={invite.status} />
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Created {formatDate(invite.created_at)} · Expires {formatDate(invite.expires_at)}
                  </p>
                </div>

                {invite.status === "pending" && (
                  <div>
                    <RevokeInvitationForm
                      organizationId={organizationId}
                      invitationId={invite.id}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-400">
              <Icon name="mail" size={18} />
            </div>
            <p className="text-xs font-semibold text-stone-700">No invitations created yet</p>
            <p className="text-xs text-stone-400 max-w-sm mx-auto">
              Use the form above to invite team members and delegate event management.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
