import { createCliRenderer } from "@opentui/core";

import { setupKeybinds } from "./keybind/keybinds.ts";
import { MMCTui } from "./app.ts";

/**
 * Start TUI
 */
if (import.meta.main) {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 30,
    useKittyKeyboard: true,
  });
  new MMCTui(renderer);
  setupKeybinds(renderer);
  renderer.start();
}
