import MapboxGL from '@rnmapbox/maps';

let initialized = false;

export function initMapbox() {
  if (initialized) return;
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
  MapboxGL.setAccessToken(token);
  initialized = true;
}

// Mapbox uses [longitude, latitude] — opposite of react-native-maps
export function toLngLat(lat: number, lng: number): [number, number] {
  return [lng, lat];
}

export function boundsFromCoords(coords: [number, number][]): {
  ne: [number, number];
  sw: [number, number];
} {
  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  return {
    ne: [Math.max(...lngs), Math.max(...lats)],
    sw: [Math.min(...lngs), Math.min(...lats)],
  };
}

// Approximate real-world-radius circle as a GeoJSON polygon
export function circlePolygon(
  lng: number,
  lat: number,
  radiusMeters: number,
  steps = 48,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dx = (radiusMeters * Math.cos(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));
    const dy = (radiusMeters * Math.sin(angle)) / 110540;
    coords.push([lng + dx, lat + dy]);
  }
  coords.push(coords[0]);
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
    properties: {},
  };
}
