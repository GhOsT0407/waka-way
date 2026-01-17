// WakaWay - Formatting Utilities

/**
 * Format time in minutes to human-readable string
 */
export const formatTime = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} mins`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  }
  return `${hours} hr${hours > 1 ? 's' : ''} ${mins} mins`;
};

/**
 * Format distance in kilometers
 */
export const formatDistance = (km: number): string => {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
};

/**
 * Format fare in Naira
 */
export const formatFare = (amount: number | string): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `₦${numAmount.toFixed(0)}`;
};

/**
 * Format transport mode for display
 */
export const formatTransportMode = (mode: string): string => {
  const modeMap: Record<string, string> = {
    bus: 'Bus',
    keke: 'Keke',
    okada: 'Okada',
    walk: 'Walk',
  };
  return modeMap[mode] || mode;
};

/**
 * Get transport mode emoji
 */
export const getTransportEmoji = (mode: string): string => {
  const emojiMap: Record<string, string> = {
    bus: '🚌',
    keke: '🛺',
    okada: '🏍️',
    walk: '🚶',
  };
  return emojiMap[mode] || '📍';
};

/**
 * Format instruction text for route step
 */
export const formatInstruction = (
  step: {
    transport_mode: string;
    instruction?: string;
    route_number?: string;
    start_name?: string;
    end_name?: string;
  }
): string => {
  const { transport_mode, instruction, route_number, start_name, end_name } = step;
  
  if (instruction) {
    return instruction;
  }
  
  const mode = formatTransportMode(transport_mode);
  const emoji = getTransportEmoji(transport_mode);
  
  if (transport_mode === 'walk') {
    if (end_name) {
      return `${emoji} Walk to ${end_name}`;
    }
    return `${emoji} Walk`;
  }
  
  if (route_number) {
    return `${emoji} Take ${mode} #${route_number}${end_name ? ` to ${end_name}` : ''}`;
  }
  
  return `${emoji} Take ${mode}${end_name ? ` to ${end_name}` : ''}`;
};

/**
 * Format address string
 */
export const formatAddress = (address: string | null | undefined): string => {
  if (!address) return '';
  // Truncate long addresses
  if (address.length > 50) {
    return address.substring(0, 47) + '...';
  }
  return address;
};

