/**
 * Card + CardHeader + CardContent + CardFooter
 */
import React from "react";
import { View, StyleSheet, type ViewProps } from "react-native";
import { nativeTheme } from "../../lib/native-theme.tsx";

const c = nativeTheme.colors.dark;
const r = nativeTheme.radius;

export function Card({ style, children, ...props }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

export function CardHeader({ style, children, ...props }: ViewProps) {
  return (
    <View style={[styles.header, style]} {...props}>
      {children}
    </View>
  );
}

export function CardContent({ style, children, ...props }: ViewProps) {
  return (
    <View style={[styles.content, style]} {...props}>
      {children}
    </View>
  );
}

export function CardFooter({ style, children, ...props }: ViewProps) {
  return (
    <View style={[styles.footer, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: c.card,
    borderRadius: r,
    borderWidth: 1,
    borderColor: c.border,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 4,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: c.border,
    gap: 8,
  },
});
