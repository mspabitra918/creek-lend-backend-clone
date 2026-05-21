import "dotenv/config";

import { Worker, type Job } from "bullmq";
import { getRedisConnection } from "./queue/connection";
import { DRIP_QUEUE_NAME, DRIP_ACTIVE_STATUS } from "./queue/dripConfig";
import type { DripJobData } from "./queue/dripQueue";
import { getApplicationById } from "./services/applicationService";
import { sendDripEmail } from "./services/dripEmailService";
import { recordDripSent, hasDripBeenSent } from "./services/dripLogService";

/**
 * Always-on BullMQ worker for the bank-verification drip sequence.
 *
 * Deploy this as a separate long-running process (e.g. on the Hostinger VPS):
 *   npm run build && npm run worker
 * It must NOT run inside the Vercel serverless app — serverless functions are
 * frozen between requests and cannot host a worker.
 *
 * The two safeguards from the spec are enforced here, not just by job removal:
 *   - Instant kill-switch: every job re-reads the live loan status and refuses
 *     to send unless it is still `bank_verification_pending`.
 *   - Overlap guard: the "next day" delays are computed against the Eastern
 *     calendar in dripConfig, so a 6 AM lead never gets the next-day email today.
 */
async function processDripJob(job: Job<DripJobData>): Promise<void> {
  const { applicationId, emailNumber } = job.data;

  const application = await getApplicationById(applicationId);
  if (!application) {
    console.log(`[drip] application ${applicationId} no longer exists — skipping email ${emailNumber}`);
    return;
  }

  // KILL-SWITCH: only send while the application is still awaiting verification.
  if (application.status !== DRIP_ACTIVE_STATUS) {
    console.log(
      `[drip] application ${applicationId} is now "${application.status}" — skipping email ${emailNumber}`,
    );
    return;
  }

  // Idempotency: never send the same numbered email twice.
  if (await hasDripBeenSent(applicationId, emailNumber)) {
    console.log(`[drip] email ${emailNumber} already sent for ${applicationId} — skipping`);
    return;
  }

  await sendDripEmail(emailNumber, {
    applicationId: application.id,
    firstName: application.first_name,
    email: application.email,
    loanAmount: Number(application.loan_amount),
  });

  await recordDripSent(applicationId, emailNumber, application.status);
  console.log(`[drip] sent email ${emailNumber} to ${application.email} (application ${applicationId})`);
}

const worker = new Worker<DripJobData>(DRIP_QUEUE_NAME, processDripJob, {
  connection: getRedisConnection(),
  concurrency: 5,
});

worker.on("ready", () => {
  console.log(`[drip] worker ready — listening on queue "${DRIP_QUEUE_NAME}"`);
});

worker.on("failed", (job, err) => {
  console.error(`[drip] job ${job?.id} failed:`, err.message);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[drip] received ${signal}, closing worker...`);
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
