// MapLibre v10+ does not require an access token — no init needed.

export function initMapbox() {}

/** Convert {lat,lng} coords to a GeoJSON bounding box [NE, SW] */
export function boundsFromCoords(coords: { latitude: number; longitude: number }[]) {
  const lngs = coords.map(c => c.longitude);
  const lats  = coords.map(c => c.latitude);
  return {
    ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
    sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
  };
}

/** Approximate a circle as a closed GeoJSON polygon (for FillLayer radius overlays) */
export function circlePolygon(
  lat: number,
  lng: number,
  radiusMeters: number,
  steps = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dlat  = (radiusMeters / 111320) * Math.cos(angle);
    const dlng  = (radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
    coords.push([lng + dlng, lat + dlat]);
  }
  return {
    type:       'Feature',
    properties: {},
    geometry:   { type: 'Polygon', coordinates: [coords] },
  };
}
