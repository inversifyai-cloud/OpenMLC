import { db } from "@/lib/db";
import { getPriceForModel, computeCostUsd } from "@/lib/providers/pricing";

export interface RecordUsageOptions {
  profileId: string;
  providerId: string;
  modelId: string;
  providerModelId: string;
  inputTokens: number;
  outputTokens: number;

  messageId?: string;
}

export async function recordUsage(opts: RecordUsageOptions): Promise<void> {
  const { profileId, providerId, modelId, providerModelId, inputTokens, outputTokens, messageId } = opts;

  const pricing = getPriceForModel(providerId, providerModelId);
  const costUsd = computeCostUsd(pricing, inputTokens, outputTokens);

  const day = new Date().toISOString().slice(0, 10);

  await Promise.all([

    messageId
      ? db.message.update({
          where: { id: messageId },
          data: { costUsd },
        })
      : Promise.resolve(),

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
