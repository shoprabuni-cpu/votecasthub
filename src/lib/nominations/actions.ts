"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireVerifiedUser } from "@/lib/auth/require-user";
import { normalizeGhanaPhone } from "@/lib/auth/phone";
import { paymentAdmin } from "@/lib/payments/admin";
import { getPublicEnvironment } from "@/lib/env";

export type NominationActionState = {
  success?: boolean;
  message?: string;
  error?: string;
  nominationId?: string;
  authorizationUrl?: string;
  requiresPayment?: boolean;
};

/**
 * Public: Submit a nomination entry (Free or Paid)
 */
export async function submitNominationAction(
  _prevState: NominationActionState,
  formData: FormData
): Promise<NominationActionState> {
  try {
    const supabase = await createClient();

    const eventId = formData.get("eventId")?.toString()?.trim();
    const categoryId = formData.get("categoryId")?.toString()?.trim();
    const nomineeName = formData.get("nomineeName")?.toString()?.trim();
    const rawPhone = formData.get("nomineePhone")?.toString()?.trim() || "";
    const nomineeEmail = formData.get("nomineeEmail")?.toString()?.trim() || null;
    const nomineeBio = formData.get("nomineeBio")?.toString()?.trim() || null;
    const portfolioUrl = formData.get("portfolioUrl")?.toString()?.trim() || null;
    const nominatorType = formData.get("nominatorType")?.toString()?.trim() || "self";
    const nominatorName = formData.get("nominatorName")?.toString()?.trim() || null;
    const rawNominatorPhone = formData.get("nominatorPhone")?.toString()?.trim() || null;

    if (!eventId || !categoryId) {
      return { error: "Please select an event category." };
    }
    if (!nomineeName || nomineeName.length < 2) {
      return { error: "Please provide the nominee's full name or brand name." };
    }

    const nomineePhone = normalizeGhanaPhone(rawPhone);
    if (!/^\+233\d{9}$/.test(nomineePhone)) {
      return { error: "Please enter a valid Ghana phone number (e.g. 0241234567)." };
    }

    const nominatorPhone = rawNominatorPhone ? normalizeGhanaPhone(rawNominatorPhone) : null;

    // Handle photo upload if present
    let imagePath: string | null = null;
    const photoFile = formData.get("photo");
    if (photoFile && photoFile instanceof File && photoFile.size > 0) {
      const ext = photoFile.name.split(".").pop() || "webp";
      const filename = `${eventId}/nominations/${crypto.randomUUID()}.${ext}`;
      const bytes = await photoFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const { data: uploadData, error: uploadErr } = await paymentAdmin().storage
        .from("nominee-images")
        .upload(filename, buffer, {
          contentType: photoFile.type || "image/webp",
          upsert: true,
        });

      if (!uploadErr && uploadData?.path) {
        imagePath = uploadData.path;
      }
    }

    // Call RPC to register the nomination
    const { data: result, error: rpcError } = await supabase.rpc("submit_public_nomination", {
      p_event_id: eventId,
      p_category_id: categoryId,
      p_nominee_name: nomineeName,
      p_nominee_phone: nomineePhone,
      p_nominee_email: nomineeEmail,
      p_nominee_bio: nomineeBio,
      p_image_path: imagePath,
      p_portfolio_url: portfolioUrl,
      p_nominator_type: nominatorType,
      p_nominator_name: nominatorName,
      p_nominator_phone: nominatorPhone,
    });

    if (rpcError || !result?.success) {
      return { error: rpcError?.message || "Unable to submit nomination. Please verify your details." };
    }

    const nominationId = result.nomination_id as string;
    const feeMinor = (result.fee_minor as number) || 0;

    // If a filing fee is required, initialize Paystack checkout
    if (result.requires_payment && feeMinor > 0) {
      const email = nomineeEmail || `${nomineePhone.replace(/\+/g, "")}@votecasthub.com`;
      const { NEXT_PUBLIC_SITE_URL } = getPublicEnvironment();

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: feeMinor,
          currency: "GHS",
          callback_url: `${NEXT_PUBLIC_SITE_URL}/events/${formData.get("eventSlug") || eventId}?nomination_success=${nominationId}`,
          metadata: {
            type: "nomination_fee",
            nomination_id: nominationId,
            event_id: eventId,
            category_id: categoryId,
            nominee_name: nomineeName,
            nominee_phone: nomineePhone,
          },
        }),
      });

      const payData = await paystackRes.json();
      if (!paystackRes.ok || !payData?.data?.authorization_url) {
        return { error: "Unable to start nomination payment. Please try again." };
      }

      // Link payment attempt
      await paymentAdmin().from("event_nominations").update({
        payment_attempt_id: null,
      }).eq("id", nominationId);

      return {
        success: true,
        nominationId,
        requiresPayment: true,
        authorizationUrl: payData.data.authorization_url,
      };
    }

    // Free nomination completed
    revalidatePath(`/events/${formData.get("eventSlug") || eventId}`);
    return {
      success: true,
      nominationId,
      requiresPayment: false,
      message: `Nomination for ${nomineeName} has been received and submitted for review.`,
    };
  } catch (err) {
    console.error("submitNominationAction exception:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Organizer: Approve a Nomination to become an official Ballot Nominee
 */
export async function approveNominationAction(
  _prevState: NominationActionState,
  formData: FormData
): Promise<NominationActionState> {
  try {
    const { supabase } = await requireVerifiedUser();

    const nominationId = formData.get("nominationId")?.toString()?.trim();
    const customCode = formData.get("customCode")?.toString()?.trim() || null;
    const eventId = formData.get("eventId")?.toString()?.trim();
    const orgId = formData.get("organizationId")?.toString()?.trim();

    if (!nominationId) return { error: "Nomination ID is required." };

    const { data: res, error } = await supabase.rpc("approve_nomination", {
      p_nomination_id: nominationId,
      p_custom_public_code: customCode,
    });

    if (error || !res?.success) {
      return { error: error?.message || "Unable to approve nomination." };
    }

    if (eventId && orgId) {
      revalidatePath(`/organizer/${orgId}/events/${eventId}`);
    }
    revalidatePath("/events");

    return {
      success: true,
      message: `Nomination approved! Official voting code assigned: ${res.public_code}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unable to approve nomination." };
  }
}

/**
 * Organizer: Decline a Nomination
 */
export async function declineNominationAction(
  _prevState: NominationActionState,
  formData: FormData
): Promise<NominationActionState> {
  try {
    const { supabase } = await requireVerifiedUser();

    const nominationId = formData.get("nominationId")?.toString()?.trim();
    const reason = formData.get("reason")?.toString()?.trim() || null;
    const eventId = formData.get("eventId")?.toString()?.trim();
    const orgId = formData.get("organizationId")?.toString()?.trim();

    if (!nominationId) return { error: "Nomination ID is required." };

    const { data: res, error } = await supabase.rpc("decline_nomination", {
      p_nomination_id: nominationId,
      p_reason: reason,
    });

    if (error || !res?.success) {
      return { error: error?.message || "Unable to decline nomination." };
    }

    if (eventId && orgId) {
      revalidatePath(`/organizer/${orgId}/events/${eventId}`);
    }

    return {
      success: true,
      message: "Nomination has been marked as declined.",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unable to decline nomination." };
  }
}
