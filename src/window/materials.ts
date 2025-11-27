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
  private cameraMode: "perspective" | "orthographic" = "perspective";
  private readonly cameraPosition = new Vector3(1.7, 1.5, 2.4);
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

    const initialLayout = this.getSquareLayout();

    this.canvas = new FrameBufferRenderable(this.renderer, {
      id: `materials-canvas-${this.id}`,
      top: initialLayout.top,
      left: initialLayout.left,
      width: initialLayout.size,
      height: initialLayout.size,
      zIndex: 1,
    });

    this.box?.add(this.canvas);

    this.threeRenderer = new ThreeCliRenderer(this.renderer, {
      width: initialLayout.size,
      height: initialLayout.size,
      backgroundColor: RGBA.fromHex(LattePalette.base),
      superSample: SuperSampleType.GPU,
      alpha: false,
      autoResize: false,
    });

    await this.threeRenderer.init();

    this.scene = new Scene();
    this.scene.background = new Color(LattePalette.base);

    this.camera = this.createCamera(initialLayout.size, initialLayout.size);
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
        case "c":
          void this.toggleCameraMode();
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

    const { size, left, top } = this.getSquareLayout();

    const needsResize =
      this.canvas.width !== size ||
      this.canvas.height !== size ||
      this.canvas.left !== left ||
      this.canvas.top !== top;

    this.canvas.top = top;
    this.canvas.left = left;
    this.canvas.width = size;
    this.canvas.height = size;

    if (needsResize) {
      this.threeRenderer.setSize(size, size, true);
      this.updateCameraProjection(size, size);
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
    if (this.canvas) {
      this.updateCameraProjection(this.canvas.width, this.canvas.height);
    }
    this.renderer.requestRender();
  }

  private updateStatusLabel() {
    const atomCount =
      this.structure === "Cu4" ? "4 atoms" : "256 atoms (4x4x4)";
    const cameraModeLabel =
      this.cameraMode === "perspective" ? "Perspective" : "Orthographic";
    this.setStatusMessage(
      `Cu FCC | ${atomCount} | Camera: ${cameraModeLabel} | press 'b' to toggle atoms, 'c' to toggle camera`,
    );
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

  private async toggleCameraMode() {
    this.cameraMode =
      this.cameraMode === "perspective" ? "orthographic" : "perspective";
    this.updateStatusLabel();

    await this.initPromise;
    if (!this.threeRenderer) return;

    const { size } = this.getSquareLayout();
    this.camera = this.createCamera(size, size);
    this.threeRenderer.setActiveCamera(this.camera);
    this.renderer.requestRender();
  }

  private createCamera(width: number, height: number) {
    const aspect = width / height || 1;
    if (this.cameraMode === "orthographic") {
      const halfHeight = this.getOrthoFrustumHalfHeight();
      const halfWidth = halfHeight * aspect;
      const camera = new OrthographicCamera(
        -halfWidth,
        halfWidth,
        halfHeight,
        -halfHeight,
        0.1,
        10,
      );
      camera.position.copy(this.cameraPosition);
      camera.lookAt(0, 0, 0);
      return camera;
    }

    const camera = new PerspectiveCamera(55, aspect, 0.1, 10);
    camera.position.copy(this.cameraPosition);
    camera.lookAt(0, 0, 0);
    return camera;
  }

  private updateCameraProjection(width: number, height: number) {
    if (!this.camera) return;
    const aspect = width / height || 1;

    if (this.camera instanceof PerspectiveCamera) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      return;
    }

    const halfHeight = this.getOrthoFrustumHalfHeight();
    const halfWidth = halfHeight * aspect;
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }

  private getOrthoFrustumHalfHeight() {
    return this.structure === "Cu256" ? 2.6 : 1.8;
  }

  private getSquareLayout() {
    const availableWidth = Math.max(1, this.contentWidth);
    const availableHeight = Math.max(1, this.contentHeight);
    const size = Math.max(1, Math.min(availableWidth, availableHeight));
    const left = Math.floor((availableWidth - size) / 2);
    const top = Math.floor((availableHeight - size) / 2);

    return { size, left, top };
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
