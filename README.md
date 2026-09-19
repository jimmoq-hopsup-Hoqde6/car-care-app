# Mobile Car Scratch Repair Adelaide — Job desk

A local web app for **Marcel Kuhn** to turn quote requests into drafts and bookings.

It does **not** invent prices. You type the figure. **Quotes and booking confirmations never send unless you tap Send.** The usual path is: write quote → save Gmail draft → pick a free calendar slot → save a confirmation draft.

Two follow-on emails can send on a schedule (see [Automations](#automations-what-sends-on-its-own)): a nudge if a quote sits unanswered, and a Google review ask after a job is marked Done.

Timezone: **Australia/Adelaide**  
From address: **Info@mobilecarscratchrepairadelaide.com.au**

## What you can do

- **Job board** — Needs quote, Awaiting customer, Ready to book, Booked, Done
- **Inbox triage** — quote requests, website form leads, booking replies; marketing such as Manheim is ignored
- **Notifications** — when a customer accepts a quote or asks to book, a badge tells you they are waiting for your booking approval (nothing is auto-sent)
- **Quote composer** — you enter the price; the email uses Marcel's locked standard (first-name greeting, 30-day validity, mobile number ask)
- **Booking picker** — next 14 weekdays, default 8:00 am–4:00 pm, 3-hour jobs; recommends slots near other booked jobs in nearby Adelaide suburbs; creates a Calendar event and a confirmation draft

Sample jobs load automatically: **Jenny Gwynne (BMW bumper, Crafers)**, **Nathan Crowe (Outlander, Unley, follow-up due)**, **John Hale (Honda CR-V, Glenelg, waiting for booking approval)**, **Mia Chen (Corolla, Goodwood, waiting for booking approval)**, **Priya Nair (Mazda 3, Norwood, review ask due)**, plus booked neighbours in **Stirling, Brighton and Somerton Park** so recommendations show in demo.

## Run it on your computer (demo, no Google)

1. Install [Node.js 20 or newer](https://nodejs.org/) (the LTS version is fine).
2. Open a terminal in this folder.
3. Install and start:

```bash
npm install
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000).

The first start creates a local `.env` (no secrets) and a SQLite file with the sample jobs, booked neighbours, and two unread booking-approval notifications. You can write quotes and “book” slots in demo mode. Nothing is emailed and nothing is written to Google until you connect OAuth.

Useful extras:

```bash
npm run setup               # rebuild the local database and sample jobs
npm run db:seed             # put the sample jobs back if you deleted them
npm run automations:run     # queue due follow-ups / review asks (demo: no email)
npm run automations:verify  # confirm demo mode did not email anyone
npm run booking:verify      # confirm demo alerts + suburb-aware slot recommendations
npm run quote:verify        # confirm the locked quote template wording
```

## Connect live Gmail and Calendar

You need a Google account you already use for the business inbox (or a Google Cloud project you control).

### 1. Create a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project, e.g. `MCSR Adelaide job desk`.
3. Open **APIs & Services → Library**.
4. Enable **Gmail API** and **Google Calendar API**.

### 2. OAuth consent

1. **APIs & Services → OAuth consent screen**.
2. User type: **External**.
3. App name: `Mobile Car Scratch Repair Adelaide`.
4. Support email: your Google address.
5. Add scopes (or the app will request them when you click Connect):

| Scope | Why |
| --- | --- |
| `openid` `email` `profile` | Know which Google account connected |
| `https://www.googleapis.com/auth/gmail.modify` | Read quote threads, save drafts, send only when you click Send |
| `https://www.googleapis.com/auth/calendar` | Read free/busy slots and create job events |

6. Add yourself as a **Test user** (the app does not need to be verified for your own use).
7. Google may show “Google hasn’t verified this app” — choose **Continue** as the test user.

### 3. Create the OAuth client

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Authorised JavaScript origins: `http://localhost:3000`
4. Authorised redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy the **Client ID** and **Client secret**.

### 4. Put the keys in `.env` (never commit this file)

```bash
cp .env.example .env
```

Then edit `.env`:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="paste-output-of-openssl-rand-base64-32"
AUTH_URL="http://localhost:3000"
DEMO_MODE="false"
GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="...."
FOLLOW_UP_DAYS="2"
REVIEW_ASK_DAYS_AFTER_JOB="1"
GOOGLE_REVIEW_URL="https://maps.app.goo.gl/UJcUi9ouWQaVn71D8?g_st=ic"
```

Create a fresh `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Restart `npm run dev`, tap **Connect Google**, and sign in.

After that:

- Inbox reads recent Gmail threads (Manheim-style marketing is parked under Ignored)
- Booking reads real free/busy on your primary calendar
- **Save as draft** writes a Gmail draft (not sent)
- **Book** creates a calendar event titled like `Job — Jenny Gwynne — BMW 320i front bumper — Crafers` and a confirmation draft

## Notifications (in-app only)

When a customer reply looks like they accepted a quote, asked to book, or confirmed a day, the desk:

- moves the job toward **Ready to book** if it was still awaiting them
- stores an unread notification in SQLite
- shows a badge on the bell (header) and a list at `/notifications`

This does **not** email anyone. You still open the job and pick a slot yourself. Demo mode seeds two “waiting for your booking approval” notes (John and Mia).

## Booking recommendations

The booking screen still lists free slots from Google Calendar free/busy (or the demo busy blocks: Monday morning and Wednesday afternoon). It also treats your own **Booked** jobs as busy.

Recommended slots (top 2–3) prefer:

1. Same suburb, same day
2. Nearby cluster (hills / south / inner south / east / north / west / CBD)
3. Any other free weekday slot

Reasons look like “Same afternoon as your Crafers job” or “Nearest free slot after Unley”. Default hours stay Monday–Friday 8:00–16:00 Adelaide, 3-hour jobs, next 14 weekdays — change those on Settings.

## Quote wording

The composer always uses Marcel's locked standard (Australian English). The greeting uses the customer's first name — never a bare `Hi ,`. The dollar figure is the number **you** typed.

```
Hi Jenny,

Thanks for getting in touch and sharing the photos.

Quote
• Front bumper scratch and scuff
• Estimated total: $520.00

This quote is valid for 30 days from the date of this email.

I use digital colour-matching technology so the repair blends with the surrounding paintwork.

An onsite inspection confirms the final price if more work is needed.

All work is covered by a lifetime workmanship guarantee.

If you'd like to proceed, please reply with your preferred repair dates and a mobile number.

I'll need off-street parking, access to a power point, and adequate natural light.

Kind regards,
Marcel Kuhn
Mobile Car Scratch Repair Adelaide
```

## Automations (what sends on its own)

**Never auto-sent (you must tap Send):**
- Quote emails
- Booking confirmation emails

**May auto-send (only these two):**

| Rule | When | Default |
| --- | --- | --- |
| Follow-up | Job is **Awaiting customer** (quote sent or waiting) and there has been no customer reply for **2 days** | `FOLLOW_UP_DAYS=2` |
| Google review ask | The day after you mark a job **Booked → Done** (or otherwise Done) | `REVIEW_ASK_DAYS_AFTER_JOB=1` |

The review email includes Marcel's Google review link (`GOOGLE_REVIEW_URL`, default `https://maps.app.goo.gl/UJcUi9ouWQaVn71D8?g_st=ic`). Change it on Settings if the Maps link ever moves.

Each job stores `lastOutboundAt`, `followUpSentAt`, and `reviewAskSentAt` so the same email is not sent twice. You can **Skip** a follow-up or review ask on the job page. The board shows Pending / Sent / Skipped / Waiting.

### How the schedule runs

```bash
npm run automations:run
```

That finds due jobs and:
- **Demo mode (`DEMO_MODE=true`)** — writes a queue entry on the job and **does not email anyone**
- **Live, Google connected** — sends via Gmail using the stored OAuth tokens

You can also tap **Run automations now** on Settings, or hit `GET`/`POST` `/api/automations/run` from a host cron. If you set `AUTOMATIONS_SECRET` in `.env`, send `Authorization: Bearer …`.

A typical cron (once a day, Adelaide morning) is enough:

```bash
0 8 * * * cd /path/to/job-desk && npm run automations:run
```

## Settings you can change in the app

- Weekdays and hours (default Monday–Friday 8:00–16:00 Adelaide)
- Job length (default 3 hours)
- Follow-up days, review-ask days, and Google review URL
- Optional price bands (minor scratch / bumper / multi-panel) — only used if **you** store a rate

## Deploy later

Any Node host works (Vercel, a small VPS). Use the same env vars, point `AUTH_URL` at the live site, and add that origin plus `/api/auth/callback/google` to the Google client. For a hosted database you can switch Prisma from SQLite to Postgres later.

## Stack

Next.js App Router, TypeScript, Tailwind, Prisma, SQLite, Auth.js (Google OAuth).
