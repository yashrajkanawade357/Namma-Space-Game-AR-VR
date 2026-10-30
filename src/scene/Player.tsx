import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MeshBVH } from "three-mesh-bvh";
import { toggleOverview, useApp } from "../store";
import type { VenueConfig } from "../venue/types";
import { playerView } from "./playerView";

const RADIUS = 0.3;
const GRAVITY = -20;
const SUBSTEPS = 5;
const LOOK_SPEED = 0.0022;
const TOUCH_LOOK_SPEED = 0.005;
const RUN_MULTIPLIER = 1.8;
/** How quickly walking speed eases towards the input (per second); lower feels heavier. */
const ACCELERATION = 9;
/** Head bob: vertical sway in metres at full walking speed, and steps per metre. */
const BOB_HEIGHT = 0.022;
const BOB_STEPS_PER_METRE = 1.7;

/**
 * First-person walker. The player is a capsule whose top sits at eye level; every
 * frame it moves, falls under gravity, and is pushed out of the collider's
 * triangles (the three-mesh-bvh capsule approach), so it slides along walls and
 * stays on the scanned floor.
 */
export function Player({ venue, collider }: { venue: VenueConfig; collider: THREE.Mesh }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const eye = venue.eyeHeight ?? 1.6;

  const body = useMemo(
    () => ({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      /** Smoothed horizontal walking velocity, eased towards the input each frame. */
      walk: new THREE.Vector3(),
      bobPhase: 0,
      onGround: false,
      yaw: 0,
      pitch: 0,
      segment: new THREE.Line3(new THREE.Vector3(0, -0.25, 0), new THREE.Vector3(0, -(eye - RADIUS), 0)),
    }),
    [eye],
  );
  const keys = useRef(new Set<string>());
  const lastPose = useRef(0);
  const resetToken = useApp((s) => s.resetToken);

  // Spawn, and respawn whenever the reset button bumps the token.
  useEffect(() => {
    const [x, y, z] = venue.spawn.position;
    body.position.set(x, y + eye, z);
    body.velocity.set(0, 0, 0);
    body.walk.set(0, 0, 0);
    body.yaw = THREE.MathUtils.degToRad(venue.spawn.yaw ?? 0);
    body.pitch = 0;
    // The intro flies to this pose before the walker takes over.
    playerView.position.copy(body.position);
    playerView.quaternion.setFromEuler(new THREE.Euler(0, body.yaw, 0, "YXZ"));
  }, [venue, body, eye, resetToken]);

  useEffect(() => {
    const el = gl.domElement;
    const typing = (e: KeyboardEvent) => e.target instanceof Element && e.target.closest("input, textarea, select");
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      keys.current.add(e.code);
      if (e.code === "KeyR") useApp.getState().reset();
      if (e.code === "KeyH") useApp.setState((s) => ({ helpOpen: !s.helpOpen }));
      if (e.code === "KeyV") toggleOverview();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();

    const look = (dx: number, dy: number, speed: number) => {
      body.yaw -= dx * speed;
      body.pitch = THREE.MathUtils.clamp(body.pitch - dy * speed, -1.45, 1.45);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === el) look(e.movementX, e.movementY, LOOK_SPEED);
    };

    // Drag-to-look: touch everywhere, and mouse when pointer lock is unavailable.
    let dragId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    const onPointerDown = (e: PointerEvent) => {
      const { helpOpen, view } = useApp.getState();
      if (helpOpen || view !== "walk") return;
      if (e.pointerType === "mouse" && document.pointerLockElement !== el) {
        el.requestPointerLock?.()?.catch?.(() => undefined);
      }
      dragId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== dragId || document.pointerLockElement === el) return;
      look(e.clientX - lastX, e.clientY - lastY, e.pointerType === "mouse" ? LOOK_SPEED * 1.4 : TOUCH_LOOK_SPEED);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId === dragId) dragId = null;
    };
    const onLockChange = () => useApp.setState({ walking: document.pointerLockElement === el });

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onLockChange);
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onLockChange);
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [gl, body]);

  const tmp = useMemo(
    () => ({
      move: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      box: new THREE.Box3(),
      seg: new THREE.Line3(),
      triPoint: new THREE.Vector3(),
      capPoint: new THREE.Vector3(),
      next: new THREE.Vector3(),
      delta: new THREE.Vector3(),
      euler: new THREE.Euler(0, 0, 0, "YXZ"),
    }),
    [],
  );

  useFrame((state, frameDelta) => {
    const { speed, stick, helpOpen, view } = useApp.getState();
    // The intro and the overview fly the camera themselves; the walker waits where it stands.
    if (view !== "walk" || playerView.flying) return;
    const bvh = (collider.geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH }).boundsTree;
    const frameDt = Math.min(frameDelta, 0.05);
    const dt = frameDt / SUBSTEPS;
    const k = keys.current;

    // Input → desired horizontal direction in world space.
    let fwd = 0;
    let side = 0;
    if (!helpOpen) {
      if (k.has("KeyW") || k.has("ArrowUp")) fwd += 1;
      if (k.has("KeyS") || k.has("ArrowDown")) fwd -= 1;
      if (k.has("KeyD") || k.has("ArrowRight")) side += 1;
      if (k.has("KeyA") || k.has("ArrowLeft")) side -= 1;
      fwd += stick.y;
      side += stick.x;
    }
    const run = k.has("ShiftLeft") || k.has("ShiftRight") ? RUN_MULTIPLIER : 1;
    tmp.forward.set(-Math.sin(body.yaw), 0, -Math.cos(body.yaw));
    tmp.right.set(Math.cos(body.yaw), 0, -Math.sin(body.yaw));
    tmp.move.set(0, 0, 0).addScaledVector(tmp.forward, fwd).addScaledVector(tmp.right, side);
    if (tmp.move.lengthSq() > 1) tmp.move.normalize();
    tmp.move.multiplyScalar(speed * run);
    // Ease into and out of walking instead of starting and stopping instantly.
    body.walk.lerp(tmp.move, 1 - Math.exp(-ACCELERATION * frameDt));

    for (let i = 0; i < SUBSTEPS && bvh; i++) {
      body.velocity.y += body.onGround ? 0 : GRAVITY * dt;
      body.position.addScaledVector(body.velocity, dt);
      body.position.addScaledVector(body.walk, dt);

      tmp.seg.copy(body.segment);
      tmp.seg.start.add(body.position);
      tmp.seg.end.add(body.position);
      tmp.box.makeEmpty().expandByPoint(tmp.seg.start).expandByPoint(tmp.seg.end).expandByScalar(RADIUS);

      bvh.shapecast({
        intersectsBounds: (b) => b.intersectsBox(tmp.box),
        intersectsTriangle: (tri) => {
          const dist = tri.closestPointToSegment(tmp.seg, tmp.triPoint, tmp.capPoint);
          if (dist < RADIUS) {
            const depth = RADIUS - dist;
            const dir = tmp.capPoint.sub(tmp.triPoint).normalize();
            tmp.seg.start.addScaledVector(dir, depth);
            tmp.seg.end.addScaledVector(dir, depth);
          }
        },
      });

      tmp.next.copy(tmp.seg.start).sub(body.segment.start);
      tmp.delta.subVectors(tmp.next, body.position);
      body.onGround = tmp.delta.y > Math.abs(dt * body.velocity.y * 0.25);
      const offset = Math.max(0, tmp.delta.length() - 1e-5);
      tmp.delta.normalize().multiplyScalar(offset);
      body.position.add(tmp.delta);
      if (body.onGround) body.velocity.set(0, 0, 0);
      else {
        tmp.delta.normalize();
        body.velocity.addScaledVector(tmp.delta, -tmp.delta.dot(body.velocity));
      }
    }

    // Fell through a hole in the scan: put the visitor back at the entrance.
    if (body.position.y < -6) useApp.getState().reset();

    // Gentle head bob while walking on the floor, fading out as the visitor slows down.
    const walkSpeed = body.walk.length();
    if (body.onGround) body.bobPhase += walkSpeed * frameDt * BOB_STEPS_PER_METRE * Math.PI;
    const bob = Math.sin(body.bobPhase) * BOB_HEIGHT * Math.min(1, walkSpeed / 1.6);

    camera.position.copy(body.position);
    camera.position.y += bob;
    tmp.euler.set(body.pitch, body.yaw, 0);
    camera.quaternion.setFromEuler(tmp.euler);
    playerView.position.copy(body.position);
    playerView.quaternion.copy(camera.quaternion);

    if (state.clock.elapsedTime - lastPose.current > 0.1) {
      lastPose.current = state.clock.elapsedTime;
      useApp.setState({ pose: { x: body.position.x, z: body.position.z, yaw: body.yaw } });
    }
  });

  return null;
}
