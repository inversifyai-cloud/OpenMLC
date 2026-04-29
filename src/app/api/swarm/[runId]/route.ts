import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getBus } from "@/lib/swarm/stream-bus";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const session = await getSession();
  if (!session.profileId)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const { runId } = await params;

  const run = await db.swarmRun.findUnique({
    where: { id: runId },
    include: {
      agents: { orderBy: { startedAt: "asc" } },
    },
  });
  if (!run || run.profileId !== session.profileId) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get("stream") === "1") {
    const bus = getBus(runId);
    if (!bus || bus.isClosed()) {

      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          c.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }
    return new Response(bus.toReadableStream(), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  }

  let plan: unknown = null;
  try {
    if (run.plan) plan = JSON.parse(run.plan);
  } catch {}

  return Response.json({
    run: {
      id: run.id,
      prompt: run.prompt,
      status: run.status,
      plan,
      finalOutput: run.finalOutput,
      error: run.error,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    },
    agents: run.agents.map((a) => ({
      id: a.id,
      role: a.role,
      modelId: a.modelId,
      providerId: a.providerId,
      task: a.task,
      status: a.status,
      output: a.output,
      reasoning: a.reasoning,
      inputTokens: a.inputTokens,
      outputTokens: a.outputTokens,
      startedAt: a.startedAt,
      completedAt: a.completedAt,
    })),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const session = await getSession();
  if (!session.profileId)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const { runId } = await params;

  const run = await db.swarmRun.findUnique({ where: { id: runId } });
  if (!run || run.profileId !== session.profileId) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  if (
    run.status === "running" ||
    run.status === "planning" ||
    run.status === "synthesizing"
  ) {
    return Response.json({ error: "run in progress" }, { status: 409 });
  }
  await db.swarmRun.delete({ where: { id: runId } });
  return Response.json({ ok: true });
}
