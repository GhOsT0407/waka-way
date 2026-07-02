// WakaWay design system v2
// Palette: danfo orange + arrival green. Brand accents stay constant across
// themes; only the neutral canvas (bg/text/border) flips for day vs night.

export interface WWColors {
  orange: string; orangeGlow: string; orangeDim: string;
  green: string; greenGlow: string; greenDim: string;
  stripe: string; stripeDim: string;
  bg: string; bgSurface: string; bgElevated: string; bgOverlay: string;
  text: string; textSub: string; textMuted: string;
  textOnOrange: string; textOnGreen: string;
  border: string; borderStrong: string; divider: string;
  danfo: string; danfoText: string;
  brt: string; brtText: string;
  keke: string; kekeText: string;
  okada: string; okadaText: string;
  walk: string; walkText: string;
  ferry: string; ferryText: string;
  error: string; warning: string;
  scrim: string; frosted: string;
}

export const WW_DARK: WWColors = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  orange:        '#F5C518',   // danfo yellow — primary action / CTA
  orangeGlow:    '#F7D44A',   // hover / lighter state
  orangeDim:     'rgba(245,197,24,0.15)',
  green:         '#5DBB63',   // nature grass green — arrival / success / safe
  greenGlow:     '#7DCF81',
  greenDim:      'rgba(93,187,99,0.15)',

  // ── Danfo stripe — the brand motif ─────────────────────────────────────────
  stripe:        '#F5C518',   // danfo yellow stripe — brand motif (same as primary)
  stripeDim:     'rgba(245,197,24,0.2)',

  // ── Backgrounds ────────────────────────────────────────────────────────────
  bg:            '#080D0B',   // near-black forest dark
  bgSurface:     '#0F1610',   // card surface
  bgElevated:    '#162019',   // elevated card
  bgOverlay:     'rgba(8,13,11,0.92)',

  // ── Text ───────────────────────────────────────────────────────────────────
  text:          '#F0F5F2',
  textSub:       'rgba(240,245,242,0.6)',
  textMuted:     'rgba(240,245,242,0.35)',
  textOnOrange:  '#FFFFFF',
  textOnGreen:   '#FFFFFF',

  // ── Borders & dividers ─────────────────────────────────────────────────────
  border:        'rgba(240,245,242,0.08)',
  borderStrong:  'rgba(240,245,242,0.16)',
  divider:       'rgba(240,245,242,0.06)',

  // ── Transport mode colors ───────────────────────────────────────────────────
  danfo:         '#F5C518',
  danfoText:     '#111111',
  brt:           '#2563EB',
  brtText:       '#FFFFFF',
  keke:          '#5DBB63',
  kekeText:      '#FFFFFF',
  okada:         '#EF4444',
  okadaText:     '#FFFFFF',
  walk:          'rgba(240,245,242,0.25)',
  walkText:      '#F0F5F2',
  ferry:         '#0EA5E9',
  ferryText:     '#FFFFFF',

  // ── Semantic ────────────────────────────────────────────────────────────────
  error:         '#FF4444',
  warning:       '#F5C518',
  scrim:         'rgba(0,0,0,0.7)',
  frosted:       'rgba(8,13,11,0.85)',
} as const;

export const WW_LIGHT: WWColors = {
  // ── Brand — identical to dark, brand accents don't change with theme ───────
  orange:        '#F5C518',
  orangeGlow:    '#F7D44A',
  orangeDim:     'rgba(245,197,24,0.15)',
  green:         '#5DBB63',
  greenGlow:     '#7DCF81',
  greenDim:      'rgba(93,187,99,0.15)',

  stripe:        '#F5C518',
  stripeDim:     'rgba(245,197,24,0.2)',

  // ── Backgrounds ────────────────────────────────────────────────────────────
  bg:            '#F5F7F5',
  bgSurface:     '#FFFFFF',
  bgElevated:    '#EFF2EF',
  bgOverlay:     'rgba(255,255,255,0.94)',

  // ── Text ───────────────────────────────────────────────────────────────────
  text:          '#0A0F0C',
  textSub:       'rgba(10,15,12,0.62)',
  textMuted:     'rgba(10,15,12,0.38)',
  textOnOrange:  '#FFFFFF',
  textOnGreen:   '#FFFFFF',

  // ── Borders & dividers ─────────────────────────────────────────────────────
  border:        'rgba(10,15,12,0.10)',
  borderStrong:  'rgba(10,15,12,0.18)',
  divider:       'rgba(10,15,12,0.08)',

  // ── Transport mode colors — identical to dark ──────────────────────────────
  danfo:         '#F5C518',
  danfoText:     '#111111',
  brt:           '#2563EB',
  brtText:       '#FFFFFF',
  keke:          '#5DBB63',
  kekeText:      '#FFFFFF',
  okada:         '#EF4444',
  okadaText:     '#FFFFFF',
  walk:          'rgba(10,15,12,0.10)',
  walkText:      '#0A0F0C',
  ferry:         '#0EA5E9',
  ferryText:     '#FFFFFF',

  // ── Semantic ────────────────────────────────────────────────────────────────
  error:         '#FF4444',
  warning:       '#F5C518',
  scrim:         'rgba(0,0,0,0.5)',
  frosted:       'rgba(255,255,255,0.9)',
} as const;

// Legacy default — static dark palette, kept so any import I haven't yet
// rewired to theme context still resolves instead of crashing.
export const WW = WW_DARK;

// Legacy aliases — used by components not yet migrated
export const Colors = {
  mapBackground:   WW.bg,
  surface:         WW.bgSurface,
  surfaceElevated: WW.bgElevated,
  textPrimary:     WW.text,
  textSecondary:   WW.textSub,
  textTertiary:    WW.textMuted,
  blue:            WW.orange,
  blueLight:       WW.orangeDim,
  blueDeep:        '#CC4400',
  border:          WW.border,
  divider:         WW.divider,
  sheetBg:         WW.bgSurface,
  scrim:           WW.scrim,
  weatherBg:       WW.bgElevated,
  favoriteGold:    WW.danfo,
  workBlue:        WW.brt,
  homeGreen:       WW.keke,
  savedGray:       WW.textSub,
  addDark:         WW.bgElevated,
  success:         WW.green,
  warning:         WW.warning,
  error:           WW.error,
  accent:          WW.orange,
  accentSubtle:    WW.orangeDim,
} as const;

// Light/Dark exports kept for ThemeContext compatibility
export const LightColors = {
  bg:              '#F5F7F5',
  surface:         '#FFFFFF',
  surfaceSecondary:'#F0F2F0',
  accent:          WW.orange,
  accentSubtle:    WW.orangeDim,
  textPrimary:     '#0A0F0C',
  textSecondary:   '#4A5550',
  textMuted:       '#8A9590',
  textOnAccent:    '#111111',   // dark text on yellow (better contrast than white)
  divider:         '#E5E8E5',
  success:         WW.green,
  successSubtle:   WW.greenDim,

  warning:         WW.stripe,
  warningSubtle:   WW.stripeDim,
  error:           WW.error,
  errorSubtle:     'rgba(255,68,68,0.1)',
  transportDanfo:  WW.danfo,
  transportBRT:    WW.brt,
  transportKeke:   WW.keke,
  transportOkada:  WW.okada,
  scrim:           'rgba(0,0,0,0.4)',
} as const;

export const DarkColors = {
  bg:              WW.bg,
  surface:         WW.bgSurface,
  surfaceSecondary:WW.bgElevated,
  accent:          WW.orange,
  accentSubtle:    WW.orangeDim,
  textPrimary:     WW.text,
  textSecondary:   WW.textSub,
  textMuted:       WW.textMuted,
  textOnAccent:    '#FFFFFF',
  divider:         WW.divider,
  success:         WW.green,
  successSubtle:   WW.greenDim,

  warning:         WW.stripe,
  warningSubtle:   WW.stripeDim,
  error:           WW.error,
  errorSubtle:     'rgba(255,68,68,0.1)',
  transportDanfo:  WW.danfo,
  transportBRT:    WW.brt,
  transportKeke:   WW.keke,
  transportOkada:  WW.okada,
  scrim:           WW.scrim,
} as const;
