import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Switch, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';

export default function PreferencesScreen({ navigation }: any) {
  const { theme, toggleTheme, isDark } = useAppTheme();
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const notif = await AsyncStorage.getItem('notifications');
      setNotifications(notif !== 'false');
    } catch (e) {
      console.log('Error loading preferences', e);
    }
  };

  const savePreference = async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.log('Error saving preference', e);
    }
  };

  const toggleNotifications = (value: boolean) => {
    setNotifications(value);
    savePreference('notifications', value.toString());
  };

  const clearSearchHistory = () => {
    Alert.alert(
      'Clear Search History',
      'Are you sure you want to clear all search history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('searchHistory');
              Alert.alert('Success', 'Search history cleared.');
            } catch (e) {
              console.log('Error clearing history', e);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.BACKGROUND }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.TEXT} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.TEXT }]}>App Preferences</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.TEXT }]}>Appearance</Text>
          <View style={[styles.item, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}>
            <Text style={[styles.itemText, { color: theme.TEXT }]}>Dark Mode</Text>
            <Switch value={isDark} onValueChange={toggleTheme} />
          </View>
        </View>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.TEXT }]}>Notifications</Text>
          <View style={[styles.item, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}>
            <Text style={[styles.itemText, { color: theme.TEXT }]}>Enable Notifications</Text>
            <Switch value={notifications} onValueChange={toggleNotifications} />
          </View>
        </View>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.TEXT }]}>Data</Text>
          <TouchableOpacity style={[styles.item, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]} onPress={clearSearchHistory}>
            <Ionicons name="trash-outline" size={24} color={theme.ERROR} />
            <Text style={[styles.itemText, { color: theme.ERROR }]}>Clear Search History</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.TEXT_SECONDARY} />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    padding: SPACING.MD,
  },
  section: {
    marginBottom: SPACING.XL,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.HEADING_3,
    fontWeight: 'bold',
    marginBottom: SPACING.MD,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.SM,
    borderRadius: BORDER_RADIUS.MEDIUM,
    marginBottom: SPACING.SM,
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }),
  },
  itemText: {
    fontSize: FONT_SIZES.BODY,
    flex: 1,
    marginLeft: SPACING.MD,
  },
});