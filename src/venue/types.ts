export type Vec3 = [number, number, number];

/**
 * One captured space. Everything about a venue lives in data, so mapping a new
 * building means producing a new venues/<id>/ folder, not changing code.
 * Units are metres, +Y is up, the floor sits at y = 0.
 */
export interface VenueConfig {
  id: string;
  name: string;
  /** Short line shown under the name, e.g. "Ground floor, 2BHK". */
  subtitle?: string;
  /** Photoreal layer. Optional so a venue can be walked with only a mesh while the splat is training. */
  splat?: {
    url: string;
    position?: Vec3;
    /** Euler angles in degrees, applied XYZ. Most phone splats need [180, 0, 0]. */
    rotation?: Vec3;
    scale?: number;
  };
  /**
   * Hidden mesh used for collision, floor detection and the minimap.
   * "demo" builds the procedural demo layout instead of loading a file.
   */
  collider: {
    url: string | "demo";
    /** Same mesh with a sharper texture, loaded on desktops instead of `url`. */
    hiResUrl?: string;
    /**
     * "baked" (default for scans) shows the texture as captured, since the real lighting is
     * already in it; "lit" shades the mesh with scene lights.
     */
    shading?: "baked" | "lit";
    position?: Vec3;
    rotation?: Vec3;
    scale?: number;
  };
  /** Optional hidden floor patch for scans whose mesh has gaps underfoot. */
  walkableFloor?: {
    /** Center of the floor patch in venue coordinates. */
    position: Vec3;
    /** Width and depth in metres. */
    size: [number, number];
  };
  spawn: {
    position: Vec3;
    /** Facing direction in degrees, 0 = looking towards -Z. */
    yaw?: number;
  };
  /** Camera height above the floor while walking. Defaults to 1.6 m. */
  eyeHeight?: number;
  /** Credits for the capture tools used, shown in the info panel. */
  credits?: string[];
}
