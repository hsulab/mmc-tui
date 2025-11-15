import { CliRenderer, KeyEvent } from "@opentui/core";

export function setupKeybinds(renderer: CliRenderer) {
  renderer.keyInput.on("keypress", (key: KeyEvent) => {
    if (key.name === "q" && key.ctrl) {
      renderer.destroy();
    }
  });
}
