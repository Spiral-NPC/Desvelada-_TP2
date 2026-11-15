/**
 * Three.js 3D Bedroom, Cuco Monster, and Retro Handheld Console.
 * Faithfully recreates the panoramic bedroom from Bedroom.webp:
 * - Panoramic curved room backdrop with child's bedroom wallpaper, wardrobe, toy chest, train set,
 *   shutter closet, art table, bean bag, eyeball mobile, and bedside lamp.
 * - Player sits on the bed; camera sweeps the expansive room with mouse/touch/gyroscope.
 * - Dynamic SpotLight flashlight illuminates dark corners.
 * - Cuco monster spawns in varied eerie locations and lunges with a terrifying jumpscare.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MiniGameEngine } from '../minigames/MiniGameEngine';
import { MonsterLocation } from '../types';
import { isFlashlightHittingCucoBody, computeFoxyJumpscarePose } from '../game/gameLogic';

export interface CucoInstance {
  id: string;
  location: MonsterLocation | null;
  group: THREE.Group;
  eyes: THREE.Mesh[];
  eyeLight: THREE.PointLight;
  head: THREE.Group | null;
  jaw: THREE.Group | null;
  leftArm: THREE.Group | null;
  rightArm: THREE.Group | null;
  originPos: THREE.Vector3;
  originRotY: number;
  inUse: boolean;
  isJumpscaring: boolean;
}

export class RoomScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public consoleMeshGroup: THREE.Group;
  public consoleScreenMaterial: THREE.ShaderMaterial;
  public screenTexture: THREE.CanvasTexture;
  public cucoMonster: THREE.Group;
  public cucoPool: CucoInstance[] = [];
  public digitalClockTextCanvas: HTMLCanvasElement;
  public digitalClockTexture: THREE.CanvasTexture;
  public roomGroup: THREE.Group;
  public flashlight: THREE.SpotLight;
  public flashlightTarget: THREE.Object3D;
  public isCucoInFlashlightBeam: boolean = false;
  private _camDir = new THREE.Vector3();
  private _jumpscareTargetPos = new THREE.Vector3();

  // Lighting
  public lampLight: THREE.PointLight;
  public ambientNightLight: THREE.HemisphereLight;

  public readonly isSoftwareGl: boolean;
  private dustParticles: THREE.Points;
  private dustMaterial!: THREE.ShaderMaterial;
  private lastScreenRenderVersion: number = -1;
  private elapsedTime: number = 0;

  // Cuco spawn anchor locations matching the panoramic reference image Bedroom.webp
  public static readonly LOCATIONS: Record<MonsterLocation, { pos: [number, number, number]; rotY: number }> = {
    wardrobe: { pos: [0, 0, -9.2], rotY: 0 },
    flowerchest: { pos: [-5.8, 0, -7.5], rotY: Math.PI / 4 },
    trainshelf: { pos: [-7.6, 0, -5.5], rotY: Math.PI / 3 },
    ventriloquist: { pos: [-8.2, 0.3, -2.8], rotY: Math.PI / 2.2 },
    beanbag: { pos: [1.8, 0, -9.0], rotY: -Math.PI / 12 },
    arttable: { pos: [4.4, 0, -8.2], rotY: -Math.PI / 5 },
    eyeballmobile: { pos: [5.6, 0, -7.4], rotY: -Math.PI / 4 },
    shuttercloset: { pos: [7.8, 0, -5.2], rotY: -Math.PI / 2.8 },
    toychair: { pos: [8.2, 0, -2.5], rotY: -Math.PI / 2.2 },
    footbed: { pos: [0, 0, -3.4], rotY: 0 },
    underbed: { pos: [-2.0, -0.2, 0.3], rotY: Math.PI / 2 },
    ceiling: { pos: [0.5, 2.9, -7.0], rotY: 0 },
    // Backwards compatibility mappings:
    closet: { pos: [0, 0, -9.2], rotY: 0 },
    door: { pos: [7.8, 0, -5.2], rotY: -Math.PI / 2.8 },
    window: { pos: [-7.6, 0, -5.5], rotY: Math.PI / 3 },
    desk: { pos: [4.4, 0, -8.2], rotY: -Math.PI / 5 },
    curtain: { pos: [-5.8, 0, -7.5], rotY: Math.PI / 4 },
    bookshelf: { pos: [-7.6, 0, -5.5], rotY: Math.PI / 3 },
    hallway: { pos: [8.2, 0, -2.5], rotY: -Math.PI / 2.2 },
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

    // Scene setup - Extremely dark atmospheric bedroom
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x040206, 0.08);

    // Camera at player eye level on the bed
    // FOV 60 ensures player must pan/sweep to see both sides of the large bedroom
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 50);
    this.camera.position.set(0, 1.25, 0.2);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    // Zero meshes cast shadows in this scene; disable empty shadow map pass for higher FPS
    this.renderer.shadowMap.enabled = false;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    // Environment map for subtle specular reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.01).texture;
    pmremGenerator.dispose();

    // Dark moody ambient room lighting (dimmed significantly for intense darkness)
    this.ambientNightLight = new THREE.HemisphereLight(0x110715, 0x010002, 0.06);
    this.scene.add(this.ambientNightLight);

    // Bedside lamp (faint amber glow on right nightstand)
    this.lampLight = new THREE.PointLight(0xffbe6b, 0.22, 3.2, 2);
    this.lampLight.position.set(2.0, 1.2, 0.2);
    this.scene.add(this.lampLight);

    // Flashlight (narrow, smaller focused beam radius: Math.PI / 8.8 ~20.4 deg)
    this.flashlight = new THREE.SpotLight(0xffedd5, 10.0, 22, Math.PI / 8.8, 0.22, 1.6);
    this.flashlight.position.copy(this.camera.position);
    this.flashlight.castShadow = false;

    this.flashlightTarget = new THREE.Object3D();
    this.scene.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;
    this.scene.add(this.flashlight);

    // Subtle console screen glow on player hands
    const consoleGlow = new THREE.PointLight(0x38bdf8, 0.4, 1.2, 2);
    consoleGlow.position.set(0, -0.1, -0.2);
    this.camera.add(consoleGlow);

    // Digital Clock canvas setup on nightstand
    this.digitalClockTextCanvas = document.createElement('canvas');
    this.digitalClockTextCanvas.width = 256;
    this.digitalClockTextCanvas.height = 128;
    this.digitalClockTexture = new THREE.CanvasTexture(this.digitalClockTextCanvas);
    this.digitalClockTexture.colorSpace = THREE.SRGBColorSpace;
    this.updateClockDisplay('12:00 AM');

    // Build the large 3D bedroom based on Bedroom.webp
    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);
    this.buildRoom();

    // Build the Cuco Monster Pool (up to 4 monsters for infinite mode)
    for (let i = 0; i < 4; i++) {
      const parts = this.buildCucoMonster();
      const eyeLight = new THREE.PointLight(0xfacc15, 3.2, 5.5, 1.8);
      eyeLight.position.set(0, 0.1, 0.72);
      if (parts.head) {
        parts.head.add(eyeLight);
      } else {
        parts.group.add(eyeLight);
      }

      const inst: CucoInstance = {
        id: '',
        location: null,
        group: parts.group,
        eyes: parts.eyes,
        eyeLight,
        head: parts.head,
        jaw: parts.jaw,
        leftArm: parts.leftArm,
        rightArm: parts.rightArm,
        originPos: new THREE.Vector3(0, -20, 0),
        originRotY: 0,
        inUse: false,
        isJumpscaring: false,
      };
      inst.group.position.set(0, -20, 0);
      inst.group.visible = false;
      this.scene.add(inst.group);
      this.cucoPool.push(inst);
    }
    this.cucoMonster = this.cucoPool[0].group;

    // Console Screen Texture
    this.screenTexture = new THREE.CanvasTexture(miniGameEngine.canvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.screenTexture.minFilter = THREE.LinearFilter;
    this.screenTexture.magFilter = THREE.NearestFilter;
    // Retro CRT & Film Grain Shader Material for handheld console screen
    this.consoleScreenMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.screenTexture },
        time: { value: 0.0 },
        staticMix: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float staticMix;
        varying vec2 vUv;

        // Pseudo-random noise hash
        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        void main() {
          vec2 uv = vUv;
          
          // Subtle retro CRT barrel curvature distortion when looking at console
          vec2 centered = uv - 0.5;
          float dist = dot(centered, centered);
          vec2 curvedUv = uv + centered * (dist * 0.07 * staticMix);
          
          if (curvedUv.x < 0.0 || curvedUv.x > 1.0 || curvedUv.y < 0.0 || curvedUv.y > 1.0) {
            gl_FragColor = vec4(0.01, 0.02, 0.03, 1.0);
            return;
          }
          
          vec4 color = texture2D(tDiffuse, curvedUv);
          
          // Animated film grain / static noise (active only when looking at console)
          float noise = hash(curvedUv * 280.0 + fract(time * 43.0));
          float grain = (noise - 0.5) * 0.18 * staticMix;
          
          // Subtle phosphor scanlines
          float scanline = sin(curvedUv.y * 360.0) * 0.06 * staticMix;
          
          vec3 finalColor = color.rgb + vec3(grain) - vec3(scanline);
          
          // Subtle edge vignette
          float vignette = smoothstep(0.72, 0.42, length(centered));
          finalColor *= mix(1.0, vignette * 1.04, staticMix * 0.35);
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    // Build 3D Handheld Console attached to camera
    this.consoleMeshGroup = this.buildHandheldConsole();
    this.camera.add(this.consoleMeshGroup);
    this.scene.add(this.camera);

    // Ambient floating dust particles
    this.dustParticles = this.buildDustParticles();
    this.scene.add(this.dustParticles);
  }

  // --- BUILD LARGE 3D BEDROOM BASED ON Bedroom.webp ---
  private buildRoom() {
    // 1. Panoramic Curved Backdrop Wall
    // Cylindrical cylinder wrapping ~310 degrees (5.4 radians)
    // Radius = 10.0m, Height = 8.5m, centered looking straight down -Z (startAngle = Math.PI - arcAngle / 2)
    const radius = 10.0;
    const height = 8.5;
    const segments = 72;
    const arcAngle = 5.4; // 5.4 radians (~310°) provides full expansive coverage
    const startAngle = Math.PI - arcAngle / 2; // PROPERLY CENTERED LOOKING DOWN -Z!

    const panoGeo = new THREE.CylinderGeometry(
      radius,
      radius,
      height,
      segments,
      1,
      true,
      startAngle,
      arcAngle
    );

    const panoMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.05,
      side: THREE.BackSide,
    });

    // Load reference panoramic texture Bedroom.webp
    const texLoader = new THREE.TextureLoader();
    texLoader.load('/assets/aistudio/Bedroom_2f762663.webp', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      // Invert horizontal UV mapping for inner cylinder surface
      tex.repeat.set(-1, 1);
      tex.offset.set(1, 0);
      panoMat.map = tex;
      panoMat.needsUpdate = true;
    });

    const panoMesh = new THREE.Mesh(panoGeo, panoMat);
    panoMesh.position.set(0, 3.0, 0);
    this.roomGroup.add(panoMesh);

    // 2. Large Bedroom Floor (carpet mauve/maroon tone matching Bedroom.webp)
    const floorGeo = new THREE.CircleGeometry(12.5, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x3d2030,
      roughness: 0.85,
      metalness: 0.02,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.05, 0);
    floor.receiveShadow = false;
    this.roomGroup.add(floor);

    // 3. Ceiling plane
    const ceilGeo = new THREE.CircleGeometry(12.5, 48);
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x221326,
      roughness: 0.9,
    });
    const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 6.2, 0);
    this.roomGroup.add(ceiling);

    // Ceiling Lamp Fixture (centered at ceiling matching Bedroom.webp)
    const lampFixtureGroup = new THREE.Group();
    lampFixtureGroup.position.set(0, 5.3, -4.5);
    const lampCord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.9, 8),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    lampCord.position.y = 0.45;
    lampFixtureGroup.add(lampCord);
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xf3f4f6,
        roughness: 0.3,
        emissive: 0x475569,
        emissiveIntensity: 0.2,
      })
    );
    lampFixtureGroup.add(globe);
    this.roomGroup.add(lampFixtureGroup);

    // 4. Foreground Bed (where player sits)
    const bedGroup = new THREE.Group();
    // Bed posts & wooden frame matching Bedroom.webp
    const bedFrameMat = new THREE.MeshStandardMaterial({ color: 0x4a323b, roughness: 0.7 });
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.45, 2.8), bedFrameMat);
    bedFrame.position.set(0, 0.22, 0.2);
    bedGroup.add(bedFrame);

    // Mattress & Quilt (green with yellow circular rings matching Bedroom.webp)
    const quiltMat = new THREE.MeshStandardMaterial({
      color: 0x1b4d3e,
      roughness: 0.85,
    });
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 2.7), quiltMat);
    mattress.position.set(0, 0.45, 0.2);
    bedGroup.add(mattress);

    // Blanket fold across player's legs with green/yellow highlights
    const blanketMat = new THREE.MeshStandardMaterial({ color: 0x2e6f40, roughness: 0.8 });
    const blanketFold = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.2, 1.5), blanketMat);
    blanketFold.position.set(0, 0.65, -0.4);
    bedGroup.add(blanketFold);

    // Bed Rail / Headboard posts in foreground
    const postMat = new THREE.MeshStandardMaterial({ color: 0xd8c2d1, roughness: 0.4 });
    const postLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.4, 0.14), postMat);
    postLeft.position.set(-1.15, 0.7, -1.1);
    bedGroup.add(postLeft);

    const postRight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.4, 0.14), postMat);
    postRight.position.set(1.15, 0.7, -1.1);
    bedGroup.add(postRight);

    // Curved footboard rail matching Bedroom.webp foreground
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 0.1), postMat);
    rail.position.set(0, 0.95, -1.1);
    bedGroup.add(rail);

    this.roomGroup.add(bedGroup);

    // 5. Right Nightstand, Lamp & Digital Clock (foreground right, matching photo)
    const nightstandGroup = new THREE.Group();
    nightstandGroup.position.set(2.0, 0, 0.2);

    const tableMat = new THREE.MeshStandardMaterial({ color: 0x2a1725, roughness: 0.6 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 0.9), tableMat);
    table.position.set(0, 0.375, 0);
    nightstandGroup.add(table);

    // White bedside lamp with cylindrical shade
    const lampBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 })
    );
    lampBase.position.set(0, 0.79, 0);
    nightstandGroup.add(lampBase);

    const lampShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 0.45, 24, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xfff1e6,
        roughness: 0.4,
        side: THREE.DoubleSide,
      })
    );
    lampShade.position.set(0, 1.15, 0);
    nightstandGroup.add(lampShade);

    // Digital Alarm Clock angled towards player bed
    const clockBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.14, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 })
    );
    clockBody.position.set(-0.35, 0.82, -0.15);
    clockBody.rotation.y = -Math.PI / 4;
    nightstandGroup.add(clockBody);

    const clockDisplayMat = new THREE.MeshBasicMaterial({ map: this.digitalClockTexture });
    const clockFace = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1), clockDisplayMat);
    clockFace.position.set(-0.34, 0.82, -0.14);
    clockFace.rotation.y = -Math.PI / 4;
    nightstandGroup.add(clockFace);

    this.roomGroup.add(nightstandGroup);

    // 6. Dangling Eyeball Mobile on right ceiling (creepy green eyeballs from Bedroom.webp)
    const mobileGroup = new THREE.Group();
    mobileGroup.position.set(5.5, 4.4, -6.5);
    const eyeMobileMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.2,
      emissive: 0x15803d,
      emissiveIntensity: 0.4,
    });
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x022c22 });

    const eyeballOffsets = [
      [0, 0, 0],
      [-0.4, -0.5, 0.2],
      [0.35, -0.3, -0.3],
      [-0.2, -0.8, -0.2],
      [0.45, -0.7, 0.2],
    ];

    eyeballOffsets.forEach(([ox, oy, oz]) => {
      const strand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, Math.abs(oy) + 0.5, 6),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      );
      strand.position.set(ox, oy / 2 + 0.25, oz);
      mobileGroup.add(strand);

      const eyeSphere = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), eyeMobileMat);
      eyeSphere.position.set(ox, oy, oz);
      mobileGroup.add(eyeSphere);

      const eyePupil = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), eyePupilMat);
      eyePupil.position.set(ox, oy, oz + 0.161);
      mobileGroup.add(eyePupil);
    });

    this.roomGroup.add(mobileGroup);
  }

  // --- CUCO MONSTER 3D MODEL ---
  // Diamond/geometric head, staring glowing round eyes, hinged gaping jaw with jagged teeth, blocky torso, claw arms
  private buildCucoMonster(): {
    group: THREE.Group;
    eyes: THREE.Mesh[];
    head: THREE.Group | null;
    jaw: THREE.Group | null;
    leftArm: THREE.Group | null;
    rightArm: THREE.Group | null;
  } {
    const monster = new THREE.Group();
    // Scale monster up so it has menacing presence across the large bedroom
    monster.scale.set(1.5, 1.5, 1.5);
    const eyes: THREE.Mesh[] = [];

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x162c64,
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
      color: 0x020202,
    });
    const mouthCavityMat = new THREE.MeshBasicMaterial({
      color: 0x050206,
    });
    const toothMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.2,
    });

    // 1. Neck-pivoted Head Group (rotates violently during Foxy-style jumpscare)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.95, 0);

    const headGeo = new THREE.OctahedronGeometry(0.38, 0);
    headGeo.scale(1.1, 1.25, 1.0);
    const headMesh = new THREE.Mesh(headGeo, bodyMat);
    headGroup.add(headMesh);

    // 2. Wide staring round eyes
    [-0.14, 0.14].forEach((xOffset) => {
      const eyeRim = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.085, 16), accentMat);
      eyeRim.position.set(xOffset, 0.10, 0.32);
      headGroup.add(eyeRim);

      const eye = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), eyeGlowMat);
      eye.position.set(xOffset, 0.10, 0.325);
      headGroup.add(eye);
      eyes.push(eye);

      const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.025, 12), pupilMat);
      pupil.position.set(xOffset, 0.10, 0.33);
      headGroup.add(pupil);
    });

    // Dark inner maw cavity + upper fangs mounted to upper skull
    const mawCavity = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.16), mouthCavityMat);
    mawCavity.position.set(0, -0.09, 0.26);
    headGroup.add(mawCavity);

    const toothGeo = new THREE.ConeGeometry(0.022, 0.06, 4);
    for (let i = -3; i <= 3; i++) {
      const tTooth = new THREE.Mesh(toothGeo, toothMat);
      tTooth.position.set(i * 0.042, -0.04, 0.36);
      tTooth.rotation.z = Math.PI;
      headGroup.add(tTooth);
    }

    // 3. Hinged Lower Jaw (swings open + chomps during Foxy jumpscare)
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.10, 0.14);
    const jawBase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.24), bodyMat);
    jawBase.position.set(0, -0.03, 0.14);
    jaw.add(jawBase);

    for (let i = -3; i <= 3; i++) {
      const bTooth = new THREE.Mesh(toothGeo, toothMat);
      bTooth.position.set(i * 0.042, 0.03, 0.22);
      jaw.add(bTooth);
    }
    headGroup.add(jaw);
    monster.add(headGroup);

    // 4. Blocky angular Torso
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.35), bodyMat);
    chest.position.set(0, 1.5, 0);
    monster.add(chest);

    const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), accentMat);
    emblem.position.set(0, 1.5, 0.19);
    monster.add(emblem);

    const waist = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.28), bodyMat);
    waist.position.set(0, 1.15, 0);
    monster.add(waist);

    // 5. Left Arm with claw
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.35, 1.6, 0);
    const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), accentMat);
    leftArm.add(shoulderL);
    const bicepL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), bodyMat);
    bicepL.position.set(-0.06, -0.22, 0);
    leftArm.add(bicepL);
    const clawL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, 0.08), accentMat);
    clawL.position.set(-0.06, -0.55, 0.06);
    leftArm.add(clawL);
    monster.add(leftArm);

    // 6. Right Arm with saw/pincer
    const rightArm = new THREE.Group();
    rightArm.position.set(0.35, 1.6, 0);
    const shoulderR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), accentMat);
    rightArm.add(shoulderR);
    const bicepR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), bodyMat);
    bicepR.position.set(0.06, -0.22, 0);
    rightArm.add(bicepR);
    const sawClaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.12), accentMat);
    sawClaw.position.set(0.08, -0.6, 0.08);
    rightArm.add(sawClaw);
    monster.add(rightArm);

    // 7. Legs & Feet
    const legGeo = new THREE.BoxGeometry(0.15, 0.9, 0.16);
    const legL = new THREE.Mesh(legGeo, bodyMat);
    legL.position.set(-0.16, 0.5, 0);
    monster.add(legL);

    const legR = new THREE.Mesh(legGeo, bodyMat);
    legR.position.set(0.16, 0.5, 0);
    monster.add(legR);

    const footGeo = new THREE.BoxGeometry(0.18, 0.1, 0.3);
    const footL = new THREE.Mesh(footGeo, accentMat);
    footL.position.set(-0.16, 0.05, 0.06);
    monster.add(footL);

    const footR = new THREE.Mesh(footGeo, accentMat);
    footR.position.set(0.16, 0.05, 0.06);
    monster.add(footR);

    return {
      group: monster,
      eyes,
      head: headGroup,
      jaw,
      leftArm,
      rightArm,
    };
  }

  // --- RETRO HANDHELD CONSOLE 3D MODEL ---
  private buildHandheldConsole(): THREE.Group {
    const consoleGroup = new THREE.Group();

    // Body shell (translucent atomic teal/indigo 90s aesthetic)
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.35,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.38, 0.045), shellMat);
    consoleGroup.add(body);

    // Screen bezel
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.005), bezelMat);
    bezel.position.set(0, 0.06, 0.023);
    consoleGroup.add(bezel);

    // LCD Screen Plane with mini-game canvas texture
    const screenGeo = new THREE.PlaneGeometry(0.18, 0.15);
    const screenMesh = new THREE.Mesh(screenGeo, this.consoleScreenMaterial);
    screenMesh.position.set(0, 0.06, 0.026);
    consoleGroup.add(screenMesh);

    // D-Pad Cross
    const dpadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
    const dpadH = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.015), dpadMat);
    dpadH.position.set(-0.065, -0.09, 0.025);
    consoleGroup.add(dpadH);
    const dpadV = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.015), dpadMat);
    dpadV.position.set(-0.065, -0.09, 0.025);
    consoleGroup.add(dpadV);

    // Action Buttons A & B (Magenta & Cyan 90s handheld style)
    const btnMatA = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 });
    const btnMatB = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.4 });

    const btnA = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.015, 12), btnMatA);
    btnA.rotation.x = Math.PI / 2;
    btnA.position.set(0.08, -0.075, 0.025);
    consoleGroup.add(btnA);

    const btnB = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.015, 12), btnMatB);
    btnB.rotation.x = Math.PI / 2;
    btnB.position.set(0.05, -0.095, 0.025);
    consoleGroup.add(btnB);

    // Initial position in front of player
    consoleGroup.position.set(0, -0.16, -0.3);
    consoleGroup.rotation.x = 0.25;

    return consoleGroup;
  }

  // --- PROCEDURAL SOFT CIRCULAR DUST PARTICLE TEXTURE ---
  private createDustTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 248, 230, 1.0)');
      gradient.addColorStop(0.3, 'rgba(240, 225, 195, 0.7)');
      gradient.addColorStop(0.7, 'rgba(200, 185, 165, 0.25)');
      gradient.addColorStop(1, 'rgba(200, 185, 165, 0.0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  // --- FLOATING MOONLIT DUST MOTES (GPU-ANIMATED FOR 60 FPS, CAMERA PARALLAX) ---
  private buildDustParticles(): THREE.Points {
    const count = 260;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Distribute particles in 3D volume around the player's viewing cone
      positions[i * 3] = (Math.random() - 0.5) * 8.5;
      positions[i * 3 + 1] = 0.2 + Math.random() * 3.6;
      positions[i * 3 + 2] = -7.0 + Math.random() * 8.0;

      // Float speed and individual phase
      speeds[i * 3] = (Math.random() - 0.5) * 0.05; // horizontal drift seed
      speeds[i * 3 + 1] = 0.03 + Math.random() * 0.06; // vertical drift speed
      speeds[i * 3 + 2] = Math.random() * Math.PI * 2; // phase offset
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 3));

    const dustTex = this.createDustTexture();
    const pixelRatio = this.renderer.getPixelRatio();
    this.dustMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDust: { value: dustTex },
        uTime: { value: 0.0 },
        uOpacity: { value: 0.55 },
        uPointScale: { value: 0.075 * window.innerHeight * 0.5 * pixelRatio },
      },
      vertexShader: `
        attribute vec3 aSpeed;
        uniform float uTime;
        uniform float uPointScale;
        void main() {
          float phase = aSpeed.z;
          float wrappedY = 0.2 + mod((position.y - 0.2) - aSpeed.y * uTime, 3.6);
          vec3 animatedPos = vec3(
            position.x + sin(uTime * 0.8 + phase) * 0.15,
            wrappedY,
            position.z + cos(uTime * 0.7 + phase) * 0.15
          );
          vec4 mvPosition = modelViewMatrix * vec4(animatedPos, 1.0);
          gl_PointSize = max(1.0, uPointScale / max(0.2, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D tDust;
        uniform float uOpacity;
        void main() {
          vec4 texColor = texture2D(tDust, gl_PointCoord);
          if (texColor.a < 0.01) discard;
          gl_FragColor = vec4(vec3(1.0, 0.98, 0.92) * texColor.rgb, texColor.a * uOpacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return new THREE.Points(geometry, this.dustMaterial);
  }

  // --- UPDATE DIGITAL CLOCK TEXTURE ---
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

  private resetCucoPose(inst: CucoInstance) {
    inst.isJumpscaring = false;
    inst.group.rotation.set(0, 0, 0);
    if (inst.head) inst.head.rotation.set(0, 0, 0);
    if (inst.jaw) inst.jaw.rotation.set(0, 0, 0);
    if (inst.leftArm) inst.leftArm.rotation.set(0, 0, 0);
    if (inst.rightArm) inst.rightArm.rotation.set(0, 0, 0);
  }

  // --- SPAWN OR RETREAT CUCO MONSTER ---
  public spawnCuco(location: MonsterLocation, id: string = 'default') {
    let inst = this.cucoPool.find((c) => c.inUse && c.id === id);
    if (!inst) {
      inst = this.cucoPool.find((c) => !c.inUse);
    }
    if (!inst) return;

    const loc = RoomScene.LOCATIONS[location] || RoomScene.LOCATIONS.wardrobe;

    inst.id = id;
    inst.inUse = true;
    inst.location = location;
    inst.originPos.set(loc.pos[0], loc.pos[1], loc.pos[2]);
    inst.originRotY = loc.rotY;

    this.resetCucoPose(inst);
    inst.group.position.copy(inst.originPos);
    // Face player seated on the bed
    inst.group.lookAt(0, 1.25, 0.2);
    inst.group.scale.set(1.5, 1.5, 1.5);
    inst.group.visible = true;

    // Glowing eyes flare
    inst.eyes.forEach((eye) => {
      (eye.material as THREE.MeshBasicMaterial).color.setHex(0xfacc15);
    });

    if (inst.eyeLight) {
      inst.eyeLight.color.setHex(0xfacc15);
      inst.eyeLight.intensity = 3.2;
      inst.eyeLight.visible = true;
    }
  }

  public hideCuco(id: string = 'default') {
    const inst = this.cucoPool.find((c) => c.id === id);
    if (inst) {
      this.resetCucoPose(inst);
      inst.group.visible = false;
      inst.group.position.set(0, -20, 0);
      inst.inUse = false;
      inst.id = '';
      inst.location = null;
      if (inst.eyeLight) {
        inst.eyeLight.visible = false;
      }
    }
  }

  public hideAllCucos() {
    this.cucoPool.forEach((inst) => {
      this.resetCucoPose(inst);
      inst.group.visible = false;
      inst.group.position.set(0, -20, 0);
      inst.inUse = false;
      inst.id = '';
      inst.location = null;
      if (inst.eyeLight) {
        inst.eyeLight.visible = false;
      }
    });
  }

  // --- FOXY-STYLE AERIAL LUNGE JUMPSCARE ANIMATION ---
  public updateJumpscare(progress: number, id: string = 'default') {
    const inst = this.cucoPool.find((c) => c.id === id) || this.cucoPool.find((c) => c.inUse);
    if (!inst) return;

    const pose = computeFoxyJumpscarePose(progress);

    inst.isJumpscaring = true;
    inst.group.visible = true;
    this.camera.updateMatrixWorld();
    const camPos = this.camera.position;
    this.camera.getWorldDirection(this._camDir);

    // Compensate forward head displacement caused by tilting the 2.925m-tall body forward by bodyPitchX
    // so Cuco's roaring face & gaping jaw always land cleanly 0.78m in front of the camera lens
    const headLocalHeight = 1.95 * 1.5;
    const forwardHeadShift = headLocalHeight * Math.sin(pose.bodyPitchX);
    const verticalHeadOffset = headLocalHeight * Math.cos(pose.bodyPitchX);
    const desiredFaceDist = 0.78;

    this._jumpscareTargetPos
      .copy(camPos)
      .addScaledVector(this._camDir, desiredFaceDist + forwardHeadShift);
    this._jumpscareTargetPos.y = camPos.y + this._camDir.y * desiredFaceDist - verticalHeadOffset - 0.02;

    inst.group.position.lerpVectors(inst.originPos, this._jumpscareTargetPos, pose.leapT);
    inst.group.position.y += pose.arcY * (1 - pose.leapT * 0.65);

    // Face camera directly, then tilt body forward into the aerial Foxy dive
    inst.group.lookAt(camPos.x, inst.group.position.y + verticalHeadOffset, camPos.z);
    inst.group.rotateX(pose.bodyPitchX);

    // Violent erratic shake when in front of the player's face
    if (progress > 0.25) {
      const shakeAmp = 0.045 * Math.min(1, (progress - 0.25) / 0.2);
      inst.group.position.x += (Math.random() - 0.5) * shakeAmp;
      inst.group.position.y += (Math.random() - 0.5) * shakeAmp;
    }

    // Eyes glow blood red with intense strobing facial light
    inst.eyes.forEach((eye) => {
      (eye.material as THREE.MeshBasicMaterial).color.setHex(0xff1e1e);
    });
    if (inst.eyeLight) {
      inst.eyeLight.color.setHex(0xff4422);
      inst.eyeLight.intensity = pose.eyeLightIntensity;
      inst.eyeLight.visible = true;
    }

    // Violent head convulsion, wide snapping jaw, and Foxy wide-splayed claw arms
    if (inst.head) {
      inst.head.rotation.set(pose.headPitchX, pose.headYawY, pose.headRollZ);
    }
    if (inst.jaw) {
      inst.jaw.rotation.x = pose.jawRotX;
    }
    if (inst.leftArm && inst.rightArm) {
      inst.leftArm.rotation.set(pose.leftArmRotX, 0, pose.leftArmRotZ);
      inst.rightArm.rotation.set(pose.rightArmRotX, 0, pose.rightArmRotZ);
    }
  }

  // --- TICK / RENDER LOOP ---
  public update(
    dt: number,
    lookingAtConsole: boolean,
    _cameraPitch: number,
    screenRenderVersion?: number
  ) {
    this.elapsedTime += dt;

    // 1. Upload console canvas texture ONLY when the minigame canvas was actually redrawn
    if (screenRenderVersion === undefined || screenRenderVersion !== this.lastScreenRenderVersion) {
      this.screenTexture.needsUpdate = true;
      if (screenRenderVersion !== undefined) {
        this.lastScreenRenderVersion = screenRenderVersion;
      }
    }

    if (this.consoleScreenMaterial?.uniforms) {
      this.consoleScreenMaterial.uniforms.time.value = this.elapsedTime;
      this.consoleScreenMaterial.uniforms.staticMix.value = THREE.MathUtils.damp(
        this.consoleScreenMaterial.uniforms.staticMix.value,
        lookingAtConsole ? 1.0 : 0.0,
        10,
        dt
      );
    }

    // 2. Update flashlight beam direction to match camera view
    this.camera.getWorldDirection(this._camDir);
    this.flashlight.position.copy(this.camera.position);
    this.flashlightTarget.position.copy(this.camera.position).addScaledVector(this._camDir, 8);

    // 3. Detect if player is aiming the flashlight at ANY part of an active Cuco's full body
    let cucoSpotted = false;
    if (!lookingAtConsole) {
      for (const inst of this.cucoPool) {
        if (!inst.inUse) continue;
        if (isFlashlightHittingCucoBody(this.camera.position, this._camDir, inst.group.position)) {
          cucoSpotted = true;
          break;
        }
      }
    }
    this.isCucoInFlashlightBeam = cucoSpotted;

    // 4. Flashlight intensity & flickering:
    // Off when looking at console
    // When aiming at Cuco: flickers subtly/nervously so the player notices the beam reaction!
    let targetFlashlightIntensity = 0.0;
    if (!lookingAtConsole) {
      if (cucoSpotted) {
        const wave = Math.sin(this.elapsedTime * 34.0);
        const flickerPattern = wave > -0.2 ? (Math.random() > 0.25 ? 9.2 : 5.2) : 2.8;
        targetFlashlightIntensity = flickerPattern;
      } else {
        targetFlashlightIntensity = 8.5;
      }
    }

    this.flashlight.intensity = THREE.MathUtils.damp(
      this.flashlight.intensity,
      targetFlashlightIntensity,
      cucoSpotted ? 26 : 12,
      dt
    );
    // Skip inactive SpotLight & bedside PointLight shading passes when looking at the console
    this.flashlight.visible = !lookingAtConsole || this.flashlight.intensity > 0.01;
    this.lampLight.visible = !lookingAtConsole;

    // Hide room details completely when looking down at the console for total darkness isolation
    this.roomGroup.visible = !lookingAtConsole;

    // Cuco visibility: hidden when focused on console unless jumpscare is in progress
    const armAnimTime = this.elapsedTime * 3.0;
    let anyJumpscaring = false;
    for (const inst of this.cucoPool) {
      if (!inst.inUse) continue;

      if (inst.isJumpscaring) {
        inst.group.visible = true;
        anyJumpscaring = true;
      } else if (lookingAtConsole) {
        const distToCam = inst.group.position.distanceTo(this.camera.position);
        if (distToCam > 1.2) {
          inst.group.visible = false;
        }
      } else {
        inst.group.visible = true;
        if (inst.leftArm) inst.leftArm.rotation.z = Math.sin(armAnimTime + inst.originPos.x) * 0.1;
        if (inst.rightArm) inst.rightArm.rotation.z = -Math.sin(armAnimTime + inst.originPos.x) * 0.1;
      }
    }

    // Drop/hide handheld console immediately when Cuco jumpscares so view is 100% clear
    this.consoleMeshGroup.visible = !anyJumpscaring;

    // 4. Animate handheld console position and scale
    const isLandscape = this.camera.aspect > 1.2;
    const targetConsoleY = lookingAtConsole ? (isLandscape ? -0.13 : -0.16) : -0.65;
    const targetConsoleZ = lookingAtConsole ? (isLandscape ? -0.31 : -0.26) : -0.55;
    const targetConsoleRotX = lookingAtConsole ? 0.20 : 0.85;
    const targetConsoleScale = lookingAtConsole ? (isLandscape ? 1.32 : 1.50) : 0.85;

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

    // 5. Floating dust motes (GPU-animated motion + camera rotation parallax)
    if (this.dustParticles && this.dustMaterial) {
      const currentYaw = this.camera.rotation.y;
      const currentPitch = this.camera.rotation.x;

      this.dustParticles.rotation.y = THREE.MathUtils.damp(
        this.dustParticles.rotation.y,
        currentYaw * 0.18,
        8,
        dt
      );
      this.dustParticles.rotation.x = THREE.MathUtils.damp(
        this.dustParticles.rotation.x,
        currentPitch * 0.18,
        8,
        dt
      );
      this.dustParticles.position.x = THREE.MathUtils.damp(
        this.dustParticles.position.x,
        -currentYaw * 0.35,
        8,
        dt
      );
      this.dustParticles.position.y = THREE.MathUtils.damp(
        this.dustParticles.position.y,
        -currentPitch * 0.35,
        8,
        dt
      );

      this.dustMaterial.uniforms.uTime.value = this.elapsedTime;
      const targetOpacity = lookingAtConsole ? 0.25 : 0.60;
      this.dustMaterial.uniforms.uOpacity.value = THREE.MathUtils.damp(
        this.dustMaterial.uniforms.uOpacity.value,
        targetOpacity,
        8,
        dt
      );
    }

    // 6. Render scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Software-WebGL frame pacer (SwiftShader/llvmpipe) to prevent starving screenshots
   * while yielding after GPU draw fences complete.
   */
  public afterDraw(cb: () => void): number {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      return window.setTimeout(cb, 80);
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    let timerId = 0;
    const poll = () => {
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        timerId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        timerId = window.setTimeout(cb, 80);
      }
    };
    timerId = window.setTimeout(poll, 5);
    return timerId;
  }

  public handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    const pixelRatio = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(pixelRatio);
    if (this.dustMaterial?.uniforms?.uPointScale) {
      this.dustMaterial.uniforms.uPointScale.value = 0.075 * window.innerHeight * 0.5 * pixelRatio;
    }
  }

  public dispose() {
    this.renderer.dispose();
  }
}
