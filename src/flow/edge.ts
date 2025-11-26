import {
  RGBA,
  CliRenderer,
  BoxRenderable,
  FrameBufferRenderable,
  OptimizedBuffer,
} from "@opentui/core";

import { LattePalette } from "../palette.ts";

export type NodeEdge = { from: BoxRenderable; to: BoxRenderable };

export class EdgeFrameBuffer extends FrameBufferRenderable {
  private readonly BACKGROUND_COLOR: RGBA;
  private readonly LINE_COLOR = RGBA.fromHex(LattePalette.subtext0);

  private linemarker?: string;

  constructor(
    renderer: CliRenderer,
    id: string,
    private readonly edgesProvider: () => NodeEdge[],
    backgroundColor: RGBA = RGBA.fromHex(LattePalette.base),
    linemarker?: string, // Default to directional arrows instead of "⋯", "⠒"
  ) {
    super(renderer, {
      id,
      width: renderer.terminalWidth,
      height: renderer.terminalHeight,
      zIndex: 90,
    });

    this.linemarker = linemarker;

    this.BACKGROUND_COLOR = backgroundColor;
  }

  protected override renderSelf(buffer: OptimizedBuffer): void {
    this.frameBuffer.clear(this.BACKGROUND_COLOR);

    for (const edge of this.edgesProvider()) {
      this.drawDottedLine(
        // minus two for border
        Math.round(edge.from.x + (edge.from.width - 2) / 2) - this.x,
        Math.round(edge.from.y + (edge.from.height - 2) / 2) - this.y,
        Math.round(edge.to.x + (edge.to.width - 2) / 2) - this.x,
        Math.round(edge.to.y + (edge.to.height - 2) / 2) - this.y,
      );
    }

    super.renderSelf(buffer);
  }

  private drawDottedLine(x0: number, y0: number, x1: number, y1: number) {
    let currentX = x0;
    let currentY = y0;

    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    let err = dx + dy;

    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;

    const lx = (x1 - x0) * sx;
    const ly = (y1 - y0) * sy;

    let drawDot = true;
    // console.log(`Drawing dotted line from (${x0}, ${y0}) to (${x1}, ${y1})`);

    while (true) {
      if (
        drawDot &&
        currentX >= 0 &&
        currentY >= 0 &&
        currentX < this.width &&
        currentY < this.height
      ) {
        this.frameBuffer.setCell(
          currentX,
          currentY,
          this.linemarker ?? this.getDirectionalMarker(lx, ly),
          this.LINE_COLOR,
          this.BACKGROUND_COLOR,
        );
      }

      if (currentX === x1 && currentY === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        currentX += sx;
      }
      if (e2 <= dx) {
        err += dx;
        currentY += sy;
      }

      drawDot = !drawDot;
    }
  }

  private getDirectionalMarker(stepX: number, stepY: number): string {
    if (stepX === 0 && stepY === 0) return "•";

    if (stepY === 0) {
      return stepX > 0 ? "→" : "←";
    }

    if (stepX === 0) {
      return stepY > 0 ? "↓" : "↑";
    }

    if (stepX > 0 && stepY > 0) return "↘";
    if (stepX > 0 && stepY < 0) return "↗";
    if (stepX < 0 && stepY > 0) return "↙";
    return "↖";
  }
}
