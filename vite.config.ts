import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const TYPES: Record<string, string> = {
  ".json": "application/json",
  ".gltf": "model/gltf+json",
  ".glb": "model/gltf-binary",
  ".spz": "application/octet-stream",
  ".ply": "application/octet-stream",
};

const BASE = "/experience/";

/** Dev only: serves test/venues/<id>/ at <base>venues/<id>/ when public/ has no such venue. */
function testVenues(): Plugin {
  const root = resolve("test/venues");
  return {
    name: "namma-test-venues",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let url = decodeURIComponent((req.url ?? "").split("?")[0]);
        if (url.startsWith(BASE)) url = url.slice(BASE.length - 1);
        if (!url.startsWith("/venues/") || existsSync(join(resolve("public"), url))) return next();
        const file = normalize(join(root, url.slice("/venues/".length)));
        if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  // The parent landing site serves the production viewer at /experience/.
  base: BASE,
  plugins: [react(), tailwindcss(), testVenues()],
  build: { outDir: "landing/experience", emptyOutDir: true },
  // Spark ships its own WASM worker; keep it out of dependency pre-bundling.
  optimizeDeps: { exclude: ["@sparkjsdev/spark"] },
  server: { host: true },
});
