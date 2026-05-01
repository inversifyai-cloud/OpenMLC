import { isAvailable, getStatus } from "@/lib/computer/client";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  const url = settings.computerAgentUrl ?? process.env.OPENMLC_COMPUTER_URL ?? undefined;
  if (!url) {
    return Response.json({ available: false, configured: false });
  }
  const reachable = await isAvailable(url);
  if (!reachable) {
    return Response.json({ available: false, configured: true, url });
  }
  try {
    const status = await getStatus(settings.computerAgentToken ?? undefined, url);
    return Response.json({ available: true, configured: true, url, ...status });
  } catch {
    return Response.json({ available: true, configured: true, url });
  }
}
