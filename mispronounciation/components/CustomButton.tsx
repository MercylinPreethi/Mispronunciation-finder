import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
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
      style={[styles.container, containerStyle, isLoading && styles.disabled]}
      onPress={handlePress}
      disabled={isLoading}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={styles.text}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: { backgroundColor: '#A5B4FC' },
  content: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: 8 },
  text: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});

export default CustomButton;