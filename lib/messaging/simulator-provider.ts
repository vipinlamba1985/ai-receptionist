import { createHash } from "node:crypto";

import type {
  MessagingProvider,
  SendSmsRequest,
  SendSmsResult
} from "./provider";

export type SimulatedSms = SendSmsRequest & SendSmsResult;

export class SimulatorProvider implements MessagingProvider {
  readonly kind = "simulation" as const;

  private readonly deliveriesByIdempotencyKey = new Map<string, SimulatedSms>();

  async sendSms(request: SendSmsRequest): Promise<SendSmsResult> {
    const existing = this.deliveriesByIdempotencyKey.get(request.idempotencyKey);
    if (existing) {
      return {
        provider: existing.provider,
        providerMessageSid: existing.providerMessageSid,
        status: existing.status
      };
    }

    const digest = createHash("sha256")
      .update(request.idempotencyKey)
      .digest("hex")
      .slice(0, 24);

    const delivery: SimulatedSms = {
      ...request,
      provider: this.kind,
      providerMessageSid: `SM_SIM_${digest}`,
      status: "sent"
    };

    this.deliveriesByIdempotencyKey.set(request.idempotencyKey, delivery);

    return {
      provider: delivery.provider,
      providerMessageSid: delivery.providerMessageSid,
      status: delivery.status
    };
  }

  getDeliveries(): readonly SimulatedSms[] {
    return [...this.deliveriesByIdempotencyKey.values()];
  }
}
