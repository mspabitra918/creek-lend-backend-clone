import { Queue } from "bullmq";
import { getRedisConnection, isQueueEnabled } from "./connection";
import {
  DRIP_QUEUE_NAME,
  DRIP_STEPS,
  delayForStep,
  type DripStep,
} from "./dripConfig";

export interface DripJobData {
  applicationId: string;
  emailNumber: number;
}

let queue: Queue<DripJobData> | null = null;

export function getDripQueue(): Queue<DripJobData> {
  if (queue) return queue;
  queue = new Queue<DripJobData>(DRIP_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      // Keep history bounded so Redis doesn't grow unbounded on Upstash.
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 5000 },
      removeOnFail: { age: 14 * 24 * 60 * 60 },
    },
  });
  return queue;
}

/** Deterministic job id so a step is enqueued at most once and can be removed. */
function jobId(applicationId: string, emailNumber: number): string {
  return `drip:${applicationId}:${emailNumber}`;
}

/**
 * Schedules all 8 drip emails for a freshly-submitted application. Idempotent:
 * deterministic job ids mean re-enqueueing the same application is a no-op.
 * Never throws — a queue outage must not break loan submission.
 */
export async function enqueueDripSequence(
  applicationId: string,
  submittedAt: Date,
): Promise<void> {
  if (!isQueueEnabled()) {
    console.warn(
      `[drip] REDIS_URL not set — skipping drip enqueue for application ${applicationId}`,
    );
    return;
  }

  try {
    const q = getDripQueue();
    const now = new Date();

    await Promise.all(
      DRIP_STEPS.map((step: DripStep) =>
        q.add(
          `drip-email-${step.emailNumber}`,
          { applicationId, emailNumber: step.emailNumber },
          {
            jobId: jobId(applicationId, step.emailNumber),
            delay: delayForStep(step, submittedAt, now),
          },
        ),
      ),
    );

    console.log(`[drip] Enqueued ${DRIP_STEPS.length} emails for application ${applicationId}`);
  } catch (err) {
    console.error(`[drip] Failed to enqueue sequence for ${applicationId}:`, err);
  }
}

/**
 * Instant kill-switch: removes every pending drip job for an application. Called
 * the moment the application leaves `bank_verification_pending` so no further
 * reminders are sent. Never throws.
 */
export async function cancelDripSequence(applicationId: string): Promise<void> {
  if (!isQueueEnabled()) return;

  try {
    const q = getDripQueue();
    await Promise.all(
      DRIP_STEPS.map(async (step) => {
        try {
          // remove() clears delayed/waiting/completed/failed jobs. A job that is
          // actively running is locked and can't be removed — the worker's own
          // status re-check is the backstop that prevents it from sending.
          await q.remove(jobId(applicationId, step.emailNumber));
        } catch {
          /* job locked/active or already gone — ignore */
        }
      }),
    );
    console.log(`[drip] Cancelled drip sequence for application ${applicationId}`);
  } catch (err) {
    console.error(`[drip] Failed to cancel sequence for ${applicationId}:`, err);
  }
}
