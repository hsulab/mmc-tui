import {
  CliRenderer,
  ASCIIFont,
  Box,
  createCliRenderer,
  Text,
  TextAttributes,
} from "@opentui/core";

import { setupKeybinds } from "./keybinds.ts";
import { LattePalette } from "./palette.ts";

/**
 * Main TUI rendering function
 */
export function createLayoutElements(renderer: CliRenderer): void {
  renderer.setBackgroundColor(LattePalette.base);
}

/**
 * Add components to the renderer
 */
export function run(renderer: CliRenderer) {
  createLayoutElements(renderer);
  renderer.root.add(
    Box(
      { alignItems: "center", justifyContent: "center", flexGrow: 1 },
      Box(
        { justifyContent: "center", alignItems: "flex-end" },
        ASCIIFont({ font: "tiny", text: "MMC-TUI", color: LattePalette.text }),
        Text({
          content: "What will you build?",
          attributes: TextAttributes.DIM,
          fg: LattePalette.text,
        }),
      ),
    ),
  );
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
}
