export type DeletionKind = "event" | "organization";

export type DeletionJob = {
  id: string;
  target_kind: DeletionKind;
  target_id: string;
  target_name: string;
  status: "pending" | "completed" | "cancelled";
  scheduled_for: string;
  created_at: string;
  completed_at: string | null;
  attempts: number;
  last_error: string | null;
  reason: string;
  result: { retained_reference: boolean } | null;
};

export type DeletionPreview = {
  name: string;
  status: string;
  purged_at: string | null;
  financial_history: boolean;
  retained_reference: boolean;
  immediate: boolean;
  cancellable: boolean;
  blocker: string | null;
  job: DeletionJob | null;
  counts: Record<string, number>;
};
