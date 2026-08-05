/**
 * Typography primitives — Space Grotesk (sans), Instrument Serif (serif), JetBrains Mono (mono).
 * All variants force dark mode by reading from nativeTheme.colors.dark directly.
 */
import React from "react";
import { Text, type TextProps, StyleSheet } from "react-native";
import { nativeTheme } from "../../lib/native-theme";

const c = nativeTheme.colors.dark;
const f = nativeTheme.fontFamily;

// Display — Instrument Serif, large editorial
export function Display({ style, ...props }: TextProps) {
  return <Text style={[styles.display, style]} {...props} />;
}

// Heading 1
export function H1({ style, ...props }: TextProps) {
  return <Text style={[styles.h1, style]} {...props} />;
}

// Heading 2
export function H2({ style, ...props }: TextProps) {
  return <Text style={[styles.h2, style]} {...props} />;
}

// Heading 3
export function H3({ style, ...props }: TextProps) {
  return <Text style={[styles.h3, style]} {...props} />;
}

// Body — default reading text
export function Body({ style, ...props }: TextProps) {
  return <Text style={[styles.body, style]} {...props} />;
}

// Small — slightly smaller body
export function Small({ style, ...props }: TextProps) {
  return <Text style={[styles.small, style]} {...props} />;
}

// Label — medium-weight label
export function Label({ style, ...props }: TextProps) {
  return <Text style={[styles.label, style]} {...props} />;
}

// Caption — muted smallest size
export function Caption({ style, ...props }: TextProps) {
  return <Text style={[styles.caption, style]} {...props} />;
}

// Mono — JetBrains Mono for codes/IDs
export function Mono({ style, ...props }: TextProps) {
  return <Text style={[styles.mono, style]} {...props} />;
}

const styles = StyleSheet.create({
  display: {
    fontFamily: f.serif,
    fontSize: 36,
    lineHeight: 42,
    color: c.foreground,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: f.sansBold,
    fontSize: 28,
    lineHeight: 34,
    color: c.foreground,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: f.sansSemiBold,
    fontSize: 22,
    lineHeight: 28,
    color: c.foreground,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: f.sansSemiBold,
    fontSize: 17,
    lineHeight: 22,
    color: c.foreground,
  },
  body: {
    fontFamily: f.sans,
    fontSize: 15,
    lineHeight: 22,
    color: c.foreground,
  },
  small: {
    fontFamily: f.sans,
    fontSize: 13,
    lineHeight: 18,
    color: c.foreground,
  },
  label: {
    fontFamily: f.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    color: c.foreground,
    letterSpacing: 0.1,
  },
  caption: {
    fontFamily: f.sans,
    fontSize: 11,
    lineHeight: 15,
    color: c.mutedForeground,
    letterSpacing: 0.3,
  },
  mono: {
    fontFamily: f.mono,
    fontSize: 12,
    lineHeight: 17,
    color: c.foreground,
  },
});
