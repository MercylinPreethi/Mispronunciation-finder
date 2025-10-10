import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FC, JSX, useRef, useEffect } from 'react';

interface CustomButtonProps {
  title: string;
  handlePress: () => void;
  containerStyle?: any;
  isLoading?: boolean;
  icon?: JSX.Element;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}

const CustomButton: FC<CustomButtonProps> = ({ 
  title, 
  handlePress, 
  containerStyle, 
  isLoading, 
  icon,
  variant = 'primary',
  size = 'large',
  fullWidth = true,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isLoading]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 100,
      friction: 3,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 3,
    }).start();
  };

  const sizeStyles = {
    small: styles.smallButton,
    medium: styles.mediumButton,
    large: styles.largeButton,
  };

  const textSizeStyles = {
    small: styles.smallText,
    medium: styles.mediumText,
    large: styles.largeText,
  };

  if (variant === 'ghost') {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.button, styles.ghostButton, sizeStyles[size], !fullWidth && styles.inline, containerStyle]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator color="#3B82F6" size="small" />
          ) : (
            <View style={styles.content}>
              {icon && <View style={styles.iconContainer}>{icon}</View>}
              <Text style={[styles.text, styles.ghostText, textSizeStyles[size]]}>{title}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (variant === 'outline') {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.button, styles.outlineButton, sizeStyles[size], !fullWidth && styles.inline, containerStyle]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator color="#3B82F6" size="small" />
          ) : (
            <View style={styles.content}>
              {icon && <View style={styles.iconContainer}>{icon}</View>}
              <Text style={[styles.text, styles.outlineText, textSizeStyles[size]]}>{title}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (variant === 'secondary') {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, sizeStyles[size], !fullWidth && styles.inline, containerStyle]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.content}>
              {icon && <View style={styles.iconContainer}>{icon}</View>}
              <Text style={[styles.text, styles.primaryText, textSizeStyles[size]]}>{title}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Primary button with gradient
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.button, sizeStyles[size], !fullWidth && styles.inline, containerStyle]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isLoading}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={isLoading ? ['#93C5FD', '#BFDBFE'] : ['#3B82F6', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          <View style={styles.gradientOverlay}>
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.content}>
                {icon && <View style={styles.iconContainer}>{icon}</View>}
                <Text style={[styles.text, styles.primaryText, textSizeStyles[size]]}>{title}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inline: {
    alignSelf: 'flex-start',
  },
  smallButton: {
    height: 40,
  },
  mediumButton: {
    height: 48,
  },
  largeButton: {
    height: 56,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 15,
  },
  largeText: {
    fontSize: 16,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  outlineText: {
    color: '#3B82F6',
    fontWeight: '700',
  },
  ghostButton: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  ghostText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
});

export default CustomButton;
