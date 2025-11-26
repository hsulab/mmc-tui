/** The workflow pane allows users to create, manage, and visualize complex workflows through an intuitive interface.
 * It supports features such as adding tasks, connecting them with dependencies, and monitoring progress in real-time.
 * The pane is designed to enhance productivity by providing a clear overview of the workflow structure and status. */

import {
  RGBA,
  CliRenderer,
  BoxRenderable,
  type SelectOption,
} from "@opentui/core";

import { LattePalette } from "../palette.ts";
import type { Rect } from "../ui/geometry.ts";

import { Pane } from "./base.ts";
import { OverlaySelector } from "../ui/overlay.ts";

import { DraggableBox, type SelectableBoxRenderable } from "../flow/graph.ts";
import { EdgeFrameBuffer, type NodeEdge } from "../flow/edge.ts";
import { FlowNodeRegistry, type NodeSpec } from "../flow/registry.ts";

import { getBackendUrl } from "../config.ts";

export class FlowPane extends Pane {
  private keybinds: ((key: any) => void) | null = null;

  private edgeLayer: EdgeFrameBuffer | null = null;

  private nodes: SelectableBoxRenderable[] = []; // TODO: If we have some init nodes?
  private nodeDetails: Map<
    SelectableBoxRenderable,
    { type: string; label: string }
  > = new Map();
  private edges: NodeEdge[] = [];

  private pendingConnectionNode: SelectableBoxRenderable | null = null;

  private nodeIndex: number = 0;

  private panOffset = { x: 0, y: 0 };
  private zoomLevel = 1;
  private readonly zoomStep = 0.1;
  private readonly minZoom = 0.5;
  private readonly maxZoom = 2;

  private nodePositions: Map<
    SelectableBoxRenderable,
    { x: number; y: number }
  > = new Map();

  private runButton: BoxRenderable | null = null;
  private isRunButtonPressed = false;

  // Spinner for workflow run
  private runSpinner: BoxRenderable | null = null;
  private runSpinnerFrame = 0;
  private runSpinnerInterval: ReturnType<typeof setInterval> | null = null;
  private isWorkflowRunning = false;
  private readonly runSpinnerFrames = [
    "⠋",
    "⠙",
    "⠹",
    "⠸",
    "⠼",
    "⠴",
    "⠦",
    "⠧",
    "⠇",
    "⠏",
  ];

  // Node selector
  private nodeSelector: OverlaySelector | null = null;
  private readonly nodeDefinitions: Record<string, NodeSpec> = FlowNodeRegistry;

  private nodeOptions: SelectOption[] = Object.entries(
    this.nodeDefinitions,
  ).map(([name, definition]) => ({
    name,
    value: name,
    description: definition.description,
  }));

  constructor(
    renderer: CliRenderer,
    id: string,
    active: boolean = false,
    rect: Rect,
  ) {
    super(renderer, id, active, rect);

    this.createEdgeLayer();

    this.createNodeSelector();

    this.createRunButton();

    this.createRunSpinner();

    this.setStatusMessage("Ready");
  }

  override get type(): string {
    return "flow";
  }

  override draw(): void {
    super.draw();

    this.edgeLayer!.top = this.contentTop;
    this.edgeLayer!.left = 0;
    this.edgeLayer!.width = this.contentWidth;
    this.edgeLayer!.height = this.contentHeight;

    this.updateRunControlLayout();

    this.nodeSelector?.updateBounds(this.rect);

    this.applyViewTransform();

    this.setupKeybinds(this.renderer);
  }

  private get contentOrigin(): { x: number; y: number } {
    return { x: this.rect.left, y: this.rect.top + this.contentTop };
  }

  private createEdgeLayer(): void {
    if (this.edgeLayer) return;

    this.edgeLayer = new EdgeFrameBuffer(
      this.renderer,
      `${this.id}-edges`,
      () => this.edges,
      RGBA.fromHex(LattePalette.surface0),
    );
    this.edgeLayer.top = this.contentTop;
    this.edgeLayer.left = 0;
    this.edgeLayer.width = this.contentWidth;
    this.edgeLayer.height = this.contentHeight;

    this.box!.add(this.edgeLayer);
  }

  private createNodeSelector(): void {
    if (!this.box || this.nodeSelector) return;

    this.nodeSelector = new OverlaySelector(this.renderer, {
      id: `${this.id}-node-selector`,
      title: " Select Node Type ",
      options: this.nodeOptions,
      parent: this.box,
      onSelect: (option: SelectOption) => {
        this.createNodeFromSelection(option.value);
        this.nodeSelector!.hide();
        this.active = true; // Reactivate pane
        this.draw(); // Redraw border
      },
    });

    this.nodeSelector.updateBounds(this.rect);
  }

  private showNodeSelector(): void {
    this.nodeSelector?.show(this.rect);
  }

  private hideNodeSelector(): void {
    this.nodeSelector?.hide();
  }

  private createRunButton(): void {
    if (this.runButton || !this.statusBar) return;

    const baseColor = RGBA.fromInts(0, 0, 0, 0);
    const downColor = RGBA.fromHex(LattePalette.red);
    const hoverColor = RGBA.fromHex(LattePalette.green);

    this.runButton = new BoxRenderable(this.renderer, {
      id: `${this.id}-run-button`,
      position: "absolute",
      top: 0,
      left: 0,
      width: 8,
      height: this.statusBarHeight,
      border: false,
      borderStyle: "single",
      borderColor: LattePalette.peach,
      backgroundColor: baseColor,
      zIndex: 300,
      renderAfter: function (buffer) {
        const label = " Run ";
        const textX =
          this.x + Math.max(1, Math.floor((this.width - label.length) / 2));
        const textY = this.y;
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

    this.statusBar.add(this.runButton);
  }

  private createRunSpinner(): void {
    if (this.runSpinner || !this.statusBar) return;

    const baseColor = RGBA.fromInts(0, 0, 0, 0);

    this.runSpinner = new BoxRenderable(this.renderer, {
      id: `${this.id}-run-spinner`,
      position: "absolute",
      top: 0,
      left: 0,
      width: 2,
      height: this.statusBarHeight,
      border: false,
      backgroundColor: baseColor,
      zIndex: 301,
      renderAfter: (buffer) => {
        if (!this.isWorkflowRunning) return;

        const frame = this.runSpinnerFrames[this.runSpinnerFrame];
        const textX =
          this.runSpinner!.x +
          Math.max(0, Math.floor((this.runSpinner!.width - 1) / 2));
        const textY = this.runSpinner!.y;
        buffer.drawText(frame, textX, textY, RGBA.fromHex(LattePalette.green));
      },
    });

    this.runSpinner.visible = false;
    this.statusBar.add(this.runSpinner);
  }

  private updateRunControlLayout(): void {
    if (!this.statusBar || !this.runButton || !this.runSpinner) return;

    const padding = 1;
    const barWidth = this.statusBar.width;

    const buttonWidth = Math.max(6, Math.min(10, barWidth));
    this.runButton.width = buttonWidth;
    this.runButton.height = this.statusBarHeight;

    const spinnerWidth = this.runSpinner.width;
    this.runSpinner.height = this.statusBarHeight;

    const buttonLeft = Math.max(0, barWidth - buttonWidth - padding);
    const spinnerLeft = Math.max(0, buttonLeft - spinnerWidth - padding);

    this.runButton.left = buttonLeft;
    this.runButton.top = 0;

    this.runSpinner.left = spinnerLeft;
    this.runSpinner.top = 0;
  }

  private async runWorkflow(): Promise<void> {
    if (this.nodes.length === 0) {
      console.log(`No nodes to run in FlowPane ${this.id}`);
      return;
    }

    if (this.isWorkflowRunning) {
      console.log(`Workflow already running in FlowPane ${this.id}`);
      return;
    }

    this.setStatusMessage("Running workflow...");
    this.startRunSpinner();

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

    try {
      await this.sendRunRequest();

      console.log(`Workflow run completed for FlowPane ${this.id}`);
    } finally {
      this.stopRunSpinner();
      this.setStatusMessage("Ready");
    }
  }

  private startRunSpinner(): void {
    if (!this.runSpinner || this.runSpinnerInterval) return;

    this.isWorkflowRunning = true;
    this.runSpinner.visible = true;
    this.runSpinnerFrame = 0;
    this.runSpinner.requestRender();

    this.runSpinnerInterval = setInterval(() => {
      this.runSpinnerFrame =
        (this.runSpinnerFrame + 1) % this.runSpinnerFrames.length;
      this.runSpinner?.requestRender();
    }, 120);
  }

  private stopRunSpinner(): void {
    this.isWorkflowRunning = false;

    if (this.runSpinnerInterval) {
      clearInterval(this.runSpinnerInterval);
      this.runSpinnerInterval = null;
    }

    if (this.runSpinner) {
      this.runSpinner.visible = false;
      this.runSpinner.requestRender();
    }
  }

  private async sendRunRequest(): Promise<void> {
    // Fetch backend URL from config
    const backendUrl = getBackendUrl();
    const runEndpoint = `${backendUrl}/run`;

    // Send POST request to backend
    try {
      const response = await fetch(runEndpoint, {
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
      console.error(
        `[flow] Failed to reach backend (${runEndpoint}): ${String(error)}`,
      );
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
    // Check connection rules
    const fromDetail = this.nodeDetails.get(from);
    const toDetail = this.nodeDetails.get(to);

    if (!fromDetail || !toDetail) return;

    const fromDefinition = this.nodeDefinitions[fromDetail.type];
    const toDefinition = this.nodeDefinitions[toDetail.type];

    if (!fromDefinition || !toDefinition) return;

    if (!fromDefinition.allowedOutgoing.includes(toDetail.type)) {
      console.log(
        `Cannot connect ${fromDetail.type} to ${toDetail.type}: outgoing rules do not allow this link`,
      );
      return;
    }

    if (!toDefinition.allowedIncoming.includes(fromDetail.type)) {
      console.log(
        `Cannot connect ${fromDetail.type} to ${toDetail.type}: incoming rules for target disallow this link`,
      );
      return;
    }

    const outgoingCount = this.edges.filter(
      (edge) => edge.from === from,
    ).length;
    if (outgoingCount >= fromDefinition.maxOut) {
      console.log(
        `${fromDetail.label} cannot have more than ${fromDefinition.maxOut} outgoing connection(s)`,
      );
      return;
    }

    const incomingCount = this.edges.filter((edge) => edge.to === to).length;
    if (incomingCount >= toDefinition.maxIn) {
      console.log(
        `${toDetail.label} cannot accept more than ${toDefinition.maxIn} incoming connection(s)`,
      );
      return;
    }

    // Check for existing connection
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
    return `${a.id}->${b.id}`;
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
      y: this.rect.top + 2,
      width: 18,
      height: 5,
      label: nodeLabel,
      color: RGBA.fromHex(LattePalette.teal),
      onSelect: (box) =>
        this.handleNodeSelection(box as SelectableBoxRenderable),
      onDeselect: (box) =>
        this.handleNodeDeselection(box as SelectableBoxRenderable),
      onMove: (box) => {
        this.updateWorldPosition(box as SelectableBoxRenderable);
        this.requestEdgeRender();
      },
      selectedBorderColor: RGBA.fromHex(LattePalette.red),
    });
    this.box!.add(newBox);
    this.nodes.push(newBox as SelectableBoxRenderable);
    this.nodeDetails.set(newBox as SelectableBoxRenderable, {
      type: value,
      label: nodeLabel,
    });
    this.nodePositions.set(
      newBox as SelectableBoxRenderable,
      this.screenToWorld(newBox.x, newBox.y),
    );
    this.applyViewTransform();
    this.requestEdgeRender();
    console.log(`New ${nodeLabel} node created in FlowPane ${this.id}`);
  }

  private screenToWorld(x: number, y: number): { x: number; y: number } {
    const origin = this.contentOrigin;
    return {
      x: (x - origin.x) / this.zoomLevel - this.panOffset.x,
      y: (y - origin.y) / this.zoomLevel - this.panOffset.y,
    };
  }

  private worldToScreen(x: number, y: number): { x: number; y: number } {
    const origin = this.contentOrigin;
    return {
      x: Math.round(origin.x + (x + this.panOffset.x) * this.zoomLevel),
      y: Math.round(origin.y + (y + this.panOffset.y) * this.zoomLevel),
    };
  }

  private updateWorldPosition(node: SelectableBoxRenderable): void {
    this.nodePositions.set(
      node,
      this.screenToWorld(node.x ?? node.left ?? 0, node.y ?? node.top ?? 0),
    );
  }

  private applyViewTransform(): void {
    this.nodes.forEach((node) => {
      const position = this.nodePositions.get(node);
      if (!position) return;

      const { x, y } = this.worldToScreen(position.x, position.y);
      node.left = x;
      node.top = y;
    });

    this.requestEdgeRender();
  }

  private adjustZoom(delta: number): void {
    const nextZoom = Math.min(
      this.maxZoom,
      Math.max(this.minZoom, this.zoomLevel + delta),
    );

    if (nextZoom === this.zoomLevel) return;

    this.zoomLevel = nextZoom;
    console.log(
      `FlowPane ${this.id} zoom set to ${Math.round(nextZoom * 100)}%`,
    );
    this.applyViewTransform();
  }

  private panCanvas(dx: number, dy: number): void {
    this.panOffset.x += dx;
    this.panOffset.y += dy;
    console.log(
      `FlowPane ${this.id} panned to (${this.panOffset.x}, ${this.panOffset.y})`,
    );
    this.applyViewTransform();
  }

  private resetViewTransform(): void {
    this.zoomLevel = 1;
    this.panOffset = { x: 0, y: 0 };
    console.log(`FlowPane ${this.id} view reset`);
    this.applyViewTransform();
  }

  public setupKeybinds(renderer: CliRenderer): void {
    if (this.keybinds) return;

    this.keybinds = (key: any) => {
      // If selector is visible, selector takes priority
      if (this.nodeSelector?.isVisible) {
        switch (key.name) {
          case "n":
            this.hideNodeSelector();
            this.active = true; // Reactivate pane
            this.draw(); // Redraw border
            console.log(`Node selector closed in FlowPane ${this.id}`);
            return; // swallow
          case "escape":
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
          case "+":
          case "=":
            this.adjustZoom(this.zoomStep);
            return;
          case "-":
          case "_":
            this.adjustZoom(-this.zoomStep);
            return;
          case "0":
            this.resetViewTransform();
            return;
          case "left":
            this.panCanvas(-2, 0);
            return;
          case "right":
            this.panCanvas(2, 0);
            return;
          case "up":
            this.panCanvas(0, -1);
            return;
          case "down":
            this.panCanvas(0, 1);
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
    if (this.nodeSelector) {
      this.nodeSelector.destroy();
      this.nodeSelector = null;
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
    if (this.runSpinnerInterval) {
      clearInterval(this.runSpinnerInterval);
      this.runSpinnerInterval = null;
    }
    if (this.runSpinner) {
      this.box?.remove(this.runSpinner.id);
      this.runSpinner.destroy();
      this.runSpinner = null;
    }
    this.nodeDetails.clear();
    this.nodePositions.clear();
    if (this.keybinds) {
      this.renderer.keyInput.off("keypress", this.keybinds);
      this.keybinds = null;
    }
    super.destroy(); // Destroy pane box
  }
}
