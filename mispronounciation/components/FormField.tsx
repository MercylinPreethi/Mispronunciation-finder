import { View, Text, TextInput, StyleSheet, Animated } from 'react-native';
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
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E7EB', '#667eea'],
  });

  const shadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.05, 0.15],
  });

  return (
    <View style={[styles.container, otherStyles]}>
      <Text style={styles.label}>{title}</Text>
      <Animated.View 
        style={[
          styles.inputContainer,
          {
            borderColor,
            shadowOpacity,
          }
        ]}
      >
        {icon && <View style={styles.icon}>{icon}</View>}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          secureTextEntry={isPasswordField}
          placeholderTextColor="#9CA3AF"
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </Animated.View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#1F2937', 
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  icon: { 
    marginLeft: 16,
    marginRight: 4,
  },
  input: { 
    flex: 1, 
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontSize: 15, 
    color: '#1F2937',
    fontWeight: '500',
  },
  error: { 
    fontSize: 12, 
    color: '#EF4444', 
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '600',
  },
});

export default FormField;