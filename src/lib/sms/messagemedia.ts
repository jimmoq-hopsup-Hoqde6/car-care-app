import { isDemoMode } from "../env";
import { ownerMobileE164, toE164Au } from "../phone";
import type {
  DeliveryUpdate,
  InboundSms,
  OutboundSms,
  SmsAdapter,
  SmsSendResult,
} from "./types";

const API = "https://api.messagemedia.com/v1/messages";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function unwrapPayload(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload);
  if (!root) return null;
  const inbound = root.inbound_messages ?? root.messages ?? root.replies;
  if (Array.isArray(inbound) && inbound[0]) {
    return asRecord(inbound[0]);
  }
  return root;
}

export function parseMessageMediaInbound(payload: unknown): InboundSms | null {
  const record = unwrapPayload(payload);
  const from = toE164Au(
    pickString(record, [
      "sourceAddress",
      "source_address",
      "source_number",
      "from",
      "originating_number",
    ]),
  );
  const to = toE164Au(
    pickString(record, [
      "destinationAddress",
      "destination_address",
      "destination_number",
      "to",
    ]),
  );
  const body = pickString(record, [
    "replyContent",
    "moContent",
    "messageContent",
    "content",
    "body",
    "text",
  ]);
  if (!from || !body) return null;
  return {
    from,
    to: to || ownerMobileE164(),
    body,
    providerId: pickString(record, [
      "id",
      "message_id",
      "messageId",
      "mtId",
      "reply_id",
    ]) || undefined,
    provider: "messagemedia",
  };
}

export function parseMessageMediaDelivery(payload: unknown): DeliveryUpdate | null {
  const record = unwrapPayload(payload);
  const providerId = pickString(record, [
    "message_id",
    "messageId",
    "id",
    "mtId",
  ]);
  const status = pickString(record, ["status", "statusCode", "status_code"]).toLowerCase();
  if (!providerId || !status) return null;
  if (["received", "enqueued", "queued", "submitted"].includes(status) && !record?.replyContent) {
    return {
      providerId,
      status,
      delivered: status === "delivered",
    };
  }
  if (["delivered", "failed", "expired", "rejected", "undeliverable"].includes(status)) {
    return {
      providerId,
      status,
      delivered: status === "delivered",
    };
  }
  return null;
}

export function createMessageMediaAdapter(input: {
  apiKey?: string | null;
  apiSecret?: string | null;
}): SmsAdapter {
  return {
    name: "messagemedia",
    parseInbound: parseMessageMediaInbound,
    parseDelivery: parseMessageMediaDelivery,
    async send(message: OutboundSms): Promise<SmsSendResult> {
      if (isDemoMode()) {
        return {
          status: "queued",
          delivered: false,
          demo: true,
          reason: "demo — SMS queued only, MessageMedia not called",
        };
      }
      if (!input.apiKey || !input.apiSecret) {
        return {
          status: "queued",
          delivered: false,
          demo: false,
          reason: "no MessageMedia credentials — SMS saved, not sent",
        };
      }
      const destination = toE164Au(message.to);
      if (!destination) {
        return {
          status: "failed",
          delivered: false,
          demo: false,
          reason: "destination is not a valid Australian mobile",
          error: "Invalid destination number",
        };
      }
      try {
        const auth = Buffer.from(`${input.apiKey}:${input.apiSecret}`).toString(
          "base64",
        );
        const response = await fetch(API, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            messages: [
              {
                content: message.body,
                destination_number: destination,
                source_number: toE164Au(message.from) || ownerMobileE164(),
                source_number_type: "INTERNATIONAL",
                format: "SMS",
                delivery_report: true,
                callback_url: message.callbackUrl,
              },
            ],
          }),
        });
        const json = (await response.json().catch(() => null)) as {
          messages?: Array<{ message_id?: string; status?: string }>;
          message?: string;
        } | null;
        if (!response.ok) {
          const raw = json?.message || `HTTP ${response.status}`;
          return {
            status: "failed",
            delivered: false,
            demo: false,
            reason: "MessageMedia send failed",
            error: raw,
          };
        }
        const sent = json?.messages?.[0];
        return {
          id: sent?.message_id,
          status: sent?.status || "queued",
          delivered: false,
          demo: false,
          reason: "sent via MessageMedia",
        };
      } catch (error) {
        return {
          status: "failed",
          delivered: false,
          demo: false,
          reason: "MessageMedia send failed",
          error: error instanceof Error ? error.message : "Unknown SMS error",
        };
      }
    },
  };
}
