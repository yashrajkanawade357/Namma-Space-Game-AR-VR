import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadVenue, venueIdFromUrl } from "../venue/loadVenue";
import type { Vec3 } from "../venue/types";
import "../index.css";
import "./align.css";

/**
 * Alignment tool for a raw scan export (dev only, /align.html?venue=<id>).
 * Photogrammetry exports arrive with an arbitrary origin, up axis and scale; this
 * page turns the mesh until the floor is flat, measures a known length to fix the
 * scale, drops the floor to y = 0 and prints the transform for venue.json.
 */

const root = document.getElementById("root")!;
root.innerHTML = `
  <div class="align">
    <canvas id="view"></canvas>
    <aside class="panel side">
      <p class="eyebrow">Align a scan</p>
      <h1 class="display" id="title">Loading…</h1>
      <p class="hint">Turn the model until the floor sits on the grid, then fix the scale with a length you know.</p>

      <h2>1 · Which way is up</h2>
      <div class="row">
        <button data-rot="x,90">X +90°</button><button data-rot="x,-90">X −90°</button>
        <button data-rot="z,90">Z +90°</button><button data-rot="z,-90">Z −90°</button>
      </div>
      <div class="row">
        <button data-rot="x,180">Flip</button><button data-rot="y,90">Spin 90°</button>
        <button id="auto">Auto-level</button>
      </div>

      <label class="measure" for="cut"><span>Cut away above</span><b class="mono" id="cutOut">off</b></label>
      <input id="cut" type="range" min="0" max="1" step="0.01" value="1" />
      <p class="hint">Slide left to slice off the ceiling and look into the room from above.</p>

      <h2>2 · Scale</h2>
      <p class="hint">Click two points on the model, such as the bottom and top of a door frame, then type the real distance.</p>
      <div class="measure"><span>Measured</span><b class="mono" id="measured">—</b></div>
      <div class="row">
        <input id="real" type="number" min="0.1" step="0.01" placeholder="Real length (m)" />
        <button id="applyScale">Set scale</button>
      </div>
      <div class="measure"><span>Scale</span><b class="mono" id="scaleOut">1</b></div>

      <h2>3 · Check</h2>
      <dl class="stats">
        <dt>Footprint</dt><dd class="mono" id="footprint">—</dd>
        <dt>Floor to ceiling</dt><dd class="mono" id="height">—</dd>
        <dt>Triangles</dt><dd class="mono" id="tris">—</dd>
      </dl>
      <p class="hint">A room is usually 2.6–3.2 m floor to ceiling. The blue figure is 1.7 m tall.</p>

      <h2>4 · Copy into venue.json</h2>
      <pre class="mono" id="json"></pre>
      <button id="copy" class="btn-primary">Copy transform</button>
    </aside>
  </div>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("view");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
// Horizontal section plane: keeps everything below `constant` metres.
const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), Infinity);
renderer.clippingPlanes = [cutPlane];
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b201d);
const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 500);
camera.position.set(4, 4, 6);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.6));
const grid = new THREE.GridHelper(20, 20, 0x4fc49c, 0x3a423d);
scene.add(grid, new THREE.AxesHelper(1));

// 1.7 m reference figure at the origin.
const figure = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.26, 6, 12), new THREE.MeshStandardMaterial({ color: 0x378add }));
figure.position.y = 0.85;
scene.add(figure);

/** Holds the raw model; rotation and scale are set on it, then it is re-centred. */
const pivot = new THREE.Group();
scene.add(pivot);

let model: THREE.Object3D | null = null;
let rotation = new THREE.Euler(0, 0, 0, "XYZ");
let scale = 1;
let position = new THREE.Vector3();
let colliderUrl = "model.glb";
let floorY = 0;
let ceilY = 0;

const markers = new THREE.Group();
scene.add(markers);
let picks: THREE.Vector3[] = [];

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/** Robust floor and ceiling heights from the distribution of vertex heights. */
function heightPercentiles(obj: THREE.Object3D, lo = 0.02, hi = 0.98) {
  const ys: number[] = [];
  const v = new THREE.Vector3();
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 40000));
    for (let i = 0; i < pos.count; i += step) ys.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).y);
  });
  ys.sort((a, b) => a - b);
  return { floor: ys[Math.floor(ys.length * lo)], ceil: ys[Math.floor(ys.length * hi)] };
}

/** Applies rotation and scale, then moves the model so its floor is y = 0 and its footprint is centred. */
function relayout() {
  if (!model) return;
  pivot.position.set(0, 0, 0);
  pivot.rotation.copy(rotation);
  pivot.scale.setScalar(scale);
  pivot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pivot);
  const { floor, ceil } = heightPercentiles(pivot);
  const c = box.getCenter(new THREE.Vector3());
  position.set(-c.x, -floor, -c.z);
  pivot.position.copy(position);
  floorY = 0;
  ceilY = ceil - floor;

  const size = box.getSize(new THREE.Vector3());
  $("footprint").textContent = `${size.x.toFixed(2)} × ${size.z.toFixed(2)} m`;
  $("height").textContent = `${(ceilY - floorY).toFixed(2)} m`;
  $("scaleOut").textContent = scale.toFixed(4);
  updateCut();
  clearPicks();
  writeJson();
}

function writeJson() {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const deg = [rotation.x, rotation.y, rotation.z].map((a) => r(THREE.MathUtils.radToDeg(a))) as Vec3;
  const snippet = {
    collider: { url: colliderUrl, position: position.toArray().map(r), rotation: deg, scale: r(scale) },
    spawn: { position: [0, 0, 0], yaw: 0 },
  };
  $("json").textContent = JSON.stringify(snippet, null, 2);
}

function updateCut() {
  const t = Number($<HTMLInputElement>("cut").value);
  const top = (ceilY - floorY) * 1.05;
  cutPlane.constant = t >= 1 ? Infinity : t * top;
  $("cutOut").textContent = t >= 1 ? "off" : `${(t * top).toFixed(2)} m`;
}

function clearPicks() {
  picks = [];
  markers.clear();
  $("measured").textContent = "—";
}

function rotate(axis: "x" | "y" | "z", degrees: number) {
  const q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0),
    THREE.MathUtils.degToRad(degrees),
  );
  // Turn about the world axis so buttons behave the same whatever the current rotation.
  const current = new THREE.Quaternion().setFromEuler(rotation);
  rotation = new THREE.Euler().setFromQuaternion(q.multiply(current), "XYZ");
  relayout();
}

/**
 * Picks the up axis from the mesh normals: the floor and ceiling are the largest
 * pair of opposite flat areas, so the most area-weighted normal axis is "up".
 * Then flips if more floor-facing area points down than up.
 */
function autoLevel() {
  if (!model) return;
  const area = { x: [0, 0], y: [0, 0], z: [0, 0] } as Record<"x" | "y" | "z", [number, number]>;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    const idx = m.geometry.index;
    const tris = idx ? idx.count / 3 : pos.count / 3;
    const step = Math.max(1, Math.floor(tris / 60000));
    for (let t = 0; t < tris; t += step) {
      const i0 = idx ? idx.getX(t * 3) : t * 3;
      const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, i0);
      b.fromBufferAttribute(pos, i1);
      c.fromBufferAttribute(pos, i2);
      n.subVectors(c, b).cross(a.clone().sub(b));
      const len = n.length();
      if (!len) continue;
      n.divideScalar(len);
      const w = len / 2;
      for (const k of ["x", "y", "z"] as const) {
        if (Math.abs(n[k]) > 0.9) area[k][n[k] > 0 ? 0 : 1] += w;
      }
    }
  });
  // Walls also produce flat areas; the floor+ceiling axis is the one with the most total area.
  const best = (["x", "y", "z"] as const).reduce((p, k) => (area[k][0] + area[k][1] > area[p][0] + area[p][1] ? k : p), "y");
  rotation = new THREE.Euler();
  if (best === "x") rotation.set(0, 0, Math.PI / 2);
  if (best === "z") rotation.set(-Math.PI / 2, 0, 0);
  relayout();
  console.info("Auto-level: flat area per axis (+, −)", area, "→ up axis", best);
}

// Two clicks on the model measure a distance in the current scale.
const raycaster = new THREE.Raycaster();
let downAt = { x: 0, y: 0 };
canvas.addEventListener("pointerdown", (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener("pointerup", (e) => {
  if (!model || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) return;
  const r = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = raycaster.intersectObject(pivot, true)[0];
  if (!hit) return;
  if (picks.length === 2) clearPicks();
  picks.push(hit.point.clone());
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03), new THREE.MeshBasicMaterial({ color: 0xf0997b, depthTest: false }));
  dot.position.copy(hit.point);
  dot.renderOrder = 5;
  markers.add(dot);
  if (picks.length === 2) {
    markers.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(picks), new THREE.LineBasicMaterial({ color: 0xf0997b, depthTest: false })));
    $("measured").textContent = `${picks[0].distanceTo(picks[1]).toFixed(3)} m`;
  }
});

document.querySelectorAll<HTMLButtonElement>("[data-rot]").forEach((btn) =>
  btn.addEventListener("click", () => {
    const [axis, d] = btn.dataset.rot!.split(",");
    rotate(axis as "x" | "y" | "z", Number(d));
  }),
);
$("auto").addEventListener("click", autoLevel);
$("cut").addEventListener("input", updateCut);
$("applyScale").addEventListener("click", () => {
  const real = Number($<HTMLInputElement>("real").value);
  if (picks.length !== 2 || !(real > 0)) {
    $("measured").textContent = "Pick 2 points first";
    return;
  }
  scale *= real / picks[0].distanceTo(picks[1]);
  relayout();
});
$("copy").addEventListener("click", () => {
  navigator.clipboard.writeText($("json").textContent ?? "").then(
    () => ($("copy").textContent = "Copied"),
    () => window.getSelection()?.selectAllChildren($("json")),
  );
});

async function start() {
  const venue = await loadVenue(venueIdFromUrl());
  $("title").textContent = venue.name;
  if (venue.collider.url === "demo") throw new Error("The demo venue has nothing to align. Open ?venue=<your scan>.");
  colliderUrl = venue.collider.url.split("/").pop() ?? colliderUrl;
  const gltf = await new GLTFLoader().loadAsync(venue.collider.url);
  model = gltf.scene;
  let tris = 0;
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) tris += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
  });
  $("tris").textContent = tris.toLocaleString();
  pivot.add(model);

  // Start from venue.json's current transform if it has one.
  const t = venue.collider;
  if (t.rotation) rotation = new THREE.Euler(...(t.rotation.map(THREE.MathUtils.degToRad) as Vec3));
  if (t.scale) scale = t.scale;
  relayout();
  const size = new THREE.Box3().setFromObject(pivot).getSize(new THREE.Vector3()).length();
  camera.position.set(size * 0.8, size * 0.9, size * 1.1);
  controls.target.set(0, (ceilY - floorY) / 2, 0);
}

// Handle for debugging from the console: camera, controls and the model pivot.
if (import.meta.env.DEV)
  Object.assign(window, {
    __align: {
      camera,
      controls,
      pivot,
      scene,
      setScale: (s: number) => {
        scale = s;
        relayout();
      },
    },
  });

resize();
addEventListener("resize", resize);
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
start().catch((err: Error) => ($("title").textContent = err.message));
