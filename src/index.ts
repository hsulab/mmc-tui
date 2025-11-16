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

  renderer.keyInput.on("keypress", (key) => {
    if (key.name === "v" && key.ctrl) {
      panes.splitActive("vertical");
    }
    if (key.name === "s" && key.ctrl) {
      panes.splitActive("horizontal");
    }
    if (key.name === "q" && key.ctrl) {
      let ids: string[] = [];
      ids = renderer.root.getChildren().map((child) => child.id);
      console.log("Before close:", ids);
      panes.closeActive();
      ids = renderer.root.getChildren().map((child) => child.id);
      console.log("After close:", ids);
    }
    if (key.name === "linefeed") {
      // crtl + j
      panes.moveActive("down");
    }
    if (key.name === "k" && key.ctrl) {
      panes.moveActive("up");
    }
    if (key.name === "backspace") {
      // ctrl + h
      panes.moveActive("left");
    }
    if (key.name === "l" && key.ctrl) {
      panes.moveActive("right");
    }
  });
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
  setupKeybinds(renderer);
}
