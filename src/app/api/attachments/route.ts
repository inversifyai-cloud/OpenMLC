import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { extractText, isImage } from "@/lib/attachments";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_TYPES = new Set([
  // images
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/bmp",
  // documents
  "application/pdf",
  // text / code
  "text/plain", "text/markdown", "text/html", "text/csv",
  "text/javascript", "text/typescript", "application/json",
  "application/javascript",
]);

function mkFileId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
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
    return Response.json({ error: "file too large (max 20 MB)" }, { status: 413 });
  }

  const filename = (file as File).name ?? "upload";
  const mimeType = file.type || "application/octet-stream";

  if (!ALLOWED_TYPES.has(mimeType) && !mimeType.startsWith("text/")) {
    return Response.json({ error: "unsupported file type" }, { status: 415 });
  }

  const ext = extname(filename) || "";
  const fileId = mkFileId();
  const storedName = `${fileId}${ext}`;
  const relPath = `uploads/${profileId}/${storedName}`;
  const dir = join(process.cwd(), "uploads", profileId);

  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(process.cwd(), relPath), buf);

  let extractedText: string | null = null;
  if (!isImage(mimeType)) {
    extractedText = await extractText(relPath, mimeType);
  }

  const attachment = await db.attachment.create({
    data: { profileId, filename, mimeType, size: file.size, path: relPath, extractedText },
  });

  return Response.json({
    id: attachment.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
  });
}
