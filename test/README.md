# Test data

Sample venues for checking the pipeline and viewer without a fresh capture.
In development, every folder in `test/venues/` is served at `/venues/<id>/`, so
`http://localhost:5173/?venue=sample` opens the sample below.

| Venue | What it has | What it tests |
| --- | --- | --- |
| `sample` | `collider.gltf` (generated L-shaped room), no splat | Loading a mesh from a file, collision, minimap |

```bash
node pipeline/make-sample.mjs              # regenerate the sample mesh
npm run check:venue -- test/venues/sample  # validate it
```

When the first home scan is processed, add a trimmed copy here (`test/venues/home-small/` with a
cropped `scene.spz` under 20 MB and its `collider.glb`) so judges can rebuild the model from the repo.
