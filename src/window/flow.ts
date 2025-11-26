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

import { getBackendUrl } from "../config.ts";

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
  private selectorContainer: BoxRenderable | null = null;
  private selector: SelectRenderable | null = null;
  private nodeSelectorVisible: boolean = false;
  private readonly nodeDefinitions: Record<
    string,
    {
      description: string;
      maxIn: number;
      maxOut: number;
      allowedOutgoing: string[];
      allowedIncoming: string[];
    }
  > = {
    Build: {
      description: "  Build structures",
      maxIn: 0,
      maxOut: 1,
      allowedOutgoing: ["Compute"],
      allowedIncoming: [],
    },
    Compute: {
      description: "  Run calculation/simulation)",
      maxIn: 1,
      maxOut: 1,
      allowedOutgoing: ["Validate"],
      allowedIncoming: ["Build"],
    },
    Validate: {
      description: "  Analyze and verify data",
      maxIn: 1,
      maxOut: 0,
      allowedOutgoing: [],
      allowedIncoming: ["Compute"],
    },
  };

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

    this.createSelector();

    this.createRunButton();

    this.createRunSpinner();

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
      top: this.rect.top - 2,
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

  private createRunSpinner(): void {
    if (this.runSpinner) return;

    const baseColor = RGBA.fromInts(0, 0, 0, 0);

    this.runSpinner = new BoxRenderable(this.renderer, {
      id: `${this.id}-run-spinner`,
      position: "absolute",
      top: this.rect.top - 2,
      left: this.rect.left + this.rect.width - 14,
      width: 2,
      height: 3,
      border: false,
      backgroundColor: baseColor,
      zIndex: 301,
      renderAfter: (buffer) => {
        if (!this.isWorkflowRunning) return;

        const frame = this.runSpinnerFrames[this.runSpinnerFrame];
        const textX =
          this.runSpinner!.x +
          Math.max(0, Math.floor((this.runSpinner!.width - 1) / 2));
        const textY =
          this.runSpinner!.y + Math.floor(this.runSpinner!.height / 2);
        buffer.drawText(frame, textX, textY, RGBA.fromHex(LattePalette.green));
      },
    });

    this.runSpinner.visible = false;
    this.box!.add(this.runSpinner);
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
    this.runButton.top = innerTop + Math.max(0, padding);

    if (this.runSpinner) {
      const spinnerPadding = 1;
      const spinnerWidth = Math.max(1, Math.min(2, innerWidth));
      const spinnerHeight = buttonHeight;

      this.runSpinner.width = spinnerWidth;
      this.runSpinner.height = spinnerHeight;
      this.runSpinner.top = this.runButton.top;
      this.runSpinner.left =
        innerLeft +
        Math.max(
          0,
          innerWidth -
            this.runButton.width -
            spinnerWidth -
            padding -
            spinnerPadding,
        );
    }
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
    if (this.keybinds) {
      this.renderer.keyInput.off("keypress", this.keybinds);
      this.keybinds = null;
    }
    super.destroy(); // Destroy pane box
  }
}
