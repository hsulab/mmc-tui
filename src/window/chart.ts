import { CliRenderer, FrameBufferRenderable, RGBA } from "@opentui/core";

import { Pane, type Rect } from "./base.ts";

import { LattePalette } from "../palette.ts";

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

    // We must have box dimensions set before creating the canvas
    this.canvas = new FrameBufferRenderable(this.renderer, {
      id: `${this.id}-canvas`,
      visible: false,
      zIndex: this.box!.zIndex + 1,
      position: "absolute",
      left: 2,
      top: 2,
      width: 20 - 8,
      height: 10 - 4,
    });
    this.box!.add(this.canvas);
    // this.renderer.root.add(this.canvas);
  }

  override draw(): void {
    super.draw();
    console.log();
    console.log(`${this.canvas}`);

    const { top, left, width, height } = this.rect;
    if (this.canvas) {
      this.canvas.visible = true;
      this.canvas.top = 2;
      this.canvas.left = 2;
      this.canvas.width = width - 8;
      this.canvas.height = height - 4;
      // Update background
      const buffer = this.canvas.frameBuffer;
      this.canvas.frameBuffer.fillRect(
        0,
        0,
        buffer.width,
        buffer.height,
        RGBA.fromHex(LattePalette.green),
      );
      console.log(`${buffer.width}x${buffer.height}`);

      // for (let x = 0; x < buffer.width; x++) {
      //   buffer.drawText("-", x, 0, RGBA.fromInts(150, 100, 200));
      //   buffer.drawText(
      //     "-",
      //     x,
      //     buffer.height - 1,
      //     RGBA.fromInts(150, 100, 200),
      //   );
      // }
      //
      // for (let y = 0; y < buffer.height; y++) {
      //   buffer.drawText("|", 0, y, RGBA.fromInts(150, 100, 200));
      //   buffer.drawText("|", buffer.width - 1, y, RGBA.fromInts(150, 100, 200));
      // }

      this.canvas?.render(buffer, 0.1);
    }

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
