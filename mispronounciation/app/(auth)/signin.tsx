import { View, Text, ScrollView, Alert, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FormField from '@/components/FormField';
import CustomButton from '@/components/CustomButton';
import { auth } from '@/lib/firebase';

const { width } = Dimensions.get('window');

export default function Signin() {
  const [form, setForm] = useState({
    email: '',
    password: '',
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
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('SignIn failed:', error.message);
      Alert.alert('Sign In Error', error.message || 'An error occurred during sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient 
        colors={['#667eea', '#764ba2', '#f093fb']} 
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
              {/* Logo/Icon Section with Pulse Effect */}
              <View style={styles.logoContainer}>
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.logoGradient}
                >
                  <Icon name="mic" size={48} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.logoPulse} />
              </View>

              {/* Welcome Section */}
              <View style={styles.headerSection}>
                <Text style={styles.title}>Welcome Back!</Text>
                <View style={styles.emojiContainer}>
                  <Text style={styles.emoji}>👋</Text>
                </View>
              </View>
              <Text style={styles.subtitle}>
                Sign in to continue your pronunciation mastery journey
              </Text>

              {/* Form Section */}
              <View style={styles.formContainer}>
                <FormField
                  title="Email Address"
                  value={form.email}
                  handleChangeText={(e: string) => setForm({ ...form, email: e })}
                  otherStyles={styles.field}
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  icon={<Icon name="email" size={22} color="#667eea" />}
                  error={errors.email}
                />
                <FormField
                  title="Password"
                  value={form.password}
                  handleChangeText={(e: string) => setForm({ ...form, password: e })}
                  otherStyles={styles.field}
                  isPasswordField={true}
                  placeholder="Enter your password"
                  icon={<Icon name="lock" size={22} color="#667eea" />}
                  error={errors.password}
                />

                <TouchableOpacity 
                  style={styles.forgotPassword}
                  onPress={() => Alert.alert('Coming Soon', 'Password reset will be available soon!')}
                >
                  <View style={styles.forgotPasswordContent}>
                    <Icon name="vpn-key" size={16} color="#667eea" />
                    <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                  </View>
                </TouchableOpacity>

                <CustomButton
                  title={isSubmitting ? "Signing In..." : "Sign In"}
                  handlePress={loginSubmit}
                  containerStyle={styles.submitButton}
                  isLoading={isSubmitting}
                  gradientColors={['#667eea', '#764ba2']}
                />

                {/* Divider */}
                <View style={styles.dividerContainer}>
                  <View style={styles.divider} />
                  <View style={styles.dividerTextContainer}>
                    <Text style={styles.dividerText}>or continue with</Text>
                  </View>
                  <View style={styles.divider} />
                </View>

                {/* Social Sign In Buttons */}
                <View style={styles.socialButtonsContainer}>
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => Alert.alert('Coming Soon', 'Google sign-in will be available soon!')}
                  >
                    <View style={[styles.socialIconContainer, { backgroundColor: '#F3F4F6' }]}>
                      <Icon name="g-translate" size={28} color="#667eea" />
                    </View>
                    <Text style={styles.socialButtonText}>Google</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.socialButton}
                    onPress={() => Alert.alert('Coming Soon', 'Apple sign-in will be available soon!')}
                  >
                    <View style={[styles.socialIconContainer, { backgroundColor: '#F3F4F6' }]}>
                      <Icon name="apple" size={28} color="#667eea" />
                    </View>
                    <Text style={styles.socialButtonText}>Apple</Text>
                  </TouchableOpacity>
                </View>

                {/* Sign Up Prompt */}
                <View style={styles.prompt}>
                  <Text style={styles.promptText}>New to the app? </Text>
                  <Link href="/(auth)/signup" style={styles.promptLink}>
                    Create an account
                  </Link>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Bottom Decoration */}
          <View style={styles.bottomDecoration}>
            <Text style={styles.decorationText}>🎯 Master Your Pronunciation</Text>
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
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    top: -120,
    right: -100,
    opacity: 0.6,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    bottom: -80,
    left: -80,
    opacity: 0.5,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: '45%',
    left: -40,
    opacity: 0.4,
  },
  cardWrapper: {
    zIndex: 10,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 32,
    padding: 36,
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
    shadowColor: '#667eea',
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
    borderColor: 'rgba(102, 126, 234, 0.3)',
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
    marginBottom: 36,
    lineHeight: 24,
    paddingHorizontal: 8,
    fontWeight: '500',
  },
  formContainer: {
    width: '100%',
  },
  field: { 
    marginBottom: 20,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 28,
    marginTop: -8,
  },
  forgotPasswordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '700',
  },
  submitButton: { 
    marginBottom: 28,
  },
  dividerContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 28,
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
    marginBottom: 28,
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
    shadowColor: '#667eea',
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
    paddingTop: 8,
  },
  promptText: { 
    fontSize: 15, 
    color: '#6B7280',
    fontWeight: '500',
  },
  promptLink: { 
    fontSize: 15, 
    color: '#667eea', 
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
