import { FrameBufferRenderable, RGBA, CliRenderer } from "@opentui/core";
import { ThreeCliRenderer, SuperSampleType } from "@opentui/core/3d";
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshToonMaterial,
  PerspectiveCamera,
  OrthographicCamera,
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
  private camera: PerspectiveCamera | OrthographicCamera | null = null;
  private frameCallback: ((deltaTime: number) => Promise<void>) | null = null;
  private initPromise: Promise<void> | null = null;
  private keybinds: ((key: any) => void) | null = null;
  private structure: "Cu4" | "Cu256" = "Cu4";

  constructor(renderer: CliRenderer, id: string, active: boolean, rect: Rect) {
    super(renderer, id, active, rect);

    this.updateStatusLabel();
    this.initPromise = this.initializeScene();
    this.setupKeybinds();
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

    if (this.keybinds) {
      this.renderer.keyInput.off("keypress", this.keybinds);
      this.keybinds = null;
    }

    if (this.latticeGroup) {
      this.disposeGroup(this.latticeGroup);
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
      10,
    );
    // this.camera = new OrthographicCamera(
    //   Math.max(1, this.contentWidth) / -100,
    //   Math.max(1, this.contentWidth) / 100,
    //   Math.max(1, this.contentHeight) / 100,
    //   Math.max(1, this.contentHeight) / -100,
    //   0.1,
    //   20,
    // );
    this.camera.position.set(1.7, 1.5, 2.4);
    this.camera.lookAt(0, 0, 0);
    this.threeRenderer.setActiveCamera(this.camera);

    const ambient = new AmbientLight(0xffffff, 0.55);
    const directional = new DirectionalLight(0xffffff, 0.8);
    directional.position.set(1.5, 1.25, 1.75);

    const supercell =
      this.structure === "Cu256" ? { x: 4, y: 4, z: 4 } : { x: 1, y: 1, z: 1 };

    this.latticeGroup = this.createCuFccGroup(supercell);

    this.scene.add(ambient);
    this.scene.add(directional);
    this.scene.add(this.latticeGroup);

    this.registerFrameCallback();
  }

  private setupKeybinds() {
    this.keybinds = (key: any) => {
      if (!this.active) return;

      switch (key.name) {
        case "b":
          void this.toggleStructure();
          break;
        default:
          break;
      }
    };

    this.renderer.keyInput.on("keypress", this.keybinds);
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

  private async toggleStructure() {
    this.structure = this.structure === "Cu4" ? "Cu256" : "Cu4";
    this.updateStatusLabel();

    await this.initPromise;
    if (!this.scene) return;

    if (this.latticeGroup) {
      this.scene.remove(this.latticeGroup);
      this.disposeGroup(this.latticeGroup);
    }

    const supercell =
      this.structure === "Cu256" ? { x: 4, y: 4, z: 4 } : { x: 1, y: 1, z: 1 };

    this.latticeGroup = this.createCuFccGroup(supercell);
    this.scene.add(this.latticeGroup);
    this.renderer.requestRender();
  }

  private updateStatusLabel() {
    const atomCount =
      this.structure === "Cu4" ? "4 atoms" : "256 atoms (4x4x4)";
    this.setStatusMessage(`Cu FCC | ${atomCount} | press 'b' to toggle`);
  }

  private createCuFccGroup(
    supercell: { x: number; y: number; z: number } = { x: 1, y: 1, z: 1 },
  ): Group {
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
    const totalAtoms =
      supercell.x * supercell.y * supercell.z * positions.length;
    const instancedAtoms = new InstancedMesh(
      atomGeometry,
      atomMaterial,
      totalAtoms,
    );
    const offset = new Vector3(
      supercell.x / 2,
      supercell.y / 2,
      supercell.z / 2,
    );
    const transform = new Matrix4();

    let index = 0;
    for (let ix = 0; ix < supercell.x; ix++) {
      for (let iy = 0; iy < supercell.y; iy++) {
        for (let iz = 0; iz < supercell.z; iz++) {
          const cellOrigin = new Vector3(ix, iy, iz);
          positions.forEach((basis) => {
            const position = cellOrigin.clone().add(basis).sub(offset);
            transform.makeTranslation(position.x, position.y, position.z);
            instancedAtoms.setMatrixAt(index, transform);
            index += 1;
          });
        }
      }
    }

    instancedAtoms.instanceMatrix.needsUpdate = true;
    group.add(instancedAtoms);

    const boxGeometry = new BoxGeometry(
      supercell.x * latticeConstant,
      supercell.y * latticeConstant,
      supercell.z * latticeConstant,
    );
    const edges = new EdgesGeometry(boxGeometry);
    const boxLines = new LineSegments(
      edges,
      new LineBasicMaterial({ color: new Color(LattePalette.overlay0) }),
    );
    group.add(boxLines);

    return group;
  }

  private disposeGroup(group: Group) {
    group.traverse((child) => {
      const meshChild = child as any;
      if (meshChild.geometry) {
        meshChild.geometry.dispose?.();
      }
      if (meshChild.material) {
        const material = meshChild.material;
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose?.());
        } else {
          material.dispose?.();
        }
      }
    });
  }

  private spinLattice(deltaTime: number) {
    if (!this.latticeGroup) return;

    const rotationSpeed = 0.35; // radians per second
    this.latticeGroup.rotation.y += rotationSpeed * deltaTime;
    this.latticeGroup.rotation.x += rotationSpeed * 0.5 * deltaTime;
  }
}
