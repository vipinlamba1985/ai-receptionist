import { describe, expect, it } from "vitest";

import { parseHostlineEnv } from "../../../lib/config/env";

const completeTwilio = {
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_AUTH_TOKEN: "secret-for-test-only",
  TWILIO_PHONE_NUMBER: "+15555550100",
  TWILIO_WEBHOOK_BASE_URL: "https://hostline.example.com"
};

describe("parseHostlineEnv", () => {
  it("defaults to simulation mode", () => {
    const env = parseHostlineEnv({});
    expect(env.SIMULATION).toBe(true);
  });

  it("requires Twilio configuration when simulation is disabled", () => {
    expect(() =>
      parseHostlineEnv({
        SIMULATION: "false"
      })
    ).toThrow(/TWILIO_ACCOUNT_SID/);
  });

  it("requires server-side Supabase persistence when simulation is disabled", () => {
    expect(() =>
      parseHostlineEnv({
        SIMULATION: "false",
        ...completeTwilio
      })
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("accepts complete production webhook configuration", () => {
    const env = parseHostlineEnv({
      SIMULATION: "false",
      ...completeTwilio,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-only"
    });

    expect(env.SIMULATION).toBe(false);
    expect(env.TWILIO_PHONE_NUMBER).toBe("+15555550100");
  });

  it("requires the Twilio webhook base URL to be an origin", () => {
    expect(() =>
      parseHostlineEnv({
        SIMULATION: "false",
        ...completeTwilio,
        TWILIO_WEBHOOK_BASE_URL:
          "https://hostline.example.com/api/twilio/voice",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-only"
      })
    ).toThrow(/public origin/);
  });
});
