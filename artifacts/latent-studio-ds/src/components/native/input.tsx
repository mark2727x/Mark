/**
 * Input and Textarea primitives.
 */
import React, { forwardRef } from "react";
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  type TextInputProps,
} from "react-native";
import { nativeTheme } from "../../lib/native-theme";

const c = nativeTheme.colors.dark;
const f = nativeTheme.fontFamily;
const r = nativeTheme.radius;

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, style, ...props },
  ref
) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={c.mutedForeground}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

export interface TextareaProps extends TextInputProps {
  label?: string;
  error?: string;
  rows?: number;
}

export const Textarea = forwardRef<TextInput, TextareaProps>(function Textarea(
  { label, error, rows = 4, style, ...props },
  ref
) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        multiline
        numberOfLines={rows}
        textAlignVertical="top"
        placeholderTextColor={c.mutedForeground}
        style={[styles.input, styles.textarea, { minHeight: rows * 22 }, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  label: {
    fontFamily: f.sansMedium,
    fontSize: 13,
    color: c.foreground,
    letterSpacing: 0.1,
  },
  input: {
    backgroundColor: c.input,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: r,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: f.sans,
    fontSize: 15,
    color: c.foreground,
    minHeight: 44,
  },
  textarea: {
    paddingTop: 10,
  },
  inputError: {
    borderColor: c.destructive,
  },
  error: {
    fontFamily: f.sans,
    fontSize: 12,
    color: c.destructive,
  },
});
