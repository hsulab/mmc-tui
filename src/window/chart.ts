import {
  CliRenderer,
  FrameBufferRenderable,
  OptimizedBuffer,
  RGBA,
} from "@opentui/core";

import { Pane, type Rect } from "./base.ts";

import { LattePalette } from "../palette.ts";

import { ChartCanvasFrameBuffer } from "../chart/canvas.ts";

export class ChartPane extends Pane {
  private keybinds: ((key: any) => void) | null = null;

  private canvas: ChartCanvasFrameBuffer | null = null;
  private preferBraille: boolean = false;

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
      {
        id: `chart-canvas-${this.id}`,
        width: this.rect.width - 8,
        height: this.rect.height - 4,
        useBraille: this.preferBraille,
      },
      RGBA.fromHex(LattePalette.surface0),
    );
    this.canvas.top = 0;
    this.canvas.left = 0;
    this.canvas.width = this.rect.width - 2;
    this.canvas.height = this.rect.height - 2;
    this.canvas.setPlotFunction((x: number) => x * x + x, {
      xMin: -1,
      xMax: 1,
      backgroundColor: RGBA.fromHex(LattePalette.surface0),
      color: RGBA.fromHex(LattePalette.red),
    });
    this.box!.add(this.canvas);
  }

  override draw(): void {
    super.draw();
    console.log();
    console.log(`${this.canvas}`);

    const { width, height } = this.rect;

    this.canvas!.top = 0;
    this.canvas!.left = 0;
    this.canvas!.width = width - 2;
    this.canvas!.height = height - 2;

    this.canvas!.renderPlot();

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
        case "b":
          if (key.ctrl) {
            this.preferBraille = !this.preferBraille;
            this.canvas?.setUseBraille(this.preferBraille);
            console.log(
              `Chart ${this.id} now using ${
                this.preferBraille ? "braille" : "block"
              } rendering`,
            );
          }
          break;
        case "=": // Zoom in
          this.canvas?.zoomIn();
          console.log(`Zooming in Chart ${this.id}`);
          break;
        case "-": // Zoom out
          this.canvas?.zoomOut();
          console.log(`Zooming out Chart ${this.id}`);
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

  override destroy(): void {
    if (this.canvas) {
      this.renderer.root.remove(this.canvas.id);
      this.canvas = null;
    }
    if (this.keybinds) {
      this.renderer.keyInput.off("keypress", this.keybinds);
      this.keybinds = null;
    }
    super.destroy(); // destroy pane box
  }
}
