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
      backgroundColor: '#080D0B',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.wakaway.app',
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'WakaWay needs your location to find nearby transport stops and suggest routes.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'WakaWay needs your location to find nearby transport stops and suggest routes.',
      },
    },
    android: {
      package: 'com.wakaway.app',
      googleServicesFile: './google-services.json',
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#F5C518',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        // ACCESS_BACKGROUND_LOCATION intentionally omitted — app only needs foreground location
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-web-browser',
      '@react-native-firebase/app',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#F5C518',
          sounds: [],
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'WakaWay accesses your photos to attach them to a report.',
          cameraPermission: 'WakaWay uses your camera to take a photo for a report.',
        },
      ],
      '@sentry/react-native/expo',
    ],
    extra: {
      eas: {
        projectId: 'b1fcec62-311f-49f8-bfa6-73b3e0e90cef',
      },
    },
  },
};
