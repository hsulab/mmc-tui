import {
  CliRenderer,
  FrameBufferRenderable,
  OptimizedBuffer,
  RGBA,
} from "@opentui/core";

import { Pane, type Rect } from "./base.ts";

import { LattePalette } from "../palette.ts";

class ChartCanvasFrameBuffer extends FrameBufferRenderable {
  constructor(renderer: CliRenderer, id: string) {
    super(renderer, {
      id,
      width: renderer.terminalWidth,
      height: renderer.terminalHeight,
      zIndex: 1,
    });
  }

  protected override renderSelf(buffer: OptimizedBuffer): void {
    this.frameBuffer.clear(RGBA.fromHex(LattePalette.green));

    // Test data points
    const x0 = 2,
      y0 = 4;
    const x1 = 3,
      y1 = 9;

    // Draw a simple line between two points (Bresenham's line algorithm)
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0;
    let y = y0;

    while (true) {
      this.frameBuffer.setCell(
        x,
        y,
        "•",
        RGBA.fromHex(LattePalette.peach),
        RGBA.fromHex(LattePalette.green),
      );

      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    // Final rendering
    super.renderSelf(buffer);
  }
}

export class ChartPane extends Pane {
  private keybinds: ((key: any) => void) | null = null;

  private canvas: FrameBufferRenderable | null = null;

  constructor(
    renderer: CliRenderer,
    id: string,
    active: boolean = false,
    rect: Rect,
  ) {
    super(renderer, id, active, rect);

    this.createChart();
  }

  override get type(): string {
    return "chart";
  }

  public createChart(): void {
    if (this.canvas) return;

    this.canvas = new ChartCanvasFrameBuffer(
      this.renderer,
      `chart-canvas-${this.id}`,
    );
    this.canvas.top = 2;
    this.canvas.left = 2;
    this.canvas.width = this.rect.width - 8;
    this.canvas.height = this.rect.height - 4;
    this.box!.add(this.canvas);
  }

  override draw(): void {
    super.draw();
    console.log();
    console.log(`${this.canvas}`);

    const { width, height } = this.rect;

    this.canvas!.top = 2;
    this.canvas!.left = 2;
    this.canvas!.width = width - 8;
    this.canvas!.height = height - 4;

    this.setupKeybinds(this.renderer);
  }

  public setupKeybinds(renderer: CliRenderer): void {
    if (this.keybinds) return;

    this.keybinds = (key: any) => {
      if (!this.active) return;

      // Example keybinds for demonstration
      switch (key.name) {
        case "x":
          if (key.ctrl) {
            console.log(`Ctrl+X pressed in Chart ${this.id}`);
          }
          break;
        case "n": // Create new chart element
          this.createChart();
          console.log(`Creating new chart element in Chart ${this.id}`);
          break;
        default:
          break;
      }
    };

    renderer.keyInput.on("keypress", this.keybinds);
  }

  destroy(): void {
    if (this.box) {
      this.box.destroy();
      this.renderer.root.remove(this.box.id);
    }
    if (this.canvas) {
      this.renderer.root.remove(this.canvas.id);
      this.canvas = null;
    }
    if (this.keybinds) {
      this.renderer.keyInput.off("keypress", this.keybinds);
      this.keybinds = null;
    }
  }
}
