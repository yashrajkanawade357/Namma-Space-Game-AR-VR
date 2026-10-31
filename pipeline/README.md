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
2. **Clean the mesh**: weld, simplify and shrink textures into one `.glb`:

   ```bash
   node pipeline/clean-mesh.mjs captures/home/model.glb public/venues/home/room.glb --triangles 120000 --texture 4096
   ```

   On the first RealityScan room this took 388k triangles / 25 MB (8K textures) down to 120k / 9 MB in about a second.
   It also drops small floating pieces of mesh (`--debris 0.005` = under 0.5% of all triangles; `0` keeps everything).
3. **Align and scale** with the alignment tool at `/align.html?venue=home`: Auto-level (or Flip) until the
   floor is down, click two points of a known length (a door is about 2.0–2.1 m) and set the scale, then
   copy the printed transform into `venue.json`. Phone scans (ARCore/ARKit) are usually already in metres.
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

## Point-cloud scans

If a scan was only exported as a coloured point cloud (Scaniverse `.ply` with x y z + red green blue), build a
venue from it directly:

```bash
node pipeline/points-to-venue.mjs "captures/hostel/scan.ply" public/venues/hostel --name "Hostel room" --z-up
```

It levels and centres the cloud, generates the collision model from it (a floor plus a column for every
10 cm cell where points sit at body height, so walls, beds and tables block you), and picks a start point
facing across the room. A mesh or splat export of the same scan still looks better; use this when that is
all there is.

## Time each step

The finale (Dec 16) is a timed on-site capture. Log how long every step takes on each practice run in
[`docs/SOP.md`](../docs/SOP.md) so we know where the minutes go.
