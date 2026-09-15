import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';
import { supabase } from '../lib/supabase';
import { CommunityMapView } from '../components/map/CommunityMapView';

interface Contribution {
  id: string;
  type: 'bus_stop' | 'taxi_stand' | 'danger_zone' | 'construction' | 'traffic' | 'security' | 'hazard' | 'other';
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected' | 'high-priority';
  ai_score?: number;
}

const CONTRIBUTION_TYPES = [
  { id: 'bus_stop', label: 'Bus Stop', icon: 'bus-outline' },
  { id: 'taxi_stand', label: 'Taxi Stand', icon: 'car-outline' },
  { id: 'danger_zone', label: 'Danger Zone', icon: 'warning-outline' },
  { id: 'construction', label: 'Construction', icon: 'construct-outline' },
  { id: 'traffic', label: 'Traffic', icon: 'car-sport-outline' },
  { id: 'security', label: 'Security', icon: 'shield-outline' },
  { id: 'hazard', label: 'Hazard', icon: 'alert-circle-outline' },
  { id: 'other', label: 'Other', icon: 'help-circle-outline' },
];

export default function ContributionScreen({ navigation }: any) {
  const { WW } = useAppTheme();
  const { user } = useAuth();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [isAddingContribution, setIsAddingContribution] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map'); // Default to map view

  useEffect(() => {
    loadContributions();
    getCurrentLocation();
  }, []);

  const loadContributions = async () => {
    try {
      const { data, error } = await supabase
        .from('contributions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setContributions(data.map((d: any) => ({
          id: d.id,
          type: d.type,
          title: d.title || '',
          description: d.description || '',
          latitude: d.latitude,
          longitude: d.longitude,
          address: d.address || '',
          timestamp: d.created_at,
          status: d.status,
          ai_score: d.ai_score,
        })));
        return;
      }

      // Fallback to local cache
      const saved = await AsyncStorage.getItem('userContributions');
      if (saved) setContributions(JSON.parse(saved));
    } catch (error) {
      console.error('Error loading contributions:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const submitContribution = async () => {
    if (!selectedType || !title.trim() || !description.trim() || !currentLocation) {
      Alert.alert('Error', 'Please fill in all fields and ensure location is available.');
      return;
    }

    try {
      // Reverse geocode to get address
      const geocode = await Location.reverseGeocodeAsync({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });

      const address = geocode.length > 0
        ? `${geocode[0].name || ''} ${geocode[0].street || ''} ${geocode[0].city || ''}`.trim()
        : 'Unknown location';

      const newContribution: Contribution = {
        id: Date.now().toString(),
        type: selectedType as any,
        title: title.trim(),
        description: description.trim(),
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        address,
        timestamp: new Date().toISOString(),
        status: 'pending',
      };

      // Try Supabase first
      {
        const { data, error } = await supabase
          .from('contributions')
          .insert({
            type: selectedType,
            title: title.trim(),
            description: description.trim(),
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            address,
            status: 'pending',
            ...(user ? { user_id: user.id } : {}),
          })
          .select()
          .single();

        if (!error && data) {
          const mapped: Contribution = {
            id: data.id,
            type: data.type,
            title: data.title,
            description: data.description,
            latitude: data.latitude,
            longitude: data.longitude,
            address: data.address || '',
            timestamp: data.created_at,
            status: data.status,
            ai_score: data.ai_score,
          };
          setContributions([mapped, ...contributions]);

          // Reset form
          setIsAddingContribution(false);
          setSelectedType('');
          setTitle('');
          setDescription('');

          Alert.alert('Success', 'Thank you for your contribution! It will be reviewed by our team.');
          return;
        }
      }

      // Fallback to local storage
      const updatedContributions = [newContribution, ...contributions];
      setContributions(updatedContributions);
      await AsyncStorage.setItem('userContributions', JSON.stringify(updatedContributions));

      // Reset form
      setIsAddingContribution(false);
      setSelectedType('');
      setTitle('');
      setDescription('');

      Alert.alert('Success', 'Thank you for your contribution! It will be reviewed by our team.');
    } catch (error) {
      console.error('Error submitting contribution:', error);
      Alert.alert('Error', 'Failed to submit contribution. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#22C55E';
      case 'rejected': return '#F87171';
      default: return '#F59E0B';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return 'Pending Review';
    }
  };

  const renderContributionItem = ({ item }: { item: Contribution }) => {
    const typeInfo = CONTRIBUTION_TYPES.find(t => t.id === item.type);

    return (
      <View style={[styles.contributionItem, { backgroundColor: WW.bgSurface, borderColor: WW.border }]}>
        <View style={styles.contributionHeader}>
          <View style={styles.typeContainer}>
            <Ionicons name={typeInfo?.icon as any} size={20} color={WW.orange} />
            <Text style={[styles.typeLabel, { color: WW.orange }]}>{typeInfo?.label}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>

        <Text style={[styles.contributionTitle, { color: WW.text }]}>{item.title}</Text>
        <Text style={[styles.contributionDescription, { color: WW.textSub }]}>{item.description}</Text>

        <View style={styles.contributionMeta}>
          <Text style={[styles.contributionAddress, { color: WW.textSub }]}>
            📍 {item.address}
          </Text>
          <Text style={[styles.contributionDate, { color: WW.textSub }]}>
            {new Date(item.timestamp).toLocaleDateString()}
          </Text>
        </View>
      </View>
    );
  };

  if (isAddingContribution) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: WW.bg }]}>
        <StatusBar style="auto" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => setIsAddingContribution(false)}>
            <Ionicons name="arrow-back" size={24} color={WW.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: WW.text }]}>Add Contribution</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.formContainer}>
          <Text style={[styles.sectionTitle, { color: WW.text }]}>What type of location is this?</Text>
          <View style={styles.typeGrid}>
            {CONTRIBUTION_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeOption,
                  { borderColor: WW.border },
                  selectedType === type.id && { borderColor: WW.orange, backgroundColor: WW.orangeDim }
                ]}
                onPress={() => setSelectedType(type.id)}
              >
                <Ionicons name={type.icon as any} size={24} color={selectedType === type.id ? WW.orange : WW.textSub} />
                <Text style={[
                  styles.typeOptionText,
                  { color: selectedType === type.id ? WW.orange : WW.textSub }
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: WW.text }]}>Title</Text>
          <TextInput
            style={[styles.input, { color: WW.text, borderColor: WW.border }]}
            placeholder="Brief title for this location"
            placeholderTextColor={WW.textSub}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.sectionTitle, { color: WW.text }]}>Description</Text>
          <TextInput
            style={[styles.textArea, { color: WW.text, borderColor: WW.border }]}
            placeholder="Describe this location in detail..."
            placeholderTextColor={WW.textSub}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: WW.orange }]}
            onPress={submitContribution}
          >
            <Text style={styles.submitButtonText}>Submit Contribution</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: WW.bg }]}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Close" accessibilityRole="button">
          <Ionicons name="chevron-down" size={22} color={WW.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: WW.text, flex: 1, textAlign: 'center' }]}>Community</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: WW.orange }]}
          onPress={() => setIsAddingContribution(true)}
        >
          <Ionicons name="add" size={20} color={WW.textOnOrange} />
        </TouchableOpacity>
      </View>

      {/* View Toggle - Map / My Contributions */}
      <View style={styles.viewToggleContainer}>
        <TouchableOpacity
          style={[
            styles.viewToggleButton,
            viewMode === 'map' && { backgroundColor: WW.orange },
          ]}
          onPress={() => setViewMode('map')}
        >
          <Ionicons 
            name="map" 
            size={18} 
            color={viewMode === 'map' ? '#FFFFFF' : WW.textSub} 
          />
          <Text style={[
            styles.viewToggleText,
            { color: viewMode === 'map' ? '#FFFFFF' : WW.textSub }
          ]}>
            Community Map
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.viewToggleButton,
            viewMode === 'list' && { backgroundColor: WW.orange },
          ]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons 
            name="list" 
            size={18} 
            color={viewMode === 'list' ? '#FFFFFF' : WW.textSub} 
          />
          <Text style={[
            styles.viewToggleText,
            { color: viewMode === 'list' ? '#FFFFFF' : WW.textSub }
          ]}>
            My Contributions
          </Text>
        </TouchableOpacity>
      </View>

      {/* Community Map View */}
      {viewMode === 'map' && (
        <CommunityMapView
          enableProximityAlerts={true}
          proximityRadius={2}
          style={{ flex: 1 }}
        />
      )}

      {/* My Contributions List View */}
      {viewMode === 'list' && (
        <>
          <View style={styles.infoContainer}>
            <Text style={[styles.infoText, { color: WW.text }]}>
              Help other commuters by tagging important locations like bus stops, taxi stands, or areas that need attention.
            </Text>
          </View>

          <FlatList
            data={contributions}
            keyExtractor={(item) => item.id}
            renderItem={renderContributionItem}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="heart-outline" size={48} color={WW.textSub} />
                <Text style={[styles.emptyTitle, { color: WW.text }]}>No contributions yet</Text>
                <Text style={[styles.emptySubtitle, { color: WW.textSub }]}>
                  Your contributions to improve the app will appear here
                </Text>
                <TouchableOpacity
                  style={[styles.emptyButton, { backgroundColor: WW.orange }]}
                  onPress={() => setIsAddingContribution(true)}
                >
                  <Text style={styles.emptyButtonText}>Add Your First Contribution</Text>
                </TouchableOpacity>
              </View>
            }
            contentContainerStyle={contributions.length === 0 ? styles.emptyContainer : undefined}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.2,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.MD,
    marginTop: SPACING.SM,
    marginBottom: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  viewToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.XS,
    paddingVertical: 8,
    borderRadius: 10,
  },
  viewToggleText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
  infoContainer: {
    padding: SPACING.MD,
    backgroundColor: 'rgba(34,197,94,0.08)',
    marginHorizontal: SPACING.MD,
    marginBottom: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  infoText: {
    fontSize: FONT_SIZES.SMALL,
    lineHeight: 20,
  },
  contributionItem: {
    marginHorizontal: SPACING.MD,
    marginBottom: SPACING.SM,
    padding: SPACING.MD,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  contributionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
  },
  typeLabel: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: SPACING.SM,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.SMALL,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
  contributionTitle: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
    marginBottom: SPACING.XS,
  },
  contributionDescription: {
    fontSize: FONT_SIZES.SMALL,
    marginBottom: SPACING.SM,
  },
  contributionMeta: {
    gap: SPACING.XS,
  },
  contributionAddress: {
    fontSize: FONT_SIZES.SMALL,
  },
  contributionDate: {
    fontSize: FONT_SIZES.SMALL,
  },
  formContainer: {
    flex: 1,
    padding: SPACING.MD,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
    marginBottom: SPACING.SM,
    marginTop: SPACING.MD,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.SM,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    padding: SPACING.MD,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minWidth: '45%',
  },
  typeOptionText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: SPACING.MD,
    fontSize: FONT_SIZES.BODY,
    marginBottom: SPACING.SM,
    minHeight: 48,
  },
  textArea: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: SPACING.MD,
    fontSize: FONT_SIZES.BODY,
    height: 110,
    textAlignVertical: 'top',
  },
  submitButton: {
    paddingVertical: 15,
    paddingHorizontal: SPACING.MD,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: SPACING.MD,
    marginBottom: SPACING.LG,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: SPACING.XL,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.HEADING_3,
    fontWeight: '600',
    marginTop: SPACING.MD,
    marginBottom: SPACING.SM,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.BODY,
    textAlign: 'center',
    marginBottom: SPACING.LG,
  },
  emptyButton: {
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
  },
});