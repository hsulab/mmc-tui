import { CliRenderer, TextRenderable } from "@opentui/core";

import { LattePalette } from "./palette.ts";

export class StatusBar {
  private renderer: CliRenderer;
  private statusText: TextRenderable | null = null;

  private _width: number;
  private _height: number;

  constructor(renderer: CliRenderer, width: number, height: number) {
    this.renderer = renderer;

    this._width = width;
    this._height = height;
  }

  get width(): number {
    return this._width;
  }

  set width(value: number) {
    this._width = value;
    if (this.statusText) {
      this.statusText.width = value;
    }
  }

  get height(): number {
    return this._height;
  }

  set height(value: number) {
    this._height = value;
    if (this.statusText) {
      this.statusText.top = value - 1;
    }
  }

  public createStatusBar(): void {
    this.statusText = new TextRenderable(this.renderer, {
      position: "absolute",
      top: this.height - 1,
      left: 0,
      width: this.width,
      height: 1,
      content: " Status: Ready ",
      fg: LattePalette.text,
      bg: LattePalette.surface2,
      zIndex: 10,
    });

    this.renderer.root.add(this.statusText);
    this.statusText.visible = false;
  }

  public hideStatusBar(): void {
    if (this.statusText) {
      this.statusText.visible = false;
    }
  }

  public showStatusBar(): void {
    if (this.statusText) {
      this.statusText.visible = true;
    }
  }

  public updateStatus(message: string): void {
    if (this.statusText) {
      this.statusText.content = ` Status: ${message} `;
    }
  }

  public updateLayout(width: number, height: number): void {
    this.statusText!.top = height - 1;
    this.statusText!.width = width;
  }
}
