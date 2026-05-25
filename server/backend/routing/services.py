"""
Lagos multimodal routing engine.
Server-side port of client/src/services/smartRoutingService.ts.
"""

import math
import uuid
from datetime import datetime, timezone
from typing import Optional

from .lagos_stops import (
    BRT_IKORODU_STOPS,
    BRT_ABULE_EGBA_STOPS,
    BLUE_LINE_STOPS,
    RED_LINE_STOPS,
    FERRY_TERMINALS,
    FERRY_ROUTES,
    DANFO_HUBS,
    ALL_STOPS,
)

# ─────────────────────────────────────────────────────────────
# HAVERSINE
# ─────────────────────────────────────────────────────────────

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _uid() -> str:
    return uuid.uuid4().hex[:9]


# ─────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────

SPEEDS = {
    'walk':  4,
    'keke':  22,
    'okada': 30,
    'danfo': 14,
    'brt':   28,
    'ferry': 25,
    'rail':  60,
    'uber':  35,
    'bolt':  35,
}


def _calc_price(dist_km: float, mode: str) -> dict:
    if mode == 'walk':
        return {'min': 0, 'max': 0}
    if mode == 'keke':
        return {'min': 300, 'max': 500} if dist_km <= 1.5 else {'min': 400, 'max': 800}
    if mode == 'okada':
        return {'min': 500, 'max': 800} if dist_km <= 2 else {'min': 700, 'max': 1500}
    if mode == 'danfo':
        if dist_km <= 3:  return {'min': 200, 'max': 400}
        if dist_km <= 8:  return {'min': 300, 'max': 500}
        if dist_km <= 15: return {'min': 400, 'max': 700}
        return {'min': 500, 'max': 900}
    if mode == 'brt':
        if dist_km <= 5:  return {'min': 300, 'max': 400}
        if dist_km <= 15: return {'min': 400, 'max': 600}
        return {'min': 600, 'max': 800}
    if mode == 'rail':
        if dist_km <= 5:  return {'min': 300, 'max': 400}
        if dist_km <= 15: return {'min': 400, 'max': 600}
        return {'min': 500, 'max': 700}
    if mode == 'ferry':
        return {'min': 1000, 'max': 1500} if dist_km <= 10 else {'min': 1500, 'max': 2500}
    if mode in ('uber', 'bolt'):
        return {'min': 1500, 'max': 2500} if dist_km <= 5 else {'min': 2000, 'max': 4000}
    return {'min': 0, 'max': 0}


def format_price(min_price: int, max_price: int) -> str:
    if min_price == 0 and max_price == 0:
        return 'Free'
    if min_price == max_price:
        return f'₦{min_price:,}'
    return f'₦{min_price:,} – ₦{max_price:,}'


def _mode_icon(mode: str) -> str:
    return {
        'walk':  'walk-outline',
        'keke':  'car-outline',
        'okada': 'bicycle-outline',
        'danfo': 'bus-outline',
        'brt':   'bus',
        'ferry': 'boat-outline',
        'rail':  'train-outline',
        'uber':  'car-sport-outline',
        'bolt':  'car-sport-outline',
    }.get(mode, 'help-outline')


# ─────────────────────────────────────────────────────────────
# OKADA BAN ZONES (Lagos State policy)
# Banned LGAs: Ikeja, Lagos Island, Lagos Mainland, Eti-Osa,
# Apapa, Surulere, Mushin, Oshodi-Isolo, Kosofe, Somolu
# Approximated as a single bounding box over the core metro area.
# ─────────────────────────────────────────────────────────────

_OKADA_BAN_ZONES = [
    (6.410, 6.650, 3.280, 3.620),
]


def _is_okada_banned(lat: float, lng: float) -> bool:
    return any(
        min_lat <= lat <= max_lat and min_lng <= lng <= max_lng
        for min_lat, max_lat, min_lng, max_lng in _OKADA_BAN_ZONES
    )


def _is_okada_allowed(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> bool:
    return not _is_okada_banned(from_lat, from_lng) and not _is_okada_banned(to_lat, to_lng)


# ─────────────────────────────────────────────────────────────
# STOP SEARCH HELPERS
# ─────────────────────────────────────────────────────────────

def _nearest_stop(lat: float, lng: float, pool: list, exclude_names: list = None) -> Optional[dict]:
    if exclude_names is None:
        exclude_names = []
    best = None
    best_dist = float('inf')
    for s in pool:
        if s['name'] in exclude_names:
            continue
        d = calculate_distance(lat, lng, s['latitude'], s['longitude'])
        if d < best_dist:
            best_dist = d
            best = s
    return best


def find_nearest_bus_stop(lat: float, lng: float) -> Optional[dict]:
    return _nearest_stop(lat, lng, ALL_STOPS)


def _stops_along_corridor(
    from_lat: float, from_lng: float,
    to_lat: float, to_lng: float,
    pool: list,
    exclude: list,
    max_count: int,
) -> list:
    total = calculate_distance(from_lat, from_lng, to_lat, to_lng)
    if total == 0:
        return []
    scored = []
    for s in pool:
        if s['name'] in exclude:
            continue
        d_a = calculate_distance(from_lat, from_lng, s['latitude'], s['longitude'])
        d_b = calculate_distance(s['latitude'], s['longitude'], to_lat, to_lng)
        ratio = (d_a + d_b) / total
        if ratio < 1.35 and d_a < total and d_b < total:
            scored.append((d_a, s))
    scored.sort(key=lambda x: x[0])
    return [s for _, s in scored[:max_count]]


# ─────────────────────────────────────────────────────────────
# INSTRUCTIONS
# ─────────────────────────────────────────────────────────────

def _lagos_instruction(mode: str, from_name: str, to_name: str) -> str:
    if mode == 'walk':  return f'Walk from {from_name} to {to_name}'
    if mode == 'keke':  return f'Take Keke NAPEP from {from_name} — tell driver \"{to_name}\"'
    if mode == 'okada': return f'Board Okada at {from_name}, ride to {to_name}'
    if mode == 'danfo': return f'Board Danfo at {from_name} heading {to_name}'
    if mode == 'brt':   return f'Enter BRT at {from_name}, alight at {to_name}'
    if mode == 'ferry': return f'Board ferry at {from_name} jetty, disembark at {to_name}'
    if mode == 'rail':  return f'Board train at {from_name} station, alight at {to_name}'
    if mode in ('uber', 'bolt'):
        return f'Take {"Uber" if mode == "uber" else "Bolt"} from {from_name} to {to_name}'
    return f'Travel from {from_name} to {to_name}'


def _lagos_pidgin_instruction(mode: str, from_name: str, to_name: str) -> str:
    if mode == 'walk':  return f'Waka from {from_name} reach {to_name}'
    if mode == 'keke':  return f'Enter keke for {from_name}, tell am make e drop you {to_name}'
    if mode == 'okada': return f'Carry okada from {from_name} go {to_name}'
    if mode == 'danfo': return f'Enter danfo for {from_name} side, tell conductor \"{to_name}!\"'
    if mode == 'brt':   return f'Enter BRT for {from_name} busstop, come down for {to_name}'
    if mode == 'ferry': return f'Enter boat for {from_name} jetty, commot for {to_name}'
    if mode == 'rail':  return f'Enter train for {from_name} station, come down for {to_name}'
    if mode in ('uber', 'bolt'):
        return f'Call {"Uber" if mode == "uber" else "Bolt"} from {from_name} go {to_name}'
    return f'Travel from {from_name} to {to_name}'


# ─────────────────────────────────────────────────────────────
# LEG BUILDER
# ─────────────────────────────────────────────────────────────

def _build_leg(mode: str, from_loc: dict, to_loc: dict) -> dict:
    dist_km = round(
        calculate_distance(from_loc['latitude'], from_loc['longitude'], to_loc['latitude'], to_loc['longitude']) * 100
    ) / 100
    duration_mins = max(1, math.ceil((dist_km / SPEEDS[mode]) * 60))
    price = _calc_price(dist_km, mode)
    return {
        'id': _uid(),
        'mode': mode,
        'from': from_loc,
        'to': to_loc,
        'distanceKm': dist_km,
        'durationMins': duration_mins,
        'priceMin': price['min'],
        'priceMax': price['max'],
        'instruction': _lagos_instruction(mode, from_loc['name'], to_loc['name']),
        'localInstruction': _lagos_pidgin_instruction(mode, from_loc['name'], to_loc['name']),
        'icon': _mode_icon(mode),
    }


# ─────────────────────────────────────────────────────────────
# TRIP CLASSIFICATION
# ─────────────────────────────────────────────────────────────

def classify_trip(dist_km: float) -> str:
    if dist_km < 2:  return 'micro'
    if dist_km < 8:  return 'short'
    if dist_km < 25: return 'medium'
    return 'long'


TRIP_BAND_LABEL = {
    'micro':  'Short walk nearby',
    'short':  'Local trip',
    'medium': 'Cross-area trip',
    'long':   'Long-distance trip',
}


# ─────────────────────────────────────────────────────────────
# CONNECTOR MODE — first/last mile selector
# ─────────────────────────────────────────────────────────────

def _connector_mode(
    from_lat: float, from_lng: float,
    to_lat: float, to_lng: float,
    dist_km: float,
    preferred: Optional[str] = None,
) -> str:
    if dist_km <= 0.2:
        return 'walk'
    okada_ok = _is_okada_allowed(from_lat, from_lng, to_lat, to_lng)
    if preferred == 'keke' and dist_km <= 5.0:
        return 'keke'
    if preferred == 'okada' and dist_km <= 6.0 and okada_ok:
        return 'okada'
    if dist_km > 8:
        return 'danfo'
    if dist_km <= 5.0:
        return 'keke'
    if okada_ok and dist_km <= 8.0:
        return 'okada'
    return 'keke'


# ─────────────────────────────────────────────────────────────
# OPTION ASSEMBLER
# ─────────────────────────────────────────────────────────────

def _assemble_option(
    option_id: str,
    option_type: str,
    name: str,
    description: str,
    legs: list,
    tags: list,
) -> dict:
    total_dist = round(sum(l['distanceKm'] for l in legs) * 100) / 100
    total_duration = sum(l['durationMins'] for l in legs)
    total_price_min = sum(l['priceMin'] for l in legs)
    total_price_max = sum(l['priceMax'] for l in legs)
    return {
        'id': option_id,
        'type': option_type,
        'name': name,
        'description': description,
        'legs': legs,
        'totalDistanceKm': total_dist,
        'totalDurationMins': total_duration,
        'totalPriceMin': total_price_min,
        'totalPriceMax': total_price_max,
        'priceFormatted': format_price(total_price_min, total_price_max),
        'isCheapest': False,
        'isFastest': False,
        'isRecommended': False,
        'recommendationReason': None,
        'tags': list(tags),
    }


# ─────────────────────────────────────────────────────────────
# ROUTE BUILDERS
# ─────────────────────────────────────────────────────────────

def _build_rail_route(
    origin: dict,
    destination: dict,
    line: list,
    line_name: str,
    pref: Optional[str] = None,
) -> Optional[dict]:
    entry = _nearest_stop(origin['latitude'], origin['longitude'], line)
    exit_s = _nearest_stop(
        destination['latitude'], destination['longitude'],
        line, [entry['name']] if entry else [],
    )
    if not entry or not exit_s or entry['name'] == exit_s['name']:
        return None

    walk_to_entry = calculate_distance(origin['latitude'], origin['longitude'], entry['latitude'], entry['longitude'])
    walk_from_exit = calculate_distance(exit_s['latitude'], exit_s['longitude'], destination['latitude'], destination['longitude'])
    rail_dist = calculate_distance(entry['latitude'], entry['longitude'], exit_s['latitude'], exit_s['longitude'])

    if rail_dist < 1.5:
        return None
    if walk_to_entry > rail_dist * 1.2 or walk_from_exit > rail_dist * 1.2:
        return None

    legs = []
    if walk_to_entry >= 0.05:
        mode = _connector_mode(origin['latitude'], origin['longitude'], entry['latitude'], entry['longitude'], walk_to_entry, pref)
        legs.append(_build_leg(mode, origin, entry))
    legs.append(_build_leg('rail', entry, exit_s))
    if walk_from_exit >= 0.05:
        mode = _connector_mode(exit_s['latitude'], exit_s['longitude'], destination['latitude'], destination['longitude'], walk_from_exit)
        legs.append(_build_leg(mode, exit_s, destination))

    return _assemble_option(
        _uid(), 'segmented', f'{line_name} Train',
        f'Via {entry["name"]} → {exit_s["name"]}',
        legs, ['Rail', 'Fast'],
    )


def _build_brt_route(origin: dict, destination: dict, pref: Optional[str] = None) -> Optional[dict]:
    for corridor_stops in [BRT_IKORODU_STOPS, BRT_ABULE_EGBA_STOPS]:
        entry = _nearest_stop(origin['latitude'], origin['longitude'], corridor_stops)
        exit_s = _nearest_stop(
            destination['latitude'], destination['longitude'],
            corridor_stops, [entry['name']] if entry else [],
        )
        if not entry or not exit_s:
            continue

        brt_dist = calculate_distance(entry['latitude'], entry['longitude'], exit_s['latitude'], exit_s['longitude'])
        if brt_dist < 3:
            continue

        walk_to_entry = calculate_distance(origin['latitude'], origin['longitude'], entry['latitude'], entry['longitude'])
        walk_from_exit = calculate_distance(exit_s['latitude'], exit_s['longitude'], destination['latitude'], destination['longitude'])
        if walk_to_entry > 4 or walk_from_exit > 4:
            continue

        legs = []
        if walk_to_entry >= 0.05:
            mode = _connector_mode(origin['latitude'], origin['longitude'], entry['latitude'], entry['longitude'], walk_to_entry, pref)
            legs.append(_build_leg(mode, origin, entry))
        legs.append(_build_leg('brt', entry, exit_s))
        if walk_from_exit >= 0.05:
            mode = _connector_mode(exit_s['latitude'], exit_s['longitude'], destination['latitude'], destination['longitude'], walk_from_exit)
            legs.append(_build_leg(mode, exit_s, destination))

        return _assemble_option(
            _uid(), 'segmented', 'BRT (Express)',
            f'Via {entry["name"]} → {exit_s["name"]}',
            legs, ['BRT', 'Faster'],
        )
    return None


def _build_ferry_route(origin: dict, destination: dict, pref: Optional[str] = None) -> Optional[dict]:
    origin_terminal = _nearest_stop(origin['latitude'], origin['longitude'], FERRY_TERMINALS)
    dest_terminal = _nearest_stop(destination['latitude'], destination['longitude'], FERRY_TERMINALS)
    if not origin_terminal or not dest_terminal or origin_terminal['name'] == dest_terminal['name']:
        return None

    has_route = any(
        (a == origin_terminal['name'] and b == dest_terminal['name']) or
        (b == origin_terminal['name'] and a == dest_terminal['name'])
        for a, b in FERRY_ROUTES
    )
    if not has_route:
        return None

    walk_to_terminal = calculate_distance(origin['latitude'], origin['longitude'], origin_terminal['latitude'], origin_terminal['longitude'])
    walk_from_terminal = calculate_distance(dest_terminal['latitude'], dest_terminal['longitude'], destination['latitude'], destination['longitude'])
    ferry_dist = calculate_distance(origin_terminal['latitude'], origin_terminal['longitude'], dest_terminal['latitude'], dest_terminal['longitude'])

    if ferry_dist < 1 or walk_to_terminal > 5 or walk_from_terminal > 5:
        return None

    legs = []
    if walk_to_terminal >= 0.05:
        mode = _connector_mode(origin['latitude'], origin['longitude'], origin_terminal['latitude'], origin_terminal['longitude'], walk_to_terminal, pref)
        legs.append(_build_leg(mode, origin, origin_terminal))
    legs.append(_build_leg('ferry', origin_terminal, dest_terminal))
    if walk_from_terminal >= 0.05:
        mode = _connector_mode(dest_terminal['latitude'], dest_terminal['longitude'], destination['latitude'], destination['longitude'], walk_from_terminal)
        legs.append(_build_leg(mode, dest_terminal, destination))

    return _assemble_option(
        _uid(), 'segmented', 'Ferry Route',
        f'Via {origin_terminal["name"]} → {dest_terminal["name"]}',
        legs, ['Ferry', 'Scenic'],
    )


def _build_danfo_route(origin: dict, destination: dict, pref: Optional[str] = None) -> dict:
    legs = []
    total_dist = calculate_distance(origin['latitude'], origin['longitude'], destination['latitude'], destination['longitude'])

    if total_dist <= 0.8:
        mode = _connector_mode(origin['latitude'], origin['longitude'], destination['latitude'], destination['longitude'], total_dist, pref)
        legs.append(_build_leg(mode, origin, destination))
        label = 'Walk' if mode == 'walk' else 'Keke'
        return _assemble_option(_uid(), 'direct', 'Direct', f'{label} direct', legs, ['Short Trip'])

    first_hub_raw = (
        _nearest_stop(origin['latitude'], origin['longitude'], ALL_STOPS) or
        _nearest_stop(origin['latitude'], origin['longitude'], DANFO_HUBS)
    )
    nearest_danfo_hub = _nearest_stop(origin['latitude'], origin['longitude'], DANFO_HUBS)

    if first_hub_raw and nearest_danfo_hub:
        d_all = calculate_distance(origin['latitude'], origin['longitude'], first_hub_raw['latitude'], first_hub_raw['longitude'])
        d_danfo = calculate_distance(origin['latitude'], origin['longitude'], nearest_danfo_hub['latitude'], nearest_danfo_hub['longitude'])
        first_hub = first_hub_raw if d_all < d_danfo - 0.3 else nearest_danfo_hub
    else:
        first_hub = first_hub_raw or nearest_danfo_hub

    last_hub = (
        _nearest_stop(destination['latitude'], destination['longitude'], DANFO_HUBS, [first_hub['name']])
        if first_hub else
        _nearest_stop(destination['latitude'], destination['longitude'], DANFO_HUBS)
    )

    if not first_hub or not last_hub:
        mode = 'walk' if total_dist <= 0.5 else 'danfo'
        legs.append(_build_leg(mode, origin, destination))
        return _assemble_option(_uid(), 'direct', 'Danfo Direct', 'Direct danfo', legs, ['Budget'])

    dist_to_first = calculate_distance(origin['latitude'], origin['longitude'], first_hub['latitude'], first_hub['longitude'])
    dist_from_last = calculate_distance(last_hub['latitude'], last_hub['longitude'], destination['latitude'], destination['longitude'])
    hub_to_hub_dist = calculate_distance(first_hub['latitude'], first_hub['longitude'], last_hub['latitude'], last_hub['longitude'])

    if dist_to_first >= 0.05:
        mode = _connector_mode(origin['latitude'], origin['longitude'], first_hub['latitude'], first_hub['longitude'], dist_to_first, pref)
        legs.append(_build_leg(mode, origin, first_hub))

    if hub_to_hub_dist > 6:
        intermediates = _stops_along_corridor(
            first_hub['latitude'], first_hub['longitude'],
            last_hub['latitude'], last_hub['longitude'],
            DANFO_HUBS, [first_hub['name'], last_hub['name']], 2,
        )
        chain = [first_hub] + intermediates + [last_hub]
        for i in range(len(chain) - 1):
            from_s, to_s = chain[i], chain[i + 1]
            d = calculate_distance(from_s['latitude'], from_s['longitude'], to_s['latitude'], to_s['longitude'])
            if d < 0.1:
                continue
            legs.append(_build_leg('danfo', from_s, to_s))
    elif hub_to_hub_dist >= 0.05:
        legs.append(_build_leg('danfo', first_hub, last_hub))

    if dist_from_last >= 0.05:
        mode = _connector_mode(last_hub['latitude'], last_hub['longitude'], destination['latitude'], destination['longitude'], dist_from_last)
        legs.append(_build_leg(mode, last_hub, destination))

    if not legs:
        legs.append(_build_leg('danfo', origin, destination))

    return _assemble_option(
        _uid(), 'segmented', 'Danfo Route',
        f'Via {first_hub["name"]} → {last_hub["name"]}',
        legs, ['Budget', 'Popular'],
    )


# ─────────────────────────────────────────────────────────────
# RECOMMENDATION REASON
# ─────────────────────────────────────────────────────────────

def _pick_recommendation_reason(opt: dict) -> str:
    if 'BRT' in opt['tags']:   return 'BRT runs on dedicated lanes — more reliable in traffic'
    if 'Rail' in opt['tags']:  return 'Train avoids road congestion entirely'
    if 'Ferry' in opt['tags']: return 'Waterway avoids road traffic completely'
    if opt['isFastest']:       return 'Quickest route for this trip'
    return 'Best balance of speed and cost for Lagos'


# ─────────────────────────────────────────────────────────────
# MAIN ENGINE
# ─────────────────────────────────────────────────────────────

def _calculate_smart_route(
    origin_lat: float,
    origin_lng: float,
    origin_name: str,
    dest_lat: float,
    dest_lng: float,
    dest_name: str,
    preferred_mode: Optional[str] = None,
    avoid_points: Optional[list] = None,
) -> dict:
    origin = {'latitude': origin_lat, 'longitude': origin_lng, 'name': origin_name or 'Your Location'}
    destination = {'latitude': dest_lat, 'longitude': dest_lng, 'name': dest_name or 'Destination'}

    # Nearest stops for UI display
    _origin_stop = _nearest_stop(origin_lat, origin_lng, ALL_STOPS)
    _dest_stop = _nearest_stop(dest_lat, dest_lng, ALL_STOPS)

    def _to_stop_info(stop, from_lat, from_lng):
        if not stop:
            return None
        dist = calculate_distance(from_lat, from_lng, stop['latitude'], stop['longitude'])
        return {
            'name': stop['name'],
            'distanceKm': round(dist * 100) / 100,
            'walkMins': max(1, math.ceil((dist / SPEEDS['walk']) * 60)),
        }

    origin_nearest_stop = _to_stop_info(_origin_stop, origin_lat, origin_lng)
    destination_nearest_stop = _to_stop_info(_dest_stop, dest_lat, dest_lng)

    total_dist = calculate_distance(origin_lat, origin_lng, dest_lat, dest_lng)
    trip_band = classify_trip(total_dist)

    # Build all viable route options
    options = []

    brt_route = _build_brt_route(origin, destination, preferred_mode)
    if brt_route:
        options.append(brt_route)

    # Rail only worth attempting when the trip is long enough for a station-to-station leg to help.
    # The internal rail_dist >= 1.5km guard isn't sufficient alone — without a total-distance gate,
    # micro trips can get routed north on the Red Line just to walk back south to a nearby stop.
    if total_dist >= 5:
        blue_line_route = _build_rail_route(origin, destination, BLUE_LINE_STOPS, 'Blue Line', preferred_mode)
        if blue_line_route:
            options.append(blue_line_route)

        red_line_route = _build_rail_route(origin, destination, RED_LINE_STOPS, 'Red Line', preferred_mode)
        if red_line_route:
            options.append(red_line_route)

    ferry_route = _build_ferry_route(origin, destination, preferred_mode)
    if ferry_route:
        options.append(ferry_route)

    danfo_route = _build_danfo_route(origin, destination, preferred_mode)
    options.append(danfo_route)

    # Remove near-duplicates (same leg count, similar price and duration)
    deduped = []
    for opt in options:
        is_dup = any(
            len(d['legs']) == len(opt['legs']) and
            abs(d['totalPriceMin'] - opt['totalPriceMin']) < 100 and
            abs(d['totalDurationMins'] - opt['totalDurationMins']) < 5
            for d in deduped
        )
        if not is_dup:
            deduped.append(opt)

    final_options = deduped[:3] or [danfo_route]

    # Tag cheapest / fastest
    cheapest = min(final_options, key=lambda o: o['totalPriceMax'])
    fastest = min(final_options, key=lambda o: o['totalDurationMins'])
    for opt in final_options:
        opt['isCheapest'] = opt['id'] == cheapest['id']
        opt['isFastest'] = opt['id'] == fastest['id']
        if opt['isCheapest']:
            opt['tags'].append('Cheapest')
        if opt['isFastest'] and opt['id'] != cheapest['id']:
            opt['tags'].append('Fastest')

    # Incident avoidance reranking
    avoid = avoid_points or []
    affected_by_incident = set()

    if avoid:
        for opt in final_options:
            hit = any(
                min(
                    calculate_distance(leg['from']['latitude'], leg['from']['longitude'], ap['latitude'], ap['longitude']),
                    calculate_distance(leg['to']['latitude'], leg['to']['longitude'], ap['latitude'], ap['longitude']),
                    calculate_distance(
                        (leg['from']['latitude'] + leg['to']['latitude']) / 2,
                        (leg['from']['longitude'] + leg['to']['longitude']) / 2,
                        ap['latitude'], ap['longitude'],
                    ),
                ) <= ap['radius_km']
                for leg in opt['legs']
                for ap in avoid
            )
            if hit:
                affected_by_incident.add(opt['id'])

    # Pick best recommendation — prefer unaffected, prefer infrastructure over road
    def _find(predicate):
        return next((o for o in final_options if predicate(o)), None)

    recommended = (
        _find(lambda o: o['id'] not in affected_by_incident and 'BRT' in o['tags']) or
        _find(lambda o: o['id'] not in affected_by_incident and 'Rail' in o['tags']) or
        _find(lambda o: o['id'] not in affected_by_incident and o['isFastest']) or
        _find(lambda o: o['id'] not in affected_by_incident) or
        _find(lambda o: 'BRT' in o['tags']) or
        _find(lambda o: o['isFastest']) or
        final_options[0]
    )

    recommended['isRecommended'] = True
    if affected_by_incident and recommended['id'] not in affected_by_incident:
        recommended['recommendationReason'] = 'Avoids reported incidents on your route'
        if 'Incident-free' not in recommended['tags']:
            recommended['tags'].append('Incident-free')
    else:
        recommended['recommendationReason'] = _pick_recommendation_reason(recommended)

    # Sort: recommended first, then unaffected, then by price
    final_options.sort(key=lambda o: (
        0 if o['isRecommended'] else 1,
        1 if o['id'] in affected_by_incident else 0,
        o['totalPriceMin'],
    ))

    price_diff = abs(final_options[0]['totalPriceMax'] - final_options[1]['totalPriceMax']) if len(final_options) > 1 else 0
    price_pct = (
        round((price_diff / final_options[1]['totalPriceMax']) * 100)
        if len(final_options) > 1 and final_options[1]['totalPriceMax'] > 0 else 0
    )
    time_diff = abs(final_options[0]['totalDurationMins'] - final_options[1]['totalDurationMins']) if len(final_options) > 1 else 0
    should_choose = price_pct <= 15 and len(final_options) > 1

    return {
        'origin': origin,
        'destination': destination,
        'tripBand': trip_band,
        'originNearestStop': origin_nearest_stop,
        'destinationNearestStop': destination_nearest_stop,
        'options': final_options,
        'recommendedOptionId': recommended['id'],
        'comparison': {
            'priceDifference': price_diff,
            'priceDifferencePercent': price_pct,
            'timeDifference': time_diff,
            'shouldLetUserChoose': should_choose,
            'comparisonText': (
                f'Similar price ({price_pct}% difference). Pick what suits you!'
                if should_choose
                else (recommended['recommendationReason'] or '')
            ),
        },
        'computedAt': datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────
# PUBLIC ENTRY POINT (called by RouteComputeView)
# ─────────────────────────────────────────────────────────────

def compute_route(data: dict) -> dict:
    origin = data['origin']
    destination = data['destination']
    return _calculate_smart_route(
        origin_lat=origin['latitude'],
        origin_lng=origin['longitude'],
        origin_name=origin.get('name', ''),
        dest_lat=destination['latitude'],
        dest_lng=destination['longitude'],
        dest_name=destination.get('name', ''),
        preferred_mode=data.get('preferred_first_leg_mode'),
        avoid_points=data.get('avoid_points'),
    )
