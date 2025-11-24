import { CliRenderer } from "@opentui/core";

import { LattePalette } from "./palette.ts";
import { PaneLayout } from "./window/pane.ts";
import { MainMenu } from "./menu.ts";
import { StatusBar } from "./status.ts";

export class MMCTui {
  private renderer: CliRenderer;
  private inMenu: boolean = true;

  // My menu components
  private mainMenu: MainMenu | null = null;

  // My status bar components
  private statusBar: StatusBar | null = null;

  // My window components
  private panes: PaneLayout | null = null;

  constructor(renderer: CliRenderer) {
    this.renderer = renderer;

    this.renderer.setBackgroundColor(LattePalette.base);

    this.setupGlobalKeybinds();

    // Setup and show main menu
    this.mainMenu = new MainMenu(
      this.renderer,
      this.renderer.width,
      this.renderer.height,
      (value: string) => this.handldeMenuAction(value),
    );
    this.mainMenu.createMenu();

    // Setup status bar
    this.statusBar = new StatusBar(
      this.renderer,
      this.renderer.width,
      this.renderer.height,
    );
    this.statusBar.createStatusBar();

    // Resize event
    this.renderer.on("resize", (width: number, height: number) => {
      // Resize panes
      if (this.panes) {
        this.panes.width = width;
        this.panes.height = height - 1; // Leave space for status bar
        this.panes.render();
      }
    });
  }

  private handldeMenuAction(value: string) {
    switch (value) {
      case "create_new":
        this.runWindowManager();
        break;
      case "open_recent":
        break;
      case "exit_app":
        // TODO: Clean up properly
        process.exit(0);
      default:
        break;
    }
  }

  private runWindowManager() {
    if (!this.mainMenu) return;

    this.inMenu = false;
    this.mainMenu.hideMenuComponents();

    // Start the window manager
    this.panes = new PaneLayout(
      this.renderer,
      this.renderer.width,
      this.renderer.height - 1, // Leave space for status bar
      this.statusBar,
    );
    this.panes.render();

    // Show status bar
    this.statusBar?.showStatusBar();
  }

  private returnToMenu() {
    this.inMenu = true;
    if (this.panes) {
      // Clean up panes
      this.panes.destroy();
      this.panes = null;
    }
    // Hide status bar
    this.statusBar?.hideStatusBar();
    // Show main menu
    if (this.mainMenu) {
      this.mainMenu.showMenuComponents();
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
      if (key.name === "`") {
        this.renderer.console.toggle();
      }
    });
  }
}
