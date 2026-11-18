import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import type { MeshBVH } from "three-mesh-bvh";
import { useApp } from "../store";
import { selectPoi } from "../nav/runtime";
import { PoiIndex } from "./spatial";
import { CATEGORIES, type Poi } from "./types";

/** Labels further than this fade out, unless selected or being navigated to. */
const LABEL_RANGE = 14;
/** Hits above this height are the scanned ceiling, which the overview cuts away; look past them. */
const CEILING_SKIP = 1.75;

export const labelHeight = (poi: Poi) => (poi.category === "room" ? Math.max(poi.position[1] + 2.05, 2.05) : Math.max(poi.position[1] + 0.4, 0.95));

/** Floating name tags for every POI, and click-to-reveal on the scan itself. */
export function PoiLayer({ collider }: { collider: THREE.Mesh }) {
  const pois = useApp((s) => s.pois);
  const showLabels = useApp((s) => s.showLabels);
  const index = useMemo(() => new PoiIndex(pois), [pois]);
  const selected = useApp((s) => s.pois.find((p) => p.id === s.selectedPoiId) ?? null);
  return (
    <>
      {showLabels && pois.map((poi) => <PoiLabel key={poi.id} poi={poi} />)}
      {selected?.zone && <ZoneHighlight poi={selected} />}
      <PoiPicker collider={collider} index={index} />
    </>
  );
}

/** The selected room or area, outlined and tinted on the floor. */
function ZoneHighlight({ poi }: { poi: Poi }) {
  const color = CATEGORIES[poi.category].color;
  const { fill, outline } = useMemo(() => {
    const shape = new THREE.Shape(poi.zone!.map(([x, z]) => new THREE.Vector2(x, -z)));
    const fill = new THREE.ShapeGeometry(shape);
    fill.rotateX(-Math.PI / 2);
    fill.translate(0, 0.03, 0);
    const outline = [...poi.zone!, poi.zone![0]].map(([x, z]) => [x, 0.035, z] as [number, number, number]);
    return { fill, outline };
  }, [poi]);
  useEffect(() => () => fill.dispose(), [fill]);
  return (
    <group>
      <mesh geometry={fill} renderOrder={2}>
        <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <Line points={outline} color={color} lineWidth={3} />
    </group>
  );
}

function PoiLabel({ poi }: { poi: Poi }) {
  const ref = useRef<HTMLButtonElement>(null);
  const selected = useApp((s) => s.selectedPoiId === poi.id);
  const target = useApp((s) => s.nav?.poiId === poi.id);
  const anchor = useMemo(() => new THREE.Vector3(poi.position[0], labelHeight(poi), poi.position[2]), [poi]);
  const color = CATEGORIES[poi.category].color;

  // Fade with distance every frame without re-rendering React.
  useFrame(({ camera }) => {
    const el = ref.current;
    if (!el) return;
    const d = camera.position.distanceTo(anchor);
    const keep = selected || target;
    const o = keep ? 1 : THREE.MathUtils.clamp((LABEL_RANGE - d) / 4, 0, 1);
    el.style.opacity = o.toFixed(2);
    el.style.visibility = o < 0.02 ? "hidden" : "visible";
    el.style.transform = `scale(${THREE.MathUtils.clamp(5 / Math.max(d, 1), 0.72, 1.12).toFixed(3)})`;
  });

  return (
    <Html position={anchor} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <button
        ref={ref}
        type="button"
        className={`poi-tag ${selected || target ? "poi-tag-on" : ""}`}
        style={{ ["--poi" as string]: color }}
        onClick={(e) => {
          e.stopPropagation();
          selectPoi(poi.id);
        }}
        aria-label={`${poi.name}, ${CATEGORIES[poi.category].label}`}
      >
        <span className="poi-dot" aria-hidden="true" />
        {poi.name}
      </button>
    </Html>
  );
}

/**
 * Click-to-reveal. While walking (mouse captured) the crosshair picks; in the overview the
 * cursor does. The hit point on the scan is looked up in the POI index: a nearby object first,
 * otherwise the smallest room or zone around it.
 */
function PoiPicker({ collider, index }: { collider: THREE.Mesh; index: PoiIndex }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    const bvh = (collider.geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree;
    const raycaster = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;

    const pick = (ndc: THREE.Vector2) => {
      if (!bvh) return;
      raycaster.setFromCamera(ndc, camera);
      const hits = bvh.raycast(raycaster.ray, THREE.DoubleSide).sort((a, b) => a.distance - b.distance);
      const aerial = useApp.getState().view !== "walk";
      const hit = hits.find((h) => !aerial || h.point.y < CEILING_SKIP);
      if (!hit) return;
      const poi = index.at(hit.point.x, hit.point.z);
      if (poi) selectPoi(poi.id);
    };

    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      const { view, editMode } = useApp.getState();
      if (editMode) return;
      // Walking with the mouse captured: the crosshair at the centre of the view picks.
      if (view === "walk" && document.pointerLockElement === el) pick(new THREE.Vector2(0, 0));
    };
    const onUp = (e: PointerEvent) => {
      const { view, editMode } = useApp.getState();
      if (editMode || view !== "overview" || !down) return;
      // A click, not the end of an orbit drag.
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const r = el.getBoundingClientRect();
      pick(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1));
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [gl, camera, collider, index]);

  return null;
}
