export type MessagingProviderKind = "simulation" | "twilio";

export type SendSmsRequest = {
  businessId: string;
  from: string;
  to: string;
  body: string;
  idempotencyKey: string;
};

export type SendSmsResult = {
  provider: MessagingProviderKind;
  providerMessageSid: string;
  status: "queued" | "sent";
};

export interface MessagingProvider {
  readonly kind: MessagingProviderKind;
  sendSms(request: SendSmsRequest): Promise<SendSmsResult>;
}
