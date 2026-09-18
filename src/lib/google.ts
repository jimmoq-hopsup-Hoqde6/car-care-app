import { google } from "googleapis";
import { auth } from "./auth";
import { isGoogleConfigured } from "./env";

export async function getGoogleAccessToken() {
  const session = await auth();
  return session?.accessToken ?? null;
}

export async function getOAuthClient() {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken || !isGoogleConfigured()) return null;
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({ access_token: accessToken });
  return client;
}

export async function getGmail() {
  const oauth = await getOAuthClient();
  if (!oauth) return null;
  return google.gmail({ version: "v1", auth: oauth });
}

export async function getCalendar() {
  const oauth = await getOAuthClient();
  if (!oauth) return null;
  return google.calendar({ version: "v3", auth: oauth });
}

export function encodeRfc822({
  to,
  from,
  subject,
  body,
}: {
  to: string;
  from: string;
  subject: string;
  body: string;
}) {
  const message = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");
  return Buffer.from(message).toString("base64url");
}

export async function createGmailDraft(input: {
  to: string;
  from: string;
  subject: string;
  body: string;
  threadId?: string | null;
}) {
  const gmail = await getGmail();
  if (!gmail) return null;
  const raw = encodeRfc822(input);
  const result = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw,
        threadId: input.threadId ?? undefined,
      },
    },
  });
  return result.data.id ?? null;
}

export async function sendGmailDraft(draftId: string) {
  const gmail = await getGmail();
  if (!gmail) return false;
  await gmail.users.drafts.send({
    userId: "me",
    requestBody: { id: draftId },
  });
  return true;
}

export async function sendGmailMessage(input: {
  to: string;
  from: string;
  subject: string;
  body: string;
  threadId?: string | null;
}) {
  const gmail = await getGmail();
  if (!gmail) return false;
  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodeRfc822(input),
      threadId: input.threadId ?? undefined,
    },
  });
  return true;
}
