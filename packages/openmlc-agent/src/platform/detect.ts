export type Platform = "macos" | "linux" | "unsupported";

export function detectPlatform(): Platform {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "linux") return "linux";
  return "unsupported";
}
