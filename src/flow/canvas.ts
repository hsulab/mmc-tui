import { BoxRenderable, CliRenderer, RGBA } from "@opentui/core";

import { DraggableBox, type SelectableBoxRenderable } from "../flow/graph.ts";
import { EdgeFrameBuffer, type NodeEdge } from "../flow/edge.ts";
import { type NodeSpec } from "../flow/registry.ts";
import { LattePalette } from "../palette.ts";
import type { Rect } from "../ui/geometry.ts";
import { Spinner, type SpinnerSize, type SpinnerState } from "../ui/spinner.ts";

const NodeBoxWidth = 18;
const NodeBoxHeight = 5;

export class FlowCanvas {
  private edgeLayer: EdgeFrameBuffer;

  private nodes: SelectableBoxRenderable[] = [];
  private nodeDetails: Map<
    SelectableBoxRenderable,
    { type: string; label: string }
  > = new Map();
  private edges: NodeEdge[] = [];

  private nodeSpinners: Map<SelectableBoxRenderable, Spinner> = new Map();

  private pendingConnectionNode: SelectableBoxRenderable | null = null;

  private nodePositions: Map<
    SelectableBoxRenderable,
    { x: number; y: number }
  > = new Map();
  private nodeIndex = 0;

  private readonly spinnerSize: SpinnerSize;

  private readonly onNodeSelected?: (node: SelectableBoxRenderable) => void;

  private panOffset = { x: 0, y: 0 };
  private zoomLevel = 1;
  private readonly minZoom = 0.5;
  private readonly maxZoom = 2;

  private contentWidth = 0;
  private contentHeight = 0;

  private contentOrigin: { x: number; y: number } = { x: 0, y: 0 };
  private rect: Rect;

  constructor(
    private readonly renderer: CliRenderer,
    private readonly paneId: string,
    rect: Rect,
    contentTop: number,
    contentWidth: number,
    contentHeight: number,
    private readonly parent: BoxRenderable,
    private readonly nodeDefinitions: Record<string, NodeSpec>,
    spinnerSize: SpinnerSize,
    onNodeSelected?: (node: SelectableBoxRenderable) => void,
  ) {
    this.rect = rect;
    this.spinnerSize = spinnerSize;
    this.onNodeSelected = onNodeSelected;

    this.edgeLayer = new EdgeFrameBuffer(
      this.renderer,
      `${this.paneId}-edges`,
      () => this.edges,
      RGBA.fromHex(LattePalette.surface0),
    );

    this.updateLayout(rect, contentTop, contentWidth, contentHeight);

    this.parent.add(this.edgeLayer);
  }

  public updateLayout(
    rect: Rect,
    contentTop: number,
    contentWidth: number,
    contentHeight: number,
  ): void {
    this.rect = rect;
    this.contentWidth = contentWidth;
    this.contentHeight = contentHeight;
    this.contentOrigin = { x: rect.left, y: rect.top + contentTop };

    // Edge layer is relative to parent, so position at 0,0
    this.edgeLayer.top = 0;
    this.edgeLayer.left = 0;
    this.edgeLayer.width = contentWidth;
    this.edgeLayer.height = contentHeight;

    this.wrapNodePositions();
    this.applyViewTransform();
  }

  public destroy(): void {
    this.edgeLayer.destroy();
    this.nodes.forEach((node) => node.destroy());
    this.nodes = [];
    this.edges = [];
    this.nodeDetails.clear();
    this.nodePositions.clear();
    this.nodeSpinners.forEach((spinner) => spinner.destroy());
    this.nodeSpinners.clear();
  }

  public createNode(value: string): SelectableBoxRenderable {
    this.nodeIndex++;
    const nodeId = `${this.paneId}-${value.toLowerCase()}-${this.nodeIndex}`;
    const nodeLabel = `${value.toLocaleLowerCase()} #${this.nodeIndex}`;

    const maxX = Math.max(0, this.contentWidth - NodeBoxWidth);
    const maxY = Math.max(0, this.contentHeight - NodeBoxHeight);
    const worldX = Math.floor((Math.random() * (maxX + 1)) / 4);
    const worldY = Math.floor((Math.random() * (maxY + 1)) / 4);
    const { x: left, y: top } = this.worldToScreen(worldX, worldY);

    const newBox = DraggableBox(this.renderer, {
      id: nodeId,
      top: top,
      left: left,
      width: NodeBoxWidth,
      height: NodeBoxHeight,
      label: nodeLabel,
      color: RGBA.fromHex(LattePalette.teal),
      onSelect: (box) =>
        this.handleNodeSelection(box as SelectableBoxRenderable),
      onDeselect: (box) =>
        this.handleNodeDeselection(box as SelectableBoxRenderable),
      onMove: (box) => {
        this.updateWorldPosition(box as SelectableBoxRenderable);
        this.updateNodeSpinnerPosition(box as SelectableBoxRenderable);
        this.requestEdgeRender();
      },
      selectedBorderColor: RGBA.fromHex(LattePalette.red),
    });

    this.parent.add(newBox);
    this.nodes.push(newBox as SelectableBoxRenderable);
    this.nodeDetails.set(newBox as SelectableBoxRenderable, {
      type: value,
      label: nodeLabel,
    });
    this.createNodeSpinner(newBox as SelectableBoxRenderable);
    this.nodePositions.set(newBox as SelectableBoxRenderable, {
      x: worldX,
      y: worldY,
    });

    this.applyViewTransform();
    this.requestEdgeRender();
    console.log(`New ${nodeLabel} node created in FlowPane ${this.paneId}`);

    return newBox as SelectableBoxRenderable;
  }

  public getNodes(): SelectableBoxRenderable[] {
    return this.nodes;
  }

  public getEdges(): NodeEdge[] {
    return this.edges;
  }

  public getNodeDetail(
    node: SelectableBoxRenderable,
  ): { type: string; label: string } | undefined {
    return this.nodeDetails.get(node);
  }

  public setNodeSpinnerState(
    node: SelectableBoxRenderable,
    state: SpinnerState,
  ): void {
    this.nodeSpinners.get(node)?.setState(state);
  }

  public setAllNodeSpinnerStates(state: SpinnerState): void {
    this.nodeSpinners.forEach((spinner) => spinner.setState(state));
  }

  public setAllNodeColors(color: RGBA): void {
    this.nodes.forEach((box) => {
      box.backgroundColor = color;
    });
  }

  public adjustZoom(delta: number): void {
    const nextZoom = Math.min(
      this.maxZoom,
      Math.max(this.minZoom, this.zoomLevel + delta),
    );

    if (nextZoom === this.zoomLevel) return;

    this.zoomLevel = nextZoom;
    console.log(
      `FlowPane ${this.paneId} zoom set to ${Math.round(nextZoom * 100)}%`,
    );
    this.applyViewTransform();
  }

  public panCanvas(dx: number, dy: number): void {
    this.panOffset.x += dx;
    this.panOffset.y += dy;
    console.log(
      `FlowPane ${this.paneId} panned to (${this.panOffset.x}, ${this.panOffset.y})`,
    );
    this.applyViewTransform();
  }

  public resetViewTransform(): void {
    this.zoomLevel = 1;
    this.panOffset = { x: 0, y: 0 };
    console.log(`FlowPane ${this.paneId} view reset`);
    this.applyViewTransform();
  }

  private requestEdgeRender(): void {
    this.edgeLayer.requestRender();
  }

  private handleNodeSelection(node: SelectableBoxRenderable): void {
    const isConnecting =
      this.pendingConnectionNode !== null &&
      this.pendingConnectionNode !== node;

    if (isConnecting) {
      this.connectNodes(this.pendingConnectionNode!, node);
      this.pendingConnectionNode = null;
    } else {
      this.pendingConnectionNode = node;
    }

    if (!isConnecting) {
      this.onNodeSelected?.(node);
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

    const key = this.edgeKey(from, to);
    const alreadyConnected = this.edges.some(
      (edge) => this.edgeKey(edge.from, edge.to) === key,
    );

    if (alreadyConnected) return;

    this.edges.push({ from, to });
    from.setSelected(false);
    to.setSelected(false);
    console.log(`Linked ${from.id} -> ${to.id} in FlowPane ${this.paneId}`);
  }

  private edgeKey(a: BoxRenderable, b: BoxRenderable): string {
    return `${a.id}->${b.id}`;
  }

  private screenToWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.contentOrigin.x) / this.zoomLevel - this.panOffset.x,
      y: (y - this.contentOrigin.y) / this.zoomLevel - this.panOffset.y,
    };
  }

  private worldToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.round(
        this.contentOrigin.x + (x + this.panOffset.x) * this.zoomLevel,
      ),
      y: Math.round(
        this.contentOrigin.y + (y + this.panOffset.y) * this.zoomLevel,
      ),
    };
  }

  private updateWorldPosition(node: SelectableBoxRenderable): void {
    this.nodePositions.set(
      node,
      this.screenToWorld(node.x ?? node.left ?? 0, node.y ?? node.top ?? 0),
    );
  }

  private wrapNodePositions(): void {
    if (this.contentWidth <= 0 || this.contentHeight <= 0) return;

    const maxX = Math.max(0, this.contentWidth - NodeBoxWidth);
    const maxY = Math.max(0, this.contentHeight - NodeBoxHeight);

    this.nodePositions.forEach((position, node) => {
      const x = Math.min(maxX, Math.max(0, position.x));
      const y = Math.min(maxY, Math.max(0, position.y));

      if (x !== position.x || y !== position.y) {
        this.nodePositions.set(node, { x, y });
      }
    });
  }

  private createNodeSpinner(node: SelectableBoxRenderable): void {
    const spinner = new Spinner(this.renderer, {
      id: `${node.id}-spinner`,
      parent: this.parent,
      left: (node.left as number) ?? node.x ?? 0,
      top: (node.top as number) ?? node.y ?? 0,
      size: this.spinnerSize,
      zIndex: (node.zIndex ?? 0) + 1,
      visible: false,
    });

    this.nodeSpinners.set(node, spinner);
    this.updateNodeSpinnerPosition(node);
  }

  private updateNodeSpinnerPosition(node: SelectableBoxRenderable): void {
    const spinner = this.nodeSpinners.get(node);
    if (!spinner) return;

    const spinnerWidth = spinner.width;
    const spinnerHeight = spinner.height;

    const nodeLeft = (node.left as number) ?? node.x ?? 0;
    const nodeTop = (node.top as number) ?? node.y ?? 0;
    const nodeWidth = node.width ?? 0;
    const nodeHeight = node.height ?? 1;

    const left = nodeLeft + Math.max(1, nodeWidth - spinnerWidth - 1);
    const top =
      nodeTop + Math.max(0, Math.floor((nodeHeight - spinnerHeight) / 2));
    spinner.updateLayout(left, top);
  }

  private updateAllNodeSpinnerPositions(): void {
    this.nodes.forEach((node) => this.updateNodeSpinnerPosition(node));
  }

  private applyViewTransform(): void {
    this.nodes.forEach((node) => {
      const position = this.nodePositions.get(node);
      if (!position) return;

      const { x, y } = this.worldToScreen(position.x, position.y);
      node.left = x;
      node.top = y;
    });

    this.updateAllNodeSpinnerPositions();
    this.requestEdgeRender();
  }
}
