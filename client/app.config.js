const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

module.exports = {
  expo: {
    name: 'WakaWay',
    slug: 'waka-way',
    version: '1.0.0',
    scheme: 'wakaway',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    description: 'Find your WakaWay - Move Smart. Move Local.',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#2ECC71',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.wakaway.app',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'WakaWay needs your location to find nearby transport stops and suggest routes.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'WakaWay needs your location to find nearby transport stops and suggest routes.',
      },
      config: {
        googleMapsApiKey: mapsKey,
      },
    },
    android: {
      package: 'com.wakaway.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        // ACCESS_BACKGROUND_LOCATION intentionally omitted — app only needs foreground location
      ],
      config: {
        googleMaps: {
          apiKey: mapsKey,
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-web-browser',
      '@rnmapbox/maps',
    ],
    extra: {
      eas: {
        projectId: 'b1fcec62-311f-49f8-bfa6-73b3e0e90cef',
      },
    },
  },
};
