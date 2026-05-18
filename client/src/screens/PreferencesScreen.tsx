import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { updateUserProfile } from '../services/supabaseDataService';

const TRANSPORT_PREF_KEY = 'preferredFirstLegTransportMode';

const MODE_LABELS: Record<string, string> = {
  keke:  'Keke (Tricycle)',
  danfo: 'Danfo (Yellow bus)',
  okada: 'Okada (Motorbike)',
  brt:   'BRT / LAGBUS',
  walk:  'Walk',
};

interface SettingRowProps {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

function SettingRow({ icon, iconColor, iconBg, title, subtitle, onPress, rightElement }: SettingRowProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      {rightElement ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} /> : null)}
    </TouchableOpacity>
  );
}

export default function PreferencesScreen({ navigation }: any) {
  const { user } = useAuth();

  const [savedMode, setSavedMode]           = useState<string | null>(null);
  const [showNameModal, setShowNameModal]   = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [newName, setNewName]               = useState('');
  const [displayName, setDisplayName]       = useState(user?.name ?? '');
  const [savingName, setSavingName]         = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(TRANSPORT_PREF_KEY).then((v) => setSavedMode(v));
  }, []);

  const handleTransportPress = () => {
    const modes = Object.keys(MODE_LABELS);
    Alert.alert(
      'Default Transport Mode',
      'Choose your preferred first-leg transport',
      [
        ...modes.map((m) => ({
          text: MODE_LABELS[m],
          onPress: async () => {
            await AsyncStorage.setItem(TRANSPORT_PREF_KEY, m);
            setSavedMode(m);
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Search History',
      'This will clear your recent searches from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('recentSearches');
            Alert.alert('Done', 'Search history cleared.');
          },
        },
      ]
    );
  };

  const openNameModal = () => {
    setNewName(displayName);
    setShowNameModal(true);
  };

  const handleSaveName = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      Alert.alert('Invalid name', 'Display name cannot be empty.');
      return;
    }
    if (!user) return;
    setSavingName(true);
    try {
      const updated = await updateUserProfile(user.id, { full_name: trimmed });
      if (updated) {
        setDisplayName(trimmed);
        setShowNameModal(false);
      } else {
        Alert.alert('Error', 'Could not update your name. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Could not update your name. Please try again.');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preferences</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Transport */}
        <Text style={styles.section}>TRANSPORT</Text>
        <View style={styles.group}>
          <SettingRow
            icon="car-outline"
            iconColor="#F97316"
            iconBg="rgba(249,115,22,0.15)"
            title="Default Transport Mode"
            subtitle={savedMode ? MODE_LABELS[savedMode] : 'Ask me each time'}
            onPress={handleTransportPress}
          />
        </View>

        {/* Privacy */}
        <Text style={styles.section}>PRIVACY & DATA</Text>
        <View style={styles.group}>
          <SettingRow
            icon="time-outline"
            iconColor={Colors.blue}
            iconBg={Colors.blueLight}
            title="Clear Search History"
            subtitle="Remove recent searches from this device"
            onPress={handleClearHistory}
          />
        </View>

        {/* Account */}
        {user && (
          <>
            <Text style={styles.section}>ACCOUNT</Text>
            <View style={styles.group}>
              <SettingRow
                icon="person-outline"
                iconColor="#34D399"
                iconBg="rgba(52,211,153,0.12)"
                title="Display Name"
                subtitle={displayName || 'Tap to set your name'}
                onPress={openNameModal}
              />
              <SettingRow
                icon="mail-outline"
                iconColor={Colors.blue}
                iconBg={Colors.blueLight}
                title="Email"
                subtitle={user.email}
              />
            </View>
          </>
        )}

        {/* About */}
        <Text style={styles.section}>ABOUT</Text>
        <View style={styles.group}>
          <SettingRow
            icon="information-circle-outline"
            iconColor={Colors.blue}
            iconBg={Colors.blueLight}
            title="App Version"
            subtitle="WakaWay v1.0.0"
          />
          <SettingRow
            icon="map-outline"
            iconColor="#34D399"
            iconBg="rgba(52,211,153,0.12)"
            title="Coverage"
            subtitle="Lagos, Nigeria"
          />
          <SettingRow
            icon="shield-checkmark-outline"
            iconColor="#A78BFA"
            iconBg="rgba(167,139,250,0.12)"
            title="Privacy Policy"
            onPress={() => setShowPrivacyModal(true)}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Privacy Policy Modal */}
      <Modal
        visible={showPrivacyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.privacyCard}>
            <View style={styles.privacyHeader}>
              <Text style={styles.modalTitle}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setShowPrivacyModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.privacyScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.privacySection}>Last updated: May 2025</Text>

              <Text style={styles.privacyHeading}>1. Data We Collect</Text>
              <Text style={styles.privacyBody}>
                WakaWay collects your device location (GPS) only while the app is open and in use — we do not collect background location. We also store your email address and display name when you create an account.
              </Text>

              <Text style={styles.privacyHeading}>2. How We Use Your Data</Text>
              <Text style={styles.privacyBody}>
                Location is used solely to calculate routes and show your position on the map. Your email is used for authentication. We do not sell your personal data to third parties.
              </Text>

              <Text style={styles.privacyHeading}>3. Search History</Text>
              <Text style={styles.privacyBody}>
                Recent searches are stored locally on your device only. You can clear them at any time from Preferences → Clear Search History.
              </Text>

              <Text style={styles.privacyHeading}>4. Third-Party Services</Text>
              <Text style={styles.privacyBody}>
                WakaWay uses Google Maps for geocoding and map display, and Supabase for authentication and route data storage. Both services operate under their own privacy policies.
              </Text>

              <Text style={styles.privacyHeading}>5. Data Security</Text>
              <Text style={styles.privacyBody}>
                All data transmitted between your device and our servers is encrypted using HTTPS/TLS. Passwords are never stored in plain text.
              </Text>

              <Text style={styles.privacyHeading}>6. Your Rights</Text>
              <Text style={styles.privacyBody}>
                You may request deletion of your account and associated data at any time by contacting us at support@wakaway.app.
              </Text>

              <Text style={styles.privacyHeading}>7. Contact</Text>
              <Text style={styles.privacyBody}>
                Questions about this policy? Email us at support@wakaway.app.
              </Text>
              <View style={{ height: 20 }} />
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnPrimary, { marginTop: 8 }]}
              onPress={() => setShowPrivacyModal(false)}
            >
              <Text style={styles.modalBtnPrimaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Display Name Modal */}
      <Modal
        visible={showNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Display Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter your name"
              placeholderTextColor={Colors.textTertiary}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setShowNameModal(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={handleSaveName}
                disabled={savingName}
              >
                {savingName
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalBtnPrimaryText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.mapBackground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.sheetBg,
  },
  headerTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  content:     { paddingTop: 8 },
  section: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  group: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.sheetBg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary },
  rowSub:   { fontSize: Typography.sm, marginTop: 2, color: Colors.textSecondary },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    backgroundColor: Colors.sheetBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    marginBottom: 4,
    color: Colors.textPrimary,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: Typography.lg,
    backgroundColor: Colors.surfaceElevated,
    color: Colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
  },
  modalBtnPrimary: { borderWidth: 0, backgroundColor: Colors.blue },
  modalBtnText: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textSecondary },
  modalBtnPrimaryText: { fontSize: Typography.md, fontWeight: Typography.semibold, color: '#fff' },
  // Privacy modal
  privacyCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 20,
    padding: 20,
    backgroundColor: Colors.sheetBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  privacyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  privacyScroll: { flex: 1 },
  privacySection: { fontSize: Typography.sm, marginBottom: 16, color: Colors.textSecondary },
  privacyHeading: { fontSize: Typography.md, fontWeight: Typography.bold, marginTop: 16, marginBottom: 6, color: Colors.textPrimary },
  privacyBody: { fontSize: Typography.md, lineHeight: 22, color: Colors.textSecondary },
});
