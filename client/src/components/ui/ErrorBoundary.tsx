import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sentry } from '../../lib/sentry';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log internally — never surface raw error text to the user
    console.error('[ErrorBoundary]', error.message, info.componentStack);
    Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } });
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
          </View>
          <Text style={styles.heading}>Something went wrong</Text>
          <Text style={styles.body}>
            An unexpected error occurred. Please try again — your data is safe.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={this.reset} activeOpacity={0.8}>
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  iconWrap: {
    marginBottom: 8,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F1F5F9',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    marginTop: 20,
    backgroundColor: '#22C55E',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 50,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
