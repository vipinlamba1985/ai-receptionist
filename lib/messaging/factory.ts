import type { HostlineEnv } from "../config/env";
import type { MessagingProvider } from "./provider";
import { SimulatorProvider } from "./simulator-provider";
import type { TwilioProviderConfig } from "./twilio-provider";

export type MessagingProviderFactoryDeps = {
  simulatorProvider?: MessagingProvider;
  twilioProviderFactory?: (
    config: TwilioProviderConfig
  ) => MessagingProvider | Promise<MessagingProvider>;
};

export async function createMessagingProvider(
  env: HostlineEnv,
  deps: MessagingProviderFactoryDeps = {}
): Promise<MessagingProvider> {
  if (env.SIMULATION) {
    return deps.simulatorProvider ?? new SimulatorProvider();
  }

  if (
    !env.TWILIO_ACCOUNT_SID ||
    !env.TWILIO_AUTH_TOKEN ||
    !env.TWILIO_PHONE_NUMBER
  ) {
    throw new Error("Twilio credentials are required when SIMULATION=false");
  }

  const config: TwilioProviderConfig = {
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN
  };

  if (deps.twilioProviderFactory) {
    return deps.twilioProviderFactory(config);
  }

  const { TwilioProvider } = await import("./twilio-provider");
  return new TwilioProvider(config);
}
