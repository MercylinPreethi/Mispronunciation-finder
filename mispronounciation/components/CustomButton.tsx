import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FC, JSX } from 'react';

interface CustomButtonProps {
  title: string;
  handlePress: () => void;
  containerStyle?: any;
  isLoading?: boolean;
  icon?: JSX.Element;
  variant?: 'primary' | 'secondary' | 'outline';
  gradientColors?: string[];
}

const CustomButton: FC<CustomButtonProps> = ({ 
  title, 
  handlePress, 
  containerStyle, 
  isLoading, 
  icon,
  variant = 'primary',
  gradientColors = ['#667eea', '#764ba2']
}) => {
  if (variant === 'outline') {
    return (
      <TouchableOpacity
        style={[styles.container, styles.outlineContainer, containerStyle, isLoading && styles.disabled]}
        onPress={handlePress}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <ActivityIndicator color="#667eea" />
        ) : (
          <View style={styles.content}>
            {icon && <View style={styles.icon}>{icon}</View>}
            <Text style={[styles.text, styles.outlineText]}>{title}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (variant === 'secondary') {
    return (
      <TouchableOpacity
        style={[styles.container, styles.secondaryContainer, containerStyle, isLoading && styles.disabled]}
        onPress={handlePress}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <ActivityIndicator color="#667eea" />
        ) : (
          <View style={styles.content}>
            {icon && <View style={styles.icon}>{icon}</View>}
            <Text style={[styles.text, styles.secondaryText]}>{title}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, containerStyle]}
      onPress={handlePress}
      disabled={isLoading}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={isLoading ? ['#C7D2FE', '#DDD6FE'] : gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <View style={styles.content}>
            {icon && <View style={styles.icon}>{icon}</View>}
            <Text style={styles.text}>{title}</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    height: 56,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  disabled: { 
    opacity: 0.6,
    shadowOpacity: 0.1,
  },
  content: { 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { marginRight: 10 },
  text: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#667eea',
    shadowOpacity: 0,
  },
  outlineText: {
    color: '#667eea',
  },
  secondaryContainer: {
    backgroundColor: '#F3F4F6',
    shadowOpacity: 0,
  },
  secondaryText: {
    color: '#667eea',
  },
});

export default CustomButton;