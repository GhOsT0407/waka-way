import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';
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
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: theme.BORDER }]}
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.TEXT }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.rowSub, { color: theme.TEXT_SECONDARY }]}>{subtitle}</Text>}
      </View>
      {rightElement ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={theme.TEXT_SECONDARY} /> : null)}
    </TouchableOpacity>
  );
}

export default function PreferencesScreen({ navigation }: any) {
  const { theme, isDark, themeMode, setThemeMode } = useAppTheme();
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

  const handleThemePress = () => {
    Alert.alert(
      'Appearance',
      'Choose your preferred theme',
      [
        { text: 'System default', onPress: () => setThemeMode('system') },
        { text: 'Light',          onPress: () => setThemeMode('light')  },
        { text: 'Dark',           onPress: () => setThemeMode('dark')   },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

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

  const themeLabel = themeMode === 'system' ? 'System default' : themeMode === 'light' ? 'Light' : 'Dark';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.BACKGROUND }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.BORDER }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={theme.TEXT} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.TEXT }]}>Preferences</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Appearance */}
        <Text style={[styles.section, { color: theme.TEXT_SECONDARY }]}>APPEARANCE</Text>
        <View style={[styles.group, { backgroundColor: theme.CARD_BACKGROUND, borderColor: theme.BORDER }]}>
          <SettingRow
            icon="contrast-outline"
            iconColor="#6200EA"
            iconBg="#EDE7F6"
            title="Theme"
            subtitle={themeLabel}
            onPress={handleThemePress}
          />
          <SettingRow
            icon={isDark ? 'moon' : 'sunny'}
            iconColor={isDark ? '#7986CB' : '#FFA000'}
            iconBg={isDark ? '#E8EAF6' : '#FFF8E1'}
            title="Dark Mode"
            rightElement={
              <Switch
                value={isDark}
                onValueChange={(v) => setThemeMode(v ? 'dark' : 'light')}
                trackColor={{ false: theme.BORDER, true: theme.PRIMARY }}
                thumbColor={Platform.OS === 'android' ? (isDark ? theme.PRIMARY : '#F5F5F5') : undefined}
              />
            }
          />
        </View>

        {/* Transport */}
        <Text style={[styles.section, { color: theme.TEXT_SECONDARY }]}>TRANSPORT</Text>
        <View style={[styles.group, { backgroundColor: theme.CARD_BACKGROUND, borderColor: theme.BORDER }]}>
          <SettingRow
            icon="car-outline"
            iconColor="#E65100"
            iconBg="#FFF3E0"
            title="Default Transport Mode"
            subtitle={savedMode ? MODE_LABELS[savedMode] : 'Ask me each time'}
            onPress={handleTransportPress}
          />
        </View>

        {/* Privacy */}
        <Text style={[styles.section, { color: theme.TEXT_SECONDARY }]}>PRIVACY & DATA</Text>
        <View style={[styles.group, { backgroundColor: theme.CARD_BACKGROUND, borderColor: theme.BORDER }]}>
          <SettingRow
            icon="time-outline"
            iconColor="#1565C0"
            iconBg="#E3F2FD"
            title="Clear Search History"
            subtitle="Remove recent searches from this device"
            onPress={handleClearHistory}
          />
        </View>

        {/* Account */}
        {user && (
          <>
            <Text style={[styles.section, { color: theme.TEXT_SECONDARY }]}>ACCOUNT</Text>
            <View style={[styles.group, { backgroundColor: theme.CARD_BACKGROUND, borderColor: theme.BORDER }]}>
              <SettingRow
                icon="person-outline"
                iconColor="#2E7D32"
                iconBg="#E8F5E9"
                title="Display Name"
                subtitle={displayName || 'Tap to set your name'}
                onPress={openNameModal}
              />
              <SettingRow
                icon="mail-outline"
                iconColor="#1565C0"
                iconBg="#E3F2FD"
                title="Email"
                subtitle={user.email}
              />
            </View>
          </>
        )}

        {/* About */}
        <Text style={[styles.section, { color: theme.TEXT_SECONDARY }]}>ABOUT</Text>
        <View style={[styles.group, { backgroundColor: theme.CARD_BACKGROUND, borderColor: theme.BORDER }]}>
          <SettingRow
            icon="information-circle-outline"
            iconColor="#1976D2"
            iconBg="#E3F2FD"
            title="App Version"
            subtitle="WakaWay v1.0.0"
          />
          <SettingRow
            icon="map-outline"
            iconColor="#388E3C"
            iconBg="#E8F5E9"
            title="Coverage"
            subtitle="Lagos, Nigeria"
          />
          <SettingRow
            icon="shield-checkmark-outline"
            iconColor="#6A1B9A"
            iconBg="#F3E5F5"
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
          <View style={[styles.privacyCard, { backgroundColor: theme.CARD_BACKGROUND }]}>
            <View style={styles.privacyHeader}>
              <Text style={[styles.modalTitle, { color: theme.TEXT }]}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setShowPrivacyModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={theme.TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.privacyScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.privacySection, { color: theme.TEXT }]}>Last updated: May 2025</Text>

              <Text style={[styles.privacyHeading, { color: theme.TEXT }]}>1. Data We Collect</Text>
              <Text style={[styles.privacyBody, { color: theme.TEXT_SECONDARY }]}>
                WakaWay collects your device location (GPS) only while the app is open and in use — we do not collect background location. We also store your email address and display name when you create an account.
              </Text>

              <Text style={[styles.privacyHeading, { color: theme.TEXT }]}>2. How We Use Your Data</Text>
              <Text style={[styles.privacyBody, { color: theme.TEXT_SECONDARY }]}>
                Location is used solely to calculate routes and show your position on the map. Your email is used for authentication. We do not sell your personal data to third parties.
              </Text>

              <Text style={[styles.privacyHeading, { color: theme.TEXT }]}>3. Search History</Text>
              <Text style={[styles.privacyBody, { color: theme.TEXT_SECONDARY }]}>
                Recent searches are stored locally on your device only. You can clear them at any time from Preferences → Clear Search History.
              </Text>

              <Text style={[styles.privacyHeading, { color: theme.TEXT }]}>4. Third-Party Services</Text>
              <Text style={[styles.privacyBody, { color: theme.TEXT_SECONDARY }]}>
                WakaWay uses Google Maps for geocoding and map display, and Supabase for authentication and route data storage. Both services operate under their own privacy policies.
              </Text>

              <Text style={[styles.privacyHeading, { color: theme.TEXT }]}>5. Data Security</Text>
              <Text style={[styles.privacyBody, { color: theme.TEXT_SECONDARY }]}>
                All data transmitted between your device and our servers is encrypted using HTTPS/TLS. Passwords are never stored in plain text.
              </Text>

              <Text style={[styles.privacyHeading, { color: theme.TEXT }]}>6. Your Rights</Text>
              <Text style={[styles.privacyBody, { color: theme.TEXT_SECONDARY }]}>
                You may request deletion of your account and associated data at any time by contacting us at support@wakaway.app.
              </Text>

              <Text style={[styles.privacyHeading, { color: theme.TEXT }]}>7. Contact</Text>
              <Text style={[styles.privacyBody, { color: theme.TEXT_SECONDARY }]}>
                Questions about this policy? Email us at support@wakaway.app.
              </Text>
              <View style={{ height: 20 }} />
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: theme.PRIMARY, marginTop: SPACING.SM }]}
              onPress={() => setShowPrivacyModal(false)}
            >
              <Text style={[styles.modalBtnText, { color: '#fff' }]}>Close</Text>
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
          <View style={[styles.modalCard, { backgroundColor: theme.CARD_BACKGROUND }]}>
            <Text style={[styles.modalTitle, { color: theme.TEXT }]}>Display Name</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.TEXT, borderColor: theme.BORDER, backgroundColor: theme.SURFACE }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter your name"
              placeholderTextColor={theme.TEXT_SECONDARY}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: theme.BORDER }]}
                onPress={() => setShowNameModal(false)}
              >
                <Text style={[styles.modalBtnText, { color: theme.TEXT_SECONDARY }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: theme.PRIMARY }]}
                onPress={handleSaveName}
                disabled={savingName}
              >
                {savingName
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: FONT_SIZES.HEADING_3, fontWeight: '700' },
  content:     { paddingTop: SPACING.MD },
  section: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    marginTop: SPACING.MD,
  },
  group: {
    marginHorizontal: SPACING.MD,
    borderRadius: BORDER_RADIUS.LARGE,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    gap: SPACING.MD,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: FONT_SIZES.BODY, fontWeight: '600' },
  rowSub:   { fontSize: FONT_SIZES.SMALL, marginTop: 2 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.LG,
  },
  modalCard: {
    width: '100%',
    borderRadius: BORDER_RADIUS.XL,
    padding: SPACING.LG,
    gap: SPACING.MD,
  },
  modalTitle: {
    fontSize: FONT_SIZES.HEADING_3,
    fontWeight: '700',
    marginBottom: SPACING.XS,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.MEDIUM,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    fontSize: FONT_SIZES.BODY_LARGE,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.SM,
    marginTop: SPACING.XS,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: SPACING.SM,
    borderRadius: BORDER_RADIUS.MEDIUM,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalBtnPrimary: { borderWidth: 0 },
  modalBtnText: { fontSize: FONT_SIZES.BODY, fontWeight: '600' },
  // Privacy modal
  privacyCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: BORDER_RADIUS.XL,
    padding: SPACING.LG,
  },
  privacyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.MD,
  },
  privacyScroll: { flex: 1 },
  privacySection: { fontSize: FONT_SIZES.SMALL, marginBottom: SPACING.MD },
  privacyHeading: { fontSize: FONT_SIZES.BODY, fontWeight: '700', marginTop: SPACING.MD, marginBottom: SPACING.XS },
  privacyBody: { fontSize: FONT_SIZES.BODY, lineHeight: 22 },
});
