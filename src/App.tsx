import { Suspense, useCallback, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { QUALITY_DPR, useApp } from "./store";
import { loadVenue, venueIdFromUrl } from "./venue/loadVenue";
import type { VenueConfig } from "./venue/types";
import { SCAN_SKY, VenueScene } from "./scene/VenueScene";
import type { FloorSlice } from "./scene/collider";
import { Minimap } from "./ui/Minimap";
import { ErrorScreen, Fps, HelpOverlay, Joystick, LoadingScreen, SettingsPanel, TopBar, WalkHint } from "./ui/Hud";

export default function App() {
  const [venue, setVenue] = useState<VenueConfig | null>(null);
  const [slice, setSlice] = useState<FloorSlice | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const quality = useApp((s) => s.quality);

  useEffect(() => {
    loadVenue(venueIdFromUrl())
      .then((v) => {
        setVenue(v);
        document.title = `${v.name} · Namma Space`;
      })
      .catch((err: Error) => useApp.setState({ loading: null, error: err.message }));
  }, []);

  const onSlice = useCallback((s: FloorSlice) => setSlice(s), []);
  const isDemo = venue?.collider.url === "demo";

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--bg)]">
      {venue && (
        <Canvas
          shadows={!venue.splat}
          dpr={Math.min(QUALITY_DPR[quality], window.devicePixelRatio)}
          camera={{ fov: 70, near: 0.05, far: 200 }}
          gl={{ antialias: quality !== "low", powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            setCanvas(gl.domElement);
          }}
          className="!absolute inset-0 touch-none"
        >
          <color attach="background" args={[venue.splat ? "#0e1110" : isDemo ? "#dfe3dc" : SCAN_SKY]} />
          <Suspense fallback={null}>
            <VenueScene venue={venue} onSlice={onSlice} />
          </Suspense>
        </Canvas>
      )}

      {venue && (
        <div className="hud pointer-events-none absolute inset-0 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 sm:flex-none">
              <TopBar venue={venue} isDemo={isDemo} />
            </div>
            <div className="hidden sm:block">
              <Minimap slice={slice} />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <SettingsPanel />
          </div>
          <div className="mt-auto flex items-end justify-between gap-3">
            <Joystick />
            <div className="flex items-center gap-2">
              <WalkHint />
              <Fps />
            </div>
          </div>
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 ring-1 ring-black/30" aria-hidden="true" />
        </div>
      )}

      {venue && <HelpOverlay canvas={canvas} venue={venue} />}
      <LoadingScreen />
      <ErrorScreen />
    </div>
  );
}
