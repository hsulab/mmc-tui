import { createCliRenderer } from "@opentui/core";

import { MMCTui } from "./app.ts";
import { addScatterPlot } from "./chart/scatter.ts";

/**
 * Start TUI
 */
if (import.meta.main) {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 30,
    useKittyKeyboard: true,
  });
  renderer.start();
  new MMCTui(renderer);
  addScatterPlot(renderer);
}
