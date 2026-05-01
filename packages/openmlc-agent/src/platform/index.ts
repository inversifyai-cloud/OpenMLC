import { detectPlatform } from "./detect.js";
import * as macos from "./macos.js";
import * as linux from "./linux.js";
import * as windows from "./windows.js";

const platform = detectPlatform();

const impl = platform === "macos" ? macos
           : platform === "linux" ? linux
           : platform === "windows" ? windows
           : null;

if (!impl) throw new Error("Unsupported platform: " + process.platform);

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
