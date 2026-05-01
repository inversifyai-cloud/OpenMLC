export type Platform = "macos" | "linux" | "windows" | "unsupported";

export function detectPlatform(): Platform {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "linux") return "linux";
  if (process.platform === "win32") return "windows";
  return "unsupported";
}
