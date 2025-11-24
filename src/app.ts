import {
  CliRenderer,
  BoxRenderable,
  ASCIIFontRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextRenderable,
  fg,
  t,
  type SelectOption,
} from "@opentui/core";

import { LattePalette } from "./palette.ts";
import { PaneLayout } from "./window/pane.ts";

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

export class MMCTui {
  private renderer: CliRenderer;
  private inMenu: boolean = true;

  // My menu components
  private appName: ASCIIFontRenderable | null = null;
  private mainMenuContainer: BoxRenderable | null = null;
  private mainMenuSelector: SelectRenderable | null = null;

  // My window components
  private panes: PaneLayout | null = null;

  constructor(renderer: CliRenderer) {
    this.renderer = renderer;

    this.renderer.setBackgroundColor(LattePalette.base);

    this.setupGlobalKeybinds();
    this.createMenu();
  }

  private createAppName() {}

  private createMenu() {
    const renderer = this.renderer;
    // Check if main menu already exists
    if (renderer.root.getRenderable("main-menu-container")) {
      console.warn("Main menu already rendered.");
      return;
    }

    // Add main menu items here
    this.mainMenuContainer = new BoxRenderable(renderer, {
      id: "main-menu-container",
      position: "absolute",
      top: 5,
      left: 25,
      flexDirection: "row",
      alignItems: "stretch",
      zIndex: 10,
    });
    renderer.root.add(this.mainMenuContainer);

    this.appName = new ASCIIFontRenderable(renderer, {
      id: "main-menu-app-name",
      text: "MMC-TUI",
      font: "tiny",
      color: LattePalette.text,
      backgroundColor: LattePalette.base,
      zIndex: 100,
      selectable: false,
    });
    this.mainMenuContainer.add(this.appName);

    // add selection
    this.mainMenuSelector = new SelectRenderable(renderer, {
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
    this.mainMenuContainer.add(this.mainMenuSelector);

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
    this.mainMenuContainer.add(selectedDisplay);

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
    this.mainMenuContainer.add(activatedDisplay);

    this.mainMenuSelector.on(
      SelectRenderableEvents.SELECTION_CHANGED,
      (_: number, option: SelectOption) => {
        const currentSelection = this.mainMenuSelector.getSelectedOption();
        const selectionText = currentSelection
          ? `Selected: ${currentSelection.name}`
          : "Selected: None";

        if (selectedDisplay) {
          selectedDisplay.content = selectionText;
        }

        console.log(`Menu selection changed to: ${option.name}`);
      },
    );
    this.mainMenuSelector.focus();

    this.mainMenuSelector.on(
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
          this.runWindowManager();
          console.log("Creating a new project...");
        } else if (option.value === "exit_app") {
          // We need do some cleanups here before exit
          process.exit(0);
        } else {
        }
      },
    );
  }

  private runWindowManager() {
    this.inMenu = false;
    this.hideMenuComponents();

    // Start the window manager
    this.panes = new PaneLayout(
      this.renderer,
      this.renderer.width,
      this.renderer.height,
    );
    this.panes.render();
    this.panes.setupKeybinds();
  }

  private hideMenuComponents() {
    if (this.appName) {
      this.appName.visible = false;
    }
    if (this.mainMenuContainer) {
      this.mainMenuContainer.visible = false;
    }
    if (this.mainMenuSelector) {
      this.mainMenuSelector.visible = false;
    }
  }

  private returnToMenu() {
    this.inMenu = true;
    if (this.panes) {
      // Clean up panes
      this.panes.destroy();
      this.panes = null;
    }
    if (this.appName) {
      this.appName.visible = true;
    }
    if (this.mainMenuContainer) {
      this.mainMenuContainer.visible = true;
    }
    if (this.mainMenuSelector) {
      this.mainMenuSelector.visible = true;
      this.mainMenuSelector.focus();
    }
  }

  private setupGlobalKeybinds() {
    this.renderer.keyInput.on("keypress", (key) => {
      if (key.name === "m" && key.ctrl) {
        if (this.inMenu) {
          // Already in menu
          return;
        } else {
          this.returnToMenu();
        }
      }
    });
  }
}
