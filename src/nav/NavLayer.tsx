import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useApp } from "../store";
import { navMeshGeometryData, type Point } from "./navmesh";
import { getNavWorld, updateNavigation } from "./runtime";

/** How often the route is recomputed from the visitor's position, seconds. */
const REROUTE_EVERY = 0.2;
const ROUTE_WIDTH = 0.42;
const LIFT = 0.04;

/** Everything navigation draws in 3D, plus the timer that keeps the route current. */
export function NavLayer() {
  const nav = useApp((s) => s.nav);
  const showNavmesh = useApp((s) => s.showNavmesh);
  const navReady = useApp((s) => s.navReady);
  const since = useRef(0);

  useFrame((_, dt) => {
    since.current += dt;
    if (since.current >= REROUTE_EVERY) {
      since.current = 0;
      updateNavigation();
    }
  });

  return (
    <>
      {nav && nav.route.length > 1 && <RouteRibbon points={nav.route} />}
      {nav && <GoalMarker goal={nav.goal} arrived={nav.arrived} />}
      {navReady && showNavmesh && <NavMeshOverlay />}
    </>
  );
}

const ribbonShader = {
  vertexShader: /* glsl */ `
    attribute float along;
    attribute float across;
    varying float vAlong;
    varying float vAcross;
    #include <clipping_planes_pars_vertex>
    void main() {
      vAlong = along;
      vAcross = across;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <clipping_planes_vertex>
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uLength;
    uniform vec3 uColor;
    varying float vAlong;
    varying float vAcross;
    #include <clipping_planes_pars_fragment>
    void main() {
      #include <clipping_planes_fragment>
      float side = abs(vAcross);                       // 0 on the centre line, 1 at the edge
      float edge = 1.0 - smoothstep(0.82, 1.0, side);  // soft border
      // Chevrons every 0.55 m, tips pointing the way to go, drifting forward over time.
      float s = fract((vAlong - uTime * 0.9) / 0.55);
      float c = s + side * 0.3;
      float chevron = smoothstep(0.30, 0.35, c) * (1.0 - smoothstep(0.50, 0.55, c));
      // Fade in just ahead of the visitor's feet and out at the goal.
      float ends = smoothstep(0.15, 0.9, vAlong) * (1.0 - smoothstep(uLength - 0.25, uLength, vAlong));
      vec3 color = mix(uColor, vec3(1.0), chevron * 0.9);
      gl_FragColor = vec4(color, edge * ends * (0.62 + chevron * 0.38));
    }
  `,
};

/** The route as a flat ribbon on the floor with moving chevrons, like a game's waypoint trail. */
function RouteRibbon({ points }: { points: Point[] }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        ...ribbonShader,
        uniforms: { uTime: { value: 0 }, uLength: { value: 1 }, uColor: { value: new THREE.Color("#12a37d") } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        clipping: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  const geometry = useMemo(() => buildRibbon(points, ROUTE_WIDTH), [points]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  material.uniforms.uLength.value = geometry.userData.length;

  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt;
  });

  return <mesh geometry={geometry} material={material} renderOrder={5} frustumCulled={false} />;
}

/**
 * Triangle strip along a polyline with mitred corners. Attributes: `along` (metres from the
 * start, for the chevrons) and `across` (-1..1 over the width).
 */
export function buildRibbon(points: Point[], width: number): THREE.BufferGeometry {
  // Round the corners a little so the ribbon turns smoothly instead of folding.
  const pts = smoothCorners(points, 0.35);
  const n = pts.length;
  const pos = new Float32Array(n * 2 * 3);
  const along = new Float32Array(n * 2);
  const across = new Float32Array(n * 2);
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    if (i > 0) dist += Math.hypot(p.x - prev.x, p.z - prev.z);
    // Direction: average of the incoming and outgoing segments.
    let dx = next.x - prev.x;
    let dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const half = width / 2;
    // Normal to the left of the direction of travel.
    const nx = dz;
    const nz = -dx;
    pos.set([p.x + nx * half, p.y + LIFT, p.z + nz * half, p.x - nx * half, p.y + LIFT, p.z - nz * half], i * 6);
    along.set([dist, dist], i * 2);
    across.set([-1, 1], i * 2);
  }
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("along", new THREE.BufferAttribute(along, 1));
  g.setAttribute("across", new THREE.BufferAttribute(across, 1));
  g.setIndex(index);
  g.userData.length = dist;
  return g;
}

/** Replaces each corner with a short arc (quadratic Bézier between points `radius` before and after it). */
function smoothCorners(points: Point[], radius: number): Point[] {
  if (points.length < 3) return densify(points);
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];
    const la = Math.hypot(b.x - a.x, b.z - a.z);
    const lc = Math.hypot(c.x - b.x, c.z - b.z);
    const r = Math.min(radius, la / 2, lc / 2);
    const p0 = lerp(b, a, r / (la || 1));
    const p2 = lerp(b, c, r / (lc || 1));
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const u = 1 - t;
      out.push({
        x: u * u * p0.x + 2 * u * t * b.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * b.y + t * t * p2.y,
        z: u * u * p0.z + 2 * u * t * b.z + t * t * p2.z,
      });
    }
  }
  out.push(points[points.length - 1]);
  return densify(out);
}

/** Adds points on long straight runs so the floor-following height and the chevrons stay even. */
function densify(points: Point[], step = 0.5): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      const a = points[i - 1];
      const b = points[i];
      const n = Math.floor(Math.hypot(b.x - a.x, b.z - a.z) / step);
      for (let k = 1; k < n; k++) out.push(lerp(a, b, k / n));
    }
    out.push(points[i]);
  }
  return out;
}

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

/** A pulsing ring and a soft light beam where the route ends, visible from across the venue. */
function GoalMarker({ goal, arrived }: { goal: Point; arrived: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const color = arrived ? "#f2b233" : "#12a37d";
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ring.current) {
      const k = (t * 0.8) % 1;
      ring.current.scale.setScalar(0.6 + k * 0.9);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
    }
    if (beam.current) {
      // A beacon from afar; it fades as the visitor walks up to it, and goes once they've arrived.
      const cam = state.camera.position;
      const near = THREE.MathUtils.clamp((Math.hypot(cam.x - goal.x, cam.z - goal.z) - 1.2) / 2.5, 0, 1);
      const m = beam.current.material as THREE.MeshBasicMaterial;
      m.opacity = arrived ? 0 : (0.16 + Math.sin(t * 2.4) * 0.05) * near;
      beam.current.visible = m.opacity > 0.005;
    }
  });
  return (
    <group position={[goal.x, goal.y + LIFT, goal.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
        <ringGeometry args={[0.28, 0.36, 48]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6}>
        <ringGeometry args={[0.36, 0.42, 48]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={beam} position={[0, 1.3, 0]} renderOrder={4}>
        <cylinderGeometry args={[0.22, 0.32, 2.6, 32, 1, true]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The walkable area as a translucent green sheet, for showing how routing sees the venue. */
function NavMeshOverlay() {
  const geometry = useMemo(() => {
    const world = getNavWorld();
    if (!world) return null;
    const { positions, indices } = navMeshGeometryData(world);
    // Only the floor: tops of beds and desks are walkable surfaces too, but nobody can reach them.
    const floor: number[] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const ys = [0, 1, 2].map((k) => positions[indices[i + k] * 3 + 1]);
      if (Math.max(...ys) < 0.3) floor.push(indices[i], indices[i + 1], indices[i + 2]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setIndex(floor);
    g.translate(0, 0.02, 0);
    return g;
  }, []);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <group>
      <mesh geometry={geometry} renderOrder={3}>
        <meshBasicMaterial color="#1d9e75" transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh geometry={geometry} renderOrder={3}>
        <meshBasicMaterial color="#0f6e56" wireframe transparent opacity={0.45} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
