// Transport Pricing Engine for WakaWay Lagos Transit App
// Based on 2025 Lagos transport benchmarks

export enum TransportMode {
  DANFO = 'DANFO',
  KEKE = 'KEKE',
  OKADA = 'OKADA'
}

export interface PricingRates {
  base: number;  // Base fare in Naira
  km: number;    // Per kilometer rate in Naira
  min: number;   // Minimum fare in Naira
}

export interface PricingMultipliers {
  peakHour: number;
  weather: number;
  fuelScarcity: number;
}

export interface PricingOptions {
  distanceInKm: number;
  transportMode: TransportMode;
  isPeakHour?: boolean;
  isRaining?: boolean;
  isFuelScarce?: boolean;
}

export interface PriceRange {
  min: number;
  max: number;
  estimated: number;
  formatted: string;
}

// 2025 Lagos Transport Benchmarks
export const LAGOS_RATES: Record<TransportMode, PricingRates> = {
  [TransportMode.DANFO]: { base: 400, km: 180, min: 600 },
  [TransportMode.KEKE]: { base: 300, km: 150, min: 400 },
  [TransportMode.OKADA]: { base: 500, km: 300, min: 800 }
};

// Multipliers for Lagos environmental factors
export const LAGOS_MULTIPLIERS: PricingMultipliers = {
  peakHour: 1.5,      // Rush hour surge
  weather: 2.0,       // Rain premium
  fuelScarcity: 1.3   // Fuel scarcity surcharge
};

export class TransportPricingEngine {
  /**
   * Calculate fare for a Lagos transport trip
   * Formula: Total Fare = (Base + (Distance × PerKM)) × Multipliers
   */
  static calculateFare(options: PricingOptions): number {
    const { distanceInKm, transportMode, isPeakHour = false, isRaining = false, isFuelScarce = false } = options;

    const rates = LAGOS_RATES[transportMode];
    if (!rates) {
      throw new Error(`Invalid transport mode: ${transportMode}`);
    }

    // Base calculation: Base + (Distance × Per KM Rate)
    let fare = rates.base + (distanceInKm * rates.km);

    // Apply multipliers
    let multiplier = 1.0;

    if (isPeakHour) {
      multiplier *= LAGOS_MULTIPLIERS.peakHour;
    }

    if (isRaining) {
      multiplier *= LAGOS_MULTIPLIERS.weather;
    }

    if (isFuelScarce) {
      multiplier *= LAGOS_MULTIPLIERS.fuelScarcity;
    }

    fare *= multiplier;

    // Ensure minimum fare
    fare = Math.max(fare, rates.min);

    return Math.round(fare);
  }

  /**
   * Get price range with ±10% variation to account for conductor haggling
   */
  static getPriceRange(options: PricingOptions): PriceRange {
    const estimated = this.calculateFare(options);

    // Create range: ±10% to account for real-world price variation
    const variation = estimated * 0.1;
    const min = Math.max(estimated - variation, LAGOS_RATES[options.transportMode].min);
    const max = estimated + variation;

    // Format as currency string
    const formatPrice = (price: number): string => {
      return `₦${Math.round(price).toLocaleString()}`;
    };

    return {
      min: Math.round(min),
      max: Math.round(max),
      estimated,
      formatted: `${formatPrice(min)} - ${formatPrice(max)}`
    };
  }

  /**
   * Check if current time is peak hour in Lagos
   * Peak hours: 6:30 AM–10:00 AM & 4:00 PM–8:30 PM
   */
  static isPeakHour(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;

    // Morning peak: 6:30 AM - 10:00 AM (390 - 600 minutes)
    const morningPeakStart = 6 * 60 + 30; // 390
    const morningPeakEnd = 10 * 60; // 600

    // Evening peak: 4:00 PM - 8:30 PM (960 - 1410 minutes)
    const eveningPeakStart = 16 * 60; // 960
    const eveningPeakEnd = 20 * 60 + 30; // 1230

    return (currentTime >= morningPeakStart && currentTime <= morningPeakEnd) ||
           (currentTime >= eveningPeakStart && currentTime <= eveningPeakEnd);
  }

  /**
   * Get all transport mode price ranges for a given distance
   */
  static getAllModePrices(distanceInKm: number, isRaining: boolean = false, isFuelScarce: boolean = false): Record<TransportMode, PriceRange> {
    const isPeakHour = this.isPeakHour();

    const prices: Partial<Record<TransportMode, PriceRange>> = {};

    Object.values(TransportMode).forEach(mode => {
      prices[mode] = this.getPriceRange({
        distanceInKm,
        transportMode: mode,
        isPeakHour,
        isRaining,
        isFuelScarce
      });
    });

    return prices as Record<TransportMode, PriceRange>;
  }
}