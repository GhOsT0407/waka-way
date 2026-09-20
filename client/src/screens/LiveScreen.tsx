import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CommunityMapView } from '../components/map/CommunityMapView';
import { useAppTheme } from '../context/ThemeContext';

// The Live tab — the community map, full-bleed. The map component owns the
// LIVE pill, the pins and the report sheet; this screen just gives it a tab.
export default function LiveScreen() {
  const { isDark } = useAppTheme();
  return (
    <View style={StyleSheet.absoluteFill}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <CommunityMapView />
    </View>
  );
}
