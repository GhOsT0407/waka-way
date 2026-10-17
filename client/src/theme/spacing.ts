// Spacing and radius — the 4pt system from the redesign canvas.
//
// Space is the only spacing scale; Radius is the only radius set. The older
// SPACING / BORDER_RADIUS objects in utils/constants.ts are aliases onto these
// so the ~220 existing call sites keep compiling, but new code should import
// from here.

export const Space = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  xxxl: 48,
} as const;

// 10 / 12 / 16 / 20 / pill. The audit found twelve distinct radii in use,
// including 19 and 9 — almost certainly 20 and 10 minus a border width. Those
// are what this set replaces.
export const Radius = {
  sm:   10,   // chips, small controls
  md:   12,   // list rows, inputs
  lg:   16,   // cards, sheets, the search field
  xl:   20,   // large surfaces
  pill: 999,
} as const;

// Minimum touch target on both platforms.
export const HIT = 44;
