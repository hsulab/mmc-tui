import { BoxRenderable, CliRenderer, RGBA } from "@opentui/core";

import { LattePalette } from "../palette.ts";

export type SpinnerState = "idle" | "queued" | "running" | "success" | "error";

export interface SpinnerOptions {
  id: string;
  parent: BoxRenderable;
  left: number;
  top: number;
  width?: number;
  height?: number;
  zIndex?: number;
  visible?: boolean;
  backgroundColor?: RGBA;
  queuedColor?: RGBA;
  runningColor?: RGBA;
  successColor?: RGBA;
  errorColor?: RGBA;
}

export class Spinner {
  private readonly box: BoxRenderable;
  private readonly parent: BoxRenderable;

  private frameIndex = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private state: SpinnerState = "idle";

  private readonly frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  private readonly queuedColor: RGBA;
  private readonly runningColor: RGBA;
  private readonly successColor: RGBA;
  private readonly errorColor: RGBA;

  constructor(renderer: CliRenderer, options: SpinnerOptions) {
    const {
      id,
      parent,
      left,
      top,
      width = 2,
      height = 1,
      zIndex = 0,
      visible = false,
      backgroundColor = RGBA.fromInts(0, 0, 0, 0),
      queuedColor = RGBA.fromHex(LattePalette.overlay1),
      runningColor = RGBA.fromHex(LattePalette.green),
      successColor = RGBA.fromHex(LattePalette.teal),
      errorColor = RGBA.fromHex(LattePalette.red),
    } = options;

    this.queuedColor = queuedColor;
    this.runningColor = runningColor;
    this.successColor = successColor;
    this.errorColor = errorColor;
    this.parent = parent;

    this.box = new BoxRenderable(renderer, {
      id,
      position: "absolute",
      left,
      top,
      width,
      height,
      border: false,
      backgroundColor,
      zIndex,
      renderAfter: (buffer) => {
        this.render(buffer);
      },
    });

    this.box.visible = visible;
    this.parent.add(this.box);
  }

  get width(): number {
    return this.box.width;
  }

  get height(): number {
    return this.box.height;
  }

  setState(nextState: SpinnerState): void {
    if (nextState === this.state) return;

    this.state = nextState;

    if (this.state === "running") {
      this.start();
    } else {
      this.stop();
    }

    this.box.visible = this.state !== "idle";
    this.box.requestRender();
  }

  updateLayout(
    left: number,
    top: number,
    width?: number,
    height?: number,
  ): void {
    this.box.left = left;
    this.box.top = top;
    if (width !== undefined) this.box.width = width;
    if (height !== undefined) this.box.height = height;
    this.box.requestRender();
  }

  destroy(): void {
    this.stop();
    this.parent.remove?.(this.box.id);
    this.box.destroy();
  }

  private start(): void {
    if (this.interval) return;

    this.frameIndex = 0;
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.box.requestRender();
    }, 80);
  }

  private stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.frameIndex = 0;
  }

  private render(buffer: any): void {
    if (this.state === "idle") return;

    const textX =
      this.box.x + Math.max(0, Math.floor((this.box.width - 1) / 2));
    const textY = this.box.y;

    const { symbol, color } = this.getSymbolAndColor();
    buffer.drawText(symbol, textX, textY, color);
  }

  private getSymbolAndColor(): { symbol: string; color: RGBA } {
    switch (this.state) {
      case "queued":
        return { symbol: "•", color: this.queuedColor };
      case "running":
        return {
          symbol: this.frames[this.frameIndex]!,
          color: this.runningColor,
        };
      case "success":
        return { symbol: "✓", color: this.successColor };
      case "error":
        return { symbol: "!", color: this.errorColor };
      default:
        return { symbol: " ", color: RGBA.fromInts(0, 0, 0, 0) };
    }
  }
}
