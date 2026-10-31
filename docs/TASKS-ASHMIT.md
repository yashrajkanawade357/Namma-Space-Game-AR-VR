# Software tasks: Ashmit

Owner: **Ashmit** (web app and software). Harshit now owns scanning and the 3D model files;
Yashraj owns the abstract, video and submission.

**Round 1 is due Oct 31.** Section A must be finished by **Oct 30 night**. Section B can wait until
after the submission.

## Get set up (15 min)

```bash
git clone https://github.com/yashrajkanawade357/Namma-Space-Game-AR-VR.git
cd Namma-Space-Game-AR-VR
npm install
npm run dev
```

Open these to see what already works:

| URL | What it is |
| --- | --- |
| `http://localhost:5173/experience/` | Demo flat: WASD walking, collision, minimap, settings |
| `http://localhost:5173/experience/?venue=sample` | Small test mesh from `test/venues/sample` |
| `http://localhost:5173/experience/align.html?venue=<id>` | Alignment tool for a raw scan (rotate, level, measure, prints the venue.json transform) |

Read first: [`README.md`](../README.md) and [`pipeline/README.md`](../pipeline/README.md).
How a venue works: each space is a folder `public/venues/<id>/` with `venue.json` plus its files.
No code changes are needed to add a new venue.

---

## A. Round 1: must be done by Oct 30 night

### A1. Deploy to Vercel (highest priority)
- [ ] Import the GitHub repo on [vercel.com](https://vercel.com) → framework **Vite**, build `npm run build`, output `dist`.
- [ ] Check the live link opens the demo flat and WASD walking works.
- [ ] Send the live URL to the team group.

**Done when:** a public HTTPS link works on a laptop and on an Android phone.

### A2. Host the scan files
Splats and meshes are 20–100 MB, too big for git.
- [ ] Easiest for Round 1: put the venue folder in `public/venues/<id>/` **only on the deploy** (or commit it if under ~50 MB total).
- [ ] Better: create a **Cloudflare R2** bucket (free tier) with public access and CORS allowing `GET` from our Vercel domain.
  Upload the venue folder, then set the Vercel env var `VITE_VENUE_BASE=https://<bucket-url>/venues` and redeploy.

**Done when:** `https://<our-site>/?venue=<id>` loads the scan from the live site.

### A3. Mesh clean-up script: `pipeline/clean-mesh.sh`
The first RealityScan export was 388k triangles with grey filler where the camera saw nothing.
- [ ] Write a script using [`@gltf-transform/cli`](https://gltf-transform.dev/cli) via `npx` that:
      welds vertices, simplifies to about **50k triangles** (`simplify --ratio`), and writes `collider.glb`.
- [ ] Optional: drop large untextured triangles (the grey filler).
- [ ] Document it in `pipeline/README.md`.

**Done when:** `pipeline/clean-mesh.sh captures/home/model.glb public/venues/home/collider.glb` produces a
file under ~5 MB that still walks correctly.

### A4. Load Harshit's new scan (as soon as he sends it)
He will send a **splat `.ply`** and a **mesh `.glb`** from the same scan, plus one real measurement.
- [ ] Compress the splat: `pipeline/compress-splat.sh scan.ply public/venues/home/scene.spz`.
      **This script has not been tested on a real scan yet.** If `splat-transform` can't write `.spz`, try
      exporting `.spz` straight from Scaniverse, or use the `.ply` (Spark loads it, just bigger).
- [ ] Clean the mesh with A3 → `collider.glb`.
- [ ] Write `public/venues/home/venue.json` (copy `test/venues/sample/venue.json`).
- [ ] Open `/align.html?venue=home`, use **Auto-level** / **Flip** until the floor is down, measure the known
      length and **Set scale**, then copy the transform into `venue.json`.
- [ ] Line the splat up with the mesh: in the viewer, *Settings → Show collision mesh*, adjust `splat.rotation`
      / `splat.position` until they overlap. Most phone splats need `"rotation": [180, 0, 0]`.
- [ ] Pick a good `spawn` point (entrance, facing into the room).
- [ ] `npm run check:venue -- public/venues/home` must pass.

**Done when:** walking through the new scan looks right and you can't walk through walls.

### A5. Make the real scan the default
- [ ] In `src/venue/loadVenue.ts`, change `DEFAULT_VENUE` from `"demo"` to `"home"` so the main link opens the real scan.
- [ ] Keep the demo reachable at `?venue=demo`.

### A6. Speed and browser check
- [ ] Test on Chrome, Edge, Firefox (laptop) and Chrome on Android. Note FPS (shown bottom-left).
- [ ] If it's slow: Settings → Quality "Low" should help; if not, lower the splat size when compressing.
- [ ] The JS bundle is ~1.3 MB gzipped, mostly Spark. Optional: load Spark with a dynamic `import()` only
      when a venue has a splat.

**Done when:** at least 30 FPS on a normal laptop; the phone works, even if slower.

### A7. Repo ready for judges
The brief asks for setup instructions plus sample data in a test directory.
- [ ] Add a trimmed copy of the home scan to `test/venues/home-small/` (crop the splat under ~20 MB).
- [ ] Update `README.md`: live link at the top, scan screenshots, how to rebuild the model.
- [ ] Tag the submission: `git tag round-1 && git push --tags`.

---

## B. After Oct 31: Round 2 (due Nov 30)

Start only after Round 1 is submitted.

| # | Task | Notes |
| --- | --- | --- |
| B1 | **Navmesh** with [recast-navigation-js](https://github.com/isaac-mason/recast-navigation-js) from the collider mesh | Hardest Round 2 piece; try it on the demo flat first |
| B2 | **Path drawing**: animated floor arrows from player to target | Shortest path from B1 |
| B3 | **POIs**: `pois.json` per venue (name, category, position), labels in 3D, admin "click to place" mode | Harshit tags the real POIs |
| B4 | **Search**: Ctrl+K palette with Fuse.js fuzzy search, fly-to transition, "Navigate" button | |
| B5 | **Overview camera**: top-down dollhouse view toggle | |
| B6 | **AR test** (from Nov 17): WebXR `immersive-ar` + hit-test on Android, QR code to set the start position | Needs HTTPS, so A1 first |
| B7 | **Draco / Meshopt** support in `GLTFLoader` | Only needed if we compress meshes |

## Ask Yashraj if stuck

Key files: `src/scene/VenueScene.tsx` (loading), `src/scene/Player.tsx` (walking and collision),
`src/scene/collider.ts` (collision mesh and minimap slice), `src/align/main.ts` (alignment tool).
