/** The workflow pane allows users to create, manage, and visualize complex workflows through an intuitive interface.
 * It supports features such as adding tasks, connecting them with dependencies, and monitoring progress in real-time.
 * The pane is designed to enhance productivity by providing a clear overview of the workflow structure and status. */

import {
  RGBA,
  CliRenderer,
  BoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type SelectOption,
} from "@opentui/core";

import { Pane, type Rect } from "./base.ts";
import { LattePalette } from "../palette.ts";
import { DraggableBox, type SelectableBoxRenderable } from "../flow/graph.ts";
import { EdgeFrameBuffer, type NodeEdge } from "../flow/edge.ts";

export class FlowPane extends Pane {
  private keybinds: ((key: any) => void) | null = null;

  private edgeLayer: EdgeFrameBuffer | null = null;

  private nodes: SelectableBoxRenderable[] = [];
  private nodeDetails: Map<
    SelectableBoxRenderable,
    { type: string; label: string }
  > = new Map();
  private edges: NodeEdge[] = [];

  private pendingConnectionNode: SelectableBoxRenderable | null = null;

  private nodeIndex: number = 0;

  private runButton: BoxRenderable | null = null;
  private isRunButtonPressed = false;

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

    this.createSelector();

    this.createRunButton();

    this.nodes = []; // TODO: If we have some init nodes?
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

    this.updateRunButtonPosition();

    this.setupKeybinds(this.renderer);
  }

  private createEdgeLayer(): void {
    if (this.edgeLayer) return;

    this.edgeLayer = new EdgeFrameBuffer(
      this.renderer,
      `${this.id}-edges`,
      () => this.edges,
      "⋯",
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

  private createRunButton(): void {
    if (this.runButton) return;

    const baseColor = RGBA.fromInts(0, 0, 0, 0);
    const downColor = RGBA.fromHex(LattePalette.red);
    const hoverColor = RGBA.fromHex(LattePalette.green);

    this.runButton = new BoxRenderable(this.renderer, {
      id: `${this.id}-run-button`,
      position: "absolute",
      top: this.rect.top + this.rect.height - 4,
      left: this.rect.left + this.rect.width - 12,
      width: 10,
      height: 3,
      border: true,
      borderStyle: "rounded",
      borderColor: LattePalette.peach,
      backgroundColor: baseColor,
      zIndex: 300,
      renderAfter: function (buffer) {
        const label = "Run";
        const textX =
          this.x + Math.max(1, Math.floor((this.width - label.length) / 2));
        const textY = this.y + Math.floor(this.height / 2);
        buffer.drawText(label, textX, textY, RGBA.fromHex(LattePalette.text));
      },
      onMouse: (event) => {
        switch (event.type) {
          case "down":
            if (event.button === 0) {
              this.isRunButtonPressed = true;
              this.runButton!.backgroundColor = downColor;
              event.stopPropagation();
            }
            break;
          case "up":
            if (event.button === 0 && this.isRunButtonPressed) {
              this.isRunButtonPressed = false;
              this.runButton!.backgroundColor = baseColor;
              void this.runWorkflow();
              event.stopPropagation();
            }
            break;
          case "over":
            if (!this.isRunButtonPressed) {
              this.runButton!.backgroundColor = hoverColor;
            }
            break;
          case "out":
            this.isRunButtonPressed = false;
            this.runButton!.backgroundColor = baseColor;
            break;
        }
      },
    });

    this.box!.add(this.runButton);
  }

  private updateRunButtonPosition(): void {
    if (!this.runButton) return;

    const padding = 1;
    const innerLeft = this.rect.left + 1;
    const innerTop = this.rect.top + 1;
    const innerWidth = Math.max(0, this.rect.width - 2);
    const innerHeight = Math.max(0, this.rect.height - 2);

    const buttonWidth = Math.max(1, Math.min(10, innerWidth));
    const buttonHeight = Math.max(1, Math.min(3, innerHeight));

    this.runButton.width = buttonWidth;
    this.runButton.height = buttonHeight;
    this.runButton.left =
      innerLeft + Math.max(0, innerWidth - this.runButton.width - padding);
    this.runButton.top =
      innerTop + Math.max(0, innerHeight - this.runButton.height - padding);
  }

  private async runWorkflow(): Promise<void> {
    if (this.nodes.length === 0) {
      console.log(`No nodes to run in FlowPane ${this.id}`);
      return;
    }

    console.log(`Starting workflow run for FlowPane ${this.id}`);

    const inDegree = new Map<SelectableBoxRenderable, number>();
    const adjacency = new Map<
      SelectableBoxRenderable,
      SelectableBoxRenderable[]
    >();

    this.nodes.forEach((node) => inDegree.set(node, 0));

    this.edges.forEach((edge) => {
      const target = edge.to as SelectableBoxRenderable;
      const source = edge.from as SelectableBoxRenderable;

      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
      const list = adjacency.get(source) ?? [];
      list.push(target);
      adjacency.set(source, list);
    });

    const queue: SelectableBoxRenderable[] = [];
    inDegree.forEach((value, node) => {
      if (value === 0) queue.push(node);
    });

    const executionOrder: SelectableBoxRenderable[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      executionOrder.push(current);
      const neighbors = adjacency.get(current) ?? [];
      neighbors.forEach((neighbor) => {
        const remaining = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, remaining);
        if (remaining === 0) {
          queue.push(neighbor);
        }
      });
    }

    if (executionOrder.length !== this.nodes.length) {
      console.log(
        `Workflow contains cycles or disconnected edges; running in insertion order for FlowPane ${this.id}`,
      );
      executionOrder.splice(0, executionOrder.length, ...this.nodes);
    }

    executionOrder.forEach((node, index) =>
      this.runNodePlaceholder(node, index + 1, executionOrder.length),
    );

    await this.sendRunRequest();

    console.log(`Workflow run completed for FlowPane ${this.id}`);
  }

  private async sendRunRequest(): Promise<void> {
    try {
      const response = await fetch("http://127.0.0.1:8000/run", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = (await response.json()) as { result?: string } | string;
      const resultMessage =
        typeof data === "string" ? data : (data.result ?? JSON.stringify(data));

      console.log(`[flow] Backend response: ${resultMessage}`);
    } catch (error) {
      console.error(`[flow] Failed to reach backend: ${String(error)}`);
    }
  }

  private runNodePlaceholder(
    node: SelectableBoxRenderable,
    step: number,
    total: number,
  ): void {
    const detail = this.nodeDetails.get(node);
    const nodeType = detail?.type ?? "Node";
    const nodeLabel = detail?.label ?? node.id;
    const originalColor = node.backgroundColor;

    node.backgroundColor = RGBA.fromHex(LattePalette.yellow);
    setTimeout(() => {
      node.backgroundColor = originalColor;
    }, 1000);

    console.log(
      `[workflow] (${step}/${total}) Executing ${nodeType} node "${nodeLabel}" in FlowPane ${this.id}`,
    );
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

  private connectNodes(
    from: SelectableBoxRenderable,
    to: SelectableBoxRenderable,
  ): void {
    const key = this.edgeKey(from, to);
    const alreadyConnected = this.edges.some(
      (edge) => this.edgeKey(edge.from, edge.to) === key,
    );

    if (alreadyConnected) return;

    this.edges.push({ from, to });
    from.setSelected(false);
    to.setSelected(false);
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
      x:
        this.rect.left +
        Math.max(0, Math.floor(((this.rect.width - 18) / 2) * Math.random())),
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
    this.nodes.push(newBox as SelectableBoxRenderable);
    this.nodeDetails.set(newBox as SelectableBoxRenderable, {
      type: value,
      label: nodeLabel,
    });
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
            this.nodes.forEach((box) => {
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
    if (this.nodes.length > 0) {
      this.nodes.forEach((box) => box.destroy());
      this.nodes = [];
    }
    this.edges = [];
    this.pendingConnectionNode = null;
    if (this.runButton) {
      this.box?.remove(this.runButton.id);
      this.runButton.destroy();
      this.runButton = null;
    }
    this.nodeDetails.clear();
    if (this.keybinds) {
      this.renderer.keyInput.off("keypress", this.keybinds);
      this.keybinds = null;
    }
    super.destroy(); // Destroy pane box
  }
}
