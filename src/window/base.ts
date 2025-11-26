import { CliRenderer, BoxRenderable, RGBA } from "@opentui/core";

import { LattePalette } from "../palette.ts";

export type Direction = "horizontal" | "vertical";

export type Rect = { top: number; left: number; width: number; height: number };

export abstract class Node {
  abstract draw(): void;
  abstract updateRect(rect: Rect): void;
  abstract collectPanes(): Pane[];
  abstract destroy(): void;
}

export class Pane extends Node {
  protected renderer: CliRenderer;

  id: string;
  active: boolean;
  box: BoxRenderable | null;
  rect: Rect;

  protected statusBar: BoxRenderable | null = null;
  protected statusMessage: string = "";
  protected readonly statusBarHeight = 1;

  constructor(renderer: CliRenderer, id: string, active: boolean, rect: Rect) {
    super();
    this.renderer = renderer;

    this.id = id;
    this.active = active;

    this.rect = rect;

    this.box = null;
    this.createBox();
    this.createStatusBar();
  }

  get type(): string {
    return "base";
  }

  createBox(): void {
    const { top, left, width, height } = this.rect;
    this.box = new BoxRenderable(this.renderer, {
      id: this.id,
      top: top,
      left: left,
      width: width,
      height: height,
      zIndex: 0,
      visible: false,
      position: "absolute",
      flexGrow: 1,
      title: `${this.type}-${this.id.slice(-12)}`,
      backgroundColor: this.active ? LattePalette.base : LattePalette.base,
      borderStyle: "rounded",
      borderColor: this.active ? LattePalette.peach : LattePalette.teal,
    });
  }

  protected createStatusBar(): void {
    if (!this.box || this.statusBar) return;

    this.statusBar = new BoxRenderable(this.renderer, {
      id: `${this.id}-status-bar`,
      position: "absolute",
      top: 0,
      left: 0,
      width: this.innerWidth,
      height: this.statusBarHeight,
      backgroundColor: LattePalette.surface1,
      border: false,
      zIndex: 2,
      renderAfter: (buffer) => {
        const labelParts = [
          // `${this.type}-${this.id.slice(-6)}`,
          this.statusMessage,
        ].filter(Boolean);
        const label = ` ${labelParts.join(" | ")} `;
        const textX = this.statusBar!.x + 1;
        const textY = this.statusBar!.y;
        buffer.drawText(label, textX, textY, RGBA.fromHex(LattePalette.text));
      },
    });

    this.box.add(this.statusBar);
  }

  protected updateStatusBarLayout(): void {
    if (!this.statusBar) return;

    this.statusBar.top = 0;
    this.statusBar.left = 0;
    this.statusBar.width = this.innerWidth;
    this.statusBar.height = this.statusBarHeight;
    this.statusBar.requestRender();
  }

  protected setStatusMessage(message: string): void {
    this.statusMessage = message;
    this.statusBar?.requestRender();
  }

  protected updateBoxLayout(): void {
    if (!this.box) return;

    const { top, left, width, height } = this.rect;

    this.box.visible = true;
    this.box.top = top;
    this.box.left = left;
    this.box.width = width;
    this.box.height = height;
    this.box.backgroundColor = this.active
      ? LattePalette.base
      : LattePalette.base;
    this.box.borderStyle = "rounded";
    this.box.borderColor = this.active ? LattePalette.peach : LattePalette.teal;
    this.box.requestRender();
  }

  protected get innerWidth(): number {
    return Math.max(0, this.rect.width - 2);
  }

  protected get innerHeight(): number {
    return Math.max(0, this.rect.height - 2);
  }

  protected get contentTop(): number {
    return this.statusBarHeight;
  }

  protected get contentHeight(): number {
    return Math.max(0, this.innerHeight - this.statusBarHeight);
  }

  protected get contentWidth(): number {
    return this.innerWidth;
  }

  updateRect(rect: Rect) {
    this.rect = rect;
  }

  draw() {
    this.updateStatusBarLayout();
    this.updateBoxLayout();
  }

  collectPanes() {
    return [this];
  }

  destroy(): void {
    if (this.box) {
      this.renderer.root.remove(this.box.id);
      this.box.destroy();
      this.box = null;
    }
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

  updateRect(rect: Rect) {
    const rectLeft = { ...rect };
    const rectRight = { ...rect };
    if (this.direction === "vertical") {
      const wA = Math.floor(rect.width * this.ratio);
      const wB = rect.width - wA;
      rectLeft.width = wA;
      rectRight.left = rect.left + wA;
      rectRight.width = wB;
    } else {
      const hA = Math.floor(rect.height * this.ratio);
      const hB = rect.height - hA;
      rectLeft.height = hA;
      rectRight.top = rect.top + hA;
      rectRight.height = hB;
    }
    this.a.updateRect(rectLeft);
    this.b.updateRect(rectRight);
  }

  draw() {
    this.a.draw();
    this.b.draw();
  }

  collectPanes() {
    return [...this.a.collectPanes(), ...this.b.collectPanes()];
  }

  /** Destroy both child nodes
   *  This may not be used as we cane always access the pane from the manager.
   */
  destroy(): void {
    this.a.destroy();
    this.b.destroy();
  }
}
