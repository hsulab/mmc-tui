import {
  CliRenderer,
  RGBA,
  Renderable,
  BoxRenderable,
  OptimizedBuffer,
  createTimeline,
  type BoxOptions,
  type MouseEvent,
} from "@opentui/core";

import { LattePalette } from "../palette.ts";

export type SelectableBoxRenderable = BoxRenderable & {
  isSelected: () => boolean;
  setSelected: (selected: boolean) => void;
};

let nextZIndex = 1001;

export function DraggableBox(
  renderer: CliRenderer,
  props: BoxOptions & {
    x: number;
    y: number;
    width: number;
    height: number;
    color: RGBA;
    label: string;
    onSelect?: (box: BoxRenderable) => void;
    onDeselect?: (box: BoxRenderable) => void;
    onMove?: (box: BoxRenderable) => void;
    selectedBorderColor?: RGBA;
  },
) {
  const bgColor = RGBA.fromValues(
    props.color.r,
    props.color.g,
    props.color.b,
    0.0,
  );
  const borderColor = RGBA.fromValues(
    props.color.r * 1.2,
    props.color.g * 1.2,
    props.color.b * 1.2,
    1.0,
  );

  let isDragging = false;
  let pointerDown = false;
  let hasDragged = false;
  let gotText = "";
  let scrollText = "";
  let scrollTimestamp = 0;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let bounceScale = { value: 1 };
  let baseWidth: number = props.width;
  let baseHeight: number = props.height;
  let originalBg: RGBA = bgColor;
  let originalBorderColor: RGBA = borderColor;

  const selectedBorderColor =
    props.selectedBorderColor ?? RGBA.fromHex(LattePalette.red);
  let isSelected = false;

  let renderAfter = function (
    this: Renderable,
    buffer: OptimizedBuffer,
    _deltaTime: number,
  ) {
    /** Disable text temporarily
     */
    const currentTime = Date.now();

    // if (scrollText && currentTime - scrollTimestamp > 2000) {
    //   scrollText = "";
    // }
    //
    // const baseCenterX = this.x + Math.floor(this.width / 2);
    // const baseCenterY = this.y + Math.floor(this.height / 2);
    //
    // let textLines = 0;
    // if (isDragging) textLines++;
    // if (scrollText) textLines++;
    // if (gotText) textLines += 2;
    //
    // let currentY =
    //   textLines > 1 ? baseCenterY - Math.floor(textLines / 2) : baseCenterY;
    //
    // if (isDragging) {
    //   const centerX = baseCenterX - 2;
    //   buffer.drawText("drag", centerX, currentY, RGBA.fromInts(64, 224, 208));
    //   currentY++;
    // }
    //
    // if (scrollText) {
    //   const age = currentTime - scrollTimestamp;
    //   const fadeRatio = Math.max(0, 1 - age / 2000);
    //   const alpha = Math.round(255 * fadeRatio);
    //
    //   const centerX = baseCenterX - Math.floor(scrollText.length / 2);
    //   buffer.drawText(
    //     scrollText,
    //     centerX,
    //     currentY,
    //     RGBA.fromInts(255, 255, 0, alpha),
    //   );
    //   currentY++;
    // }
    //
    // if (gotText) {
    //   const gotX = baseCenterX - 2;
    //   const gotTextX = baseCenterX - Math.floor(gotText.length / 2);
    //   buffer.drawText("got", gotX, currentY, RGBA.fromInts(255, 182, 193));
    //   currentY++;
    //   buffer.drawText(
    //     gotText,
    //     gotTextX,
    //     currentY,
    //     RGBA.fromInts(147, 226, 255),
    //   );
    // }
  };

  const applySelectionBorder = (target: BoxRenderable) => {
    target.borderColor = isSelected ? selectedBorderColor : originalBorderColor;
  };

  const setSelected = (target: BoxRenderable, selected: boolean) => {
    isSelected = selected;
    applySelectionBorder(target);
  };

  let onMouse = function (this: BoxRenderable, event: MouseEvent): void {
    switch (event.type) {
      case "down":
        gotText = "";
        pointerDown = true;
        hasDragged = false;
        dragOffsetX = event.x - this.x;
        dragOffsetY = event.y - this.y;
        this.zIndex = nextZIndex++;
        setSelected(this, !isSelected);
        if (isSelected) {
          props.onSelect?.(this as unknown as BoxRenderable);
        } else {
          props.onDeselect?.(this as unknown as BoxRenderable);
        }
        event.stopPropagation();
        break;

      case "drag-end":
        if (pointerDown) {
          this.zIndex = 100;
          this.backgroundColor = originalBg;
          applySelectionBorder(this);

          if (hasDragged) {
            props.onMove?.(this as unknown as BoxRenderable);
          }

          setSelected(this, false);
          props.onDeselect?.(this as unknown as BoxRenderable);

          isDragging = false;
          pointerDown = false;
          hasDragged = false;
          event.stopPropagation();
        }
        break;

      case "drag":
        if (pointerDown) {
          const parent = this.parent as BoxRenderable | null;
          const parentX = parent?.x ?? 0;
          const parentY = parent?.y ?? 0;
          const parentWidth = parent?.width ?? this._ctx.width;
          const parentHeight = parent?.height ?? this._ctx.height;

          const newX = event.x - dragOffsetX;
          const newY = event.y - dragOffsetY;

          const innerLeft = parent ? parentX + 1 : 0;
          const innerTop = parent ? parentY + 1 : 0;
          const innerRight = parent
            ? parentX + Math.max(0, parentWidth - this.width - 2)
            : this._ctx.width - this.width;
          const innerBottom = parent
            ? parentY + Math.max(0, parentHeight - this.height - 2)
            : this._ctx.height - this.height;

          const boundedX = Math.max(innerLeft, Math.min(newX, innerRight));
          const boundedY = Math.max(innerTop, Math.min(newY, innerBottom));

          const moved = this.x !== boundedX || this.y !== boundedY;

          if (moved) {
            hasDragged = true;
            isDragging = true;

            this.x = boundedX;
            this.y = boundedY;

            props.onMove?.(this as unknown as BoxRenderable);
          }

          event.stopPropagation();
        }
        break;

      case "over":
        gotText = "over " + (event.source?.id || "");
        break;

      case "out":
        gotText = "out";
        break;

      case "drop":
        gotText = event.source?.id || "";
        const timeline = createTimeline();

        timeline.add(bounceScale, {
          value: 1.5,
          duration: 200,
          ease: "outExpo",
          onUpdate: (values) => {
            const scale = values.targets[0].value;
            this.width = Math.round(baseWidth * scale);
            this.height = Math.round(baseHeight * scale);
          },
        });

        timeline.add(
          bounceScale,
          {
            value: 1.0,
            duration: 400,
            ease: "outExpo",
            onUpdate: (values) => {
              const scale = values.targets[0].value;
              this.width = Math.round(baseWidth * scale);
              this.height = Math.round(baseHeight * scale);
            },
          },
          200,
        );
        break;

      case "scroll":
        if (event.scroll) {
          scrollText = `scroll ${event.scroll.direction}`;
          scrollTimestamp = Date.now();
          event.stopPropagation();
        }
        break;
    }
  };

  const box = new BoxRenderable(renderer, {
    ...props,
    position: "absolute",
    left: props.x,
    top: props.y,
    width: props.width,
    height: props.height,
    backgroundColor: bgColor,
    borderColor: borderColor,
    borderStyle: "rounded",
    title: props.label,
    titleAlignment: "left",
    border: true,
    zIndex: 100,
    renderAfter: renderAfter,
    onMouse: onMouse,
  });

  const selectable = box as SelectableBoxRenderable;
  selectable.isSelected = () => isSelected;
  selectable.setSelected = (selected: boolean) => setSelected(box, selected);

  return selectable;
}
