import { emailGreeting } from "../quote";

export function buildSmsPhotoAsk(customerName?: string | null) {
  const hi = emailGreeting(customerName).replace(/,$/, "");
  return `${hi} — could you reply with a few clear photos of the damage so I can quote? Marcel, Mobile Car Scratch Repair Adelaide`;
}

export function buildSmsFollowUp(customerName?: string | null) {
  const hi = emailGreeting(customerName).replace(/,$/, "");
  return `${hi} — just checking in on the quote I sent through. Happy to lock in a day. Marcel, Mobile Car Scratch Repair Adelaide`;
}

export function isApprovalSmsType(type: string) {
  return type === "quote" || type === "booking";
}
