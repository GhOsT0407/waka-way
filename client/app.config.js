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
    },
    android: {
      package: 'com.wakaway.app',
      googleServicesFile: './google-services.json',
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
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      '@maplibre/maplibre-react-native',
      'expo-web-browser',
      '@react-native-firebase/app',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#F5C518',
          sounds: [],
        },
      ],
    ],
    extra: {
      eas: {
        projectId: 'b1fcec62-311f-49f8-bfa6-73b3e0e90cef',
      },
    },
  },
};
