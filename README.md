# Mobile Car Scratch Repair Adelaide — Job desk

A local web app for **Marcel Kuhn** to turn quote requests into drafts and bookings.

It does **not** invent prices for the customer. You type the figure or tap Accept on an internal suggestion. **Quotes and booking confirmations never send unless you tap Send.** The usual path is: write quote → save Gmail draft → pick a free calendar slot → save a confirmation draft.

A few follow-on emails can send on a schedule (see [Automations](#automations-what-sends-on-its-own)): a nudge if a quote sits unanswered, and a Google review ask after a job is marked Done. Photo-asks stay as drafts and only target a real customer inbox. Quotes and booking confirmations still never auto-send.

Timezone: **Australia/Adelaide**  
From address: **Info@mobilecarscratchrepairadelaide.com.au**  
Owner mobile / SMS (existing number only): **0435222221** (+61 435 222 221)

The job-desk header uses Marcel's business-card lockup (black background, white italic **MobileCar**, teal **ScratchRepair**, `//// ADELAIDE`). Assets live in `public/brand/`. Accent colour is `#2dd4bf`. Quote email wording is unchanged.

## What you can do

- **Phone / web login** — hosted mode shows a branded Google Sign-In page; only Marcel's allowlisted accounts get in. Local demo stays open. See [Deploy for phone access](#deploy-for-phone-access).
- **Job board** — Needs quote, Awaiting customer, Ready to book, Booked, Done. Phone-first cards show a large damage photo (or **No damage photo** — never a broken image), name, suburb, phone, quote $, last activity, stage chip, and booked Adelaide date/time when booked. Status colour sits on the left edge. **Ready to book — no date** and **Stalled** jobs highlight as rotting. Default sort is **Urgency** (forgotten bookings, then stalled, then newest); also **Newest activity**, **Stalled first**, or **Highest quote**. The desk uses a cool grey canvas (`#f4f5f7`), black branded header, and teal `#2dd4bf` — login stays black.
- **Inbox triage** — quote requests, website forms, booking replies and SMS **land on the job board automatically** when you open the (empty) job board, open Inbox, tap **Sync inbox now**, or hit `/api/inbox/sync` (same cron secret as automations). Marketing such as Manheim, Google security alerts, and Sinch tickets are never added. Website forms that arrive from `info@` import the customer **Name / Email / Phone** (or Reply-To), never `info@` itself. If Gmail fails, the desk shows a reconnect message instead of crashing.
- **Notifications** — **Needs your reply** stays on the board and Alerts until a calendar date exists (marking an alert read does not hide the job). Quotes and bookings still never auto-send.
- **Quote composer** — you enter the price or tap **Accept suggestion**; the email uses Marcel's locked standard (first-name greeting, 30-day validity, mobile number ask). Suggestions never send themselves.
- **Booking picker** — next 14 weekdays, default 8:00 am–4:00 pm, 3-hour jobs; recommends slots near other booked jobs in nearby Adelaide suburbs; creates a Calendar event and a confirmation draft
- **SMS** — same job card as email, via MessageMedia on **0435 222 221**. Unknown numbers become Needs quote. Live webhook: `https://car-care-app-green.vercel.app/api/sms/messagemedia`.
- **Gmail labels** — one stage label at a time: Quote request, Awaiting customer, Ready to book, Booked, Follow-up / Review. Label changes never send email.

## Expert workflow (phone) — a day in the life

1. Sign in with an allowlisted Google account (hosted) or open the demo locally.
2. If the board is empty, tap **Sync inbox now** so website **New Quote Request** forms and booking replies land on the board. Opening the empty job board after sign-in also auto-imports.
3. The amber **Needs your reply** strip lists every **Ready to book — no date** job (they accepted or asked “when can you come?” and there is still no Calendar event). Age is since the last customer message. Tap **Offer dates** or **Confirm booking**. Quotes and booking confirms never auto-send.
4. **Needs quote** → **Write quote** → Accept suggestion or type the price → **Save draft** or **Send**. New form leads show the customer’s name/email, not `info@`. Photo-asks stay drafts and only go to a real customer inbox.
5. SMS stays on the same job. Failed sends explain an unauthorised 0435 222 221 if MessageMedia rejected the sender.

Settings **Connection health** shows Google login, Gmail token, Calendar, MessageMedia, and the owner mobile.

Sample jobs load automatically: **Jenny Gwynne (BMW bumper, Crafers)**, **Nathan Crowe (Outlander, Unley, follow-up due)**, **John Hale (Honda CR-V, Glenelg, waiting for booking approval)**, **Mia Chen (Corolla, Goodwood, waiting for booking approval)**, **Priya Nair (Mazda 3, Norwood, review ask due)**, **Jamie Collis (Paradise bonnet, out of scope, decline drafted)**, **Sam Vella (Norwood door, photo ask queued + SMS)**, **Alex Rowe (Payneham bumper + guard, $650 suggestion)**, **Taylor Nguyen (Prospect SMS thread)**, plus booked neighbours in **Stirling, Brighton and Somerton Park** so recommendations show in demo. Opening the job board or Inbox also auto-adds **Kai Bennett (Magill bumper)** if that thread is not already a job.

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
npm run sms:verify          # confirm SMS E.164 matching + demo MessageMedia no-op
npm run login:verify        # confirm demo stays open and hosted allowlist login
npm run inbox:verify        # confirm auto-add; Google/Sinch/info@ are not customers
npm run desk:verify         # confirm next-action CTAs, connection health, SMS error copy
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
NEXTAUTH_SECRET="paste-the-same-value"
AUTH_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
AUTH_ALLOWLIST="info@mobilecarscratchrepairadelaide.com.au,moogly88@gmail.com"
DEMO_MODE="false"
GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="...."
FOLLOW_UP_DAYS="2"
REVIEW_ASK_DAYS_AFTER_JOB="1"
GOOGLE_REVIEW_URL="https://maps.app.goo.gl/UJcUi9ouWQaVn71D8?g_st=ic"
```

Create a fresh `AUTH_SECRET` / `NEXTAUTH_SECRET` (same value in both is fine):

```bash
openssl rand -base64 32
```

Restart `npm run dev`, tap **Connect Google**, and sign in.

After that:

- Inbox reads recent Gmail threads (Manheim, Google alerts, and Sinch are parked under Ignored; website forms from info@ resolve the customer Email/Name) and seeds job status from job-desk labels
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

When a thread is **auto-added** (or you tap Add to job board), if it already has one of these labels, that label wins over the snippet classifier.

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

To ensure the best possible colour match, we use advanced digital colour-matching technology. This allows us to achieve a finish that blends seamlessly with your vehicle’s existing paintwork.

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
- Photo-ask emails (draft only — routing must be a real customer inbox)

**May auto-send:**

| Rule | When | Default |
| --- | --- | --- |
| Follow-up | Job is **Awaiting customer** (quote sent or waiting) and there has been no customer reply for **2 days** | `FOLLOW_UP_DAYS=2` |
| Google review ask | The day after you mark a job **Booked → Done** (or otherwise Done) | `REVIEW_ASK_DAYS_AFTER_JOB=1` |
| Photo ask | **In-scope** quote has **no usable repair photos** | Settings toggle **Prepare a photo-ask draft** (**default off**). Never auto-sends. Never emails Google alerts, Sinch, no-reply, or info@ |
| Out-of-scope decline | Incoming quote is clearly a **bonnet (hood) or roof** | Draft only (toggle **Auto-send out-of-scope declines** off) |

The review email includes Marcel's Google review link (`GOOGLE_REVIEW_URL`, default `https://maps.app.goo.gl/UJcUi9ouWQaVn71D8?g_st=ic`). Change it on Settings if the Maps link ever moves.

Photo-ask and decline emails use a first-name greeting and sign off Marcel Kuhn / Mobile Car Scratch Repair Adelaide / 0435 222 221. They never include a price. Each job stores `photoAskSentAt` and `declinedAt` so the same email is not sent twice.

### Photo ask (draft only — customer inbox only)

When an **in-scope** quote request has zero usable damage photos **and** Settings **Prepare a photo-ask draft** is on, the desk writes a Gmail **draft** asking for pictures. It does **not** send. Turn the toggle off (the default) until you have checked routing.

Photo-ask / follow-up / review / decline automations **only** address a real customer:

- website form **Reply-To** or `Email:` / `Name:` in the body, or
- the inbound customer **From**

They never send or draft to `no-reply@accounts.google.com`, `compliance@smb.sinch.com`, other no-reply/Sinch/Google alert addresses, or Marcel's own `info@` / allowlisted inbox. Greetings never use **Hi Mobile** or **Hi Info** — those fall back to **Hi there,**.

Bonnet and roof jobs never get a photo-ask.

Detection: no image attachments on the job, or the website form / notes say “No photos uploaded”. The job stays **Needs quote**, the board shows **Awaiting photos**, `lastActivityAt` is updated, and the Gmail label stays **Quote request**.

Once per thread: `photoAskSentAt` is set after the first draft. A second run does not nag.

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
- **Also auto-imports** eligible Inbox threads onto the board (same rules as opening Inbox)
- **Demo mode (`DEMO_MODE=true`)** — writes a queue entry on the job and **does not email anyone**
- **Live, Google connected** — follow-ups and review asks send via Gmail using the stored OAuth tokens. Photo-asks stay drafts.

You can also tap **Run automations now** on Settings (always works while you are signed in — no Bearer header). Host cron or `GET`/`POST` `/api/automations/run` and `/api/inbox/sync` accept `Authorization: Bearer $AUTOMATIONS_SECRET`. Vercel Cron cannot set custom headers; it sends `Authorization: Bearer $CRON_SECRET` automatically when that env var is set. Use the **same string** for `CRON_SECRET` and `AUTOMATIONS_SECRET`. Do not put the secret in `vercel.json`.

Production (`https://car-care-app-green.vercel.app`) uses Vercel Cron from `vercel.json`, once a day at **22:30 UTC** (inbox sync at **22:15 UTC**, slightly earlier). Vercel cron is UTC only:

| UTC | Adelaide winter (ACST, UTC+9:30) | Adelaide summer (ACDT, UTC+10:30) |
| --- | --- | --- |
| 22:15 | 07:45 | 08:45 |
| 22:30 | 08:00 | 09:00 |

That stays **Adelaide morning** all year. On the Hobby plan the job may fire anywhere inside that UTC hour; it is still morning in Adelaide.

A typical self-hosted cron (once a day, Adelaide morning) is:

```bash
0 8 * * * cd /path/to/job-desk && npm run automations:run
```

## SMS (Marcel's existing mobile only)

There is **no separate business SMS number**. All texts use **0435 222 221** (`+61435222221`).

**Provider:** Sinch MessageMedia (Australia). Outbound REST `POST https://api.messagemedia.com/v1/messages` with `source_number` = `+61435222221`. Inbound and delivery callbacks POST to `/api/sms/messagemedia` (also `/api/sms/inbound`). A Twilio-shaped parser is available at `/api/sms/twilio` for later, but MessageMedia is first.

### Authorise “My own numbers”

1. Log into the MessageMedia portal.
2. Open **Numbers** and add **0435222221** as **My own numbers** (prove you own the handset).
3. Until that number is authorised, MessageMedia may rewrite the sender or fail the send.
4. After it is authorised, customers see **0435 222 221**. Replies arrive on Marcel's phone **and** in the job desk.

Settings stores the API key/secret (or use `MESSAGEMEDIA_API_KEY` / `MESSAGEMEDIA_API_SECRET` in `.env`). Webhook URL is `{AUTH_URL}/api/sms/messagemedia`.

### Product rules

- SMS sits on the same job card as email, matched by Australian mobile (E.164).
- An unknown number creates a **Needs quote** job.
- Draft or send a text from the job. **Quotes and booking confirms still need your Send tap** (same as email).
- Optional auto SMS for photo-ask / follow-up only — Settings toggles, **default off**.
- **Demo mode never calls MessageMedia.** Taylor Nguyen (Prospect door) and Sam Vella show seeded SMS threads.

WhatsApp and iOS are still out of scope.

## Last activity

Every job stores `lastActivityAt` (Australia/Adelaide). It is the newest of:

- last inbound customer message (email or SMS)
- last outbound quote, booking confirmation, follow-up, review, photo-ask, decline email, or SMS (drafted or sent)
- last status change
- last booking-slot action
- last repair-photo upload

The board and the job page show it as `Today · 11:58 am`, `Yesterday · 4:32 pm`, or `Wed 17 Sep · 4:32 pm`. Demo jobs are seeded with staggered times so stalled threads are easy to spot.

## Repair photos

Every job card uses the **primary** damage shot as a thumbnail so Marcel can see the panel before driving out. The job, quote, and booking screens show a gallery — tap for full size, swipe previous/next, and mark another shot as the board thumbnail.

Photos come from:

- images attached to the Gmail thread when you add it to the board
- files you upload on the job (demo and live)

Demo SVGs live in `public/demo/`. On your computer, manual uploads go to `public/uploads/` (not committed). On Vercel, Gmail attachments and uploads are stored in Neon and served from `/api/photos/…` so job-card thumbs survive serverless disk.

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
- Auto-ask for photos when missing (default **off** — prepares a draft, never auto-sends, never to Google/Sinch/info@)
- Auto-add inbox to board (default on — Manheim, Google alerts, and Sinch are never added; website forms from info@ use the customer Email/Reply-To)
- Auto-send out-of-scope declines (default off — draft only)
- Price bands for suggestions (bumper $420, bumper + guard $650, door $650, guard blend +$250, trim replace-only)

## Deploy for phone access

The job desk is a website. Host it (Vercel is the shortest path) so Marcel can open it on his phone. **SQLite will not persist on Vercel serverless** — use Postgres for real jobs.

### What you get

- A branded **Sign in with Google** page (MobileCar ScratchRepair ADELAIDE lockup)
- Only allowlisted accounts can open the desk: **info@mobilecarscratchrepairadelaide.com.au** and **moogly88@gmail.com** (change `AUTH_ALLOWLIST` if needed)
- After sign-in, the job board, quotes, SMS, inbox, and settings work as they do on your computer
- Local demo (`DEMO_MODE=true`, or no `AUTH_SECRET` / `NEXTAUTH_SECRET`) stays open without a login

### 1. Create a Postgres database (required on Vercel)

1. Open [Neon](https://neon.tech/) (free tier is enough) or **Vercel → Storage → Create Database → Postgres**.
2. Copy the connection string. On Neon, prefer the **pooled** host (`-pooler`) for serverless.
3. You will paste it as `DATABASE_URL` in step 3. Example shape only (not a real secret):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
```

Turso / libSQL also works if you already use it; this repo expects a Postgres `DATABASE_URL` on the host. The build rewrites Prisma from SQLite to Postgres when the URL starts with `postgres`.

### 2. Google OAuth for the live site

In the same Google Cloud OAuth **Web application** client you used locally:

1. Authorised JavaScript origins — add `https://YOUR-APP.vercel.app` (and a custom domain if you add one).
2. Authorised redirect URIs — add `https://YOUR-APP.vercel.app/api/auth/callback/google`.
3. Keep Marcel's two Google accounts as **test users** until the app is verified (it does not need to be verified for those two people).

### 3. Deploy on Vercel

1. Push this repo to GitHub (already done if you are on the project remote).
2. Open [Vercel](https://vercel.com/) → **Add New → Project** → import the repo.
3. Framework preset: **Next.js**. Build command is `npm run build` (creates tables on Postgres via `prisma db push`).
4. Add environment variables (generate your own secrets — do not reuse examples):

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Neon / Vercel Postgres URL from step 1 |
| `AUTH_SECRET` | output of `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | the **same** string as `AUTH_SECRET` |
| `AUTH_URL` | `https://YOUR-APP.vercel.app` (update after the first deploy if the URL is new) |
| `NEXTAUTH_URL` | the **same** URL as `AUTH_URL` |
| `AUTH_ALLOWLIST` | `info@mobilecarscratchrepairadelaide.com.au,moogly88@gmail.com` |
| `DEMO_MODE` | `false` |
| `GOOGLE_CLIENT_ID` | from Google Cloud |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud |
| `GOOGLE_REVIEW_URL` | `https://maps.app.goo.gl/UJcUi9ouWQaVn71D8?g_st=ic` |
| `OWNER_MOBILE` | `0435222221` |
| `MESSAGEMEDIA_API_KEY` | optional, for live SMS |
| `MESSAGEMEDIA_API_SECRET` | optional, for live SMS |
| `AUTOMATIONS_SECRET` | optional Bearer token for curl / host cron to `/api/automations/run` and `/api/inbox/sync` |
| `CRON_SECRET` | optional. **Set this on Vercel to the same value as `AUTOMATIONS_SECRET`.** Vercel Cron sends it as `Authorization: Bearer …` automatically. Leave it out of `vercel.json`. |

5. Deploy. Open the URL on your phone. You should see the branded login page, then the job board after Google Sign-In with an allowlisted account.
6. After the first URL is known, confirm `AUTH_URL` / `NEXTAUTH_URL` match it (including `https://`) and redeploy if you had to fix them.
7. MessageMedia inbound webhook (if using SMS): `{NEXTAUTH_URL}/api/sms/messagemedia` (production: `https://car-care-app-green.vercel.app/api/sms/messagemedia`).
8. After Google Sign-In, open the job board or tap **Sync inbox now**. Eligible threads land without **Add to job board**.
9. Confirm **Cron Jobs** on the Vercel project (from `vercel.json`): `GET /api/inbox/sync` at `15 22 * * *` UTC, then `GET /api/automations/run` at `30 22 * * *` UTC (Adelaide morning — 08:00 ACST / 09:00 ACDT). If either secret is set, set **both** `CRON_SECRET` and `AUTOMATIONS_SECRET` to the same value so Vercel Cron is authorised. Backup: Settings → **Run automations now**.

### 4. If login does not appear

- `DEMO_MODE=true` keeps the desk open on purpose (handy for a sample-data preview).
- Missing `AUTH_SECRET` and `NEXTAUTH_SECRET` also skips the gate — Auth.js cannot issue a session without a secret.
- A Google account that is not on `AUTH_ALLOWLIST` is sent back to `/login` with an allowlist message.

### Hosted limits to know

- On Vercel, Gmail attachments and **uploads persist in Neon** (not serverless disk) and show on the job card via `/api/photos/…`. Local demo still uses `public/uploads/` plus the repo demo SVGs. A later blob store is optional if photos get large.
- Daily automations are in `vercel.json` (Adelaide morning via 22:30 UTC). After deploy, Vercel → Project → **Cron Jobs** should list `/api/inbox/sync` and `/api/automations/run`. If those URLs return 401, `CRON_SECRET` is missing or does not match `AUTOMATIONS_SECRET`. Settings → **Run automations now** still works while you are signed in.

A small always-on VPS (SQLite on disk) also works: set the same env vars, `AUTH_URL` to that origin, and add the Google redirect URI.

## Stack

Next.js App Router, TypeScript, Tailwind, Prisma (SQLite locally, Postgres on Vercel), Auth.js (Google Sign-In + Gmail/Calendar).
