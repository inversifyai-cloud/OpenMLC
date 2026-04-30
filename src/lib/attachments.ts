import { readFile } from "fs/promises";
import { join } from "path";
import { isText } from "@/lib/mime";
export { isImage, isText, isPdf } from "@/lib/mime";

function safePath(filePath: string): string {
  const norm = filePath.replace(/\\/g, "/");
  if (norm.includes("..") || !norm.startsWith("uploads/")) {
    throw new Error("invalid file path");
  }
  return join(process.cwd(), norm);
}

export async function extractText(
  filePath: string,
  mimeType: string
): Promise<string | null> {
  const fullPath = safePath(filePath);
  try {
    if (mimeType === "application/pdf") {
      const { PDFParse } = require("pdf-parse") as {
        PDFParse: new (opts: { data: Buffer | Uint8Array }) => {
          getText: () => Promise<{ text: string }>;
        };
      };
      const buf = await readFile(fullPath);
      const parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      return result.text?.slice(0, 50_000) ?? null;
    }
    if (isText(mimeType) || mimeType === "application/octet-stream" || mimeType.startsWith("application/")) {
      const content = await readFile(fullPath, "utf-8");
      return content.slice(0, 50_000);
    }
    return null;
  } catch (err) {
    console.error("[attachments] extractText failed", err);
    return null;
  }
}

export async function imageToBuffer(filePath: string): Promise<Uint8Array> {
  const fullPath = safePath(filePath);
  const buf = await readFile(fullPath);
  return new Uint8Array(buf);
}
