import type { VenueConfig } from "./types";

/** The venue the bare URL opens. Deployments set VITE_DEFAULT_VENUE to their scanned space. */
export const DEFAULT_VENUE = (import.meta.env.VITE_DEFAULT_VENUE as string | undefined) || "demo";

/** Reads ?venue=<id> from the URL, falling back to the demo venue. */
export function venueIdFromUrl(): string {
  const id = new URLSearchParams(window.location.search).get("venue");
  return id && /^[a-z0-9-_]+$/i.test(id) ? id : DEFAULT_VENUE;
}

/** Venue folders live in public/venues/<id>/, or on remote storage via VITE_VENUE_BASE. */
export function venueBase(id: string): string {
  const remote = import.meta.env.VITE_VENUE_BASE as string | undefined;
  return `${remote ? remote.replace(/\/$/, "") : "/venues"}/${id}/`;
}

export async function loadVenue(id: string): Promise<VenueConfig> {
  const base = venueBase(id);
  const res = await fetch(`${base}venue.json`);
  if (!res.ok) throw new Error(`Couldn't find venue "${id}". Check public/venues/${id}/venue.json.`);
  const venue = (await res.json()) as VenueConfig;
  // Relative asset paths in venue.json are resolved against the venue folder.
  const resolve = (url: string) => (/^(https?:)?\/\//.test(url) || url.startsWith("/") ? url : base + url);
  if (venue.splat) venue.splat.url = resolve(venue.splat.url);
  if (venue.collider.url !== "demo") venue.collider.url = resolve(venue.collider.url);
  return venue;
}
