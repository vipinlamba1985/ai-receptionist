import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { SupabaseVoiceWebhookRepository } from "../../../lib/hostline/voice-repository";

describe("SupabaseVoiceWebhookRepository", () => {
  it("calls the atomic claim RPC with the complete webhook payload", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          outcome: "queued",
          business_id: "11111111-1111-4111-8111-111111111111",
          customer_id: "22222222-2222-4222-8222-222222222222",
          conversation_id: "33333333-3333-4333-8333-333333333333",
          call_event_id: "44444444-4444-4444-8444-444444444444",
          message_id: "55555555-5555-4555-8555-555555555555"
        }
      ],
      error: null
    });

    const client = { rpc } as unknown as SupabaseClient;
    const repository = new SupabaseVoiceWebhookRepository(client);

    const result = await repository.claimMissedCall({
      callSid: "CA" + "a".repeat(32),
      fromE164: "+15145550101",
      toE164: "+15145550102",
      provider: "twilio",
      rawPayload: {
        CallSid: "CA" + "a".repeat(32),
        FutureTwilioField: "kept"
      }
    });

    expect(rpc).toHaveBeenCalledWith(
      "claim_missed_call_recovery",
      expect.objectContaining({
        p_call_sid: "CA" + "a".repeat(32),
        p_from_e164: "+15145550101",
        p_to_e164: "+15145550102",
        p_provider: "twilio",
        p_raw_payload: expect.objectContaining({
          FutureTwilioField: "kept"
        })
      })
    );

    expect(result.outcome).toBe("queued");
    expect(result.messageId).toBe(
      "55555555-5555-4555-8555-555555555555"
    );
  });

  it("fails closed when the RPC returns an error", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "database unavailable" }
      })
    } as unknown as SupabaseClient;

    const repository = new SupabaseVoiceWebhookRepository(client);

    await expect(
      repository.claimMissedCall({
        callSid: "CA" + "b".repeat(32),
        fromE164: "+15145550101",
        toE164: "+15145550102",
        provider: "twilio",
        rawPayload: {}
      })
    ).rejects.toThrow(/database unavailable/);
  });
});
