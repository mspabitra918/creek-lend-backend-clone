# Bank-Verification Drip Email Sequence

An 8-email reminder sequence that runs **only while a loan application is in
`bank_verification_pending`**. Built on [BullMQ](https://docs.bullmq.io/) +
Redis. The API (Vercel) enqueues/cancels jobs; an always-on **worker** on the
VPS sends the emails.

## Timeline

All times are measured from lead submission. Emails 6–8 anchor to **9:00 AM US
Eastern** on the following calendar days.

| Email | When | Purpose |
|------:|------|---------|
| 1 | immediately (T+0) | Kickoff — verify to unlock loan details |
| 2 | T + 30m | 30-minute nudge |
| 3 | T + 90m (+60m after E2) | Assistance offer |
| 4 | T + 3.5h (+120m after E3) | Urgency check |
| 5 | T + 7.5h (+240m after E4; ~1:30 PM for a 6 AM lead) | Daily wrap-up |
| 6 | next calendar day, 9:00 AM ET | "Next day" morning follow-up |
| 7 | day +2, 9:00 AM ET (24h after E6) | Second-day follow-up |
| 8 | day +3, 9:00 AM ET (24h after E7) | Final notice |

Edit the schedule in [`src/queue/dripConfig.ts`](src/queue/dripConfig.ts) and the
copy in [`src/services/dripEmailService.ts`](src/services/dripEmailService.ts).

## Safeguards

- **Instant kill-switch.** When an application leaves `bank_verification_pending`
  (e.g. moves to `bank_verification_in_progress` / `deposit_in_progress`),
  `cancelDripSequence()` removes all pending jobs. As a backstop, the worker
  re-reads the live status before every send and refuses to send if it is no
  longer pending — so even a job that was already running mid-flight won't spam.
- **Overlap guard for "next day".** Emails 6–8 compute their delay against the
  Eastern calendar, so a 6 AM lead never receives the next-day email on the same
  day.
- **Idempotency.** Each send is recorded in `drip_email_log` with a
  `UNIQUE(application_id, email_number)` constraint, so an email is sent at most
  once even if a job retries.
- **One-click links.** CTAs use the existing `?applicationId=` deep link to
  `/verify-bank` (no password needed).

## Setup

1. **Redis (Upstash).** Create an Upstash Redis database and copy its `rediss://`
   (TLS) URL. Set `REDIS_URL` on **both** the Vercel project and the VPS.
   > BullMQ polls Redis continuously. Upstash's free tier has a daily command
   > limit you will likely exceed in production — use a paid plan for live load.
2. **Database.** Run `npm run db:init` (or apply `src/schema.sql`) to create the
   `drip_email_log` table.
3. **Worker (VPS).** The worker must run as a persistent process — it cannot live
   inside the Vercel serverless app. On the Hostinger VPS:
   ```bash
   npm ci
   npm run build
   npm run worker          # or: pm2 start dist/worker.js --name creeklend-drip
   ```
   The worker needs the same env as the API: `REDIS_URL`, `DATABASE_URL`,
   `MAILGUN_*`, `FRONTEND_URL`, `ENCRYPTION_KEY`.

## How it wires together

- `POST /api/apply` → `enqueueDripSequence(applicationId, now)` schedules 8
  delayed jobs (deterministic job ids `drip:<appId>:<n>`).
- `updateApplicationStatus()` / `markBankVerificationCompleted()` →
  `cancelDripSequence(applicationId)` on any non-pending status.
- Worker (`src/worker.ts`) processes each job: load app → status check → dedupe →
  send → log.
