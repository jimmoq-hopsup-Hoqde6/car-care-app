# Mobile Car Scratch Repair Adelaide — Job desk

A local web app for **Marcel Kuhn** to turn quote requests into drafts and bookings.

It does **not** invent prices for the customer. You type the figure or tap Accept on an internal suggestion. **Quotes and booking confirmations never send unless you tap Send.** The usual path is: write quote → save Gmail draft → pick a free calendar slot → save a confirmation draft.

A few follow-on emails can send on a schedule (see [Automations](#automations-what-sends-on-its-own)): a nudge if a quote sits unanswered, a Google review ask after a job is marked Done, and a photo request when a quote has no damage pictures. Quotes and booking confirmations still never auto-send.

Timezone: **Australia/Adelaide**  
From address: **Info@mobilecarscratchrepairadelaide.com.au**  
Owner mobile (later SMS only — not used here): **0435222221**

The job-desk header uses Marcel's business-card lockup (black background, white italic **MobileCar**, teal **ScratchRepair**, `//// ADELAIDE`). Assets live in `public/brand/`. Accent colour is `#2dd4bf`. Quote email wording is unchanged.

## What you can do

- **Job board** — Needs quote, Awaiting customer, Ready to book, Booked, Done. Each card shows a **repair photo** thumbnail (or “No repair photo”) and **last activity** in Adelaide time (`Last: 19 Sep · 11:58 am`). Toggle **Newest activity** or **Stalled first**.
- **Inbox triage** — quote requests, website form leads, booking replies; marketing such as Manheim is ignored. Existing Gmail job-desk labels seed the job status.
- **Gmail labels** — one stage label at a time: Quote request, Awaiting customer, Ready to book, Booked, Follow-up / Review. Label changes never send email.
- **Notifications** — when a customer accepts a quote or asks to book, a badge tells you they are waiting for your booking approval (nothing is auto-sent)
- **Quote composer** — you enter the price or tap **Accept suggestion**; the email uses Marcel's locked standard (first-name greeting, 30-day validity, mobile number ask). Suggestions never send themselves.
- **Booking picker** — next 14 weekdays, default 8:00 am–4:00 pm, 3-hour jobs; recommends slots near other booked jobs in nearby Adelaide suburbs; creates a Calendar event and a confirmation draft

Sample jobs load automatically: **Jenny Gwynne (BMW bumper, Crafers)**, **Nathan Crowe (Outlander, Unley, follow-up due)**, **John Hale (Honda CR-V, Glenelg, waiting for booking approval)**, **Mia Chen (Corolla, Goodwood, waiting for booking approval)**, **Priya Nair (Mazda 3, Norwood, review ask due)**, **Jamie Collis (Paradise bonnet, out of scope, decline drafted)**, **Sam Vella (Norwood door, photo ask queued)**, **Alex Rowe (Payneham bumper + guard, $650 suggestion)**, plus booked neighbours in **Stirling, Brighton and Somerton Park** so recommendations show in demo.

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
npm run labels:verify       # confirm Gmail job-desk label mapping (no email)
npm run activity:verify     # confirm last-activity Adelaide formatting + seeded dates
npm run photos:verify       # confirm demo repair photos + Jamie/Sam intake
npm run scope:verify        # confirm bonnet/roof out of scope + photo-ask/decline copy
npm run pricing:verify      # confirm smart price suggestions stay internal
npm run verify              # run all of the checks above
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

- Inbox reads recent Gmail threads (Manheim-style marketing is parked under Ignored) and seeds job status from job-desk labels
- Board stage changes apply the matching Gmail label and remove the other four
- Booking reads real free/busy on your primary calendar
- **Save as draft** writes a Gmail draft (not sent)
- **Book** creates a calendar event titled like `Job — Jenny Gwynne — BMW 320i front bumper — Crafers` (description includes name, phone, quote total, and address) and a confirmation draft. The confirmation is never auto-sent.

## Gmail labels

These five labels already exist in Marcel's Gmail. The desk uses them as-is and creates any that are missing on first live sync. Only one of these is on a thread at a time.

| Gmail label | Board meaning |
| --- | --- |
| `Quote request` | Needs quote / new quote request |
| `Awaiting customer` | Quote sent, waiting on a reply |
| `Ready to book` | Customer accepted / picking a slot |
| `Booked` | Calendar event confirmed |
| `Follow-up / Review` | Stalled follow-up, or post-job review ask (Done) |

When you move a job on the board (or send a quote draft, book a slot, or a follow-up / review ask is queued), the matching label is applied and the other four job-desk labels are removed from that thread.

On **Add to job board**, if the thread already has one of these labels, that label wins over the snippet classifier.

Label sync never sends a customer email.

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

## Smart price suggestions

The quote composer can **suggest** a total from job notes, panel tags, and photo filenames. This is for Marcel only. **Suggested totals never email themselves** — Accept fills the price fields, then you still tap Save draft or Send.

Internal bands (editable on Settings; rationale never goes in the customer email):

| Band | Amount |
| --- | --- |
| Standard bumper repair | $420 |
| Bumper + guard (quoted together) | $650 |
| Door repair and paint | $650 |
| Colour blend on adjacent guard | +$250 (door + blend = $900) |
| Black plastic trim | Replace only — no invented price; exclusion line when relevant |

Demo: **Alex Rowe** (Payneham, bumper + guard) shows a **$650** suggestion. Accept fills “Bumper repair and paint”, “Guard repair and paint”, and $650. The locked quote email still only lists those items and the estimated total you confirmed.

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

**May auto-send:**

| Rule | When | Default |
| --- | --- | --- |
| Follow-up | Job is **Awaiting customer** (quote sent or waiting) and there has been no customer reply for **2 days** | `FOLLOW_UP_DAYS=2` |
| Google review ask | The day after you mark a job **Booked → Done** (or otherwise Done) | `REVIEW_ASK_DAYS_AFTER_JOB=1` |
| Photo ask | **In-scope** quote has **no usable repair photos** (no image attachments, or the form said no photos) | Settings toggle **Auto-ask for photos when missing** (default on) |
| Out-of-scope decline | Incoming quote is clearly a **bonnet (hood) or roof** | Draft only (toggle **Auto-send out-of-scope declines** off) |

The review email includes Marcel's Google review link (`GOOGLE_REVIEW_URL`, default `https://maps.app.goo.gl/UJcUi9ouWQaVn71D8?g_st=ic`). Change it on Settings if the Maps link ever moves.

Photo-ask and decline emails use a first-name greeting and sign off Marcel Kuhn / Mobile Car Scratch Repair Adelaide / 0435 222 221. They never include a price. Each job stores `photoAskSentAt` and `declinedAt` so the same email is not sent twice.

### Photo ask (approved automatic)

When an **in-scope** quote request has zero usable damage photos, the desk **auto-sends** a short reply asking for pictures. This is the same class as stalled follow-ups and review asks — it does **not** need approval. It never includes a price. **Bonnet and roof jobs never get a photo-ask.**

Detection: no image attachments on the job, or the website form / notes say “No photos uploaded”. The job stays **Needs quote**, the board shows **Awaiting photos**, `lastActivityAt` is updated, and the Gmail label stays **Quote request**.

Once per thread: `photoAskSentAt` is set after the first ask. A second run does not nag.

Locked copy (Australian English, first name):

```
Hi Sam,

Thanks for getting in touch about the driver door scratch in Norwood.

To give you an accurate quote, could you please reply with a few clear photos of the damage (close-ups and a wider shot of the panel/bonnet help a lot)?

Once I have the pictures I’ll send through a quote.

Kind regards,
Marcel Kuhn
Mobile Car Scratch Repair Adelaide
0435 222 221
```

Demo seed: **Sam Vella** (Norwood driver door, no photos) queues the photo-ask without emailing.

Each job stores `lastOutboundAt`, `followUpSentAt`, and `reviewAskSentAt` so the same follow-up / review is not sent twice. You can **Skip** a follow-up or review ask on the job page. The board shows Pending / Sent / Skipped / Waiting.

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

## Out of scope (Phase 1)

This desk is **email + Google Calendar only**. Do not expect SMS, WhatsApp, or an iOS app here.

Marcel's owner mobile for a later SMS phase is **0435222221** (`OWNER_MOBILE` in `.env`). It is shown on Settings so it is not lost. This app never sends a text.

## Last activity

Every job stores `lastActivityAt` (Australia/Adelaide). It is the newest of:

- last inbound customer message
- last outbound quote, booking confirmation, follow-up, review, photo-ask, or decline email (drafted or sent)
- last status change
- last booking-slot action
- last repair-photo upload

The board and the job page show it as `Today · 11:58 am`, `Yesterday · 4:32 pm`, or `Wed 17 Sep · 4:32 pm`. Demo jobs are seeded with staggered times so stalled threads are easy to spot.

## Repair photos

Every job card uses the **primary** damage shot as a thumbnail so Marcel can see the panel before driving out. The job, quote, and booking screens show a gallery — tap for full size, swipe previous/next, and mark another shot as the board thumbnail.

Photos come from:

- images attached to the Gmail thread when you add it to the board
- files you upload on the job (demo and live)

Demo SVGs live in `public/demo/`. Manual uploads go to `public/uploads/` (not committed).

## Panel scope (critical)

These are the **only** two panels Marcel does not repair:

| Out of scope — do not quote, do not auto-ask for photos |
| --- |
| **Bonnets** (hoods) |
| **Roofs** |

**In scope (quote and photo-ask as usual):** doors, bumpers, guards/fenders, quarters, and explicitly **tailgates** and **tailgate spoilers**. A tailgate or spoiler is **not** the roof.

When inbox triage or a new job is clearly bonnet or roof:

1. The job is flagged **Out of scope** on the board (Needs quote column, amber badge).
2. A polite decline template is prepared. Default is a **draft for you to send**. Turn on **Auto-send out-of-scope declines** only if you want it to send on its own.
3. The missing-photo auto-ask does **not** run.

Locked decline copy (Australian English, first name — not blunt “I don’t do bonnets”):

```
Hi Jamie,

Thanks for getting in touch.

With our mobile service, the only panels we are unable to repair are the horizontal ones — the bonnet and the roof.

Happy to help if the damage is on another panel — a door, bumper, guard, quarter, tailgate or spoiler. Reply with a few photos and I’ll gladly quote it.

Kind regards,
Marcel Kuhn
Mobile Car Scratch Repair Adelaide
0435 222 221
```

Demo seed: **Jamie Collis** (Paradise, scratches on bonnet, no photos) is flagged out of scope with this decline drafted — not emailed, and no photo-ask.

## Settings you can change in the app

- Weekdays and hours (default Monday–Friday 8:00–16:00 Adelaide)
- Job length (default 3 hours)
- Follow-up days, review-ask days, and Google review URL
- Auto-ask for photos when missing (default on)
- Auto-send out-of-scope declines (default off — draft only)
- Price bands for suggestions (bumper $420, bumper + guard $650, door $650, guard blend +$250, trim replace-only)

## Deploy later

Any Node host works (Vercel, a small VPS). Use the same env vars, point `AUTH_URL` at the live site, and add that origin plus `/api/auth/callback/google` to the Google client. For a hosted database you can switch Prisma from SQLite to Postgres later.

## Stack

Next.js App Router, TypeScript, Tailwind, Prisma, SQLite, Auth.js (Google OAuth).
