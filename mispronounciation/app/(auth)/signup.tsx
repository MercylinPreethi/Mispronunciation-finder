// app/(auth)/signup.tsx
import 'react-native-get-random-values';
import { View, Text, ScrollView, Alert, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FormField from '@/components/FormField';
import CustomButton from '@/components/CustomButton';
import { auth, database } from '@/lib/firebase';

const { width } = Dimensions.get('window');

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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useState(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  });

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

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient 
        colors={['#f093fb', '#f5576c', '#4facfe']} 
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Decorative elements */}
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          <View style={styles.decorativeCircle3} />
          
          <Animated.View 
            style={[
              styles.cardWrapper,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <View style={styles.glassCard}>
              {/* Logo Section */}
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={['#f093fb', '#f5576c']}
                  style={styles.logoGradient}
                >
                  <Icon name="person-add" size={40} color="#FFFFFF" />
                </LinearGradient>
              </View>

              <Text style={styles.title}>Create Account ✨</Text>
              <Text style={styles.subtitle}>Start your pronunciation journey today!</Text>

              <View style={styles.formContainer}>
                <FormField
                  title="Full Name"
                  value={form.username}
                  handleChangeText={(e: string) => setForm({ ...form, username: e })}
                  otherStyles={styles.field}
                  placeholder="John Doe"
                  icon={<Icon name="person" size={22} color="#f093fb" />}
                  error={errors.username}
                />
                <FormField
                  title="Email"
                  value={form.email}
                  handleChangeText={(e: string) => setForm({ ...form, email: e })}
                  otherStyles={styles.field}
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  icon={<Icon name="email" size={22} color="#f093fb" />}
                  error={errors.email}
                />
                <FormField
                  title="Password"
                  value={form.password}
                  handleChangeText={(e: string) => setForm({ ...form, password: e })}
                  otherStyles={styles.field}
                  isPasswordField={true}
                  placeholder="Minimum 6 characters"
                  icon={<Icon name="lock" size={22} color="#f093fb" />}
                  error={errors.password}
                />
                <FormField
                  title="Confirm Password"
                  value={form.reEnterPassword}
                  handleChangeText={(e: string) => setForm({ ...form, reEnterPassword: e })}
                  otherStyles={styles.field}
                  isPasswordField={true}
                  placeholder="Re-enter your password"
                  icon={<Icon name="lock" size={22} color="#f093fb" />}
                  error={errors.reEnterPassword}
                />

                <CustomButton
                  title={isSubmitting ? "Creating Account..." : "Create Account"}
                  handlePress={submit}
                  containerStyle={styles.submitButton}
                  isLoading={isSubmitting}
                />

                <View style={styles.dividerContainer}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.divider} />
                </View>

                <View style={styles.socialButtonsContainer}>
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => Alert.alert('Coming Soon', 'Google sign-up will be available soon!')}
                  >
                    <View style={styles.socialIconContainer}>
                      <Icon name="login" size={24} color="#f093fb" />
                    </View>
                    <Text style={styles.socialButtonText}>Google</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => Alert.alert('Coming Soon', 'Apple sign-up will be available soon!')}
                  >
                    <View style={styles.socialIconContainer}>
                      <Icon name="phone-iphone" size={24} color="#f093fb" />
                    </View>
                    <Text style={styles.socialButtonText}>Apple</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.prompt}>
                  <Text style={styles.promptText}>Already have an account? </Text>
                  <Link href="/(auth)/signin" style={styles.promptLink}>Sign In</Link>
                </View>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: 'center', 
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    top: -80,
    left: -80,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    bottom: -60,
    right: -60,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: '40%',
    right: -30,
  },
  cardWrapper: {
    zIndex: 10,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 30,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f093fb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  title: { 
    fontSize: 32, 
    fontWeight: '800', 
    color: '#1a1a1a', 
    textAlign: 'center', 
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: { 
    fontSize: 16, 
    color: '#666', 
    textAlign: 'center', 
    marginBottom: 28,
    lineHeight: 24,
  },
  formContainer: {
    width: '100%',
  },
  field: { 
    marginBottom: 18,
  },
  submitButton: { 
    marginBottom: 24,
    marginTop: 8,
  },
  dividerContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 24,
  },
  divider: { 
    flex: 1, 
    height: 1, 
    backgroundColor: '#E0E0E0',
  },
  dividerText: { 
    fontSize: 14, 
    color: '#999', 
    marginHorizontal: 16,
    fontWeight: '500',
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  socialIconContainer: {
    marginBottom: 8,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  prompt: { 
    flexDirection: 'row', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptText: { 
    fontSize: 15, 
    color: '#666',
  },
  promptLink: { 
    fontSize: 15, 
    color: '#f093fb', 
    fontWeight: '700',
  },
});