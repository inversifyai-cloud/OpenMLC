import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { resolveProviderKey } from "@/lib/providers/resolve-key";

function ollamaRoot(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "");
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { model?: string };
  const model = body.model?.trim();
  if (!model) {
    return NextResponse.json({ error: "model required" }, { status: 400 });
  }

  const resolved = await resolveProviderKey(session.profileId, "ollama");
  if (!resolved?.baseUrl) {
    return NextResponse.json({ error: "ollama not configured" }, { status: 400 });
  }

  const root = ollamaRoot(resolved.baseUrl);

  try {
    const res = await fetch(`${root}/api/delete`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: text || `HTTP ${res.status}` }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `ollama unreachable: ${e instanceof Error ? e.message : e}` }, { status: 502 });
  }
}
