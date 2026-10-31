# Test data

Sample data for rebuilding a venue from a real capture, plus a small synthetic room for checking the
viewer. Run every command from the repository root after `npm install`, with `npm run dev` running for
the browser steps.

| Folder | What it is |
| --- | --- |
| [`capture/hostel/`](capture/hostel) | **Real capture**: the raw Scaniverse exports of the hostel room (the live default venue) |
| [`venues/sample/`](venues/sample) | Synthetic L-shaped test room (`pipeline/make-sample.mjs`) for checking loading and collision |

## Rebuild the hostel room from the raw capture

`capture/hostel/` holds what came off the phone, untouched:

| File | Export | Size |
| --- | --- | --- |
| `scan.glb` | Scaniverse textured mesh: 196,646 triangles, 8192 × 8192 texture, Y-up, metres | 12.5 MB |
| `points.ply` | Scaniverse coloured point cloud: 261,418 points (x y z + red green blue), Z-up | 3.9 MB |
| `venue.json` | The venue settings we use for this room (alignment transform and start point) | — |

**1. Clean the mesh** (welds vertices, removes floating debris, sizes the texture for the web):

```bash
node pipeline/clean-mesh.mjs test/capture/hostel/scan.glb public/venues/hostel-test/hostel.glb --triangles 200000 --texture 4096
```

Expected: `Debris removed 150 floating triangles`, output 196,496 triangles, 5.9 MB.

**2. Add the venue settings:**

```bash
cp test/capture/hostel/venue.json public/venues/hostel-test/venue.json
```

The transform in it came from the alignment tool. To redo it yourself, open
`http://localhost:5173/experience/align.html?venue=hostel-test`: the floor is already level (Scaniverse exports
Y-up in metres), so it only centres the room.

**3. Validate:**

```bash
npm run check:venue -- public/venues/hostel-test
```

**4. Walk it:** open `http://localhost:5173/experience/?venue=hostel-test`.

### Alternative: build it from the point cloud only

```bash
node pipeline/points-to-venue.mjs test/capture/hostel/points.ply public/venues/hostel-points-test --name "Hostel room (points)" --z-up
```

This levels the cloud, generates the collision model from the points themselves and picks a start point,
then `http://localhost:5173/experience/?venue=hostel-points-test` shows it as coloured dots.

## Synthetic test room

```bash
node pipeline/make-sample.mjs              # regenerate the sample mesh
npm run check:venue -- test/venues/sample  # validate it
```

In development, `http://localhost:5173/experience/?venue=sample` opens it (every folder in `test/venues/` is
served at `/experience/venues/<id>/`).
