import {
  BoxRenderable,
  TextRenderable,
  ASCIIFontRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  CliRenderer,
  t,
  fg,
  type SelectOption,
  type KeyEvent,
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
  public appState: { isMainMenuOpen: boolean };

  private renderer: CliRenderer;

  private _width: number;
  private _height: number;

  constructor(
    renderer: CliRenderer,
    appState: { isMainMenuOpen: boolean },
    width: number = 80,
    height: number = 24,
  ) {
    this.renderer = renderer;
    this.appState = appState;

    this._width = width;
    this._height = height;
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

  /**
   * Render the main menu
   */
  render() {
    const renderer = this.renderer;
    // Check if main menu already exists
    if (renderer.root.getRenderable("main-menu-container")) {
      console.warn("Main menu already rendered.");
      return;
    }

    // Add main menu items here
    const mainMenuContainer = new BoxRenderable(renderer, {
      id: "main-menu-container",
      position: "absolute",
      top: 5,
      left: 25,
      flexDirection: "row",
      alignItems: "stretch",
      zIndex: 10,
    });
    renderer.root.add(mainMenuContainer);

    const appName = new ASCIIFontRenderable(renderer, {
      id: "main-menu-app-name",
      text: "MMC-TUI",
      font: "tiny",
      color: LattePalette.text,
      backgroundColor: LattePalette.base,
      zIndex: 100,
      selectable: false,
    });
    mainMenuContainer.add(appName);

    // add selection
    const selector = new SelectRenderable(renderer, {
      id: "main-menu-selector",
      position: "absolute",
      left: 12,
      top: 8,
      width: 50,
      height: 2 * selectOptions.length,
      options: selectOptions,
      zIndex: 1000,
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
    mainMenuContainer.add(selector);

    const selectedDisplay = new TextRenderable(renderer, {
      id: "main-menu-selection-display",
      content: "",
      fg: LattePalette.text,
      bg: LattePalette.base,
      position: "absolute",
      top: 30,
      left: 12,
      width: 50,
      height: 3,
      zIndex: 2000,
    });
    mainMenuContainer.add(selectedDisplay);

    let lastActionColor: string = LattePalette.red;

    const activatedDisplay = new TextRenderable(renderer, {
      id: "main-menu-selection-display",
      content: "jijiji",
      fg: lastActionColor,
      bg: LattePalette.base,
      position: "absolute",
      top: 36,
      left: 12,
      width: 50,
      height: 3,
      zIndex: 2000,
    });
    mainMenuContainer.add(activatedDisplay);

    selector.on(
      SelectRenderableEvents.SELECTION_CHANGED,
      (_: number, option: SelectOption) => {
        const currentSelection = selector.getSelectedOption();
        const selectionText = currentSelection
          ? `Selected: ${currentSelection.name}`
          : "Selected: None";

        if (selectedDisplay) {
          selectedDisplay.content = selectionText;
        }

        console.log(`Menu selection changed to: ${option.name}`);
      },
    );
    selector.focus();

    selector.on(
      SelectRenderableEvents.ITEM_SELECTED,
      (_: number, option: SelectOption) => {
        // selector.blur(); // Blur the selector on item selection
        const currentActivationText = `*** ACTIVATED: ${option.name} (${option.value}) ***`;
        lastActionColor = LattePalette.flamingo;
        if (activatedDisplay) {
          activatedDisplay.content = t`${fg(lastActionColor)(currentActivationText)}`;
        }
        setTimeout(() => {
          lastActionColor = LattePalette.green;
          if (activatedDisplay) {
            activatedDisplay.content = t`${fg(lastActionColor)(currentActivationText)}`;
          }
        }, 1000);
        console.log(`Menu item activated: ${option.name}`);
        // Deal with the action here
        if (option.value === "create_new") {
          // Handle create new project
          this.destroy();
          console.log("Creating a new project...");
        } else if (option.value === "exit_app") {
          // We need do some cleanups here before exit
          process.exit(0);
        } else {
        }
      },
    );
  }

  destroy() {
    // Clean up renderables
    const prevNum = this.renderer.root.getChildrenCount();

    this.renderer.root.remove("main-menu-container");

    const callback = () => {
      console.log("Main menu container removed.");
    };
    this.renderer.root.removeListener(
      SelectRenderableEvents.ITEM_SELECTED,
      callback,
    );
    this.renderer.root.removeListener(
      SelectRenderableEvents.SELECTION_CHANGED,
      callback,
    );

    this.appState.isMainMenuOpen = false;

    const currNum = this.renderer.root.getChildrenCount();

    console.log(
      `Main menu destroyed. Renderables removed from ${prevNum} to ${currNum}. ${this.appState.isMainMenuOpen}`,
    );
  }
}
