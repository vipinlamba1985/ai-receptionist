import twilio from "twilio";

export type TwilioFormParams = Record<string, string>;

export type TwilioRequestValidator = (
  authToken: string,
  signature: string,
  url: string,
  params: TwilioFormParams
) => boolean;

export function formDataToTwilioParams(formData: FormData): TwilioFormParams {
  const params: TwilioFormParams = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") {
      throw new Error(
        "Twilio webhook form data must contain string values only"
      );
    }
    params[key] = value;
  }

  return params;
}

export function canonicalTwilioWebhookUrl(
  webhookBaseUrl: string,
  requestUrl: string,
  pathname = "/api/twilio/voice"
): string {
  const incoming = new URL(requestUrl);
  const canonical = new URL(pathname, webhookBaseUrl);
  canonical.search = incoming.search;
  canonical.hash = "";
  return canonical.toString();
}

export function validateTwilioFormRequest(input: {
  authToken: string;
  signature: string | null;
  url: string;
  params: TwilioFormParams;
  validator?: TwilioRequestValidator;
}): boolean {
  if (!input.signature) {
    return false;
  }

  const validator = input.validator ?? twilio.validateRequest;

  return validator(
    input.authToken,
    input.signature,
    input.url,
    input.params
  );
}
