/** The workflow pane allows users to create, manage, and visualize complex workflows through an intuitive interface.
 * It supports features such as adding tasks, connecting them with dependencies, and monitoring progress in real-time.
 * The pane is designed to enhance productivity by providing a clear overview of the workflow structure and status. */

import {
  RGBA,
  CliRenderer,
  BoxRenderable,
  FrameBuffer,
  FrameBufferRenderable,
  OptimizedBuffer,
} from "@opentui/core";

import { Pane } from "./base.ts";
import { LattePalette } from "../palette.ts";

interface TrailCell {
  x: number;
  y: number;
  timestamp: number;
  isDrag?: boolean;
}

class MouseInteractionFrameBuffer extends FrameBufferRenderable {
  private readonly trailCells = new Map<string, TrailCell>();
  private readonly activatedCells = new Set<string>();
  private readonly TRAIL_FADE_DURATION = 3000;

  private readonly TRAIL_COLOR = RGBA.fromInts(64, 224, 208, 255);
  private readonly DRAG_COLOR = RGBA.fromInts(255, 165, 0, 255);
  private readonly ACTIVATED_COLOR = RGBA.fromInts(255, 20, 147, 255);
  private readonly BACKGROUND_COLOR = RGBA.fromInts(15, 15, 35, 255);
  private readonly CURSOR_COLOR = RGBA.fromInts(255, 255, 255, 255);

  constructor(id: string, renderer: CliRenderer) {
    super(renderer, {
      id,
      width: renderer.terminalWidth,
      height: renderer.terminalHeight,
      zIndex: 100,
    });
  }

  protected override renderSelf(buffer: OptimizedBuffer): void {
    const currentTime = Date.now();

    this.frameBuffer.clear(this.BACKGROUND_COLOR);

    for (const [key, cell] of this.trailCells.entries()) {
      if (currentTime - cell.timestamp > this.TRAIL_FADE_DURATION) {
        this.trailCells.delete(key);
      }
    }

    for (const [, cell] of this.trailCells.entries()) {
      const age = currentTime - cell.timestamp;
      const fadeRatio = 1 - age / this.TRAIL_FADE_DURATION;

      if (fadeRatio > 0) {
        const baseColor = cell.isDrag ? this.DRAG_COLOR : this.TRAIL_COLOR;
        const smoothAlpha = fadeRatio;

        const fadedColor = RGBA.fromValues(
          baseColor.r,
          baseColor.g,
          baseColor.b,
          smoothAlpha,
        );

        this.frameBuffer.setCellWithAlphaBlending(
          cell.x,
          cell.y,
          "█",
          fadedColor,
          this.BACKGROUND_COLOR,
        );
      }
    }

    for (const cellKey of this.activatedCells) {
      const [x, y] = cellKey.split(",").map(Number);

      this.frameBuffer.drawText(
        "█",
        x,
        y,
        this.ACTIVATED_COLOR,
        this.BACKGROUND_COLOR,
      );
    }

    const recentTrails = Array.from(this.trailCells.values())
      .filter((cell) => currentTime - cell.timestamp < 100)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (recentTrails.length > 0) {
      const latest = recentTrails[0];
      this.frameBuffer.setCellWithAlphaBlending(
        latest.x,
        latest.y,
        "+",
        this.CURSOR_COLOR,
        this.BACKGROUND_COLOR,
      );
    }

    super.renderSelf(buffer);
  }

  protected override onMouseEvent(event: MouseEvent): void {
    if (event.propagationStopped) return;

    const cellKey = `${event.x},${event.y}`;

    switch (event.type) {
      case "move":
        this.trailCells.set(cellKey, {
          x: event.x,
          y: event.y,
          timestamp: Date.now(),
          isDrag: false,
        });
        this.requestRender();
        break;

      case "drag":
        this.trailCells.set(cellKey, {
          x: event.x,
          y: event.y,
          timestamp: Date.now(),
          isDrag: true,
        });
        this.requestRender();
        break;

      case "down":
        if (this.activatedCells.has(cellKey)) {
          this.activatedCells.delete(cellKey);
        } else {
          this.activatedCells.add(cellKey);
        }
        this.requestRender();
        break;
    }
  }

  public clearState(): void {
    this.trailCells.clear();
    this.activatedCells.clear();
  }
}

export class FlowPane extends Pane {
  constructor(id: string, active: boolean = false) {
    super(id, active);
  }

  override get type(): string {
    return "flow";
  }

  override draw(
    renderer: CliRenderer,
    rect: { top: number; left: number; width: number; height: number },
  ): void {
    super.draw(renderer, rect);

    let box = renderer.root.getRenderable(this.id);
    if (box instanceof BoxRenderable) {
      console.log(`Drawing FlowPane ${this.id}`);
      let mouseInteractionContainer = box.getRenderable(
        `${this.id}-mouse-interaction`,
      );
      console.log(
        `Current FlowPane ${box.getChildrenCount()}:`,
        mouseInteractionContainer,
      );
      if (!(mouseInteractionContainer instanceof MouseInteractionFrameBuffer)) {
        console.log(
          `Adding MouseInteractionFrameBuffer to FlowPane ${this.id}`,
        );
        mouseInteractionContainer = new MouseInteractionFrameBuffer(
          `${this.id}-mouse-interaction`,
          renderer,
        );
        // mouseInteractionContainer = new BoxRenderable(renderer, {
        //   id: `${this.id}-mouse-interaction`,
        //   backgroundColor: LattePalette.overlay2,
        // });
        mouseInteractionContainer.zIndex = 100;
        mouseInteractionContainer.top = rect.top + 1;
        mouseInteractionContainer.left = rect.left + 1;
        mouseInteractionContainer.width = rect.width - 4;
        mouseInteractionContainer.height = rect.height - 4;
        box.add(mouseInteractionContainer);
      } else {
        console.log(
          `Updating MouseInteractionFrameBuffer size for FlowPane ${this.id}`,
        );
        mouseInteractionContainer.top = rect.top + 1;
        mouseInteractionContainer.left = rect.left + 1;
        mouseInteractionContainer.width = rect.width - 4;
        mouseInteractionContainer.height = rect.height - 4;
      }
    }
  }
}
