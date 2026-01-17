import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Image,
  Dimensions,
  TextInput,
  Alert,
  Animated,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useAppTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';
import { getNearbyStops } from '../services/api';
import { WakaWayMapView } from '../components/map/MapView';

const { width } = Dimensions.get('window');

const TRENDING_PLACES = [
  { id: 1, name: 'Tarkwa Bay', image: 'https://images.unsplash.com/photo-1590457173273-044237194833' },
  { id: 2, name: 'Nike Art Gallery', image: 'https://images.unsplash.com/photo-1550951664-9eb06b744049' },
  { id: 3, name: 'Lekki Conservation', image: 'https://images.unsplash.com/photo-1623345805780-8f6e91060939' },
];

export default function HomeScreen({ navigation }: any) {
  const { theme } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [nearbyStops, setNearbyStops] = useState<any[]>([]);
  const [savedJourneys, setSavedJourneys] = useState<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<string>('Getting location...');
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Bottom sheet refs and state
  const bottomSheetY = useRef(new Animated.Value(0)).current;
  const searchBarOpacity = useRef(new Animated.Value(1)).current;
  const lastGestureDy = useRef(0);
  const [bottomSheetHeight, setBottomSheetHeight] = useState(200); // Default collapsed height

  // Selected place state - null by default, only show bottom sheet when a place is selected
  const [selectedPlace, setSelectedPlace] = useState<any>(null);

  useEffect(() => {
    loadNearbyStops();
    loadSavedJourneys();
    loadCurrentLocation();
  }, []);

  const loadNearbyStops = async () => {
    try {
      const stops = await getNearbyStops(6.5244, 3.3792);
      setNearbyStops(stops);
    } catch (e) {
      console.log('Error loading stops', e);
    }
  };

  const loadSavedJourneys = async () => {
    try {
      const saved = await AsyncStorage.getItem('savedJourneys');
      if (saved) {
        setSavedJourneys(JSON.parse(saved));
      }
    } catch (e) {
      console.log('Error loading saved journeys', e);
    }
  };

  const loadCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCurrentLocation('Location permission denied');
        // Default to Lagos (Maryland/Ikeja area) when permissions denied
        setLocationCoords({
          latitude: 6.5244,
          longitude: 3.3792,
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocationCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Reverse geocode to get city/neighborhood
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (geocode.length > 0) {
        const address = geocode[0];
        const locationName = address.city || address.region || address.country || 'Unknown Location';
        setCurrentLocation(locationName);
      } else {
        setCurrentLocation('Unknown Location');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setCurrentLocation('Location unavailable');
      // Fallback to Lagos on error
      setLocationCoords({
        latitude: 6.5244,
        longitude: 3.3792,
      });
    }
  };

  const handleSheetChanges = (index: number) => {
    // Animate search bar opacity based on sheet position
    Animated.timing(searchBarOpacity, {
      toValue: index === 2 ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: bottomSheetY } }],
    { useNativeDriver: false }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY } = event.nativeEvent;
      lastGestureDy.current += translationY;

      // Snap to positions based on gesture
      const screenHeight = Dimensions.get('window').height;
      const collapsedHeight = 200;
      const halfHeight = screenHeight * 0.5;
      const fullHeight = screenHeight * 0.9;

      let targetHeight = collapsedHeight;
      if (Math.abs(lastGestureDy.current) > collapsedHeight) {
        if (Math.abs(lastGestureDy.current) > halfHeight) {
          targetHeight = fullHeight;
        } else {
          targetHeight = halfHeight;
        }
      }

      Animated.spring(bottomSheetY, {
        toValue: -targetHeight,
        useNativeDriver: false,
      }).start();

      setBottomSheetHeight(targetHeight);
      handleSheetChanges(targetHeight === fullHeight ? 2 : targetHeight === halfHeight ? 1 : 0);
    }
  };

  const handleCurrentLocation = () => {
    // Implement current location logic
    Alert.alert('Current Location', 'Navigating to your location...');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Full Screen Map */}
      <WakaWayMapView
        style={styles.map}
        showUserLocation={true}
        initialRegion={locationCoords ? {
          latitude: locationCoords.latitude,
          longitude: locationCoords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        } : undefined}
        markers={selectedPlace ? [
          {
            id: 'selected-place',
            coordinate: { latitude: 6.5481, longitude: 3.3832 }, // This should be dynamic based on selectedPlace
            title: selectedPlace.name,
            description: selectedPlace.address,
          }
        ] : []}
      />

      {/* Floating Search Bar */}
      <Animated.View style={[styles.searchBarContainer, { opacity: searchBarOpacity }]}>
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={20} color="#757575" />
          <Text style={styles.searchPlaceholder}>Search places, addresses...</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Category Chips */}
      <Animated.View style={[styles.chipsContainer, { opacity: searchBarOpacity }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          {[
            { id: 'restaurants', label: 'Restaurants', icon: 'restaurant' },
            { id: 'hotels', label: 'Hotels', icon: 'bed' },
            { id: 'attractions', label: 'Attractions', icon: 'camera' },
            { id: 'transport', label: 'Transport', icon: 'bus' },
            { id: 'shopping', label: 'Shopping', icon: 'bag' },
          ].map((chip) => (
            <TouchableOpacity key={chip.id} style={styles.chip}>
              <Ionicons name={chip.icon as any} size={16} color="#2E7D32" />
              <Text style={styles.chipText}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleCurrentLocation}>
        <Ionicons name="locate" size={24} color="#2E7D32" />
      </TouchableOpacity>

      {/* Custom Bottom Sheet - Only show when a place is selected */}
      {selectedPlace && (
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
        >
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              transform: [{ translateY: bottomSheetY }],
            },
          ]}
        >
          <View style={styles.bottomSheetHandle}>
            <View style={styles.handleIndicator} />
          </View>

          <ScrollView contentContainerStyle={styles.bottomSheetContent}>
            {/* Fixed Header with Home/Work Icons */}
            <View style={styles.sheetHeader}>
              <TouchableOpacity style={styles.locationButton}>
                <Ionicons name="home-outline" size={20} color={theme.TEXT} />
                <Text style={[styles.locationButtonText, { color: theme.TEXT }]}>Home</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.locationButton}>
                <Ionicons name="briefcase-outline" size={20} color={theme.TEXT} />
                <Text style={[styles.locationButtonText, { color: theme.TEXT }]}>Work</Text>
              </TouchableOpacity>
            </View>

            {/* Place Header */}
            <View style={styles.placeHeader}>
              <View style={styles.placeInfo}>
                <Text style={[styles.placeName, { color: theme.TEXT }]}>{selectedPlace.name}</Text>
                <Text style={[styles.placeAddress, { color: theme.TEXT_SECONDARY }]}>{selectedPlace.address}</Text>
                <View style={styles.placeMeta}>
                  <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={[styles.ratingText, { color: theme.TEXT }]}>{selectedPlace.rating}</Text>
                    <Text style={[styles.reviewsText, { color: theme.TEXT_SECONDARY }]}>({selectedPlace.reviews})</Text>
                  </View>
                  <Text style={[styles.distanceText, { color: theme.TEXT_SECONDARY }]}>{selectedPlace.distance}</Text>
                </View>
              </View>
            </View>

            {/* Route Info Pill */}
            <View style={styles.routeInfoPill}>
              <Ionicons name="car-outline" size={16} color={theme.PRIMARY} />
              <Text style={[styles.routeInfoText, { color: theme.TEXT }]}>{selectedPlace.time} • {selectedPlace.distance}</Text>
            </View>

            {/* Action Buttons Row */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity style={styles.directionsButton}>
                <Text style={styles.directionsButtonText}>Directions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="play" size={20} color={theme.PRIMARY} />
                <Text style={[styles.actionButtonText, { color: theme.PRIMARY }]}>Start</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="bookmark-outline" size={20} color={theme.PRIMARY} />
                <Text style={[styles.actionButtonText, { color: theme.PRIMARY }]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="share-outline" size={20} color={theme.PRIMARY} />
                <Text style={[styles.actionButtonText, { color: theme.PRIMARY }]}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* Photo Carousel */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoCarousel}>
                {selectedPlace.images.map((image: string, index: number) => (
                  <Image key={index} source={{ uri: image }} style={styles.carouselImage} />
                ))}
              </ScrollView>

              {/* Nearby Sections */}
              {selectedPlace.nearby.map((section: any, index: number) => (
                <View key={index} style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: theme.TEXT }]}>{section.name}</Text>
                  {section.items.map((item: string, itemIndex: number) => (
                  <Text key={itemIndex} style={[styles.sectionItem, { color: theme.TEXT_SECONDARY }]}>{item}</Text>
                ))}
                {index < selectedPlace.nearby.length - 1 && <View style={styles.separator} />}
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </PanGestureHandler>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  searchBarContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: SPACING.MD,
    right: SPACING.MD,
    zIndex: 100,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  searchPlaceholder: {
    flex: 1,
    marginLeft: SPACING.SM,
    color: '#757575',
    fontSize: FONT_SIZES.BODY,
  },
  chipsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    left: SPACING.MD,
    right: SPACING.MD,
    zIndex: 99,
  },
  chipsScroll: {
    gap: SPACING.SM,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.XS,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  chipText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
    color: '#2E7D32',
  },
  fab: {
    position: 'absolute',
    bottom: 120,
    right: SPACING.MD,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
  bottomSheetContent: {
    padding: SPACING.MD,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48, // Fixed height
    marginBottom: SPACING.MD,
    paddingBottom: SPACING.MD,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.XS,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  locationButtonText: {
    marginLeft: SPACING.XS,
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '500',
  },
  placeHeader: {
    marginBottom: SPACING.MD,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: FONT_SIZES.HEADING_2,
    fontWeight: '700',
    marginBottom: 4,
  },
  placeAddress: {
    fontSize: FONT_SIZES.BODY,
    marginBottom: SPACING.XS,
  },
  placeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.MD,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
  },
  ratingText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
  reviewsText: {
    fontSize: FONT_SIZES.SMALL,
  },
  distanceText: {
    fontSize: FONT_SIZES.SMALL,
  },
  routeInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    alignSelf: 'center',
    marginBottom: SPACING.MD,
  },
  routeInfoText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
    marginLeft: SPACING.XS,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.MD,
  },
  directionsButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.SM,
    borderRadius: 24,
    flex: 1,
    marginRight: SPACING.SM,
  },
  directionsButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E9',
    flex: 1,
    marginHorizontal: SPACING.XS,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
    marginLeft: SPACING.XS,
    color: '#2E7D32',
  },
  photoCarousel: {
    marginBottom: SPACING.MD,
  },
  carouselImage: {
    width: 200,
    height: 120,
    borderRadius: 16,
    marginRight: SPACING.SM,
  },
  section: {
    marginBottom: SPACING.MD,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.BODY_LARGE,
    fontWeight: '600',
    marginBottom: SPACING.SM,
  },
  sectionItem: {
    fontSize: FONT_SIZES.BODY,
    marginBottom: SPACING.XS,
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: SPACING.MD,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Dimensions.get('window').height * 0.9,
    minHeight: 200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  bottomSheetHandle: {
    alignItems: 'center',
    paddingVertical: SPACING.SM,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
  },
});

