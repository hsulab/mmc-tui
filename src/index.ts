import { createCliRenderer } from "@opentui/core";

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
  renderer.start();
}
