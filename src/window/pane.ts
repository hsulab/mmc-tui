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
        content: `pane-${this.id.slice(-8)}`,
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
      box.borderColor = this.active ? LattePalette.peach : LattePalette.teal;
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
      console.log(`${wA}  ${wB}  ${rect.left + wA}`);
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
}
