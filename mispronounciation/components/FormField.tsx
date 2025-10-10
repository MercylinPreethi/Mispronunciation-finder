import { View, Text, TextInput, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { FC, JSX, useState, useRef } from 'react';

interface FormFieldProps {
  title: string;
  value: string;
  handleChangeText: (text: string) => void;
  otherStyles?: any;
  keyboardType?: string;
  placeholder?: string;
  isPasswordField?: boolean;
  icon?: JSX.Element;
  error?: string;
}

const FormField: FC<FormFieldProps> = ({
  title,
  value,
  handleChangeText,
  otherStyles,
  keyboardType,
  placeholder,
  isPasswordField,
  icon,
  error,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.spring(labelAnim, {
      toValue: 1,
      useNativeDriver: false,
      tension: 100,
      friction: 7,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!value) {
      Animated.spring(labelAnim, {
        toValue: 0,
        useNativeDriver: false,
        tension: 100,
        friction: 7,
      }).start();
    }
  };

  const labelTop = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const labelFontSize = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, 12],
  });

  return (
    <View style={[styles.container, otherStyles]}>
      <View style={[
        styles.inputWrapper,
        isFocused && styles.inputWrapperFocused,
        error && styles.inputWrapperError
      ]}>
        <Animated.Text 
          style={[
            styles.label,
            {
              top: labelTop,
              fontSize: labelFontSize,
            },
            isFocused && styles.labelFocused,
            error && styles.labelError,
          ]}
        >
          {title}
        </Animated.Text>
        
        <View style={styles.inputRow}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={handleChangeText}
            placeholder={isFocused ? '' : placeholder}
            secureTextEntry={isPasswordField && !showPassword}
            placeholderTextColor="#9CA3AF"
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          {isPasswordField && (
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🔒'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    marginBottom: 24,
  },
  inputWrapper: {
    position: 'relative',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingTop: 22,
    paddingBottom: 12,
    paddingHorizontal: 16,
    minHeight: 65,
    transition: 'all 0.3s ease',
  },
  inputWrapperFocused: {
    borderColor: '#3B82F6',
    backgroundColor: '#FFFFFF',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  label: {
    position: 'absolute',
    left: 16,
    color: '#6B7280',
    fontWeight: '600',
    backgroundColor: 'transparent',
  },
  labelFocused: {
    color: '#3B82F6',
  },
  labelError: {
    color: '#EF4444',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
    paddingVertical: 4,
  },
  eyeButton: {
    padding: 4,
  },
  eyeIcon: {
    fontSize: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  errorIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
    flex: 1,
  },
});

export default FormField;
