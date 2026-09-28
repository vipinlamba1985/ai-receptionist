import { z } from "zod";

const e164Schema = z.string().regex(/^\+[1-9][0-9]{7,14}$/);

export const twilioVoiceWebhookSchema = z
  .object({
    CallSid: z.string().regex(/^CA[0-9a-fA-F]{32}$/),
    From: z.string().trim().min(1),
    To: e164Schema
  })
  .passthrough();

export type TwilioVoiceWebhook = z.infer<typeof twilioVoiceWebhookSchema>;

export function isE164(value: string): boolean {
  return e164Schema.safeParse(value).success;
}
