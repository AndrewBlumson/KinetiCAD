import * as THREE from "three";

const ORANGE = 0xff6b1a;
const ALUMINIUM = 0xc8ccd2;
const NAVY = 0x0a0e1a;

// Depth-stack so the four links never intersect each other in 3D — exactly how
// a real four-bar mechanism is assembled (each bar sits on its own plane, with
// pin joints that bridge the gaps). Gaps between adjacent planes are kept
// generously larger than each bar's depth so there is no visual overlap from
// any camera angle, even at extreme poses of the crank cycle.
const Z_GROUND = -0.6;
const Z_CRANK = -0.18;
const Z_COUPLER = 0.22;
const Z_ROCKER = 0.62;
// O2/O4 fixed pins are short stub bolts protruding from the base blocks —
// just enough visual cue that the ground bar is bolted to the table. The
// crank and rocker pivot internally about their groups, so the bolts
// deliberately stop well below the moving links.
const PIVOT_LEN_O = 0.5;
const PIVOT_CENTRE_O = Z_GROUND + PIVOT_LEN_O / 2 - 0.05;

type Renderer = THREE.WebGLRenderer | { render: (scene: THREE.Scene, camera: THREE.Camera) => void; setPixelRatio: (n: number) => void; setSize: (w: number, h: number, updateStyle?: boolean) => void; dispose?: () => void; domElement: HTMLCanvasElement };

export type CameraPreset = {
  /** Distance from the mechanism centre. */
  distance: number;
  /** Polar angle in radians (0 = straight overhead, pi/2 = horizon). */
  polar: number;
  /** Focus offset relative to the mechanism centre. */
  target: THREE.Vector3;
  /** Field of view in degrees. */
  fov: number;
};

/**
 * Parametric four-bar linkage simulation rendered via Three.js.
 *
 * Geometry follows a Grashof crank-rocker: the input crank is the shortest
 * link, so it can rotate continuously while the output rocker oscillates.
 */
export class FourBarLinkage {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer!: Renderer;
  private clock = new THREE.Clock();
  private rafId = 0;

  // Linkage proportions (Grashof crank-rocker)
  private readonly groundLen = 1.6; // distance between fixed pivots O2-O4
  private readonly crankLen = 0.55; // input crank
  private readonly couplerLen = 1.7; // connecting rod
  private readonly rockerLen = 1.2; // output rocker

  private theta2 = 0;
  /** Angular velocity of the input crank in rad/s (60 RPM = 2π rad/s). */
  public angularVelocity = (60 / 60) * Math.PI * 2;

  // Current camera state (animated by GSAP via direct property writes)
  public cameraDistance = 5.5;
  public cameraPolar = 1.05;
  public cameraAzimuth = 0.55;
  public cameraTargetX = 0.55;
  public cameraTargetY = 0.0;
  public cameraTargetZ = 0.1;
  public cameraFov = 32;

  // Auto-orbit
  public orbitSpeed = 0; // rad/s

  // Mechanism object handles
  private crankPivot!: THREE.Group;
  private crankBar!: THREE.Mesh;
  private couplerGroup!: THREE.Group;
  private couplerBar!: THREE.Mesh;
  private rockerPivot!: THREE.Group;
  private rockerBar!: THREE.Mesh;
  private motorIndicator!: THREE.Mesh;
  private rendererKind: "webgpu" | "webgl" = "webgl";

  constructor(private canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(this.cameraFov, 1, 0.05, 100);

    this.setupLighting();
    this.buildLinkage();
    this.buildEnvironment();
  }

  /**
   * Initialise the renderer.
   *
   * Auto-detects WebGPU: if `navigator.gpu.requestAdapter()` resolves to a
   * valid adapter we use the `three/webgpu` renderer (the modern GPU pipeline
   * targeted by KinetiCAD on M-series Macs). Otherwise we fall back to the
   * Three.js WebGLRenderer (WebGL2 in modern browsers). If even WebGL is not
   * available — for example inside the Replit preview iframe, which has no
   * GPU — `init()` throws and the caller can render a static fallback.
   *
   * Escape hatch: pass `?webgpu=0` to force the WebGL path (useful for
   * debugging WebGPU-specific issues against a known-good baseline).
   *
   * Note: once a canvas has a 'webgpu' context attached it cannot be used
   * for WebGL on the same element, so we only commit to WebGPU when adapter
   * detection succeeds before any context creation.
   */
  public async init(): Promise<void> {
    const forceWebGL =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("webgpu") === "0";

    let madeWebGPU = false;
    if (!forceWebGL) {
      try {
        const nav: unknown =
          typeof navigator !== "undefined" ? navigator : null;
        const gpu = (nav as { gpu?: { requestAdapter?: () => Promise<unknown> } } | null)?.gpu;
        if (gpu && typeof gpu.requestAdapter === "function") {
          const adapter = await gpu.requestAdapter();
          if (adapter) {
            const mod = await import("three/webgpu");
            const WebGPURenderer = (
              mod as { WebGPURenderer: new (params: unknown) => unknown }
            ).WebGPURenderer;
            const r = new WebGPURenderer({
              canvas: this.canvas,
              antialias: true,
              alpha: true,
            }) as unknown as Renderer & {
              init: () => Promise<void>;
              outputColorSpace?: string;
              toneMapping?: number;
            };
            await r.init();
            try {
              r.outputColorSpace = THREE.SRGBColorSpace;
              r.toneMapping = THREE.ACESFilmicToneMapping;
            } catch {
              /* ignore */
            }
            this.renderer = r;
            madeWebGPU = true;
            this.rendererKind = "webgpu";
          }
        }
      } catch (err) {
        console.warn("[FourBarLinkage] WebGPU init failed, using WebGL", err);
      }
    }

    if (!madeWebGPU) {
      // Wrap construction so we can throw a typed, loggable error that the
      // App-level catch site can use to render a static fallback. WebGL
      // creation can fail in headless preview environments without a GPU.
      try {
        const r = new THREE.WebGLRenderer({
          canvas: this.canvas,
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
        });
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.05;
        r.shadowMap.enabled = true;
        r.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer = r;
        this.rendererKind = "webgl";
      } catch (err) {
        throw new Error(
          "WebGL context unavailable in this environment. Recording target (M-series Chrome) is unaffected.",
          { cause: err as Error },
        );
      }
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  public get usingWebGPU(): boolean {
    return this.rendererKind === "webgpu";
  }

  public setSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  public setMotorRPM(rpm: number): void {
    this.angularVelocity = (rpm / 60) * Math.PI * 2;
  }

  public start(): void {
    if (this.rafId) return;
    this.clock.start();
    const tick = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.update(dt);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public stop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  public dispose(): void {
    this.stop();
    const r = this.renderer as { dispose?: () => void };
    if (r && typeof r.dispose === "function") r.dispose();
    this.scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) {
        if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
        else mat.dispose();
      }
    });
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0x9aa6c2, 0.45);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff4e0, 1.4);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -3;
    key.shadow.camera.right = 3;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -3;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 20;
    key.shadow.bias = -0.0005;
    this.scene.add(key);

    // Replit-orange rim light for warmth
    const rim = new THREE.DirectionalLight(0xff8a3a, 0.6);
    rim.position.set(-4, 2, -3);
    this.scene.add(rim);

    // Soft cool fill from below to lift the dark side
    const fill = new THREE.DirectionalLight(0x6b88ff, 0.28);
    fill.position.set(-2, -3, 2);
    this.scene.add(fill);
  }

  private buildEnvironment(): void {
    // Subtle ground plane to catch shadows and ground the mechanism.
    const groundMat = new THREE.MeshStandardMaterial({
      color: NAVY,
      metalness: 0.1,
      roughness: 0.85,
      transparent: true,
      opacity: 0.85,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Faint grid for technical feel
    const grid = new THREE.GridHelper(20, 40, 0x1c2440, 0x141a2e);
    grid.position.y = -1.199;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.45;
    this.scene.add(grid);
  }

  private makeBarMesh(length: number, width: number, depth: number, color: number) {
    const geo = new THREE.BoxGeometry(length, width, depth, 1, 1, 1);
    geo.translate(length / 2, 0, 0); // pivot at left end
    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.55,
      roughness: 0.32,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private makePivotMesh(radius: number, depth: number, color: number) {
    const geo = new THREE.CylinderGeometry(radius, radius, depth, 24);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.6,
      roughness: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  private buildLinkage(): void {
    const root = new THREE.Group();
    this.scene.add(root);

    // Mechanism is laid out in the X-Y plane; Z is depth (bar thickness).
    // O2 at origin, O4 at (groundLen, 0).
    //
    // To prevent the moving bars from passing through each other as the crank
    // rotates, each moving link gets its own Z plane — exactly how a real
    // four-bar mechanism is assembled (the bars are stacked behind/in-front of
    // each other and connected with pin joints that span the gap):
    //   - groundBar: behind everything (Z_GROUND)
    //   - crankBar:  Z_CRANK  (closest to ground)
    //   - couplerBar: Z_COUPLER (middle)
    //   - rockerBar: Z_ROCKER (furthest from ground / closest to viewer)
    // The pivot pins A, B, O2, O4 are cylinders along Z, long enough to bridge
    // every plane so the joint visually fastens the bars together.

    // Ground bar: from O2 to O4, mounted at the rearmost plane.
    const groundBar = this.makeBarMesh(this.groundLen, 0.18, 0.18, ALUMINIUM);
    groundBar.position.set(0, 0, Z_GROUND);
    root.add(groundBar);

    // Fixed-base block on each end for visual mass — sits behind the ground bar.
    const baseGeo = new THREE.BoxGeometry(0.4, 0.4, 0.45);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x222838,
      metalness: 0.4,
      roughness: 0.6,
    });
    const baseL = new THREE.Mesh(baseGeo, baseMat);
    baseL.position.set(0, -0.25, Z_GROUND - 0.05);
    baseL.castShadow = true;
    baseL.receiveShadow = true;
    root.add(baseL);
    const baseR = baseL.clone();
    baseR.position.x = this.groundLen;
    root.add(baseR);

    // Crank pivot/group at O2 — sits on the crank Z plane.
    this.crankPivot = new THREE.Group();
    this.crankPivot.position.set(0, 0, Z_CRANK);
    root.add(this.crankPivot);

    // Crank bar (orange, points along +X by default; rotated by theta2 about Z)
    this.crankBar = this.makeBarMesh(this.crankLen, 0.16, 0.16, ORANGE);
    this.crankBar.position.set(0, 0, 0);
    this.crankPivot.add(this.crankBar);

    // Motor housing behind the crank, on the ground plane.
    const motorMat = new THREE.MeshStandardMaterial({
      color: 0x2a3045,
      metalness: 0.7,
      roughness: 0.35,
    });
    const motorHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.32, 24),
      motorMat,
    );
    motorHousing.rotation.x = Math.PI / 2;
    motorHousing.position.set(0, 0, Z_GROUND - 0.05);
    motorHousing.castShadow = true;
    root.add(motorHousing);

    // Motor pivot disc (rotates with crank, has an orange notch indicator)
    const motorDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.05, 24),
      new THREE.MeshStandardMaterial({
        color: 0x18202f,
        metalness: 0.7,
        roughness: 0.3,
      }),
    );
    motorDisc.rotation.x = Math.PI / 2;
    // Sits at the back of the crank, between crank-plane and ground bar.
    motorDisc.position.set(0, 0, -0.08);
    this.crankPivot.add(motorDisc);
    this.motorIndicator = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.03, 0.06),
      new THREE.MeshStandardMaterial({
        color: ORANGE,
        emissive: ORANGE,
        emissiveIntensity: 0.4,
        metalness: 0.4,
        roughness: 0.4,
      }),
    );
    this.motorIndicator.position.set(0.085, 0, -0.05);
    this.crankPivot.add(this.motorIndicator);

    // Coupler (connecting rod) — middle Z plane between crank and rocker.
    this.couplerGroup = new THREE.Group();
    this.couplerGroup.position.set(0, 0, Z_COUPLER);
    root.add(this.couplerGroup);
    this.couplerBar = this.makeBarMesh(this.couplerLen, 0.13, 0.13, ORANGE);
    this.couplerGroup.add(this.couplerBar);

    // Rocker — front-most Z plane, pivoting at O4.
    this.rockerPivot = new THREE.Group();
    this.rockerPivot.position.set(this.groundLen, 0, Z_ROCKER);
    root.add(this.rockerPivot);
    this.rockerBar = this.makeBarMesh(this.rockerLen, 0.14, 0.14, ORANGE);
    this.rockerPivot.add(this.rockerBar);

    // Decorative pin joints (steel cylinders along Z).
    //
    // O2 / O4 are fixed pins that bolt the ground bar through to the rocker
    // plane — placed at the root so they never rotate with the bars.
    // A / B ride with their respective end groups so the pin visually moves
    // with the joint, bridging crank↔coupler and coupler↔rocker respectively.
    const PIN_COLOR = 0xf3f4f6;
    const pinCentreA = (Z_CRANK + Z_COUPLER) / 2;
    const pinCentreB = (Z_COUPLER + Z_ROCKER) / 2;
    const PIN_LEN_A = Z_COUPLER - Z_CRANK + 0.12;
    const PIN_LEN_B = Z_ROCKER - Z_COUPLER + 0.12;

    const pivotO2 = this.makePivotMesh(0.085, PIVOT_LEN_O, PIN_COLOR);
    pivotO2.position.set(0, 0, PIVOT_CENTRE_O);
    root.add(pivotO2);
    const pivotO4 = this.makePivotMesh(0.085, PIVOT_LEN_O, PIN_COLOR);
    pivotO4.position.set(this.groundLen, 0, PIVOT_CENTRE_O);
    root.add(pivotO4);

    // Pin A — at end of crank, riding with crankPivot. In crankPivot's local
    // frame (rotated by theta2), the pin centre Z is offset from the crank
    // bar plane (Z_CRANK) up to half-way between crank and coupler.
    const pivotA = this.makePivotMesh(0.07, PIN_LEN_A, PIN_COLOR);
    pivotA.position.set(this.crankLen, 0, pinCentreA - Z_CRANK);
    this.crankPivot.add(pivotA);

    // Pin B — at end of rocker, riding with rockerPivot. Local Z offset
    // similar to pin A but bridging coupler to rocker plane.
    const pivotB = this.makePivotMesh(0.07, PIN_LEN_B, PIN_COLOR);
    pivotB.position.set(this.rockerLen, 0, pinCentreB - Z_ROCKER);
    this.rockerPivot.add(pivotB);

    // Initial mechanism pose
    this.updateMechanism(0);
  }

  /**
   * Solve the four-bar position problem for a given input angle theta2.
   * Returns the rocker angle theta4 (chosen branch consistent with the
   * Grashof crank-rocker upper configuration).
   */
  private solveTheta4(theta2: number): { theta4: number; bx: number; by: number } {
    const r = this.crankLen;
    const l = this.couplerLen;
    const g = this.rockerLen;
    const a = this.groundLen;

    // Position of A (end of crank)
    const ax = r * Math.cos(theta2);
    const ay = r * Math.sin(theta2);

    // Vector from A to O4
    const dx = a - ax;
    const dy = -ay;
    const d = Math.sqrt(dx * dx + dy * dy);

    // If geometry is invalid for this pose, just hold previous
    if (d > l + g || d < Math.abs(l - g) || d === 0) {
      return { theta4: 0, bx: a, by: 0 };
    }

    // Distance from A to midpoint along A->O4 line
    const aDist = (l * l - g * g + d * d) / (2 * d);
    const hSq = l * l - aDist * aDist;
    const h = hSq > 0 ? Math.sqrt(hSq) : 0;

    // Midpoint
    const mx = ax + (aDist * dx) / d;
    const my = ay + (aDist * dy) / d;

    // Perpendicular direction (we always pick the +y branch so the coupler
    // rides above the ground bar — gives a clean visual cycle)
    const perpX = -dy / d;
    const perpY = dx / d;

    // Pick the branch where B is on the upper half
    let bx = mx + h * perpX;
    let by = my + h * perpY;
    if (by < my) {
      bx = mx - h * perpX;
      by = my - h * perpY;
    }

    const theta4 = Math.atan2(by - 0, bx - a);
    return { theta4, bx, by };
  }

  private updateMechanism(theta2: number): void {
    const { theta4, bx, by } = this.solveTheta4(theta2);

    // Crank rotates by theta2 about its pivot (Z axis)
    this.crankPivot.rotation.z = theta2;

    // Rocker rotates by theta4 about its pivot
    this.rockerPivot.rotation.z = theta4;

    // Coupler: position at A in the X-Y plane, but stay on its own Z plane so
    // it visually rides in front of the crank and behind the rocker.
    const ax = this.crankLen * Math.cos(theta2);
    const ay = this.crankLen * Math.sin(theta2);
    this.couplerGroup.position.set(ax, ay, Z_COUPLER);
    const angle = Math.atan2(by - ay, bx - ax);
    this.couplerGroup.rotation.z = angle;
  }

  private updateCamera(): void {
    const r = this.cameraDistance;
    const polar = this.cameraPolar;
    const az = this.cameraAzimuth;

    // Spherical -> cartesian; +Y is up, polar measured from +Y axis.
    const sinP = Math.sin(polar);
    const cosP = Math.cos(polar);
    const x = r * sinP * Math.sin(az);
    const y = r * cosP;
    const z = r * sinP * Math.cos(az);

    // Centre on the mechanism
    const tx = this.cameraTargetX;
    const ty = this.cameraTargetY;
    const tz = this.cameraTargetZ;

    this.camera.position.set(tx + x, ty + y, tz + z);
    this.camera.lookAt(tx, ty, tz);

    if (this.camera.fov !== this.cameraFov) {
      this.camera.fov = this.cameraFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private update(dt: number): void {
    this.theta2 += this.angularVelocity * dt;
    if (this.theta2 > Math.PI * 2) this.theta2 -= Math.PI * 2;

    if (this.orbitSpeed !== 0) {
      this.cameraAzimuth += this.orbitSpeed * dt;
    }

    this.updateMechanism(this.theta2);
    this.updateCamera();

    this.renderer.render(this.scene, this.camera);
  }
}

export const CAMERA_PRESETS: Record<string, CameraPreset> = {
  threeQuarter: {
    distance: 5.5,
    polar: 1.05,
    target: new THREE.Vector3(0.55, 0, 0.1),
    fov: 32,
  },
  closePivot: {
    distance: 1.6,
    polar: 1.2,
    target: new THREE.Vector3(0.05, 0.05, 0.0),
    fov: 30,
  },
  cinematicWide: {
    distance: 6.5,
    polar: 1.0,
    target: new THREE.Vector3(0.55, 0.05, 0.1),
    fov: 30,
  },
};
