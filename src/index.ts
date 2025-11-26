import { createCliRenderer } from "@opentui/core";

import { MMCTui } from "./app.ts";

import { initializeConfig, getConfig } from "./config.ts";

/**
 * Start TUI
 */
if (import.meta.main) {
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 30,
    useKittyKeyboard: true,
  });

  await initializeConfig();

  console.log(`${JSON.stringify(getConfig())}`);
  console.log(`[config] Using backend URL: ${getConfig().backendUrl}`);

  new MMCTui(renderer);
  renderer.start();
}
