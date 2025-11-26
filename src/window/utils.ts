import { CliRenderer, BoxRenderable } from "@opentui/core";

import type { Rect } from "../ui/geometry.ts";
import { Pane } from "./base.ts";

interface PaneRectInfo {
  pane: Pane;
  rect: Rect;
  center: { x: number; y: number };
}

interface PaneNeighbors {
  left?: Pane;
  right?: Pane;
  up?: Pane;
  down?: Pane;
}

export function buildPaneNeighbors(
  renderer: CliRenderer,
  panes: Pane[],
): Map<Pane, PaneNeighbors> {
  const infos: PaneRectInfo[] = [];
  for (const pane of panes) {
    let box = renderer.root
      .getRenderable("window-container")
      ?.getRenderable(pane.id);
    if (box instanceof BoxRenderable) {
      infos.push({
        pane,
        rect: pane.rect!,
        center: {
          x: pane.rect!.left + pane.rect!.width / 2,
          y: pane.rect!.top + pane.rect!.height / 2,
        },
      });
    }
  }

  const neighbors = new Map<Pane, PaneNeighbors>();

  const overlap = (a0: number, a1: number, b0: number, b1: number) =>
    Math.min(a1, b1) - Math.max(a0, b0);

  for (const a of infos) {
    let left, right, up, down;
    let bestL = Infinity,
      bestR = Infinity,
      bestU = Infinity,
      bestD = Infinity;

    for (const b of infos) {
      if (a === b) continue;
      const dx = b.center.x - a.center.x;
      const dy = b.center.y - a.center.y;
      const overlapX = overlap(
        a.rect.left,
        a.rect.left + a.rect.width,
        b.rect.left,
        b.rect.left + b.rect.width,
      );
      const overlapY = overlap(
        a.rect.top,
        a.rect.top + a.rect.height,
        b.rect.top,
        b.rect.top + b.rect.height,
      );

      // move left/right only if vertical overlap > 0
      if (dx < 0 && overlapY > 0 && -dx < bestL) {
        bestL = -dx;
        left = b.pane;
      }
      if (dx > 0 && overlapY > 0 && dx < bestR) {
        bestR = dx;
        right = b.pane;
      }

      // move up/down only if horizontal overlap > 0
      if (dy < 0 && overlapX > 0 && -dy < bestU) {
        bestU = -dy;
        up = b.pane;
      }
      if (dy > 0 && overlapX > 0 && dy < bestD) {
        bestD = dy;
        down = b.pane;
      }
    }

    neighbors.set(a.pane, { left, right, up, down });
  }

  return neighbors;
}
