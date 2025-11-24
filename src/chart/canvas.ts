import {
  CliRenderer,
  type FrameBufferOptions,
  FrameBufferRenderable,
  RGBA,
} from "@opentui/core";

import { LattePalette } from "../palette.ts";

type PlotFunction = (x: number) => number;

type PlotConfig = {
  xMin: number;
  xMax: number;
  step?: number;
  color?: RGBA;
  backgroundColor?: RGBA;
  axisColor?: RGBA;
};

type ChartCanvasOptions = FrameBufferOptions & { useBraille?: boolean };

const BRAILLE_BASE = 0x2800;
const BRAILLE_WIDTH = 2;
const BRAILLE_HEIGHT = 4;

export class ChartCanvasFrameBuffer extends FrameBufferRenderable {
  private brailleCells: Uint8Array | null;
  private backgroundColor: RGBA;
  private plotDefinition: { fn: PlotFunction; config: PlotConfig } | null =
    null;
  private useBraille: boolean;

  constructor(
    renderer: CliRenderer,
    options: ChartCanvasOptions,
    backgroundColor: RGBA = RGBA.fromHex(LattePalette.base),
  ) {
    super(renderer, options);
    this.backgroundColor = backgroundColor;
    this.useBraille = options.useBraille ?? true;
    this.brailleCells = this.useBraille
      ? new Uint8Array(this.width * this.height)
      : null;
    this.fillBackground();
  }

  public setUseBraille(useBraille: boolean) {
    if (this.useBraille === useBraille) return;

    this.useBraille = useBraille;
    this.resetBuffers();
    this.renderPlot();
  }

  public isUsingBraille() {
    return this.useBraille;
  }

  public setPlotFunction(fn: PlotFunction, config: PlotConfig) {
    this.plotDefinition = { fn, config };
    this.renderPlot();
  }

  public renderPlot() {
    if (!this.plotDefinition) return;

    const { fn, config } = this.plotDefinition;
    const xMin = config.xMin;
    const xMax = config.xMax;
    const step = config.step ?? (xMax - xMin) / this.pixelWidth;
    const fg = config.color ?? RGBA.fromHex(LattePalette.blue);
    const axisColor = config.axisColor ?? RGBA.fromHex(LattePalette.text);
    this.backgroundColor = config.backgroundColor ?? this.backgroundColor;

    this.resetBuffers();

    const samples: Array<{ x: number; y: number }> = [];
    for (let x = xMin; x <= xMax; x += step) {
      samples.push({ x, y: fn(x) });
    }

    let minY = Math.min(...samples.map((sample) => sample.y));
    let maxY = Math.max(...samples.map((sample) => sample.y));
    if (minY === maxY) {
      // Avoid divide by zero in scaling
      minY -= 1;
      maxY += 1;
    }

    this.drawAxes(xMin, xMax, minY, maxY, axisColor);

    for (const sample of samples) {
      const pixelX = Math.round(
        ((sample.x - xMin) / (xMax - xMin)) * (this.pixelWidth - 1),
      );
      const pixelY = Math.round(
        (1 - (sample.y - minY) / (maxY - minY)) * (this.pixelHeight - 1),
      );
      this.setPixel(pixelX, pixelY, fg);
    }
  }

  protected override onResize(width: number, height: number): void {
    super.onResize(width, height);
    this.resetBuffers();
    this.renderPlot();
  }

  private resetBuffers() {
    this.brailleCells = this.useBraille
      ? new Uint8Array(this.width * this.height)
      : null;
    this.fillBackground();
  }

  private fillBackground() {
    this.frameBuffer.fillRect(
      0,
      0,
      this.width,
      this.height,
      this.backgroundColor,
    );
  }

  private setPixel(x: number, y: number, fg: RGBA) {
    if (this.useBraille) {
      const cellX = Math.floor(x / BRAILLE_WIDTH);
      const cellY = Math.floor(y / BRAILLE_HEIGHT);

      if (
        cellX < 0 ||
        cellY < 0 ||
        cellX >= this.width ||
        cellY >= this.height
      ) {
        return;
      }

      const dotX = x % BRAILLE_WIDTH;
      const dotY = y % BRAILLE_HEIGHT;

      const brailleIndex = this.getBrailleIndex(dotX, dotY);
      const bufferIndex = cellY * this.width + cellX;

      this.brailleCells![bufferIndex]! |= brailleIndex;

      const brailleChar = String.fromCharCode(
        BRAILLE_BASE + this.brailleCells![bufferIndex]!,
      );
      this.frameBuffer.setCell(
        cellX,
        cellY,
        brailleChar,
        fg,
        this.backgroundColor,
      );
      return;
    }

    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return;
    }

    this.frameBuffer.setCell(x, y, "•", fg, this.backgroundColor);
  }

  private getBrailleIndex(dotX: number, dotY: number): number {
    const columnOffset = dotX === 0 ? 0 : 3;
    if (dotY === 0) return 1 + columnOffset;
    if (dotY === 1) return 2 + columnOffset;
    if (dotY === 2) return 4 + columnOffset;
    return 64 + columnOffset; // dotY === 3
  }

  private get pixelWidth(): number {
    return this.useBraille ? this.width * BRAILLE_WIDTH : this.width;
  }

  private get pixelHeight(): number {
    return this.useBraille ? this.height * BRAILLE_HEIGHT : this.height;
  }

  private drawAxes(
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
    axisColor: RGBA,
  ) {
    const hasYAxis = xMin <= 0 && xMax >= 0;
    const hasXAxis = yMin <= 0 && yMax >= 0;

    if (!hasYAxis && !hasXAxis) return;

    const mapXToPixel = (x: number) =>
      Math.round(((x - xMin) / (xMax - xMin)) * (this.pixelWidth - 1));
    const mapYToPixel = (y: number) =>
      Math.round((1 - (y - yMin) / (yMax - yMin)) * (this.pixelHeight - 1));

    const originPixelX = mapXToPixel(0);
    const originPixelY = mapYToPixel(0);

    const originCellX = this.useBraille
      ? Math.floor(originPixelX / BRAILLE_WIDTH)
      : originPixelX;
    const originCellY = this.useBraille
      ? Math.floor(originPixelY / BRAILLE_HEIGHT)
      : originPixelY;

    if (hasXAxis) {
      for (let cellX = 0; cellX < this.width; cellX++) {
        this.frameBuffer.setCell(
          cellX,
          originCellY,
          ".",
          axisColor,
          this.backgroundColor,
        );
      }
    }

    if (hasYAxis) {
      for (let cellY = 0; cellY < this.height; cellY++) {
        this.frameBuffer.setCell(
          originCellX,
          cellY,
          ".",
          axisColor,
          this.backgroundColor,
        );
      }
    }
  }
}
