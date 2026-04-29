import { writeFile, mkdir, unlink } from "fs/promises";
import { join, extname } from "path";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { extractText } from "@/lib/attachments";
import { triggerFileProcessing } from "@/lib/ai/knowledge-rag";

const MAX_SIZE = 20 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/pdf",
  "application/json",
  "text/javascript",
  "text/x-python",
  "text/x-typescript",
  "text/x-go",
  "text/x-rust",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function GET() {
  const session = await getSession();
  if (!session.profileId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await db.knowledgeFile.findMany({
    where: { profileId: session.profileId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      active: true,
      embeddingStatus: true,
      createdAt: true,
      _count: { select: { chunks: true } },
    },
  });

  const files = rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    mimeType: r.mimeType,
    size: r.size,
    active: r.active,
    embeddingStatus: r.embeddingStatus,
    createdAt: r.createdAt,
    chunkCount: r._count.chunks,
  }));

  return Response.json({ files });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.profileId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const profileId = session.profileId;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "no file" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: "file too large (max 20 mb)" }, { status: 413 });
  }

  const filename = (file as File).name ?? "upload";
  const mimeType = file.type || "application/octet-stream";

  if (!ALLOWED_TYPES.has(mimeType)) {
    return Response.json({ error: "unsupported file type" }, { status: 415 });
  }

  const created = await db.knowledgeFile.create({
    data: {
      profileId,
      filename,
      mimeType,
      size: file.size,
      path: "",
      embeddingStatus: "pending",
    },
    select: { id: true },
  });

  const ext = extname(filename) || "";
  const storedName = `${created.id}${ext}`;
  const relPath = `uploads/${profileId}/kb/${storedName}`;
  const dir = join(process.cwd(), "uploads", profileId, "kb");

  try {
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(join(process.cwd(), relPath), buf);
  } catch (err) {
    console.error("[kb] failed to write file", err);
    await db.knowledgeFile.delete({ where: { id: created.id } }).catch(() => {});
    return Response.json({ error: "failed to save file" }, { status: 500 });
  }

  const extractedText = await extractText(relPath, mimeType);
  if (!extractedText) {
    await db.knowledgeFile.delete({ where: { id: created.id } }).catch(() => {});
    await unlink(join(process.cwd(), relPath)).catch(() => {});
    return Response.json({ error: "could not extract text from file" }, { status: 400 });
  }

  const updated = await db.knowledgeFile.update({
    where: { id: created.id },
    data: { path: relPath, content: extractedText },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      embeddingStatus: true,
      createdAt: true,
    },
  });

  triggerFileProcessing(updated.id, profileId);

  return Response.json({ file: updated });
}
