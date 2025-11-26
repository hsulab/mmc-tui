import { BoxRenderable, CliRenderer } from "@opentui/core";

import type { Rect, Direction } from "../ui/geometry.ts";
import { Node, Pane, Split } from "./base.ts";
import { FlowPane } from "./flow.ts";
import { ChartPane } from "./chart.ts";

import { StatusBar } from "../status.ts";

import { buildPaneNeighbors } from "./utils.ts";

export class LayoutManager {
  private renderer: CliRenderer;
  private keybinds: ((key: any) => void) | null = null;
  private statusBar: StatusBar | null = null;

  public windowContainer: BoxRenderable | null = null;

  private root: Node;
  private prev: Node | null = null;

  private _width: number;
  private _height: number;

  constructor(
    renderer: CliRenderer,
    width: number,
    height: number,
    statusBar: StatusBar | null = null,
  ) {
    this.renderer = renderer;

    this._width = width;
    this._height = height;

    this.statusBar = statusBar;

    this.windowContainer = new BoxRenderable(this.renderer, {
      id: "window-container",
      top: 0,
      left: 0,
      width: this._width,
      height: this._height,
      zIndex: 0,
      visible: true,
      position: "absolute",
      flexGrow: 1,
    });
    this.renderer.root.add(this.windowContainer);

    this.root = new FlowPane(this.renderer, this.generateId(), true, {
      top: 0,
      left: 0,
      width: this._width,
      height: this._height,
    });
    this.root.collectPanes().forEach((p) => this.windowContainer!.add(p.box));
    this.updateLayout();
  }

  get width(): number {
    return this._width;
  }

  set width(value: number) {
    this._width = value;
  }

  get height(): number {
    return this._height;
  }

  set height(value: number) {
    this._height = value;
  }

  private generateId(): string {
    return Bun.randomUUIDv7();
  }

  updateLayout() {
    this.root.updateRect({
      top: 0,
      left: 0,
      width: this.width,
      height: this.height,
    });
    this.root.draw();
    this.updateStatusBar();
    if (this.keybinds === null) {
      this.setupKeybinds();
    }
  }

  updateStatusBar() {
    if (this.statusBar) {
      const panes = this.root.collectPanes();
      const activePane = panes.find((p) => p.active);
      let message = ` Panes: ${panes.length} | Active Pane: ${
        activePane ? activePane.id.slice(-12) : "None"
      } `;
      if ("boxes" in activePane!) {
        message += `| Nodes: ${(activePane.boxes as BoxRenderable[]).length} `;
      }
      this.statusBar.updateStatus(message);
    }
  }

  destroy() {
    // Remove keybinds
    if (this.keybinds) {
      this.renderer.keyInput.off("keypress", this.keybinds);
      this.keybinds = null;
    }

    // TODO: Remove all panes from renderer properly
    const panes = this.root.collectPanes();
    panes.forEach((p) => {
      p.destroy();
    });
  }

  setupKeybinds() {
    this.keybinds = (key: any) => {
      if (key.name === "v" && key.ctrl) {
        this.splitActive("vertical");
      }
      if (key.name === "s" && key.ctrl) {
        this.splitActive("horizontal");
      }
      if (key.name === "q" && key.ctrl) {
        let ids: string[] = [];
        ids = this.windowContainer!.getChildren().map((child) => child.id);
        this.closeActive();
        ids = this.windowContainer!.getChildren().map((child) => child.id);
      }
      if (key.name === "linefeed") {
        // crtl + j
        this.moveActive("down");
      }
      if (key.name === "k" && key.ctrl) {
        this.moveActive("up");
      }
      if (key.name === "backspace") {
        // ctrl + h
        this.moveActive("left");
      }
      if (key.name === "l" && key.ctrl) {
        this.moveActive("right");
      }
      if (key.name === "z" && key.ctrl) {
        this.zoomActive();
      }
    };
    this.renderer.keyInput.on("keypress", this.keybinds);
  }

  // Utilities
  splitActive(direction: Direction) {
    const panes = this.root.collectPanes();
    const activePane = panes.find((p) => p.active);
    if (!activePane) return;

    let rectLeft: Rect = { ...activePane.rect! };
    if (direction === "horizontal") {
      rectLeft.height = rectLeft.height / 2;
    } else {
      rectLeft.width = rectLeft.width / 2;
    }
    let rectRight: Rect = { ...activePane.rect! };
    if (direction === "horizontal") {
      rectRight.top = rectRight.top + rectRight.height / 2;
      rectRight.height = rectRight.height / 2;
    } else {
      rectRight.left = rectRight.left + rectRight.width / 2;
      rectRight.width = rectRight.width / 2;
    }

    activePane.rect = rectLeft;
    const newPane = new ChartPane(
      this.renderer,
      this.generateId(),
      true,
      rectRight,
    );

    activePane.active = false;

    this.root = this.replaceNode(
      this.root,
      activePane,
      new Split(direction, 0.5, activePane, newPane),
    );

    this.windowContainer!.add(newPane.box);

    this.updateLayout();
  }

  closeActive() {
    const panes = this.root.collectPanes();
    const activePane = panes.find((p) => p.active);
    if (!activePane) return; // no pane is active

    const parentInfo = this.findParent(this.root, activePane);
    if (!parentInfo) return; // cannot remove the root

    const { parent, isLeft } = parentInfo;
    const sibling = isLeft ? (parent as Split).b : (parent as Split).a;

    // TODO: need cleanup func
    activePane.destroy(); // remove keybinds, etc.
    this.windowContainer!.remove(activePane.id);

    this.root = this.replaceNode(this.root, parent, sibling);
    if (sibling instanceof Pane) {
      sibling.active = true;
    } else {
      const leaves = sibling.collectPanes();
      if (leaves[0]) {
        leaves[0].active = true;
      }
    }

    this.updateLayout();
  }

  moveActive(dir: "up" | "down" | "left" | "right") {
    const panes = this.root.collectPanes();
    const activePane = panes.find((p) => p.active);
    if (!activePane) return;

    const neighbors = buildPaneNeighbors(this.renderer, panes);
    const neighborInfo = neighbors.get(activePane);
    if (!neighborInfo) return;

    let targetPane: Pane | undefined;
    switch (dir) {
      case "up":
        targetPane = neighborInfo.up;
        break;
      case "down":
        targetPane = neighborInfo.down;
        break;
      case "left":
        targetPane = neighborInfo.left;
        break;
      case "right":
        targetPane = neighborInfo.right;
        break;
    }

    if (targetPane) {
      activePane.active = false;
      targetPane.active = true;
      this.updateLayout();
    }
  }

  zoomActive() {
    const panes = this.root.collectPanes();
    const activePane = panes.find((p) => p.active);
    if (!activePane) return;

    if (this.prev === null) {
      this.prev = this.root;
      this.root = activePane;
      panes.forEach((p) => {
        if (p !== activePane) {
          const r = this.windowContainer!.getRenderable(p.id);
          if (r) r.visible = false;
        }
      });
    } else {
      this.root = this.prev;
      this.prev = null;
      panes.forEach((p) => {
        if (p !== activePane) {
          const r = this.windowContainer!.getRenderable(p.id);
          if (r) r.visible = true;
        }
      });
    }

    this.updateLayout();
  }

  private replaceNode(node: Node, target: Node, replacement: Node): Node {
    if (node === target) {
      return replacement;
    } else if (node instanceof Split) {
      const newA = this.replaceNode(node.a, target, replacement);
      const newB = this.replaceNode(node.b, target, replacement);
      return new Split(node.direction, node.ratio, newA, newB);
    } else {
      return node;
    }
  }

  private findParent(
    node: Node,
    target: Node,
    parent: Node | null = null,
    isLeft?: boolean,
  ): { parent: Node; isLeft: boolean } | null {
    if (node === target) {
      return parent ? { parent, isLeft: !!isLeft } : null;
    }
    if (node instanceof Split) {
      return (
        this.findParent(node.a, target, node, true) ||
        this.findParent(node.b, target, node, false)
      );
    }
    return null;
  }
}
