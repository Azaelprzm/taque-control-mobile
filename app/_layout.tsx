import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AppColors } from '@/constants/app-theme';
import { AppDataProvider } from '@/lib/store';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const theme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: AppColors.paper, primary: AppColors.orange },
  };

  return (
    <AppDataProvider>
      <ThemeProvider value={theme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="edit-order" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="dark" />
      </ThemeProvider>
    </AppDataProvider>
  );
}
