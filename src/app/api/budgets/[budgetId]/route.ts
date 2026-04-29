import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ budgetId: string }> }
) {
  const session = await getSession();
  if (!session.profileId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { budgetId } = await params;

  const cap = await db.budgetCap.findUnique({ where: { id: budgetId } });
  if (!cap || cap.profileId !== session.profileId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await db.budgetCap.delete({ where: { id: budgetId } });
  return new NextResponse(null, { status: 204 });
}
