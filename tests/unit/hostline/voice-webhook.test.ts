import { describe, expect, it, vi } from "vitest";

import type { VoiceWebhookRepository } from "../../../lib/hostline/voice-repository";
import { handleTwilioVoiceWebhook } from "../../../lib/hostline/voice-webhook";

const callSid = "CA" + "a".repeat(32);

function makeRequest(input?: {
  from?: string;
  signature?: string | null;
  extra?: Record<string, string>;
}): Request {
  const body = new URLSearchParams({
    CallSid: callSid,
    From: input?.from ?? "+15145550101",
    To: "+15145550102",
    ...(input?.extra ?? {})
  });

  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded"
  });

  if (input?.signature !== null) {
    headers.set(
      "x-twilio-signature",
      input?.signature ?? "valid-signature"
    );
  }

  return new Request(
    "http://localhost:3000/api/twilio/voice?source=twilio",
    {
      method: "POST",
      body,
      headers
    }
  );
}

function makeRepository(
  outcome:
    | "queued"
    | "duplicate"
    | "cooldown_suppressed"
    | "opted_out"
    | "unknown_number" = "queued"
) {
  const claimMissedCall = vi.fn().mockResolvedValue({
    outcome,
    businessId: null,
    customerId: null,
    conversationId: null,
    callEventId: null,
    messageId: null
  });

  const repository: VoiceWebhookRepository = {
    claimMissedCall
  };

  return { repository, claimMissedCall };
}

describe("handleTwilioVoiceWebhook", () => {
  it("rejects an invalid signature without touching persistence", async () => {
    const { repository, claimMissedCall } = makeRepository();
    const getRepository = vi.fn(() => repository);

    const response = await handleTwilioVoiceWebhook(
      makeRequest(),
      {
        authToken: "token",
        webhookBaseUrl: "https://hostline.example.com",
        getRepository,
        validator: vi.fn(() => false)
      }
    );

    expect(response.status).toBe(403);
    expect(getRepository).not.toHaveBeenCalled();
    expect(claimMissedCall).not.toHaveBeenCalled();
  });

  it("queues a valid missed call and returns TwiML", async () => {
    const { repository, claimMissedCall } = makeRepository("queued");
    const validator = vi.fn(() => true);

    const response = await handleTwilioVoiceWebhook(
      makeRequest({
        extra: { FutureTwilioField: "kept" }
      }),
      {
        authToken: "token",
        webhookBaseUrl: "https://hostline.example.com",
        getRepository: () => repository,
        validator
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/xml/);

    const body = await response.text();
    expect(body).toContain("<Response>");
    expect(body).toContain("text you shortly");

    expect(validator).toHaveBeenCalledWith(
      "token",
      "valid-signature",
      "https://hostline.example.com/api/twilio/voice?source=twilio",
      expect.objectContaining({
        FutureTwilioField: "kept"
      })
    );

    expect(claimMissedCall).toHaveBeenCalledWith(
      expect.objectContaining({
        callSid,
        fromE164: "+15145550101",
        toE164: "+15145550102",
        provider: "twilio",
        rawPayload: expect.objectContaining({
          FutureTwilioField: "kept"
        })
      })
    );
  });

  it("does not persist or promise SMS for a caller without an E.164 number", async () => {
    const { repository, claimMissedCall } = makeRepository();
    const getRepository = vi.fn(() => repository);

    const response = await handleTwilioVoiceWebhook(
      makeRequest({ from: "anonymous" }),
      {
        authToken: "token",
        webhookBaseUrl: "https://hostline.example.com",
        getRepository,
        validator: vi.fn(() => true)
      }
    );

    expect(response.status).toBe(200);
    expect(getRepository).not.toHaveBeenCalled();
    expect(claimMissedCall).not.toHaveBeenCalled();

    const body = await response.text();
    expect(body).not.toContain("text you shortly");
  });

  it("does not promise another SMS for a duplicate CallSid", async () => {
    const { repository } = makeRepository("duplicate");

    const response = await handleTwilioVoiceWebhook(
      makeRequest(),
      {
        authToken: "token",
        webhookBaseUrl: "https://hostline.example.com",
        getRepository: () => repository,
        validator: vi.fn(() => true)
      }
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain(
      "already have your request"
    );
  });
});
