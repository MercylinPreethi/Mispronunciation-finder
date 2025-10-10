// app/(auth)/signup.tsx
import 'react-native-get-random-values';
import { View, Text, ScrollView, Alert, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { useState, useRef, useEffect } from 'react';
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
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
          {/* Decorative Background Elements */}
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          <View style={styles.decorativeCircle3} />
          <View style={styles.decorativeCircle4} />
          
          <Animated.View 
            style={[
              styles.cardWrapper,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }, { translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.glassCard}>
              {/* Logo Section with Animation */}
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={['#f093fb', '#f5576c']}
                  style={styles.logoGradient}
                >
                  <Icon name="person-add" size={48} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.logoPulse} />
              </View>

              {/* Welcome Section */}
              <View style={styles.headerSection}>
                <Text style={styles.title}>Create Account</Text>
                <View style={styles.emojiContainer}>
                  <Text style={styles.emoji}>✨</Text>
                </View>
              </View>
              <Text style={styles.subtitle}>
                Start your journey to perfect pronunciation today!
              </Text>

              {/* Form Section */}
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
                  title="Email Address"
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
                  icon={<Icon name="lock-outline" size={22} color="#f093fb" />}
                  error={errors.reEnterPassword}
                />

                <CustomButton
                  title={isSubmitting ? "Creating Account..." : "Create Account"}
                  handlePress={submit}
                  containerStyle={styles.submitButton}
                  isLoading={isSubmitting}
                  gradientColors={['#f093fb', '#f5576c']}
                />

                {/* Terms & Privacy */}
                <View style={styles.termsContainer}>
                  <Text style={styles.termsText}>
                    By signing up, you agree to our{' '}
                    <Text style={styles.termsLink}>Terms of Service</Text>
                    {' '}and{' '}
                    <Text style={styles.termsLink}>Privacy Policy</Text>
                  </Text>
                </View>

                {/* Divider */}
                <View style={styles.dividerContainer}>
                  <View style={styles.divider} />
                  <View style={styles.dividerTextContainer}>
                    <Text style={styles.dividerText}>or sign up with</Text>
                  </View>
                  <View style={styles.divider} />
                </View>

                {/* Social Sign Up Buttons */}
                <View style={styles.socialButtonsContainer}>
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => Alert.alert('Coming Soon', 'Google sign-up will be available soon!')}
                  >
                    <View style={[styles.socialIconContainer, { backgroundColor: '#F3F4F6' }]}>
                      <Icon name="g-translate" size={28} color="#f093fb" />
                    </View>
                    <Text style={styles.socialButtonText}>Google</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => Alert.alert('Coming Soon', 'Apple sign-up will be available soon!')}
                  >
                    <View style={[styles.socialIconContainer, { backgroundColor: '#F3F4F6' }]}>
                      <Icon name="apple" size={28} color="#f093fb" />
                    </View>
                    <Text style={styles.socialButtonText}>Apple</Text>
                  </TouchableOpacity>
                </View>

                {/* Sign In Prompt */}
                <View style={styles.prompt}>
                  <Text style={styles.promptText}>Already have an account? </Text>
                  <Link href="/(auth)/signin" style={styles.promptLink}>
                    Sign In
                  </Link>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Bottom Decoration */}
          <View style={styles.bottomDecoration}>
            <Text style={styles.decorationText}>🚀 Join Thousands of Learners</Text>
          </View>
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
    paddingHorizontal: 24,
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    top: -100,
    left: -80,
    opacity: 0.6,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    bottom: -70,
    right: -70,
    opacity: 0.5,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: '40%',
    right: -40,
    opacity: 0.4,
  },
  decorativeCircle4: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    top: '20%',
    left: -30,
    opacity: 0.3,
  },
  cardWrapper: {
    zIndex: 10,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 32,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.35,
    shadowRadius: 25,
    elevation: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
    position: 'relative',
  },
  logoGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f093fb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  logoPulse: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: 'rgba(240, 147, 251, 0.3)',
    transform: [{ scale: 1.3 }],
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { 
    fontSize: 34, 
    fontWeight: '900', 
    color: '#1a1a1a', 
    letterSpacing: 0.3,
  },
  emojiContainer: {
    marginLeft: 8,
  },
  emoji: {
    fontSize: 32,
  },
  subtitle: { 
    fontSize: 16, 
    color: '#6B7280', 
    textAlign: 'center', 
    marginBottom: 32,
    lineHeight: 24,
    paddingHorizontal: 8,
    fontWeight: '500',
  },
  formContainer: {
    width: '100%',
  },
  field: { 
    marginBottom: 18,
  },
  submitButton: { 
    marginBottom: 20,
    marginTop: 8,
  },
  termsContainer: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  termsText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  termsLink: {
    color: '#f093fb',
    fontWeight: '700',
  },
  dividerContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 24,
  },
  divider: { 
    flex: 1, 
    height: 1.5, 
    backgroundColor: '#E5E7EB',
  },
  dividerTextContainer: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dividerText: { 
    fontSize: 13, 
    color: '#9CA3AF', 
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    shadowColor: '#f093fb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  socialIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.3,
  },
  prompt: { 
    flexDirection: 'row', 
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  promptText: { 
    fontSize: 15, 
    color: '#6B7280',
    fontWeight: '500',
  },
  promptLink: { 
    fontSize: 15, 
    color: '#f093fb', 
    fontWeight: '800',
  },
  bottomDecoration: {
    marginTop: 32,
    alignItems: 'center',
  },
  decorationText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
});
