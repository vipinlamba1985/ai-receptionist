import { describe, expect, it, vi } from "vitest";

import {
  canonicalTwilioWebhookUrl,
  formDataToTwilioParams,
  validateTwilioFormRequest
} from "../../../lib/twilio/signature";

describe("Twilio webhook signature helpers", () => {
  it("builds the public webhook URL and preserves the incoming query string", () => {
    expect(
      canonicalTwilioWebhookUrl(
        "https://hostline.example.com",
        "http://localhost:3000/api/twilio/voice?source=test"
      )
    ).toBe(
      "https://hostline.example.com/api/twilio/voice?source=test"
    );
  });

  it("passes all form parameters to the SDK validator", () => {
    const formData = new FormData();
    formData.set("CallSid", "CA" + "a".repeat(32));
    formData.set("From", "+15145550101");
    formData.set("To", "+15145550102");
    formData.set("FutureTwilioField", "kept");

    const params = formDataToTwilioParams(formData);
    const validator = vi.fn(() => true);

    expect(
      validateTwilioFormRequest({
        authToken: "test-token",
        signature: "signature",
        url: "https://hostline.example.com/api/twilio/voice",
        params,
        validator
      })
    ).toBe(true);

    expect(validator).toHaveBeenCalledWith(
      "test-token",
      "signature",
      "https://hostline.example.com/api/twilio/voice",
      expect.objectContaining({
        FutureTwilioField: "kept"
      })
    );
  });

  it("rejects requests without a signature before calling the validator", () => {
    const validator = vi.fn(() => true);

    expect(
      validateTwilioFormRequest({
        authToken: "test-token",
        signature: null,
        url: "https://hostline.example.com/api/twilio/voice",
        params: {},
        validator
      })
    ).toBe(false);

    expect(validator).not.toHaveBeenCalled();
  });
});
