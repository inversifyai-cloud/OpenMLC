import { db } from "@/lib/db";
import { getPriceForModel, computeCostUsd } from "@/lib/providers/pricing";

export interface RecordUsageOptions {
  profileId: string;
  providerId: string;
  modelId: string;
  providerModelId: string;
  inputTokens: number;
  outputTokens: number;
  /** If provided, Message.costUsd will be updated. */
  messageId?: string;
}

/**
 * Computes cost for a completed inference call, optionally stamps the Message
 * row with costUsd, and upserts the UsageDaily rollup row for today.
 */
export async function recordUsage(opts: RecordUsageOptions): Promise<void> {
  const { profileId, providerId, modelId, providerModelId, inputTokens, outputTokens, messageId } = opts;

  const pricing = getPriceForModel(providerId, providerModelId);
  const costUsd = computeCostUsd(pricing, inputTokens, outputTokens);

  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  await Promise.all([
    // Stamp message cost if we have a message ID
    messageId
      ? db.message.update({
          where: { id: messageId },
          data: { costUsd },
        })
      : Promise.resolve(),

    // Upsert daily rollup
    db.usageDaily.upsert({
      where: { profileId_providerId_modelId_day: { profileId, providerId, modelId, day } },
      create: {
        profileId,
        providerId,
        modelId,
        day,
        inputTokens,
        outputTokens,
        costUsd,
        requestCount: 1,
      },
      update: {
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
        costUsd: { increment: costUsd },
        requestCount: { increment: 1 },
      },
    }),
  ]);
}
