import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { encrypt, decrypt, isByokAvailable } from "@/lib/encryption";

const PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "xai",
  "fireworks",
  "openrouter",
  "ollama",
] as const;

const ENV_VAR: Record<(typeof PROVIDERS)[number], string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  xai: "XAI_API_KEY",
  fireworks: "FIREWORKS_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  ollama: "",
};

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 12) return "•".repeat(key.length);
  return `${key.slice(0, 6)}${"•".repeat(8)}${key.slice(-4)}`;
}

function envHas(provider: (typeof PROVIDERS)[number]): boolean {
  if (provider === "ollama") {
    return Boolean(process.env.OLLAMA_BASE_URL);
  }
  const v = process.env[ENV_VAR[provider]];
  if (!v) return false;
  return v.replace(/^"+|"+$/g, "").trim().length > 0;
}

export async function GET() {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db.profileApiKey.findMany({
    where: { profileId: session.profileId },
    select: { provider: true, encryptedKey: true, baseUrl: true, createdAt: true },
  });
  const byProvider = new Map(rows.map((r) => [r.provider, r] as const));

  const items = PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    let masked: string | null = null;
    if (row && isByokAvailable()) {
      try {
        masked = maskKey(decrypt(row.encryptedKey));
      } catch {
        masked = "•••••";
      }
    }
    const envFallback = envHas(provider);
    return {
      provider,
      hasKey: Boolean(row),
      masked,
      baseUrl: row?.baseUrl ?? null,
      envFallback,
      source: row ? "byok" : envFallback ? "env" : null,
      createdAt: row?.createdAt?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ items, byokAvailable: isByokAvailable() });
}

const upsertSchema = z.object({
  provider: z.enum(PROVIDERS),
  key: z.string().max(2000).optional(),
  baseUrl: z.string().url().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isByokAvailable()) {
    return NextResponse.json(
      { error: "byok_unavailable", message: "ENCRYPTION_KEY is not configured" },
      { status: 503 }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = upsertSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });

  const { provider, key, baseUrl } = parsed.data;

  if (provider !== "ollama" && (!key || key.trim().length < 4)) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }

  const encryptedKey = encrypt(key && key.trim().length > 0 ? key.trim() : "ollama-no-key");

  const row = await db.profileApiKey.upsert({
    where: { profileId_provider: { profileId: session.profileId, provider } },
    update: { encryptedKey, baseUrl: baseUrl ?? null },
    create: {
      profileId: session.profileId,
      provider,
      encryptedKey,
      baseUrl: baseUrl ?? null,
    },
    select: { provider: true, baseUrl: true, createdAt: true },
  });
  return NextResponse.json({ ok: true, item: row });
}
