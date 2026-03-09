/**
 * Offline Map Tile Cache
 * 
 * Caches OpenStreetMap tiles locally so maps work offline.
 * - Converts lat/lng to tile coordinates
 * - Pre-downloads tiles in a radius around a location
 * - Serves cached tiles when offline
 * 
 * Uses the new expo-file-system v19+ class-based API.
 */

import { File, Directory, Paths } from 'expo-file-system';

const TILE_DIR = new Directory(Paths.document, 'map_tiles');
const TILE_URL = (z: number, x: number, y: number) =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

/**
 * Convert lat/lng to OpenStreetMap tile coordinates at a given zoom level.
 */
function latLngToTile(lat: number, lng: number, zoom: number) {
  const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  const y = Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
      Math.pow(2, zoom)
  );
  return { x, y };
}

/**
 * Ensure the tile cache directory exists.
 */
function ensureTileDir(): void {
  if (!TILE_DIR.exists) {
    TILE_DIR.create({ intermediates: true });
  }
}

/**
 * Pre-download map tiles around a location for offline use.
 * 
 * @param lat - Center latitude
 * @param lng - Center longitude
 * @param radiusTiles - How many tiles around the center to cache (default: 2 = 5x5 grid)
 * @param zoom - Zoom level (default: 14, good for city navigation)
 */
export async function cacheAreaOffline(
  lat: number,
  lng: number,
  radiusTiles = 2,
  zoom = 14
): Promise<void> {
  ensureTileDir();
  const center = latLngToTile(lat, lng, zoom);

  const downloads: Promise<void>[] = [];

  for (let dx = -radiusTiles; dx <= radiusTiles; dx++) {
    for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
      const x = center.x + dx;
      const y = center.y + dy;
      const tileFile = new File(TILE_DIR, `${zoom}_${x}_${y}.png`);

      downloads.push(
        File.downloadFileAsync(TILE_URL(zoom, x, y), tileFile, { idempotent: true }).then(() => {})
      );
    }
  }

  await Promise.all(downloads);
  console.log('Offline tiles cached successfully');
}

/**
 * Get a cached tile URI if it exists locally.
 * Returns null if the tile hasn't been cached yet.
 */
export function getOfflineTilePath(
  z: number,
  x: number,
  y: number
): string | null {
  const tileFile = new File(TILE_DIR, `${z}_${x}_${y}.png`);
  return tileFile.exists ? tileFile.uri : null;
}
