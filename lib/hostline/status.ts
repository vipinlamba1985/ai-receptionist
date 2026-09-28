export const CONVERSATION_STATUSES = [
  "received",
  "sms_sent",
  "customer_replied",
  "qualified",
  "callback_requested",
  "resolved"
] as const;

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];
