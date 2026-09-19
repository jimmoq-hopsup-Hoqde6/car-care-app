"use client";

import { useState } from "react";
import type { SmsMessage } from "@prisma/client";
import { saveSmsAction } from "@/app/actions/sms";
import { formatLastActivity } from "@/lib/activity";
import { formatAuMobile } from "@/lib/phone";
import { isApprovalSmsType } from "@/lib/sms/copy";
import type { SmsType } from "@/lib/sms/types";

export function SmsThread({
  jobId,
  customerPhone,
  messages,
}: {
  jobId: string;
  customerPhone?: string | null;
  messages: SmsMessage[];
}) {
  const [body, setBody] = useState("");
  const [type, setType] = useState<SmsType>("reply");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canText = Boolean(customerPhone);

  async function submit(send: boolean) {
    if (send && isApprovalSmsType(type)) {
      const ok = confirm(
        "Send this SMS now? Quotes and booking confirms still need your approval — same as email.",
      );
      if (!ok) return;
    }
    setBusy(true);
    setMessage(null);
    const result = await saveSmsAction({ jobId, body, send, type });
    setMessage(result.message);
    if (result.ok && send) setBody("");
    setBusy(false);
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="text-sm font-semibold text-ink">SMS</h2>
      <p className="mt-1 text-xs text-stone-500">
        Texts use Marcel&apos;s existing mobile 0435 222 221 via MessageMedia.
        Quotes and booking confirms still need your Send tap. Demo does not
        call the live API.
      </p>
      <p className="mt-2 text-sm text-stone-600">
        Customer mobile: {formatAuMobile(customerPhone) || "not set"}
      </p>

      <div className="mt-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-sm text-stone-500">No SMS on this job yet.</p>
        ) : (
          messages.map((item) => (
            <article
              key={item.id}
              className={`rounded-xl px-3 py-2 text-sm ${
                item.direction === "inbound"
                  ? "bg-white"
                  : "bg-teal/10"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                {item.direction === "inbound" ? "Customer" : "Marcel"}
                {item.status ? ` · ${item.status}` : ""}
                {item.demo ? " · demo" : ""}
                {item.createdAt
                  ? ` · ${formatLastActivity(item.createdAt)}`
                  : ""}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-ink">{item.body}</p>
            </article>
          ))
        )}
      </div>

      <label className="mt-3 block text-sm font-medium text-ink">
        Draft a text
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          disabled={!canText}
          placeholder={
            canText
              ? "Short reply — never invent a price."
              : "Add an Australian mobile first."
          }
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal"
        />
      </label>
      <label className="mt-2 block text-xs text-stone-500">
        Type
        <select
          value={type}
          onChange={(event) => setType(event.target.value as SmsType)}
          className="ml-2 rounded-lg border border-line bg-white px-2 py-1 text-xs text-ink"
        >
          <option value="reply">Reply</option>
          <option value="photo_ask">Photo ask</option>
          <option value="follow_up">Follow-up</option>
          <option value="quote">Quote (needs Send)</option>
          <option value="booking">Booking confirm (needs Send)</option>
        </select>
      </label>

      {message ? (
        <p className="mt-2 rounded-xl bg-teal/10 px-3 py-2 text-sm text-teal-dark">
          {message}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={busy || !canText}
          onClick={() => void submit(false)}
          className="flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
        >
          Save SMS draft
        </button>
        <button
          type="button"
          disabled={busy || !canText}
          onClick={() => void submit(true)}
          className="flex-1 rounded-full bg-teal px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
        >
          {isApprovalSmsType(type) ? "Send SMS (approval)" : "Send SMS"}
        </button>
      </div>
    </section>
  );
}
