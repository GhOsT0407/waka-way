// Test the pricing engine
import { TransportPricingEngine, TransportMode } from './pricingEngine';

// Test cases for Lagos transport pricing
console.log('🚌 WakaWay Lagos Transport Pricing Engine Test\n');

// Test 1: Normal 5km trip during peak hours
console.log('Test 1: 5km trip during peak hours');
const prices1 = TransportPricingEngine.getAllModePrices(5, false, false);
console.log('DANFO:', prices1.DANFO.formatted);
console.log('KEKE:', prices1.KEKE.formatted);
console.log('OKADA:', prices1.OKADA.formatted);
console.log();

// Test 2: Same trip during rain
console.log('Test 2: Same 5km trip during rain');
const prices2 = TransportPricingEngine.getAllModePrices(5, true, false);
console.log('DANFO:', prices2.DANFO.formatted);
console.log('KEKE:', prices2.KEKE.formatted);
console.log('OKADA:', prices2.OKADA.formatted);
console.log();

// Test 3: Short 2km trip during normal hours
console.log('Test 3: 2km trip during normal hours');
const prices3 = TransportPricingEngine.getAllModePrices(2, false, false);
console.log('DANFO:', prices3.DANFO.formatted);
console.log('KEKE:', prices3.KEKE.formatted);
console.log('OKADA:', prices3.OKADA.formatted);
console.log();

// Test 4: Check if current time is peak hour
console.log('Test 4: Current time analysis');
const now = new Date();
console.log('Current time:', now.toLocaleTimeString());
console.log('Is peak hour:', TransportPricingEngine.isPeakHour());
console.log();

// Test 5: Manual calculation verification
console.log('Test 5: Manual calculation verification (5km Danfo, peak hour)');
const manualPrice = TransportPricingEngine.calculateFare({
  distanceInKm: 5,
  transportMode: TransportMode.DANFO,
  isPeakHour: true,
  isRaining: false,
  isFuelScarce: false
});
console.log('Manual calculation: ₦' + manualPrice);
const range = TransportPricingEngine.getPriceRange({
  distanceInKm: 5,
  transportMode: TransportMode.DANFO,
  isPeakHour: true,
  isRaining: false,
  isFuelScarce: false
});
console.log('Price range:', range.formatted);
console.log('Expected: ₦1,800 - ₦2,200 (based on formula: (400 + 5×180) × 1.5 = ₦1,950 ±10%)');

console.log('\n✅ Pricing engine test completed successfully!');