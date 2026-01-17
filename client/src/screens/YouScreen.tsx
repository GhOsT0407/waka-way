import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';

interface SavedTrip {
  id: string;
  origin: string;
  destination: string;
  transportMode: string;
  date: string;
}

interface FavoritePlace {
  id: string;
  name: string;
  address: string;
  type: 'home' | 'work' | 'favorite';
}

export default function YouScreen() {
  const { theme } = useAppTheme();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'trips' | 'places' | 'favorites'>('trips');
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [placesToGo, setPlacesToGo] = useState<FavoritePlace[]>([]);
  const [favoritePlaces, setFavoritePlaces] = useState<FavoritePlace[]>([]);

  useEffect(() => {
    loadUserData();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const loadUserData = async () => {
    try {
      const trips = await AsyncStorage.getItem('savedTrips');
      if (trips) {
        setSavedTrips(JSON.parse(trips));
      }

      const places = await AsyncStorage.getItem('placesToGo');
      if (places) {
        setPlacesToGo(JSON.parse(places));
      }

      const favorites = await AsyncStorage.getItem('favoritePlaces');
      if (favorites) {
        setFavoritePlaces(JSON.parse(favorites));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const removeTrip = async (tripId: string) => {
    const updatedTrips = savedTrips.filter(trip => trip.id !== tripId);
    setSavedTrips(updatedTrips);
    await AsyncStorage.setItem('savedTrips', JSON.stringify(updatedTrips));
  };

  const removePlace = async (placeId: string, type: 'places' | 'favorites') => {
    if (type === 'places') {
      const updatedPlaces = placesToGo.filter(place => place.id !== placeId);
      setPlacesToGo(updatedPlaces);
      await AsyncStorage.setItem('placesToGo', JSON.stringify(updatedPlaces));
    } else {
      const updatedFavorites = favoritePlaces.filter(place => place.id !== placeId);
      setFavoritePlaces(updatedFavorites);
      await AsyncStorage.setItem('favoritePlaces', JSON.stringify(updatedFavorites));
    }
  };

  const renderTripItem = ({ item }: { item: SavedTrip }) => (
    <View style={[styles.tripItem, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}>
      <View style={styles.tripHeader}>
        <View style={styles.tripRoute}>
          <Text style={[styles.tripOrigin, { color: theme.TEXT_SECONDARY }]}>{item.origin}</Text>
          <Ionicons name="arrow-forward" size={16} color={theme.TEXT_SECONDARY} />
          <Text style={[styles.tripDestination, { color: theme.TEXT }]}>{item.destination}</Text>
        </View>
        <TouchableOpacity onPress={() => removeTrip(item.id)}>
          <Ionicons name="trash-outline" size={20} color={theme.TEXT_SECONDARY} />
        </TouchableOpacity>
      </View>
      <View style={styles.tripMeta}>
        <Text style={[styles.tripMode, { color: theme.PRIMARY }]}>{item.transportMode}</Text>
        <Text style={[styles.tripDate, { color: theme.TEXT_SECONDARY }]}>{item.date}</Text>
      </View>
    </View>
  );

  const renderPlaceItem = ({ item }: { item: FavoritePlace }) => (
    <View style={[styles.placeItem, { backgroundColor: theme.SURFACE, borderColor: theme.BORDER }]}>
      <View style={styles.placeHeader}>
        <View style={styles.placeInfo}>
          <Text style={[styles.placeName, { color: theme.TEXT }]}>{item.name}</Text>
          <Text style={[styles.placeAddress, { color: theme.TEXT_SECONDARY }]}>{item.address}</Text>
        </View>
        <TouchableOpacity onPress={() => removePlace(item.id, activeTab === 'places' ? 'places' : 'favorites')}>
          <Ionicons name="trash-outline" size={20} color={theme.TEXT_SECONDARY} />
        </TouchableOpacity>
      </View>
      <View style={styles.placeType}>
        <Ionicons
          name={item.type === 'home' ? 'home' : item.type === 'work' ? 'briefcase' : 'heart'}
          size={16}
          color={theme.PRIMARY}
        />
        <Text style={[styles.placeTypeText, { color: theme.PRIMARY }]}>
          {item.type === 'home' ? 'Home' : item.type === 'work' ? 'Work' : 'Favorite'}
        </Text>
      </View>
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'trips':
        return (
          <FlatList
            data={savedTrips}
            keyExtractor={(item) => item.id}
            renderItem={renderTripItem}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="car-outline" size={48} color={theme.TEXT_SECONDARY} />
                <Text style={[styles.emptyTitle, { color: theme.TEXT }]}>No saved trips yet</Text>
                <Text style={[styles.emptySubtitle, { color: theme.TEXT_SECONDARY }]}>
                  Your saved trips will appear here
                </Text>
              </View>
            }
            contentContainerStyle={savedTrips.length === 0 ? styles.emptyContainer : undefined}
          />
        );
      case 'places':
        return (
          <FlatList
            data={placesToGo}
            keyExtractor={(item) => item.id}
            renderItem={renderPlaceItem}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="location-outline" size={48} color={theme.TEXT_SECONDARY} />
                <Text style={[styles.emptyTitle, { color: theme.TEXT }]}>No places to go</Text>
                <Text style={[styles.emptySubtitle, { color: theme.TEXT_SECONDARY }]}>
                  Add places you want to visit
                </Text>
              </View>
            }
            contentContainerStyle={placesToGo.length === 0 ? styles.emptyContainer : undefined}
          />
        );
      case 'favorites':
        return (
          <FlatList
            data={favoritePlaces}
            keyExtractor={(item) => item.id}
            renderItem={renderPlaceItem}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="heart-outline" size={48} color={theme.TEXT_SECONDARY} />
                <Text style={[styles.emptyTitle, { color: theme.TEXT }]}>No favorite places</Text>
                <Text style={[styles.emptySubtitle, { color: theme.TEXT_SECONDARY }]}>
                  Your favorite places will appear here
                </Text>
              </View>
            }
            contentContainerStyle={favoritePlaces.length === 0 ? styles.emptyContainer : undefined}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.BACKGROUND }]}>
      <StatusBar style="auto" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.headerTitle, { color: theme.TEXT }]}>You</Text>
            {user && (
              <Text style={[styles.userName, { color: theme.TEXT_SECONDARY }]}>
                Welcome, {user.name}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: theme.SURFACE }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.TEXT} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'trips' && [styles.activeTab, { borderColor: theme.PRIMARY }]]}
          onPress={() => setActiveTab('trips')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'trips' ? theme.PRIMARY : theme.TEXT_SECONDARY }]}>
            Saved Trips
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'places' && [styles.activeTab, { borderColor: theme.PRIMARY }]]}
          onPress={() => setActiveTab('places')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'places' ? theme.PRIMARY : theme.TEXT_SECONDARY }]}>
            Places to Go
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'favorites' && [styles.activeTab, { borderColor: theme.PRIMARY }]]}
          onPress={() => setActiveTab('favorites')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'favorites' ? theme.PRIMARY : theme.TEXT_SECONDARY }]}>
            Favorites
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.HEADING_2,
    fontWeight: '700',
  },
  userName: {
    fontSize: FONT_SIZES.SMALL,
    marginTop: SPACING.XS,
  },
  logoutButton: {
    padding: SPACING.SM,
    borderRadius: BORDER_RADIUS.MEDIUM,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    gap: SPACING.SM,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.SM,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.MEDIUM,
  },
  activeTab: {
    borderWidth: 2,
  },
  tabText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tripItem: {
    margin: SPACING.MD,
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
    borderWidth: 1,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  tripRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tripOrigin: {
    fontSize: FONT_SIZES.SMALL,
    flex: 1,
  },
  tripDestination: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
    flex: 1,
  },
  tripMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripMode: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
  tripDate: {
    fontSize: FONT_SIZES.SMALL,
  },
  placeItem: {
    margin: SPACING.MD,
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
    borderWidth: 1,
  },
  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.SM,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
    marginBottom: 2,
  },
  placeAddress: {
    fontSize: FONT_SIZES.SMALL,
  },
  placeType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
  },
  placeTypeText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '500',
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
  },
});