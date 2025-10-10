import { View, Text, TextInput, StyleSheet } from 'react-native';
import { FC, JSX } from 'react';

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
  return (
    <View style={[styles.container, otherStyles]}>
      <Text style={styles.label}>{title}</Text>
      <View style={[styles.inputContainer, error && styles.inputError]}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          secureTextEntry={isPasswordField}
          placeholderTextColor="#999"
          keyboardType={keyboardType as any}
        />
      </View>
      {error && <Text style={styles.error}>⚠️ {error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    marginBottom: 16,
  },
  label: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#333', 
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E8E8E8',
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputError: {
    borderColor: '#ff6b6b',
    backgroundColor: '#fff5f5',
  },
  icon: { 
    marginLeft: 16,
    marginRight: 4,
  },
  input: { 
    flex: 1, 
    padding: 16, 
    fontSize: 15, 
    color: '#1a1a1a',
    fontWeight: '500',
  },
  error: { 
    fontSize: 13, 
    color: '#ff6b6b', 
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '500',
  },
});

export default FormField;