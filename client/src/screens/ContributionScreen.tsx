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

export default function ContributionScreen() {
  const { theme } = useAppTheme();
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
      case 'approved': return '#4CAF50';
      case 'rejected': return '#F44336';
      default: return '#FF9800';
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
      <View style={[styles.contributionItem, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}>
        <View style={styles.contributionHeader}>
          <View style={styles.typeContainer}>
            <Ionicons name={typeInfo?.icon as any} size={20} color={theme.PRIMARY} />
            <Text style={[styles.typeLabel, { color: theme.PRIMARY }]}>{typeInfo?.label}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>

        <Text style={[styles.contributionTitle, { color: theme.TEXT }]}>{item.title}</Text>
        <Text style={[styles.contributionDescription, { color: theme.TEXT_SECONDARY }]}>{item.description}</Text>

        <View style={styles.contributionMeta}>
          <Text style={[styles.contributionAddress, { color: theme.TEXT_SECONDARY }]}>
            📍 {item.address}
          </Text>
          <Text style={[styles.contributionDate, { color: theme.TEXT_SECONDARY }]}>
            {new Date(item.timestamp).toLocaleDateString()}
          </Text>
        </View>
      </View>
    );
  };

  if (isAddingContribution) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.BACKGROUND }]}>
        <StatusBar style="auto" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => setIsAddingContribution(false)}>
            <Ionicons name="arrow-back" size={24} color={theme.TEXT} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.TEXT }]}>Add Contribution</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.formContainer}>
          <Text style={[styles.sectionTitle, { color: theme.TEXT }]}>What type of location is this?</Text>
          <View style={styles.typeGrid}>
            {CONTRIBUTION_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeOption,
                  { borderColor: theme.BORDER },
                  selectedType === type.id && { borderColor: theme.PRIMARY, backgroundColor: theme.CHIP_BACKGROUND }
                ]}
                onPress={() => setSelectedType(type.id)}
              >
                <Ionicons name={type.icon as any} size={24} color={selectedType === type.id ? theme.PRIMARY : theme.TEXT_SECONDARY} />
                <Text style={[
                  styles.typeOptionText,
                  { color: selectedType === type.id ? theme.PRIMARY : theme.TEXT_SECONDARY }
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.TEXT }]}>Title</Text>
          <TextInput
            style={[styles.input, { color: theme.TEXT, borderColor: theme.BORDER }]}
            placeholder="Brief title for this location"
            placeholderTextColor={theme.TEXT_SECONDARY}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.sectionTitle, { color: theme.TEXT }]}>Description</Text>
          <TextInput
            style={[styles.textArea, { color: theme.TEXT, borderColor: theme.BORDER }]}
            placeholder="Describe this location in detail..."
            placeholderTextColor={theme.TEXT_SECONDARY}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: theme.PRIMARY }]}
            onPress={submitContribution}
          >
            <Text style={styles.submitButtonText}>Submit Contribution</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.BACKGROUND }]}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.TEXT }]}>Community</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.PRIMARY }]}
          onPress={() => setIsAddingContribution(true)}
        >
          <Ionicons name="add" size={20} color={theme.WHITE} />
        </TouchableOpacity>
      </View>

      {/* View Toggle - Map / My Contributions */}
      <View style={styles.viewToggleContainer}>
        <TouchableOpacity
          style={[
            styles.viewToggleButton,
            viewMode === 'map' && { backgroundColor: theme.PRIMARY },
          ]}
          onPress={() => setViewMode('map')}
        >
          <Ionicons 
            name="map" 
            size={18} 
            color={viewMode === 'map' ? '#FFFFFF' : theme.TEXT_SECONDARY} 
          />
          <Text style={[
            styles.viewToggleText,
            { color: viewMode === 'map' ? '#FFFFFF' : theme.TEXT_SECONDARY }
          ]}>
            Community Map
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.viewToggleButton,
            viewMode === 'list' && { backgroundColor: theme.PRIMARY },
          ]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons 
            name="list" 
            size={18} 
            color={viewMode === 'list' ? '#FFFFFF' : theme.TEXT_SECONDARY} 
          />
          <Text style={[
            styles.viewToggleText,
            { color: viewMode === 'list' ? '#FFFFFF' : theme.TEXT_SECONDARY }
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
            <Text style={[styles.infoText, { color: theme.TEXT }]}>
              Help other commuters by tagging important locations like bus stops, taxi stands, or areas that need attention.
            </Text>
          </View>

          <FlatList
            data={contributions}
            keyExtractor={(item) => item.id}
            renderItem={renderContributionItem}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="heart-outline" size={48} color={theme.TEXT_SECONDARY} />
                <Text style={[styles.emptyTitle, { color: theme.TEXT }]}>No contributions yet</Text>
                <Text style={[styles.emptySubtitle, { color: theme.TEXT_SECONDARY }]}>
                  Your contributions to improve the app will appear here
                </Text>
                <TouchableOpacity
                  style={[styles.emptyButton, { backgroundColor: theme.PRIMARY }]}
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
    padding: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: FONT_SIZES.HEADING_2,
    fontWeight: '700',
    flex: 1,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.MD,
    marginVertical: SPACING.SM,
    backgroundColor: '#F0F0F0',
    borderRadius: BORDER_RADIUS.MEDIUM,
    padding: 4,
  },
  viewToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.XS,
    paddingVertical: SPACING.SM,
    borderRadius: BORDER_RADIUS.SMALL,
  },
  viewToggleText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
  infoContainer: {
    padding: SPACING.MD,
    backgroundColor: 'rgba(46, 125, 50, 0.1)',
    marginHorizontal: SPACING.MD,
    marginBottom: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
  },
  infoText: {
    fontSize: FONT_SIZES.SMALL,
    lineHeight: 20,
  },
  contributionItem: {
    margin: SPACING.MD,
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
    borderWidth: 1,
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
    borderRadius: BORDER_RADIUS.MEDIUM,
    borderWidth: 1,
    flex: 1,
    minWidth: '45%',
  },
  typeOptionText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.MEDIUM,
    padding: SPACING.MD,
    fontSize: FONT_SIZES.BODY,
    marginBottom: SPACING.SM,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.MEDIUM,
    padding: SPACING.MD,
    fontSize: FONT_SIZES.BODY,
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
    alignItems: 'center',
    marginTop: SPACING.MD,
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