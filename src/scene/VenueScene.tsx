import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { isTouchDevice, useApp } from "../store";
import type { Vec3, VenueConfig } from "../venue/types";
import { buildCollider, sliceCollider, type FloorSlice } from "./collider";
import { buildDemoLayout } from "./demoLayout";
import { Player } from "./Player";

const deg = (v?: Vec3) => (v ? new THREE.Euler(...v.map(THREE.MathUtils.degToRad) as Vec3) : new THREE.Euler());

function place(obj: THREE.Object3D, t: { position?: Vec3; rotation?: Vec3; scale?: number }) {
  if (t.position) obj.position.set(...t.position);
  obj.rotation.copy(deg(t.rotation));
  if (t.scale) obj.scale.setScalar(t.scale);
}

/** Background and fog colour for scanned rooms: a soft ceiling tone that fills the open top of a scan. */
export const SCAN_SKY = "#ebe7e0";

const isBaked = (venue: VenueConfig) => venue.collider.url !== "demo" && (venue.collider.shading ?? "baked") === "baked";

async function loadColliderSource(venue: VenueConfig, maxAnisotropy: number, onProgress: (p: number) => void): Promise<THREE.Object3D> {
  if (venue.collider.url === "demo") return buildDemoLayout();
  // Phones get the lighter texture; desktops can afford the sharper one.
  const url = venue.collider.hiResUrl && !isTouchDevice() ? venue.collider.hiResUrl : venue.collider.url;
  const gltf = await new GLTFLoader().loadAsync(url, (e) => {
    if (e.total) onProgress(e.loaded / e.total);
  });
  const baked = isBaked(venue);
  // Photogrammetry rooms are wound for viewing from outside, so every material renders
  // both sides to show the walls from within.
  gltf.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = ([] as THREE.Material[]).concat(mesh.material).map((m) => {
      const std = m as THREE.MeshStandardMaterial;
      if (std.map) std.map.anisotropy = maxAnisotropy;
      // A phone scan's texture already holds the room's real light. Showing it unlit keeps
      // the captured colours instead of shading them a second time into grey plastic.
      if (baked && std.map) {
        m.dispose();
        return new THREE.MeshBasicMaterial({ map: std.map, side: THREE.DoubleSide, toneMapped: false });
      }
      // Lit fallback: exports often skip normals and leave glTF's default metalness of 1,
      // which renders black without an environment map.
      if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
      if (std.isMeshStandardMaterial && !std.metalnessMap) std.metalness = 0;
      m.side = THREE.DoubleSide;
      return m;
    });
    if (Array.isArray(mesh.material) && mesh.material.length === 1) mesh.material = mesh.material[0];
  });
  return gltf.scene;
}

export function VenueScene({ venue, onSlice }: { venue: VenueConfig; onSlice: (s: FloorSlice) => void }) {
  const gl = useThree((s) => s.gl);
  const showCollider = useApp((s) => s.showCollider);
  const [world, setWorld] = useState<{ visual: THREE.Object3D | null; collider: THREE.Mesh } | null>(null);
  const spark = useMemo(() => new SparkRenderer({ renderer: gl }), [gl]);

  useEffect(() => {
    let cancelled = false;
    const set = useApp.getState().set;
    // Splat and mesh download in parallel; progress shows the slower of the two.
    const progress = { mesh: 0, splat: venue.splat ? 0 : 1 };
    const report = () =>
      set({ loading: { label: venue.splat ? "Loading the 3D scan" : "Loading the walkable mesh", progress: Math.min(progress.mesh, progress.splat) } });
    report();

    (async () => {
      try {
        const meshTask = loadColliderSource(venue, gl.capabilities.getMaxAnisotropy(), (p) => {
          progress.mesh = p * 0.9;
          report();
        });

        let splat: SplatMesh | null = null;
        const splatTask = venue.splat
          ? (async () => {
              splat = new SplatMesh({
                url: venue.splat!.url,
                onProgress: (e: ProgressEvent) => {
                  if (e.total) {
                    progress.splat = (e.loaded / e.total) * 0.95;
                    report();
                  }
                },
              });
              place(splat, venue.splat!);
              await splat.initialized;
              progress.splat = 1;
            })()
          : Promise.resolve();

        const [source] = await Promise.all([meshTask, splatTask]);
        place(source, venue.collider);
        const collider = buildCollider(source);
        progress.mesh = 1;
        if (cancelled) return;

        onSlice(sliceCollider(collider));
        // With a splat, the mesh stays hidden and only drives physics; the demo shows its own geometry.
        setWorld({ visual: splat ?? source, collider });
        set({ loading: null });
      } catch (err) {
        if (!cancelled) set({ loading: null, error: err instanceof Error ? err.message : String(err) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [venue, onSlice, gl]);

  // Splats and baked scans carry their own lighting; only the demo and "lit" meshes need lights.
  const meshLit = !venue.splat && !isBaked(venue);

  return (
    <>
      <primitive object={spark} />
      {isBaked(venue) && !venue.splat && <fog attach="fog" args={[SCAN_SKY, 7, 24]} />}
      <hemisphereLight args={[0xffffff, 0xb9ae9c, meshLit ? 0.9 : 0.4]} />
      {meshLit && (
        <directionalLight
          position={[-4, 9, 6]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-7}
          shadow-camera-right={7}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
        />
      )}
      {world?.visual && <primitive object={world.visual} />}
      {world && <primitive object={world.collider} visible={showCollider} />}
      {world && <Player venue={venue} collider={world.collider} />}
    </>
  );
}
