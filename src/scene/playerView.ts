import * as THREE from "three";

/**
 * The walker's current eye pose. The player writes it every frame it is in control, and
 * the camera director flies back to it when the intro or the overview hands control over.
 */
export const playerView = {
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  /** True while the director is flying the camera; the walker leaves it alone until then. */
  flying: false,
  /** Eye height above the floor for this venue, so the feet are at position.y - eye. */
  eye: 1.6,
  /** A heading (radians) the walker should turn to, e.g. along a new route while the camera is away. */
  pendingYaw: null as number | null,
};
