import { AppColors } from '@/constants/app-theme';
import { getScreenGutter } from '@/constants/responsive-layout';
import type { PropsWithChildren, ReactNode, RefObject } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  scroll?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  includeBottomInset?: boolean;
}>;

export function AppScreen({
  title,
  subtitle,
  action,
  scroll = true,
  scrollRef,
  children,
  contentContainerStyle,
  includeBottomInset = false,
}: Props) {
  const { width } = useWindowDimensions();
  const horizontalPadding = getScreenGutter(width);
  const header = (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>EL SAZÓN DE MI TIERRA</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={includeBottomInset ? ['top', 'bottom'] : ['top']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {scroll ? (
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }, contentContainerStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}>
            {header}
            {children}
          </ScrollView>
        ) : (
          <View style={styles.fill}>
            <View style={[styles.staticContent, { paddingHorizontal: horizontalPadding }]}>{header}</View>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppColors.paper },
  fill: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: 36 },
  staticContent: {},
  header: {
    minHeight: 112,
    paddingTop: 18,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: AppColors.orange,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.7,
    marginBottom: 5,
  },
  title: { color: AppColors.ink, fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { color: AppColors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
});
