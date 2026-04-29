import { getSession } from "@/lib/session";
import { resolveProviderKey } from "@/lib/providers/resolve-key";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const resolved = await resolveProviderKey(session.profileId, "openai");
  if (!resolved) {
    return Response.json({ error: "No OpenAI API key configured" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "Missing audio file" }, { status: 400 });
  }

  const whisperForm = new FormData();
  whisperForm.append("file", file, "audio.webm");
  whisperForm.append("model", "whisper-1");

  const upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolved.key}`,
    },
    body: whisperForm,
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return Response.json({ error: `Whisper error: ${err}` }, { status: upstream.status });
  }

  const data = await upstream.json() as { text: string };
  return Response.json({ text: data.text });
}
