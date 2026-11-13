export interface NormalizedInboundMessage {
  phone: string; // e.g. "233245259221"
  text: string;  // e.g. "VOTE 1000 01"
  messageId?: string;
  timestamp?: number;
  rawPayload: unknown;
}

export interface WhatsAppSessionRecord {
  id: string;
  phone: string;
  phone_hash: string;
  event_id: string | null;
  category_id: string | null;
  nominee_id: string | null;
  quantity: number | null;
  state: "idle" | "awaiting_quantity" | "awaiting_payment" | "completed";
  vote_request: string;
  reference: string | null;
  payment_url: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface BallotTargetResolution {
  event: {
    id: string;
    name: string;
    slug: string;
    voting_mode: "free" | "paid";
    unit_price_minor: number;
    free_vote_limit_per_phone: number | null;
    verification_method: string;
    starts_at: string;
    ends_at: string;
    status: string;
  };
  category: {
    id: string;
    name: string;
  };
  nominee: {
    id: string;
    name: string;
    public_code: string | null;
  };
}

