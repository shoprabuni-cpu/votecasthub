export type EventType = "voting" | "ticketing" | "hybrid";

export interface TicketTier {
  id: string;
  event_id: string;
  name: string;
  price_minor: number; // in pesewas (1 GHS = 100 pesewas)
  capacity: number;
  sold_count: number;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EventTicket {
  id: string;
  event_id: string;
  tier_id: string;
  pax_code: string; // e.g. "PAX-1024"
  order_reference: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  price_minor: number;
  quantity: number;
  channel: "web" | "whatsapp" | "ussd" | "telegram" | "manual";
  status: "valid" | "checked_in" | "cancelled";
  checked_in_at?: string | null;
  checked_in_by?: string | null;
  created_at: string;
  tier_name?: string;
  event_name?: string;
  venue_name?: string;
  event_image_url?: string | null;
  starts_at?: string;
}

export interface GateCheckInResponse {
  status: "success" | "already_used" | "invalid" | "cancelled";
  message: string;
  pax_code?: string;
  customer_name?: string;
  customer_phone?: string;
  tier_name?: string;
  quantity?: number;
  event_name?: string;
  venue_name?: string;
  checked_in_at?: string;
  checked_in_by?: string;
}
