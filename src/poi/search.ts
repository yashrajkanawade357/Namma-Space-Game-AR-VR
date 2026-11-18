import Fuse from "fuse.js";
import { CATEGORIES, type Poi } from "./types";

export interface SearchHit {
  poi: Poi;
  /** 0 = perfect match, 1 = barely related (Fuse score). */
  score: number;
}

/**
 * Fuzzy search over names, aliases, categories and descriptions, so "metting room", "loo"
 * (an alias) or "seating" all find something. Typos within a couple of letters still match.
 */
export function createSearch(pois: Poi[]) {
  const docs = pois.map((poi) => ({ poi, category: CATEGORIES[poi.category].label }));
  const fuse = new Fuse(docs, {
    keys: [
      { name: "poi.name", weight: 3 },
      { name: "poi.aliases", weight: 2 },
      { name: "category", weight: 1 },
      { name: "poi.description", weight: 0.5 },
    ],
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.38,
    minMatchCharLength: 2,
  });
  return (query: string, limit = 8): SearchHit[] => {
    // "Where is the TV?" and "take me to the nearest sofa" mean "tv" and "sofa".
    const q = query
      .trim()
      .replace(/[?!.]+$/, "")
      .replace(/^(where is|where's|where are|take me to|go to|show me|find|navigate to)\s+/i, "")
      .replace(/^(the|a|an|my)\s+/i, "")
      .replace(/^(nearest|closest)\s+/i, "");
    if (!q) return pois.slice(0, limit).map((poi) => ({ poi, score: 0 }));
    return fuse.search(q, { limit }).map((r) => ({ poi: r.item.poi, score: r.score ?? 0 }));
  };
}
