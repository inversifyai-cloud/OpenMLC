import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { resolveProviderKey } from "@/lib/providers/resolve-key";
import { HUB_MODELS } from "@/lib/ollama/hub";

function ollamaRoot(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "");
}

export async function GET() {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resolved = await resolveProviderKey(session.profileId, "ollama");
  if (!resolved?.baseUrl) {
    return NextResponse.json({ reachable: false, installed: [], hub: HUB_MODELS });
  }

  const root = ollamaRoot(resolved.baseUrl);

  try {
    const res = await fetch(`${root}/api/tags`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: Array<{ name: string; size?: number }> };
    const installed: string[] = (data.models ?? []).map((m) => m.name);
    return NextResponse.json({ reachable: true, installed, hub: HUB_MODELS, ollamaUrl: root });
  } catch {
    return NextResponse.json({ reachable: false, installed: [], hub: HUB_MODELS });
  }
}
