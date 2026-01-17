/**
 * WakaWay Smart Routing Service
 * 
 * AI-powered route planning that:
 * - Breaks journeys into segments (walk → bus stop → danfo → bus stop → walk)
 * - Compares direct vs segmented routes
 * - Suggests cheapest option automatically
 * - Lets users choose when prices are similar
 */

// Haversine formula to calculate distance between two coordinates
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ============================================================
// TYPES
// ============================================================

export type TransportMode = 'walk' | 'keke' | 'okada' | 'danfo' | 'brt' | 'ferry';

export interface Location {
  latitude: number;
  longitude: number;
  name: string;
  type?: string;
}

export interface RouteLeg {
  id: string;
  mode: TransportMode;
  from: Location;
  to: Location;
  distanceKm: number;
  durationMins: number;
  priceMin: number;
  priceMax: number;
  instruction: string;
  localInstruction: string; // Pidgin English instruction
  icon: string;
}

export interface RouteOption {
  id: string;
  type: 'direct' | 'segmented';
  name: string;
  description: string;
  legs: RouteLeg[];
  totalDistanceKm: number;
  totalDurationMins: number;
  totalPriceMin: number;
  totalPriceMax: number;
  priceFormatted: string;
  isCheapest: boolean;
  isFastest: boolean;
  isRecommended: boolean;
  recommendationReason?: string;
  tags: string[];
}

export interface SmartRouteResult {
  origin: Location;
  destination: Location;
  options: RouteOption[];
  recommendedOptionId: string;
  comparison: {
    priceDifference: number;
    priceDifferencePercent: number;
    timeDifference: number;
    shouldLetUserChoose: boolean;
    comparisonText: string;
  };
  computedAt: Date;
}

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  // Walking thresholds
  MAX_COMFORTABLE_WALK_KM: 0.5,
  MAX_WALK_TO_BUS_STOP_KM: 1.2,
  
  // Speed estimates (km/h)
  SPEEDS: {
    walk: 5,
    keke: 25,
    okada: 35,
    danfo: 20,
    brt: 30,
    ferry: 25,
  } as Record<TransportMode, number>,
  
  // Base fares (Naira)
  BASE_FARES: {
    walk: 0,
    keke: 100,
    okada: 100,
    danfo: 100,
    brt: 200,
    ferry: 1000,
  } as Record<TransportMode, number>,
  
  // Rate per km (Naira)
  RATES_PER_KM: {
    walk: 0,
    keke: 80,
    okada: 70,
    danfo: 30,
    brt: 25,
    ferry: 0, // Flat rate
  } as Record<TransportMode, number>,
  
  // Price variance (conductor discretion)
  PRICE_VARIANCE: 0.25, // 25% variance
  
  // Similar price threshold (percentage)
  SIMILAR_PRICE_THRESHOLD: 15, // If prices are within 15%, let user choose
};

// ============================================================
// MOCK BUS STOPS (Lagos major stops)
// In production, this would come from Supabase
// ============================================================

const LAGOS_BUS_STOPS: Location[] = [
  { latitude: 6.5244, longitude: 3.3792, name: 'CMS', type: 'major_bus_stop' },
  { latitude: 6.4281, longitude: 3.4219, name: 'Lekki Phase 1', type: 'bus_stop' },
  { latitude: 6.4698, longitude: 3.5852, name: 'Ajah Under Bridge', type: 'major_bus_stop' },
  { latitude: 6.5158, longitude: 3.3903, name: 'Obalende', type: 'major_bus_stop' },
  { latitude: 6.5059, longitude: 3.3539, name: 'Costain', type: 'major_bus_stop' },
  { latitude: 6.4965, longitude: 3.3568, name: 'Eko Bridge', type: 'bus_stop' },
  { latitude: 6.5833, longitude: 3.3417, name: 'Ikeja Along', type: 'major_bus_stop' },
  { latitude: 6.5892, longitude: 3.3333, name: 'Computer Village', type: 'bus_stop' },
  { latitude: 6.6018, longitude: 3.3515, name: 'Maryland', type: 'major_bus_stop' },
  { latitude: 6.5347, longitude: 3.3403, name: 'Yaba', type: 'major_bus_stop' },
  { latitude: 6.4579, longitude: 3.3674, name: 'Ikoyi', type: 'bus_stop' },
  { latitude: 6.4315, longitude: 3.4255, name: 'Chevron', type: 'bus_stop' },
  { latitude: 6.4392, longitude: 3.5012, name: 'Sangotedo', type: 'bus_stop' },
  { latitude: 6.5519, longitude: 3.3839, name: 'Jibowu', type: 'bus_stop' },
  { latitude: 6.4483, longitude: 3.4760, name: 'VGC', type: 'bus_stop' },
  { latitude: 6.5763, longitude: 3.3333, name: 'Allen Junction', type: 'bus_stop' },
  { latitude: 6.6325, longitude: 3.3333, name: 'Ojodu Berger', type: 'major_bus_stop' },
  { latitude: 6.5095, longitude: 3.3689, name: 'Sabo Yaba', type: 'bus_stop' },
  { latitude: 6.4524, longitude: 3.3957, name: 'Shoprite Lekki', type: 'bus_stop' },
  { latitude: 6.6, longitude: 3.35, name: 'Ikeja GRA', type: 'bus_stop' },
];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function findNearestBusStop(lat: number, lng: number): Location | null {
  let nearest: Location | null = null;
  let minDistance = Infinity;
  
  for (const stop of LAGOS_BUS_STOPS) {
    const distance = calculateDistance(lat, lng, stop.latitude, stop.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = stop;
    }
  }
  
  return nearest;
}

function findBusStopsNearDestination(lat: number, lng: number, maxResults = 3): Location[] {
  return LAGOS_BUS_STOPS
    .map(stop => ({
      ...stop,
      distance: calculateDistance(lat, lng, stop.latitude, stop.longitude)
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxResults);
}

function calculateDuration(distanceKm: number, mode: TransportMode): number {
  const speed = CONFIG.SPEEDS[mode];
  return Math.ceil((distanceKm / speed) * 60);
}

function calculatePrice(distanceKm: number, mode: TransportMode): { min: number; max: number } {
  if (mode === 'walk') {
    return { min: 0, max: 0 };
  }
  
  if (mode === 'ferry') {
    return { min: 1000, max: 1500 };
  }
  
  // Realistic Lagos pricing (2024/2025 rates)
  // Short trips are often flat rates
  const isShortTrip = distanceKm <= 2;
  
  let minPrice: number;
  let maxPrice: number;
  
  switch (mode) {
    case 'keke':
      // Keke: ₦100-₦200 for short trips, ₦200-₦500 for longer
      if (isShortTrip) {
        minPrice = 100;
        maxPrice = 200;
      } else {
        minPrice = 150 + Math.round(distanceKm * 50);
        maxPrice = 200 + Math.round(distanceKm * 80);
      }
      // Cap at realistic Lagos prices
      minPrice = Math.min(minPrice, 500);
      maxPrice = Math.min(maxPrice, 800);
      break;
      
    case 'okada':
      // Okada: ₦100-₦200 for short, ₦200-₦400 for longer
      if (isShortTrip) {
        minPrice = 100;
        maxPrice = 200;
      } else {
        minPrice = 150 + Math.round(distanceKm * 40);
        maxPrice = 200 + Math.round(distanceKm * 60);
      }
      // Cap at realistic Lagos prices
      minPrice = Math.min(minPrice, 400);
      maxPrice = Math.min(maxPrice, 600);
      break;
      
    case 'danfo':
      // Danfo: ₦100-₦200 base, rarely exceeds ₦500
      if (isShortTrip) {
        minPrice = 100;
        maxPrice = 150;
      } else {
        minPrice = 100 + Math.round(distanceKm * 20);
        maxPrice = 150 + Math.round(distanceKm * 30);
      }
      // Danfo is cheap - cap it
      minPrice = Math.min(minPrice, 300);
      maxPrice = Math.min(maxPrice, 500);
      break;
      
    case 'brt':
      // BRT: Fixed rates based on zones, ₦200-₦700
      if (distanceKm <= 5) {
        minPrice = 200;
        maxPrice = 300;
      } else if (distanceKm <= 10) {
        minPrice = 300;
        maxPrice = 400;
      } else {
        minPrice = 400;
        maxPrice = 700;
      }
      break;
      
    default:
      minPrice = 100;
      maxPrice = 200;
  }
  
  return { min: minPrice, max: maxPrice };
}

function formatPrice(min: number, max: number): string {
  if (min === 0 && max === 0) return 'Free';
  if (min === max) return `₦${min.toLocaleString()}`;
  return `₦${min.toLocaleString()} - ₦${max.toLocaleString()}`;
}

function getModeIcon(mode: TransportMode): string {
  const icons: Record<TransportMode, string> = {
    walk: 'walk-outline',
    keke: 'car-outline',
    okada: 'bicycle-outline',
    danfo: 'bus-outline',
    brt: 'bus',
    ferry: 'boat-outline',
  };
  return icons[mode];
}

// ============================================================
// ROUTE LEG BUILDERS
// ============================================================

function buildLeg(
  mode: TransportMode,
  from: Location,
  to: Location
): RouteLeg {
  const distanceKm = calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
  const durationMins = calculateDuration(distanceKm, mode);
  const price = calculatePrice(distanceKm, mode);
  
  const modeLabels: Record<TransportMode, string> = {
    walk: 'Walk',
    keke: 'Keke',
    okada: 'Okada',
    danfo: 'Danfo',
    brt: 'BRT',
    ferry: 'Ferry',
  };
  
  const pidginLabels: Record<TransportMode, string> = {
    walk: 'Waka',
    keke: 'Enter Keke',
    okada: 'Enter Okada',
    danfo: 'Enter Bus',
    brt: 'Enter BRT',
    ferry: 'Enter Boat',
  };
  
  return {
    id: generateId(),
    mode,
    from,
    to,
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationMins,
    priceMin: price.min,
    priceMax: price.max,
    instruction: `${modeLabels[mode]} from ${from.name} to ${to.name}`,
    localInstruction: `${pidginLabels[mode]} from ${from.name} go ${to.name}`,
    icon: getModeIcon(mode),
  };
}

// ============================================================
// ROUTE OPTION BUILDERS
// ============================================================

function buildDirectRoute(
  origin: Location,
  destination: Location,
  mode: TransportMode
): RouteOption {
  const leg = buildLeg(mode, origin, destination);
  
  return {
    id: generateId(),
    type: 'direct',
    name: `Direct ${mode === 'keke' ? 'Keke' : mode === 'okada' ? 'Okada' : 'Ride'}`,
    description: `Take a ${mode} straight to your destination`,
    legs: [leg],
    totalDistanceKm: leg.distanceKm,
    totalDurationMins: leg.durationMins,
    totalPriceMin: leg.priceMin,
    totalPriceMax: leg.priceMax,
    priceFormatted: formatPrice(leg.priceMin, leg.priceMax),
    isCheapest: false,
    isFastest: false,
    isRecommended: false,
    tags: ['Direct'],
  };
}

function buildSegmentedRoute(
  origin: Location,
  destination: Location,
  nearestOriginStop: Location,
  nearestDestStop: Location
): RouteOption {
  const legs: RouteLeg[] = [];
  
  const distanceToFirstStop = calculateDistance(
    origin.latitude, origin.longitude,
    nearestOriginStop.latitude, nearestOriginStop.longitude
  );
  
  // First mile: Walk or Keke to bus stop
  if (distanceToFirstStop <= CONFIG.MAX_COMFORTABLE_WALK_KM) {
    legs.push(buildLeg('walk', origin, nearestOriginStop));
  } else if (distanceToFirstStop <= CONFIG.MAX_WALK_TO_BUS_STOP_KM) {
    // Offer walk but mention it's a bit long
    const walkLeg = buildLeg('walk', origin, nearestOriginStop);
    walkLeg.instruction += ' (10-15 min walk)';
    legs.push(walkLeg);
  } else {
    // Too far to walk, take keke
    legs.push(buildLeg('keke', origin, nearestOriginStop));
  }
  
  // Main transit: Bus from stop to stop
  legs.push(buildLeg('danfo', nearestOriginStop, nearestDestStop));
  
  // Last mile: Walk or Keke from bus stop to destination
  const distanceFromLastStop = calculateDistance(
    nearestDestStop.latitude, nearestDestStop.longitude,
    destination.latitude, destination.longitude
  );
  
  if (distanceFromLastStop <= CONFIG.MAX_COMFORTABLE_WALK_KM) {
    legs.push(buildLeg('walk', nearestDestStop, destination));
  } else if (distanceFromLastStop <= CONFIG.MAX_WALK_TO_BUS_STOP_KM) {
    legs.push(buildLeg('walk', nearestDestStop, destination));
  } else {
    legs.push(buildLeg('keke', nearestDestStop, destination));
  }
  
  // Calculate totals
  const totalDistance = legs.reduce((sum, leg) => sum + leg.distanceKm, 0);
  const totalDuration = legs.reduce((sum, leg) => sum + leg.durationMins, 0);
  const totalPriceMin = legs.reduce((sum, leg) => sum + leg.priceMin, 0);
  const totalPriceMax = legs.reduce((sum, leg) => sum + leg.priceMax, 0);
  
  return {
    id: generateId(),
    type: 'segmented',
    name: 'Bus Stop to Bus Stop',
    description: `Take bus via ${nearestOriginStop.name} → ${nearestDestStop.name}`,
    legs,
    totalDistanceKm: Math.round(totalDistance * 100) / 100,
    totalDurationMins: totalDuration,
    totalPriceMin,
    totalPriceMax,
    priceFormatted: formatPrice(totalPriceMin, totalPriceMax),
    isCheapest: false,
    isFastest: false,
    isRecommended: false,
    tags: ['Multiple Stops'],
  };
}

// ============================================================
// MAIN ROUTING FUNCTION
// ============================================================

export function calculateSmartRoute(
  originLat: number,
  originLng: number,
  originName: string,
  destLat: number,
  destLng: number,
  destName: string
): SmartRouteResult {
  const origin: Location = {
    latitude: originLat,
    longitude: originLng,
    name: originName || 'Your Location',
  };
  
  const destination: Location = {
    latitude: destLat,
    longitude: destLng,
    name: destName || 'Destination',
  };
  
  const totalDistance = calculateDistance(originLat, originLng, destLat, destLng);
  
  const options: RouteOption[] = [];
  
  // Option 1: Direct Keke
  const directKeke = buildDirectRoute(origin, destination, 'keke');
  options.push(directKeke);
  
  // Option 2: Direct Okada (faster but similar price)
  const directOkada = buildDirectRoute(origin, destination, 'okada');
  options.push(directOkada);
  
  // Option 3: Segmented route (if distance > 3km)
  if (totalDistance > 3) {
    const nearestOriginStop = findNearestBusStop(originLat, originLng);
    const destStops = findBusStopsNearDestination(destLat, destLng);
    
    if (nearestOriginStop && destStops.length > 0) {
      // Find the best destination stop (not the same as origin stop)
      const nearestDestStop = destStops.find(s => s.name !== nearestOriginStop.name) || destStops[0];
      
      const segmented = buildSegmentedRoute(origin, destination, nearestOriginStop, nearestDestStop);
      options.push(segmented);
      
      // Option 4: Direct Danfo (if there's a major route)
      const directDanfo = buildDirectRoute(origin, destination, 'danfo');
      options.push(directDanfo);
    }
  }
  
  // Determine cheapest and fastest
  let cheapestOption: RouteOption | null = null;
  let fastestOption: RouteOption | null = null;
  
  for (const option of options) {
    if (!cheapestOption || option.totalPriceMax < cheapestOption.totalPriceMax) {
      cheapestOption = option;
    }
    if (!fastestOption || option.totalDurationMins < fastestOption.totalDurationMins) {
      fastestOption = option;
    }
  }
  
  // Mark cheapest and fastest
  for (const option of options) {
    option.isCheapest = option.id === cheapestOption?.id;
    option.isFastest = option.id === fastestOption?.id;
    
    if (option.isCheapest) option.tags.push('Cheapest');
    if (option.isFastest) option.tags.push('Fastest');
  }
  
  // Calculate comparison
  const directOption = options.find(o => o.type === 'direct');
  const segmentedOption = options.find(o => o.type === 'segmented');
  
  let comparison = {
    priceDifference: 0,
    priceDifferencePercent: 0,
    timeDifference: 0,
    shouldLetUserChoose: false,
    comparisonText: '',
  };
  
  if (directOption && segmentedOption) {
    const priceDiff = directOption.totalPriceMax - segmentedOption.totalPriceMax;
    const priceDiffPercent = Math.abs(priceDiff) / directOption.totalPriceMax * 100;
    const timeDiff = directOption.totalDurationMins - segmentedOption.totalDurationMins;
    
    comparison = {
      priceDifference: priceDiff,
      priceDifferencePercent: priceDiffPercent,
      timeDifference: timeDiff,
      shouldLetUserChoose: priceDiffPercent <= CONFIG.SIMILAR_PRICE_THRESHOLD,
      comparisonText: '',
    };
    
    if (priceDiff > 0) {
      comparison.comparisonText = `Bus route saves you ₦${Math.abs(priceDiff).toLocaleString()}`;
    } else if (priceDiff < 0) {
      comparison.comparisonText = `Direct route saves you ₦${Math.abs(priceDiff).toLocaleString()}`;
    }
    
    if (comparison.shouldLetUserChoose) {
      comparison.comparisonText = 'Prices are similar - choose your preference!';
    }
  }
  
  // Determine recommended option
  let recommendedOption = cheapestOption;
  
  if (cheapestOption && fastestOption && cheapestOption.id !== fastestOption.id) {
    // If segmented is cheaper, recommend it
    if (segmentedOption?.isCheapest) {
      recommendedOption = segmentedOption;
      recommendedOption.isRecommended = true;
      recommendedOption.recommendationReason = `Saves you ₦${Math.abs(comparison.priceDifference).toLocaleString()} compared to direct ride`;
    } else if (comparison.shouldLetUserChoose) {
      // Similar prices - don't force a recommendation
      recommendedOption = null;
    } else {
      recommendedOption = cheapestOption;
      recommendedOption.isRecommended = true;
      recommendedOption.recommendationReason = 'Best value for money';
    }
  } else if (cheapestOption) {
    cheapestOption.isRecommended = true;
    cheapestOption.recommendationReason = 'Best option for this trip';
  }
  
  // Sort options: recommended first, then by price
  options.sort((a, b) => {
    if (a.isRecommended) return -1;
    if (b.isRecommended) return 1;
    return a.totalPriceMin - b.totalPriceMin;
  });
  
  return {
    origin,
    destination,
    options,
    recommendedOptionId: recommendedOption?.id || options[0]?.id || '',
    comparison,
    computedAt: new Date(),
  };
}

// ============================================================
// EXPORTS
// ============================================================

export {
  findNearestBusStop,
  calculateDistance,
  formatPrice,
};
