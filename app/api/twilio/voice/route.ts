import { parseHostlineEnv } from "../../../../lib/config/env";
import {
  SupabaseVoiceWebhookRepository,
  type VoiceWebhookRepository
} from "../../../../lib/hostline/voice-repository";
import { handleTwilioVoiceWebhook } from "../../../../lib/hostline/voice-webhook";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { twimlResponse } from "../../../../lib/twilio/twiml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const env = parseHostlineEnv();

  if (env.SIMULATION) {
    return twimlResponse(
      "Hostline voice webhook is disabled while simulation mode is active.",
      503
    );
  }

  let repository: VoiceWebhookRepository | undefined;

  return handleTwilioVoiceWebhook(request, {
    authToken: env.TWILIO_AUTH_TOKEN!,
    webhookBaseUrl: env.TWILIO_WEBHOOK_BASE_URL!,
    getRepository: () => {
      repository ??= new SupabaseVoiceWebhookRepository(
        createSupabaseAdminClient(env)
      );
      return repository;
    }
  });
}
