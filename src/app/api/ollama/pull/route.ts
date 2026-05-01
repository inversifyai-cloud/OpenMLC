import { getSession } from "@/lib/session";
import { resolveProviderKey } from "@/lib/providers/resolve-key";
import { NextResponse } from "next/server";

function ollamaRoot(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "");
}

export async function POST(req: Request) {
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

  let ollamaRes: Response;
  try {
    ollamaRes = await fetch(`${root}/api/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
    });
  } catch (e) {
    return NextResponse.json({ error: `ollama unreachable: ${e instanceof Error ? e.message : e}` }, { status: 502 });
  }

  if (!ollamaRes.ok || !ollamaRes.body) {
    return NextResponse.json({ error: `ollama pull failed: HTTP ${ollamaRes.status}` }, { status: 502 });
  }

  // Transform Ollama's newline-delimited JSON stream into SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const reader = ollamaRes.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            controller.enqueue(encoder.encode(`data: ${trimmed}\n\n`));
          }
        }
        if (buf.trim()) {
          controller.enqueue(encoder.encode(`data: ${buf.trim()}\n\n`));
        }
      } catch {
        // stream ended
      } finally {
        controller.enqueue(encoder.encode(`data: {"status":"done"}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
