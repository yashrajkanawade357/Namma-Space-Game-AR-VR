#!/usr/bin/env bash
# Converts a trained/exported splat (.ply) into a compact .spz for the web viewer.
# Usage: pipeline/compress-splat.sh captures/home/scan.ply public/venues/home/scene.spz
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $0 <input.ply> <output.spz>" >&2
  exit 1
fi

in="$1"
out="$2"
mkdir -p "$(dirname "$out")"

# splat-transform (PlayCanvas) reads .ply and writes .spz; it runs through npx, no install needed.
npx --yes @playcanvas/splat-transform "$in" "$out"

in_mb=$(du -m "$in" | cut -f1)
out_mb=$(du -m "$out" | cut -f1)
echo "Wrote $out (${in_mb} MB -> ${out_mb} MB)"
