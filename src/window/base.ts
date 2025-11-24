import {
  CliRenderer,
  Box,
  BoxRenderable,
  type ProxiedVNode,
} from "@opentui/core";

import { LattePalette } from "../palette.ts";

export type Direction = "horizontal" | "vertical";

export type Rect = { top: number; left: number; width: number; height: number };

export abstract class Node {
  abstract draw(rect: Rect): void;
  abstract collectPanes(): Pane[];
}

export class Pane extends Node {
  protected renderer: CliRenderer;

  id: string;
  active: boolean;
  box: BoxRenderable;
  rect: Rect | null = null;

  constructor(renderer: CliRenderer, id: string, active: boolean = false) {
    super();
    this.renderer = renderer;

    this.id = id;
    this.active = active;
    this.box = new BoxRenderable(this.renderer, {
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

  draw(rect: Rect) {
    // sync box properties
    this.box.visible = true;
    this.box.top = rect.top;
    this.box.left = rect.left;
    this.box.width = rect.width;
    this.box.height = rect.height;
    this.box.backgroundColor = this.active
      ? LattePalette.base
      : LattePalette.surface0;
    this.box.borderStyle = "rounded";
    this.box.borderColor = this.active ? LattePalette.peach : LattePalette.teal;
    // sync changes
    this.rect = rect;
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

  draw(rect: Rect) {
    if (this.direction === "vertical") {
      const wA = Math.floor(rect.width * this.ratio);
      const wB = rect.width - wA;
      this.a.draw({
        top: rect.top,
        left: rect.left,
        width: wA,
        height: rect.height,
      });
      this.b.draw({
        top: rect.top,
        left: rect.left + wA,
        width: wB,
        height: rect.height,
      });
    } else {
      const hA = Math.floor(rect.height * this.ratio);
      const hB = rect.height - hA;
      this.a.draw({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: hA,
      });
      this.b.draw({
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
