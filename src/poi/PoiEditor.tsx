import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { MeshBVH } from "three-mesh-bvh";
import { useApp } from "../store";
import { selectPoi } from "../nav/runtime";
import { addPoi, updatePoi, useEditor } from "./editorStore";
import { CATEGORIES } from "./types";
import { venueIdFromUrl } from "../venue/loadVenue";

const CEILING_SKIP = 1.75;

/**
 * Editor clicks on the scan (?edit=1). In the overview, a click (not an orbit drag) places a
 * POI, moves the one being edited, or adds a corner to the zone being drawn.
 */
export function PoiEditorScene({ collider }: { collider: THREE.Mesh }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const venueId = useMemo(() => venueIdFromUrl(), []);
  const pois = useApp((s) => s.pois);
  const draftZone = useEditor((s) => s.draftZone);
  const editingId = useEditor((s) => s.editingId);

  useEffect(() => {
    const el = gl.domElement;
    const bvh = (collider.geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree;
    const raycaster = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || !bvh) return;
      const { view } = useApp.getState();
      if (view !== "overview") return;
      const r = el.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = bvh
        .raycast(raycaster.ray, THREE.DoubleSide)
        .sort((a, b) => a.distance - b.distance)
        .find((h) => h.point.y < CEILING_SKIP);
      if (!hit) return;
      const p: [number, number, number] = [hit.point.x, Math.max(0, hit.point.y), hit.point.z];
      const ed = useEditor.getState();
      if (ed.mode === "place") {
        const poi = addPoi(venueId, p);
        useEditor.setState({ mode: "idle", editingId: poi.id });
        selectPoi(poi.id);
      } else if (ed.mode === "move" && ed.editingId) {
        updatePoi(venueId, ed.editingId, { position: p });
        useEditor.setState({ mode: "idle" });
      } else if (ed.mode === "zone") {
        useEditor.setState({ draftZone: [...ed.draftZone, [p[0], p[2]]] });
      }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [gl, camera, collider, venueId]);

  return (
    <group>
      {pois.map((p) =>
        p.zone ? (
          <Line
            key={p.id}
            points={[...p.zone, p.zone[0]].map(([x, z]) => [x, 0.05, z] as [number, number, number])}
            color={CATEGORIES[p.category].color}
            lineWidth={p.id === editingId ? 4 : 2}
            dashed={p.id !== editingId}
            dashSize={0.25}
            gapSize={0.12}
          />
        ) : null,
      )}
      {draftZone.length > 0 && (
        <Line points={draftZone.map(([x, z]) => [x, 0.06, z] as [number, number, number])} color="#f2b233" lineWidth={4} />
      )}
      {draftZone.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.06, z]}>
          <sphereGeometry args={[0.07, 12, 8]} />
          <meshBasicMaterial color="#f2b233" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
