import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  LanguagePair: undefined;
  Main: undefined;
  Settings: undefined;
  Logs: undefined;
};

/** Navigation prop for screens rendered inside the Main tab shell. */
export type MainNavigation = NativeStackNavigationProp<RootStackParamList, 'Main'>;
