import { describe, expect, it } from "vitest";

import { parseHostlineEnv } from "../../../lib/config/env";

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

  it("accepts complete production Twilio configuration", () => {
    const env = parseHostlineEnv({
      SIMULATION: "false",
      TWILIO_ACCOUNT_SID: "AC123",
      TWILIO_AUTH_TOKEN: "secret-for-test-only",
      TWILIO_PHONE_NUMBER: "+15555550100",
      TWILIO_WEBHOOK_BASE_URL: "https://hostline.example.com"
    });

    expect(env.SIMULATION).toBe(false);
    expect(env.TWILIO_PHONE_NUMBER).toBe("+15555550100");
  });
});
