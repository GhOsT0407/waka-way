import React, { forwardRef, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import BottomSheet, {
  BottomSheetProps,
  useBottomSheetSpringConfigs,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import { useAppTheme } from '../../context/ThemeContext';
import { Radius } from '../../theme/spacing';

// The one bottom sheet. Home, Route detail and Navigation all use it, so a
// drag feels the same everywhere: gesture and spring run on the UI thread
// via Reanimated, and the drag-vs-scroll handoff inside the sheet is handled
// by the library's BottomSheetScrollView / BottomSheetFlatList.
//
// Material matches the top chrome on Home — real blur on iOS, a solid
// frosted colour on Android, and a frosted plate over both so text always has
// a contrast floor (DESIGN_CRITIQUE 2.3).

export type SheetRef = BottomSheet;

export {
  BottomSheetView as SheetView,
  BottomSheetScrollView as SheetScrollView,
  BottomSheetFlatList as SheetFlatList,
} from '@gorhom/bottom-sheet';

// Snappy, no overshoot: a sheet that bounces past its snap point reads as
// loose, not fluid.
const SPRING = {
  damping: 80,
  stiffness: 500,
  overshootClamping: true,
  restDisplacementThreshold: 0.1,
  restSpeedThreshold: 0.1,
} as const;

type Props = Omit<BottomSheetProps, 'backgroundComponent' | 'handleIndicatorStyle' | 'handleStyle'> & {
  /** Navigation is dark in both themes; it passes `dark` so the sheet follows. */
  forceDark?: boolean;
};

const FrostedBackground = ({ style, isDark, frosted }: BottomSheetBackgroundProps & { isDark: boolean; frosted: string }) => (
  <View style={[style, bg.clip]} pointerEvents="none">
    {Platform.OS === 'ios' && (
      <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
    )}
    <View style={[StyleSheet.absoluteFill, { backgroundColor: frosted }]} />
  </View>
);

const bg = StyleSheet.create({
  clip: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
  },
});

export const Sheet = forwardRef<SheetRef, Props>(function Sheet(
  { forceDark, style, children, ...rest },
  ref,
) {
  const theme = useAppTheme();
  const isDark = forceDark ?? theme.isDark;
  const WW = theme.WW;
  const animationConfigs = useBottomSheetSpringConfigs(SPRING);

  const s = useMemo(() => StyleSheet.create({
    shadow: {
      shadowColor: '#14161A',
      shadowOpacity: isDark ? 0.4 : 0.14,
      shadowRadius: 44,
      shadowOffset: { width: 0, height: -18 },
      elevation: 12,
    },
    handle: { paddingTop: 10, paddingBottom: 6 },
    indicator: { width: 36, height: 5, borderRadius: Radius.pill, backgroundColor: WW.borderStrong },
  }), [WW, isDark]);

  const Background = useMemo(
    () => (props: BottomSheetBackgroundProps) => (
      <FrostedBackground {...props} isDark={isDark} frosted={WW.frosted} />
    ),
    [isDark, WW.frosted],
  );

  return (
    <BottomSheet
      ref={ref}
      animationConfigs={animationConfigs}
      backgroundComponent={Background}
      handleStyle={s.handle}
      handleIndicatorStyle={s.indicator}
      style={[s.shadow, style]}
      {...rest}
    >
      {children}
    </BottomSheet>
  );
});
