/**
 * Three.js 3D Bedroom, Cuco Monster, and Retro Handheld Console.
 * Follows Three.js architectural directives: PBR materials, composite models, zero 404s.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MiniGameEngine } from '../minigames/MiniGameEngine';
import { MonsterLocation } from '../types';

export class RoomScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public consoleMeshGroup: THREE.Group;
  public consoleScreenMaterial: THREE.MeshBasicMaterial;
  public screenTexture: THREE.CanvasTexture;
  public cucoMonster: THREE.Group;
  public digitalClockTextCanvas: HTMLCanvasElement;
  public digitalClockTexture: THREE.CanvasTexture;
  public videoTexture: THREE.VideoTexture | null = null;
  public arBackgroundMesh: THREE.Mesh | null = null;
  public roomGroup: THREE.Group;
  public flashlight: THREE.SpotLight;
  public flashlightTarget: THREE.Object3D;
  private _camDir = new THREE.Vector3();

  // Cuco monster parts for animation
  private cucoEyes: THREE.Mesh[] = [];
  private cucoJaw: THREE.Mesh | null = null;
  private cucoLeftArm: THREE.Group | null = null;
  private cucoRightArm: THREE.Group | null = null;
  private monsterTargetPos = new THREE.Vector3();
  private monsterTargetRotY = 0;

  // Nightstand lamp light
  public lampLight: THREE.PointLight;
  public moonlight: THREE.DirectionalLight;

  private isSoftwareGl: boolean;
  private dustParticles: THREE.Points;

  // Cuco spawn anchor locations in room coordinates
  public static readonly LOCATIONS: Record<MonsterLocation, { pos: [number, number, number]; rotY: number }> = {
    closet: { pos: [-3.2, 0, -1.8], rotY: Math.PI / 3.2 },
    door: { pos: [3.3, 0, -1.0], rotY: -Math.PI / 2.4 },
    window: { pos: [-0.6, 0.4, -3.5], rotY: 0 },
    footbed: { pos: [0, 0, -1.8], rotY: 0 },
    desk: { pos: [2.5, 0, -2.6], rotY: -Math.PI / 4 },
  };

  constructor(container: HTMLDivElement, miniGameEngine: MiniGameEngine) {
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // Scene setup - Pitch dark bedroom
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x010204, 0.12);

    // Camera at bed eye level
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 40);
    this.camera.position.set(0, 1.25, 0.2); // Sitted on bed looking forward

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    // Procedural Studio Environment (very low intensity for dark room)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.01).texture;
    pmremGenerator.dispose();

    // Pitch dark bedroom lighting
    const hemiLight = new THREE.HemisphereLight(0x060810, 0x000000, 0.08);
    this.scene.add(hemiLight);

    // Faint moonlight through window
    this.moonlight = new THREE.DirectionalLight(0x18253a, 0.15);
    this.moonlight.position.set(-2, 4, -4);
    this.scene.add(this.moonlight);

    // Bedside lamp (very faint warm nightstand glow)
    this.lampLight = new THREE.PointLight(0xffaa44, 0.2, 2.5, 2);
    this.lampLight.position.set(-1.45, 0.95, 0.5);
    this.scene.add(this.lampLight);

    // --- PLAYER FLASHLIGHT (Linterna estrecha de radio pequeño hacia donde apuntas) ---
    // Narrow cone (Math.PI / 10 = 18 degrees) with short, focused reach
    this.flashlight = new THREE.SpotLight(0xffeedd, 5.5, 12, Math.PI / 10, 0.3, 1.8);
    this.flashlight.position.copy(this.camera.position);
    this.flashlight.castShadow = !this.isSoftwareGl;
    if (!this.isSoftwareGl) {
      this.flashlight.shadow.mapSize.width = 512;
      this.flashlight.shadow.mapSize.height = 512;
      this.flashlight.shadow.bias = -0.001;
    }

    this.flashlightTarget = new THREE.Object3D();
    this.scene.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;
    this.scene.add(this.flashlight);

    // Subtle console screen glow on hands
    const consoleGlow = new THREE.PointLight(0x38bdf8, 0.35, 1.2, 2);
    consoleGlow.position.set(0, -0.1, -0.2);
    this.camera.add(consoleGlow);

    // Build the 3D Room
    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);
    this.buildRoom();

    // Build the Cuco Monster
    this.cucoMonster = this.buildCucoMonster();
    this.cucoMonster.position.set(0, -10, 0); // hidden initially
    this.scene.add(this.cucoMonster);

    // Setup Console Canvas Texture
    this.screenTexture = new THREE.CanvasTexture(miniGameEngine.canvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.screenTexture.minFilter = THREE.LinearFilter;
    this.screenTexture.magFilter = THREE.NearestFilter;
    this.consoleScreenMaterial = new THREE.MeshBasicMaterial({
      map: this.screenTexture,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    // Build 3D Handheld Console and attach to camera so it tracks player hands
    this.consoleMeshGroup = this.buildHandheldConsole();
    this.camera.add(this.consoleMeshGroup);
    this.scene.add(this.camera);

    // Digital Clock canvas setup on nightstand
    this.digitalClockTextCanvas = document.createElement('canvas');
    this.digitalClockTextCanvas.width = 256;
    this.digitalClockTextCanvas.height = 128;
    this.digitalClockTexture = new THREE.CanvasTexture(this.digitalClockTextCanvas);
    this.digitalClockTexture.colorSpace = THREE.SRGBColorSpace;
    this.updateClockDisplay('12:00 AM');

    // Dust particles in moonlight
    this.dustParticles = this.buildDustParticles();
    this.scene.add(this.dustParticles);
  }

  // --- ROOM GEOMETRY & MATERIALS ---
  private buildRoom() {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(8, 8);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x241812,
      roughness: 0.65,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = !this.isSoftwareGl;
    this.roomGroup.add(floor);

    // Cozy bedroom rug
    const rugGeo = new THREE.CircleGeometry(1.6, 32);
    const rugMat = new THREE.MeshStandardMaterial({
      color: 0x2a394a,
      roughness: 0.95,
      metalness: 0.0,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.01, 0.8);
    this.roomGroup.add(rug);

    // Ceiling
    const ceilGeo = new THREE.PlaneGeometry(8, 8);
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x121526,
      roughness: 0.9,
    });
    const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 3.2;
    this.roomGroup.add(ceiling);

    // Walls material with soft bedroom wallpaper tone
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1e2438,
      roughness: 0.8,
    });

    // North wall (Window side)
    const northWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.2), wallMat);
    northWall.position.set(0, 1.6, -4);
    northWall.receiveShadow = !this.isSoftwareGl;
    this.roomGroup.add(northWall);

    // South wall (Behind player)
    const southWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.2), wallMat);
    southWall.rotation.y = Math.PI;
    southWall.position.set(0, 1.6, 4);
    this.roomGroup.add(southWall);

    // West wall (Closet side)
    const westWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.2), wallMat);
    westWall.rotation.y = Math.PI / 2;
    westWall.position.set(-4, 1.6, 0);
    westWall.receiveShadow = !this.isSoftwareGl;
    this.roomGroup.add(westWall);

    // East wall (Door side)
    const eastWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3.2), wallMat);
    eastWall.rotation.y = -Math.PI / 2;
    eastWall.position.set(4, 1.6, 0);
    eastWall.receiveShadow = !this.isSoftwareGl;
    this.roomGroup.add(eastWall);

    // --- BED (Player sits on bed looking forward towards room) ---
    const bedGroup = new THREE.Group();
    // Bed frame
    const bedFrameMat = new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.7 });
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 2.6), bedFrameMat);
    bedFrame.position.set(0, 0.225, 0.2);
    bedFrame.castShadow = !this.isSoftwareGl;
    bedGroup.add(bedFrame);

    // Mattress & Quilt over legs
    const quiltMat = new THREE.MeshStandardMaterial({ color: 0x243455, roughness: 0.85 });
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 2.5), quiltMat);
    mattress.position.set(0, 0.45, 0.2);
    bedGroup.add(mattress);

    // Bed blanket fold covering player's legs in view
    const blanketFold = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.16, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x3b4f74, roughness: 0.9 })
    );
    blanketFold.position.set(0, 0.65, -0.4);
    bedGroup.add(blanketFold);

    // Headboard BEHIND the player (at Z = +1.4)
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 0.15), bedFrameMat);
    headboard.position.set(0, 0.8, 1.4);
    headboard.castShadow = !this.isSoftwareGl;
    bedGroup.add(headboard);

    // Pillow behind player head
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 });
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.45), pillowMat);
    pillow.position.set(0, 0.72, 1.15);
    pillow.rotation.x = -0.2;
    bedGroup.add(pillow);

    this.roomGroup.add(bedGroup);

    // --- NIGHTSTAND & DIGITAL CLOCK (Beside player on left) ---
    const nightstandGroup = new THREE.Group();
    const standMat = new THREE.MeshStandardMaterial({ color: 0x2c1d15, roughness: 0.6 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), standMat);
    table.position.set(-1.45, 0.35, 0.5);
    table.castShadow = !this.isSoftwareGl;
    nightstandGroup.add(table);

    // Lamp base & shade
    const lampBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3 })
    );
    lampBase.position.set(-1.45, 0.74, 0.5);
    nightstandGroup.add(lampBase);

    const lampShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.24, 0.28, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xfff0dd, roughness: 0.5, side: THREE.DoubleSide })
    );
    lampShade.position.set(-1.45, 0.95, 0.5);
    nightstandGroup.add(lampShade);

    // Digital Alarm Clock angled towards player bed
    const clockBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.12, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4 })
    );
    clockBody.position.set(-1.25, 0.76, 0.3);
    clockBody.rotation.y = Math.PI / 4;
    nightstandGroup.add(clockBody);

    const clockDisplayGeo = new THREE.PlaneGeometry(0.18, 0.08);
    const clockDisplayMat = new THREE.MeshBasicMaterial({
      map: this.digitalClockTexture,
    });
    const clockFace = new THREE.Mesh(clockDisplayGeo, clockDisplayMat);
    clockFace.position.set(-1.24, 0.76, 0.31);
    clockFace.rotation.y = Math.PI / 4;
    nightstandGroup.add(clockFace);

    this.roomGroup.add(nightstandGroup);

    // --- CLOSET WITH OPEN DOOR (Cuco spot 1) ---
    const closetGroup = new THREE.Group();
    closetGroup.position.set(-3.7, 0, -2.4);

    // Closet frame
    const closetFrameMat = new THREE.MeshStandardMaterial({ color: 0x271e1b });
    const cWall1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 1.6), closetFrameMat);
    cWall1.position.set(0, 1.3, 0);
    closetGroup.add(cWall1);

    // Dark interior backing
    const cBack = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 2.6),
      new THREE.MeshBasicMaterial({ color: 0x020306 })
    );
    cBack.rotation.y = Math.PI / 2;
    cBack.position.set(-0.25, 1.3, 0);
    closetGroup.add(cBack);

    // Slightly open closet door
    const cDoor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.5, 0.85), closetFrameMat);
    cDoor.position.set(0.2, 1.25, -0.4);
    cDoor.rotation.y = 0.35; // Ajar!
    closetGroup.add(cDoor);

    this.roomGroup.add(closetGroup);

    // --- BEDROOM HALLWAY DOOR (Cuco spot 2) ---
    const doorGroup = new THREE.Group();
    doorGroup.position.set(3.9, 0, -0.6);
    doorGroup.rotation.y = -Math.PI / 2;

    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.4, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x3f2e24 })
    );
    doorFrame.position.set(0, 1.2, 0);
    doorGroup.add(doorFrame);

    // Door cracked open into black hallway
    const doorLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 2.35, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x4a3b30 })
    );
    doorLeaf.position.set(0.5, 1.2, 0.3);
    doorLeaf.rotation.y = 0.4;
    doorGroup.add(doorLeaf);

    // Black void behind door
    const hallwayVoid = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 2.5),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    hallwayVoid.position.set(0, 1.2, 0.08);
    doorGroup.add(hallwayVoid);

    this.roomGroup.add(doorGroup);

    // --- WINDOW & MOONLIGHT (Cuco spot 3) ---
    const windowGroup = new THREE.Group();
    windowGroup.position.set(-0.6, 1.8, -3.98);

    const winFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 1.4, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x222a3a })
    );
    windowGroup.add(winFrame);

    // Night sky glass
    const winGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.2),
      new THREE.MeshBasicMaterial({ color: 0x0b132b })
    );
    winGlass.position.z = 0.05;
    windowGroup.add(winGlass);

    // Moon disc
    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 32),
      new THREE.MeshBasicMaterial({ color: 0xe0e7ff })
    );
    moon.position.set(0.5, 0.3, 0.06);
    windowGroup.add(moon);

    this.roomGroup.add(windowGroup);

    // --- DESK & TOY SHELF (Cuco spot 5) ---
    const deskGroup = new THREE.Group();
    deskGroup.position.set(2.8, 0, -2.8);
    const deskTop = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.06, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x422d22 })
    );
    deskTop.position.set(0, 0.75, 0);
    deskGroup.add(deskTop);

    // Desk chair
    const chair = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.8, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.9 })
    );
    chair.position.set(0, 0.4, 0.6);
    chair.rotation.y = 0.3;
    deskGroup.add(chair);

    // Cute plushies from moodboard (yellow bear & toy mouse)
    const toyBear = this.buildToyPlushie(0xfacc15); // Yellow bear
    toyBear.position.set(-0.4, 0.88, -0.1);
    toyBear.scale.set(0.65, 0.65, 0.65);
    deskGroup.add(toyBear);

    this.roomGroup.add(deskGroup);
  }

  // --- PROCEDURAL TOY PLUSHIE (Decor) ---
  private buildToyPlushie(colorHex: number): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.95 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), mat);
    head.position.y = 0.2;
    group.add(head);

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), mat);
    body.position.y = 0.08;
    group.add(body);

    // Ears
    const ear1 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), mat);
    ear1.position.set(0.08, 0.3, 0);
    group.add(ear1);
    const ear2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), mat);
    ear2.position.set(-0.08, 0.3, 0);
    group.add(ear2);

    return group;
  }

  // --- CUCO MONSTER 3D COMPOSITE MODEL ---
  // Faithfully modeled from the user's sketch:
  // Diamond/chiseled geometric head, wide staring round eyes with dark pupils,
  // open jaw with sharp jagged teeth, blocky torso, segmented long arms, claw/pincer hands!
  private buildCucoMonster(): THREE.Group {
    const monster = new THREE.Group();

    // Moodboard palette: Cobalt blue body (#25489c), Red joints/accents (#d92027), Yellow eyes (#ffcc00)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a7a,
      roughness: 0.4,
      metalness: 0.2,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.5,
    });
    const eyeGlowMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
    });
    const pupilMat = new THREE.MeshBasicMaterial({
      color: 0x050505,
    });
    const toothMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.2,
    });

    // 1. Chiseled diamond/octahedral head
    const headGeo = new THREE.OctahedronGeometry(0.38, 0);
    headGeo.scale(1.1, 1.25, 1.0);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 1.95, 0);
    monster.add(head);

    // 2. Wide staring round eyes (from sketch!)
    [-0.14, 0.14].forEach((xOffset) => {
      const eyeRim = new THREE.Mesh(
        new THREE.RingGeometry(0.03, 0.085, 16),
        accentMat
      );
      eyeRim.position.set(xOffset, 2.05, 0.32);
      monster.add(eyeRim);

      const eye = new THREE.Mesh(
        new THREE.CircleGeometry(0.07, 16),
        eyeGlowMat
      );
      eye.position.set(xOffset, 2.05, 0.325);
      monster.add(eye);
      this.cucoEyes.push(eye);

      const pupil = new THREE.Mesh(
        new THREE.CircleGeometry(0.025, 12),
        pupilMat
      );
      pupil.position.set(xOffset, 2.05, 0.33);
      monster.add(pupil);
    });

    // 3. Open mouth with jagged triangular teeth ("Lulo" mouth from sketch!)
    const jaw = new THREE.Group();
    jaw.position.set(0, 1.85, 0.28);
    // Lower jaw geometry
    const jawBase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.2), bodyMat);
    jaw.add(jawBase);

    // Jagged teeth along bottom and top
    for (let i = -3; i <= 3; i++) {
      const toothGeo = new THREE.ConeGeometry(0.022, 0.06, 4);
      // Bottom teeth
      const bTooth = new THREE.Mesh(toothGeo, toothMat);
      bTooth.position.set(i * 0.045, 0.05, 0.08);
      jaw.add(bTooth);

      // Top teeth
      const tTooth = new THREE.Mesh(toothGeo, toothMat);
      tTooth.position.set(i * 0.045, 0.15, 0.08);
      tTooth.rotation.z = Math.PI;
      jaw.add(tTooth);
    }
    monster.add(jaw);
    this.cucoJaw = jawBase;

    // 4. Blocky angular Torso (from sketch)
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.35), bodyMat);
    chest.position.set(0, 1.5, 0);
    monster.add(chest);

    // Red center diamond emblem
    const emblem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.08, 0),
      accentMat
    );
    emblem.position.set(0, 1.5, 0.19);
    monster.add(emblem);

    const waist = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.28), bodyMat);
    waist.position.set(0, 1.15, 0);
    monster.add(waist);

    // 5. Left Arm with segmented joint and claw/pincer
    this.cucoLeftArm = new THREE.Group();
    this.cucoLeftArm.position.set(-0.35, 1.6, 0);
    const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), accentMat);
    this.cucoLeftArm.add(shoulderL);
    const bicepL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), bodyMat);
    bicepL.position.set(-0.06, -0.22, 0);
    this.cucoLeftArm.add(bicepL);
    const clawL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.08), accentMat);
    clawL.position.set(-0.06, -0.55, 0.06);
    this.cucoLeftArm.add(clawL);
    monster.add(this.cucoLeftArm);

    // 6. Right Arm (asymmetrical saw/claw arm as sketched in moodboard!)
    this.cucoRightArm = new THREE.Group();
    this.cucoRightArm.position.set(0.35, 1.6, 0);
    const shoulderR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), accentMat);
    this.cucoRightArm.add(shoulderR);
    const bicepR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), bodyMat);
    bicepR.position.set(0.06, -0.22, 0);
    this.cucoRightArm.add(bicepR);
    // Saw/Pincer claw
    const sawClaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.12), accentMat);
    sawClaw.position.set(0.08, -0.6, 0.08);
    this.cucoRightArm.add(sawClaw);
    monster.add(this.cucoRightArm);

    // 7. Legs
    const legGeo = new THREE.BoxGeometry(0.15, 0.9, 0.16);
    const legL = new THREE.Mesh(legGeo, bodyMat);
    legL.position.set(-0.16, 0.5, 0);
    monster.add(legL);

    const legR = new THREE.Mesh(legGeo, bodyMat);
    legR.position.set(0.16, 0.5, 0);
    monster.add(legR);

    // Feet
    const footGeo = new THREE.BoxGeometry(0.18, 0.1, 0.3);
    const footL = new THREE.Mesh(footGeo, accentMat);
    footL.position.set(-0.16, 0.05, 0.06);
    monster.add(footL);

    const footR = new THREE.Mesh(footGeo, accentMat);
    footR.position.set(0.16, 0.05, 0.06);
    monster.add(footR);

    return monster;
  }

  // --- RETRO HANDHELD CONSOLE (GBA SP style clamshell) ---
  private buildHandheldConsole(): THREE.Group {
    const consoleGroup = new THREE.Group();

    // Body material (pastel pink / lilac metallic from moodboard)
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      roughness: 0.35,
      metalness: 0.3,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x9333ea,
      roughness: 0.4,
    });
    const buttonMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
    });

    // Lower half (controls)
    const lowerBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.035, 0.24),
      shellMat
    );
    lowerBody.position.set(0, -0.018, 0);
    consoleGroup.add(lowerBody);

    // D-pad on lower body
    const dpadH = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.015, 0.018), buttonMat);
    dpadH.position.set(-0.065, 0.005, 0.02);
    consoleGroup.add(dpadH);
    const dpadV = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.015, 0.055), buttonMat);
    dpadV.position.set(-0.065, 0.005, 0.02);
    consoleGroup.add(dpadV);

    // A and B Action Buttons
    const btnA = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.015, 16), buttonMat);
    btnA.position.set(0.075, 0.006, 0.035);
    consoleGroup.add(btnA);

    const btnB = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.015, 16), buttonMat);
    btnB.position.set(0.055, 0.006, 0.01);
    consoleGroup.add(btnB);

    // Start / Select buttons
    const btnSelect = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.008, 0.008), buttonMat);
    btnSelect.position.set(-0.015, 0.004, -0.06);
    consoleGroup.add(btnSelect);

    const btnStart = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.008, 0.008), buttonMat);
    btnStart.position.set(0.015, 0.004, -0.06);
    consoleGroup.add(btnStart);

    // Green power LED indicator
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.004, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    led.position.set(0.09, 0.005, -0.08);
    consoleGroup.add(led);

    // Hinge cylinder connecting bottom and top lid
    const hinge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.24, 16),
      accentMat
    );
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(0, 0.006, -0.11);
    consoleGroup.add(hinge);

    // Upper Screen Lid (Rotated up at ~115 degrees)
    const upperLid = new THREE.Group();
    upperLid.position.set(0, 0.01, -0.11);
    upperLid.rotation.x = -Math.PI / 1.55; // Opened clamshell angle

    const lidMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.02, 0.22),
      shellMat
    );
    lidMesh.position.set(0, 0, 0.11);
    upperLid.add(lidMesh);

    // Dynamic 2D Canvas LCD Screen - placed on face with polygonOffset
    this.consoleScreenMaterial.polygonOffset = true;
    this.consoleScreenMaterial.polygonOffsetFactor = -2;
    this.consoleScreenMaterial.polygonOffsetUnits = -2;

    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.21, 0.15),
      this.consoleScreenMaterial
    );
    screenMesh.rotation.x = -Math.PI / 2;
    screenMesh.position.set(0, 0.011, 0.11);
    upperLid.add(screenMesh);

    // Also add screen on reverse face to be 100% visible from any angle
    const screenMeshBack = new THREE.Mesh(
      new THREE.PlaneGeometry(0.21, 0.15),
      this.consoleScreenMaterial
    );
    screenMeshBack.rotation.x = Math.PI / 2;
    screenMeshBack.position.set(0, -0.011, 0.11);
    upperLid.add(screenMeshBack);

    consoleGroup.add(upperLid);

    // Position relative to player camera: comfortably held in hands at bottom of view
    consoleGroup.position.set(0, -0.22, -0.40);
    consoleGroup.rotation.x = 0.25;

    return consoleGroup;
  }

  // --- FLOATING MOONLIGHT DUST PARTICLES ---
  private buildDustParticles(): THREE.Points {
    const count = this.isSoftwareGl ? 60 : 180;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 1] = Math.random() * 2.8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.028,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });

    return new THREE.Points(geo, mat);
  }

  // --- UPDATE CLOCK DISPLAY ---
  public updateClockDisplay(timeStr: string) {
    const ctx = this.digitalClockTextCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, 256, 128);

    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 12;
    ctx.font = 'bold 44px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, 128, 64);

    this.digitalClockTexture.needsUpdate = true;
  }

  // --- AR BACKGROUND CAMERA TOGGLE ---
  public setupARBackground(videoElement: HTMLVideoElement) {
    if (!this.videoTexture) {
      this.videoTexture = new THREE.VideoTexture(videoElement);
      this.videoTexture.colorSpace = THREE.SRGBColorSpace;
      this.videoTexture.minFilter = THREE.LinearFilter;
      this.videoTexture.magFilter = THREE.LinearFilter;

      // Full-screen camera quad in background
      const quadGeo = new THREE.PlaneGeometry(16, 12);
      const quadMat = new THREE.MeshBasicMaterial({
        map: this.videoTexture,
        depthWrite: false,
      });
      this.arBackgroundMesh = new THREE.Mesh(quadGeo, quadMat);
      this.arBackgroundMesh.position.set(0, 1.25, -6);
      this.scene.add(this.arBackgroundMesh);
    }
  }

  public setARMode(enabled: boolean) {
    if (this.arBackgroundMesh) {
      this.arBackgroundMesh.visible = enabled;
    }
    // In AR mode, room walls become semi-transparent or fade
    this.roomGroup.visible = !enabled;
    this.scene.background = null;
  }

  // --- SPAWN OR RETREAT CUCO MONSTER ---
  public spawnCuco(location: MonsterLocation) {
    const loc = RoomScene.LOCATIONS[location];
    this.monsterTargetPos.set(loc.pos[0], loc.pos[1], loc.pos[2]);
    this.monsterTargetRotY = loc.rotY;

    this.cucoMonster.position.copy(this.monsterTargetPos);
    this.cucoMonster.rotation.y = this.monsterTargetRotY;
    this.cucoMonster.scale.set(1, 1, 1);
    this.cucoMonster.visible = true;

    // Glowing eyes flare
    this.cucoEyes.forEach((eye) => {
      (eye.material as THREE.MeshBasicMaterial).color.setHex(0xfacc15);
    });
  }

  public hideCuco() {
    this.cucoMonster.visible = false;
    this.cucoMonster.position.set(0, -10, 0);
  }

  // --- JUMPSCARE LUNGE ANIMATION ---
  public updateJumpscare(progress: number) {
    this.cucoMonster.visible = true;
    // Rapidly charge from monster's spawn position straight into camera face!
    const camPos = this.camera.position;
    this.cucoMonster.position.lerpVectors(this.monsterTargetPos, camPos, progress * 0.95);
    this.cucoMonster.lookAt(camPos.x, camPos.y, camPos.z);

    // Terrifying eye flare turning deep blood red
    this.cucoEyes.forEach((eye) => {
      (eye.material as THREE.MeshBasicMaterial).color.setHex(0xff0000);
    });

    // Shake violently
    const shake = (Math.random() - 0.5) * 0.08 * progress;
    this.cucoMonster.position.x += shake;
    this.cucoMonster.position.y += shake;

    // Open jaw wide
    if (this.cucoJaw) {
      this.cucoJaw.position.y = 1.85 - progress * 0.15;
    }
    if (this.cucoLeftArm && this.cucoRightArm) {
      this.cucoLeftArm.rotation.x = -Math.PI / 2 * progress;
      this.cucoRightArm.rotation.x = -Math.PI / 2 * progress;
    }
  }

  // --- TICK / RENDER LOOP ---
  public update(dt: number, lookingAtConsole: boolean, cameraPitch: number) {
    // 1. Update console canvas texture
    this.screenTexture.needsUpdate = true;

    // 2. Update flashlight beam direction to match camera view
    this.camera.getWorldDirection(this._camDir);
    this.flashlight.position.copy(this.camera.position);
    this.flashlightTarget.position.copy(this.camera.position).addScaledVector(this._camDir, 6);

    // 3. When observing console: Room is pitch black, flashlight is off, Cuco is completely hidden!
    // When looking at room: Flashlight illuminates narrow beam in the darkness!
    const targetFlashlightIntensity = lookingAtConsole ? 0.0 : 5.5;
    this.flashlight.intensity = THREE.MathUtils.damp(
      this.flashlight.intensity,
      targetFlashlightIntensity,
      12,
      dt
    );

    // Hide room details completely when looking down at the console for total darkness isolation!
    this.roomGroup.visible = !lookingAtConsole;

    // Cuco is strictly NOT visible when playing on the console (unless jumpscare attack is in progress)
    if (lookingAtConsole && !this.cucoMonster.position.equals(this.camera.position)) {
      // Check if jumpscare is not lunging
      if (this.cucoMonster.position.y > -5 && this.cucoMonster.position.y < 5) {
        // Only hide if not mid-jumpscare lunge
        const distToCam = this.cucoMonster.position.distanceTo(this.camera.position);
        if (distToCam > 1.2) {
          this.cucoMonster.visible = false;
        }
      }
    }

    // 4. Animate handheld console position and scale:
    // User request: The minigame SCREEN itself must be centered in the viewport!
    // Screen center in console local space is at Y ≈ +0.105 * scale.
    // Setting targetConsoleY = -0.16 aligns the screen center exactly with Y ≈ 0 (dead center)!
    const targetConsoleY = lookingAtConsole ? -0.16 : -0.65;
    const targetConsoleZ = lookingAtConsole ? -0.26 : -0.55;
    const targetConsoleRotX = lookingAtConsole ? 0.20 : 0.85;
    const targetConsoleScale = lookingAtConsole ? 1.50 : 0.85;

    this.consoleMeshGroup.position.y = THREE.MathUtils.damp(
      this.consoleMeshGroup.position.y,
      targetConsoleY,
      8,
      dt
    );
    this.consoleMeshGroup.position.z = THREE.MathUtils.damp(
      this.consoleMeshGroup.position.z,
      targetConsoleZ,
      8,
      dt
    );
    this.consoleMeshGroup.rotation.x = THREE.MathUtils.damp(
      this.consoleMeshGroup.rotation.x,
      targetConsoleRotX,
      8,
      dt
    );

    const currentScale = this.consoleMeshGroup.scale.x;
    const newScale = THREE.MathUtils.damp(currentScale, targetConsoleScale, 8, dt);
    this.consoleMeshGroup.scale.set(newScale, newScale, newScale);

    // 3. Subtle floating dust motion
    const positions = this.dustParticles.geometry.attributes.position.array as Float32Array;
    for (let i = 1; i < positions.length; i += 3) {
      positions[i] -= dt * 0.05;
      if (positions[i] < 0) positions[i] = 2.8;
    }
    this.dustParticles.geometry.attributes.position.needsUpdate = true;

    // 4. Subtle Cuco breathing idle motion if visible
    if (this.cucoMonster.visible) {
      const t = performance.now() * 0.003;
      if (this.cucoLeftArm) this.cucoLeftArm.rotation.z = Math.sin(t) * 0.1;
      if (this.cucoRightArm) this.cucoRightArm.rotation.z = -Math.sin(t) * 0.1;
    }

    // 5. Render scene
    this.renderer.render(this.scene, this.camera);
  }

  public handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  }

  public dispose() {
    this.renderer.dispose();
  }
}
