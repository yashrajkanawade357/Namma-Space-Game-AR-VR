import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useApp, type View } from "../store";
import { playerView } from "./playerView";

const INTRO_ORBIT = 4.2;
const INTRO_DESCENT = 2.6;
const TRANSITION = 1.3;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Route preview: rise, hold over the route, come back down. */
const PREVIEW_UP = 1.2;
const PREVIEW_HOLD = 1.6;
const JUMP = 1.8;

interface Flight {
  from: { position: THREE.Vector3; quaternion: THREE.Quaternion };
  to: () => { position: THREE.Vector3; quaternion: THREE.Quaternion };
  start: number;
  duration: number;
  then: () => void;
  /** Extra height at the middle of the flight, so jumps arc over walls instead of through them. */
  arc: number;
}

/**
 * Flies the camera whenever the walker isn't in control: the opening sweep over the
 * scan that ends at the visitor's eyes, and the overhead overview with orbit controls.
 */
export function CameraDirector({ bounds }: { bounds: THREE.Box3 }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const view = useApp((s) => s.view);

  const room = useMemo(() => {
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z);
    return { center: new THREE.Vector3(center.x, bounds.min.y + 0.8, center.z), span, height: size.y };
  }, [bounds]);

  // From above, any scanned ceiling hides the room; cut it away while the camera is up there.
  const ceilingCut = useMemo(
    () => [new THREE.Plane(new THREE.Vector3(0, -1, 0), bounds.min.y + Math.max(1.8, room.height - 0.45))],
    [bounds, room.height],
  );
  useEffect(() => () => void (gl.clippingPlanes = []), [gl]);

  const controls = useMemo(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enabled = false;
    c.enableDamping = true;
    c.maxPolarAngle = Math.PI * 0.46;
    c.minDistance = 2;
    c.maxDistance = room.span * 3;
    return c;
  }, [camera, gl, room.span]);
  useEffect(() => () => controls.dispose(), [controls]);

  const flight = useRef<Flight | null>(null);
  const introStart = useRef<number | null>(null);
  const prevView = useRef<View>(view);

  const overviewPose = () => {
    // Steep enough to look down into the room through its open top, not at the outside of its walls.
    const position = room.center.clone().add(new THREE.Vector3(room.span * 0.15, room.span * 0.95, room.span * 0.4));
    const m = new THREE.Matrix4().lookAt(position, room.center, new THREE.Vector3(0, 1, 0));
    return { position, quaternion: new THREE.Quaternion().setFromRotationMatrix(m) };
  };
  const eyePose = () => ({ position: playerView.position.clone(), quaternion: playerView.quaternion.clone() });

  /** Looks down on the visitor, the route and the goal together, a little tilted so walls read as walls. */
  const routePose = () => {
    const box = new THREE.Box3().expandByPoint(playerView.position.clone().setY(0));
    for (const p of useApp.getState().nav?.route ?? []) box.expandByPoint(new THREE.Vector3(p.x, 0, p.z));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z, 3);
    const position = center.clone().add(new THREE.Vector3(0, span * 1.05 + 1.5, span * 0.38));
    const m = new THREE.Matrix4().lookAt(position, center, new THREE.Vector3(0, 1, 0));
    return { position, quaternion: new THREE.Quaternion().setFromRotationMatrix(m) };
  };

  const fly = (to: Flight["to"], duration: number, then: () => void, now: number, arc = 0) => {
    controls.enabled = false;
    playerView.flying = true;
    flight.current = {
      from: { position: camera.position.clone(), quaternion: camera.quaternion.clone() },
      to,
      start: now,
      duration,
      then,
      arc,
    };
  };
  const teleportToken = useRef(useApp.getState().teleport?.token ?? 0);
  const previewToken = useRef(useApp.getState().routePreview?.token ?? 0);

  // Any click or key during the intro skips straight to walking.
  useEffect(() => {
    if (view !== "intro") return;
    const skip = () => {
      if (useApp.getState().view !== "intro" || useApp.getState().loading) return;
      flight.current = null;
      playerView.flying = false;
      camera.position.copy(playerView.position);
      camera.quaternion.copy(playerView.quaternion);
      useApp.setState({ view: "walk" });
    };
    window.addEventListener("keydown", skip);
    gl.domElement.addEventListener("pointerdown", skip);
    return () => {
      window.removeEventListener("keydown", skip);
      gl.domElement.removeEventListener("pointerdown", skip);
    };
  }, [view, camera, gl]);

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    const { view: current, loading } = useApp.getState();
    const aerial = current !== "walk" || playerView.flying;
    gl.clippingPlanes = aerial ? ceilingCut : [];
    // Fog softens distant edges at eye level, but would haze the whole room from up high.
    const fog = state.scene.fog as THREE.Fog | null;
    if (fog) fog.far = aerial ? 1e4 : 24;

    // React to view changes made by the HUD or the keyboard.
    if (current !== prevView.current) {
      if (current === "overview") fly(overviewPose, TRANSITION, () => (controls.enabled = true), now);
      if (current === "walk" && prevView.current === "overview") fly(eyePose, TRANSITION, () => undefined, now);
      prevView.current = current;
    }

    // "Jump there": arc from wherever the camera is to the walker's new eyes.
    const { teleport, routePreview } = useApp.getState();
    if (teleport && teleport.token !== teleportToken.current) {
      teleportToken.current = teleport.token;
      const dist = camera.position.distanceTo(playerView.position);
      fly(eyePose, JUMP, () => undefined, now, Math.min(4, 0.8 + dist * 0.3));
    }

    // Route preview after starting navigation: up over the whole route, a pause, back to the eyes.
    if (routePreview && routePreview.token !== previewToken.current) {
      previewToken.current = routePreview.token;
      if (current === "walk") {
        const pose = routePose();
        fly(() => pose, PREVIEW_UP, () => fly(() => pose, PREVIEW_HOLD, () => fly(eyePose, PREVIEW_UP, () => undefined, state.clock.elapsedTime), state.clock.elapsedTime), now);
      }
    }

    if (current === "intro" && !loading) {
      // A slow orbit high above the room, then a glide down to the visitor's eyes.
      if (introStart.current === null) introStart.current = now;
      const t = now - introStart.current;
      if (t < INTRO_ORBIT) {
        const a = -0.9 + (t / INTRO_ORBIT) * 1.1;
        const r = room.span * 0.4;
        camera.position.set(room.center.x + Math.sin(a) * r, room.center.y + room.span * 0.95, room.center.z + Math.cos(a) * r);
        camera.lookAt(room.center);
      } else if (!flight.current) {
        fly(eyePose, INTRO_DESCENT, () => useApp.setState({ view: "walk" }), now);
      }
    }

    const f = flight.current;
    if (f) {
      const k = ease(Math.min(1, (now - f.start) / f.duration));
      const to = f.to();
      camera.position.lerpVectors(f.from.position, to.position, k);
      camera.position.y += Math.sin(Math.PI * k) * f.arc;
      camera.quaternion.slerpQuaternions(f.from.quaternion, to.quaternion, k);
      if (k >= 1) {
        flight.current = null;
        playerView.flying = false;
        if (current === "overview") controls.target.copy(room.center);
        f.then();
      }
      return;
    }

    if (current === "overview" && controls.enabled) controls.update(delta);
  });

  return <PlayerMarker />;
}

/** The visitor's position and facing, shown while the camera is away from their eyes. */
function PlayerMarker() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    // Shown from above: in the overview, and during route previews and jumps.
    const v = useApp.getState().view;
    g.visible = v === "overview" || (v === "walk" && playerView.flying);
    g.position.set(playerView.position.x, playerView.position.y - playerView.eye, playerView.position.z);
    const e = new THREE.Euler().setFromQuaternion(playerView.quaternion, "YXZ");
    g.rotation.set(0, e.y, 0);
  });
  return (
    <group ref={ref} visible={false}>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.42, 40]} />
        <meshBasicMaterial color="#1d9e75" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.22, 1.0, 6, 16]} />
        <meshBasicMaterial color="#185fa5" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.06, -0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.18, 0.4, 3]} />
        <meshBasicMaterial color="#1d9e75" toneMapped={false} />
      </mesh>
    </group>
  );
}
