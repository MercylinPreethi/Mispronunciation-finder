import { View, Text, TextInput, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { FC, JSX, useState, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

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
  const glowAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(glowAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(glowAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(99, 102, 241, 0.2)', 'rgba(99, 102, 241, 1)'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  return (
    <View style={[styles.container, otherStyles]}>
      <Text style={styles.title}>{title}</Text>
      <Animated.View 
        style={[
          styles.inputContainer,
          { borderColor },
          error && styles.inputError
        ]}
      >
        {isFocused && (
          <Animated.View 
            style={[
              styles.glowEffect,
              { opacity: glowOpacity }
            ]}
          />
        )}
        <View style={styles.inputContent}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={handleChangeText}
            placeholder={placeholder}
            secureTextEntry={isPasswordField && !showPassword}
            placeholderTextColor="rgba(156, 163, 175, 0.8)"
            onFocus={handleFocus}
            onBlur={handleBlur}
            keyboardType={keyboardType as any}
          />
          {isPasswordField && (
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.toggleButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon 
                name={showPassword ? 'visibility' : 'visibility-off'} 
                size={22} 
                color="rgba(255, 255, 255, 0.7)" 
              />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
      {error && (
        <View style={styles.errorContainer}>
          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.errorGradient}
          >
            <Text style={styles.errorIcon}>⚠</Text>
            <Text style={styles.errorText}>{error}</Text>
          </LinearGradient>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputContainer: {
    position: 'relative',
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  glowEffect: {
    position: 'absolute',
    top: -1.5,
    left: -1.5,
    right: -1.5,
    bottom: -1.5,
    backgroundColor: '#6366F1',
    borderRadius: 17.5,
    zIndex: -1,
  },
  inputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    position: 'relative',
    zIndex: 1,
  },
  iconContainer: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  toggleButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorContainer: {
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  errorGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  errorIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
  },
});

export default FormField;
