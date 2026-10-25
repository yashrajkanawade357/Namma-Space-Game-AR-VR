# Capture-to-venue pipeline

Turns a phone capture into a folder the web viewer can load. A venue is only data,
so mapping a new building never needs code changes.

```
captures/<venue>/          raw phone exports (not committed)
  scan.ply                 Gaussian splat from Scaniverse / Polycam / Postshot
  mesh.glb                 mesh from the same scan
        │
        ▼  steps below
public/venues/<venue>/     what gets deployed
  venue.json               names, transforms, spawn point
  scene.spz                compressed splat (what visitors see)
  collider.glb             decimated mesh (what visitors bump into)
```

## Steps

1. **Capture** by the SOP in [`docs/SOP.md`](../docs/SOP.md). Export the splat as `.ply` and the mesh as `.glb`
   from the same scan, so both share one coordinate frame.
2. **Align and scale** in Blender: floor on y = 0, +Y up, units in metres. Check one known length
   (a door is about 2.0–2.1 m tall). If the splat and mesh came from different tools, align them in
   CloudCompare with 3–4 matching points first.
3. **Clean the mesh**: Decimate to about 50k triangles, delete the ceiling if it is noisy, export `collider.glb`.
4. **Compress the splat**: crop floaters in [SuperSplat](https://superspl.at/editor), then

   ```bash
   pipeline/compress-splat.sh captures/home/scan.ply public/venues/home/scene.spz
   ```

5. **Write `venue.json`** (copy [`test/venues/sample/venue.json`](../test/venues/sample/venue.json)). Most phone
   splats need `"rotation": [180, 0, 0]`; tweak until the splat sits on the collider (turn on
   *Settings → Show collision mesh* to compare).
6. **Validate**:

   ```bash
   npm run check:venue -- public/venues/home
   ```

7. **Open** `http://localhost:5173/?venue=home`.

For deployment, large files can live on Cloudflare R2 instead of the repo: upload the folder and set
`VITE_VENUE_BASE` to the bucket's public URL.

## Time each step

The finale (Dec 16) is a timed on-site capture. Log how long every step takes on each practice run in
[`docs/SOP.md`](../docs/SOP.md) so we know where the minutes go.
