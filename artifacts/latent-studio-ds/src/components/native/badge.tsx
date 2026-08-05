/**
 * Badge — inline pill label.
 * Variants: default | outline | muted | success | destructive
 */
import React from "react";
import { View, Text, StyleSheet, type ViewProps } from "react-native";
import { nativeTheme } from "../../lib/native-theme.tsx";

const c = nativeTheme.colors.dark;
const f = nativeTheme.fontFamily;
const r = nativeTheme.radius;

export type BadgeVariant = "default" | "outline" | "muted" | "success" | "destructive";

interface BadgeProps extends ViewProps {
  variant?: BadgeVariant;
  label: string;
}

export function Badge({ variant = "default", label, style, ...props }: BadgeProps) {
  return (
    <View style={[styles.base, variantContainers[variant], style]} {...props}>
      <Text style={[styles.text, variantText[variant]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: r,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    borderWidth: 1,
  },
  text: {
    fontFamily: f.sansMedium,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});

const variantContainers: Record<BadgeVariant, object> = {
  default:     { backgroundColor: c.primary,     borderColor: c.primary },
  outline:     { backgroundColor: "transparent", borderColor: c.border },
  muted:       { backgroundColor: c.muted,       borderColor: c.muted },
  success:     { backgroundColor: "#7fd06822",   borderColor: "#7fd068" },
  destructive: { backgroundColor: c.destructive, borderColor: c.destructive },
};

const variantText: Record<BadgeVariant, object> = {
  default:     { color: c.primaryForeground },
  outline:     { color: c.foreground },
  muted:       { color: c.mutedForeground },
  success:     { color: "#7fd068" },
  destructive: { color: c.destructiveForeground },
};
