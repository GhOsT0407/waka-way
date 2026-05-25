import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_DONE_KEY = '@waka_onboarding_done';

const { width: W } = Dimensions.get('window');

interface Feature {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}

interface Slide {
  id: string;
  accent: string;
  bgTint: string;
  icon: keyof typeof Ionicons.glyphMap;
  secondIcon: keyof typeof Ionicons.glyphMap;
  tag: string;
  title: string;
  subtitle: string;
  features: Feature[];
}

const SLIDES: Slide[] = [
  {
    id: '1',
    accent: '#22C55E',
    bgTint: 'rgba(34,197,94,0.07)',
    icon: 'navigate',
    secondIcon: 'bus',
    tag: 'NAVIGATION',
    title: 'Lagos in\nYour Pocket',
    subtitle: 'Smart multi-modal routes — real Lagos directions, no confusion',
    features: [
      { icon: 'bus-outline',         text: 'Danfo · Keke · Okada · BRT · Ferry' },
      { icon: 'cash-outline',        text: 'See estimated fares before you board' },
      { icon: 'cloud-offline-outline', text: 'Works offline in low signal areas' },
    ],
  },
  {
    id: '2',
    accent: '#60A5FA',
    bgTint: 'rgba(96,165,250,0.07)',
    icon: 'git-branch-outline',
    secondIcon: 'location',
    tag: 'PLANNING',
    title: 'Your Route,\nYour Rules',
    subtitle: 'Tell us what transport is near you — we plan every step',
    features: [
      { icon: 'swap-horizontal-outline', text: 'Multi-mode trip planning' },
      { icon: 'map-outline',             text: 'Step-by-step navigation' },
      { icon: 'alert-circle-outline',    text: 'Incident avoidance routing' },
    ],
  },
  {
    id: '3',
    accent: '#F59E0B',
    bgTint: 'rgba(245,158,11,0.07)',
    icon: 'people-outline',
    secondIcon: 'megaphone-outline',
    tag: 'COMMUNITY',
    title: 'Lagos Moves\nTogether',
    subtitle: 'Real alerts from real Lagosians — traffic, checkpoints, hazards',
    features: [
      { icon: 'flag-outline',           text: 'Report traffic & incidents' },
      { icon: 'checkmark-circle-outline', text: 'Confirm alerts from others' },
      { icon: 'heart-outline',           text: 'Save your favorite routes' },
    ],
  },
];

function SlideIllustration({ slide }: { slide: Slide }) {
  return (
    <View style={[styles.illustWrap, { backgroundColor: slide.bgTint }]}>
      <View style={[styles.illustRing3, { borderColor: slide.accent + '12' }]} />
      <View style={[styles.illustRing2, { borderColor: slide.accent + '22' }]} />
      <View style={[styles.illustRing1, { borderColor: slide.accent + '40' }]}>
        <View style={[styles.illustCore, { backgroundColor: slide.accent + '18' }]}>
          <Ionicons name={slide.icon} size={54} color={slide.accent} />
        </View>
      </View>
      <View style={[styles.floatOrb, { backgroundColor: slide.accent + '20', borderColor: slide.accent + '55' }]}>
        <Ionicons name={slide.secondIcon} size={16} color={slide.accent} />
      </View>
    </View>
  );
}

interface OnboardingScreenProps {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1 / SLIDES.length)).current;

  React.useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentIndex + 1) / SLIDES.length,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [currentIndex]);

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleDone();
    }
  };

  const handleDone = async () => {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    Animated.timing(fadeAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start(onDone);
  };

  const currentSlide = SLIDES[currentIndex];

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={styles.slide}>
      <SlideIllustration slide={item} />

      <View style={styles.slideContent}>
        <View style={[styles.tag, { backgroundColor: item.accent + '18', borderColor: item.accent + '38' }]}>
          <Text style={[styles.tagText, { color: item.accent }]}>{item.tag}</Text>
        </View>

        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>

        <View style={styles.featureList}>
          {item.features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={[styles.featureIconWrap, { backgroundColor: item.accent + '15' }]}>
                <Ionicons name={f.icon} size={14} color={item.accent} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar style="light" />

      <SafeAreaView edges={['top']} style={styles.topBar}>
        {currentIndex < SLIDES.length - 1 ? (
          <TouchableOpacity style={styles.skipTouchable} onPress={handleDone} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : <View style={styles.skipTouchable} />}
        <View style={styles.stepCounter}>
          <Text style={styles.stepText}>{currentIndex + 1} / {SLIDES.length}</Text>
        </View>
      </SafeAreaView>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(i) => i.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / W);
          setCurrentIndex(idx);
        }}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      />

      <SafeAreaView style={styles.controls} edges={['bottom']}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: currentSlide.accent }]} />
        </View>

        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: currentSlide.accent, shadowColor: currentSlide.accent }]}
          onPress={goNext}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>
            {currentIndex < SLIDES.length - 1 ? 'Continue' : 'Find My WakaWay'}
          </Text>
          <Ionicons
            name={currentIndex < SLIDES.length - 1 ? 'arrow-forward' : 'navigate'}
            size={18}
            color="#fff"
          />
        </TouchableOpacity>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 0,
  },
  skipTouchable: { paddingVertical: 8, paddingHorizontal: 4, minWidth: 52 },
  skipText: { color: 'rgba(255,255,255,0.45)', fontSize: 15, fontWeight: '500' },
  stepCounter: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  stepText: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },

  slide: { width: W, flex: 1 },

  illustWrap: {
    height: 270,
    marginHorizontal: 24,
    marginTop: 12,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  illustRing3: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 1,
  },
  illustRing2: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
  },
  illustRing1: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustCore: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatOrb: {
    position: 'absolute',
    top: 46,
    right: 48,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  slideContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 26,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
  },
  tagText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },

  slideTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#F1F5F9',
    lineHeight: 43,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  slideSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 22,
    marginBottom: 24,
  },

  featureList: { gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },

  controls: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'android' ? 16 : 0,
    gap: 14,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 3, borderRadius: 2 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 28,
    paddingVertical: 16,
    marginBottom: 6,
    ...Platform.select({
      ios:     { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
