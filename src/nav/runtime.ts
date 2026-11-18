import * as THREE from "three";
import { useApp } from "../store";
import { playerView } from "../scene/playerView";
import type { Poi } from "../poi/types";
import { ARRIVE_RADIUS, nextInstruction } from "./guidance";
import { findRoute, snapToFloor, type NavWorld, type Point, type Route } from "./navmesh";

/** The venue's walkable area. Lives outside React state: it wraps WebAssembly memory. */
let world: NavWorld | null = null;

export function setNavWorld(w: NavWorld | null) {
  world = w;
  useApp.setState({ navReady: !!w });
}
export const getNavWorld = () => world;

/** The visitor's feet on the floor plan. */
export function playerFeet(): Point {
  return { x: playerView.position.x, y: playerView.position.y - playerView.eye, z: playerView.position.z };
}

const poiById = (id: string) => useApp.getState().pois.find((p) => p.id === id) ?? null;

/** Where a route to this POI ends: the walkable floor beside it. */
export function poiGoal(poi: Poi): Point | null {
  if (!world) return null;
  const [x, y, z] = poi.position;
  return snapToFloor(world, { x, y, z });
}

/** Walking route from the visitor to a POI, or null if there's no walkable area yet. */
export function routeToPoi(poi: Poi): Route | null {
  const goal = poiGoal(poi);
  return world && goal ? findRoute(world, playerFeet(), goal) : null;
}

/** Shows a POI's card. Frees the mouse so its buttons can be clicked. */
export function selectPoi(id: string | null) {
  if (id && document.pointerLockElement) document.exitPointerLock();
  useApp.setState({ selectedPoiId: id });
}

/** Starts turn-by-turn navigation to a POI, by default with a quick look at the route from above. */
export function startNavigation(id: string, opts: { preview?: boolean; autoWalk?: boolean } = {}) {
  const poi = poiById(id);
  if (!poi || !world) return;
  const goal = poiGoal(poi);
  if (!goal) return;
  const nav = {
    poiId: id,
    goal,
    route: [],
    remaining: Infinity,
    instruction: { turn: "straight" as const, distance: 0, text: "Finding the route" },
    arrived: false,
    autoWalk: !!opts.autoWalk,
    reachable: true,
  };
  useApp.setState({ nav, selectedPoiId: id, searchOpen: false });
  updateNavigation();
  const s = useApp.getState();
  if (opts.preview !== false && s.view === "walk" && s.nav && s.nav.remaining > 3) {
    // While the camera shows the route from above, turn the walker to face the way to go,
    // so the view comes back down already looking along the route.
    const feet = playerFeet();
    const ahead = pointAlong(s.nav.route, 1.2);
    const yaw = Math.atan2(-(ahead.x - feet.x), -(ahead.z - feet.z));
    playerView.pendingYaw = yaw;
    playerView.quaternion.setFromEuler(new THREE.Euler(-0.12, yaw, 0, "YXZ"));
    useApp.setState({ routePreview: { token: (s.routePreview?.token ?? 0) + 1 } });
  }
}

export function stopNavigation() {
  useApp.setState({ nav: null });
}

export function setAutoWalk(on: boolean) {
  const nav = useApp.getState().nav;
  if (nav && nav.autoWalk !== on) useApp.setState({ nav: { ...nav, autoWalk: on && !nav.arrived } });
  if (on && useApp.getState().view !== "walk") useApp.setState({ view: "walk" });
}

/** Recomputes the route from where the visitor now stands. Called a few times a second. */
export function updateNavigation() {
  const { nav } = useApp.getState();
  if (!nav || !world) return;
  const route = findRoute(world, playerFeet(), nav.goal);
  if (!route) return;
  const feet = playerFeet();
  const direct = Math.hypot(feet.x - nav.goal.x, feet.z - nav.goal.z);
  // Unreachable goals end at the closest walkable spot; reaching that spot ends the trip too.
  const arrived = route.complete ? route.length <= ARRIVE_RADIUS || direct <= ARRIVE_RADIUS * 0.7 : route.length <= ARRIVE_RADIUS;
  useApp.setState({
    nav: {
      ...nav,
      route: route.points,
      remaining: route.length,
      instruction: nextInstruction(route.points, route.length),
      arrived: nav.arrived || arrived,
      autoWalk: nav.autoWalk && !arrived,
      reachable: route.complete,
    },
  });
}

/**
 * "Jump there": flies the camera to a spot a step short of the POI, facing it, and moves the
 * walker there. Uses the walking route so the visitor lands on the right side of walls.
 */
export function jumpToPoi(id: string) {
  const poi = poiById(id);
  if (!poi || !world) return;
  const route = routeToPoi(poi);
  const goal = poiGoal(poi);
  if (!goal) return;
  let stand = goal;
  if (route && route.points.length > 1) stand = pointAlong(route.points, Math.max(0, route.length - 1.1));
  const yaw = Math.atan2(-(poi.position[0] - stand.x), -(poi.position[2] - stand.z));
  playerView.flying = true; // the walker waits while the camera flies
  const s = useApp.getState();
  if (document.pointerLockElement) document.exitPointerLock();
  useApp.setState({
    view: "walk",
    searchOpen: false,
    selectedPoiId: id,
    nav: null,
    teleport: { position: [stand.x, stand.y, stand.z], yaw, token: (s.teleport?.token ?? 0) + 1 },
  });
}

/** The point `distance` metres along a polyline (clamped to its ends). */
export function pointAlong(points: Point[], distance: number): Point {
  let left = distance;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= seg && seg > 0) {
      const t = left / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
    }
    left -= seg;
  }
  return { ...points[points.length - 1] };
}
