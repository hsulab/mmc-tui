import {
  Renderable,
  RGBA,
  Box,
  BoxRenderable,
  createTimeline,
  OptimizedBuffer,
  type BoxOptions,
  type VChild,
  type MouseEvent,
} from "@opentui/core";

let nextZIndex = 1001;

export function DraggableBox(
  props: BoxOptions & {
    x: number;
    y: number;
    width: number;
    height: number;
    color: RGBA;
    label: string;
  },
  children?: VChild,
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
  let gotText = "";
  let scrollText = "";
  let scrollTimestamp = 0;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let bounceScale = { value: 1 };
  let baseWidth: number = props.width;
  let baseHeight: number = props.height;
  let originalBg: RGBA = bgColor;
  let dragBg: RGBA = RGBA.fromValues(
    props.color.r,
    props.color.g,
    props.color.b,
    0.3,
  );
  let originalBorderColor: RGBA = borderColor;
  let dragBorderColor: RGBA = RGBA.fromValues(
    props.color.r * 1.2,
    props.color.g * 1.2,
    props.color.b * 1.2,
    0.5,
  );

  let renderAfter = function (
    this: Renderable,
    buffer: OptimizedBuffer,
    deltaTime: number,
  ) {
    const currentTime = Date.now();
    if (scrollText && currentTime - scrollTimestamp > 2000) {
      scrollText = "";
    }

    const baseCenterX = this.x + Math.floor(this.width / 2);
    const baseCenterY = this.y + Math.floor(this.height / 2);

    let textLines = 0;
    if (isDragging) textLines++;
    if (scrollText) textLines++;
    if (gotText) textLines += 2;

    let currentY =
      textLines > 1 ? baseCenterY - Math.floor(textLines / 2) : baseCenterY;

    if (isDragging) {
      const centerX = baseCenterX - 2;
      buffer.drawText("drag", centerX, currentY, RGBA.fromInts(64, 224, 208));
      currentY++;
    }

    if (scrollText) {
      const age = currentTime - scrollTimestamp;
      const fadeRatio = Math.max(0, 1 - age / 2000);
      const alpha = Math.round(255 * fadeRatio);

      const centerX = baseCenterX - Math.floor(scrollText.length / 2);
      buffer.drawText(
        scrollText,
        centerX,
        currentY,
        RGBA.fromInts(255, 255, 0, alpha),
      );
      currentY++;
    }

    if (gotText) {
      const gotX = baseCenterX - 2;
      const gotTextX = baseCenterX - Math.floor(gotText.length / 2);
      buffer.drawText("got", gotX, currentY, RGBA.fromInts(255, 182, 193));
      currentY++;
      buffer.drawText(
        gotText,
        gotTextX,
        currentY,
        RGBA.fromInts(147, 226, 255),
      );
    }
  };
  let onMouse = function (this: BoxRenderable, event: MouseEvent): void {
    switch (event.type) {
      case "down":
        gotText = "";
        isDragging = true;
        dragOffsetX = event.x - this.x;
        dragOffsetY = event.y - this.y;
        this.zIndex = nextZIndex++;
        this.backgroundColor = dragBg;
        this.borderColor = dragBorderColor;
        event.stopPropagation();
        break;

      case "drag-end":
        if (isDragging) {
          isDragging = false;
          this.zIndex = 100;
          this.backgroundColor = originalBg;
          this.borderColor = originalBorderColor;
          event.stopPropagation();
        }
        break;

      case "drag":
        if (isDragging) {
          const newX = event.x - dragOffsetX;
          const newY = event.y - dragOffsetY;

          const boundedX = Math.max(
            0,
            Math.min(newX, this._ctx.width - this.width),
          );
          const boundedY = Math.max(
            4,
            Math.min(newY, this._ctx.height - this.height),
          );

          this.x = boundedX;
          this.y = boundedY;

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

  return Box(
    {
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
    },
    children,
  );
}
