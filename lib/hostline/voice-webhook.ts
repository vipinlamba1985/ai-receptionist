import {
  canonicalTwilioWebhookUrl,
  formDataToTwilioParams,
  validateTwilioFormRequest,
  type TwilioRequestValidator
} from "../twilio/signature";
import { twimlResponse } from "../twilio/twiml";
import {
  isE164,
  twilioVoiceWebhookSchema
} from "./voice-types";
import type {
  RecoveryOutcome,
  VoiceWebhookRepository
} from "./voice-repository";

export type VoiceWebhookDependencies = {
  authToken: string;
  webhookBaseUrl: string;
  getRepository: () => VoiceWebhookRepository;
  validator?: TwilioRequestValidator;
};

function messageForOutcome(outcome: RecoveryOutcome): string {
  switch (outcome) {
    case "queued":
      return "Sorry we missed your call. We will text you shortly.";
    case "duplicate":
    case "cooldown_suppressed":
      return "Thanks for calling. We already have your request and will follow up shortly.";
    case "opted_out":
      return "Thanks for calling. We will not send a text message.";
    case "unknown_number":
      return "Sorry, we cannot process this call right now.";
  }
}

export async function handleTwilioVoiceWebhook(
  request: Request,
  deps: VoiceWebhookDependencies
): Promise<Response> {
  let params: Record<string, string>;

  try {
    const formData = await request.formData();
    params = formDataToTwilioParams(formData);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const canonicalUrl = canonicalTwilioWebhookUrl(
    deps.webhookBaseUrl,
    request.url
  );

  const signatureIsValid = validateTwilioFormRequest({
    authToken: deps.authToken,
    signature: request.headers.get("x-twilio-signature"),
    url: canonicalUrl,
    params,
    validator: deps.validator
  });

  if (!signatureIsValid) {
    return new Response("Forbidden", { status: 403 });
  }

  const parsed = twilioVoiceWebhookSchema.safeParse(params);

  if (!parsed.success) {
    return new Response("Bad Request", { status: 400 });
  }

  if (!isE164(parsed.data.From)) {
    return twimlResponse(
      "Sorry we missed your call. Please try again later."
    );
  }

  try {
    const claim = await deps.getRepository().claimMissedCall({
      callSid: parsed.data.CallSid,
      fromE164: parsed.data.From,
      toE164: parsed.data.To,
      provider: "twilio",
      rawPayload: params
    });

    return twimlResponse(messageForOutcome(claim.outcome));
  } catch (error) {
    console.error("Hostline voice webhook processing failed", error);
    return twimlResponse(
      "Sorry, we could not process your call. Please try again later."
    );
  }
}
