import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { url?: string; token?: string };
  const rawUrl = body.url?.trim();
  const token = body.token?.trim();

  if (!rawUrl) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  // Normalize: strip trailing slash, append /v1 if not already present
  const base = rawUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  const modelsUrl = `${base}/v1/models`;

  const headers: Record<string, string> = { accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(modelsUrl, {
      headers,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `endpoint returned HTTP ${res.status}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      data?: Array<{ id: string; [k: string]: unknown }>;
    };

    const models = data.data ?? [];
    const firstModel = models[0];

    return NextResponse.json({
      ok: true,
      baseUrl: `${base}/v1`,
      modelId: firstModel?.id ?? null,
      models: models.map((m) => m.id),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `unreachable: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}
