import { isAvailable } from "@/lib/browser/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = process.env.OPENMLC_BROWSER_ENABLED === "true";
  if (!enabled) {
    return Response.json({ available: false, enabled: false });
  }
  const reachable = await isAvailable();
  return Response.json({ available: reachable, enabled: true });
}
