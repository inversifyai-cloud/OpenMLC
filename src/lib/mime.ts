

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/bmp",
]);

export function isImage(mimeType: string): boolean {
  return IMAGE_TYPES.has(mimeType);
}

export function isText(mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/javascript" ||
    mimeType === "application/x-python" ||
    mimeType === "application/x-sh" ||
    mimeType === "application/xml"
  );
}

export function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}
