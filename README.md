# Namma Space

Turn ordinary phone captures of an indoor space into a photorealistic 3D digital twin you can walk
through in the browser, search, and navigate, with AR guidance on site.
Built for **Namma Space, Techfest 2026-27, IIT Bombay**.

| Round | Scope | Status |
| --- | --- | --- |
| 1 | Capture SOP, 3D reconstruction, free-roam web viewer | In progress |
| 2 | POI labels, search, obstacle-aware desktop navigation | Planned |
| 3 | On-site capture at IIT Bombay, AR navigation (bonus) | Planned |

## How it works

```
Phone capture (SOP) ─► splat (.spz) + scan mesh (.glb) ─► venues/<id>/ ─► web viewer
                         looks                 walking      data only      WASD, collision, minimap
```

- **Splat for looks.** A Gaussian splat rendered with [Spark](https://sparkjs.dev) gives the photoreal view.
- **Mesh for walking.** A decimated mesh from the same scan stays hidden. The visitor is a capsule pushed
  out of its triangles with [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh), so they slide
  along walls and stay on the floor. The same mesh is sliced into the minimap's floor plan, and will
  feed the navmesh in Round 2.
- **Venues are data.** Each space is a folder with `venue.json`, so a new building needs no code changes.

## Run it

Needs Node 20 or newer.

```bash
npm install
npm run dev
```

Then open:

- `http://localhost:5173/` — demo flat (procedural layout for development, labelled as a demo)
- `http://localhost:5173/?venue=sample` — sample mesh from [`test/venues/sample`](test/venues/sample)
- `http://localhost:5173/?venue=<id>` — any venue in `public/venues/<id>/`

**Controls:** `W A S D` walk · mouse look (click the view) · `Shift` faster · `R` back to start ·
`H` controls · `Esc` free the mouse. On phones: joystick to move, drag to look.

## Add a scanned venue

Follow the capture SOP in [`docs/SOP.md`](docs/SOP.md), then the steps in
[`pipeline/README.md`](pipeline/README.md). In short:

```bash
pipeline/compress-splat.sh captures/home/scan.ply public/venues/home/scene.spz
# export the decimated mesh to public/venues/home/collider.glb and write venue.json
npm run check:venue -- public/venues/home
```

## Project layout

```
src/
  App.tsx              canvas, HUD layout
  scene/VenueScene.tsx loads splat + collision mesh for a venue
  scene/Player.tsx     first-person capsule walker
  scene/collider.ts    BVH collider and floor-plan slicing
  scene/demoLayout.ts  procedural demo flat
  ui/                  top bar, settings, controls overlay, minimap, joystick
  venue/               venue.json types and loading
public/venues/         deployable venues
pipeline/              capture-to-venue scripts and steps
test/venues/           sample data for checking the pipeline
docs/SOP.md            capture procedure and timing log
```

## Built with

React, Vite, TypeScript, three.js, React Three Fiber, Spark, three-mesh-bvh, zustand and Tailwind CSS.
Capture tools: Scaniverse / Polycam, Blender, CloudCompare, SuperSplat.

## Team

Yashraj Kanawade · Ashmit · Harshit
