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
  SelectRenderable,
  SelectRenderableEvents,
  type SelectOption,
} from "@opentui/core";

import { Pane, type Rect } from "./base.ts";
import { LattePalette } from "../palette.ts";
import { DraggableBox, type SelectableBoxRenderable } from "./graph.ts";

type NodeEdge = { from: BoxRenderable; to: BoxRenderable };

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
  private readonly CURSOR_COLOR = RGBA.fromInts(255, 255, 255, 255);

  private BACKGROUND_COLOR = RGBA.fromHex(LattePalette.overlay2);

  constructor(renderer: CliRenderer, id: string, backgroundColor?: RGBA) {
    super(renderer, {
      id,
      width: renderer.terminalWidth,
      height: renderer.terminalHeight,
      zIndex: 100,
    });

    if (backgroundColor) {
      this.BACKGROUND_COLOR = backgroundColor;
    }
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

class EdgeFrameBuffer extends FrameBufferRenderable {
  private readonly BACKGROUND_COLOR: RGBA;
  private readonly LINE_COLOR = RGBA.fromHex(LattePalette.subtext0);

  constructor(
    renderer: CliRenderer,
    id: string,
    private readonly edgesProvider: () => NodeEdge[],
    backgroundColor: RGBA,
  ) {
    super(renderer, {
      id,
      width: renderer.terminalWidth,
      height: renderer.terminalHeight,
      zIndex: 90,
    });

    this.BACKGROUND_COLOR = backgroundColor;
  }

  protected override renderSelf(buffer: OptimizedBuffer): void {
    this.frameBuffer.clear(this.BACKGROUND_COLOR);

    for (const edge of this.edgesProvider()) {
      this.drawDottedLine(
        Math.round(edge.from.x + edge.from.width / 2) - this.x,
        Math.round(edge.from.y + edge.from.height / 2) - this.y,
        Math.round(edge.to.x + edge.to.width / 2) - this.x,
        Math.round(edge.to.y + edge.to.height / 2) - this.y,
      );
    }

    super.renderSelf(buffer);
  }

  private drawDottedLine(x0: number, y0: number, x1: number, y1: number) {
    let currentX = x0;
    let currentY = y0;

    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let drawDot = true;

    while (true) {
      if (
        drawDot &&
        currentX >= 0 &&
        currentY >= 0 &&
        currentX < this.width &&
        currentY < this.height
      ) {
        this.frameBuffer.setCell(
          currentX,
          currentY,
          "⠒",
          this.LINE_COLOR,
          this.BACKGROUND_COLOR,
        );
      }

      if (currentX === x1 && currentY === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        currentX += sx;
      }
      if (e2 <= dx) {
        err += dx;
        currentY += sy;
      }

      drawDot = !drawDot;
    }
  }
}

export class FlowPane extends Pane {
  private keybinds: ((key: any) => void) | null = null;

  private mouseInteractionBuffer: MouseInteractionFrameBuffer | null = null;
  private edgeLayer: EdgeFrameBuffer | null = null;
  private boxes: SelectableBoxRenderable[] = [];

  private edges: NodeEdge[] = [];
  private pendingConnectionNode: SelectableBoxRenderable | null = null;

  private nodeIndex: number = 0;

  private selectorContainer: BoxRenderable | null = null;
  private selector: SelectRenderable | null = null;
  private nodeSelectorVisible: boolean = false;
  private nodeOptions: SelectOption[] = [
    {
      name: "Build",
      value: "Build",
      description: "  Build structures",
    },
    {
      name: "Compute",
      value: "Compute",
      description: "  Run calculation/simulation",
    },
    {
      name: "Validate",
      value: "Validate",
      description: "  Analyze and verify data",
    },
  ];

  constructor(
    renderer: CliRenderer,
    id: string,
    active: boolean = false,
    rect: Rect,
  ) {
    super(renderer, id, active, rect);

    this.createEdgeLayer();
    this.createMouseInteractionBuffer();

    this.createSelector();
    this.boxes = []; // TODO: If we have some init nodes?
  }

  override get type(): string {
    return "flow";
  }

  override draw(): void {
    super.draw();

    const { width, height } = this.rect;

    this.edgeLayer!.top = 0;
    this.edgeLayer!.left = 0;
    this.edgeLayer!.width = width - 2;
    this.edgeLayer!.height = height - 2;

    this.mouseInteractionBuffer!.top = 0;
    this.mouseInteractionBuffer!.left = 0;
    this.mouseInteractionBuffer!.width = width - 2;
    this.mouseInteractionBuffer!.height = height - 2;

    this.setupKeybinds(this.renderer);
  }

  private createMouseInteractionBuffer(): void {
    if (this.mouseInteractionBuffer) return;

    this.mouseInteractionBuffer = new MouseInteractionFrameBuffer(
      this.renderer,
      `${this.id}-mouse-interaction`,
      RGBA.fromHex(LattePalette.surface0),
    );
    this.mouseInteractionBuffer.top = 0;
    this.mouseInteractionBuffer.left = 0;
    this.mouseInteractionBuffer.width = this.box!.width - 2;
    this.mouseInteractionBuffer.height = this.box!.height - 2;

    this.box!.add(this.mouseInteractionBuffer);
  }

  private createEdgeLayer(): void {
    if (this.edgeLayer) return;

    this.edgeLayer = new EdgeFrameBuffer(
      this.renderer,
      `${this.id}-edges`,
      () => this.edges,
      RGBA.fromHex(LattePalette.surface0),
    );
    this.edgeLayer.top = 0;
    this.edgeLayer.left = 0;
    this.edgeLayer.width = this.box!.width - 2;
    this.edgeLayer.height = this.box!.height - 2;

    this.box!.add(this.edgeLayer);
  }

  private createSelector(): void {
    if (this.selectorContainer) return;

    const containerWidth = 36;
    const containerHeight = this.nodeOptions.length * 2 + 2;

    if (!this.selectorContainer) {
      this.selectorContainer = new BoxRenderable(this.renderer, {
        id: `${this.id}-node-selector-container`,
        title: " Select Node Type ",
        position: "absolute",
        top: this.rect.top + (this.rect.height - containerHeight - 2) / 2,
        left: this.rect.left + (this.rect.width - containerWidth - 2) / 2,
        width: containerWidth,
        height: containerHeight,
        border: true,
        borderStyle: "rounded",
        borderColor: LattePalette.peach,
        backgroundColor: LattePalette.surface0,
        zIndex: 400,
      });

      this.selector = new SelectRenderable(this.renderer, {
        id: `${this.id}-node-selector`,
        top: 0,
        left: 0,
        width: containerWidth - 2,
        height: containerHeight - 2,
        zIndex: 401,
        options: this.nodeOptions,
        backgroundColor: LattePalette.surface0,
        textColor: LattePalette.text,
        focusedBackgroundColor: LattePalette.surface0,
        focusedTextColor: LattePalette.text,
        selectedBackgroundColor: LattePalette.peach,
        selectedTextColor: LattePalette.text,
        descriptionColor: LattePalette.subtext0,
        selectedDescriptionColor: LattePalette.text,
        showDescription: true,
        showScrollIndicator: false,
        wrapSelection: true,
      });

      this.selector.on(
        SelectRenderableEvents.ITEM_SELECTED,
        (_: number, option: SelectOption) => {
          this.createNodeFromSelection(option.value);
          this.hideNodeSelector();
          this.active = true; // Reactivate pane
          this.draw(); // Redraw border
        },
      );

      this.selectorContainer.visible = false;
      this.nodeSelectorVisible = false;
      this.selector.blur();

      this.selectorContainer.add(this.selector);
      this.box!.add(this.selectorContainer);
    }
  }

  private showNodeSelector(): void {
    if (!this.selectorContainer || !this.box) return;

    const containerWidth = 36;
    const selectHeight = this.nodeOptions.length * 2;
    const containerHeight = Math.max(8, selectHeight + 2);

    const innerLeft = this.rect.left + 1;
    const innerTop = this.rect.top + 1;
    const innerWidth = Math.max(0, this.rect.width - 2);
    const innerHeight = Math.max(0, this.rect.height - 2);

    const newWidth = Math.min(containerWidth, innerWidth);
    const newHeight = Math.min(containerHeight, innerHeight);

    this.selectorContainer.width = newWidth;
    this.selectorContainer.height = newHeight;
    this.selectorContainer.left =
      innerLeft + Math.max(0, Math.floor((innerWidth - newWidth) / 2));
    this.selectorContainer.top =
      innerTop + Math.max(0, Math.floor((innerHeight - newHeight) / 2));

    this.selector!.width = Math.max(0, this.selectorContainer.width - 2);
    this.selector!.height = Math.max(0, this.selectorContainer.height - 2);

    this.selectorContainer.visible = true;
    this.selector!.visible = true;
    this.selector!.focus();

    this.nodeSelectorVisible = true;
  }

  private hideNodeSelector(): void {
    if (!this.selectorContainer) return;

    this.selector!.blur();
    this.selector!.visible = false;
    this.selectorContainer.visible = false;

    this.nodeSelectorVisible = false;
  }

  private requestEdgeRender(): void {
    this.edgeLayer?.requestRender();
  }

  private handleNodeSelection(node: SelectableBoxRenderable): void {
    if (this.pendingConnectionNode && this.pendingConnectionNode !== node) {
      this.connectNodes(this.pendingConnectionNode, node);
      this.pendingConnectionNode = null;
    } else {
      this.pendingConnectionNode = node;
    }

    this.requestEdgeRender();
  }

  private handleNodeDeselection(node: SelectableBoxRenderable): void {
    if (this.pendingConnectionNode === node) {
      this.pendingConnectionNode = null;
    }

    this.requestEdgeRender();
  }

  private connectNodes(from: BoxRenderable, to: BoxRenderable): void {
    const key = this.edgeKey(from, to);
    const alreadyConnected = this.edges.some(
      (edge) => this.edgeKey(edge.from, edge.to) === key,
    );

    if (alreadyConnected) return;

    this.edges.push({ from, to });
    console.log(`Linked ${from.id} -> ${to.id} in FlowPane ${this.id}`);
  }

  private edgeKey(a: BoxRenderable, b: BoxRenderable): string {
    return [a.id, b.id].sort().join("::");
  }

  private createNodeFromSelection(value: string): void {
    this.nodeIndex++;
    const nodeId = `${this.id}-${value.toLowerCase()}-${this.nodeIndex}`;
    const nodeLabel = `${value.toLocaleLowerCase()} #${this.nodeIndex}`;
    const newBox = DraggableBox(this.renderer, {
      id: nodeId,
      x: this.rect.left,
      y: this.rect.top,
      width: 18,
      height: 5,
      label: nodeLabel,
      color: RGBA.fromHex(LattePalette.teal),
      onSelect: (box) =>
        this.handleNodeSelection(box as SelectableBoxRenderable),
      onDeselect: (box) =>
        this.handleNodeDeselection(box as SelectableBoxRenderable),
      onMove: () => this.requestEdgeRender(),
      selectedBorderColor: RGBA.fromHex(LattePalette.red),
    });
    this.box!.add(newBox);
    this.boxes.push(newBox as SelectableBoxRenderable);
    this.requestEdgeRender();
    console.log(`New ${nodeLabel} node created in FlowPane ${this.id}`);
  }

  public setupKeybinds(renderer: CliRenderer): void {
    if (this.keybinds) return;

    this.keybinds = (key: any) => {
      // If selector is visible, selector takes priority
      if (this.nodeSelectorVisible) {
        switch (key.name) {
          case "n":
            this.hideNodeSelector();
            this.active = true; // Reactivate pane
            this.draw(); // Redraw border
            console.log(`Node selector closed in FlowPane ${this.id}`);
            return; // swallow
        }

        return;
      }
      // Pane-level keybinds
      if (this.active) {
        switch (key.name) {
          case "n":
            this.showNodeSelector();
            this.active = false; // Temporarily deactivate pane to focus on selector
            this.draw(); // Redraw border
            console.log(`Node selector opened in FlowPane ${this.id}`);
            return;
          case "t":
            this.boxes.forEach((box) => {
              box.backgroundColor = RGBA.fromHex(LattePalette.peach);
            });
            console.log(`All node colors updated in FlowPane ${this.id}`);
            return;
        }
      }
    };

    renderer.keyInput.on("keypress", this.keybinds);
  }

  override destroy(): void {
    if (this.mouseInteractionBuffer) {
      this.mouseInteractionBuffer.destroy();
      this.mouseInteractionBuffer = null;
    }
    if (this.edgeLayer) {
      this.edgeLayer.destroy();
      this.edgeLayer = null;
    }
    if (this.selector) {
      this.selector.destroy();
      this.selector = null;
    }
    if (this.selectorContainer) {
      this.selectorContainer.destroy();
      this.selectorContainer = null;
    }
    if (this.boxes.length > 0) {
      this.boxes.forEach((box) => box.destroy());
      this.boxes = [];
    }
    this.edges = [];
    this.pendingConnectionNode = null;
    if (this.keybinds) {
      this.renderer.keyInput.off("keypress", this.keybinds);
      this.keybinds = null;
    }
    super.destroy(); // Destroy pane box
  }
}
