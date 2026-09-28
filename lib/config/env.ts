import { z } from "zod";

const optionalTrimmed = z.string().trim().min(1).optional();

const webhookBaseUrl = z
  .string()
  .url()
  .refine(
    (value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash
      );
    },
    {
      message: "TWILIO_WEBHOOK_BASE_URL must be an HTTPS origin with no path, query, or fragment"
    }
  )
  .optional();

const rawEnvSchema = z.object({
  SIMULATION: z.enum(["true", "false"]).default("true"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalTrimmed,
  SUPABASE_SERVICE_ROLE_KEY: optionalTrimmed,
  TWILIO_ACCOUNT_SID: optionalTrimmed,
  TWILIO_AUTH_TOKEN: optionalTrimmed,
  TWILIO_PHONE_NUMBER: z.string().regex(/^\+[1-9][0-9]{7,14}$/).optional(),
  TWILIO_WEBHOOK_BASE_URL: webhookBaseUrl
});

export type HostlineEnv = {
  SIMULATION: boolean;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  TWILIO_WEBHOOK_BASE_URL?: string;
};

const REQUIRED_REAL_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "TWILIO_WEBHOOK_BASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY"
] as const;

export function parseHostlineEnv(
  source: Record<string, string | undefined> = process.env
): HostlineEnv {
  const parsed = rawEnvSchema.parse(source);
  const simulation = parsed.SIMULATION === "true";

  if (!simulation) {
    for (const key of REQUIRED_REAL_KEYS) {
      if (!parsed[key]) {
        throw new Error(key + " is required when SIMULATION=false");
      }
    }
  }

  return {
    ...parsed,
    SIMULATION: simulation
  };
}
