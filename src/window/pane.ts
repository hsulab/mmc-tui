import {
  Box,
  Text,
  BoxRenderable,
  CliRenderer,
  type ProxiedVNode,
} from "@opentui/core";

import { LattePalette } from "../palette.ts";

type Direction = "horizontal" | "vertical";

type Rect = { top: number; left: number; width: number; height: number };

abstract class Node {
  abstract draw(renderer: CliRenderer, rect: Rect): void;
  abstract collectPanes(): Pane[];
}

class Pane extends Node {
  id: string;
  active: boolean;
  box: ProxiedVNode<typeof BoxRenderable>;
  rect: Rect | null = null;

  constructor(id: string, active: boolean = false) {
    super();
    this.id = id;
    this.active = active;
    this.box = Box(
      {
        id: this.id,
        visible: false,
        position: "absolute",
        flexGrow: 1,
      },
      Text({
        content: `pane-${this.id.slice(-12)}`,
        fg: LattePalette.text,
        attributes: 5,
      }),
    );
  }

  draw(renderer: CliRenderer, rect: Rect) {
    let box = renderer.root.getRenderable(this.id);
    if (box instanceof BoxRenderable) {
      box.visible = true;
      box.top = rect.top;
      box.left = rect.left;
      box.width = rect.width;
      box.height = rect.height;
      box.backgroundColor = this.active
        ? LattePalette.base
        : LattePalette.surface0;
      box.borderStyle = "rounded";
      box.borderColor = this.active ? LattePalette.peach : LattePalette.teal;
      // sync changes
      this.rect = rect;
    }
  }

  collectPanes() {
    return [this];
  }
}

class Split extends Node {
  direction: Direction;
  ratio: number;
  a: Node;
  b: Node;

  constructor(direction: Direction, ratio: number, a: Node, b: Node) {
    super();
    this.direction = direction;
    this.ratio = ratio;
    this.a = a;
    this.b = b;
  }

  draw(renderer: CliRenderer, rect: Rect) {
    if (this.direction === "vertical") {
      const wA = Math.floor(rect.width * this.ratio);
      const wB = rect.width - wA;
      this.a.draw(renderer, {
        top: rect.top,
        left: rect.left,
        width: wA,
        height: rect.height,
      });
      this.b.draw(renderer, {
        top: rect.top,
        left: rect.left + wA,
        width: wB,
        height: rect.height,
      });
    } else {
      const hA = Math.floor(rect.height * this.ratio);
      const hB = rect.height - hA;
      this.a.draw(renderer, {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: hA,
      });
      this.b.draw(renderer, {
        top: rect.top + hA,
        left: rect.left,
        width: rect.width,
        height: hB,
      });
    }
  }

  collectPanes() {
    return [...this.a.collectPanes(), ...this.b.collectPanes()];
  }
}

export class PaneLayout {
  private renderer: CliRenderer;
  private root: Node;

  private _width: number;
  private _height: number;

  constructor(renderer: CliRenderer, width: number, height: number) {
    this.renderer = renderer;

    this._width = width;
    this._height = height;

    this.root = new Split(
      "horizontal",
      0.5,
      new Pane(this.generateId(), true),
      new Pane(this.generateId(), false),
    );
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
    this.root.draw(this.renderer, {
      top: 0,
      left: 0,
      width: this.width,
      height: this.height,
    });
  }

  // Utilities
  splitActive(direction: Direction) {
    const panes = this.root.collectPanes();
    const activePane = panes.find((p) => p.active);
    if (!activePane) return;

    const newPane = new Pane(this.generateId(), true);
    this.renderer.root.add(newPane.box);

    activePane.active = false;

    this.root = this.replaceNode(
      this.root,
      activePane,
      new Split(direction, 0.5, activePane, newPane),
    );

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
