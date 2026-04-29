import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getCombinedCatalog } from "@/lib/providers/catalog";

export async function GET() {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const models = await getCombinedCatalog(session.profileId);
  return NextResponse.json({ models, count: models.length });
}
