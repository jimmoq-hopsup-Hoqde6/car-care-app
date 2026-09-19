export type SmsProviderName = "messagemedia" | "twilio";

export type SmsDirection = "inbound" | "outbound";

export type SmsType = "reply" | "quote" | "booking" | "photo_ask" | "follow_up";

export type OutboundSms = {
  to: string;
  from: string;
  body: string;
  callbackUrl?: string;
};

export type InboundSms = {
  from: string;
  to: string;
  body: string;
  providerId?: string;
  provider: SmsProviderName;
};

export type DeliveryUpdate = {
  providerId: string;
  status: string;
  delivered?: boolean;
};

export type SmsSendResult = {
  id?: string;
  status: string;
  delivered: boolean;
  demo: boolean;
  reason: string;
  error?: string;
};

export interface SmsAdapter {
  name: SmsProviderName;
  send(message: OutboundSms): Promise<SmsSendResult>;
  parseInbound(payload: unknown): InboundSms | null;
  parseDelivery(payload: unknown): DeliveryUpdate | null;
}
