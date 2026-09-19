import { isDemoMode } from "../env";
import { ownerMobileE164 } from "../phone";
import { getSettings } from "../settings";
import { createMessageMediaAdapter } from "./messagemedia";
import { twilioAdapter } from "./twilio";
import type { InboundSms, OutboundSms, SmsAdapter, SmsSendResult } from "./types";

export function publicAppUrl() {
  return (
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function smsWebhookUrl() {
  return `${publicAppUrl()}/api/sms/messagemedia`;
}

export async function getSmsCredentials() {
  const settings = await getSettings();
  const apiKey =
    process.env.MESSAGEMEDIA_API_KEY?.trim() || settings.messageMediaKey || "";
  const apiSecret =
    process.env.MESSAGEMEDIA_API_SECRET?.trim() ||
    settings.messageMediaSecret ||
    "";
  return {
    apiKey,
    apiSecret,
    configured: Boolean(apiKey && apiSecret),
    sourceNumber: ownerMobileE164(),
  };
}

export async function getPrimarySmsAdapter(): Promise<SmsAdapter> {
  const { apiKey, apiSecret } = await getSmsCredentials();
  return createMessageMediaAdapter({ apiKey, apiSecret });
}

export function parseAnyInbound(payload: unknown): InboundSms | null {
  return (
    createMessageMediaAdapter({}).parseInbound(payload) ||
    twilioAdapter.parseInbound(payload)
  );
}

export async function sendSms(input: {
  to: string;
  body: string;
}): Promise<SmsSendResult> {
  const adapter = await getPrimarySmsAdapter();
  const message: OutboundSms = {
    to: input.to,
    from: ownerMobileE164(),
    body: input.body,
    callbackUrl: isDemoMode() ? undefined : smsWebhookUrl(),
  };
  return adapter.send(message);
}
