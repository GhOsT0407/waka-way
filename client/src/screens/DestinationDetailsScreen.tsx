import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { SPACING, FONT_SIZES } from '../utils/constants';

export default function DestinationDetailsScreen({ route, navigation }: any) {
  const { theme } = useAppTheme();
  const { locationName } = route.params || {};

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.BACKGROUND }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.TEXT} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.TEXT }]}>Destination Details</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.locationName, { color: theme.TEXT }]}>{locationName || 'Unknown Location'}</Text>
        <Text style={[styles.placeholder, { color: theme.TEXT_SECONDARY }]}>Details for {locationName} will be implemented here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.MD,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: FONT_SIZES.HEADING_2,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.LG,
  },
  locationName: {
    fontSize: FONT_SIZES.HEADING_1,
    fontWeight: 'bold',
    marginBottom: SPACING.MD,
  },
  placeholder: {
    fontSize: FONT_SIZES.BODY,
    textAlign: 'center',
  },
});