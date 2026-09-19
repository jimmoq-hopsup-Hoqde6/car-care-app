import { ownerMobileE164, toE164Au } from "../phone";
import type { DeliveryUpdate, InboundSms, SmsAdapter } from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pick(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/** Twilio-style inbound (form or JSON). Used as a later fallback adapter. */
export function parseTwilioInbound(payload: unknown): InboundSms | null {
  const record = asRecord(payload);
  const from = toE164Au(pick(record, ["From", "from"]));
  const body = pick(record, ["Body", "body"]);
  if (!from || !body) return null;
  return {
    from,
    to: toE164Au(pick(record, ["To", "to"])) || ownerMobileE164(),
    body,
    providerId: pick(record, ["MessageSid", "SmsSid", "sid"]) || undefined,
    provider: "twilio",
  };
}

export function parseTwilioDelivery(payload: unknown): DeliveryUpdate | null {
  const record = asRecord(payload);
  const providerId = pick(record, ["MessageSid", "SmsSid", "sid"]);
  const status = pick(record, ["MessageStatus", "SmsStatus", "status"]).toLowerCase();
  if (!providerId || !status) return null;
  return {
    providerId,
    status,
    delivered: status === "delivered",
  };
}

export const twilioAdapter: SmsAdapter = {
  name: "twilio",
  async send() {
    return {
      status: "queued",
      delivered: false,
      demo: true,
      reason: "Twilio adapter is a fallback shape only — MessageMedia is primary",
    };
  },
  parseInbound: parseTwilioInbound,
  parseDelivery: parseTwilioDelivery,
};
