import { detectPlatform } from "./detect.js";

const platform = detectPlatform();

let impl: typeof import("./macos.js");

if (platform === "macos") {
  impl = await import("./macos.js");
} else if (platform === "linux") {
  impl = await import("./linux.js") as any;
} else {
  throw new Error("Unsupported platform: " + process.platform);
}

export const {
  screenshot,
  mouseClick,
  mouseDoubleClick,
  mouseMove,
  mouseScroll,
  mouseDrag,
  keyboardType,
  keyboardKey,
  clipboardRead,
  clipboardWrite,
  launchApp,
  listWindows,
  focusWindow,
} = impl;
