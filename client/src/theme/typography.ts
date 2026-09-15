// Type — Plus Jakarta Sans throughout, on the scale from the redesign canvas.
//
// One scale, one job per size:
//   hero 34  maneuver distance, the number that leads a screen
//   xxl  28  route-detail header figure
//   xl   22  screen titles
//   lg   17  body large — row names, buttons, the search field
//   md   15  body
//   sm   13  captions, row subtitles, status pills
//   xs   11  tab labels, uppercase eyebrows
//
// FONT_SIZES in utils/constants.ts is an alias onto this scale for the ~95
// existing call sites; new code should use Typography.

export const Fonts = {
  thin:      'PlusJakartaSans_300Light',
  regular:   'PlusJakartaSans_400Regular',
  medium:    'PlusJakartaSans_500Medium',
  semibold:  'PlusJakartaSans_600SemiBold',
  bold:      'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const Typography = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   22,
  xxl:  28,
  hero: 34,

  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
} as const;

// Line heights paired to the scale, so screens stop setting them by hand.
// Tight for display sizes, 1.4–1.5 for anything read as a sentence.
export const LineHeight = {
  xs:   14,
  sm:   18,
  md:   21,
  lg:   24,
  xl:   27,
  xxl:  31,
  hero: 36,
} as const;

// Uppercase eyebrows and tab labels get a touch of tracking; nothing else does.
export const Tracking = {
  eyebrow: 0.8,
  none:    0,
  tight:   -0.4,   // display sizes only
} as const;
