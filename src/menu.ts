import {
  BoxRenderable,
  ASCIIFontRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  CliRenderer,
  type SelectOption,
} from "@opentui/core";

import { LattePalette } from "./palette.ts";

const selectOptions: SelectOption[] = [
  {
    name: "New    Project",
    value: "create_new",
    description: "  Create a new project",
  },
  {
    name: "Recent Projects",
    value: "open_recent",
    description: "  Open a recent project",
  },
  {
    name: "Quit",
    value: "exit_app",
    description: "  Exit the app :(",
  },
];

/**
 * Main menu component
 */
export class MainMenu {
  private renderer: CliRenderer;

  private appName: ASCIIFontRenderable | null = null;
  private container: BoxRenderable | null = null;
  private selector: SelectRenderable | null = null;

  private _width: number;
  private _height: number;

  constructor(
    renderer: CliRenderer,
    width: number = 80,
    height: number = 24,
    private onAction: (value: string) => void = () => {},
  ) {
    this.renderer = renderer;

    this._width = width;
    this._height = height;

    this.onAction = onAction;
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

  public createMenu() {
    const renderer = this.renderer;
    // Check if main menu already exists
    if (renderer.root.getRenderable("main-menu-container")) {
      console.warn("Main menu already rendered.");
      return;
    }

    // Add main menu items here
    this.container = new BoxRenderable(renderer, {
      id: "main-menu-container",
      position: "absolute",
      top: 5,
      left: 25,
      flexDirection: "row",
      alignItems: "stretch",
      zIndex: 0,
    });
    renderer.root.add(this.container);

    this.appName = new ASCIIFontRenderable(renderer, {
      id: "main-menu-app-name",
      text: "MMC-TUI",
      font: "tiny",
      color: LattePalette.text,
      backgroundColor: LattePalette.base,
      zIndex: 0,
      selectable: false,
    });
    this.container.add(this.appName);

    // add selection
    this.selector = new SelectRenderable(renderer, {
      id: "main-menu-selector",
      position: "absolute",
      left: 12,
      top: 8,
      width: 50,
      height: 2 * selectOptions.length,
      options: selectOptions,
      zIndex: 0,
      backgroundColor: LattePalette.base,
      focusedBackgroundColor: LattePalette.mantle,
      textColor: LattePalette.text,
      focusedTextColor: LattePalette.text,
      selectedBackgroundColor: LattePalette.peach,
      selectedTextColor: LattePalette.text,
      showDescription: true,
      showScrollIndicator: true,
      wrapSelection: false,
      fastScrollStep: 3,
    });
    this.container.add(this.selector);

    this.selector.on(
      SelectRenderableEvents.ITEM_SELECTED,
      (_: number, option: SelectOption) => {
        this.selector!.blur(); // Blur the selector on item selection
        console.log(`Menu item activated: ${option.name}`);
        // Deal with the action here
        this.onAction(option.value);
      },
    );

    this.selector.focus();
  }

  public showMenuComponents() {
    if (this.appName) {
      this.appName.visible = true;
    }
    if (this.container) {
      this.container.visible = true;
    }
    if (this.selector) {
      this.selector.visible = true;
      this.selector.focus();
    }
  }

  public hideMenuComponents() {
    if (this.appName) {
      this.appName.visible = false;
    }
    if (this.container) {
      this.container.visible = false;
    }
    if (this.selector) {
      this.selector.visible = false;
    }
    // Trigger a re-render so the hidden menu components are cleared from the screen
    // before other UI elements (like the window manager) draw over the same area.
    this.renderer.requestRender();
  }

  public destroyMenuComponents() {
    if (this.appName) {
      this.appName.destroy();
    }
    if (this.selector) {
      this.selector.destroy();
    }
    if (this.container) {
      this.container.destroy();
      this.renderer.root.remove(this.container.id);
    }

    this.container = null;
    this.selector = null;
    this.appName = null;

    const children = this.renderer.root.getChildren();
    for (const child of children) {
      console.log(`Remaining child in root: ${typeof child}  ${child.id}`);
    }

    this.renderer.requestRender();
  }
}
