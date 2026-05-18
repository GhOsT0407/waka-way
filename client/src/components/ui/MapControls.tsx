import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';

interface Props {
  isCentered: boolean;
  onCenterPress: () => void;
  onLayersPress: () => void;
}

function ControlButton({ icon, label, active = false, onPress }: {
  icon: string; label: string; active?: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.button}
      accessibilityLabel={label}
      accessibilityRole="button"
      activeOpacity={0.75}
    >
      <Ionicons name={icon as any} size={22} color={active ? Colors.blue : Colors.textSecondary} />
    </TouchableOpacity>
  );
}

export default function MapControls({ isCentered, onCenterPress, onLayersPress }: Props) {
  return (
    <View style={styles.container}>
      <ControlButton icon="map-outline"      label="Map layers"        onPress={onLayersPress} />
      <ControlButton icon="navigate-outline" label="Center on location" active={isCentered} onPress={onCenterPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  button: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
});
