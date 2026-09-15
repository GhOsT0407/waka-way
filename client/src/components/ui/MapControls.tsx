import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import type { WWColors } from '../../theme/colors';

interface Props {
  isCentered: boolean;
  onCenterPress: () => void;
  onLayersPress: () => void;
}

function ControlButton({ icon, label, active = false, onPress }: {
  icon: string; label: string; active?: boolean; onPress: () => void;
}) {
  const { WW } = useAppTheme();
  const styles = useMemo(() => makeStyles(WW), [WW]);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.button}
      accessibilityLabel={label}
      accessibilityRole="button"
      activeOpacity={0.75}
    >
      <Ionicons name={icon as any} size={22} color={active ? WW.orange : WW.textSub} />
    </TouchableOpacity>
  );
}

export default function MapControls({ isCentered, onCenterPress, onLayersPress }: Props) {
  const { WW } = useAppTheme();
  const styles = useMemo(() => makeStyles(WW), [WW]);
  return (
    <View style={styles.container}>
      <ControlButton icon="map-outline"      label="Map layers"        onPress={onLayersPress} />
      <ControlButton icon="navigate-outline" label="Center on location" active={isCentered} onPress={onCenterPress} />
    </View>
  );
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
  container: { gap: 8 },
  button: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: WW.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: WW.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
});
}
