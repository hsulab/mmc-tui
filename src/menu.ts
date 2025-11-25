import {
  BoxRenderable,
  ASCIIFontRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  CliRenderer,
  InputRenderable,
  InputRenderableEvents,
  TextRenderable,
  type SelectOption,
} from "@opentui/core";

import { mkdirSync, readdirSync, promises as fs } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

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
  private menuSelectorListener:
    | ((index: number, option: SelectOption) => void)
    | null = null;

  private projectPrompt: BoxRenderable | null = null;
  private projectPromptMessage: TextRenderable | null = null;
  private projectNameInput: InputRenderable | null = null;
  private projectNameInputListener:
    | ((index: number, option: SelectOption) => void)
    | null = null;

  private recentProjectsContainer: BoxRenderable | null = null;
  private recentProjectsSelector: SelectRenderable | null = null;

  private _width: number;
  private _height: number;

  private readonly minCenteredWidth = 36;
  private readonly minCenteredHeight = 12;
  private readonly containerWidth = 36;
  private readonly containerHeight = 6;
  private readonly overlayWidth = 46;
  private readonly overlayHeight = 8;
  private readonly projectsRoot = join(homedir(), ".cache", "molcrafts");

  private overlayKeyHandler: ((key: any) => void) | null = null;

  constructor(
    renderer: CliRenderer,
    width: number = 80,
    height: number = 24,
    private onAction: (
      value: string,
      payload?: Record<string, string>,
    ) => void = () => {},
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
      ...this.calculateMenuPosition(),
      width: this.containerWidth,
      height: this.containerHeight,
      zIndex: 0,
    });
    renderer.root.add(this.container);

    this.appName = new ASCIIFontRenderable(renderer, {
      id: "main-menu-app-name",
      text: "MMC-TUI",
      font: "tiny",
      color: LattePalette.text,
      backgroundColor: LattePalette.base,
      top: 0,
      left: 0,
      zIndex: 0,
      selectable: false,
    });
    this.container.add(this.appName);

    this.positionAppName();

    // add selection
    this.selector = new SelectRenderable(renderer, {
      id: "main-menu-selector",
      top: +1,
      left: 0,
      width: this.containerWidth,
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

    if (!this.menuSelectorListener) {
      this.menuSelectorListener = (_: number, option: SelectOption) => {
        console.log(`Menu item activated: ${option.name}`);
        setTimeout(() => {
          this.renderer.requestRender();
        }, 100);
        console.log(`timeout triggered`);
        switch (option.value) {
          case "create_new":
            void this.showProjectNamePrompt();
            break;
          case "open_recent":
            void this.showRecentProjects();
            break;
          default:
            this.onAction(option.value);
            break;
        }
        this.selector!.blur(); // Blur the selector on item selection
      };
      this.selector.on(
        SelectRenderableEvents.ITEM_SELECTED,
        this.menuSelectorListener,
      );
    }

    this.selector.focus();

    //
    this.createRecentProjectSelector();
    // this.showRecentProjects();
  }

  public updateLayout(width: number, height: number) {
    this.width = width;
    this.height = height;

    if (this.container) {
      const { top, left } = this.calculateMenuPosition();
      this.container.top = top;
      this.container.left = left;
      this.container.width = this.containerWidth;
      this.container.height = this.containerHeight;
    }

    this.positionAppName();
    this.positionProjectPrompt();
    this.positionRecentProjects();
  }

  private calculateMenuPosition() {
    const shouldCenter =
      this.width >= this.minCenteredWidth &&
      this.height >= this.minCenteredHeight;

    if (shouldCenter) {
      const top = Math.max(
        0,
        Math.floor((this.height - this.containerHeight) / 3),
      );
      const left = Math.max(
        0,
        Math.floor((this.width - this.containerWidth) / 2),
      );
      return {
        top,
        left,
      };
    }

    return { top: 0, left: 0 };
  }

  private positionAppName() {
    if (!this.appName) return;

    this.appName.top = 0;
    this.appName.left = Math.max(
      0,
      Math.floor((this.containerWidth - this.appName.width) / 2),
    );
  }

  private calculateOverlayPosition(width: number, height: number) {
    const top = Math.max(0, Math.floor((this.height - height) / 2));
    const left = Math.max(0, Math.floor((this.width - width) / 2));

    return { top, left };
  }

  private positionProjectPrompt() {
    if (!this.projectPrompt) return;

    const { top, left } = this.calculateOverlayPosition(
      this.projectPrompt.width,
      this.projectPrompt.height,
    );
    this.projectPrompt.top = top;
    this.projectPrompt.left = left;

    if (this.projectNameInput) {
      this.projectNameInput.width = Math.max(0, this.projectPrompt.width - 2);
    }
    if (this.projectPromptMessage) {
      this.projectPromptMessage.width = Math.max(
        0,
        this.projectPrompt.width - 2,
      );
    }
  }

  private positionRecentProjects() {
    if (!this.recentProjectsContainer || !this.recentProjectsSelector) return;

    const selectHeight = Math.max(
      2,
      this.recentProjectsSelector.options.length * 2,
    );
    const containerHeight = Math.max(6, selectHeight + 2);

    this.recentProjectsContainer.width = this.overlayWidth;
    this.recentProjectsContainer.height = containerHeight;

    const { top, left } = this.calculateOverlayPosition(
      this.recentProjectsContainer.width,
      this.recentProjectsContainer.height,
    );
    this.recentProjectsContainer.top = top;
    this.recentProjectsContainer.left = left;

    this.recentProjectsSelector.width = Math.max(
      0,
      this.recentProjectsContainer.width - 2,
    );
    this.recentProjectsSelector.height = Math.max(0, containerHeight - 2);
  }

  private async showProjectNamePrompt() {
    this.hideRecentProjects();

    if (!this.projectPrompt) {
      this.projectPrompt = new BoxRenderable(this.renderer, {
        id: "project-name-prompt",
        position: "absolute",
        title: " New Project ",
        ...this.calculateOverlayPosition(this.overlayWidth, this.overlayHeight),
        width: this.overlayWidth,
        height: this.overlayHeight,
        border: true,
        borderStyle: "rounded",
        borderColor: LattePalette.peach,
        backgroundColor: LattePalette.surface0,
        zIndex: 200,
      });

      this.projectPromptMessage = new TextRenderable(this.renderer, {
        id: "project-name-message",
        top: 0,
        left: 1,
        width: this.overlayWidth - 2,
        height: 2,
        content: `Enter a project name. Projects are stored in ${this.projectsRoot}.`,
        fg: LattePalette.subtext1,
        bg: LattePalette.surface0,
        zIndex: 201,
      });

      this.projectNameInput = new InputRenderable(this.renderer, {
        id: "project-name-input",
        top: 2,
        left: 1,
        width: this.overlayWidth - 2,
        height: 1,
        zIndex: 201,
        backgroundColor: LattePalette.surface1,
        textColor: LattePalette.text,
        focusedBackgroundColor: LattePalette.mantle,
        focusedTextColor: LattePalette.text,
        placeholder: "Project name (no slashes)",
        placeholderColor: LattePalette.subtext0,
        cursorColor: LattePalette.peach,
      });

      this.projectNameInput.on(
        InputRenderableEvents.ENTER,
        () => void this.handleProjectSubmit(),
      );

      this.projectPrompt.add(this.projectPromptMessage);
      this.projectPrompt.add(this.projectNameInput);

      this.renderer.root.add(this.projectPrompt);
    } else {
      this.projectNameInput!.value = "";
      this.projectPromptMessage!.content = `Enter a project name. Projects are stored in ${this.projectsRoot}.`;
      this.projectPrompt.visible = true;
    }

    this.projectNameInput!.visible = true;
    this.projectPrompt!.visible = true;
    this.projectNameInput!.focus();
    this.addOverlayKeyHandler();

    this.renderer.requestRender();
  }

  private async handleProjectSubmit() {
    if (!this.projectNameInput) return;

    const trimmedName = this.projectNameInput.value.trim();

    if (!trimmedName) {
      this.updateProjectPromptMessage("Project name cannot be empty.");
      return;
    }

    if (/[/\\]/.test(trimmedName)) {
      this.updateProjectPromptMessage("Project name cannot contain slashes.");
      return;
    }

    try {
      await fs.mkdir(this.projectsRoot, { recursive: true });
      const projectPath = join(this.projectsRoot, trimmedName);
      await fs.mkdir(projectPath, { recursive: true });

      this.hideProjectPrompt();
      this.onAction("create_new", {
        projectName: trimmedName,
        projectPath,
      });
    } catch (error) {
      console.error("Failed to create project directory", error);
      this.updateProjectPromptMessage("Unable to create project directory.");
    }
  }

  private updateProjectPromptMessage(message: string) {
    if (this.projectPromptMessage) {
      this.projectPromptMessage.content = message;
    }
  }

  private hideProjectPrompt() {
    if (this.projectNameInput) {
      this.projectNameInput.blur();
      this.projectNameInput.visible = false;
    }
    if (this.projectPrompt) {
      this.projectPrompt.visible = false;
    }
    this.removeOverlayKeyHandler();

    this.selector?.focus();
  }

  private createRecentProjectSelector() {
    // Intentionally left blank; creation is handled in showRecentProjects
    this.recentProjectsContainer = new BoxRenderable(this.renderer, {
      id: "recent-projects-container",
      position: "absolute",
      title: " Recent Projects ",
      ...this.calculateOverlayPosition(this.overlayWidth, this.overlayHeight),
      width: this.overlayWidth,
      height: this.overlayHeight,
      border: true,
      borderStyle: "rounded",
      borderColor: LattePalette.peach,
      backgroundColor: LattePalette.surface0,
      zIndex: 200,
    });

    const options = [{ name: "Loading...", value: null, description: "" }];
    this.recentProjectsSelector = new SelectRenderable(this.renderer, {
      id: "recent-projects-selector",
      top: 0,
      left: 0,
      width: this.overlayWidth - 2,
      height: this.overlayHeight - 2,
      zIndex: 201,
      options,
      backgroundColor: LattePalette.surface0,
      textColor: LattePalette.text,
      focusedBackgroundColor: LattePalette.surface0,
      focusedTextColor: LattePalette.text,
      selectedBackgroundColor: LattePalette.peach,
      selectedTextColor: LattePalette.text,
      descriptionColor: LattePalette.subtext0,
      selectedDescriptionColor: LattePalette.text,
      showDescription: true,
      showScrollIndicator: true,
      wrapSelection: false,
    });

    let optionsToShow: string[] = options.map((opt) => opt.name);
    console.log(
      `Recent projects to show initially: ${optionsToShow.join(", ")}`,
    );

    if (!this.projectNameInputListener) {
      this.projectNameInputListener = (_: number, option: SelectOption) => {
        if (!option.value) {
          return;
        }
        console.log(`Recent project selected: ${option.name}`);

        const projectPath = join(this.projectsRoot, option.value);
        this.hideRecentProjects();
        this.onAction("open_recent", {
          projectName: option.name,
          projectPath,
        });
      };
    }
    this.recentProjectsSelector.on(
      SelectRenderableEvents.ITEM_SELECTED,
      this.projectNameInputListener,
    );

    this.recentProjectsSelector.on(
      SelectRenderableEvents.SELECTION_CHANGED,
      (index: number, option: SelectOption) => {
        console.log(
          `Recent projects selection changed to ${index}  ${option.name}.`,
        );
      },
    );

    this.recentProjectsSelector.visible = false;
    this.recentProjectsSelector.blur();
    this.recentProjectsContainer.add(this.recentProjectsSelector);

    this.recentProjectsContainer.visible = false;
    this.renderer.root.add(this.recentProjectsContainer);
  }

  private showRecentProjects() {
    this.hideMenuComponents();
    this.hideProjectPrompt();

    // this.renderer.requestRender();
    this.recentProjectsSelector!.requestRender();

    // let options = this.loadRecentProjects();
    // const hasProjects = options.some((option) => option.value);
    let options = [
      { name: "Loading...", value: "jijiji", description: "" },
      // { name: "cao", value: "cao", description: "cao" },
      // { name: "bao", value: "bao", description: "bao" },
    ];

    let optionsToShow: string[] = this.recentProjectsSelector!.options.map(
      (opt) => opt.name,
    );
    console.log(`Recent projects to show before: ${optionsToShow.join(", ")}`);
    this.recentProjectsSelector!.options = options;
    optionsToShow = this.recentProjectsSelector!.options.map((opt) => opt.name);
    console.log(`Recent projects to show after: ${optionsToShow.join(", ")}`);
    this.recentProjectsContainer!.visible = true;

    this.recentProjectsSelector!.focus();

    // this.positionRecentProjects();

    // if (!hasProjects) {
    //   this.recentProjectsSelector!.blur();
    // }

    // this.addOverlayKeyHandler();
    this.renderer.requestRender();
  }

  private loadRecentProjects(): SelectOption[] {
    try {
      mkdirSync(this.projectsRoot, { recursive: true });
      const entries = readdirSync(this.projectsRoot, { withFileTypes: true });

      const directories = entries.filter((entry) => entry.isDirectory());

      if (directories.length === 0) {
        return [
          {
            name: "No projects found",
            value: null,
            description: "Create a new project to get started.",
          },
        ];
      }

      return directories.map((dir) => ({
        name: dir.name,
        value: dir.name,
        description: join(this.projectsRoot, dir.name),
      }));
    } catch (error) {
      console.error("Failed to load recent projects", error);
      return [
        {
          name: "Unable to read projects",
          value: null,
          description: "Check permissions for the cache directory.",
        },
      ];
    }
  }

  private hideRecentProjects() {
    if (this.recentProjectsSelector) {
      this.recentProjectsSelector.blur();
      this.recentProjectsSelector.visible = false;
    }
    if (this.recentProjectsContainer) {
      this.recentProjectsContainer.visible = false;
    }

    this.removeOverlayKeyHandler();
    // this.selector?.focus();
  }

  private addOverlayKeyHandler() {
    if (this.overlayKeyHandler) return;

    this.overlayKeyHandler = (key: any) => {
      if (key.name === "escape") {
        this.hideProjectPrompt();
        this.hideRecentProjects();
      }
    };

    this.renderer.keyInput.on("keypress", this.overlayKeyHandler);
  }

  private removeOverlayKeyHandler() {
    if (!this.overlayKeyHandler) return;

    this.renderer.keyInput.off("keypress", this.overlayKeyHandler);
    this.overlayKeyHandler = null;
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
    // this.hideProjectPrompt();
    // this.hideRecentProjects();
    if (this.selector) {
      this.selector.visible = false;
    }
    // Trigger a re-render so the hidden menu components are cleared from the screen
    // before other UI elements (like the window manager) draw over the same area.
    // this.renderer.requestRender();
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
    if (this.projectPrompt) {
      this.projectPrompt.destroy();
      this.projectPrompt = null;
    }
    if (this.recentProjectsContainer) {
      this.recentProjectsContainer.destroy();
      this.recentProjectsContainer = null;
    }

    this.container = null;
    this.selector = null;
    this.appName = null;
    this.projectNameInput = null;
    this.projectPromptMessage = null;
    this.recentProjectsSelector = null;

    const children = this.renderer.root.getChildren();
    for (const child of children) {
      console.log(`Remaining child in root: ${typeof child}  ${child.id}`);
    }

    this.renderer.requestRender();
  }
}
