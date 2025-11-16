import { FrameBufferRenderable, CliRenderer, RGBA } from "@opentui/core";

import { LattePalette } from "./palette.ts";

export function addScatterPlot(renderer: CliRenderer) {
  const canvas = new FrameBufferRenderable(renderer, {
    id: "canvas",
    zIndex: 1001,
    position: "absolute",
    left: 5,
    top: 5,
    width: 5,
    height: 2,
  });

  canvas.frameBuffer.fillRect(0, 0, 5, 2, RGBA.fromHex(LattePalette.overlay0));
  canvas.frameBuffer.setCell(
    0,
    0,
    "⋅", // unicode
    RGBA.fromHex(LattePalette.lavender),
    RGBA.fromHex(LattePalette.mantle),
  );
  renderer.root.add(canvas);
}
