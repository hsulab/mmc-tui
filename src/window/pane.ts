import { BoxRenderable, CliRenderer } from "@opentui/core";

import { type Rect, type Direction, Node, Pane, Split } from "./base.ts";
import { FlowPane } from "./flow.ts";

import { StatusBar } from "../status.ts";

const basicPane = FlowPane;

export class PaneLayout {
  private renderer: CliRenderer;
  private keybinds: ((key: any) => void) | null = null;
  private statusBar: StatusBar | null = null;

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

    this.root = new basicPane(this.renderer, this.generateId(), true);
    this.root.collectPanes().forEach((p) => renderer.root.add(p.box));
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

  render() {
    // Draw the layout
    this.root.draw({
      top: 0,
      left: 0,
      width: this.width,
      height: this.height,
    });
    // Update status bar
    if (this.statusBar) {
      const panes = this.root.collectPanes();
      const activePane = panes.find((p) => p.active);
      this.statusBar.updateStatus(
        ` Panes: ${panes.length} | Active Pane: ${
          activePane ? activePane.id.slice(-12) : "None"
        } `,
      );
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
      this.renderer.root.remove(p.id);
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
        ids = this.renderer.root.getChildren().map((child) => child.id);
        this.closeActive();
        ids = this.renderer.root.getChildren().map((child) => child.id);
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

    const newPane = new basicPane(this.renderer, this.generateId(), true);

    activePane.active = false;

    this.root = this.replaceNode(
      this.root,
      activePane,
      new Split(direction, 0.5, activePane, newPane),
    );

    this.renderer.root.add(newPane.box);

    this.render();
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
    this.renderer.root.remove(activePane.id);

    this.root = this.replaceNode(this.root, parent, sibling);
    if (sibling instanceof Pane) {
      sibling.active = true;
    } else {
      const leaves = sibling.collectPanes();
      if (leaves[0]) {
        leaves[0].active = true;
      }
    }

    this.render();
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
      this.render();
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
          const r = this.renderer.root.getRenderable(p.id);
          if (r) r.visible = false;
        }
      });
    } else {
      this.root = this.prev;
      this.prev = null;
      panes.forEach((p) => {
        if (p !== activePane) {
          const r = this.renderer.root.getRenderable(p.id);
          if (r) r.visible = true;
        }
      });
    }

    this.render();
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

interface PaneRectInfo {
  pane: Pane;
  rect: Rect;
  center: { x: number; y: number };
}

interface PaneNeighbors {
  left?: Pane;
  right?: Pane;
  up?: Pane;
  down?: Pane;
}

function buildPaneNeighbors(
  renderer: CliRenderer,
  panes: Pane[],
): Map<Pane, PaneNeighbors> {
  const infos: PaneRectInfo[] = [];
  for (const pane of panes) {
    let box = renderer.root.getRenderable(pane.id);
    if (box instanceof BoxRenderable) {
      infos.push({
        pane,
        rect: pane.rect!,
        center: {
          x: pane.rect!.left + pane.rect!.width / 2,
          y: pane.rect!.top + pane.rect!.height / 2,
        },
      });
    }
  }

  const neighbors = new Map<Pane, PaneNeighbors>();

  const overlap = (a0: number, a1: number, b0: number, b1: number) =>
    Math.min(a1, b1) - Math.max(a0, b0);

  for (const a of infos) {
    let left, right, up, down;
    let bestL = Infinity,
      bestR = Infinity,
      bestU = Infinity,
      bestD = Infinity;

    for (const b of infos) {
      if (a === b) continue;
      const dx = b.center.x - a.center.x;
      const dy = b.center.y - a.center.y;
      const overlapX = overlap(
        a.rect.left,
        a.rect.left + a.rect.width,
        b.rect.left,
        b.rect.left + b.rect.width,
      );
      const overlapY = overlap(
        a.rect.top,
        a.rect.top + a.rect.height,
        b.rect.top,
        b.rect.top + b.rect.height,
      );

      // move left/right only if vertical overlap > 0
      if (dx < 0 && overlapY > 0 && -dx < bestL) {
        bestL = -dx;
        left = b.pane;
      }
      if (dx > 0 && overlapY > 0 && dx < bestR) {
        bestR = dx;
        right = b.pane;
      }

      // move up/down only if horizontal overlap > 0
      if (dy < 0 && overlapX > 0 && -dy < bestU) {
        bestU = -dy;
        up = b.pane;
      }
      if (dy > 0 && overlapX > 0 && dy < bestD) {
        bestD = dy;
        down = b.pane;
      }
    }

    neighbors.set(a.pane, { left, right, up, down });
  }

  return neighbors;
}
