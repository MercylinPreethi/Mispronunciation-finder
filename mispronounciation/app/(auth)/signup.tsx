// app/(auth)/signup.tsx
import 'react-native-get-random-values';
import { View, Text, ScrollView, Alert, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { createUserWithEmailAndPassword, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { getDatabase, ref, set } from 'firebase/database';
import { v4 as uuidv4 } from 'uuid';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FormField from '@/components/FormField';
import CustomButton from '@/components/CustomButton';
import { auth, database } from '@/lib/firebase';

const sanitizeUserId = (id: string | string[]): string => {
  if (Array.isArray(id)) id = id.join('');
  id = id.slice(0, 36).replace(/[^a-zA-Z0-9._-]/g, '');
  if (['.', '-', '_'].includes(id[0])) id = `user_${id}`;
  return id;
};

export default function Signup() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    reEnterPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const buttonScale = useRef(new Animated.Value(1)).current;



  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!form.username) newErrors.username = 'Full name is required';
    if (!form.email) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Invalid email address';
    if (!form.password) newErrors.password = 'Password is required';
    else if (form.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!form.reEnterPassword) newErrors.reEnterPassword = 'Please confirm your password';
    else if (form.password !== form.reEnterPassword) newErrors.reEnterPassword = 'Passwords do not match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: form.username });
      
      // Save profile to database
      const userProfileRef = ref(database, `users/${user.uid}/profile`);
      await set(userProfileRef, {
        username: form.username,
        email: form.email,
        createdAt: new Date().toISOString(),
        displayName: form.username,
        uid: user.uid
      });
      
      // Direct navigation after successful sign-up
      router.replace('/(tabs)');
      
    } catch (error: any) {
      let errorMessage = 'Failed to create account';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Use at least 6 characters';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/password accounts are not enabled';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Signup Error', errorMessage);
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
            <Text style={styles.title}>Create Your Account</Text>
            <Text style={styles.subtitle}>Join Pronunciation Coach today</Text>

            <FormField
              title="Full Name"
              value={form.username}
              handleChangeText={(e: string) => setForm({ ...form, username: e })}
              otherStyles={styles.field}
              placeholder="Enter your full name"
              icon={<Icon name="person" size={20} color="#6B7280" />}
              error={errors.username}
            />
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
              placeholder="Enter your password (min 6 characters)"
              icon={<Icon name="lock" size={20} color="#6B7280" />}
              error={errors.password}
            />
            <FormField
              title="Confirm Password"
              value={form.reEnterPassword}
              handleChangeText={(e: string) => setForm({ ...form, reEnterPassword: e })}
              otherStyles={styles.field}
              isPasswordField={true}
              placeholder="Re-enter your password"
              icon={<Icon name="lock" size={20} color="#6B7280" />}
              error={errors.reEnterPassword}
            />

            <TouchableOpacity
              activeOpacity={0.8}
              onPressIn={() => animateButton(0.95)}
              onPressOut={() => animateButton(1)}
              onPress={submit}
              disabled={isSubmitting}
            >
              <Animated.View style={[styles.submitButton, { transform: [{ scale: buttonScale }] }]}>
                <CustomButton
                  title={isSubmitting ? "Creating Account..." : "Create Account"}
                  handlePress={submit}
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
              title="Sign up with Google"
              containerStyle={styles.socialButton}
              icon={<Icon name="login" size={20} color="#6B7280" />}
              handlePress={() => {
                Alert.alert('Coming Soon', 'Google sign-up will be available soon!');
              }}
            />
            <CustomButton
              title="Sign up with Apple"
              containerStyle={styles.socialButton}
              icon={<Icon name="phone-iphone" size={20} color="#6B7280" />}
              handlePress={() => {
                Alert.alert('Coming Soon', 'Apple sign-up will be available soon!');
              }}
            />

            <View style={styles.prompt}>
              <Text style={styles.promptText}>Already have an account?</Text>
              <Link href="/(auth)/signin" style={styles.promptLink}>Sign In</Link>
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
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#1F2937', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  field: { marginBottom: 16 },
  submitButton: { backgroundColor: '#4F46E5', borderRadius: 8, height: 48, justifyContent: 'center', marginBottom: 16 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  divider: { flex: 1, height: 1, backgroundColor: '#D1D5DB' },
  dividerText: { fontSize: 14, color: '#6B7280', marginHorizontal: 8 },
  socialButton: { backgroundColor: '#F3F4F6', borderRadius: 8, height: 48, justifyContent: 'center', marginBottom: 8 },
  prompt: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  promptText: { fontSize: 14, color: '#6B7280', marginRight: 4 },
  promptLink: { fontSize: 14, color: '#4F46E5', fontWeight: '600', textDecorationLine: 'underline' },
});