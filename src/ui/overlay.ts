import {
  BoxRenderable,
  CliRenderer,
  SelectRenderable,
  SelectRenderableEvents,
  type SelectOption,
} from "@opentui/core";

import { LattePalette } from "../palette.ts";
// import { type Rect } from "./base.ts";
type Rect = { top: number; left: number; width: number; height: number };

export type OverlaySelectorConfig = {
  id: string;
  title: string;
  options: SelectOption[];
  parent: BoxRenderable;
  width?: number;
  minHeight?: number;
  closeOnSelect?: boolean;
  onSelect: (option: SelectOption) => void;
};

export class OverlaySelector {
  private readonly renderer: CliRenderer;
  private readonly config: OverlaySelectorConfig;
  private readonly baseWidth: number;
  private readonly minHeight: number;
  private readonly selectorHeight: number;

  private readonly container: BoxRenderable;
  private readonly selector: SelectRenderable;
  private visible: boolean = false;

  constructor(renderer: CliRenderer, config: OverlaySelectorConfig) {
    this.renderer = renderer;
    this.config = config;
    this.baseWidth = config.width ?? 36;
    this.minHeight = config.minHeight ?? 8;
    this.selectorHeight = Math.max(
      this.minHeight,
      config.options.length * 2 + 2,
    );

    this.container = new BoxRenderable(this.renderer, {
      id: `${config.id}-container`,
      title: config.title,
      position: "absolute",
      top: 0,
      left: 0,
      width: this.baseWidth,
      height: this.selectorHeight,
      border: true,
      borderStyle: "rounded",
      borderColor: LattePalette.peach,
      backgroundColor: LattePalette.surface0,
      zIndex: 400,
    });

    this.selector = new SelectRenderable(this.renderer, {
      id: `${config.id}-selector`,
      top: 0,
      left: 0,
      width: Math.max(0, this.baseWidth - 2),
      height: Math.max(0, this.selectorHeight - 2),
      zIndex: 401,
      options: config.options,
      backgroundColor: LattePalette.surface0,
      textColor: LattePalette.text,
      focusedBackgroundColor: LattePalette.surface0,
      focusedTextColor: LattePalette.text,
      selectedBackgroundColor: LattePalette.peach,
      selectedTextColor: LattePalette.text,
      descriptionColor: LattePalette.subtext0,
      selectedDescriptionColor: LattePalette.text,
      showDescription: true,
      showScrollIndicator: false,
      wrapSelection: true,
    });

    this.selector.on(SelectRenderableEvents.ITEM_SELECTED, (_index, option) => {
      config.onSelect(option);
      if (config.closeOnSelect ?? true) {
        this.hide();
      }
    });

    this.container.visible = false;
    this.selector.visible = false;
    this.selector.blur();

    this.container.add(this.selector);
    this.config.parent.add(this.container);
  }

  get isVisible(): boolean {
    return this.visible;
  }

  updateBounds(rect: Rect): void {
    const innerLeft = rect.left + 1;
    const innerTop = rect.top + 1;
    const innerWidth = Math.max(0, rect.width - 2);
    const innerHeight = Math.max(0, rect.height - 2);

    const newWidth = Math.min(this.baseWidth, innerWidth);
    const newHeight = Math.min(this.selectorHeight, innerHeight);

    this.container.width = newWidth;
    this.container.height = newHeight;
    this.container.left =
      innerLeft + Math.max(0, Math.floor((innerWidth - newWidth) / 2));
    this.container.top =
      innerTop + Math.max(0, Math.floor((innerHeight - newHeight) / 2));

    this.selector.width = Math.max(0, this.container.width - 2);
    this.selector.height = Math.max(0, this.container.height - 2);
  }

  show(rect: Rect): void {
    this.updateBounds(rect);

    this.container.visible = true;
    this.selector.visible = true;
    this.selector.focus();
    this.visible = true;
  }

  hide(): void {
    this.selector.blur();
    this.selector.visible = false;
    this.container.visible = false;
    this.visible = false;
  }

  destroy(): void {
    this.config.parent.remove(this.container.id);
    this.selector.destroy();
    this.container.destroy();
  }
}
