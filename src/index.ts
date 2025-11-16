import { CliRenderer, createCliRenderer } from "@opentui/core";

import { setupKeybinds } from "./keybinds.ts";
import { LattePalette } from "./palette.ts";
import { PaneLayout } from "./window/pane.ts";

/**
 * Add components to the renderer
 */
export function run(renderer: CliRenderer) {
  renderer.setBackgroundColor(LattePalette.base);

  const panes = new PaneLayout(renderer, renderer.width, renderer.height);
  panes.render();

  renderer.on("resize", () => {
    panes.width = renderer.width;
    panes.height = renderer.height;
    panes.render();
  });
}

/**
 * Start TUI
 */
if (import.meta.main) {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 30,
  });
  run(renderer);
  setupKeybinds(renderer);
  console.log(`Terminal size: ${renderer.width}x${renderer.height}`);
}
