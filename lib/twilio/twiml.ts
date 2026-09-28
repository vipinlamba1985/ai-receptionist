import twilio from "twilio";

const XML_HEADERS = {
  "Content-Type": "text/xml; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
} as const;

export function createVoiceTwiml(message: string): string {
  const response = new twilio.twiml.VoiceResponse();
  response.say(message);
  return response.toString();
}

export function twimlResponse(message: string, status = 200): Response {
  return new Response(createVoiceTwiml(message), {
    status,
    headers: XML_HEADERS
  });
}
