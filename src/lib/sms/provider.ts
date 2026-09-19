import { isDemoMode } from "../env";
import { ownerMobileE164 } from "../phone";
import { getSettings } from "../settings";
import { createMessageMediaAdapter } from "./messagemedia";
import { twilioAdapter } from "./twilio";
import type { InboundSms, OutboundSms, SmsAdapter, SmsSendResult } from "./types";

/** Live Vercel webhook Marcel already uses. AUTH_URL still wins when set. */
export const PRODUCTION_SMS_WEBHOOK =
  "https://car-care-app-green.vercel.app/api/sms/messagemedia";

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

export function friendlySmsError(reason?: string | null, error?: string | null) {
  const text = `${reason ?? ""} ${error ?? ""}`.toLowerCase();
  if (
    /not authorised|not authorized|unregistered|source_number|invalid source|number is not/.test(
      text,
    )
  ) {
    return "MessageMedia did not accept 0435 222 221 as the sender. Authorise it under Numbers → My own numbers, then try again.";
  }
  if (/unauthorized|401|403|invalid.*key|invalid.*secret|credential/.test(text)) {
    return "MessageMedia credentials were refused. Check the API key and secret in Settings.";
  }
  if (/destination|invalid.*mobile|not a valid australian/.test(text)) {
    return "That destination is not a valid Australian mobile.";
  }
  if (error?.trim()) return error.trim();
  if (reason?.trim()) return reason.trim();
  return "The text could not be sent. Try again, or check MessageMedia in Settings.";
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
