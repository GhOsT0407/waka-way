// Wakaway design system — danfo orange, warm white, flat design
// Light mode is the default; DarkColors exported for ThemeContext

export const LightColors = {
  bg:              '#F8F7F5',
  surface:         '#FFFFFF',
  surfaceSecondary:'#F2F1EF',
  accent:          '#E8541A',
  accentSubtle:    '#FDF0EA',
  textPrimary:     '#111111',
  textSecondary:   '#6B6B6B',
  textMuted:       '#9E9E9E',
  textOnAccent:    '#FFFFFF',
  divider:         '#E5E5E5',
  success:         '#2D7A4F',
  successSubtle:   '#EBF8F1',
  warning:         '#C8790A',
  warningSubtle:   '#FEF5E7',
  error:           '#C0392B',
  errorSubtle:     '#FDEDEC',
  transportDanfo:  '#F5C518',
  transportBRT:    '#1A5BDB',
  transportKeke:   '#2D7A4F',
  transportOkada:  '#D93025',
  scrim:           'rgba(0,0,0,0.4)',
} as const;

export const DarkColors = {
  bg:              '#111318',
  surface:         '#1C1C1E',
  surfaceSecondary:'#252528',
  accent:          '#FF6B35',
  accentSubtle:    '#2A1A10',
  textPrimary:     '#F5F5F5',
  textSecondary:   '#9E9E9E',
  textMuted:       '#666666',
  textOnAccent:    '#FFFFFF',
  divider:         '#2A2A2A',
  success:         '#4CAF82',
  successSubtle:   '#0F2A1E',
  warning:         '#F0A030',
  warningSubtle:   '#2A1C0A',
  error:           '#E05C4B',
  errorSubtle:     '#2A100D',
  transportDanfo:  '#F5C518',
  transportBRT:    '#4D88FF',
  transportKeke:   '#4CAF82',
  transportOkada:  '#E05C4B',
  scrim:           'rgba(0,0,0,0.6)',
} as const;

// Legacy alias kept for components not yet migrated.
// These now reflect light-mode values so the app doesn't
// look broken while screens are gradually updated.
export const Colors = {
  mapBackground:    LightColors.bg,
  surface:          LightColors.surface,
  surfaceElevated:  LightColors.surface,

  textPrimary:      LightColors.textPrimary,
  textSecondary:    LightColors.textSecondary,
  textTertiary:     LightColors.textMuted,

  // Accent (key "blue" kept for backward compat, value is now orange)
  blue:             LightColors.accent,
  blueLight:        LightColors.accentSubtle,
  blueDeep:         '#C4430E',

  border:           LightColors.divider,
  divider:          LightColors.divider,

  sheetBg:          LightColors.surface,
  scrim:            LightColors.scrim,
  weatherBg:        'rgba(255,255,255,0.95)',

  favoriteGold:     LightColors.transportDanfo,
  workBlue:         LightColors.transportBRT,
  homeGreen:        LightColors.transportKeke,
  savedGray:        LightColors.textSecondary,
  addDark:          LightColors.surfaceSecondary,

  success:          LightColors.success,
  warning:          LightColors.warning,
  error:            LightColors.error,
  accent:           LightColors.accent,
  accentSubtle:     LightColors.accentSubtle,
} as const;
