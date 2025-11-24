/** The workflow pane allows users to create, manage, and visualize complex workflows through an intuitive interface.
 * It supports features such as adding tasks, connecting them with dependencies, and monitoring progress in real-time.
 * The pane is designed to enhance productivity by providing a clear overview of the workflow structure and status. */

import {
  RGBA,
  CliRenderer,
  BoxRenderable,
  FrameBufferRenderable,
  OptimizedBuffer,
  MouseEvent,
} from "@opentui/core";

import { Pane, type Rect } from "./base.ts";
import { LattePalette } from "../palette.ts";
import { DraggableBox } from "./graph.ts";

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
  private readonly BACKGROUND_COLOR = RGBA.fromHex(LattePalette.overlay2);
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
        x!,
        y!,
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
        latest!.x,
        latest!.y,
        "+",
        this.CURSOR_COLOR,
        this.BACKGROUND_COLOR,
      );
    }

    super.renderSelf(buffer);
  }

  protected override onMouseEvent(event: MouseEvent): void {
    if (event.propagationStopped) return;

    const localX = event.x - this.x;
    const localY = event.y - this.y;

    if (
      localX < 0 ||
      localY < 0 ||
      localX >= this.width ||
      localY >= this.height
    ) {
      return;
    }

    const cellKey = `${localX},${localY}`;

    switch (event.type) {
      case "move":
        this.trailCells.set(cellKey, {
          x: localX,
          y: localY,
          timestamp: Date.now(),
          isDrag: false,
        });
        this.requestRender();
        break;

      case "drag":
        this.trailCells.set(cellKey, {
          x: localX,
          y: localY,
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
  private keybinds: ((key: any) => void) | null = null;

  private mouseInteractionBuffer: MouseInteractionFrameBuffer | null = null;
  private boxes: BoxRenderable[] = [];

  private nodeIndex: number = 0;

  constructor(
    renderer: CliRenderer,
    id: string,
    active: boolean = false,
    rect: Rect,
  ) {
    super(renderer, id, active, rect);

    this.createMouseInteractionBuffer();

    this.boxes = []; // TODO: If we have some init nodes?
  }

  override get type(): string {
    return "flow";
  }

  override draw(): void {
    super.draw();

    const { top, left, width, height } = this.rect;

    this.mouseInteractionBuffer!.top = 1;
    this.mouseInteractionBuffer!.left = 1;
    this.mouseInteractionBuffer!.width = width - 4;
    this.mouseInteractionBuffer!.height = height - 4;

    this.setupKeybinds(this.renderer);
  }

  private createMouseInteractionBuffer(): void {
    if (this.mouseInteractionBuffer) return;

    this.mouseInteractionBuffer = new MouseInteractionFrameBuffer(
      `${this.id}-mouse-interaction`,
      this.renderer,
    );
    this.mouseInteractionBuffer.top = 1;
    this.mouseInteractionBuffer.left = 1;
    this.mouseInteractionBuffer.width = 20;
    this.mouseInteractionBuffer.height = 20;

    this.box!.add(this.mouseInteractionBuffer);
  }

  public setupKeybinds(renderer: CliRenderer): void {
    if (this.keybinds) return;

    this.keybinds = (key: any) => {
      if (!this.active) return;

      // Example keybinds for demonstration
      switch (key.name) {
        case "x":
          if (key.ctrl) {
            console.log(`Ctrl+X pressed in FlowPane ${this.id}`);
          }
          break;
        case "n": // Create new node
          const nodeId = `node-${this.id}-${this.nodeIndex}`;
          const nodeLabel = `node-${this.nodeIndex}`;
          const newBox = DraggableBox({
            id: nodeId,
            // x: 20 + Math.random() * (this.box.height - 40),
            // y: 10 + Math.random() * (this.box.width - 10),
            x: 20,
            y: 10,
            width: 16,
            height: 4,
            label: nodeLabel,
            color: RGBA.fromHex(LattePalette.teal),
          });
          this.box!.add(newBox);
          // Get the created BoxRenderable from the box
          const nodeBox = this.box!.getChildren().find(
            (child) => child.id === nodeId,
          ) as BoxRenderable;
          this.boxes.push(nodeBox);
          this.nodeIndex += 1;
          console.log(`New node created in FlowPane ${this.id}`);
          break;
        case "t": // Update color of all boxes
          this.boxes.forEach((box) => {
            box.backgroundColor = RGBA.fromHex(LattePalette.peach);
          });
          console.log(`All node colors updated in FlowPane ${this.id}`);
          break;
        default:
          break;
      }
    };

    renderer.keyInput.on("keypress", this.keybinds);
  }
}
