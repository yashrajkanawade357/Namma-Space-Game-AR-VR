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

7. **Open** `http://localhost:5173/experience/?venue=home`.

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

## Places (pois.json)

Each venue can have `public/venues/<venue>/pois.json`. Tag it with the editor
(`/experience/?venue=<venue>&edit=1`, then **V**, **+ Add place**, click, name, **Download pois.json**) or by hand:

```json
{
  "version": 1,
  "pois": [
    {
      "id": "meeting-room-4",
      "name": "Meeting Room 4",
      "category": "room",
      "aliases": ["mr4", "conference room"],
      "description": "Seats 8, screen on the north wall",
      "position": [3.2, 0, -1.5],
      "zone": [[1, -4], [5, -4], [5, -0.2], [1, -0.2]]
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `id` | Lowercase slug; used in links (`?poi=meeting-room-4`) |
| `name` | What visitors see and search for |
| `category` | `room`, `seating`, `desk`, `facility`, `storage`, `exit`, `info` or `item` (sets the colour) |
| `aliases` | Other words people search with; fuzzy search also forgives typos |
| `position` | Where the label sits, in venue metres (+Y up, floor at 0). Routes end on the floor beside it |
| `zone` | Optional floor outline, `[x, z]` corners. Clicking anywhere inside reveals the place; it lights up when selected |

`npm run check:venue` validates the file; the viewer refuses a broken one with a readable error.

## Make it routable

Routes are computed on a navigation mesh built from the venue's collision mesh when it loads (about 0.1 s for
a 200k-triangle room). Turn on *Settings → Show walkable area* to see it. Phone scans sometimes break the floor
into pieces: a shiny floor scanned as a hump, or a strip of floor the phone never saw behind a desk. Two
`venue.json` fields repair that for walking and routing without touching what visitors see:

```json
"walkableFloor": [
  { "position": [-1.1, -0.05, 0.53], "size": [7.0, 1.05] }
],
"cleanup": [
  { "zone": [[-4.6, 0.0], [2.4, 0.0], [2.4, 1.05], [-4.6, 1.05]], "below": 0.95 }
]
```

- `walkableFloor`: invisible floor slabs (one or a list); the top sits 5 cm above `position`.
- `cleanup`: inside each outline, scan triangles entirely below `below` metres are ignored (floor humps,
  stretched triangles across an aisle, a bag left on the floor). Use it with a floor patch when the
  artifact *was* the floor.

The classroom venue uses both. `npm test` then proves every tagged place is reachable from the start point
(`src/nav/scans.test.ts`); add your venue's id to the list there.

## Time each step

The finale (Dec 16) is a timed on-site capture. Log how long every step takes on each practice run in
[`docs/SOP.md`](../docs/SOP.md) so we know where the minutes go.
