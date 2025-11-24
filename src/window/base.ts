import {
  CliRenderer,
  Box,
  Text,
  BoxRenderable,
  type ProxiedVNode,
} from "@opentui/core";

import { LattePalette } from "../palette.ts";

export type Direction = "horizontal" | "vertical";

export type Rect = { top: number; left: number; width: number; height: number };

export abstract class Node {
  abstract draw(renderer: CliRenderer, rect: Rect): void;
  abstract collectPanes(): Pane[];
}

export class Pane extends Node {
  id: string;
  active: boolean;
  box: ProxiedVNode<typeof BoxRenderable>;
  rect: Rect | null = null;

  constructor(id: string, active: boolean = false) {
    super();
    this.id = id;
    this.active = active;
    this.box = Box({
      id: this.id,
      zIndex: 0,
      visible: false,
      position: "absolute",
      flexGrow: 1,
      title: `${this.type}-${this.id.slice(-12)}`,
    });
  }

  get type(): string {
    return "base";
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

export class Split extends Node {
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
