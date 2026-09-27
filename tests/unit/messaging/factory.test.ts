import { describe, expect, it, vi } from "vitest";

import { createMessagingProvider } from "../../../lib/messaging/factory";

describe("createMessagingProvider", () => {
  it("never constructs a Twilio provider in simulation mode", async () => {
    const twilioProviderFactory = vi.fn(() => {
      throw new Error("Twilio must never be constructed in simulation mode");
    });

    const provider = await createMessagingProvider(
      {
        SIMULATION: true
      },
      {
        twilioProviderFactory
      }
    );

    expect(provider.kind).toBe("simulation");
    expect(twilioProviderFactory).not.toHaveBeenCalled();
  });
});
