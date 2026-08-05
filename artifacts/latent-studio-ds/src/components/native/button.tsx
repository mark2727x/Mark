/**
 * Button primitive — variant × size.
 * Variants: default | outline | ghost | destructive
 * Sizes: sm | md | lg | icon
 */
import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { nativeTheme } from "../../lib/native-theme";

const c = nativeTheme.colors.dark;
const r = nativeTheme.radius;
const f = nativeTheme.fontFamily;

export type ButtonVariant = "default" | "outline" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends Omit<PressableProps, "style"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

export function Button({
  variant = "default",
  size = "md",
  loading = false,
  style,
  textStyle,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant].container,
        pressed && !isDisabled && variantStyles[variant].pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "default" ? c.primaryForeground : c.primary}
        />
      ) : (
        <Text style={[styles.text, sizeText[size], variantStyles[variant].text, textStyle]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: r,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  text: {
    fontFamily: f.sansMedium,
    letterSpacing: 0.1,
  },
  disabled: { opacity: 0.45 },
});

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  sm:   { paddingVertical: 6,  paddingHorizontal: 12, minHeight: 32 },
  md:   { paddingVertical: 10, paddingHorizontal: 18, minHeight: 42 },
  lg:   { paddingVertical: 14, paddingHorizontal: 24, minHeight: 50 },
  icon: { width: 40, height: 40, padding: 0 },
};

const sizeText: Record<ButtonSize, TextStyle> = {
  sm:   { fontSize: 13 },
  md:   { fontSize: 15 },
  lg:   { fontSize: 16 },
  icon: { fontSize: 15 },
};

const variantStyles: Record<ButtonVariant, { container: ViewStyle; pressed: ViewStyle; text: TextStyle }> = {
  default: {
    container: { backgroundColor: c.primary, borderColor: c.primary },
    pressed:   { backgroundColor: "#e04400" },
    text:      { color: c.primaryForeground },
  },
  outline: {
    container: { backgroundColor: "transparent", borderColor: c.border },
    pressed:   { backgroundColor: c.muted },
    text:      { color: c.foreground },
  },
  ghost: {
    container: { backgroundColor: "transparent", borderColor: "transparent" },
    pressed:   { backgroundColor: c.muted },
    text:      { color: c.foreground },
  },
  destructive: {
    container: { backgroundColor: c.destructive, borderColor: c.destructive },
    pressed:   { backgroundColor: "#cc3333" },
    text:      { color: c.destructiveForeground },
  },
};
