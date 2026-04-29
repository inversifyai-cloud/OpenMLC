import { db } from "@/lib/db";
import { CronExpressionParser } from "cron-parser";

async function runScheduledChat(payload: Record<string, unknown>, runId: string): Promise<void> {
  console.log("[scheduler] would dispatch chat:", JSON.stringify(payload), "runId:", runId);
  await db.workflowRun.update({
    where: { id: runId },
    data: {
      status: "completed",
      output: JSON.stringify({ message: "stub: chat dispatch logged", payload }),
      completedAt: new Date(),
    },
  });
}

async function runScheduledSwarm(payload: Record<string, unknown>, runId: string): Promise<void> {
  console.log("[scheduler] would dispatch swarm:", JSON.stringify(payload), "runId:", runId);
  await db.workflowRun.update({
    where: { id: runId },
    data: {
      status: "completed",
      output: JSON.stringify({ message: "stub: swarm dispatch logged", payload }),
      completedAt: new Date(),
    },
  });
}

async function tick() {
  const now = new Date();
  try {
    const due = await db.schedule.findMany({
      where: {
        enabled: true,
        OR: [
          { nextRunAt: null },
          { nextRunAt: { lte: now } },
        ],
      },
    });

    for (const schedule of due) {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(schedule.payload) as Record<string, unknown>;
      } catch {
        payload = {};
      }

      const run = await db.workflowRun.create({
        data: {
          profileId: schedule.profileId,
          scheduleId: schedule.id,
          status: "running",
          startedAt: now,
        },
      });

      let nextRunAt: Date | null = null;
      try {
        const interval = CronExpressionParser.parse(schedule.cron, { currentDate: now });
        nextRunAt = interval.next().toDate();
      } catch (e) {
        console.error("[scheduler] invalid cron for schedule", schedule.id, e);
      }

      try {
        if (schedule.kind === "swarm") {
          await runScheduledSwarm(payload, run.id);
        } else {
          await runScheduledChat(payload, run.id);
        }

        await db.schedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: now,
            lastRunStatus: "completed",
            nextRunAt,
          },
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await db.workflowRun.update({
          where: { id: run.id },
          data: {
            status: "failed",
            error: errorMsg,
            completedAt: new Date(),
          },
        });
        await db.schedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: now,
            lastRunStatus: "failed",
            nextRunAt,
          },
        });
      }
    }
  } catch (err) {
    console.error("[scheduler] tick error:", err);
  }
}

export function startScheduler() {
  console.log("[scheduler] starting — 30s interval");

  setTimeout(() => { void tick(); }, 5000);
  setInterval(() => { void tick(); }, 30_000);
}
