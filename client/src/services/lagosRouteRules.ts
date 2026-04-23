/**
 * Lagos Route Rules — re-exports for backward compatibility.
 * Core logic has moved to smartRoutingService.ts.
 */

export function validateLagosConnection(_from: string, _to: string): { isValid: boolean } {
  return { isValid: true };
}

export function toSmartRouteMode(mode: string): string {
  return mode;
}

export function isOkadaAllowed(_from: string, _to: string): boolean {
  return false; // conservative default; real check is coordinate-based in smartRoutingService
}
