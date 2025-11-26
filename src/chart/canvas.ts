import {
  CliRenderer,
  type FrameBufferOptions,
  FrameBufferRenderable,
  RGBA,
} from "@opentui/core";

import { LattePalette } from "../palette.ts";

type PlotFunction = (x: number) => number;

type PlotConfig = {
  xMin?: number;
  xMax?: number;
  step?: number;
  color?: RGBA;
  backgroundColor?: RGBA;
  axisColor?: RGBA;
};

type PlotDefinition =
  | { kind: "function"; fn: PlotFunction; config: PlotConfig }
  | {
      kind: "data";
      points: Array<{ x: number; y: number }>;
      config?: PlotConfig;
    };

type ChartCanvasOptions = FrameBufferOptions & { useBraille?: boolean };

const BRAILLE_BASE = 0x2800;
const BRAILLE_WIDTH = 2;
const BRAILLE_HEIGHT = 4;

export class ChartCanvasFrameBuffer extends FrameBufferRenderable {
  private brailleCells: Uint8Array | null;
  private backgroundColor: RGBA;
  private plotDefinition: PlotDefinition | null = null;
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
    this.plotDefinition = { kind: "function", fn, config };
    this.renderPlot();
  }

  public setSeriesData(points: Array<{ x: number; y: number }>, config?: PlotConfig) {
    this.plotDefinition = { kind: "data", points, config };
    this.renderPlot();
  }

  public zoomIn() {
    if (!this.plotDefinition) return;

    const config = this.getOrCreateConfig();
    const xRange = (config.xMax ?? 0) - (config.xMin ?? 0);
    const centerX = ((config.xMin ?? 0) + (config.xMax ?? 0)) / 2;
    const newRange = xRange * 0.8;

    config.xMin = centerX - newRange / 2;
    config.xMax = centerX + newRange / 2;

    this.renderPlot();
  }

  public zoomOut() {
    if (!this.plotDefinition) return;

    const config = this.getOrCreateConfig();
    const xRange = (config.xMax ?? 0) - (config.xMin ?? 0);
    const centerX = ((config.xMin ?? 0) + (config.xMax ?? 0)) / 2;
    const newRange = xRange * 1.2;

    config.xMin = centerX - newRange / 2;
    config.xMax = centerX + newRange / 2;

    this.renderPlot();
  }

  public renderPlot() {
    if (!this.plotDefinition) return;

    const fg =
      this.plotDefinition.kind === "function"
        ? this.plotDefinition.config.color ?? RGBA.fromHex(LattePalette.blue)
        : this.plotDefinition.config?.color ?? RGBA.fromHex(LattePalette.blue);
    const axisColor =
      this.plotDefinition.kind === "function"
        ? this.plotDefinition.config.axisColor ?? RGBA.fromHex(LattePalette.text)
        : this.plotDefinition.config?.axisColor ?? RGBA.fromHex(LattePalette.text);

    const { samples, xRange } = this.getSamples();

    if (samples.length === 0) return;

    if (xRange.max === xRange.min) {
      xRange.max += 1;
    }

    this.backgroundColor =
      (this.plotDefinition.kind === "function"
        ? this.plotDefinition.config.backgroundColor
        : this.plotDefinition.config?.backgroundColor) ?? this.backgroundColor;

    this.resetBuffers();

    let minY = Math.min(...samples.map((sample) => sample.y));
    let maxY = Math.max(...samples.map((sample) => sample.y));
    if (minY === maxY) {
      // Avoid divide by zero in scaling
      minY -= 1;
      maxY += 1;
    }

    this.drawAxes(xRange.min, xRange.max, minY, maxY, axisColor);

    for (const sample of samples) {
      const pixelX = Math.round(
        ((sample.x - xRange.min) / (xRange.max - xRange.min)) *
          (this.pixelWidth - 1),
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

  private getSamples(): {
    samples: Array<{ x: number; y: number }>;
    xRange: { min: number; max: number };
  } {
    if (!this.plotDefinition) {
      return { samples: [], xRange: { min: 0, max: 1 } };
    }

    if (this.plotDefinition.kind === "function") {
      const { config } = this.plotDefinition;
      const xMin = config.xMin ?? -1;
      const xMax = config.xMax ?? 1;
      const step = config.step ?? (xMax - xMin) / this.pixelWidth;

      const samples: Array<{ x: number; y: number }> = [];
      for (let x = xMin; x <= xMax; x += step) {
        samples.push({ x, y: this.plotDefinition.fn(x) });
      }

      // Ensure config is hydrated for zoom operations
      config.xMin = xMin;
      config.xMax = xMax;

      return { samples, xRange: { min: xMin, max: xMax } };
    }

    const points = this.plotDefinition.points;
    if (points.length === 0) {
      return { samples: [], xRange: { min: 0, max: 1 } };
    }
    const xMin =
      this.plotDefinition.config?.xMin ?? Math.min(...points.map((p) => p.x));
    const xMax =
      this.plotDefinition.config?.xMax ?? Math.max(...points.map((p) => p.x));

    // Hydrate config so zoom can operate on data plots too
    const config = this.getOrCreateConfig();
    config.xMin = xMin;
    config.xMax = xMax;

    return { samples: points, xRange: { min: xMin, max: xMax } };
  }

  private getOrCreateConfig(): PlotConfig {
    if (!this.plotDefinition) return {};

    if (this.plotDefinition.kind === "function") {
      return this.plotDefinition.config;
    }

    if (!this.plotDefinition.config) {
      this.plotDefinition.config = {};
    }

    return this.plotDefinition.config;
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
