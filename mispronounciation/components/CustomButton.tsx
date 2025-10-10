import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FC, JSX } from 'react';

interface CustomButtonProps {
  title: string;
  handlePress: () => void;
  containerStyle?: any;
  isLoading?: boolean;
  icon?: JSX.Element;
}

const CustomButton: FC<CustomButtonProps> = ({ title, handlePress, containerStyle, isLoading, icon }) => {
  return (
    <TouchableOpacity
      style={[styles.wrapper, containerStyle]}
      onPress={handlePress}
      disabled={isLoading}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={isLoading ? ['#A5B4FC', '#C7D2FE'] : ['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {isLoading ? (
          <ActivityIndicator color=\"#FFFFFF\" size=\"small\" />
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
  wrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  gradient: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: { 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { 
    marginRight: 8,
  },
  text: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export default CustomButton;