/**
 * WakaWay Guide Generator
 * 
 * Generates Lagos-specific navigation instructions with:
 * - Local terminology and pidgin English
 * - "Owa!" nudges for approaching stops
 * - Landmark-based directions
 * - Safety tips for night travel
 */

import { 
  MultimodalRoute, 
  RouteLeg, 
  GuideStep, 
  TransitMode,
  LegType,
} from '../types/routing';
import { formatPrice } from './pricingService';

// ============================================================
// LAGOS TERMINOLOGY
// ============================================================

const TRANSIT_NAMES: Record<TransitMode, { formal: string; local: string }> = {
  walk: { formal: 'Walk', local: 'Waka' },
  keke: { formal: 'Keke (Tricycle)', local: 'Keke' },
  okada: { formal: 'Okada (Motorcycle)', local: 'Okada' },
  danfo: { formal: 'Danfo (Yellow Bus)', local: 'Danfo' },
  brt: { formal: 'BRT Bus', local: 'BRT' },
  rail: { formal: 'Rail', local: 'Train' },
  uber: { formal: 'Uber', local: 'Uber' },
  bolt: { formal: 'Bolt', local: 'Bolt' },
};

const DIRECTION_PHRASES = {
  going_to: [
    'heading to',
    'going to',
    'wey dey go',
  ],
  stop_at: [
    'stop at',
    'drop me at',
    'I wan stop for',
  ],
  approaching: [
    'When you see',
    'As you approach',
    'When you reach',
  ],
};

// ============================================================
// INSTRUCTION GENERATORS
// ============================================================

/**
 * Generate first-mile instruction
 */
function generateFirstMileInstruction(leg: RouteLeg): string {
  const distanceM = Math.round(leg.distance_meters);
  const endName = leg.end.name || 'the stop';
  
  if (leg.mode === 'walk') {
    if (leg.is_long_walk) {
      return `This is a ${distanceM}m walk. Consider taking a Keke if available.`;
    }
    return `Walk ${distanceM}m to ${endName}.`;
  }
  
  const mode = TRANSIT_NAMES[leg.mode];
  if (leg.has_pivot && leg.pivot_reason) {
    return `${leg.pivot_reason} Take a ${mode.local} to ${endName}.`;
  }
  
  return `Take a ${mode.local} to ${endName}.`;
}

/**
 * Generate connector instruction
 */
function generateConnectorInstruction(leg: RouteLeg): string {
  const mode = TRANSIT_NAMES[leg.mode];
  const startName = leg.start.name || 'here';
  const endName = leg.end.name || 'there';
  
  return `Enter a ${mode.local} from ${startName} to ${endName}.`;
}

/**
 * Generate main transit instruction
 */
function generateMainTransitInstruction(leg: RouteLeg): string {
  const mode = TRANSIT_NAMES[leg.mode];
  const endName = leg.end.name || 'your destination';
  
  let instruction = `Board a ${mode.formal} heading to ${endName}.`;
  
  // Add conductor tip for Danfo
  if (leg.mode === 'danfo') {
    instruction += ` Tell the conductor "${endName}".`;
  }
  
  return instruction;
}

/**
 * Generate last-mile instruction
 */
function generateLastMileInstruction(leg: RouteLeg): string {
  const endName = leg.end.name || 'your destination';
  
  if (leg.mode === 'walk') {
    const distanceM = Math.round(leg.distance_meters);
    return `Walk ${distanceM}m to ${endName}.`;
  }
  
  const mode = TRANSIT_NAMES[leg.mode];
  return `At ${leg.start.name}, enter a ${mode.local} going toward ${endName}.`;
}

/**
 * Generate the "Owa!" nudge for a leg
 */
function generateNudge(leg: RouteLeg, isLastMile: boolean): string | undefined {
  const endName = leg.end.name || 'your destination';
  
  if (leg.mode === 'danfo' || leg.mode === 'brt') {
    if (isLastMile) {
      return `🔔 The ${TRANSIT_NAMES[leg.mode].local} will pass your destination before the next stop. Watch for "${endName}" and shout "Owa!" immediately when you see it.`;
    }
    return `💡 Tell the conductor you're dropping at "${endName}". When close, shout "Owa!" to signal you want to stop.`;
  }
  
  if (leg.mode === 'keke' || leg.mode === 'okada') {
    if (isLastMile) {
      return `💡 Tell the driver to stop at "${endName}". Say "Stop for ${endName}" when you're close.`;
    }
    return `💡 Agree on the fare before entering. Ask "How much go ${endName}?"`;
  }
  
  return undefined;
}

/**
 * Generate local (pidgin) instruction
 */
function generateLocalInstruction(leg: RouteLeg): string {
  const mode = TRANSIT_NAMES[leg.mode];
  const endName = leg.end.name || 'there';
  
  switch (leg.mode) {
    case 'walk':
      return `Waka go ${endName}`;
    
    case 'keke':
    case 'okada':
      return `Enter ${mode.local} wey go ${endName}`;
    
    case 'danfo':
      return `Enter bus wey dey go ${endName}. Tell conductor say "${endName}"`;
    
    case 'brt':
      return `Enter BRT go ${endName}`;
    
    default:
      return `Go ${endName}`;
  }
}

// ============================================================
// MAIN GUIDE GENERATOR
// ============================================================

export interface GuideOptions {
  includeLocalInstructions?: boolean;
  includeNightTips?: boolean;
  includeNudges?: boolean;
}

/**
 * Generate complete guide steps from a route
 */
export function generateGuideSteps(
  route: MultimodalRoute,
  options: GuideOptions = {}
): GuideStep[] {
  const {
    includeLocalInstructions = true,
    includeNightTips = true,
    includeNudges = true,
  } = options;
  
  const steps: GuideStep[] = [];
  const isNight = route.is_night_route;
  
  // Add night safety warning if applicable
  if (isNight && includeNightTips && route.legs.length > 0) {
    // This will be shown as a header message, not a step
  }
  
  route.legs.forEach((leg, index) => {
    const isLastLeg = index === route.legs.length - 1;
    let instruction: string;
    
    // Generate appropriate instruction based on leg type
    switch (leg.type) {
      case 'first_mile':
        instruction = generateFirstMileInstruction(leg);
        break;
      case 'connector':
        instruction = generateConnectorInstruction(leg);
        break;
      case 'main_transit':
        instruction = generateMainTransitInstruction(leg);
        break;
      case 'last_mile':
        instruction = generateLastMileInstruction(leg);
        break;
      default:
        instruction = leg.instruction;
    }
    
    // Generate nudge
    const nudge = includeNudges ? generateNudge(leg, isLastLeg) : undefined;
    
    // Build guide step
    const step: GuideStep = {
      step_number: index + 1,
      leg_type: leg.type,
      mode: leg.mode,
      icon: getModeIcon(leg.mode),
      title: getStepTitle(leg, index + 1, route.legs.length),
      description: instruction,
      price_text: formatPrice(leg.price_estimate),
      nudge,
      location: leg.end,
      duration_text: formatDuration(leg.duration_minutes),
    };
    
    steps.push(step);
  });
  
  return steps;
}

/**
 * Generate a summary title for each step
 */
function getStepTitle(leg: RouteLeg, stepNum: number, totalSteps: number): string {
  const mode = TRANSIT_NAMES[leg.mode];
  const endName = leg.end.name || 'destination';
  
  if (stepNum === 1) {
    if (leg.mode === 'walk') {
      return `Walk to ${endName}`;
    }
    return `Take ${mode.local} to ${endName}`;
  }
  
  if (stepNum === totalSteps) {
    if (leg.mode === 'walk') {
      return `Arrive at destination`;
    }
    return `Final ${mode.local} to destination`;
  }
  
  if (leg.type === 'main_transit') {
    return `Board ${mode.formal}`;
  }
  
  return `${mode.formal} to ${endName}`;
}

/**
 * Get icon name for mode
 */
function getModeIcon(mode: TransitMode): string {
  const icons: Record<TransitMode, string> = {
    walk: 'walk-outline',
    keke: 'car-outline',
    okada: 'bicycle-outline',
    danfo: 'bus-outline',
    brt: 'bus',
    rail: 'train-outline',
    uber: 'car-sport-outline',
    bolt: 'car-sport-outline',
  };
  return icons[mode] || 'help-circle-outline';
}

/**
 * Format duration for display
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

// ============================================================
// FORMATTED OUTPUT GENERATORS
// ============================================================

/**
 * Generate a text summary of the route
 */
export function generateRouteSummary(route: MultimodalRoute): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`🗺️ Route to ${route.destination.name || 'Destination'}`);
  lines.push(`⏱️ ${formatDuration(route.total_duration_minutes)} • 💰 ${formatPrice(route.total_price)}`);
  lines.push('');
  
  // Safety warnings
  if (route.safety_alerts.length > 0) {
    lines.push('⚠️ SAFETY ALERTS:');
    route.safety_alerts.forEach(alert => {
      lines.push(`  • ${alert.message}`);
    });
    lines.push('');
  }
  
  // Night warning
  if (route.is_night_route) {
    lines.push('🌙 Night travel: Vehicle routes recommended for safety');
    lines.push('');
  }
  
  // First-mile pivot
  if (route.has_first_mile_pivot && route.first_mile_pivot_reason) {
    lines.push(`💡 ${route.first_mile_pivot_reason}`);
    lines.push('');
  }
  
  // Steps
  lines.push('📍 DIRECTIONS:');
  route.guide_steps.forEach(step => {
    lines.push(`${step.step_number}. ${step.title}`);
    lines.push(`   ${step.description}`);
    lines.push(`   Est: ${step.price_text} • ${step.duration_text}`);
    if (step.nudge) {
      lines.push(`   ${step.nudge}`);
    }
    lines.push('');
  });
  
  return lines.join('\n');
}

/**
 * Generate formatted guide for UI display
 */
export interface FormattedGuide {
  header: {
    destination: string;
    duration: string;
    price: string;
    isNight: boolean;
    isPeak: boolean;
  };
  warnings: string[];
  pivotMessage?: string;
  steps: GuideStep[];
  arrivalNudge: string;
}

export function generateFormattedGuide(route: MultimodalRoute): FormattedGuide {
  return {
    header: {
      destination: route.destination.name || 'Destination',
      duration: formatDuration(route.total_duration_minutes),
      price: formatPrice(route.total_price),
      isNight: route.is_night_route,
      isPeak: route.is_peak_hours,
    },
    warnings: route.safety_alerts.map(a => a.message),
    pivotMessage: route.first_mile_pivot_reason,
    steps: route.guide_steps,
    arrivalNudge: `When you see ${route.destination.name || 'your destination'}, signal "Owa!" immediately`,
  };
}

// ============================================================
// ARRIVAL MESSAGES
// ============================================================

/**
 * Generate arrival nudge message
 */
export function generateArrivalNudge(
  distanceMeters: number,
  destinationName: string
): string {
  if (distanceMeters <= 100) {
    return `🎯 You've arrived at ${destinationName}!`;
  }
  
  if (distanceMeters <= 200) {
    return `📍 Almost there! ${destinationName} is ${distanceMeters}m ahead.`;
  }
  
  if (distanceMeters <= 300) {
    return `🔔 Approaching ${destinationName} (${distanceMeters}m). Prepare to stop!`;
  }
  
  return `📍 ${destinationName} is ${distanceMeters}m away.`;
}

/**
 * Generate "Owa!" reminder for bus passengers
 */
export function generateOwaReminder(
  distanceMeters: number,
  destinationName: string,
  mode: TransitMode
): string {
  if (mode !== 'danfo' && mode !== 'brt') {
    return generateArrivalNudge(distanceMeters, destinationName);
  }
  
  if (distanceMeters <= 150) {
    return `🚨 NOW! Shout "OWA!" - ${destinationName} is here!`;
  }
  
  if (distanceMeters <= 300) {
    return `⚠️ Get ready to shout "Owa!" - ${destinationName} is ${distanceMeters}m ahead!`;
  }
  
  return `📍 ${destinationName} coming up in ${distanceMeters}m. Watch for your stop!`;
}
