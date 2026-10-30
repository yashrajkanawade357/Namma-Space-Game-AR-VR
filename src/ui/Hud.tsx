import { useEffect, useRef, useState } from "react";
import { isTouchDevice, toggleOverview, useApp, type Quality } from "../store";
import type { VenueConfig } from "../venue/types";

function requestWalk(canvas: HTMLCanvasElement | null) {
  useApp.setState({ helpOpen: false });
  if (!isTouchDevice()) canvas?.requestPointerLock?.()?.catch?.(() => undefined);
}

export function TopBar({ venue, isDemo }: { venue: VenueConfig; isDemo: boolean }) {
  const set = useApp((s) => s.set);
  const settingsOpen = useApp((s) => s.settingsOpen);
  const view = useApp((s) => s.view);
  return (
    <header className="panel pointer-events-auto flex items-center gap-3 px-3 py-2">
      <a href="/" className="chip !border-[var(--line)] !bg-transparent !text-[var(--fg)]" aria-label="Return to Namma Space home" title="Return to Namma Space home">
        <span aria-hidden="true">←</span><span className="hidden sm:inline">Home</span>
      </a>
      <div className="display hidden text-[15px] leading-none sm:block">
        Namma<span className="text-[var(--route)]">/</span>Space
      </div>
      <div className="hidden h-5 w-px bg-[var(--line)] sm:block" />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold leading-tight">{venue.name}</div>
        {venue.subtitle && <div className="truncate text-[11px] leading-tight text-[var(--muted)]">{venue.subtitle}</div>}
      </div>
      {isDemo && <span className="chip chip-warn hidden sm:inline-flex">Demo layout, not a scan</span>}
      <div className="ml-auto flex items-center gap-1">
        <IconButton label={view === "overview" ? "Back to walking (V)" : "Overview (V)"} pressed={view === "overview"} onClick={toggleOverview}>
          <path d="M12 3 3 8l9 5 9-5-9-5Z" />
          <path d="m3 13 9 5 9-5" />
        </IconButton>
        <IconButton label="Controls" onClick={() => set({ helpOpen: true })}>
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17h.01" />
          <circle cx="12" cy="12" r="9" />
        </IconButton>
        <IconButton label="Back to start" onClick={() => useApp.getState().reset()}>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
        </IconButton>
        <IconButton label="Settings" pressed={settingsOpen} onClick={() => set({ settingsOpen: !settingsOpen })}>
          <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="18" cy="18" r="2" />
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} aria-pressed={pressed} onClick={onClick}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

export function SettingsPanel() {
  const { speed, quality, showCollider, settingsOpen, set } = useApp();
  if (!settingsOpen) return null;
  return (
    <section className="panel pointer-events-auto w-64 p-4" aria-label="Settings">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="display text-[14px]">Settings</h2>
        <button type="button" className="text-[12px] text-[var(--muted)] hover:text-[var(--fg)]" onClick={() => set({ settingsOpen: false })}>
          Close
        </button>
      </div>
      <label htmlFor="speed" className="flex justify-between text-[12px] text-[var(--muted)]">
        <span>Walking speed</span>
        <span className="mono text-[var(--fg)]">{speed.toFixed(1)} m/s</span>
      </label>
      <input id="speed" type="range" min={0.6} max={3.5} step={0.1} value={speed} onChange={(e) => set({ speed: Number(e.target.value) })} className="mt-1 w-full accent-[var(--route)]" />
      <div className="mt-4 text-[12px] text-[var(--muted)]">Render quality</div>
      <div className="mt-1 grid grid-cols-3 gap-1" role="radiogroup" aria-label="Render quality">
        {(["low", "medium", "high"] as Quality[]).map((q) => (
          <button key={q} type="button" role="radio" aria-checked={quality === q} className={`seg ${quality === q ? "seg-on" : ""}`} onClick={() => set({ quality: q })}>
            {q[0].toUpperCase() + q.slice(1)}
          </button>
        ))}
      </div>
      <label htmlFor="collider" className="mt-4 flex items-center justify-between gap-3 text-[13px]">
        <span>
          Show collision mesh
          <span className="block text-[11px] text-[var(--muted)]">What you bump into while walking</span>
        </span>
        <input id="collider" type="checkbox" checked={showCollider} onChange={(e) => set({ showCollider: e.target.checked })} className="h-4 w-4 accent-[var(--route)]" />
      </label>
    </section>
  );
}

export function HelpOverlay({ canvas, venue }: { canvas: HTMLCanvasElement | null; venue: VenueConfig }) {
  const helpOpen = useApp((s) => s.helpOpen);
  const loading = useApp((s) => s.loading);
  const view = useApp((s) => s.view);
  if (!helpOpen || loading || view !== "walk") return null;
  const touch = isTouchDevice();
  const rows: [string, string][] = touch
    ? [
        ["Left thumb", "Move with the joystick"],
        ["Right side", "Drag to look around"],
      ]
    : [
        ["W A S D", "Walk"],
        ["Mouse", "Look around"],
        ["Shift", "Walk faster"],
        ["R", "Back to the start"],
        ["V", "Overview of the whole space"],
        ["H", "Show these controls"],
        ["Esc", "Free the mouse"],
      ];
  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-[var(--scrim)] p-4">
      <div className="panel w-full max-w-sm p-5">
        <p className="eyebrow">Free roam</p>
        <h2 className="display mt-1 text-[22px] leading-tight">Walk through {venue.name}</h2>
        <p className="mt-2 text-[13px] text-[var(--muted)]">You'll start at the entrance. Walls and furniture block you, just like the real space.</p>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="kbd">{k}</kbd>
              </dt>
              <dd className="self-center">{v}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="btn-primary mt-5 w-full" onClick={() => requestWalk(canvas)} autoFocus>
          Start walking
        </button>
        {venue.credits?.length ? <p className="mt-3 text-[11px] text-[var(--muted)]">Credits: {venue.credits.join(", ")}</p> : null}
      </div>
    </div>
  );
}

export function LoadingScreen() {
  const loading = useApp((s) => s.loading);
  if (!loading) return null;
  const pct = Math.round(loading.progress * 100);
  return (
    <div className="absolute inset-0 grid place-items-center bg-[var(--bg)]">
      <div className="w-72 max-w-[85vw]">
        <div className="display text-[20px]">
          Namma<span className="text-[var(--route)]">/</span>Space
        </div>
        <div className="mt-4 flex justify-between text-[12px] text-[var(--muted)]">
          <span>{loading.label}</span>
          <span className="mono">{pct}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--sunk)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[var(--route)] transition-[width] duration-200" style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
      </div>
    </div>
  );
}

export function ErrorScreen() {
  const error = useApp((s) => s.error);
  if (!error) return null;
  return (
    <div className="absolute inset-0 grid place-items-center bg-[var(--bg)] p-6">
      <div className="panel max-w-md p-5">
        <h2 className="display text-[18px]">This venue didn't load</h2>
        <p className="mt-2 text-[13px] text-[var(--muted)]">{error}</p>
        <a className="btn-primary mt-4 inline-block" href="?venue=demo">
          Open the demo instead
        </a>
      </div>
    </div>
  );
}

export function WalkHint() {
  const walking = useApp((s) => s.walking);
  const helpOpen = useApp((s) => s.helpOpen);
  const view = useApp((s) => s.view);
  const loading = useApp((s) => s.loading);
  const touch = isTouchDevice();
  if (loading) return null;
  if (view === "intro") return <div className="chip pointer-events-none">{touch ? "Tap" : "Click or press any key"} to skip</div>;
  if (view === "overview") return <div className="chip pointer-events-none">{touch ? "Drag to turn, pinch to zoom" : "Drag to turn, scroll to zoom · V to walk again"}</div>;
  if (walking || helpOpen || touch) return null;
  return <div className="chip pointer-events-none">Click the view to look around</div>;
}

/** Virtual joystick for phones; writes a -1..1 vector to the store. */
export function Joystick() {
  const helpOpen = useApp((s) => s.helpOpen);
  const view = useApp((s) => s.view);
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const R = 44;

  useEffect(() => () => useApp.setState({ stick: { x: 0, y: 0 } }), []);
  if (!isTouchDevice() || helpOpen || view !== "walk") return null;

  const update = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    setKnob({ x: dx, y: dy });
    useApp.setState({ stick: { x: dx / R, y: -dy / R } });
  };
  const end = () => {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    useApp.setState({ stick: { x: 0, y: 0 } });
  };

  return (
    <div
      ref={base}
      className="pointer-events-auto relative h-28 w-28 touch-none rounded-full border border-[var(--line)] bg-[var(--glass)]"
      aria-label="Move"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-[var(--route)]" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
}

export function Fps() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let id = 0;
    const tick = (t: number) => {
      frames++;
      if (t - last >= 1000) {
        setFps(Math.round((frames * 1000) / (t - last)));
        frames = 0;
        last = t;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  return <span className="chip mono pointer-events-none">{fps} fps</span>;
}
