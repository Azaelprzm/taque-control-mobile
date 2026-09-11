import { AppColors } from '@/constants/app-theme';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Option<T extends string> = { label: string; value: T };

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const fillAvailableWidth = options.length <= 3;
  const buttons = options.map((option) => {
    const selected = option.value === value;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        key={option.value}
        onPress={() => onChange(option.value)}
        style={[
          styles.option,
          fillAvailableWidth && styles.equalOption,
          selected && styles.optionSelected,
        ]}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          numberOfLines={1}
          style={[styles.label, selected && styles.labelSelected]}>
          {option.label}
        </Text>
      </Pressable>
    );
  });

  if (fillAvailableWidth) {
    return <View style={styles.equalRow}>{buttons}</View>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollRow}>
      {buttons}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  equalRow: { flexDirection: 'row', gap: 8 },
  scrollRow: { gap: 8, paddingRight: 4 },
  option: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.line,
    backgroundColor: AppColors.surface,
  },
  equalOption: { flex: 1, minWidth: 0, paddingHorizontal: 8 },
  optionSelected: { backgroundColor: AppColors.ink, borderColor: AppColors.ink },
  label: { color: AppColors.muted, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  labelSelected: { color: '#FFFFFF' },
});
