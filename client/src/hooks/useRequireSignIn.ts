import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

/**
 * Routes never need an account. Writing to the shared map does — saving,
 * reporting, voting — because the RLS policies and the vote RPC check
 * auth.uid(). Ask at the moment it matters, in one line, with a way out.
 */
export function useRequireSignIn() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  return useCallback((toDo: string): boolean => {
    if (user) return true;
    Alert.alert(
      `Sign in to ${toDo}`,
      'Finding routes works without an account. Saving, reporting and confirming need one, so the map stays honest.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => navigation.navigate('Login') },
      ],
    );
    return false;
  }, [user, navigation]);
}
