import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

export const colors = {
  ink: '#17283F',
  muted: '#6C7784',
  paper: '#F4F5EF',
  line: '#DDE2E3',
  white: '#FFFFFF',
  lime: '#E1FD78',
  blue: '#395CDD',
  orange: '#B74D30',
  mint: '#EDF3F5',
};
export const styles = StyleSheet.create({
  page: {
    padding: 22,
    paddingBottom: 36,
    gap: 18,
    width: '100%',
    maxWidth: 850,
    alignSelf: 'center',
  },
  title: {
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '700',
    letterSpacing: -1.2,
    color: colors.ink,
  },
  heading: { fontSize: 21, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  text: { fontSize: 15, lineHeight: 23, color: colors.ink },
  muted: { fontSize: 13, lineHeight: 20, color: colors.muted },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 16,
    fontSize: 17,
    color: colors.ink,
    minHeight: 54,
  },
  section: { gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink },
});
export function Card({
  children,
  dark = false,
  style,
}: {
  children: ReactNode;
  dark?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          padding: 20,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: dark ? colors.ink : colors.line,
          backgroundColor: dark ? colors.ink : colors.white,
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Badge({
  children,
  tone = 'soft',
}: {
  children: ReactNode;
  tone?: 'soft' | 'lime' | 'warning';
}) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 7,
        backgroundColor:
          tone === 'lime' ? colors.lime : tone === 'warning' ? '#FFEBDD' : colors.mint,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: tone === 'warning' ? colors.orange : colors.ink,
          letterSpacing: 0.7,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
export function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 13,
        paddingHorizontal: 18,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: secondary ? colors.white : colors.ink,
        borderWidth: 1,
        borderColor: secondary ? colors.line : colors.ink,
        opacity: disabled ? 0.4 : pressed ? 0.72 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: secondary ? colors.ink : colors.white,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Section({ title, right }: { title: string; right?: string }) {
  return (
    <View style={[styles.row, { justifyContent: 'space-between', marginTop: 6 }]}>
      <Text style={styles.heading}>{title}</Text>
      {right ? <Text style={styles.muted}>{right}</Text> : null}
    </View>
  );
}
export function Metric({
  value,
  label,
  light = false,
}: {
  value: string;
  label: string;
  light?: boolean;
}) {
  return (
    <View style={{ flex: 1, minWidth: 70, gap: 6 }}>
      <Text style={{ fontSize: 34, fontWeight: '600', color: light ? colors.white : colors.ink }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: light ? '#C5CEDA' : colors.muted }}>{label}</Text>
    </View>
  );
}
export function Empty({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.muted}>{message}</Text>
    </Card>
  );
}
