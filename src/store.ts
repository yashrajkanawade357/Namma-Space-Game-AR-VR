import { create } from "zustand";

export type Quality = "low" | "medium" | "high";

/** Upper bound on render resolution per quality level; never above the screen's own pixel ratio. */
export const QUALITY_DPR: Record<Quality, number> = { low: 0.75, medium: 1.5, high: 2 };

interface PlayerPose {
  x: number;
  z: number;
  yaw: number;
}

/**
 * Who drives the camera: the opening fly-through, the first-person walker, or the
 * overhead overview the visitor can toggle.
 */
export type View = "intro" | "walk" | "overview";

interface AppState {
  loading: { label: string; progress: number } | null;
  view: View;
  error: string | null;
  /** True while the mouse is captured on desktop or the walkthrough is active on touch. */
  walking: boolean;
  helpOpen: boolean;
  settingsOpen: boolean;
  speed: number;
  quality: Quality;
  showCollider: boolean;
  pose: PlayerPose;
  /** Incremented to ask the player to return to the spawn point. */
  resetToken: number;
  /** Joystick vector from the touch controls, x = strafe, y = forward, each -1..1. */
  stick: { x: number; y: number };
  set: (patch: Partial<AppState>) => void;
  reset: () => void;
}

export const useApp = create<AppState>((set) => ({
  loading: { label: "Loading venue", progress: 0 },
  view: "intro",
  error: null,
  walking: false,
  helpOpen: true,
  settingsOpen: false,
  speed: 1.6,
  quality: "medium",
  showCollider: false,
  pose: { x: 0, z: 0, yaw: 0 },
  resetToken: 0,
  stick: { x: 0, y: 0 },
  set: (patch) => set(patch),
  reset: () => set((s) => ({ resetToken: s.resetToken + 1 })),
}));

export const isTouchDevice = () => window.matchMedia("(pointer: coarse)").matches;

/** Switches between walking and the overhead overview; ignored during the intro. */
export function toggleOverview() {
  const { view } = useApp.getState();
  if (view === "intro") return;
  if (view === "walk") document.exitPointerLock?.();
  useApp.setState({ view: view === "walk" ? "overview" : "walk", settingsOpen: false });
}
