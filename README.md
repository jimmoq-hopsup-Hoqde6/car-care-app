# Mobile Car Scratch Repair Adelaide — Job desk

A local web app for **Marcel Kuhn** to turn quote requests into drafts and bookings.

It does **not** invent prices. You type the figure. It does **not** email customers unless you tap **Send**. The usual path is: write quote → save Gmail draft → pick a free calendar slot → save a confirmation draft.

Timezone: **Australia/Adelaide**  
From address: **Info@mobilecarscratchrepairadelaide.com.au**

## What you can do

- **Job board** — Needs quote, Awaiting customer, Ready to book, Booked, Done
- **Inbox triage** — quote requests, website form leads, booking replies; marketing such as Manheim is ignored
- **Quote composer** — you enter the price; the email matches your usual wording (colour-matching, onsite inspection, lifetime guarantee, site requirements)
- **Booking picker** — next 14 weekdays, default 8:00 am–4:00 pm, 3-hour jobs; creates a Calendar event and a confirmation draft

Sample jobs load automatically: **Jenny Gwynne (BMW bumper, Crafers)**, **Nathan Crowe (Outlander, Unley)**, **John Hale (Honda CR-V, Glenelg)**.

## Run it on your computer (demo, no Google)

1. Install [Node.js 20 or newer](https://nodejs.org/) (the LTS version is fine).
2. Open a terminal in this folder.
3. Install and start:

```bash
npm install
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000).

The first start creates a local `.env` (no secrets) and a SQLite file with the three sample jobs. You can write quotes and “book” slots in demo mode. Nothing is emailed and nothing is written to Google until you connect OAuth.

Useful extras:

```bash
npm run setup     # rebuild the local database and sample jobs
npm run db:seed   # put the sample jobs back if you deleted them
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

## Quote wording

The composer always uses this shape:

- Thanks for getting in touch and sharing images
- Bullet list of repair items
- Estimated total: $X.XX (the number **you** typed)
- Digital colour-matching
- Onsite inspection confirms the final price if more work is needed
- Lifetime workmanship guarantee
- Ask for preferred repair dates
- Off-street location, power point, natural light
- Kind regards, Marcel Kuhn, Mobile Car Scratch Repair Adelaide

## Settings you can change in the app

- Weekdays and hours (default Monday–Friday 8:00–16:00 Adelaide)
- Job length (default 3 hours)
- Optional price bands (minor scratch / bumper / multi-panel) — only used if **you** store a rate

## Deploy later

Any Node host works (Vercel, a small VPS). Use the same env vars, point `AUTH_URL` at the live site, and add that origin plus `/api/auth/callback/google` to the Google client. For a hosted database you can switch Prisma from SQLite to Postgres later.

## Stack

Next.js App Router, TypeScript, Tailwind, Prisma, SQLite, Auth.js (Google OAuth).
