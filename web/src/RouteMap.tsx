import { useEffect, useRef, useState } from 'react';
import { Map as MapLibre, LngLatBounds, NavigationControl, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre finds its worker next to its own file by default, which a bundle
// breaks. Vite builds the worker (and the code it imports) as its own file.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { legGeometry, legStops } from '@engine/services/routeGeometry';
import { MAPTILER_KEY } from '@engine/utils/constants';
import type { RouteOption } from '@engine/services/smartRoutingService';

setWorkerUrl(workerUrl);

/**
 * The route on a map, for the rider who wants to see where the bus goes.
 * Loaded only once a route is on screen, so the page itself stays light.
 *
 * Tiles come from OpenFreeMap: free, no key, no limit on views. It is run on
 * donations with no promise it stays up, so if its style fails to load the
 * map falls back to MapTiler on the key search already uses.
 *
 * Lines are the same stop-to-stop chains the app draws (routeGeometry.ts):
 * honest about what we know of the danfo's road, not a car's road from a
 * directions API.
 */

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const maptilerStyle = (key: string) => `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${key}`;

/** Lagos, for the moment before the route is fitted. */
const LAGOS: [number, number] = [3.3792, 6.5244];

type LngLat = [number, number];

/** A mode's colour from the stylesheet, so the map and the chips agree. */
function cssColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return v || fallback;
}

/** The option as GeoJSON: one line per leg, a dot per stop, the two ends. */
function toGeoJSON(option: RouteOption) {
  const walkColor = cssColor('walk', '#d9d2bf');
  const lines = option.legs.map((leg) => ({
    type: 'Feature' as const,
    properties: {
      walk: leg.mode === 'walk',
      color: leg.mode === 'walk' ? walkColor : cssColor(leg.mode, '#f4efe1'),
    },
    geometry: {
      type: 'LineString' as const,
      coordinates: legGeometry(leg).map((p): LngLat => [p.longitude, p.latitude]),
    },
  }));

  const stops = option.legs.flatMap((leg) =>
    legStops(leg).map((s) => ({
      type: 'Feature' as const,
      properties: { color: cssColor(leg.mode, '#f4efe1'), name: s.name },
      geometry: { type: 'Point' as const, coordinates: [s.longitude, s.latitude] as LngLat },
    })),
  );

  const first = option.legs[0]?.from, last = option.legs[option.legs.length - 1]?.to;
  const ends = ([['start', first], ['end', last]] as const)
    .filter(([, p]) => !!p)
    .map(([role, p]) => ({
      type: 'Feature' as const,
      properties: { role },
      geometry: { type: 'Point' as const, coordinates: [p!.longitude, p!.latitude] as LngLat },
    }));

  const bounds = new LngLatBounds();
  for (const l of lines) for (const c of l.geometry.coordinates) bounds.extend(c);

  return {
    lines: { type: 'FeatureCollection' as const, features: lines },
    points: { type: 'FeatureCollection' as const, features: [...stops, ...ends] },
    bounds,
  };
}

/** Adds the route's sources and layers to whatever style is loaded. */
function drawRoute(map: MapLibre, option: RouteOption) {
  const { lines, points } = toGeoJSON(option);
  const ink = cssColor('ink', '#0b0f0c');

  const lineSrc = map.getSource('route-lines') as GeoJSONSource | undefined;
  if (lineSrc) {
    lineSrc.setData(lines);
    (map.getSource('route-points') as GeoJSONSource).setData(points);
    return;
  }

  map.addSource('route-lines', { type: 'geojson', data: lines });
  map.addSource('route-points', { type: 'geojson', data: points });

  const round = { 'line-cap': 'round', 'line-join': 'round' } as const;

  // A dark edge under each ride, so yellow and teal hold up on any tile.
  map.addLayer({
    id: 'route-casing', type: 'line', source: 'route-lines', filter: ['!', ['get', 'walk']], layout: round,
    paint: { 'line-color': ink, 'line-width': 9 },
  });
  map.addLayer({
    id: 'route-ride', type: 'line', source: 'route-lines', filter: ['!', ['get', 'walk']], layout: round,
    paint: { 'line-color': ['get', 'color'], 'line-width': 5 },
  });
  map.addLayer({
    id: 'route-walk', type: 'line', source: 'route-lines', filter: ['get', 'walk'], layout: round,
    paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [0.1, 2] },
  });
  map.addLayer({
    id: 'route-stops', type: 'circle', source: 'route-points', filter: ['has', 'name'],
    paint: {
      'circle-radius': 3.5, 'circle-color': ink,
      'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: 'route-ends', type: 'circle', source: 'route-points', filter: ['has', 'role'],
    paint: {
      'circle-radius': 7,
      'circle-color': ['match', ['get', 'role'], 'start', cssColor('green', '#2fa867'), cssColor('danfo', '#f5c518')],
      'circle-stroke-color': ink, 'circle-stroke-width': 3,
    },
  });
}

function fit(map: MapLibre, option: RouteOption, animate: boolean) {
  const { bounds } = toGeoJSON(option);
  if (bounds.isEmpty()) return;
  // Extra room on the right, where the zoom buttons sit.
  map.fitBounds(bounds, { padding: { top: 28, bottom: 28, left: 28, right: 56 }, maxZoom: 15, animate });
}

export default function RouteMap({ option, label }: { option: RouteOption; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  // The style can reload (the fallback swap), and each load needs the route
  // drawn again — always the route on screen now, not the one at mount.
  const current = useRef(option);
  current.current = option;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    let map: MapLibre;
    try {
      map = new MapLibre({
        container: box.current,
        style: OPENFREEMAP_STYLE,
        center: LAGOS,
        zoom: 10,
        attributionControl: { compact: true },
        // On a page that scrolls, one finger scrolls the page; two move the map.
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch {
      // No WebGL (old phone, locked-down browser). The directions are the
      // product; the map is a bonus, so it quietly steps aside.
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    let loaded = false, fellBack = false;
    map.on('style.load', () => {
      loaded = true;
      drawRoute(map, current.current);
    });
    map.once('load', () => {
      // On a narrow map the credit opens across the bottom third and hides
      // the start of the route. It stays one tap away behind its ⓘ.
      const attrib = box.current?.querySelector('.maplibregl-ctrl-attrib');
      attrib?.classList.remove('maplibregl-compact-show');
      attrib?.removeAttribute('open');
      fit(map, current.current, false);
    });
    map.on('error', () => {
      // Only a style that never loaded is worth acting on; a stray tile
      // failing mid-pan is not.
      if (loaded) return;
      if (!fellBack && MAPTILER_KEY) {
        fellBack = true;
        map.setStyle(maptilerStyle(MAPTILER_KEY));
      } else {
        setFailed(true);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Another route picked: redraw and refit the same map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    drawRoute(map, option);
    fit(map, option, true);
  }, [option]);

  if (failed) return null;
  return <div className="route-map" ref={box} role="region" aria-label={label} />;
}
