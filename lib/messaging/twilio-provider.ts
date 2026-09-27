import twilio from "twilio";

import type {
  MessagingProvider,
  SendSmsRequest,
  SendSmsResult
} from "./provider";

type TwilioMessage = {
  sid: string;
  status?: string | null;
};

export type TwilioLikeClient = {
  messages: {
    create(input: {
      from: string;
      to: string;
      body: string;
    }): Promise<TwilioMessage>;
  };
};

export type TwilioProviderConfig = {
  accountSid: string;
  authToken: string;
  client?: TwilioLikeClient;
};

export class TwilioProvider implements MessagingProvider {
  readonly kind = "twilio" as const;

  private readonly client: TwilioLikeClient;

  constructor(config: TwilioProviderConfig) {
    this.client =
      config.client ??
      (twilio(config.accountSid, config.authToken) as unknown as TwilioLikeClient);
  }

  async sendSms(request: SendSmsRequest): Promise<SendSmsResult> {
    const message = await this.client.messages.create({
      from: request.from,
      to: request.to,
      body: request.body
    });

    return {
      provider: this.kind,
      providerMessageSid: message.sid,
      status: message.status === "queued" ? "queued" : "sent"
    };
  }
}
