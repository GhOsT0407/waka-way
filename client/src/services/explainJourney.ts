import type { RouteOption } from './smartRoutingService';

/**
 * The trip as a message you could send a friend — what Lara users share on
 * WhatsApp and what the validation doc calls "Explain My Journey". Pidgin
 * where the engine has it, plain English otherwise.
 */
export function explainJourney(option: RouteOption, originName: string, destName: string): string {
  const lines: string[] = [];
  lines.push(`${originName} → ${destName}`);
  lines.push(`${option.priceFormatted} · about ${option.totalDurationMins} min`);
  lines.push('');
  option.legs.forEach((leg, i) => {
    const fare = leg.priceMax > 0
      ? (leg.priceMin === leg.priceMax ? ` (₦${leg.priceMax.toLocaleString()})` : ` (₦${leg.priceMin.toLocaleString()}–₦${leg.priceMax.toLocaleString()})`)
      : '';
    lines.push(`${i + 1}. ${leg.localInstruction || leg.instruction}${fare}`);
    if (leg.viaStops && leg.viaStops.length) lines.push(`   via ${leg.viaStops.join(', ')}`);
  });
  lines.push('');
  lines.push('— WakaWay');
  return lines.join('\n');
}
