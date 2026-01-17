import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    TextInput,
    FlatList,
    ActivityIndicator,
    Platform,
    Keyboard,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAppTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';
import { searchRoutes } from '../services/api';

const RECENT_SEARCHES = [
    { id: 1, name: 'Victoria Island', address: 'Lagos', coordinates: { latitude: 6.4281, longitude: 3.4219 } },
    { id: 2, name: 'Shoprite Ikeja', address: 'Obafemi Awolowo Way, Lagos', coordinates: { latitude: 6.5244, longitude: 3.3792 } },
];

const POPULAR_PLACES = [
    { id: 1, name: 'Lekki Phase 1', address: 'Lagos', coordinates: { latitude: 6.4488, longitude: 3.4723 } },
    { id: 2, name: 'Ikeja City Mall', address: 'Lagos', coordinates: { latitude: 6.6059, longitude: 3.3490 } },
    { id: 3, name: 'Surulere', address: 'Lagos', coordinates: { latitude: 6.4914, longitude: 3.3587 } },
    { id: 4, name: 'Yaba', address: 'Lagos', coordinates: { latitude: 6.5101, longitude: 3.3869 } },
    { id: 5, name: 'Ajah', address: 'Lagos', coordinates: { latitude: 6.4734, longitude: 3.5862 } },
];

// Default Lagos location (Victoria Island) for testing when outside Lagos
const DEFAULT_LAGOS_LOCATION = { latitude: 6.4281, longitude: 3.4219 };

// Check if coordinates are within Lagos area
const isWithinLagos = (lat: number, lng: number): boolean => {
    return lat >= 6.3 && lat <= 6.8 && lng >= 3.1 && lng <= 4.0;
};

export default function SearchScreen({ navigation }: any) {
    const { theme } = useAppTheme();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    useEffect(() => {
        getUserLocation();
    }, []);

    useEffect(() => {
        if (query.length > 0) {
            generateSuggestions(query);
        } else {
            setSuggestions([]);
        }
    }, [query]);

    const getUserLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({});
                const lat = location.coords.latitude;
                const lng = location.coords.longitude;
                
                // Check if user is in Lagos area
                if (isWithinLagos(lat, lng)) {
                    setUserLocation({ latitude: lat, longitude: lng });
                } else {
                    // User is outside Lagos - use default Lagos location for testing
                    console.log('User outside Lagos, using default location for testing');
                    setUserLocation(DEFAULT_LAGOS_LOCATION);
                }
            } else {
                // Permission denied - use default Lagos location
                setUserLocation(DEFAULT_LAGOS_LOCATION);
            }
        } catch (error) {
            console.error('Error getting user location:', error);
            // Fallback to default Lagos location
            setUserLocation(DEFAULT_LAGOS_LOCATION);
        }
    };

    const generateSuggestions = (searchQuery: string) => {
        const filteredPlaces = POPULAR_PLACES.filter(place =>
            place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            place.address.toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Add current query as a suggestion if it doesn't match existing places
        const querySuggestion = {
            id: 'query',
            name: searchQuery,
            address: 'Search for this location',
            coordinates: null, // Will use geocoding
            isQuery: true,
        };

        setSuggestions([querySuggestion, ...filteredPlaces.slice(0, 4)]);
    };

    const handleDestinationSelect = async (destination: any) => {
        if (!userLocation) {
            Alert.alert('Location Required', 'Please enable location services to get directions.');
            return;
        }

        Keyboard.dismiss();
        setLoading(true);

        try {
            let destinationCoords = destination.coordinates;

            // If it's a custom query, try to geocode it
            if (destination.isQuery) {
                try {
                    // Add "Lagos Nigeria" to improve geocoding accuracy
                    const searchQuery = `${destination.name} Lagos Nigeria`;
                    const geocodeResult = await Location.geocodeAsync(searchQuery);
                    if (geocodeResult.length > 0) {
                        const lat = geocodeResult[0].latitude;
                        const lng = geocodeResult[0].longitude;
                        
                        // Validate that result is in Lagos
                        if (isWithinLagos(lat, lng)) {
                            destinationCoords = { latitude: lat, longitude: lng };
                        } else {
                            // Result is not in Lagos - show error
                            Alert.alert('Location Not in Lagos', 'Please search for a location within Lagos, Nigeria.');
                            setLoading(false);
                            return;
                        }
                    } else {
                        Alert.alert('Location Not Found', 'Could not find this location. Please try a different search.');
                        setLoading(false);
                        return;
                    }
                } catch (error) {
                    Alert.alert('Location Not Found', 'Could not find this location. Please try a different search.');
                    setLoading(false);
                    return;
                }
            }

            // Get routes for public transport
            const routeResult = await searchRoutes({
                origin: userLocation,
                destination: destinationCoords,
                destinationName: destination.name,
                destinationDetails: destination,
            });

            if (routeResult && routeResult.legacyRoute) {
                // Replace the search modal with route detail screen
                navigation.replace('RouteDetail', {
                    routeData: routeResult.legacyRoute,
                    smartRouteData: routeResult.smartRoute,
                    destination: destination,
                });
            } else {
                Alert.alert('No Routes Found', 'Could not find public transport routes to this destination.');
            }
        } catch (error) {
            console.error('Error getting routes:', error);
            Alert.alert('Error', 'Failed to get directions. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.BACKGROUND }]}>
            <StatusBar style="dark" />
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={{ flex: 1 }}>
                    <SafeAreaView style={styles.safeArea}>

                        {/* Header Section - Vertical Flexbox Layout */}
                        <View style={styles.headerSection}>
                            <View style={styles.searchRow}>
                                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                    <Ionicons name="arrow-back" size={24} color={theme.PRIMARY} />
                                </TouchableOpacity>
                                <TextInput
                                    style={[styles.searchInput, { color: theme.TEXT }]}
                                    placeholder="Search places, addresses..."
                                    placeholderTextColor={theme.TEXT_SECONDARY}
                                    value={query}
                                    onChangeText={setQuery}
                                    autoFocus={true}
                                    returnKeyType="search"
                                    onSubmitEditing={() => query && handleDestinationSelect({ name: query, isQuery: true })}
                                />
                                {query.length > 0 && (
                                    <TouchableOpacity onPress={() => setQuery('')}>
                                        <Ionicons name="close-circle" size={20} color={theme.TEXT_SECONDARY} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Quick Actions - Home/Work buttons */}
                            <View style={styles.quickActionsRow}>
                                <TouchableOpacity style={styles.quickChip} onPress={() => handleDestinationSelect({ name: 'Home', address: 'Your home location', id: 'home' })}>
                                    <Ionicons name="home" size={16} color={theme.PRIMARY} />
                                    <Text style={[styles.quickChipText, { color: theme.PRIMARY }]}>Home</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.quickChip} onPress={() => handleDestinationSelect({ name: 'Work', address: 'Your work location', id: 'work' })}>
                                    <Ionicons name="briefcase" size={16} color={theme.PRIMARY} />
                                    <Text style={[styles.quickChipText, { color: theme.PRIMARY }]}>Work</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Content - Suggestions or Recent */}
                        <View style={styles.content}>
                            {loading ? (
                                <View style={styles.center}>
                                    <ActivityIndicator size="large" color={theme.PRIMARY} />
                                    <Text style={[styles.loadingText, { color: theme.TEXT_SECONDARY }]}>
                                        Finding public transport routes...
                                    </Text>
                                </View>
                            ) : (
                                <View>
                                    {query ? (
                                        <>
                                            <Text style={[styles.sectionTitle, { color: theme.TEXT }]}>Suggestions</Text>
                                            <FlatList
                                                data={suggestions}
                                                keyExtractor={(item) => item.id.toString()}
                                                keyboardShouldPersistTaps="handled"
                                                keyboardDismissMode="on-drag"
                                                renderItem={({ item }) => (
                                                    <TouchableOpacity
                                                        style={styles.suggestionItem}
                                                        onPress={() => handleDestinationSelect(item)}
                                                    >
                                                        <View style={styles.suggestionIcon}>
                                                            <Ionicons
                                                                name={item.isQuery ? "search" : "location-outline"}
                                                                size={20}
                                                                color={theme.PRIMARY}
                                                            />
                                                        </View>
                                                        <View style={styles.suggestionInfo}>
                                                            <Text style={[styles.suggestionName, { color: theme.TEXT }]}>
                                                                {item.name}
                                                            </Text>
                                                            <Text style={[styles.suggestionAddress, { color: theme.TEXT_SECONDARY }]}>
                                                                {item.address}
                                                            </Text>
                                                            {item.isQuery && (
                                                                <Text style={[styles.suggestionHint, { color: theme.PRIMARY }]}>
                                                                    Tap to search for this location
                                                                </Text>
                                                            )}
                                                        </View>
                                                    </TouchableOpacity>
                                                )}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <Text style={[styles.sectionTitle, { color: theme.TEXT }]}>Recent</Text>
                                            <FlatList
                                                data={RECENT_SEARCHES}
                                                keyExtractor={(item) => item.id.toString()}
                                                keyboardShouldPersistTaps="handled"
                                                keyboardDismissMode="on-drag"
                                                renderItem={({ item }) => (
                                                    <TouchableOpacity
                                                        style={styles.recentItem}
                                                        onPress={() => handleDestinationSelect(item)}
                                                    >
                                                        <View style={styles.recentIcon}>
                                                            <Ionicons name="location-outline" size={20} color={theme.PRIMARY} />
                                                        </View>
                                                        <View>
                                                            <Text style={[styles.recentName, { color: theme.TEXT }]}>{item.name}</Text>
                                                            <Text style={[styles.recentAddress, { color: theme.TEXT_SECONDARY }]}>{item.address}</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                )}
                                            />

                                            <Text style={[styles.sectionTitle, { color: theme.TEXT, marginTop: SPACING.LG }]}>Popular Places</Text>
                                            <FlatList
                                                data={POPULAR_PLACES}
                                                keyExtractor={(item) => item.id.toString()}
                                                keyboardShouldPersistTaps="handled"
                                                keyboardDismissMode="on-drag"
                                                renderItem={({ item }) => (
                                                    <TouchableOpacity
                                                        style={styles.recentItem}
                                                        onPress={() => handleDestinationSelect(item)}
                                                    >
                                                        <View style={styles.recentIcon}>
                                                            <Ionicons name="location-outline" size={20} color={theme.PRIMARY} />
                                                        </View>
                                                        <View>
                                                            <Text style={[styles.recentName, { color: theme.TEXT }]}>{item.name}</Text>
                                                            <Text style={[styles.recentAddress, { color: theme.TEXT_SECONDARY }]}>{item.address}</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                )}
                                            />
                                        </>
                                    )}
                                </View>
                            )}
                        </View>
                    </SafeAreaView>
                </View>
            </TouchableWithoutFeedback>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    headerSection: {
        flexDirection: 'column',
        padding: SPACING.MD,
        paddingBottom: 24, // Fixed padding bottom as requested
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.SM,
        marginBottom: SPACING.SM,
    },
    backButton: {
        padding: 4,
    },
    searchInputContainer: {
        // Legacy container if needed
        flex: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: FONT_SIZES.BODY,
        paddingVertical: 8,
    },
    quickActionsRow: {
        flexDirection: 'row',
        gap: SPACING.SM,
        marginTop: 4,
        marginBottom: 24,
    },
    quickChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#C8E6C9',
    },
    quickChipText: {
        fontSize: FONT_SIZES.SMALL,
        fontWeight: '600',
        color: '#2E7D32',
    },
    content: {
        flex: 1,
        padding: SPACING.MD,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: SPACING.MD,
        fontSize: FONT_SIZES.BODY,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#444746',
        marginBottom: SPACING.SM,
    },
    recentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.MD,
        gap: SPACING.MD,
    },
    recentIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E8F5E9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    recentName: {
        fontSize: FONT_SIZES.BODY,
        fontWeight: '600',
        color: '#1C1B1F',
    },
    recentAddress: {
        fontSize: FONT_SIZES.CAPTION,
        color: '#444746',
    },
    separator: {
        height: 1,
        backgroundColor: '#EEEEEE',
        marginLeft: 36 + SPACING.MD, // Align with text
    },
    mockResult: {
        marginTop: SPACING.XL,
        padding: SPACING.MD,
        backgroundColor: '#e8f5e9',
        borderRadius: BORDER_RADIUS.MEDIUM,
        alignItems: 'center',
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.MD,
        gap: SPACING.MD,
    },
    suggestionIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E8F5E9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    suggestionInfo: {
        flex: 1,
    },
    suggestionName: {
        fontSize: FONT_SIZES.BODY,
        fontWeight: '600',
        color: '#1C1B1F',
    },
    suggestionAddress: {
        fontSize: FONT_SIZES.CAPTION,
        color: '#444746',
    },
    suggestionHint: {
        fontSize: FONT_SIZES.SMALL,
        fontWeight: '500',
        color: '#2E7D32',
        marginTop: 2,
    },
});
