import React, { useState, useEffect, useMemo } from 'react';
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
import { useAppTheme } from '../context/ThemeContext';
import type { WWColors } from '../theme/colors';
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
  const { WW } = useAppTheme();
  const styles = useMemo(() => makeStyles(WW), [WW]);
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
      {rightElement ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={WW.textSub} /> : null)}
    </TouchableOpacity>
  );
}

export default function PreferencesScreen({ navigation }: any) {
  const { WW } = useAppTheme();
  const styles = useMemo(() => makeStyles(WW), [WW]);
  const { user, deleteAccount } = useAuth();

  const [savedMode, setSavedMode]           = useState<string | null>(null);
  const [showNameModal, setShowNameModal]   = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [newName, setNewName]               = useState('');
  const [displayName, setDisplayName]       = useState(user?.name ?? '');
  const [savingName, setSavingName]         = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm]   = useState('');
  const [deleting, setDeleting]             = useState(false);

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

  const openDeleteModal = () => {
    setDeleteConfirm('');
    setShowDeleteModal(true);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toUpperCase() !== 'DELETE') {
      Alert.alert('Type DELETE to confirm', 'Enter DELETE in the box to confirm you want to remove your account.');
      return;
    }

    setDeleting(true);
    const result = await deleteAccount();
    setDeleting(false);

    if (!result.success) {
      Alert.alert('Something went wrong', result.error ?? 'Could not delete your account.');
      return;
    }

    // No navigation needed -- the auth state listener drops the app back to the
    // sign-in stack the moment the session clears.
    setShowDeleteModal(false);
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
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={WW.text} />
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
            iconColor={WW.orange}
            iconBg={WW.orangeDim}
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
                iconColor={WW.orange}
                iconBg={WW.orangeDim}
                title="Email"
                subtitle={user.email}
              />
              <SettingRow
                icon="trash-outline"
                iconColor={WW.error}
                iconBg="rgba(255,68,68,0.12)"
                title="Delete Account"
                subtitle="Permanently remove your account and data"
                onPress={openDeleteModal}
              />
            </View>
          </>
        )}

        {/* About */}
        <Text style={styles.section}>ABOUT</Text>
        <View style={styles.group}>
          <SettingRow
            icon="information-circle-outline"
            iconColor={WW.orange}
            iconBg={WW.orangeDim}
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
                <Ionicons name="close" size={22} color={WW.textSub} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.privacyScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.privacySection}>Last updated: 10 September 2026</Text>

              <Text style={styles.privacyHeading}>1. Data We Collect</Text>
              <Text style={styles.privacyBody}>
                WakaWay collects your device location (GPS) only while the app is open and in use — we do not collect background location. We also store your email address and display name when you create an account.
              </Text>

              <Text style={styles.privacyHeading}>2. How We Use Your Data</Text>
              <Text style={styles.privacyBody}>
                Location is used solely to calculate routes and show your position on the map. Your email is used for authentication. We do not sell your personal data and we do not run ads or third-party trackers.
              </Text>

              <Text style={styles.privacyHeading}>3. Search History</Text>
              <Text style={styles.privacyBody}>
                Recent searches and app preferences are stored locally on your device only. You can clear them at any time from Preferences → Clear Search History.
              </Text>

              <Text style={styles.privacyHeading}>4. Community Reports</Text>
              <Text style={styles.privacyBody}>
                Reports you submit are visible to other users on the map, showing the type, description, location and time — never your name or email. They expire automatically, typically within 1–6 hours.
              </Text>

              <Text style={styles.privacyHeading}>5. Third-Party Services</Text>
              <Text style={styles.privacyBody}>
                WakaWay uses Supabase for sign-in and data storage, MapTiler for map tiles and place search, and OpenRouteService for walking directions. Each operates under its own privacy policy.
              </Text>

              <Text style={styles.privacyHeading}>6. Data Security</Text>
              <Text style={styles.privacyBody}>
                All data transmitted between your device and our servers is encrypted using HTTPS/TLS. Passwords are never stored in plain text.
              </Text>

              <Text style={styles.privacyHeading}>7. Deleting Your Account</Text>
              <Text style={styles.privacyBody}>
                You can delete your account at any time from Preferences → Account → Delete Account. This permanently removes your profile, saved places, saved routes and trip history. Reports you submitted are unlinked from you but stay on the map until they expire, so other travellers relying on a live alert are not left without it.
              </Text>

              <Text style={styles.privacyHeading}>8. Contact</Text>
              <Text style={styles.privacyBody}>
                Questions about this policy? Email us at wakawaytechnologies@gmail.com.
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

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: WW.error }]}>Delete Account</Text>

            <Text style={styles.deleteBody}>
              This permanently deletes your account, saved places, saved routes and trip
              history. It cannot be undone.
            </Text>
            <Text style={styles.deleteBody}>
              Reports you submitted stay on the map until they expire, but are no longer
              linked to you.
            </Text>

            <Text style={styles.deleteLabel}>Type DELETE to confirm</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: WW.error }]}
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder="DELETE"
              placeholderTextColor={WW.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
              returnKeyType="done"
              onSubmitEditing={handleDeleteAccount}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtn}
                onPress={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalBtnPrimaryText}>Delete</Text>
                }
              </TouchableOpacity>
            </View>
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
              placeholderTextColor={WW.textMuted}
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

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: WW.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WW.border,
    backgroundColor: WW.bgSurface,
  },
  headerTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: WW.text },
  content:     { paddingTop: 8 },
  section: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
    color: WW.textSub,
    textTransform: 'uppercase',
  },
  group: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: WW.border,
    backgroundColor: WW.bgSurface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WW.divider,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: Typography.md, fontWeight: Typography.semibold, color: WW.text },
  rowSub:   { fontSize: Typography.sm, marginTop: 2, color: WW.textSub },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: WW.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    gap: 14,
    backgroundColor: WW.bgSurface,
    borderWidth: 1,
    borderColor: WW.border,
  },
  modalTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    marginBottom: 4,
    color: WW.text,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: WW.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: Typography.lg,
    backgroundColor: WW.bgElevated,
    color: WW.text,
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
    borderColor: WW.border,
    alignItems: 'center',
    backgroundColor: WW.bgElevated,
  },
  modalBtnPrimary: { borderWidth: 0, backgroundColor: WW.orange },
  modalBtnDanger:  { borderWidth: 0, backgroundColor: WW.error },
  deleteBody: {
    fontSize: Typography.sm,
    lineHeight: 20,
    color: WW.textSub,
    marginBottom: 10,
  },
  deleteLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    letterSpacing: 0.6,
    color: WW.textSub,
    marginTop: 4,
    marginBottom: 6,
  },
  modalBtnText: { fontSize: Typography.md, fontWeight: Typography.semibold, color: WW.textSub },
  modalBtnPrimaryText: { fontSize: Typography.md, fontWeight: Typography.semibold, color: '#fff' },
  // Privacy modal
  privacyCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 20,
    padding: 20,
    backgroundColor: WW.bgSurface,
    borderWidth: 1,
    borderColor: WW.border,
  },
  privacyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  privacyScroll: { flex: 1 },
  privacySection: { fontSize: Typography.sm, marginBottom: 16, color: WW.textSub },
  privacyHeading: { fontSize: Typography.md, fontWeight: Typography.bold, marginTop: 16, marginBottom: 6, color: WW.text },
  privacyBody: { fontSize: Typography.md, lineHeight: 22, color: WW.textSub },
});
}
