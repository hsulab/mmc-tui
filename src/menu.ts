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
    value: "new_file",
    description: "  Leave the app :(",
  },
];

/**
 * Main menu renderer
 */
export function mainMenuRenderer(renderer: CliRenderer) {
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
      selector.blur(); // Blur the selector on item selection
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
    },
  );
}
