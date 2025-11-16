import { CliRenderer, KeyEvent } from "@opentui/core";

export function setupKeybinds(renderer: CliRenderer) {
  renderer.keyInput.on("keypress", (key: KeyEvent) => {
    if (key.name === "`") {
      renderer.console.toggle();
    }
  });
}
