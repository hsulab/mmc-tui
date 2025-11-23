import { CliRenderer, createCliRenderer } from "@opentui/core";

import { LattePalette } from "./palette.ts";
import { MainMenu } from "./menu.ts";
import { PaneLayout } from "./window/pane.ts";
import { setupKeybinds } from "./keybind/keybinds.ts";
import { setupPaneKeybinds } from "./keybind/pane.ts";

type AppState = {
  isMainMenuOpen: boolean;
};

/**
 * Add components to the renderer
 */
export function run(renderer: CliRenderer) {
  renderer.setBackgroundColor(LattePalette.base);

  let appState: AppState = {
    isMainMenuOpen: true,
  };

  // Set up main menu
  // mainMenuRenderer(renderer);
  const mainMenu = new MainMenu(renderer, appState);
  mainMenu.render();

  console.log(`${mainMenu.appState.isMainMenuOpen}`);
  if (mainMenu.appState.isMainMenuOpen === false) {
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
  renderer.start();
}
