import { db } from "@/lib/db";

export interface BudgetCheckResult {
  exceeded: boolean;
  capUsd?: number;
  currentUsd?: number;
}

/**
 * Checks whether the profile has exceeded a BudgetCap for the given provider.
 * Sums UsageDaily.costUsd over the cap's periodDays window and compares to capUsd.
 * Returns { exceeded: false } if no cap is configured.
 */
export async function checkBudget(
  profileId: string,
  providerId: string
): Promise<BudgetCheckResult> {
  const cap = await db.budgetCap.findUnique({
    where: { profileId_providerId: { profileId, providerId } },
  });

  if (!cap) return { exceeded: false };

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - cap.periodDays);
  const windowStartDay = windowStart.toISOString().slice(0, 10);

  const rows = await db.usageDaily.findMany({
    where: {
      profileId,
      providerId,
      day: { gte: windowStartDay },
    },
    select: { costUsd: true },
  });

  const currentUsd = rows.reduce((sum, r) => sum + r.costUsd, 0);

  return {
    exceeded: currentUsd >= cap.capUsd,
    capUsd: cap.capUsd,
    currentUsd,
  };
}
