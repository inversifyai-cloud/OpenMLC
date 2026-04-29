import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

// GET /api/attachments/[id] — serve the raw file (auth-gated)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session.profileId) return new Response(null, { status: 401 });

  const att = await db.attachment.findUnique({ where: { id } });
  if (!att || att.profileId !== session.profileId) {
    return new Response(null, { status: 404 });
  }

  try {
    const buf = await readFile(join(process.cwd(), att.path));
    return new Response(buf, {
      headers: {
        "Content-Type": att.mimeType,
        "Content-Disposition": `inline; filename="${att.filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

// DELETE /api/attachments/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session.profileId) return new Response(null, { status: 401 });

  const att = await db.attachment.findUnique({ where: { id } });
  if (!att || att.profileId !== session.profileId) {
    return new Response(null, { status: 404 });
  }

  await db.attachment.delete({ where: { id } });
  try {
    await unlink(join(process.cwd(), att.path));
  } catch {
    // file might already be gone
  }

  return new Response(null, { status: 204 });
}
