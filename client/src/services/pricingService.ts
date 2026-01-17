/**
 * WakaWay Pricing Service
 * 
 * Dynamic pricing for Lagos multimodal transit with:
 * - Time-of-day surcharges (night prices, peak hours)
 * - Distance-based calculations
 * - Safety surcharges (forced vehicle routes)
 * - Negotiable fare ranges for Keke/Okada
 */

import {
  TransitMode,
  PriceEstimate,
  PricingConfig,
} from '../types/routing';

// ============================================================
// DEFAULT PRICING CONFIGURATION (Lagos 2024/2025 rates)
// ============================================================

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  // Walking is free
  walk_cost: 0,
  
  // Danfo (Yellow bus) pricing
  danfo_base_fare: 100,           // ₦100 minimum
  danfo_rate_per_km: 30,          // ₦30 per km
  
  // BRT pricing (cheaper, fixed routes)
  brt_base_fare: 200,             // ₦200 minimum
  brt_rate_per_km: 20,            // ₦20 per km (more efficient)
  
  // Keke (Tricycle) - often flat rate for short trips
  keke_short_trip_min: 100,       // ₦100 minimum
  keke_short_trip_max: 400,       // ₦400 max for short trips (<2km)
  keke_rate_per_km: 100,          // ₦100 per km for longer trips
  
  // Okada (Motorcycle) - faster, slightly cheaper
  okada_short_trip_min: 100,      // ₦100 minimum
  okada_short_trip_max: 350,      // ₦350 max for short trips
  okada_rate_per_km: 80,          // ₦80 per km
  
  // Ferry
  ferry_base_fare: 1000,          // ₦1000 flat rate (most routes)
  
  // Surcharges
  night_surcharge_percent: 30,    // 30% night surcharge (8PM - 6AM)
  peak_surcharge_percent: 15,     // 15% during rush hours
  safety_surcharge_percent: 20,   // 20% for forced vehicle routes
  
  // Time thresholds
  night_start_hour: 20,           // 8 PM
  night_end_hour: 6,              // 6 AM
  peak_morning_start: 7,          // 7 AM
  peak_morning_end: 10,           // 10 AM
  peak_evening_start: 17,         // 5 PM
  peak_evening_end: 21,           // 9 PM
};

// ============================================================
// TIME UTILITIES
// ============================================================

/**
 * Check if current time is during night hours (higher fares)
 */
export function isNightTime(date: Date = new Date()): boolean {
  const hour = date.getHours();
  const config = DEFAULT_PRICING_CONFIG;
  return hour >= config.night_start_hour || hour < config.night_end_hour;
}

/**
 * Check if current time is during peak hours
 */
export function isPeakHours(date: Date = new Date()): boolean {
  const hour = date.getHours();
  const config = DEFAULT_PRICING_CONFIG;
  
  const isMorningPeak = hour >= config.peak_morning_start && hour < config.peak_morning_end;
  const isEveningPeak = hour >= config.peak_evening_start && hour < config.peak_evening_end;
  
  return isMorningPeak || isEveningPeak;
}

/**
 * Get time context string
 */
export function getTimeContext(date: Date = new Date()): string {
  if (isNightTime(date)) {
    return 'night';
  }
  if (isPeakHours(date)) {
    return 'peak';
  }
  return 'normal';
}

// ============================================================
// DISTANCE CALCULATION
// ============================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(
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
// PRICING CALCULATORS
// ============================================================

/**
 * Calculate walking price (always free)
 */
export function calculateWalkPrice(): PriceEstimate {
  return {
    base_fare: 0,
    distance_fare: 0,
    time_surcharge: 0,
    safety_surcharge: 0,
    total: 0,
    currency: 'NGN',
    breakdown: 'Walking is free!',
  };
}

/**
 * Calculate Danfo (yellow bus) price
 */
export function calculateDanfoPrice(
  distanceKm: number,
  date: Date = new Date(),
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): PriceEstimate {
  const baseFare = config.danfo_base_fare;
  const distanceFare = Math.round(distanceKm * config.danfo_rate_per_km);
  
  let timeSurcharge = 0;
  let isNight = false;
  let isPeak = false;
  
  if (isNightTime(date)) {
    isNight = true;
    timeSurcharge = Math.round((baseFare + distanceFare) * (config.night_surcharge_percent / 100));
  } else if (isPeakHours(date)) {
    isPeak = true;
    timeSurcharge = Math.round((baseFare + distanceFare) * (config.peak_surcharge_percent / 100));
  }
  
  const total = baseFare + distanceFare + timeSurcharge;
  
  // Round to nearest 50 (Lagos fare convention)
  const roundedTotal = Math.ceil(total / 50) * 50;
  
  return {
    base_fare: baseFare,
    distance_fare: distanceFare,
    time_surcharge: timeSurcharge,
    safety_surcharge: 0,
    total: roundedTotal,
    currency: 'NGN',
    is_night_price: isNight,
    is_peak_price: isPeak,
    breakdown: `₦${baseFare} base + ₦${distanceFare} (${distanceKm.toFixed(1)}km)${timeSurcharge > 0 ? ` + ₦${timeSurcharge} surcharge` : ''}`,
  };
}

/**
 * Calculate BRT price
 */
export function calculateBRTPrice(
  distanceKm: number,
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): PriceEstimate {
  const baseFare = config.brt_base_fare;
  const distanceFare = Math.round(distanceKm * config.brt_rate_per_km);
  
  // BRT has fixed routes, so we use zone-based pricing
  // Simplified to distance-based for this implementation
  const total = baseFare + distanceFare;
  
  // BRT fares are usually in multiples of 100
  const roundedTotal = Math.ceil(total / 100) * 100;
  
  return {
    base_fare: baseFare,
    distance_fare: distanceFare,
    time_surcharge: 0,
    safety_surcharge: 0,
    total: roundedTotal,
    currency: 'NGN',
    breakdown: `BRT fixed fare: ₦${roundedTotal}`,
  };
}

/**
 * Calculate Keke (tricycle) price
 */
export function calculateKekePrice(
  distanceKm: number,
  date: Date = new Date(),
  forcedVehicle: boolean = false,
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): PriceEstimate {
  let baseFare: number;
  let distanceFare: number;
  let minPrice: number;
  let maxPrice: number;
  
  // Short trips (<2km) have flat rate range
  if (distanceKm <= 2) {
    baseFare = config.keke_short_trip_min;
    distanceFare = 0;
    minPrice = config.keke_short_trip_min;
    maxPrice = config.keke_short_trip_max;
  } else {
    // Longer trips use per-km rate
    baseFare = config.keke_short_trip_min;
    distanceFare = Math.round((distanceKm - 1) * config.keke_rate_per_km);
    minPrice = baseFare + distanceFare - 50;
    maxPrice = baseFare + distanceFare + 100;
  }
  
  let timeSurcharge = 0;
  let safetySurcharge = 0;
  let isNight = false;
  
  // Night surcharge
  if (isNightTime(date)) {
    isNight = true;
    timeSurcharge = Math.round((baseFare + distanceFare) * (config.night_surcharge_percent / 100));
    // Night prices have wider range
    minPrice += timeSurcharge;
    maxPrice += Math.round(timeSurcharge * 1.5);
  }
  
  // Safety surcharge (forced vehicle instead of walking)
  if (forcedVehicle) {
    safetySurcharge = Math.round((baseFare + distanceFare) * (config.safety_surcharge_percent / 100));
  }
  
  const total = baseFare + distanceFare + timeSurcharge + safetySurcharge;
  
  // Round to nearest 50
  const roundedTotal = Math.ceil(total / 50) * 50;
  const roundedMin = Math.ceil(minPrice / 50) * 50;
  const roundedMax = Math.ceil(maxPrice / 50) * 50;
  
  return {
    base_fare: baseFare,
    distance_fare: distanceFare,
    time_surcharge: timeSurcharge,
    safety_surcharge: safetySurcharge,
    total: roundedTotal,
    currency: 'NGN',
    min_price: roundedMin,
    max_price: roundedMax,
    is_negotiable: true,
    is_night_price: isNight,
    breakdown: isNight 
      ? `Night fare: ₦${roundedMin} - ₦${roundedMax} (negotiable)`
      : `₦${roundedMin} - ₦${roundedMax} (negotiable)`,
  };
}

/**
 * Calculate Okada (motorcycle) price
 */
export function calculateOkadaPrice(
  distanceKm: number,
  date: Date = new Date(),
  forcedVehicle: boolean = false,
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): PriceEstimate {
  let baseFare: number;
  let distanceFare: number;
  let minPrice: number;
  let maxPrice: number;
  
  // Short trips have flat rate
  if (distanceKm <= 2) {
    baseFare = config.okada_short_trip_min;
    distanceFare = 0;
    minPrice = config.okada_short_trip_min;
    maxPrice = config.okada_short_trip_max;
  } else {
    baseFare = config.okada_short_trip_min;
    distanceFare = Math.round((distanceKm - 1) * config.okada_rate_per_km);
    minPrice = baseFare + distanceFare - 50;
    maxPrice = baseFare + distanceFare + 100;
  }
  
  let timeSurcharge = 0;
  let safetySurcharge = 0;
  let isNight = false;
  
  if (isNightTime(date)) {
    isNight = true;
    // Okada has higher night surcharge (risky at night)
    timeSurcharge = Math.round((baseFare + distanceFare) * (config.night_surcharge_percent * 1.5 / 100));
    minPrice += timeSurcharge;
    maxPrice += Math.round(timeSurcharge * 1.5);
  }
  
  if (forcedVehicle) {
    safetySurcharge = Math.round((baseFare + distanceFare) * (config.safety_surcharge_percent / 100));
  }
  
  const total = baseFare + distanceFare + timeSurcharge + safetySurcharge;
  
  const roundedTotal = Math.ceil(total / 50) * 50;
  const roundedMin = Math.ceil(minPrice / 50) * 50;
  const roundedMax = Math.ceil(maxPrice / 50) * 50;
  
  return {
    base_fare: baseFare,
    distance_fare: distanceFare,
    time_surcharge: timeSurcharge,
    safety_surcharge: safetySurcharge,
    total: roundedTotal,
    currency: 'NGN',
    min_price: roundedMin,
    max_price: roundedMax,
    is_negotiable: true,
    is_night_price: isNight,
    breakdown: isNight
      ? `Night fare: ₦${roundedMin} - ₦${roundedMax} (negotiable)`
      : `₦${roundedMin} - ₦${roundedMax} (negotiable)`,
  };
}

/**
 * Calculate Ferry price
 */
export function calculateFerryPrice(
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): PriceEstimate {
  return {
    base_fare: config.ferry_base_fare,
    distance_fare: 0,
    time_surcharge: 0,
    safety_surcharge: 0,
    total: config.ferry_base_fare,
    currency: 'NGN',
    breakdown: `Ferry fare: ₦${config.ferry_base_fare}`,
  };
}

// ============================================================
// MAIN PRICING FUNCTION
// ============================================================

export interface PricingOptions {
  distanceKm: number;
  mode: TransitMode;
  departureTime?: Date;
  forcedVehicle?: boolean;  // True if forced to take vehicle due to safety
  config?: PricingConfig;
}

/**
 * Calculate price for any transit mode
 */
export function calculatePrice(options: PricingOptions): PriceEstimate {
  const {
    distanceKm,
    mode,
    departureTime = new Date(),
    forcedVehicle = false,
    config = DEFAULT_PRICING_CONFIG,
  } = options;
  
  switch (mode) {
    case 'walk':
      return calculateWalkPrice();
    
    case 'danfo':
      return calculateDanfoPrice(distanceKm, departureTime, config);
    
    case 'brt':
      return calculateBRTPrice(distanceKm, config);
    
    case 'keke':
      return calculateKekePrice(distanceKm, departureTime, forcedVehicle, config);
    
    case 'okada':
      return calculateOkadaPrice(distanceKm, departureTime, forcedVehicle, config);
    
    case 'ferry':
      return calculateFerryPrice(config);
    
    case 'uber':
    case 'bolt':
      // For ride-hailing, we estimate based on keke pricing * 2
      const rideHailPrice = calculateKekePrice(distanceKm, departureTime, false, config);
      return {
        ...rideHailPrice,
        total: rideHailPrice.total * 2,
        min_price: rideHailPrice.min_price ? rideHailPrice.min_price * 2 : undefined,
        max_price: rideHailPrice.max_price ? rideHailPrice.max_price * 2 : undefined,
        is_negotiable: false,
        breakdown: `Ride-hailing estimate: ₦${rideHailPrice.total * 2}`,
      };
    
    default:
      return calculateWalkPrice();
  }
}

/**
 * Format price for display
 */
export function formatPrice(price: PriceEstimate): string {
  if (price.total === 0) {
    return 'Free';
  }
  
  if (price.is_negotiable && price.min_price && price.max_price) {
    return `₦${price.min_price.toLocaleString()} - ₦${price.max_price.toLocaleString()}`;
  }
  
  return `₦${price.total.toLocaleString()}`;
}

/**
 * Calculate total price for multiple legs
 */
export function calculateTotalPrice(prices: PriceEstimate[]): PriceEstimate {
  const totals = prices.reduce(
    (acc, p) => ({
      base_fare: acc.base_fare + p.base_fare,
      distance_fare: acc.distance_fare + p.distance_fare,
      time_surcharge: acc.time_surcharge + p.time_surcharge,
      safety_surcharge: acc.safety_surcharge + p.safety_surcharge,
      total: acc.total + p.total,
      min_total: acc.min_total + (p.min_price || p.total),
      max_total: acc.max_total + (p.max_price || p.total),
      has_night: acc.has_night || !!p.is_night_price,
      has_peak: acc.has_peak || !!p.is_peak_price,
    }),
    {
      base_fare: 0,
      distance_fare: 0,
      time_surcharge: 0,
      safety_surcharge: 0,
      total: 0,
      min_total: 0,
      max_total: 0,
      has_night: false,
      has_peak: false,
    }
  );
  
  return {
    base_fare: totals.base_fare,
    distance_fare: totals.distance_fare,
    time_surcharge: totals.time_surcharge,
    safety_surcharge: totals.safety_surcharge,
    total: totals.total,
    currency: 'NGN',
    min_price: totals.min_total,
    max_price: totals.max_total,
    is_night_price: totals.has_night,
    is_peak_price: totals.has_peak,
    breakdown: `Total: ₦${totals.min_total.toLocaleString()} - ₦${totals.max_total.toLocaleString()}`,
  };
}
