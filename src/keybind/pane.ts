import { CliRenderer } from "@opentui/core";
import { PaneLayout } from "../window/pane.ts";

export function setupPaneKeybinds(renderer: CliRenderer, panes: PaneLayout) {
  renderer.keyInput.on("keypress", (key) => {
    if (key.name === "v" && key.ctrl) {
      panes.splitActive("vertical");
    }
    if (key.name === "s" && key.ctrl) {
      panes.splitActive("horizontal");
    }
    if (key.name === "q" && key.ctrl) {
      let ids: string[] = [];
      ids = renderer.root.getChildren().map((child) => child.id);
      console.log("Before close:", ids);
      panes.closeActive();
      ids = renderer.root.getChildren().map((child) => child.id);
      console.log("After close:", ids);
    }
    if (key.name === "linefeed") {
      // crtl + j
      panes.moveActive("down");
    }
    if (key.name === "k" && key.ctrl) {
      panes.moveActive("up");
    }
    if (key.name === "backspace") {
      // ctrl + h
      panes.moveActive("left");
    }
    if (key.name === "l" && key.ctrl) {
      panes.moveActive("right");
    }
    if (key.name === "z" && key.ctrl) {
      panes.zoomActive();
    }
  });
}
