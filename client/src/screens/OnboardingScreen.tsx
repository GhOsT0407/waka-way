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
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';

export const ONBOARDING_DONE_KEY = '@waka_onboarding_done';

const { width: W, height: H } = Dimensions.get('window');

interface Slide {
  id: string;
  gradient: [string, string];
  emoji: string;
  title: string;
  subtitle: string;
  bullets: string[];
}

const SLIDES: Slide[] = [
  {
    id: '1',
    gradient: ['#1B5E20', '#2E7D32'],
    emoji: '🚌',
    title: 'Find Your WakaWay',
    subtitle: 'Navigate Lagos like a local',
    bullets: [
      'Get smart routes using danfo, keke, okada, BRT & ferry',
      'No Google Maps confusion — real Lagos directions',
      'See estimated fares before you board',
    ],
  },
  {
    id: '2',
    gradient: ['#004D40', '#00695C'],
    emoji: '📍',
    title: 'Your Route, Your Rules',
    subtitle: 'Pick your first transport mode',
    bullets: [
      'Tell us what transport is near you right now',
      'We plan the full journey from there',
      'Keke, danfo, walk — you choose the first step',
    ],
  },
  {
    id: '3',
    gradient: ['#1A237E', '#283593'],
    emoji: '🤝',
    title: 'Community First',
    subtitle: 'Lagos moves together',
    bullets: [
      'Report traffic, road hazards & police checkpoints',
      'Confirm or dismiss alerts from other Lagosians',
      'Save your favorite routes for quick access',
    ],
  },
];

interface OnboardingScreenProps {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleDone();
    }
  };

  const handleDone = async () => {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(onDone);
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <LinearGradient
      colors={item.gradient}
      style={styles.slide}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 0.9, y: 0.9 }}
    >
      <View style={styles.slideContent}>
        <Text style={styles.emoji}>{item.emoji}</Text>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>

        <View style={styles.bullets}>
          {item.bullets.map((b, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      </View>
    </LinearGradient>
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar style="light" />

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

      {/* Bottom controls */}
      <SafeAreaView style={styles.controls} edges={['bottom']}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.btns}>
          {currentIndex < SLIDES.length - 1 ? (
            <>
              <TouchableOpacity style={styles.skipBtn} onPress={handleDone}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
                <Text style={styles.nextText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={[styles.nextBtn, styles.getStartedBtn]} onPress={handleDone}>
              <Text style={styles.nextText}>Find My WakaWay</Text>
              <Ionicons name="navigate" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1B5E20' },
  slide:     { width: W, flex: 1 },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.XL,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 120,
  },
  emoji: {
    fontSize: 72,
    textAlign: 'center',
    marginBottom: SPACING.LG,
  },
  slideTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: SPACING.SM,
  },
  slideSubtitle: {
    fontSize: FONT_SIZES.BODY_LARGE,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: SPACING.XL,
  },
  bullets: { gap: SPACING.MD },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.MD },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A5D6A7',
    marginTop: 6,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: FONT_SIZES.BODY,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.LG,
    paddingBottom: Platform.OS === 'ios' ? 0 : SPACING.LG,
    backgroundColor: 'transparent',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.LG,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#fff',
  },
  btns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.MD,
  },
  skipBtn: { padding: SPACING.MD },
  skipText: { color: 'rgba(255,255,255,0.7)', fontSize: FONT_SIZES.BODY, fontWeight: '600' },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.XL,
    paddingVertical: SPACING.MD,
    borderRadius: BORDER_RADIUS.ROUND,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  getStartedBtn: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  nextText: { color: '#fff', fontSize: FONT_SIZES.BODY, fontWeight: '700' },
});
