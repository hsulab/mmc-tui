import { CliRenderer, createCliRenderer } from "@opentui/core";

import { LattePalette } from "./palette.ts";
import { PaneLayout } from "./window/pane.ts";
import { setupKeybinds } from "./keybind/keybinds.ts";
import { setupPaneKeybinds } from "./keybind/pane.ts";

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

  setupKeybinds(renderer);
  setupPaneKeybinds(renderer, panes);
}

/**
 * Start TUI
 */
if (import.meta.main) {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 30,
    useKittyKeyboard: true,
  });
  run(renderer);
}
