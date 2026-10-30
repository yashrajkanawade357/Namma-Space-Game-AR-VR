const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const venues = path.join(root, '..', 'public', 'venues');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.spz': 'application/octet-stream',
  '.wasm': 'application/wasm',
};

function contained(base, candidate) {
  const relative = path.relative(base, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  let base = root;
  let relative = pathname === '/' ? 'index.html' : pathname.slice(1);

  const venuePrefix = pathname.startsWith('/experience/venues/')
    ? '/experience/venues/'
    : pathname.startsWith('/venues/')
      ? '/venues/'
      : null;
  if (venuePrefix) {
    base = venues;
    relative = pathname.slice(venuePrefix.length);
  }

  let file = path.resolve(base, relative);
  if (!contained(base, file)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!contained(base, file) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': types[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': path.extname(file) === '.html' || path.basename(file) === 'venue.json' ? 'no-cache' : 'public, max-age=3600',
  });
  fs.createReadStream(file).pipe(res);
}).listen(Number(process.env.PORT) || 4173, '0.0.0.0', () => {
  const port = Number(process.env.PORT) || 4173;
  console.log(`Namma Space running at http://localhost:${port}`);
});
