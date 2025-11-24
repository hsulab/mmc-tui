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
