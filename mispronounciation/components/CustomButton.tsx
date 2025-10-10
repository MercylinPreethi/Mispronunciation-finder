import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FC, JSX, useRef, useEffect } from 'react';

interface CustomButtonProps {
  title: string;
  handlePress: () => void;
  containerStyle?: any;
  isLoading?: boolean;
  icon?: JSX.Element;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
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
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [isLoading]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      useNativeDriver: true,
      tension: 150,
      friction: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 4,
    }).start();
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const sizeStyles = {
    small: { height: 44 },
    medium: { height: 52 },
    large: { height: 60 },
  };

  const textSizes = {
    small: 14,
    medium: 15,
    large: 17,
  };

  // Ghost variant
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
            <ActivityIndicator color="#6366F1" size="small" />
          ) : (
            <View style={styles.content}>
              {icon && <View style={styles.iconContainer}>{icon}</View>}
              <Text style={[styles.text, styles.ghostText, { fontSize: textSizes[size] }]}>{title}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Outline variant
  if (variant === 'outline') {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.button, sizeStyles[size], !fullWidth && styles.inline, containerStyle]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#6366F1', '#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBorder}
          >
            <View style={styles.outlineInner}>
              {isLoading ? (
                <ActivityIndicator color="#6366F1" size="small" />
              ) : (
                <View style={styles.content}>
                  {icon && <View style={styles.iconContainer}>{icon}</View>}
                  <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ borderRadius: 4 }}
                  >
                    <Text style={[styles.text, styles.gradientText, { fontSize: textSizes[size] }]}>{title}</Text>
                  </LinearGradient>
                </View>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Danger variant
  if (variant === 'danger') {
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
            colors={isLoading ? ['#FCA5A5', '#FCA5A5'] : ['#EF4444', '#DC2626']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          >
            <View style={styles.gradientContent}>
              {isLoading ? (
                <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                  <Text style={styles.loadingIcon}>⚡</Text>
                </Animated.View>
              ) : (
                <View style={styles.content}>
                  {icon && <View style={styles.iconContainer}>{icon}</View>}
                  <Text style={[styles.text, styles.primaryText, { fontSize: textSizes[size] }]}>{title}</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Secondary variant
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
            <ActivityIndicator color="#6366F1" size="small" />
          ) : (
            <View style={styles.content}>
              {icon && <View style={styles.iconContainer}>{icon}</View>}
              <Text style={[styles.text, styles.secondaryText, { fontSize: textSizes[size] }]}>{title}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Primary variant (default)
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
          colors={isLoading ? ['#A5B4FC', '#C7D2FE'] : ['#6366F1', '#8B5CF6', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.gradientContent}>
            {isLoading ? (
              <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                <Text style={styles.loadingIcon}>⚡</Text>
              </Animated.View>
            ) : (
              <View style={styles.content}>
                {icon && <View style={styles.iconContainer}>{icon}</View>}
                <Text style={[styles.text, styles.primaryText, { fontSize: textSizes[size] }]}>{title}</Text>
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
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  inline: {
    alignSelf: 'flex-start',
  },
  gradient: {
    flex: 1,
  },
  gradientContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  gradientBorder: {
    flex: 1,
    padding: 3,
    borderRadius: 16,
  },
  outlineInner: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
    borderRadius: 13,
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
    marginRight: 10,
  },
  text: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  primaryText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  gradientText: {
    color: 'transparent',
  },
  secondaryButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  secondaryText: {
    color: '#6366F1',
    fontWeight: '800',
  },
  ghostButton: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  ghostText: {
    color: '#6366F1',
    fontWeight: '700',
  },
  loadingIcon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
});

export default CustomButton;
