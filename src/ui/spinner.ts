import { BoxRenderable, CliRenderer, RGBA } from "@opentui/core";

import { LattePalette } from "../palette.ts";

export type SpinnerState = "idle" | "queued" | "running" | "success" | "error";
export type SpinnerSize = "tiny" | "medium" | "large";

type SpinnerFrame = string[];

const BRAILLE_FRAMES: SpinnerFrame[] = [
  ["⠋"],
  ["⠙"],
  ["⠹"],
  ["⠸"],
  ["⠼"],
  ["⠴"],
  ["⠦"],
  ["⠧"],
  ["⠇"],
  ["⠏"],
];

function createLineFrames(width: number, glyph = "●"): SpinnerFrame[] {
  if (width <= 1) {
    return [[glyph]];
  }

  const forward = Array.from({ length: width }, (_, index) => index);
  const backward = Array.from(
    { length: Math.max(0, width - 2) },
    (_, index) => width - 2 - index,
  );

  const positions = [...forward, ...backward];

  return positions.map((position) => {
    const leftPadding = " ".repeat(position);
    const rightPadding = " ".repeat(Math.max(0, width - position - 1));
    return [`${leftPadding}${glyph}${rightPadding}`];
  });
}

const SPINNER_CONFIGS: Record<
  SpinnerSize,
  { frames: SpinnerFrame[]; defaultWidth: number; defaultHeight: number }
> = {
  tiny: { frames: BRAILLE_FRAMES, defaultWidth: 2, defaultHeight: 1 },
  medium: { frames: createLineFrames(3), defaultWidth: 3, defaultHeight: 1 },
  large: { frames: createLineFrames(5), defaultWidth: 5, defaultHeight: 1 },
};

export interface SpinnerOptions {
  id: string;
  parent: BoxRenderable;
  left: number;
  top: number;
  width?: number;
  height?: number;
  zIndex?: number;
  visible?: boolean;
  size?: SpinnerSize;
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

  private readonly size: SpinnerSize;
  private readonly frames: SpinnerFrame[];

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
      size = "tiny",
      zIndex = 0,
      visible = false,
      backgroundColor = RGBA.fromInts(0, 0, 0, 0),
      queuedColor = RGBA.fromHex(LattePalette.overlay1),
      runningColor = RGBA.fromHex(LattePalette.green),
      successColor = RGBA.fromHex(LattePalette.teal),
      errorColor = RGBA.fromHex(LattePalette.red),
    } = options;

    this.size = size;
    const { frames, width, height } = this.getSpinnerConfig(size, options);
    this.frames = frames;

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

    const { lines, color } = this.getFrameAndColor();
    const verticalOffset = Math.max(
      0,
      Math.floor((this.box.height - lines.length) / 2),
    );

    lines.forEach((line, rowIndex) => {
      if (rowIndex + verticalOffset >= this.box.height) return;

      const textX =
        this.box.x +
        Math.max(0, Math.floor((this.box.width - line.length) / 2));
      const textY = this.box.y + verticalOffset + rowIndex;

      buffer.drawText(line, textX, textY, color);
    });
  }

  private getFrameAndColor(): { lines: SpinnerFrame; color: RGBA } {
    switch (this.state) {
      case "queued":
        return { lines: ["•"], color: this.queuedColor };
      case "running":
        return {
          lines: this.frames[this.frameIndex]!,
          color: this.runningColor,
        };
      case "success":
        return { lines: ["✓"], color: this.successColor };
      case "error":
        return { lines: ["!"], color: this.errorColor };
      default:
        return { lines: [" "], color: RGBA.fromInts(0, 0, 0, 0) };
    }
  }

  private getSpinnerConfig(
    size: SpinnerSize,
    options: SpinnerOptions,
  ): { frames: SpinnerFrame[]; width: number; height: number } {
    const base = SPINNER_CONFIGS[size] ?? SPINNER_CONFIGS.tiny;
    const width = options.width ?? base.defaultWidth;
    const height = options.height ?? base.defaultHeight;

    return { frames: base.frames, width, height };
  }
}
