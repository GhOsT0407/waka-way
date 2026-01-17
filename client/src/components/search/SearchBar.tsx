import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
} from 'react-native';

import { useAppTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onClear?: () => void;
  showLocationIcon?: boolean;
  onLocationPress?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search destination...',
  value = '',
  onChangeText,
  onFocus,
  onClear,
  showLocationIcon = false,
  onLocationPress,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const { theme } = useAppTheme();

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <View style={[styles.container, isFocused && styles.containerFocused, { backgroundColor: theme.WHITE, borderColor: isFocused ? theme.PRIMARY : theme.BORDER }]}>
      <View style={styles.searchIcon}>
        <Text style={styles.searchIconText}>🔍</Text>
      </View>

      <TextInput
        style={[styles.input, { color: theme.TEXT }]}
        placeholder={placeholder}
        placeholderTextColor={theme.TEXT_SECONDARY}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {showLocationIcon && onLocationPress && (
        <TouchableOpacity
          style={styles.locationButton}
          onPress={onLocationPress}
          activeOpacity={0.7}
        >
          <Text style={styles.locationIcon}>📍</Text>
        </TouchableOpacity>
      )}

      {value.length > 0 && onClear && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={onClear}
          activeOpacity={0.7}
        >
          <Text style={styles.clearIcon}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.MEDIUM,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  containerFocused: {
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: SPACING.SM,
  },
  searchIconText: {
    fontSize: FONT_SIZES.BODY_LARGE,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZES.BODY,
    padding: 0,
  },
  locationButton: {
    marginLeft: SPACING.SM,
    padding: SPACING.XS,
  },
  locationIcon: {
    fontSize: FONT_SIZES.BODY_LARGE,
  },
  clearButton: {
    marginLeft: SPACING.SM,
    padding: SPACING.XS,
    borderRadius: BORDER_RADIUS.ROUND,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearIcon: {
    fontSize: FONT_SIZES.CAPTION,
    fontWeight: '600',
  },
});

