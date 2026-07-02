
# Theming

WakaWay v2 design system — `client/src/theme/colors.ts` and `client/src/theme/typography.ts`, driven by `ThemeContext.tsx`.

## Day/night switching

`ThemeContext` computes `isDark` automatically: night is 7pm–6am Lagos local time (no DST adjustment), re-checked every 60 seconds and on app-foreground. A `manualDark` override (or `null` for auto) lets the user pin a theme via `toggleTheme()`.

## Palettes

- **WW_DARK** (night): near-black `bg: '#080D0B'`, card surface `#0F1610'`, text `#F0F5F2`.
- **WW_LIGHT** (day): white background, dark text, same brand accents.
- **Constant brand colors across both modes**: `orange: '#F5C518'` (danfo yellow, primary action), `green: '#5DBB63'` (arrival/success).
- **Transport-mode colors**: danfo `#F5C518`, brt `#2563EB`, keke `#5DBB63`, okada `#EF4444`, ferry `#0EA5E9` — used consistently in [[Smart Routing Engine]] route legs and [[Map Layer]] markers.

## Typography

Plus Jakarta Sans, 6 weights (300–800), exposed as `Fonts.light` … `Fonts.extrabold`, loaded via `expo-google-fonts` in `App.tsx`.

## Map styling

`client/src/utils/constants.ts` holds `GOOGLE_MAPS_DARK_STYLE` (17 style rules) paired with dark mode, and defers to Google's default for light mode — consumed by `MapView.tsx` in the [[Map Layer]].

## Related
[[Architecture]] · [[Map Layer]] · [[Navigation & Screens]]
