import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const RECOVERY_OUTCOMES = [
  "queued",
  "duplicate",
  "cooldown_suppressed",
  "opted_out",
  "unknown_number"
] as const;

export type RecoveryOutcome = (typeof RECOVERY_OUTCOMES)[number];

export type ClaimMissedCallInput = {
  callSid: string;
  fromE164: string;
  toE164: string;
  provider: "twilio" | "simulation";
  rawPayload: Record<string, string>;
};

export type MissedCallClaim = {
  outcome: RecoveryOutcome;
  businessId: string | null;
  customerId: string | null;
  conversationId: string | null;
  callEventId: string | null;
  messageId: string | null;
};

export interface VoiceWebhookRepository {
  claimMissedCall(input: ClaimMissedCallInput): Promise<MissedCallClaim>;
}

const claimRowSchema = z.object({
  outcome: z.enum(RECOVERY_OUTCOMES),
  business_id: z.string().uuid().nullable(),
  customer_id: z.string().uuid().nullable(),
  conversation_id: z.string().uuid().nullable(),
  call_event_id: z.string().uuid().nullable(),
  message_id: z.string().uuid().nullable()
});

export class SupabaseVoiceWebhookRepository
  implements VoiceWebhookRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async claimMissedCall(
    input: ClaimMissedCallInput
  ): Promise<MissedCallClaim> {
    const { data, error } = await this.client.rpc(
      "claim_missed_call_recovery",
      {
        p_call_sid: input.callSid,
        p_from_e164: input.fromE164,
        p_to_e164: input.toE164,
        p_provider: input.provider,
        p_raw_payload: input.rawPayload
      }
    );

    if (error) {
      throw new Error(
        "claim_missed_call_recovery failed: " + error.message
      );
    }

    const rows = z.array(claimRowSchema).parse(data);

    if (rows.length !== 1) {
      throw new Error(
        "claim_missed_call_recovery must return exactly one result row"
      );
    }

    const row = rows[0];

    return {
      outcome: row.outcome,
      businessId: row.business_id,
      customerId: row.customer_id,
      conversationId: row.conversation_id,
      callEventId: row.call_event_id,
      messageId: row.message_id
    };
  }
}
