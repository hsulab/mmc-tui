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
import type { SelectableBoxRenderable } from "../flow/graph.ts";

import { Pane } from "./base.ts";
import { OverlaySelector } from "../ui/overlay.ts";
import { Spinner, type SpinnerSize } from "../ui/spinner.ts";

import { FlowNodeRegistry, type NodeSpec } from "../flow/registry.ts";

import { getBackendUrl, getConfig } from "../config.ts";
import { FlowCanvas } from "../flow/canvas.ts";

export class FlowPane extends Pane {
  private keybinds: ((key: any) => void) | null = null;

  private canvas: FlowCanvas | null = null;

  private runButton: BoxRenderable | null = null;
  private isRunButtonPressed = false;

  // Spinner for workflow run
  private runSpinner: Spinner | null = null;
  private isWorkflowRunning = false;

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

  private readonly spinnerSize: SpinnerSize;

  private readonly chartRequestHandler?: (chart: {
    title: string;
    xValues: number[];
    yValues: number[];
  }) => void;

  private nodeSimulationResults: Map<
    string,
    { time: number[]; temperature: number[] }
  > = new Map();

  constructor(
    renderer: CliRenderer,
    id: string,
    active: boolean = false,
    rect: Rect,
    chartRequestHandler?: (chart: {
      title: string;
      xValues: number[];
      yValues: number[];
    }) => void,
  ) {
    super(renderer, id, active, rect);

    this.spinnerSize = getConfig().spinnerSize;

    this.chartRequestHandler = chartRequestHandler;

    this.createNodeSelector();

    this.createRunButton();

    this.createRunSpinner();

    this.createCanvas();

    this.setStatusMessage("Ready");
  }

  override get type(): string {
    return "flow";
  }

  override draw(): void {
    super.draw();

    this.canvas?.updateLayout(
      this.rect,
      this.contentTop,
      this.contentWidth,
      this.contentHeight,
    );

    this.updateRunControlLayout();

    this.nodeSelector?.updateBounds(this.rect);

    this.setupKeybinds(this.renderer);
  }

  private createCanvas(): void {
    if (this.canvas || !this.box) return;

    this.canvas = new FlowCanvas(
      this.renderer,
      this.id,
      this.rect,
      this.contentTop,
      this.contentWidth,
      this.contentHeight,
      this.box,
      this.nodeDefinitions,
      this.spinnerSize,
      (node) => this.handleNodeSelectedForChart(node),
    );
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

    this.runSpinner = new Spinner(this.renderer, {
      id: `${this.id}-run-spinner`,
      parent: this.statusBar,
      left: 0,
      top: 0,
      size: this.spinnerSize,
      zIndex: 301,
      backgroundColor: RGBA.fromInts(0, 0, 0, 0),
      runningColor: RGBA.fromHex(LattePalette.green),
    });
  }

  private updateRunControlLayout(): void {
    if (!this.statusBar || !this.runButton || !this.runSpinner) return;

    const padding = 1;
    const barWidth = this.statusBar.width;

    // Adjust run button position
    const buttonWidth = Math.max(6, Math.min(10, barWidth));
    this.runButton.width = buttonWidth;
    this.runButton.height = this.statusBarHeight;

    const buttonLeft = Math.max(0, barWidth - buttonWidth - padding);
    this.runButton.top = this.rect.top;
    this.runButton.left = this.rect.left + buttonLeft;

    this.runButton.borderColor = this.active
      ? LattePalette.peach
      : LattePalette.teal;

    // Adjust spinner position
    const spinnerWidth = this.runSpinner.width;
    const spinnerHeight = Math.max(
      this.runSpinner.height,
      this.statusBarHeight,
    );

    const spinnerLeft = Math.max(0, buttonLeft - spinnerWidth - padding);

    this.runSpinner.updateLayout(
      this.rect.left + spinnerLeft,
      this.rect.top,
      spinnerWidth,
      spinnerHeight,
    );
  }

  private async runWorkflow(): Promise<void> {
    const nodes = this.canvas?.getNodes() ?? [];
    const edges = this.canvas?.getEdges() ?? [];

    if (nodes.length === 0) {
      console.log(`No nodes to run in FlowPane ${this.id}`);
      return;
    }

    if (this.isWorkflowRunning) {
      console.log(`Workflow already running in FlowPane ${this.id}`);
      return;
    }

    this.setStatusMessage("Running workflow...");
    this.startRunSpinner();
    this.canvas?.setAllNodeSpinnerStates("queued");

    console.log(`Starting workflow run for FlowPane ${this.id}`);

    const inDegree = new Map<SelectableBoxRenderable, number>();
    const adjacency = new Map<
      SelectableBoxRenderable,
      SelectableBoxRenderable[]
    >();

    nodes.forEach((node) => inDegree.set(node, 0));

    edges.forEach((edge) => {
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

    if (executionOrder.length !== nodes.length) {
      console.log(
        `Workflow contains cycles or disconnected edges; running in insertion order for FlowPane ${this.id}`,
      );
      executionOrder.splice(0, executionOrder.length, ...nodes);
    }

    try {
      for (let i = 0; i < executionOrder.length; i++) {
        const node = executionOrder[i];
        await this.runNode(node!, i + 1, executionOrder.length);
      }

      console.log(`Workflow run completed for FlowPane ${this.id}`);
    } finally {
      this.canvas?.setAllNodeSpinnerStates("idle");
      this.stopRunSpinner();
      this.setStatusMessage("Ready");
    }
  }

  private startRunSpinner(): void {
    if (!this.runSpinner || this.isWorkflowRunning) return;

    this.isWorkflowRunning = true;
    // this.runSpinner.setState("running");
    this.runSpinner.setState("idle");
  }

  private stopRunSpinner(): void {
    this.isWorkflowRunning = false;

    this.runSpinner?.setState("idle");
  }

  private async sendRunRequest(nodeInfo?: {
    id: string;
    type: string;
    label: string;
    step: number;
    total: number;
  }): Promise<boolean> {
    // Fetch backend URL from config
    const backendUrl = getBackendUrl();
    const runEndpoint = `${backendUrl}/run`;

    // Send POST request to backend
    try {
      const response = await fetch(runEndpoint, {
        method: "POST",
        headers: nodeInfo
          ? {
              "Content-Type": "application/json",
            }
          : undefined,
        body: nodeInfo
          ? JSON.stringify({
              nodeId: nodeInfo.id,
              nodeType: nodeInfo.type,
              nodeLabel: nodeInfo.label,
              step: nodeInfo.step,
              totalSteps: nodeInfo.total,
            })
          : undefined,
      });

      if (!response.ok) {
        console.error(
          `[flow] Backend request failed with status ${response.status} for node ${nodeInfo?.label ?? "unknown"}`,
        );
        return false;
      }

      const data = (await response.json()) as { result?: string } | string;
      const resultMessage =
        typeof data === "string" ? data : (data.result ?? JSON.stringify(data));

      const nodeDescription = nodeInfo
        ? `${nodeInfo.type} node "${nodeInfo.label}" (${nodeInfo.step}/${nodeInfo.total})`
        : "workflow";

      console.log(
        `[flow] Backend response for ${nodeDescription}: ${resultMessage}`,
      );
      return true;
    } catch (error) {
      console.error(
        `[flow] Failed to reach backend (${runEndpoint}): ${String(error)}`,
      );
      return false;
    }
  }

  private async runNode(
    node: SelectableBoxRenderable,
    step: number,
    total: number,
  ): Promise<void> {
    const detail = this.canvas?.getNodeDetail(node);
    const nodeType = detail?.type ?? "Node";
    const nodeLabel = detail?.label ?? node.id;
    const originalColor = node.backgroundColor;

    this.canvas?.setNodeSpinnerState(node, "running");

    // node.backgroundColor = RGBA.fromHex(LattePalette.yellow);

    console.log(
      `[workflow] (${step}/${total}) Executing ${nodeType} node "${nodeLabel}" in FlowPane ${this.id}`,
    );

    const success = await this.sendRunRequest({
      id: node.id,
      type: nodeType,
      label: nodeLabel,
      step,
      total,
    });

    node.backgroundColor = originalColor;
    this.canvas?.setNodeSpinnerState(node, success ? "success" : "error");

    if (success && nodeType === "Compute") {
      const simulationData = await this.fetchSimulationData(node.id);
      if (simulationData) {
        this.nodeSimulationResults.set(node.id, simulationData);
        console.log(
          `[workflow] Stored simulation data for ${nodeLabel} (${node.id})`,
        );
        this.setStatusMessage(`Simulation ready for ${nodeLabel}`);
      }
    }
  }

  private createNodeFromSelection(value: string): void {
    this.canvas?.createNode(value);
  }

  private async fetchSimulationData(
    nodeId: string,
  ): Promise<{ time: number[]; temperature: number[] } | null> {
    const backendUrl = getBackendUrl();
    const simulationEndpoint = `${backendUrl}/simulation/${encodeURIComponent(nodeId)}`;

    try {
      const response = await fetch(simulationEndpoint);
      if (!response.ok) {
        console.error(
          `[flow] Backend request for simulation data failed with status ${response.status} (node ${nodeId})`,
        );
        return null;
      }

      const payload = (await response.json()) as
        | { data?: number[][] }
        | number[][];
      const series = Array.isArray(payload) ? payload : payload.data;

      if (!Array.isArray(series) || series.length < 2) {
        console.warn(`[flow] Invalid simulation payload for node ${nodeId}`);
        return null;
      }

      const [time, temperature] = series;
      if (!Array.isArray(time) || !Array.isArray(temperature)) {
        console.warn(
          `[flow] Simulation payload missing arrays for node ${nodeId}`,
        );
        return null;
      }

      return {
        time: time.map(Number),
        temperature: temperature.map(Number),
      };
    } catch (error) {
      console.error(
        `[flow] Failed to fetch simulation data from ${simulationEndpoint}: ${String(error)}`,
      );
      return null;
    }
  }

  private handleNodeSelectedForChart(node: SelectableBoxRenderable): void {
    const detail = this.canvas?.getNodeDetail(node);
    if (!detail) return;

    const stored = this.nodeSimulationResults.get(node.id);
    if (!stored) {
      return;
    }

    if (!this.chartRequestHandler) {
      console.warn(`[flow] Chart request handler is not configured`);
      return;
    }

    this.chartRequestHandler({
      title: `${detail.type}: ${detail.label}`,
      xValues: stored.time,
      yValues: stored.temperature,
    });

    this.setStatusMessage(`Plotted simulation for ${detail.label}`);
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
            this.canvas?.setAllNodeColors(RGBA.fromHex(LattePalette.peach));
            console.log(`All node colors updated in FlowPane ${this.id}`);
            return;
          case "+":
          case "=":
            this.canvas?.adjustZoom(0.1);
            return;
          case "-":
          case "_":
            this.canvas?.adjustZoom(-0.1);
            return;
          case "0":
            this.canvas?.resetViewTransform();
            return;
          case "left":
            this.canvas?.panCanvas(-2, 0);
            return;
          case "right":
            this.canvas?.panCanvas(2, 0);
            return;
          case "up":
            this.canvas?.panCanvas(0, -1);
            return;
          case "down":
            this.canvas?.panCanvas(0, 1);
            return;
        }
      }
    };

    renderer.keyInput.on("keypress", this.keybinds);
  }

  override destroy(): void {
    this.canvas?.destroy();
    this.canvas = null;
    if (this.nodeSelector) {
      this.nodeSelector.destroy();
      this.nodeSelector = null;
    }
    if (this.runButton) {
      this.box?.remove(this.runButton.id);
      this.runButton.destroy();
      this.runButton = null;
    }
    if (this.runSpinner) {
      this.runSpinner.destroy();
      this.runSpinner = null;
    }
    if (this.keybinds) {
      this.renderer.keyInput.off("keypress", this.keybinds);
      this.keybinds = null;
    }
    super.destroy(); // Destroy pane box
  }
}
