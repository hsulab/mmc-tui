import { FrameBufferRenderable, RGBA, CliRenderer } from "@opentui/core";
import { ThreeCliRenderer, SuperSampleType } from "@opentui/core/3d";
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
} from "three";

import { LattePalette } from "../palette.ts";
import type { Rect } from "../ui/geometry.ts";
import { Pane } from "./base.ts";

export class MaterialsPane extends Pane {
  private canvas: FrameBufferRenderable | null = null;
  private threeRenderer: ThreeCliRenderer | null = null;
  private scene: Scene | null = null;
  private latticeGroup: Group | null = null;
  private camera: PerspectiveCamera | null = null;
  private frameCallback: ((deltaTime: number) => Promise<void>) | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(renderer: CliRenderer, id: string, active: boolean, rect: Rect) {
    super(renderer, id, active, rect);

    this.setStatusMessage("Cu FCC | 4 atoms");
    this.initPromise = this.initializeScene();
  }

  override get type(): string {
    return "materials";
  }

  override draw(): void {
    super.draw();

    // Ensure the 3D components are ready without blocking render.
    void this.initPromise;

    this.updateCanvasLayout();
    this.renderer.requestRender();
  }

  override destroy(): void {
    if (this.frameCallback) {
      this.renderer.removeFrameCallback(this.frameCallback);
      this.frameCallback = null;
    }

    this.threeRenderer?.destroy();
    this.threeRenderer = null;

    if (this.canvas) {
      this.box?.remove(this.canvas.id);
      this.canvas.destroy();
      this.canvas = null;
    }

    this.scene = null;
    this.latticeGroup = null;
    this.camera = null;

    super.destroy();
  }

  private async initializeScene() {
    if (this.canvas || this.threeRenderer) return;

    this.canvas = new FrameBufferRenderable(this.renderer, {
      id: `materials-canvas-${this.id}`,
      // position: "absolute",
      top: 0,
      left: 0,
      width: Math.max(1, this.contentWidth),
      height: Math.max(1, this.contentHeight),
      zIndex: 1,
    });

    this.box?.add(this.canvas);

    this.threeRenderer = new ThreeCliRenderer(this.renderer, {
      width: Math.max(1, this.contentWidth),
      height: Math.max(1, this.contentHeight),
      backgroundColor: RGBA.fromHex(LattePalette.base),
      superSample: SuperSampleType.GPU,
      alpha: false,
      autoResize: false,
    });

    await this.threeRenderer.init();

    this.scene = new Scene();
    this.scene.background = new Color(LattePalette.base);

    this.camera = new PerspectiveCamera(
      55,
      Math.max(1, this.contentWidth) / Math.max(1, this.contentHeight),
      0.1,
      20,
    );
    this.camera.position.set(1.7, 1.5, 2.4);
    this.camera.lookAt(0, 0, 0);
    this.threeRenderer.setActiveCamera(this.camera);

    const ambient = new AmbientLight(0xffffff, 0.55);
    const directional = new DirectionalLight(0xffffff, 0.8);
    directional.position.set(1.5, 1.25, 1.75);

    this.latticeGroup = this.createCuFccGroup();

    this.scene.add(ambient);
    this.scene.add(directional);
    this.scene.add(this.latticeGroup);

    this.registerFrameCallback();
  }

  private registerFrameCallback() {
    if (!this.scene || !this.canvas || !this.threeRenderer) return;
    if (this.frameCallback) return;

    this.frameCallback = async (deltaTime: number) => {
      if (!this.scene || !this.canvas || !this.threeRenderer) return;

      // this.spinLattice(deltaTime);  // disable spin temporarily

      await this.threeRenderer.drawScene(
        this.scene,
        this.canvas.frameBuffer,
        deltaTime,
      );

      this.canvas.requestRender();
    };

    this.renderer.setFrameCallback(this.frameCallback);
  }

  private updateCanvasLayout() {
    if (!this.canvas || !this.threeRenderer) return;

    const width = Math.max(1, this.contentWidth);
    const height = Math.max(1, this.contentHeight);

    const needsResize =
      this.canvas.width !== width || this.canvas.height !== height;

    this.canvas.top = 0;
    this.canvas.left = 0;
    this.canvas.width = width;
    this.canvas.height = height;

    if (needsResize) {
      this.threeRenderer.setSize(width, height, true);
      if (this.camera) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
      }
    }
  }

  private createCuFccGroup(): Group {
    const group = new Group();

    const latticeConstant = 1;
    const positions = [
      new Vector3(0, 0, 0),
      new Vector3(0, 0.5, 0.5),
      new Vector3(0.5, 0, 0.5),
      new Vector3(0.5, 0.5, 0),
    ];

    const atomGeometry = new SphereGeometry(0.08 * latticeConstant, 32, 32);
    const atomMaterial = new MeshToonMaterial({
      color: new Color("#df8e1d"),
    });

    positions.forEach((position) => {
      const atom = new Mesh(atomGeometry, atomMaterial);
      atom.position.copy(position.subScalar(0.5));
      group.add(atom);
    });

    const boxGeometry = new BoxGeometry(
      latticeConstant,
      latticeConstant,
      latticeConstant,
    );
    const edges = new EdgesGeometry(boxGeometry);
    const boxLines = new LineSegments(
      edges,
      new LineBasicMaterial({ color: new Color(LattePalette.overlay0) }),
    );
    boxLines.position.set(0, 0, 0);
    boxLines.translateX(-0.5);
    boxLines.translateY(-0.5);
    boxLines.translateZ(-0.5);
    group.add(boxLines);

    return group;
  }

  private spinLattice(deltaTime: number) {
    if (!this.latticeGroup) return;

    const rotationSpeed = 0.35; // radians per second
    this.latticeGroup.rotation.y += rotationSpeed * deltaTime;
    this.latticeGroup.rotation.x += rotationSpeed * 0.5 * deltaTime;
  }
}
