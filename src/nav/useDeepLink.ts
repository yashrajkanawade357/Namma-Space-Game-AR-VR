import { useEffect, useRef } from "react";
import { useApp } from "../store";
import { startNavigation } from "./runtime";

/**
 * Shareable directions, like a maps link: opening `?poi=<id>` starts navigation to that place
 * once the visitor is walking, and the address bar follows whatever they navigate to.
 */
export function useDeepLink() {
  const handled = useRef(false);
  const view = useApp((s) => s.view);
  const navReady = useApp((s) => s.navReady);
  const pois = useApp((s) => s.pois);
  const navPoi = useApp((s) => s.nav?.poiId ?? null);

  useEffect(() => {
    if (handled.current || !navReady || view !== "walk" || !pois.length) return;
    handled.current = true;
    const id = new URLSearchParams(window.location.search).get("poi");
    if (id && pois.some((p) => p.id === id)) startNavigation(id);
  }, [view, navReady, pois]);

  useEffect(() => {
    if (!handled.current) return;
    const url = new URL(window.location.href);
    if (navPoi) url.searchParams.set("poi", navPoi);
    else url.searchParams.delete("poi");
    window.history.replaceState(null, "", url);
  }, [navPoi]);
}
