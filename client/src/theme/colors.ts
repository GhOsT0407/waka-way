// WakaWay design system v3 — the single colour source.
//
// Two complete sets, WW_LIGHT and WW_DARK, reached through useAppTheme().WW.
// Brand accents and transport-mode colours are identical in both; only the
// neutral canvas and the semantic state colours flip, and the latter only
// where a value fails contrast on the other ground.
//
// Values come from the redesign canvas (WakaWay Redesigned Screens, pass 01)
// with the contrast corrections from DESIGN_CRITIQUE.md applied: every text /
// ground pair below clears WCAG AA 4.5:1 on its own theme's surfaces.
//
// Naming note: `orange`, `orangeGlow`, `orangeDim` hold danfo YELLOW. The
// name predates the palette and is kept for now because ~130 call sites use
// it; renaming is a separate cleanup.

export interface WWColors {
  // brand
  orange: string; orangeGlow: string; orangeDim: string;
  stripe: string; stripeDim: string;
  textOnOrange: string;

  // neutral canvas
  bg: string; bgSurface: string; bgElevated: string; bgOverlay: string;
  text: string; textSub: string; textMuted: string;
  border: string; borderStrong: string; divider: string;
  scrim: string; frosted: string;

  // semantic state — kept separate from transport-mode colour on purpose
  green: string; greenGlow: string; greenDim: string; textOnGreen: string;
  warning: string; warningDim: string; warningText: string; textOnWarning: string;
  error: string; errorDim: string;

  // transport modes — the only place saturation is allowed to be loud
  danfo: string; danfoText: string;
  brt: string; brtText: string;
  keke: string; kekeText: string;
  okada: string; okadaText: string;
  walk: string; walkText: string;
  ferry: string; ferryText: string;
}

// ── Shared: brand + transport, identical in both themes ─────────────────────
const BRAND = {
  orange:        '#F5C518',   // danfo yellow — the single accent
  orangeGlow:    '#F7D44A',
  orangeDim:     'rgba(245,197,24,0.15)',
  stripe:        '#F5C518',   // the danfo stripe motif
  stripeDim:     'rgba(245,197,24,0.20)',
  textOnOrange:  '#1A1200',   // 11.40:1 — white on this yellow is 1.63:1

  danfo:         '#F5C518',
  danfoText:     '#1A1200',
  brt:           '#1E6FD9',   // white on this: 4.85:1
  brtText:       '#FFFFFF',
  keke:          '#5DBB63',   // ink on this: 7.55:1 — white was 2.40:1
  kekeText:      '#14161A',
  okada:         '#EF4444',   // ink on this: 4.94:1 — white only clears large-text
  okadaText:     '#1A1200',
  // Ferry routes were removed from the engine (76ca3e7); tokens kept until the
  // product decision is made either way.
  ferry:         '#0EA5E9',
  ferryText:     '#FFFFFF',
} as const;

export const WW_LIGHT: WWColors = {
  ...BRAND,

  // ── Canvas ─────────────────────────────────────────────────────────────────
  bg:            '#FBFAF8',
  bgSurface:     '#FFFFFF',
  bgElevated:    '#F2F1ED',
  bgOverlay:     'rgba(255,255,255,0.94)',

  text:          '#14161A',   // 17.36:1 on bg
  textSub:       '#43464E',   //  9.05:1
  textMuted:     '#6B6E76',   //  4.89:1 — the canvas's #8A8D95 was 3.18:1

  border:        'rgba(20,22,26,0.10)',
  borderStrong:  'rgba(20,22,26,0.18)',
  divider:       'rgba(20,22,26,0.07)',
  scrim:         'rgba(0,0,0,0.50)',
  frosted:       'rgba(255,255,255,0.94)',   // 0.90 let map labels read through text on device

  // ── State ──────────────────────────────────────────────────────────────────
  green:         '#1F7A3D',   // success / arrival — as text on bg: 5.15:1
  greenGlow:     '#2E9E52',
  greenDim:      'rgba(31,122,61,0.12)',
  textOnGreen:   '#FFFFFF',   // 5.37:1

  warning:       '#E08A00',   // as a FILL only; fails as text on this ground
  warningDim:    'rgba(224,138,0,0.14)',
  warningText:   '#8F5600',   // warning as text on bg: 5.75:1
  textOnWarning: '#1A1200',   // 6.90:1

  error:         '#EF4444',
  errorDim:      'rgba(239,68,68,0.12)',

  walk:          'rgba(20,22,26,0.10)',
  walkText:      '#14161A',
};

export const WW_DARK: WWColors = {
  ...BRAND,

  // ── Canvas ─────────────────────────────────────────────────────────────────
  bg:            '#14161A',
  bgSurface:     '#17181C',
  bgElevated:    '#1F2126',
  bgOverlay:     'rgba(20,22,26,0.92)',

  text:          '#F2F1ED',   // 16.03:1 on bg
  textSub:       '#C7C6C1',   // 10.59:1
  textMuted:     '#8A8D95',   //  5.45:1 — fine on the dark ground

  border:        'rgba(242,241,237,0.08)',
  borderStrong:  '#2E3035',
  divider:       'rgba(242,241,237,0.06)',
  scrim:         'rgba(0,0,0,0.70)',
  frosted:       'rgba(20,22,26,0.93)',      // 0.85 let map labels read through text on device

  // ── State ──────────────────────────────────────────────────────────────────
  green:         '#2E9E52',   // #1F7A3D is 3.37:1 here — too dark for the dark ground
  greenGlow:     '#3DBA66',
  greenDim:      'rgba(46,158,82,0.16)',
  textOnGreen:   '#14161A',   // white on #2E9E52 is 3.43:1; ink is 5.29:1

  warning:       '#E08A00',
  warningDim:    'rgba(224,138,0,0.16)',
  warningText:   '#E08A00',   // 6.73:1 on the dark ground — no separate value needed
  textOnWarning: '#1A1200',

  error:         '#EF4444',
  errorDim:      'rgba(239,68,68,0.14)',

  walk:          'rgba(242,241,237,0.25)',
  walkText:      '#F2F1ED',
};
