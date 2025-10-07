import { View, Text, ScrollView, Alert, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FormField from '@/components/FormField';
import CustomButton from '@/components/CustomButton';
import { auth } from '@/lib/firebase';

export default function Signin() {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const buttonScale = useRef(new Animated.Value(1)).current;

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!form.email) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Invalid email address';
    if (!form.password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const loginSubmit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, form.email, form.password);
      console.log('User signed in successfully:', userCredential.user.uid);
      
      // Direct navigation after successful sign-in
      router.replace('/(tabs)');
      
    } catch (error: any) {
      console.error('SignIn failed:', error.message);
      Alert.alert('Sign In Error', error.message || 'An error occurred during sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const animateButton = (scale: number) => {
    Animated.spring(buttonScale, { toValue: scale, useNativeDriver: true }).start();
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#F9FAFB', '#E5E7EB']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue your pronunciation journey</Text>

            <FormField
              title="Email"
              value={form.email}
              handleChangeText={(e: string) => setForm({ ...form, email: e })}
              otherStyles={styles.field}
              keyboardType="email-address"
              placeholder="Enter your email"
              icon={<Icon name="email" size={20} color="#6B7280" />}
              error={errors.email}
            />
            <FormField
              title="Password"
              value={form.password}
              handleChangeText={(e: string) => setForm({ ...form, password: e })}
              otherStyles={styles.field}
              isPasswordField={true}
              placeholder="Enter your password"
              icon={<Icon name="lock" size={20} color="#6B7280" />}
              error={errors.password}
            />

            <TouchableOpacity 
              style={styles.forgotPassword}
              onPress={() => Alert.alert('Coming Soon', 'Password reset will be available soon!')}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPressIn={() => animateButton(0.95)}
              onPressOut={() => animateButton(1)}
              onPress={loginSubmit}
              disabled={isSubmitting}
            >
              <Animated.View style={[styles.submitButton, { transform: [{ scale: buttonScale }] }]}>
                <CustomButton
                  title={isSubmitting ? "Signing In..." : "Sign In"}
                  handlePress={loginSubmit}
                  containerStyle={{}}
                  isLoading={isSubmitting}
                />
              </Animated.View>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>Or continue with</Text>
              <View style={styles.divider} />
            </View>

            <CustomButton
              title="Sign in with Google"
              containerStyle={styles.socialButton}
              icon={<Icon name="login" size={20} color="#6B7280" />}
              handlePress={() => {
                Alert.alert('Coming Soon', 'Google sign-in will be available soon!');
              }}
            />
            <CustomButton
              title="Sign in with Apple"
              containerStyle={styles.socialButton}
              icon={<Icon name="phone-iphone" size={20} color="#6B7280" />}
              handlePress={() => {
                Alert.alert('Coming Soon', 'Apple sign-in will be available soon!');
              }}
            />

            <View style={styles.prompt}>
              <Text style={styles.promptText}>Don't have an account?</Text>
              <Link href="/(auth)/signup" style={styles.promptLink}> Sign Up</Link>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 60 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    marginHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  title: { fontSize: 32, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 32 },
  field: { marginBottom: 20 },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  submitButton: { borderRadius: 12, height: 56, justifyContent: 'center', overflow: 'hidden' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  divider: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { fontSize: 14, color: '#6B7280', marginHorizontal: 12 },
  socialButton: { backgroundColor: '#F3F4F6', borderRadius: 12, height: 56, justifyContent: 'center', marginBottom: 12 },
  prompt: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  promptText: { fontSize: 16, color: '#6B7280', marginRight: 4 },
  promptLink: { fontSize: 16, color: '#6366F1', fontWeight: '600' },
});