import {
  CliRenderer,
  ASCIIFont,
  Box,
  createCliRenderer,
  Text,
  TextAttributes,
} from "@opentui/core";

import { setupKeybinds } from "./keybinds.ts";

/**
 * Add components to the renderer
 */
export function run(renderer: CliRenderer) {
  renderer.root.add(
    Box(
      { alignItems: "center", justifyContent: "center", flexGrow: 1 },
      Box(
        { justifyContent: "center", alignItems: "flex-end" },
        ASCIIFont({ font: "tiny", text: "MMC-TUI" }),
        Text({
          content: "What will you build?",
          attributes: TextAttributes.DIM,
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
