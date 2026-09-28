import { describe, expect, it } from "vitest";

import { SimulatorProvider } from "../../../lib/messaging/simulator-provider";

describe("SimulatorProvider", () => {
  it("deduplicates sends by idempotency key", async () => {
    const provider = new SimulatorProvider();
    const request = {
      businessId: "business-1",
      from: "+15555550100",
      to: "+15555550101",
      body: "Sorry we missed your call.",
      idempotencyKey: "call:CA123:recovery-sms"
    };

    const first = await provider.sendSms(request);
    const second = await provider.sendSms(request);

    expect(first.providerMessageSid).toBe(second.providerMessageSid);
    expect(provider.getDeliveries()).toHaveLength(1);
  });
});
