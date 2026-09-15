import {
  calculateDistance,
  formatPrice,
  classifyTrip,
  calculateSmartRoute,
} from '../smartRoutingService';

describe('calculateDistance (Haversine)', () => {
  it('returns 0 for identical coordinates', () => {
    expect(calculateDistance(6.5244, 3.3792, 6.5244, 3.3792)).toBe(0);
  });

  it('matches the known distance between Ikeja and CMS (~15-17km)', () => {
    // Ikeja: 6.6018, 3.3515 — CMS (Lagos Island): 6.4555, 3.3938
    const distance = calculateDistance(6.6018, 3.3515, 6.4555, 3.3938);
    expect(distance).toBeGreaterThan(14);
    expect(distance).toBeLessThan(19);
  });

  it('is symmetric', () => {
    const a = calculateDistance(6.5244, 3.3792, 6.4555, 3.3938);
    const b = calculateDistance(6.4555, 3.3938, 6.5244, 3.3792);
    expect(a).toBeCloseTo(b, 10);
  });
});

describe('formatPrice', () => {
  it('formats a free (walk) leg', () => {
    expect(formatPrice(0, 0)).toBe('Free');
  });

  it('formats a fixed single price', () => {
    expect(formatPrice(500, 500)).toBe('₦500');
  });

  it('formats a price range with thousands separators', () => {
    expect(formatPrice(1500, 2500)).toBe('₦1,500 – ₦2,500');
  });
});

describe('classifyTrip', () => {
  it('classifies sub-2km trips as micro', () => {
    expect(classifyTrip(0)).toBe('micro');
    expect(classifyTrip(1.99)).toBe('micro');
  });

  it('classifies 2-8km trips as short', () => {
    expect(classifyTrip(2)).toBe('short');
    expect(classifyTrip(7.99)).toBe('short');
  });

  it('classifies 8-25km trips as medium', () => {
    expect(classifyTrip(8)).toBe('medium');
    expect(classifyTrip(24.99)).toBe('medium');
  });

  it('classifies 25km+ trips as long', () => {
    expect(classifyTrip(25)).toBe('long');
    expect(classifyTrip(100)).toBe('long');
  });
});

describe('calculateSmartRoute', () => {
  it('returns at least one structurally valid option for a real long-distance Lagos trip', () => {
    // Ikorodu Terminal -> TBS Terminal (the BRT spine's full length)
    const result = calculateSmartRoute(6.6176, 3.5027, 'Ikorodu', 6.4531, 3.3898, 'TBS');

    expect(result.options.length).toBeGreaterThan(0);
    // Straight-line (Haversine) distance is shorter than the ~22km road
    // corridor, so this lands in 'medium', not 'long' — classifyTrip is
    // tested against its own boundaries separately above.
    expect(result.tripBand).toBe('medium');

    const recommended = result.options.find(o => o.id === result.recommendedOptionId);
    expect(recommended).toBeDefined();
    expect(recommended?.isRecommended).toBe(true);

    for (const option of result.options) {
      expect(option.legs.length).toBeGreaterThan(0);
      expect(option.totalDistanceKm).toBeGreaterThan(0);
      expect(option.totalDurationMins).toBeGreaterThan(0);
      expect(option.totalPriceMax).toBeGreaterThanOrEqual(option.totalPriceMin);
      for (const leg of option.legs) {
        expect(leg.distanceKm).toBeGreaterThanOrEqual(0);
        expect(leg.priceMax).toBeGreaterThanOrEqual(leg.priceMin);
        expect(leg.instruction.length).toBeGreaterThan(0);
        expect(leg.localInstruction.length).toBeGreaterThan(0);
      }
    }

    const cheapestCount = result.options.filter(o => o.isCheapest).length;
    const fastestCount = result.options.filter(o => o.isFastest).length;
    expect(cheapestCount).toBe(1);
    expect(fastestCount).toBe(1);
  });

  it('returns a direct short route for a walkable micro trip', () => {
    // Two points ~500m apart
    const result = calculateSmartRoute(6.5244, 3.3792, 'A', 6.5289, 3.3792, 'B');
    expect(result.tripBand).toBe('micro');
    expect(result.options.length).toBeGreaterThan(0);
    expect(result.options[0].legs.length).toBeGreaterThanOrEqual(1);
  });

  it('never routes an okada leg between two points inside the Lagos metro okada-ban zone', () => {
    // Both points inside the banned bbox (lat 6.410-6.650, lng 3.280-3.620),
    // ~6.7km apart — within okada's normal distance range if it weren't banned.
    const result = calculateSmartRoute(6.50, 3.40, 'Banned A', 6.56, 3.40, 'Banned B');

    for (const option of result.options) {
      for (const leg of option.legs) {
        expect(leg.mode).not.toBe('okada');
      }
    }
  });

  it('produces a comparison block consistent with the returned options', () => {
    const result = calculateSmartRoute(6.6176, 3.5027, 'Ikorodu', 6.4531, 3.3898, 'TBS');
    expect(result.comparison.priceDifference).toBeGreaterThanOrEqual(0);
    expect(result.comparison.timeDifference).toBeGreaterThanOrEqual(0);
    expect(typeof result.comparison.shouldLetUserChoose).toBe('boolean');
  });
});
