import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../store";
import { createSearch } from "../poi/search";
import { CATEGORIES, type Poi } from "../poi/types";
import { etaLabel, type Turn } from "../nav/guidance";
import { jumpToPoi, routeToPoi, selectPoi, setAutoWalk, startNavigation, stopNavigation } from "../nav/runtime";

const metres = (d: number) => (!Number.isFinite(d) ? "–" : d < 10 ? `${d.toFixed(1)} m` : `${Math.round(d)} m`);

export function openSearch() {
  if (document.pointerLockElement) document.exitPointerLock();
  useApp.setState({ searchOpen: true, helpOpen: false, settingsOpen: false });
}

/** Global shortcuts: Ctrl/⌘+K or / opens search; Enter, J, G and Esc act on the selected place. */
export function NavShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest("input, textarea, select");
      const s = useApp.getState();
      if (s.loading || s.view === "intro") return;
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        openSearch();
        return;
      }
      if (typing || s.searchOpen || s.helpOpen) return;
      if (e.key === "Escape") {
        if (s.nav) stopNavigation();
        else if (s.selectedPoiId) selectPoi(null);
        return;
      }
      const id = s.selectedPoiId;
      if (!id) return;
      if (e.key === "Enter" && s.nav?.poiId !== id) startNavigation(id);
      if (e.code === "KeyJ") jumpToPoi(id);
      if (e.code === "KeyG" && s.nav) setAutoWalk(!s.nav.autoWalk);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}

export function SearchButton() {
  return (
    <button type="button" className="search-trigger pointer-events-auto" onClick={openSearch} aria-label="Search places (Ctrl+K)">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <span>Search places</span>
      <kbd className="kbd hidden sm:inline">Ctrl K</kbd>
    </button>
  );
}

/** Command-palette search: fuzzy matches with walking distances; Enter navigates, Shift+Enter jumps. */
export function SearchPalette() {
  const open = useApp((s) => s.searchOpen);
  // Mounted fresh on every open, so the box always starts empty.
  return open ? <SearchDialog /> : null;
}

function SearchDialog() {
  const pois = useApp((s) => s.pois);
  const navReady = useApp((s) => s.navReady);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const search = useMemo(() => createSearch(pois), [pois]);
  const hits = useMemo(() => search(query, 9), [query, search]);

  // Walking distance for each hit, from where the visitor stands now.
  const distances = useMemo(() => {
    const m = new Map<string, number>();
    if (!navReady) return m;
    for (const { poi } of hits) {
      const r = routeToPoi(poi);
      if (r) m.set(poi.id, r.complete ? r.length : Infinity);
    }
    return m;
  }, [hits, navReady]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = () => useApp.setState({ searchOpen: false });
  const go = (poi: Poi, jump: boolean) => (jump ? jumpToPoi(poi.id) : startNavigation(poi.id));

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-start justify-center bg-[var(--scrim)] p-4 pt-[12vh]" onMouseDown={close}>
      <div className="panel w-full max-w-lg overflow-hidden p-0" role="dialog" aria-label="Search places" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-4">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[var(--muted)]" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={pois.length ? `Search ${pois.length} places, e.g. "${pois[0].name.toLowerCase()}"` : "No places tagged in this venue yet"}
            className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--muted)]"
            aria-label="Search places"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={hits[active] ? `hit-${hits[active].poi.id}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(hits.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter" && hits[active]) {
                e.preventDefault();
                go(hits[active].poi, e.shiftKey);
              } else if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
            }}
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        <ul id="search-results" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
          {!hits.length && <li className="px-4 py-6 text-center text-[13px] text-[var(--muted)]">{pois.length ? `Nothing matches "${query}".` : "This venue has no tagged places yet."}</li>}
          {hits.map(({ poi }, i) => {
            const cat = CATEGORIES[poi.category];
            const d = distances.get(poi.id);
            return (
              <li
                key={poi.id}
                id={`hit-${poi.id}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                className={`group flex cursor-pointer items-center gap-3 px-4 py-2.5 ${i === active ? "bg-[var(--sunk)]" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(poi, false)}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cat.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{poi.name}</span>
                  <span className="block truncate text-[12px] text-[var(--muted)]">
                    {cat.label}
                    {poi.description ? ` · ${poi.description}` : ""}
                  </span>
                </span>
                <span className="mono shrink-0 text-[12px] text-[var(--muted)]">{d === undefined ? "" : d === Infinity ? "no route" : metres(d)}</span>
                <button
                  type="button"
                  className="chip shrink-0 opacity-70 group-hover:opacity-100"
                  title="Jump there (Shift+Enter)"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(poi, true);
                  }}
                >
                  Jump
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--line)] px-4 py-2 text-[11px] text-[var(--muted)]">
          <span>
            <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> choose
          </span>
          <span>
            <kbd className="kbd">Enter</kbd> show the way
          </span>
          <span>
            <kbd className="kbd">Shift</kbd>+<kbd className="kbd">Enter</kbd> jump there
          </span>
        </div>
      </div>
    </div>
  );
}

/** Details of the clicked or searched place, with the two ways to get there. */
export function PoiCard() {
  const poi = useApp((s) => s.pois.find((p) => p.id === s.selectedPoiId) ?? null);
  const navigating = useApp((s) => !!s.nav && s.nav.poiId === s.selectedPoiId);
  const navReady = useApp((s) => s.navReady);
  const pose = useApp((s) => s.pose);
  const distance = useMemo(() => {
    if (!poi || !navReady) return null;
    const r = routeToPoi(poi);
    return r ? (r.complete ? r.length : Infinity) : null;
    // Recomputed as the visitor moves (pose updates ten times a second).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poi, navReady, Math.round(pose.x * 2), Math.round(pose.z * 2)]);

  if (!poi || navigating) return null;
  const cat = CATEGORIES[poi.category];
  return (
    <section className="panel pointer-events-auto w-[min(22rem,calc(100vw-24px))] overflow-hidden p-0" aria-label={`${poi.name} details`}>
      <div className="h-1" style={{ background: cat.color }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow" style={{ color: cat.color }}>
              {cat.label}
            </p>
            <h2 className="display mt-0.5 truncate text-[20px] leading-tight">{poi.name}</h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close (Esc)" title="Close (Esc)" onClick={() => selectPoi(null)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {poi.description && <p className="mt-2 text-[13px] text-[var(--muted)]">{poi.description}</p>}
        {distance !== null && (
          <p className="mono mt-2 text-[12px]">
            {distance === Infinity ? "No walkable route from here" : `${metres(distance)} walk · about ${etaLabel(distance)}`}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="btn-primary" onClick={() => startNavigation(poi.id)} disabled={!navReady}>
            Show the way <kbd className="kbd-inv">Enter</kbd>
          </button>
          <button type="button" className="btn-secondary" onClick={() => jumpToPoi(poi.id)} disabled={!navReady}>
            Jump there <kbd className="kbd">J</kbd>
          </button>
        </div>
      </div>
    </section>
  );
}

function TurnIcon({ turn }: { turn: Turn }) {
  const rot: Record<Turn, number> = { straight: 0, "slight-left": -40, left: -90, "sharp-left": -135, "slight-right": 40, right: 90, "sharp-right": 135, arrive: 0 };
  if (turn === "arrive")
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: `rotate(${rot[turn]}deg)` }}>
      <path d="M12 20V5M6 11l6-6 6 6" />
    </svg>
  );
}

/** Turn-by-turn panel while navigating: next instruction, distance and time left, auto-walk. */
export function NavPanel() {
  const nav = useApp((s) => s.nav);
  const poi = useApp((s) => s.pois.find((p) => p.id === s.nav?.poiId) ?? null);
  if (!nav || !poi) return null;
  const step = nav.instruction;
  return (
    <section className="panel pointer-events-auto w-[min(26rem,calc(100vw-24px))] p-0" aria-live="polite" aria-label="Navigation">
      <div className={`flex items-center gap-3 rounded-t-[inherit] px-4 py-3 text-white ${nav.arrived ? "bg-[#b07a12]" : "bg-[var(--route)]"}`}>
        <TurnIcon turn={nav.arrived ? "arrive" : step.turn} />
        <div className="min-w-0">
          <div className="display truncate text-[18px] leading-tight">
            {!nav.arrived ? step.text : nav.reachable ? `You've arrived at ${poi.name}` : `As close as you can walk to ${poi.name}`}
          </div>
          {!nav.arrived && (
            <div className="truncate text-[12px] opacity-85">
              to {poi.name}
              {!nav.reachable && " · route ends at the closest reachable spot"}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5">
        {!nav.arrived ? (
          <>
            <span className="mono text-[13px] font-semibold">{metres(nav.remaining)}</span>
            <span className="mono text-[12px] text-[var(--muted)]">· {etaLabel(nav.remaining)}</span>
            <button type="button" className={`chip ml-auto ${nav.autoWalk ? "chip-on" : ""}`} onClick={() => setAutoWalk(!nav.autoWalk)} aria-pressed={nav.autoWalk} title="Walk me there (G)">
              {nav.autoWalk ? "Walking you there…" : "Walk me there"} <kbd className="kbd">G</kbd>
            </button>
          </>
        ) : (
          <span className="text-[12px] text-[var(--muted)]">Search again with Ctrl+K</span>
        )}
        <button type="button" className={`chip ${nav.arrived ? "ml-auto" : ""}`} onClick={stopNavigation} title="Stop (Esc)">
          {nav.arrived ? "Done" : "Stop"}
        </button>
      </div>
    </section>
  );
}
