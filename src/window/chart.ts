import { CliRenderer, FrameBufferRenderable, RGBA } from "@opentui/core";

import { Pane } from "./base.ts";

import { LattePalette } from "../palette.ts";

export class ChartPane extends Pane {
  private keybinds: ((key: any) => void) | null = null;

  private canvas: FrameBufferRenderable | null = null;

  constructor(renderer: CliRenderer, id: string, active: boolean = false) {
    super(renderer, id, active);

    this.createChart();
  }

  override get type(): string {
    return "chart";
  }

  public createChart(): void {
    if (this.canvas) return;

    // We must have box dimensions set before creating the canvas
    this.canvas = new FrameBufferRenderable(this.renderer, {
      id: `${this.id}-canvas`,
      visible: false,
      zIndex: this.box.zIndex + 1,
      position: "absolute",
      left: 2,
      top: 2,
      width: 10,
      height: 10,
    });
    this.canvas.frameBuffer.fillRect(
      0,
      0,
      this.canvas.width,
      this.canvas.height,
      RGBA.fromHex(LattePalette.green),
    );
    this.box.add(this.canvas);
  }

  override draw(rect: {
    top: number;
    left: number;
    width: number;
    height: number;
  }): void {
    super.draw(rect);

    if (this.canvas) {
      this.canvas.visible = true;
      this.canvas.top = 2;
      this.canvas.left = 2;
      this.canvas.width = rect.width - 8;
      this.canvas.height = rect.height - 4;
    }
  }

  destroy(): void {
    if (this.canvas) {
      this.box.destroy();
      this.canvas.destroy();
      this.canvas = null;
    }
  }
}
